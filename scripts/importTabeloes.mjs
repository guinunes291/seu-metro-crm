/**
 * Script de Importação de Tabelões do Google Drive
 * 
 * Este script:
 * 1. Varre a pasta "Tabelões Construtoras/Tabelões Mensais" no Google Drive
 * 2. Identifica todos os PDFs de tabelões
 * 3. Cria registros de construtoras (se não existirem)
 * 4. Cria registros de tabelões no banco de dados
 * 5. Processa cada tabelão com LLM para extrair projetos
 */

import { exec } from "child_process";
import { promisify } from "util";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { construtoras, tabeloes } from "../drizzle/schema.js";
import { eq, and } from "drizzle-orm";

const execAsync = promisify(exec);

const RCLONE_CONFIG = "/home/ubuntu/.gdrive-rclone.ini";
const RCLONE_REMOTE = "manus_google_drive";
const TABELOES_PATH = "Tabelões Construtoras/Tabelões Mensais";

// Conexão com o banco
const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

/**
 * Lista arquivos de uma pasta no Google Drive
 */
async function listDriveFiles(drivePath) {
  try {
    const command = `rclone lsjson "${RCLONE_REMOTE}:${drivePath}" --config ${RCLONE_CONFIG}`;
    const { stdout } = await execAsync(command);
    return JSON.parse(stdout);
  } catch (error) {
    console.error(`Erro ao listar arquivos de ${drivePath}:`, error);
    return [];
  }
}

/**
 * Extrai nome da construtora do nome do arquivo
 * Exemplo: "CURY - TABELÃO FEVEREIRO .pdf" -> "CURY"
 */
function extractConstructorName(fileName) {
  // Remover extensão
  const nameWithoutExt = fileName.replace(/\.pdf$/i, "");
  
  // Padrão: "CONSTRUTORA - TABELÃO MÊS"
  const match = nameWithoutExt.match(/^([^-]+)/);
  
  if (match) {
    return match[1].trim();
  }
  
  return nameWithoutExt.trim();
}

/**
 * Mapeia nome do mês para número
 */
function monthNameToNumber(monthName) {
  const months = {
    'janeiro': 1,
    'fevereiro': 2,
    'março': 3,
    'marco': 3,
    'abril': 4,
    'maio': 5,
    'junho': 6,
    'julho': 7,
    'agosto': 8,
    'setembro': 9,
    'outubro': 10,
    'novembro': 11,
    'dezembro': 12,
  };
  
  return months[monthName.toLowerCase()] || 1;
}

/**
 * Cria ou obtém construtora
 */
async function getOrCreateConstructor(name) {
  // Buscar construtora existente
  const [existing] = await db
    .select()
    .from(construtoras)
    .where(eq(construtoras.nome, name))
    .limit(1);
  
  if (existing) {
    return existing.id;
  }
  
  // Criar nova construtora
  const [result] = await db
    .insert(construtoras)
    .values({
      nome: name,
      ativo: 1,
    })
    .$returningId();
  
  console.log(`✅ Construtora criada: ${name}`);
  return result.id;
}

/**
 * Cria tabelão no banco de dados
 */
async function createTabelao(construtoraId, mes, ano, drivePath) {
  // Verificar se tabelão já existe
  const [existing] = await db
    .select()
    .from(tabeloes)
    .where(
      and(
        eq(tabeloes.construtoraId, construtoraId),
        eq(tabeloes.mes, mes),
        eq(tabeloes.ano, ano)
      )
    )
    .limit(1);
  
  if (existing) {
    console.log(`⏭️  Tabelão já existe: ${drivePath}`);
    return existing.id;
  }
  
  // Criar novo tabelão
  const [result] = await db
    .insert(tabeloes)
    .values({
      construtoraId,
      mes,
      ano,
      drivePdfUrl: drivePath,
      statusProcessamento: 'pendente',
    })
    .$returningId();
  
  console.log(`✅ Tabelão criado: ${drivePath}`);
  return result.id;
}

/**
 * Importa tabelões de um mês específico
 */
async function importMonthTabeloes(monthFolderName, year) {
  const monthPath = `${TABELOES_PATH}/${monthFolderName}`;
  const files = await listDriveFiles(monthPath);
  
  // Filtrar apenas PDFs
  const pdfFiles = files.filter(file => 
    file.Name.toLowerCase().endsWith('.pdf') && file.MimeType === 'application/pdf'
  );
  
  console.log(`\n📁 ${monthFolderName}: ${pdfFiles.length} tabelões encontrados`);
  
  // Extrair número do mês do nome da pasta
  const monthMatch = monthFolderName.match(/^([^／]+)/);
  const monthName = monthMatch ? monthMatch[1] : monthFolderName;
  const monthNumber = monthNameToNumber(monthName);
  
  let imported = 0;
  let skipped = 0;
  
  for (const file of pdfFiles) {
    try {
      const constructorName = extractConstructorName(file.Name);
      const construtoraId = await getOrCreateConstructor(constructorName);
      
      const drivePath = `${monthPath}/${file.Name}`;
      const tabelaoId = await createTabelao(construtoraId, monthNumber, year, drivePath);
      
      if (tabelaoId) {
        imported++;
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`❌ Erro ao importar ${file.Name}:`, error.message);
    }
  }
  
  console.log(`✅ ${imported} importados, ${skipped} já existiam`);
}

/**
 * Função principal
 */
async function main() {
  console.log("🚀 Iniciando importação de tabelões do Google Drive...\n");
  
  try {
    // Listar pastas de meses
    const monthFolders = await listDriveFiles(TABELOES_PATH);
    
    // Filtrar apenas pastas (diretórios)
    const monthDirs = monthFolders.filter(item => item.MimeType === 'inode/directory');
    
    console.log(`📅 Encontradas ${monthDirs.length} pastas de meses`);
    
    // Importar tabelões de cada mês
    for (const monthDir of monthDirs) {
      // Extrair ano do nome da pasta (ex: "Fevereiro／26" -> 2026)
      const yearMatch = monthDir.Name.match(/(\d{2})$/);
      const year = yearMatch ? 2000 + parseInt(yearMatch[1]) : 2026;
      
      await importMonthTabeloes(monthDir.Name, year);
    }
    
    console.log("\n✅ Importação concluída!");
    console.log("\n📊 Estatísticas:");
    
    // Contar construtoras
    const allConstrutoras = await db.select().from(construtoras);
    console.log(`   - Construtoras: ${allConstrutoras.length}`);
    
    // Contar tabelões
    const allTabeloes = await db.select().from(tabeloes);
    console.log(`   - Tabelões: ${allTabeloes.length}`);
    
    // Contar pendentes
    const pendingTabeloes = await db
      .select()
      .from(tabeloes)
      .where(eq(tabeloes.statusProcessamento, 'pendente'));
    console.log(`   - Pendentes de processamento: ${pendingTabeloes.length}`);
    
    console.log("\n💡 Próximo passo: Execute o processamento dos tabelões via interface admin");
    
  } catch (error) {
    console.error("\n❌ Erro na importação:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
