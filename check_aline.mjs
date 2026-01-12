import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log('=== Buscando Aline ===');
const [alines] = await connection.execute(`
  SELECT id, name, email, role 
  FROM users 
  WHERE name LIKE '%Aline%' OR name LIKE '%aline%' OR email LIKE '%aline%'
  LIMIT 5
`);

console.log(`Encontrados: ${alines.length} usuários`);
alines.forEach(u => {
  console.log(`- ID: ${u.id}, Nome: ${u.name}, Email: ${u.email}, Role: ${u.role}`);
});

if (alines.length === 0) {
  console.log('Nenhuma Aline encontrada!');
  await connection.end();
  process.exit(0);
}

const alineId = alines[0].id;
console.log(`\n=== Verificando follow-ups da Aline (ID: ${alineId}) ===`);

const hoje = new Date();
hoje.setHours(0, 0, 0, 0);
const amanha = new Date(hoje);
amanha.setDate(amanha.getDate() + 1);

console.log(`Hoje: ${hoje.toISOString()}`);
console.log(`Amanhã: ${amanha.toISOString()}`);

// Buscar follow-ups direto no banco (CORRIGIDO: usando status ao invés de ativo)
const [followUpsDireto] = await connection.execute(`
  SELECT f.id, f.leadId, f.proximaTentativa, f.tentativaAtual, f.maxTentativas, f.status,
         l.nome as leadNome, l.status as leadStatus
  FROM follow_ups f
  LEFT JOIN leads l ON f.leadId = l.id
  WHERE f.corretorId = ?
    AND f.status = 'ativo'
    AND f.proximaTentativa <= ?
  ORDER BY f.proximaTentativa ASC
  LIMIT 10
`, [alineId, hoje]);

console.log(`\nFollow-ups ativos para hoje (proximaTentativa <= hoje): ${followUpsDireto.length}`);

if (followUpsDireto.length > 0) {
  console.log('\nPrimeiros 5 follow-ups:');
  followUpsDireto.slice(0, 5).forEach(f => {
    console.log(`- Lead: ${f.leadNome || 'N/A'} (ID: ${f.leadId})`);
    console.log(`  Status Lead: ${f.leadStatus}, Próxima: ${f.proximaTentativa}`);
    console.log(`  Tentativa: ${f.tentativaAtual}/${f.maxTentativas}, Status: ${f.status}`);
  });
}

// Testar com amanhã
const [followUpsAmanha] = await connection.execute(`
  SELECT f.id, f.leadId, f.proximaTentativa, f.tentativaAtual, f.maxTentativas, f.status,
         l.nome as leadNome, l.status as leadStatus
  FROM follow_ups f
  LEFT JOIN leads l ON f.leadId = l.id
  WHERE f.corretorId = ?
    AND f.status = 'ativo'
    AND f.proximaTentativa <= ?
  ORDER BY f.proximaTentativa ASC
  LIMIT 10
`, [alineId, amanha]);

console.log(`\nFollow-ups ativos para hoje (proximaTentativa <= amanhã): ${followUpsAmanha.length}`);

// Verificar leads da Aline
console.log(`\n=== Verificando leads da Aline ===`);
const [leadsAline] = await connection.execute(`
  SELECT id, nome, status, corretorId
  FROM leads
  WHERE corretorId = ?
  LIMIT 10
`, [alineId]);

console.log(`Total de leads: ${leadsAline.length}`);
if (leadsAline.length > 0) {
  console.log('\nPrimeiros 5 leads:');
  leadsAline.slice(0, 5).forEach(l => {
    console.log(`- ID: ${l.id}, Nome: ${l.nome}, Status: ${l.status}`);
  });
}

// Verificar leads em "em_atendimento"
const [leadsEmAtendimento] = await connection.execute(`
  SELECT COUNT(*) as total
  FROM leads
  WHERE corretorId = ? AND status = 'em_atendimento'
`, [alineId]);

console.log(`\nLeads em "Em Atendimento": ${leadsEmAtendimento[0].total}`);

// Verificar follow-ups com leads em "em_atendimento"
const [followUpsEmAtendimento] = await connection.execute(`
  SELECT f.id, f.leadId, f.proximaTentativa, l.status as leadStatus
  FROM follow_ups f
  INNER JOIN leads l ON f.leadId = l.id
  WHERE f.corretorId = ?
    AND f.status = 'ativo'
    AND l.status = 'em_atendimento'
    AND f.proximaTentativa <= ?
  LIMIT 5
`, [alineId, amanha]);

console.log(`\nFollow-ups de leads "Em Atendimento" (proximaTentativa <= amanhã): ${followUpsEmAtendimento.length}`);

// Verificar follow-ups de leads em atendimento com proximaTentativa <= hoje
const [followUpsEmAtendimentoHoje] = await connection.execute(`
  SELECT f.id, f.leadId, f.proximaTentativa, l.status as leadStatus, l.nome as leadNome
  FROM follow_ups f
  INNER JOIN leads l ON f.leadId = l.id
  WHERE f.corretorId = ?
    AND f.status = 'ativo'
    AND l.status = 'em_atendimento'
    AND f.proximaTentativa <= ?
  LIMIT 5
`, [alineId, hoje]);

console.log(`\nFollow-ups de leads "Em Atendimento" (proximaTentativa <= hoje): ${followUpsEmAtendimentoHoje.length}`);

if (followUpsEmAtendimentoHoje.length > 0) {
  console.log('\nDetalhes:');
  followUpsEmAtendimentoHoje.forEach(f => {
    console.log(`- Lead: ${f.leadNome} (ID: ${f.leadId}), Próxima: ${f.proximaTentativa}`);
  });
}

await connection.end();
