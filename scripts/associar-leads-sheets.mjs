import { createConnection } from 'mysql2/promise';
import { google } from 'googleapis';

// Usar variável de ambiente diretamente
const DATABASE_URL = process.env.DATABASE_URL;
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL não encontrada nas variáveis de ambiente');
}

if (!GOOGLE_SERVICE_ACCOUNT_JSON) {
  throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não encontrada nas variáveis de ambiente');
}

// Configurar autenticação do Google
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

// ID da planilha
const SPREADSHEET_ID = '1yoISMuiMPVhd4qyx8BOKzlDaW_xPzlRxGx7ardwMx-E';

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
    console.log('🔄 Iniciando associação de leads aos projetos via Google Sheets...\n');
    
    // 1. Ler dados do Google Sheets
    console.log('📊 Lendo dados do Google Sheets...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:D', // Nome, Telefone, Email, Projeto
    });
    
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      throw new Error('Nenhum dado encontrado na planilha');
    }
    
    // Pegar o cabeçalho
    const header = rows[0];
    console.log(`📋 Cabeçalho: ${header.join(', ')}`);
    console.log(`📋 Total de linhas: ${rows.length - 1}\n`);
    
    // Encontrar índices das colunas
    const nomeIdx = header.findIndex(h => h.toLowerCase().includes('nome'));
    const telefoneIdx = header.findIndex(h => h.toLowerCase().includes('telefone'));
    const projetoIdx = header.findIndex(h => h.toLowerCase().includes('projeto') || h.toLowerCase().includes('empreendimento'));
    
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
    console.log('🔄 Processando leads do Sheets...\n');
    
    // 4. Processar cada linha do Sheets
    let leadsAtualizados = 0;
    let leadsNaoEncontrados = 0;
    let leadsSemProjeto = 0;
    let leadsJaTinhamProjeto = 0;
    const projetosProcessados = new Map(); // nome -> quantidade
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      
      const telefone = row[telefoneIdx];
      const projeto = row[projetoIdx];
      
      if (!telefone) continue;
      
      if (!projeto || projeto.trim() === '') {
        leadsSemProjeto++;
        continue;
      }
      
      // Normalizar telefone do Sheets
      const telNormalizado = normalizarTelefone(telefone);
      
      // Buscar no mapa
      const leadsEncontrados = telefoneMap.get(telNormalizado);
      
      if (!leadsEncontrados || leadsEncontrados.length === 0) {
        leadsNaoEncontrados++;
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
          [projeto.trim(), lead.id]
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
    console.log(`⚠️  Leads sem projeto no Sheets: ${leadsSemProjeto}`);
    console.log('');
    
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
