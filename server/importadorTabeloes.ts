/**
 * Importador de Tabelões do Google Drive
 * 
 * Funções para importar tabelões diretamente do Google Drive
 */

import { exec } from "child_process";
import { promisify } from "util";
import { getDb } from "./db";

const db = await getDb();
import { construtoras, tabeloes } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

const execAsync = promisify(exec);

const RCLONE_CONFIG = "/home/ubuntu/.gdrive-rclone.ini";
const RCLONE_REMOTE = "manus_google_drive";
const TABELOES_PATH = "Tabelões Construtoras/Tabelões Mensais";

/**
 * Lista arquivos de uma pasta no Google Drive
 */
async function listDriveFiles(drivePath: string): Promise<any[]> {
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
 */
function extractConstructorName(fileName: string): string {
  const nameWithoutExt = fileName.replace(/\.pdf$/i, "");
  const match = nameWithoutExt.match(/^([^-]+)/);
  return match ? match[1].trim() : nameWithoutExt.trim();
}

/**
 * Mapeia nome do mês para número
 */
function monthNameToNumber(monthName: string): number {
  const months: Record<string, number> = {
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
export async function getOrCreateConstructor(name: string): Promise<number> {
  const [existing] = await db
    .select()
    .from(construtoras)
    .where(eq(construtoras.nome, name))
    .limit(1);
  
  if (existing) {
    return existing.id;
  }
  
  const [result] = await db
    .insert(construtoras)
    .values({ nome: name, ativo: 1 })
    .$returningId();
  
  console.log(`✅ Construtora criada: ${name}`);
  return result.id;
}

/**
 * Cria tabelão no banco de dados
 */
export async function createTabelao(
  construtoraId: number,
  mes: number,
  ano: number,
  drivePath: string
): Promise<number | null> {
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
    return null; // Já existe
  }
  
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
  
  return result.id;
}

/**
 * Importa tabelões de todos os meses
 */
export async function importAllTabeloes(): Promise<{
  construtoras: number;
  tabeloes: number;
  pendentes: number;
  erros: string[];
}> {
  const erros: string[] = [];
  let tabeloesImportados = 0;
  
  try {
    const monthFolders = await listDriveFiles(TABELOES_PATH);
    const monthDirs = monthFolders.filter(item => item.MimeType === 'inode/directory');
    
    for (const monthDir of monthDirs) {
      const yearMatch = monthDir.Name.match(/(\d{2})$/);
      const year = yearMatch ? 2000 + parseInt(yearMatch[1]) : 2026;
      
      const monthPath = `${TABELOES_PATH}/${monthDir.Name}`;
      const files = await listDriveFiles(monthPath);
      
      const pdfFiles = files.filter(file => 
        file.Name.toLowerCase().endsWith('.pdf') && file.MimeType === 'application/pdf'
      );
      
      const monthMatch = monthDir.Name.match(/^([^／]+)/);
      const monthName = monthMatch ? monthMatch[1] : monthDir.Name;
      const monthNumber = monthNameToNumber(monthName);
      
      for (const file of pdfFiles) {
        try {
          const constructorName = extractConstructorName(file.Name);
          const construtoraId = await getOrCreateConstructor(constructorName);
          
          const drivePath = `${monthPath}/${file.Name}`;
          const tabelaoId = await createTabelao(construtoraId, monthNumber, year, drivePath);
          
          if (tabelaoId) {
            tabeloesImportados++;
          }
        } catch (error) {
          const errorMsg = `Erro ao importar ${file.Name}: ${error instanceof Error ? error.message : String(error)}`;
          erros.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }
    }
    
    // Estatísticas
    const allConstrutoras = await db.select().from(construtoras);
    const allTabeloes = await db.select().from(tabeloes);
    const pendingTabeloes = await db
      .select()
      .from(tabeloes)
      .where(eq(tabeloes.statusProcessamento, 'pendente'));
    
    return {
      construtoras: allConstrutoras.length,
      tabeloes: allTabeloes.length,
      pendentes: pendingTabeloes.length,
      erros,
    };
  } catch (error) {
    erros.push(`Erro geral na importação: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
