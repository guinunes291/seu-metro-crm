import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Verificar leads de Jefferson que têm nomes de teste
const [jeffTestLeads] = await conn.execute(`
  SELECT id, nome, email, telefone, corretorId FROM leads
  WHERE corretorId = 13835170
  AND (nome LIKE '%Batch%' OR nome LIKE '%Rank%' OR nome LIKE '%Teste%' OR nome LIKE '%Test%')
  LIMIT 20
`);
console.log("Leads de teste de Jefferson:");
jeffTestLeads.forEach(l => console.log(`  [${l.id}] ${l.nome} | ${l.email}`));

// Verificar leads com email de teste (independente do corretor)
const [testEmailLeads] = await conn.execute(`
  SELECT COUNT(*) as total FROM leads
  WHERE email LIKE '%@test.%' OR email LIKE '%@exemplo.com%' OR email LIKE '%lead-batch%' OR email LIKE '%lead-rank%'
`);
console.log(`\nLeads com email de teste: ${testEmailLeads[0].total}`);

// Verificar leads com nome "Sem nome"
const [semNome] = await conn.execute(`
  SELECT COUNT(*) as total FROM leads WHERE nome = 'Sem nome' OR nome = 'sem nome'
`);
console.log(`Leads "Sem nome": ${semNome[0].total}`);

// Resumo final da situação
const [summary] = await conn.execute(`
  SELECT 
    COUNT(*) as total_leads,
    SUM(CASE WHEN corretorId IN (SELECT id FROM users WHERE email LIKE '%@test.%' OR email LIKE '%@exemplo.com%') THEN 1 ELSE 0 END) as leads_corretor_teste,
    SUM(CASE WHEN nome LIKE '%Lead Batch%' OR nome LIKE '%Lead Rank%' OR nome LIKE '%Batch Lead%' THEN 1 ELSE 0 END) as leads_nome_batch_rank,
    SUM(CASE WHEN email LIKE '%@test.%' OR email LIKE '%@exemplo.com%' THEN 1 ELSE 0 END) as leads_email_teste,
    SUM(CASE WHEN nome = 'Sem nome' THEN 1 ELSE 0 END) as leads_sem_nome
  FROM leads
`);
console.log("\nResumo leads de teste:", JSON.stringify(summary[0], null, 2));

await conn.end();
