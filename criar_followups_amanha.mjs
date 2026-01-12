import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log('🔍 Buscando todos os corretores...');

// Buscar todos os corretores (exceto Hellen que já tem follow-ups)
const [corretores] = await connection.execute(
  'SELECT id, name, email FROM users WHERE role = ? AND id != ?',
  ['corretor', 6600098]
);

console.log(`📊 Total de corretores (exceto Hellen): ${corretores.length}`);

let totalFollowUpsCriados = 0;

for (const corretor of corretores) {
  console.log(`\n👤 Processando corretor: ${corretor.name} (ID: ${corretor.id})`);
  
  // Buscar leads "em_atendimento" do corretor
  const [leads] = await connection.execute(
    'SELECT id, nome FROM leads WHERE corretorId = ? AND status = ?',
    [corretor.id, 'em_atendimento']
  );
  
  console.log(`   📋 Leads em atendimento: ${leads.length}`);
  
  if (leads.length === 0) {
    console.log('   ⏭️ Nenhum lead em atendimento, pulando...');
    continue;
  }
  
  // Calcular data de amanhã às 9h (timezone São Paulo)
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  amanha.setHours(9, 0, 0, 0);
  
  // Criar follow-up para cada lead
  for (const lead of leads) {
    // Verificar se já existe follow-up ativo para este lead
    const [existente] = await connection.execute(
      'SELECT id FROM follow_ups WHERE leadId = ? AND status = ?',
      [lead.id, 'ativo']
    );
    
    if (existente.length > 0) {
      console.log(`   ⏭️ Lead ${lead.nome} já tem follow-up ativo, pulando...`);
      continue;
    }
    
    // Criar follow-up
    await connection.execute(
      `INSERT INTO follow_ups (
        leadId, corretorId, proximaTentativa, tentativaAtual, maxTentativas, status, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [lead.id, corretor.id, amanha, 0, 3, 'ativo']
    );
    
    totalFollowUpsCriados++;
    console.log(`   ✅ Follow-up criado para ${lead.nome} (amanhã às 9h)`);
  }
}

console.log(`\n✅ Processo concluído!`);
console.log(`📊 Total de follow-ups criados: ${totalFollowUpsCriados}`);

// Verificar total final
const [total] = await connection.execute('SELECT COUNT(*) as count FROM follow_ups');
console.log(`📊 Total de follow-ups no sistema: ${total[0].count}`);

await connection.end();
