/**
 * Script de limpeza de dados de teste
 * Preserva usuários reais e remove apenas dados de teste
 * 
 * Uso:
 *   node scripts/clean-test-data.mjs           → apenas análise
 *   node scripts/clean-test-data.mjs --executar → executa a limpeza
 */
import mysql from "mysql2/promise";

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log("=== ANÁLISE DOS DADOS DE TESTE ===\n");

// 1. Listar corretores de teste (campo é "name" na tabela users)
const [testUsers] = await connection.execute(`
  SELECT id, name, email, role
  FROM users
  WHERE (
    name LIKE '%Teste%'
    OR name LIKE '%Test%'
    OR name LIKE '%Rank 0%'
    OR name LIKE '%Rank 1%'
    OR name LIKE '%Rank 2%'
    OR name LIKE '%Batch%'
    OR name LIKE '%Sheets%'
    OR name LIKE '%Duplica%'
    OR name = 'Sem nome'
    OR email LIKE '%@test.%'
    OR email LIKE '%-test@%'
    OR email LIKE '%teste%'
  )
  AND role IN ('corretor', 'gestor', 'superintendente')
  ORDER BY name
`);

console.log(`Corretores/usuários de teste encontrados: ${testUsers.length}`);
testUsers.forEach(u => console.log(`  [${u.id}] ${u.name} | ${u.email} | ${u.role}`));

// 2. Leads atribuídos a corretores de teste
const testUserIds = testUsers.map(u => u.id);
let leadsDeCorretoresTeste = 0;
if (testUserIds.length > 0) {
  const placeholders = testUserIds.map(() => '?').join(',');
  const [rows] = await connection.execute(
    `SELECT COUNT(*) as total FROM leads WHERE corretorId IN (${placeholders})`,
    testUserIds
  );
  leadsDeCorretoresTeste = rows[0].total;
}
console.log(`\nLeads atribuídos a corretores de teste: ${leadsDeCorretoresTeste}`);

// 3. Leads de teste por nome/telefone/email (sem dono ou com dono de teste)
const [leadsByName] = await connection.execute(`
  SELECT COUNT(*) as total
  FROM leads
  WHERE (
    nome LIKE '%Teste%'
    OR nome LIKE '%Test%'
    OR nome LIKE '%Batch%'
    OR nome LIKE '%Rank C%'
    OR nome LIKE '%Sheets%'
    OR nome LIKE '%Duplica%'
    OR nome LIKE '%Kanban Test%'
    OR nome LIKE '%Histórico%'
    OR email LIKE '%@test.%'
    OR email LIKE '%lead-dup%'
  )
`);
console.log(`Leads de teste por nome/email: ${leadsByName[0].total}`);

// 4. Leads com telefones de teste (padrão 119999xxxx)
const [leadsByPhone] = await connection.execute(`
  SELECT COUNT(*) as total
  FROM leads
  WHERE telefone REGEXP '^1199(9{4}|0{4}|1{4}|2{4}|3{4}|4{4}|5{4}|6{4}|7{4}|8{4})-?(9{4}|0{4}|1{4}|2{4}|3{4}|4{4}|5{4}|6{4}|7{4}|8{4})$'
     OR telefone LIKE '(11) 99999-%'
`);
console.log(`Leads com telefones de teste: ${leadsByPhone[0].total}`);

// Total estimado
const [totalLeads] = await connection.execute(`SELECT COUNT(*) as total FROM leads`);
const [totalUsers] = await connection.execute(`SELECT COUNT(*) as total FROM users WHERE role != 'admin'`);
console.log(`\nTotal atual: ${totalLeads[0].total} leads | ${totalUsers[0].total} usuários (excl. admin)`);

console.log("\n=== RESUMO ===");
console.log(`Serão removidos: ~${testUsers.length} usuários de teste e seus leads associados`);
console.log("Execute com --executar para confirmar a limpeza");

if (process.argv.includes("--executar")) {
  console.log("\n=== EXECUTANDO LIMPEZA ===\n");

  if (testUserIds.length > 0) {
    const placeholders = testUserIds.map(() => '?').join(',');

    // Deletar em ordem para respeitar FKs
    console.log("1. Deletando carteira_tarefas dos corretores de teste...");
    const [r1] = await connection.execute(
      `DELETE FROM carteira_tarefas WHERE corretorId IN (${placeholders})`, testUserIds
    );
    console.log(`   → ${r1.affectedRows} registros removidos`);

    console.log("2. Deletando carteira_ativa dos corretores de teste...");
    const [r2] = await connection.execute(
      `DELETE FROM carteira_ativa WHERE corretorId IN (${placeholders})`, testUserIds
    );
    console.log(`   → ${r2.affectedRows} registros removidos`);

    console.log("3. Deletando lead_history dos leads dos corretores de teste...");
    const [r3] = await connection.execute(
      `DELETE FROM lead_history WHERE leadId IN (SELECT id FROM leads WHERE corretorId IN (${placeholders}))`,
      testUserIds
    );
    console.log(`   → ${r3.affectedRows} registros removidos`);

    console.log("4. Deletando interacoes dos leads dos corretores de teste...");
    const [r4] = await connection.execute(
      `DELETE FROM interacoes WHERE leadId IN (SELECT id FROM leads WHERE corretorId IN (${placeholders}))`,
      testUserIds
    );
    console.log(`   → ${r4.affectedRows} registros removidos`);

    console.log("5. Deletando leads dos corretores de teste...");
    const [r5] = await connection.execute(
      `DELETE FROM leads WHERE corretorId IN (${placeholders})`, testUserIds
    );
    console.log(`   → ${r5.affectedRows} leads removidos`);

    console.log("6. Deletando os corretores/usuários de teste...");
    const [r6] = await connection.execute(
      `DELETE FROM users WHERE id IN (${placeholders})`, testUserIds
    );
    console.log(`   → ${r6.affectedRows} usuários removidos`);
  }

  // Deletar leads de teste por nome/email (sem dono ou com dono real)
  console.log("7. Deletando leads de teste por nome/email...");
  const testLeadCondition = `(
    nome LIKE '%Teste%' OR nome LIKE '%Test%' OR nome LIKE '%Batch%'
    OR nome LIKE '%Rank C%' OR nome LIKE '%Sheets%' OR nome LIKE '%Duplica%'
    OR nome LIKE '%Kanban Test%' OR nome LIKE '%Histórico%'
    OR email LIKE '%@test.%' OR email LIKE '%lead-dup%'
  )`;
  await connection.execute(`DELETE FROM lead_history WHERE leadId IN (SELECT id FROM leads WHERE ${testLeadCondition})`);
  await connection.execute(`DELETE FROM interacoes WHERE leadId IN (SELECT id FROM leads WHERE ${testLeadCondition})`);
  await connection.execute(`DELETE FROM carteira_ativa WHERE leadId IN (SELECT id FROM leads WHERE ${testLeadCondition})`);
  const [r7] = await connection.execute(`DELETE FROM leads WHERE ${testLeadCondition}`);
  console.log(`   → ${r7.affectedRows} leads removidos`);

  // Verificar resultado final
  const [finalLeads] = await connection.execute(`SELECT COUNT(*) as total FROM leads`);
  const [finalUsers] = await connection.execute(`SELECT COUNT(*) as total FROM users WHERE role != 'admin'`);
  console.log(`\n✅ Limpeza concluída!`);
  console.log(`   Leads restantes: ${finalLeads[0].total}`);
  console.log(`   Usuários restantes (excl. admin): ${finalUsers[0].total}`);
}

await connection.end();
