import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log('=== Buscando Aline ===');
const [alines] = await connection.execute(`
  SELECT id, name, email, role 
  FROM users 
  WHERE name LIKE '%Aline%' OR name LIKE '%aline%' OR email LIKE '%aline%'
  LIMIT 1
`);

if (alines.length === 0) {
  console.log('Aline não encontrada!');
  await connection.end();
  process.exit(1);
}

const alineId = alines[0].id;
console.log(`Aline encontrada: ID ${alineId}, Nome: ${alines[0].name}`);

// Buscar leads "em_atendimento" da Aline
console.log('\n=== Buscando leads "em_atendimento" da Aline ===');
const [leadsEmAtendimento] = await connection.execute(`
  SELECT id, nome, status
  FROM leads
  WHERE corretorId = ? AND status = 'em_atendimento'
`, [alineId]);

console.log(`Total de leads "em_atendimento": ${leadsEmAtendimento.length}`);

// Verificar quais já têm follow-up ativo
const [followUpsExistentes] = await connection.execute(`
  SELECT DISTINCT leadId
  FROM follow_ups
  WHERE corretorId = ? AND status = 'ativo'
`, [alineId]);

const leadsComFollowUp = new Set(followUpsExistentes.map(f => f.leadId));
console.log(`Leads que já têm follow-up ativo: ${leadsComFollowUp.size}`);

// Filtrar leads que precisam de follow-up
const leadsSemFollowUp = leadsEmAtendimento.filter(lead => !leadsComFollowUp.has(lead.id));
console.log(`Leads que precisam de follow-up: ${leadsSemFollowUp.length}`);

if (leadsSemFollowUp.length === 0) {
  console.log('\nTodos os leads "em_atendimento" já têm follow-up ativo!');
  await connection.end();
  process.exit(0);
}

// Criar follow-ups para hoje
const hoje = new Date();
hoje.setHours(9, 0, 0, 0); // 9h da manhã

console.log(`\n=== Criando ${leadsSemFollowUp.length} follow-ups para hoje (${hoje.toISOString()}) ===`);

let criados = 0;
let erros = 0;

for (const lead of leadsSemFollowUp) {
  try {
    await connection.execute(`
      INSERT INTO follow_ups (
        leadId, 
        corretorId, 
        tentativaAtual, 
        maxTentativas, 
        proximaTentativa, 
        status,
        createdAt,
        updatedAt
      ) VALUES (?, ?, 1, 5, ?, 'ativo', NOW(), NOW())
    `, [lead.id, alineId, hoje]);
    
    criados++;
    if (criados <= 5) {
      console.log(`✓ Follow-up criado para: ${lead.nome} (ID: ${lead.id})`);
    }
  } catch (error) {
    erros++;
    console.error(`✗ Erro ao criar follow-up para ${lead.nome}: ${error.message}`);
  }
}

console.log(`\n=== Resultado ===`);
console.log(`Follow-ups criados: ${criados}`);
console.log(`Erros: ${erros}`);

await connection.end();
