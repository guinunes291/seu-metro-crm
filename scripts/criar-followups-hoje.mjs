import mysql from 'mysql2/promise';

// Configuração do banco de dados
const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
});

async function criarFollowUpsHoje() {
  console.log('🔍 Buscando leads em atendimento sem follow-up...\n');

  // Buscar leads em atendimento com corretor atribuído
  const [leadsEmAtendimento] = await connection.query(
    `SELECT id, nome, corretorId 
     FROM leads 
     WHERE status = 'em_atendimento' 
     AND corretorId IS NOT NULL 
     AND proximoFollowup IS NULL`
  );

  console.log(`📊 Encontrados ${leadsEmAtendimento.length} leads em atendimento sem follow-up\n`);

  if (leadsEmAtendimento.length === 0) {
    console.log('✅ Nenhum lead precisa de follow-up. Sistema já está atualizado!');
    await connection.end();
    return;
  }

  // Data de hoje às 9h (fuso de São Paulo)
  const hoje = new Date();
  hoje.setHours(9, 0, 0, 0);

  console.log(`📅 Data do follow-up: ${hoje.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n`);

  let sucessos = 0;
  let erros = 0;

  // Criar follow-up para cada lead
  for (const lead of leadsEmAtendimento) {
    try {
      // Atualizar lead com follow-up HOJE (ação única)
      await connection.query(
        `UPDATE leads 
         SET proximoFollowup = ? 
         WHERE id = ?`,
        [hoje, lead.id]
      );

      console.log(`✅ Lead #${lead.id} - ${lead.nome} (Corretor ID: ${lead.corretorId})`);
      sucessos++;
    } catch (error) {
      console.error(`❌ Erro ao criar follow-up para lead #${lead.id}:`, error.message);
      erros++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📊 RESUMO:`);
  console.log(`   ✅ Follow-ups criados: ${sucessos}`);
  console.log(`   ❌ Erros: ${erros}`);
  console.log(`   📅 Data agendada: HOJE às 9h (${hoje.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })})`);
  console.log('='.repeat(60));

  await connection.end();
  console.log('\n✅ Script finalizado com sucesso!');
}

// Executar
criarFollowUpsHoje().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
