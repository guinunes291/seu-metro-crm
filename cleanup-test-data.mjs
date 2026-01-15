import mysql from 'mysql2/promise';

async function cleanupTestData() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    console.log('🧹 Iniciando limpeza de dados de teste...\n');
    
    // 1. Deletar interações relacionadas a leads de teste
    console.log('1. Limpando interações de leads de teste...');
    const [historyResult] = await conn.query(`
      DELETE FROM lead_history 
      WHERE leadId IN (
        SELECT id FROM leads 
        WHERE 
          nome LIKE '%test%' 
          OR nome LIKE '%teste%'
          OR nome LIKE '%Test%'
          OR nome LIKE '%Teste%'
          OR nome LIKE '%Batch%'
          OR nome LIKE '%Kanban%'
          OR email LIKE '%test%'
          OR email LIKE '%@example.com%'
          OR telefone LIKE '%(11) 99999-%'
          OR telefone LIKE '11999999%'
      )
    `);
    console.log(`   ✅ ${historyResult.affectedRows} interações removidas\n`);
    
    // 2. Deletar agendamentos relacionados a leads de teste
    console.log('2. Limpando agendamentos de leads de teste...');
    const [agendamentosResult] = await conn.query(`
      DELETE FROM agendamentos 
      WHERE leadId IN (
        SELECT id FROM leads 
        WHERE 
          nome LIKE '%test%' 
          OR nome LIKE '%teste%'
          OR nome LIKE '%Test%'
          OR nome LIKE '%Teste%'
          OR nome LIKE '%Batch%'
          OR nome LIKE '%Kanban%'
          OR email LIKE '%test%'
          OR email LIKE '%@example.com%'
          OR telefone LIKE '%(11) 99999-%'
          OR telefone LIKE '11999999%'
      )
    `);
    console.log(`   ✅ ${agendamentosResult.affectedRows} agendamentos removidos\n`);
    
    // 3. Deletar follow-ups relacionados a leads de teste
    console.log('3. Limpando follow-ups de leads de teste...');
    const [followupsResult] = await conn.query(`
      DELETE FROM follow_ups 
      WHERE leadId IN (
        SELECT id FROM leads 
        WHERE 
          nome LIKE '%test%' 
          OR nome LIKE '%teste%'
          OR nome LIKE '%Test%'
          OR nome LIKE '%Teste%'
          OR nome LIKE '%Batch%'
          OR nome LIKE '%Kanban%'
          OR email LIKE '%test%'
          OR email LIKE '%@example.com%'
          OR telefone LIKE '%(11) 99999-%'
          OR telefone LIKE '11999999%'
      )
    `);
    console.log(`   ✅ ${followupsResult.affectedRows} follow-ups removidos\n`);
    
    // 4. Deletar leads de teste
    console.log('4. Limpando leads de teste...');
    const [leadsResult] = await conn.query(`
      DELETE FROM leads 
      WHERE 
        nome LIKE '%test%' 
        OR nome LIKE '%teste%'
        OR nome LIKE '%Test%'
        OR nome LIKE '%Teste%'
        OR nome LIKE '%Batch%'
        OR nome LIKE '%Kanban%'
        OR email LIKE '%test%'
        OR email LIKE '%@example.com%'
        OR telefone LIKE '%(11) 99999-%'
        OR telefone LIKE '11999999%'
    `);
    console.log(`   ✅ ${leadsResult.affectedRows} leads removidos\n`);
    
    // 5. Deletar conquistas de usuários de teste
    console.log('5. Limpando conquistas de usuários de teste...');
    const [conquistasResult] = await conn.query(`
      DELETE FROM conquistas 
      WHERE corretorId IN (
        SELECT id FROM users 
        WHERE 
          name LIKE '%test%' 
          OR name LIKE '%teste%'
          OR name LIKE '%Test%'
          OR name LIKE '%Teste%'
          OR email LIKE '%test%'
          OR email LIKE '%@example.com%'
          OR email LIKE '%@manus.im%'
      )
    `);
    console.log(`   ✅ ${conquistasResult.affectedRows} conquistas removidas\n`);
    
    // 6. Deletar usuários de teste (exceto o admin principal)
    console.log('6. Limpando usuários de teste...');
    const [usersResult] = await conn.query(`
      DELETE FROM users 
      WHERE 
        (name LIKE '%test%' 
        OR name LIKE '%teste%'
        OR name LIKE '%Test%'
        OR name LIKE '%Teste%'
        OR email LIKE '%test%'
        OR email LIKE '%@example.com%'
        OR email LIKE '%@manus.im%')
        AND email != 'guilherme_97fm@outlook.com'
    `);
    console.log(`   ✅ ${usersResult.affectedRows} usuários removidos\n`);
    
    console.log('✨ Limpeza concluída com sucesso!\n');
    
    // Mostrar estatísticas finais
    const [leadsCount] = await conn.query('SELECT COUNT(*) as total FROM leads');
    const [usersCount] = await conn.query('SELECT COUNT(*) as total FROM users');
    const [agendamentosCount] = await conn.query('SELECT COUNT(*) as total FROM agendamentos');
    const [historyCount] = await conn.query('SELECT COUNT(*) as total FROM lead_history');
    
    console.log('📊 Dados restantes no sistema:');
    console.log(`   Leads: ${leadsCount[0].total}`);
    console.log(`   Usuários: ${usersCount[0].total}`);
    console.log(`   Agendamentos: ${agendamentosCount[0].total}`);
    console.log(`   Interações: ${historyCount[0].total}`);
    
  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
    throw error;
  } finally {
    await conn.end();
  }
}

cleanupTestData().catch(console.error);
