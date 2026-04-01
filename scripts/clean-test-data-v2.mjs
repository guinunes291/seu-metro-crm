/**
 * Script de limpeza de dados de teste - Seu Metro Quadrado CRM (v2)
 * Critério de remoção: usuários com email @test.com ou @exemplo.com
 * Preserva todos os usuários com emails reais (Gmail, Hotmail, etc.)
 */
import mysql from "mysql2/promise";

const DRY_RUN = !process.argv.includes("--executar");
const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log(`\n=== LIMPEZA DE DADOS DE TESTE - ${DRY_RUN ? 'DRY RUN' : 'EXECUÇÃO REAL'} ===\n`);

// Identificar usuários de teste (critério: email @test.com ou @exemplo.com)
const [testUsers] = await conn.execute(`
  SELECT id, name, email, role FROM users
  WHERE email LIKE '%@test.%' OR email LIKE '%@exemplo.com%'
  ORDER BY name
`);
const testUserIds = testUsers.map(u => u.id);
console.log(`Usuários de teste: ${testUsers.length}`);

// Contar leads de corretores de teste
let leadsFromTestUsers = 0;
if (testUserIds.length > 0) {
  const ph = testUserIds.map(() => '?').join(',');
  const [r] = await conn.execute(`SELECT COUNT(*) as total FROM leads WHERE corretorId IN (${ph})`, testUserIds);
  leadsFromTestUsers = Number(r[0].total);
}
console.log(`Leads de corretores de teste: ${leadsFromTestUsers}`);

// Leads adicionais de teste (por nome/email, independente do corretor)
const additionalCond = `(
  nome LIKE 'Lead Batch%' OR nome LIKE 'Lead Rank%' OR nome LIKE 'Batch Lead%'
  OR nome LIKE '%Lead Teste Duplicação%'
  OR email LIKE '%lead-dup@test.%' OR email LIKE '%@test.%'
)`;
const [addLeads] = await conn.execute(`SELECT COUNT(*) as total FROM leads WHERE ${additionalCond}`);
const addLeadsCount = Number(addLeads[0].total);
console.log(`Leads adicionais de teste (por nome/email): ${addLeadsCount}`);

const [totalBefore] = await conn.execute(`SELECT COUNT(*) as total FROM leads`);
const [totalUsersBefore] = await conn.execute(`SELECT COUNT(*) as total FROM users`);
const totalLeadsBefore = Number(totalBefore[0].total);
const totalUsersBefore2 = Number(totalUsersBefore[0].total);

console.log(`\nEstado atual: ${totalLeadsBefore} leads | ${totalUsersBefore2} usuários`);
console.log(`Serão removidos: ${testUsers.length} usuários | ~${leadsFromTestUsers + addLeadsCount} leads`);
console.log(`Restarão: ~${totalUsersBefore2 - testUsers.length} usuários | ~${totalLeadsBefore - leadsFromTestUsers - addLeadsCount} leads`);

if (DRY_RUN) {
  console.log(`\n⚠️  DRY RUN - execute com --executar para aplicar.\n`);
  await conn.end();
  process.exit(0);
}

console.log(`\n=== INICIANDO LIMPEZA ===\n`);

async function safeDelete(table, condition, params = []) {
  try {
    const [result] = await conn.execute(`DELETE FROM \`${table}\` WHERE ${condition}`, params);
    if (result.affectedRows > 0) console.log(`  ✓ ${table}: ${result.affectedRows} removidos`);
    return result.affectedRows;
  } catch (err) {
    if (err.code !== 'ER_NO_SUCH_TABLE') console.log(`  ⚠ ${table}: ${err.message}`);
    return 0;
  }
}

if (testUserIds.length > 0) {
  const ph = testUserIds.map(() => '?').join(',');
  const leadSubquery = `leadId IN (SELECT id FROM leads WHERE corretorId IN (${ph}))`;

  console.log("1. Limpando dados relacionados aos leads dos corretores de teste...");
  for (const t of ['lead_history','interacoes','agendamentos','visitas','contratos','analises_credito',
    'documentacoes','propostas','follow_ups','lead_status_transitions','distribution_log',
    'log_transferencias','carteira_ativa','tarefas','historico_atribuicoes']) {
    await safeDelete(t, leadSubquery, testUserIds);
  }

  console.log("\n2. Limpando dados dos corretores de teste...");
  for (const t of ['carteira_tarefas','tarefas_carteira','metas','metas_diarias','atividades_diarias',
    'historico_presenca','resumo_presenca_diaria','disponibilidade_corretor','desbloqueio_corretor',
    'conquistas','comissoes','indicacoes','escolha_diaria_follow_up','conversion_stats',
    'alertas','alertas_produtividade']) {
    await safeDelete(t, `corretorId IN (${ph})`, testUserIds);
  }

  console.log("\n3. Deletando leads dos corretores de teste...");
  const [r3] = await conn.execute(`DELETE FROM leads WHERE corretorId IN (${ph})`, testUserIds);
  console.log(`  ✓ leads: ${r3.affectedRows} removidos`);

  console.log("\n4. Deletando usuários de teste...");
  const [r4] = await conn.execute(`DELETE FROM users WHERE id IN (${ph})`, testUserIds);
  console.log(`  ✓ users: ${r4.affectedRows} removidos`);
}

console.log("\n5. Deletando leads adicionais de teste (por nome/email)...");
for (const t of ['lead_history','interacoes','agendamentos','visitas','contratos','analises_credito',
  'documentacoes','propostas','follow_ups','lead_status_transitions','distribution_log',
  'log_transferencias','carteira_ativa','tarefas','historico_atribuicoes']) {
  await safeDelete(t, `leadId IN (SELECT id FROM leads WHERE ${additionalCond})`);
}
const [r5] = await conn.execute(`DELETE FROM leads WHERE ${additionalCond}`);
console.log(`  ✓ leads adicionais: ${r5.affectedRows} removidos`);

const [totalAfter] = await conn.execute(`SELECT COUNT(*) as total FROM leads`);
const [totalUsersAfter] = await conn.execute(`SELECT COUNT(*) as total FROM users`);
console.log(`\n=== RESULTADO FINAL ===`);
console.log(`  Leads: ${totalLeadsBefore} → ${totalAfter[0].total} (removidos: ${totalLeadsBefore - Number(totalAfter[0].total)})`);
console.log(`  Usuários: ${totalUsersBefore2} → ${totalUsersAfter[0].total} (removidos: ${totalUsersBefore2 - Number(totalUsersAfter[0].total)})`);
console.log(`\n✅ Limpeza concluída!\n`);

await conn.end();
