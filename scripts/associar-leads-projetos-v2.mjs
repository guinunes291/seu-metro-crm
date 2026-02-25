import { createConnection } from 'mysql2/promise';
import fs from 'fs';

// Usar variável de ambiente diretamente
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL não encontrada nas variáveis de ambiente');
}

async function associarLeadsProjetos() {
  const connection = await createConnection(DATABASE_URL);
  
  try {
    console.log('🔄 Iniciando associação de leads aos projetos...\n');
    
    // 1. Ler o CSV
    const csvPath = '/home/ubuntu/upload/GUI(1).csv';
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    // Pegar o cabeçalho e encontrar os índices das colunas (CSV usa ponto e vírgula)
    const header = lines[0].split(';').map(h => h.trim().replace(/^"|"/g, '').replace(/^\uFEFF/, ''));;
    const telefoneIdx = header.findIndex(h => h.toLowerCase().includes('telefone') || h.toLowerCase().includes('phone'));
    const empreendimentoIdx = header.findIndex(h => h.toLowerCase().includes('empreendimento') || h.toLowerCase().includes('projeto'));
    
    if (telefoneIdx === -1 || empreendimentoIdx === -1) {
      throw new Error(`Colunas não encontradas. Header: ${header.join(', ')}`);
    }
    
    console.log(`📋 CSV carregado: ${lines.length - 1} linhas`);
    console.log(`📞 Coluna telefone: índice ${telefoneIdx} (${header[telefoneIdx]})`);
    console.log(`🏢 Coluna empreendimento: índice ${empreendimentoIdx} (${header[empreendimentoIdx]})\n`);
    
    // 2. Processar cada linha do CSV
    let leadsAtualizados = 0;
    let leadsNaoEncontrados = 0;
    let leadsSemEmpreendimento = 0;
    const empreendimentosProcessados = new Map(); // nome -> quantidade
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      // Parse CSV com ponto e vírgula como separador
      const fields = line.split(';').map(f => f.trim().replace(/^'|'$/g, '').replace(/^"|"$/g, ''));
      
      const telefone = fields[telefoneIdx]?.replace(/^"|"$/g, '').trim();
      const empreendimento = fields[empreendimentoIdx]?.replace(/^"|"$/g, '').trim();
      
      if (!telefone) continue;
      
      if (!empreendimento) {
        leadsSemEmpreendimento++;
        continue;
      }
      
      // Normalizar telefone (remover caracteres especiais)
      const telefoneNormalizado = telefone.replace(/\D/g, '');
      
      // 3. Buscar lead no banco pelo telefone
      const [leadRows] = await connection.execute(
        'SELECT id, nome, projetoCustom FROM leads WHERE REPLACE(REPLACE(REPLACE(telefone, "-", ""), " ", ""), "(", "") LIKE ?',
        [`%${telefoneNormalizado}%`]
      );
      
      if (leadRows.length === 0) {
        leadsNaoEncontrados++;
        continue;
      }
      
      // 4. Atualizar o campo projetoCustom com o nome do empreendimento
      const lead = leadRows[0];
      await connection.execute(
        'UPDATE leads SET projetoCustom = ? WHERE id = ?',
        [empreendimento, lead.id]
      );
      
      leadsAtualizados++;
      
      // Rastrear empreendimentos processados
      const count = empreendimentosProcessados.get(empreendimento) || 0;
      empreendimentosProcessados.set(empreendimento, count + 1);
      
      // Log a cada 1000 leads
      if (leadsAtualizados % 1000 === 0) {
        console.log(`✅ ${leadsAtualizados} leads atualizados...`);
      }
    }
    
    // 5. Relatório final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RELATÓRIO FINAL');
    console.log('='.repeat(60));
    console.log(`✅ Leads atualizados com sucesso: ${leadsAtualizados}`);
    console.log(`❌ Leads não encontrados no banco: ${leadsNaoEncontrados}`);
    console.log(`⚠️  Leads sem empreendimento no CSV: ${leadsSemEmpreendimento}`);
    console.log('');
    
    // Mostrar top 20 empreendimentos
    console.log('🏢 TOP 20 EMPREENDIMENTOS PROCESSADOS:');
    console.log('─'.repeat(60));
    const sorted = Array.from(empreendimentosProcessados.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    
    sorted.forEach(([nome, count], idx) => {
      console.log(`${(idx + 1).toString().padStart(2, ' ')}. ${nome.padEnd(40, ' ')} → ${count} leads`);
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
