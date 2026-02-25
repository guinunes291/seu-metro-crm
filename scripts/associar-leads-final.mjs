import { createConnection } from 'mysql2/promise';
import fs from 'fs';

// Usar variável de ambiente diretamente
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL não encontrada nas variáveis de ambiente');
}

/**
 * Normaliza telefone removendo TODOS os caracteres não-numéricos
 * e retorna apenas os últimos 8-9 dígitos (número sem DDD)
 */
function normalizarTelefone(telefone) {
  if (!telefone) return '';
  // Remove tudo que não é número
  const apenasNumeros = telefone.toString().replace(/\D/g, '');
  // Retorna os últimos 8-9 dígitos (número sem DDD e sem código do país)
  return apenasNumeros.slice(-9);
}

async function associarLeadsProjetos() {
  const connection = await createConnection(DATABASE_URL);
  
  try {
    console.log('🔄 Iniciando associação de leads aos projetos...\n');
    
    // 1. Ler o CSV
    const csvPath = '/home/ubuntu/upload/leads-projetos-sheets.csv';
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    // Pegar o cabeçalho
    const header = lines[0].split(',');
    console.log(`📋 CSV carregado: ${lines.length - 1} linhas`);
    console.log(`📋 Cabeçalho: ${header.join(', ')}\n`);
    
    // Encontrar índices das colunas
    const telefoneIdx = header.findIndex(h => h.toLowerCase().includes('telefone'));
    const projetoIdx = header.findIndex(h => h.toLowerCase().includes('projeto'));
    
    if (telefoneIdx === -1 || projetoIdx === -1) {
      throw new Error(`Colunas não encontradas. Header: ${header.join(', ')}`);
    }
    
    console.log(`📞 Coluna telefone: índice ${telefoneIdx} (${header[telefoneIdx]})`);
    console.log(`🏢 Coluna projeto: índice ${projetoIdx} (${header[projetoIdx]})\n`);
    
    // 2. Buscar TODOS os leads do banco uma única vez
    console.log('🔍 Carregando todos os leads do banco...');
    const [allLeads] = await connection.execute(
      'SELECT id, nome, telefone, projetoCustom FROM leads'
    );
    console.log(`✅ ${allLeads.length} leads carregados do banco\n`);
    
    // 3. Criar mapa de telefones normalizados -> lead
    const telefoneMap = new Map();
    allLeads.forEach(lead => {
      const telNormalizado = normalizarTelefone(lead.telefone);
      if (telNormalizado) {
        // Pode haver múltiplos leads com mesmo telefone, guardar todos
        if (!telefoneMap.has(telNormalizado)) {
          telefoneMap.set(telNormalizado, []);
        }
        telefoneMap.get(telNormalizado).push(lead);
      }
    });
    
    console.log(`📱 ${telefoneMap.size} telefones únicos mapeados\n`);
    console.log('🔄 Processando leads do CSV...\n');
    
    // 4. Processar cada linha do CSV
    let leadsAtualizados = 0;
    let leadsNaoEncontrados = 0;
    let leadsSemProjeto = 0;
    let leadsJaTinhamProjeto = 0;
    const projetosProcessados = new Map(); // nome -> quantidade
    const telefonesSemMatch = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      // Parse CSV simples (assume que não há vírgulas dentro dos campos)
      const fields = line.split(',');
      
      const telefone = fields[telefoneIdx]?.trim();
      const projeto = fields[projetoIdx]?.trim();
      
      if (!telefone) continue;
      
      if (!projeto || projeto === '') {
        leadsSemProjeto++;
        continue;
      }
      
      // Normalizar telefone do CSV
      const telNormalizado = normalizarTelefone(telefone);
      
      // Buscar no mapa
      const leadsEncontrados = telefoneMap.get(telNormalizado);
      
      if (!leadsEncontrados || leadsEncontrados.length === 0) {
        leadsNaoEncontrados++;
        if (telefonesSemMatch.length < 10) {
          telefonesSemMatch.push({ csv: telefone, normalizado: telNormalizado });
        }
        continue;
      }
      
      // Atualizar TODOS os leads com esse telefone
      for (const lead of leadsEncontrados) {
        // Só atualiza se ainda não tem projeto
        if (lead.projetoCustom && lead.projetoCustom.trim() !== '') {
          leadsJaTinhamProjeto++;
          continue;
        }
        
        await connection.execute(
          'UPDATE leads SET projetoCustom = ? WHERE id = ?',
          [projeto, lead.id]
        );
        
        leadsAtualizados++;
        
        // Rastrear projetos processados
        const count = projetosProcessados.get(projeto) || 0;
        projetosProcessados.set(projeto, count + 1);
      }
      
      // Log a cada 1000 linhas
      if (i % 1000 === 0) {
        console.log(`✅ Processadas ${i} linhas... (${leadsAtualizados} leads atualizados)`);
      }
    }
    
    // 5. Relatório final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RELATÓRIO FINAL');
    console.log('='.repeat(60));
    console.log(`✅ Leads atualizados com sucesso: ${leadsAtualizados}`);
    console.log(`⏭️  Leads que já tinham projeto: ${leadsJaTinhamProjeto}`);
    console.log(`❌ Leads não encontrados no banco: ${leadsNaoEncontrados}`);
    console.log(`⚠️  Leads sem projeto no CSV: ${leadsSemProjeto}`);
    console.log('');
    
    // Mostrar exemplos de telefones sem match
    if (telefonesSemMatch.length > 0) {
      console.log('🔍 EXEMPLOS DE TELEFONES SEM MATCH (primeiros 10):');
      console.log('─'.repeat(60));
      telefonesSemMatch.forEach((tel, idx) => {
        console.log(`${idx + 1}. CSV: ${tel.csv.padEnd(15, ' ')} → Normalizado: ${tel.normalizado}`);
      });
      console.log('');
    }
    
    // Mostrar top 20 projetos
    console.log('🏢 TOP 20 PROJETOS PROCESSADOS:');
    console.log('─'.repeat(60));
    const sorted = Array.from(projetosProcessados.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    
    sorted.forEach(([nome, count], idx) => {
      const nomeFormatado = nome.length > 40 ? nome.substring(0, 37) + '...' : nome;
      console.log(`${(idx + 1).toString().padStart(2, ' ')}. ${nomeFormatado.padEnd(40, ' ')} → ${count} leads`);
    });
    
    console.log('\n✨ Processo concluído!\n');
    
  } catch (error) {
    console.error('❌ Erro:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Executar
associarLeadsProjetos().catch(console.error);
