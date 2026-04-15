/**
 * Script: migrar_excesso_batch.mjs
 * Versão otimizada com batch SQL.
 * Migra leads em excesso (além de 20 aguardando_atendimento por corretor) para o estoque global.
 * Mantém os 20 leads mais antigos com cada corretor.
 */

import { createConnection } from "mysql2/promise";

const conn = await createConnection(process.env.DATABASE_URL);

console.log("=== Migração em batch de leads em excesso para o estoque ===\n");

// Passo 1: Identificar corretores com excesso
const [corretores] = await conn.execute(`
  SELECT u.id, u.name, COUNT(l.id) as total
  FROM users u
  INNER JOIN leads l ON l.corretorId = u.id 
    AND l.status = 'aguardando_atendimento' 
    AND l.naLixeira = false
  WHERE u.role = 'corretor'
  GROUP BY u.id, u.name
  HAVING COUNT(l.id) > 20
  ORDER BY COUNT(l.id) DESC
`);

console.log(`Corretores com excesso: ${corretores.length}`);
console.log("─".repeat(60));

let totalMigrados = 0;

for (const corretor of corretores) {
  // Buscar os IDs dos 20 leads mais antigos (que serão MANTIDOS)
  const [top20] = await conn.execute(`
    SELECT id FROM leads
    WHERE corretorId = ?
      AND status = 'aguardando_atendimento'
      AND naLixeira = false
    ORDER BY createdAt ASC
    LIMIT 20
  `, [corretor.id]);

  const idsParaManter = top20.map(r => r.id);

  // Buscar todos os leads em excesso (excluindo os 20 mantidos)
  let queryExcesso;
  let paramsExcesso;
  if (idsParaManter.length > 0) {
    queryExcesso = `
      SELECT id, tipoFilaOrigem FROM leads
      WHERE corretorId = ?
        AND status = 'aguardando_atendimento'
        AND naLixeira = false
        AND id NOT IN (${idsParaManter.map(() => '?').join(',')})
      ORDER BY createdAt ASC
    `;
    paramsExcesso = [corretor.id, ...idsParaManter];
  } else {
    queryExcesso = `
      SELECT id, tipoFilaOrigem FROM leads
      WHERE corretorId = ?
        AND status = 'aguardando_atendimento'
        AND naLixeira = false
      ORDER BY createdAt ASC
    `;
    paramsExcesso = [corretor.id];
  }

  const [leadsExcesso] = await conn.execute(queryExcesso, paramsExcesso);

  if (leadsExcesso.length === 0) continue;

  console.log(`\n${corretor.name}: ${corretor.total} aguardando → migrar ${leadsExcesso.length}`);

  const idsExcesso = leadsExcesso.map(l => l.id);

  // Passo A: Remover corretorId dos leads em excesso (batch)
  await conn.execute(`
    UPDATE leads SET corretorId = NULL, updatedAt = NOW()
    WHERE id IN (${idsExcesso.map(() => '?').join(',')})
  `, idsExcesso);

  // Passo B: Verificar quais já estão no estoque
  const [jaNoEstoque] = await conn.execute(`
    SELECT leadId FROM lead_estoque
    WHERE leadId IN (${idsExcesso.map(() => '?').join(',')})
      AND status = 'aguardando'
  `, idsExcesso);

  const idsJaNoEstoque = new Set(jaNoEstoque.map(r => r.leadId));
  const leadsParaInserir = leadsExcesso.filter(l => !idsJaNoEstoque.has(l.id));

  if (leadsParaInserir.length === 0) {
    console.log(`  ✓ Todos já estavam no estoque`);
    continue;
  }

  // Passo C: Inserir no estoque em batch (chunks de 500 para evitar limite de parâmetros)
  const CHUNK_SIZE = 500;
  let inseridos = 0;
  for (let i = 0; i < leadsParaInserir.length; i += CHUNK_SIZE) {
    const chunk = leadsParaInserir.slice(i, i + CHUNK_SIZE);
    const values = chunk.map(l => {
      const tipoFila = l.tipoFilaOrigem === "foco" ? "foco" : "normal";
      return [l.id, tipoFila, `Migração: excesso (${corretor.total} > 20)`, 0, "aguardando"];
    });
    const placeholders = values.map(() => "(?, ?, ?, ?, ?, NOW())").join(", ");
    const flatParams = values.flat();
    await conn.execute(`
      INSERT INTO lead_estoque (leadId, tipoFila, motivoEstoque, tentativasDistribuicao, status, criadoEm)
      VALUES ${placeholders}
    `, flatParams);
    inseridos += chunk.length;
    process.stdout.write(`\r  Inserindo no estoque: ${inseridos}/${leadsParaInserir.length}...`);
  }
  console.log(`\n  ✓ Migrados: ${inseridos} | Já no estoque: ${idsJaNoEstoque.size}`);
  totalMigrados += inseridos;
}

// Resumo final
const [estoqueTotal] = await conn.execute(`SELECT COUNT(*) as total FROM lead_estoque WHERE status = 'aguardando'`);
const [semCorretor] = await conn.execute(`SELECT COUNT(*) as total FROM leads WHERE corretorId IS NULL AND status = 'aguardando_atendimento' AND naLixeira = false`);
const [comCorretor] = await conn.execute(`
  SELECT u.name, COUNT(l.id) as total
  FROM users u
  INNER JOIN leads l ON l.corretorId = u.id AND l.status = 'aguardando_atendimento' AND l.naLixeira = false
  WHERE u.role = 'corretor'
  GROUP BY u.id, u.name
  ORDER BY COUNT(l.id) DESC
  LIMIT 10
`);

console.log("\n" + "═".repeat(60));
console.log("RESUMO FINAL");
console.log("═".repeat(60));
console.log(`Leads migrados nesta execução: ${totalMigrados}`);
console.log(`Total no estoque (aguardando): ${estoqueTotal[0].total}`);
console.log(`Leads sem corretor (aguardando): ${semCorretor[0].total}`);
console.log("\nTop 10 corretores por leads aguardando:");
comCorretor.forEach(c => console.log(`  ${c.name}: ${c.total}`));
console.log("═".repeat(60));

await conn.end();
console.log("\nMigração concluída!");
