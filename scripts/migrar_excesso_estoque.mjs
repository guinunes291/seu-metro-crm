/**
 * Script: migrar_excesso_estoque.mjs
 * Migra leads em excesso (além de 20 aguardando_atendimento por corretor) para o estoque global.
 * Mantém os 20 leads mais antigos com cada corretor.
 * Execução: node scripts/migrar_excesso_estoque.mjs
 */

import { createConnection } from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL não definida. Execute com: DATABASE_URL=... node scripts/migrar_excesso_estoque.mjs");
  process.exit(1);
}

const conn = await createConnection(DATABASE_URL);

console.log("=== Iniciando migração de leads em excesso para o estoque ===\n");

// 1. Buscar todos os corretores com mais de 20 leads aguardando_atendimento
const [corretores] = await conn.execute(`
  SELECT 
    u.id, 
    u.name,
    COUNT(l.id) as total_aguardando
  FROM users u
  INNER JOIN leads l ON l.corretorId = u.id 
    AND l.status = 'aguardando_atendimento' 
    AND l.naLixeira = false
  WHERE u.role = 'corretor'
  GROUP BY u.id, u.name
  HAVING COUNT(l.id) > 20
  ORDER BY COUNT(l.id) DESC
`);

console.log(`Corretores com mais de 20 leads aguardando: ${corretores.length}`);
console.log("─".repeat(60));

let totalMigrados = 0;
let totalJaNoEstoque = 0;

for (const corretor of corretores) {
  // Buscar os leads aguardando do corretor, ordenados por data de criação (mais antigos primeiro)
  // Mantemos os 20 mais antigos e migramos o restante
  const [leadsAguardando] = await conn.execute(`
    SELECT id, tipoFilaOrigem
    FROM leads
    WHERE corretorId = ?
      AND status = 'aguardando_atendimento'
      AND naLixeira = false
    ORDER BY createdAt ASC
  `, [corretor.id]);

  const leadsParaMigrar = leadsAguardando.slice(20);

  console.log(`\n${corretor.name} (id: ${corretor.id})`);
  console.log(`  Total aguardando: ${leadsAguardando.length} | Manter: 20 | Migrar: ${leadsParaMigrar.length}`);

  let migradosCorretor = 0;
  let jaNoEstoqueCorretor = 0;

  for (const lead of leadsParaMigrar) {
    // Verificar se já está no estoque
    const [jaNoEstoque] = await conn.execute(`
      SELECT id FROM lead_estoque 
      WHERE leadId = ? AND status = 'aguardando'
      LIMIT 1
    `, [lead.id]);

    if (jaNoEstoque.length > 0) {
      jaNoEstoqueCorretor++;
      // Garantir que o corretorId está nulo mesmo assim
      await conn.execute(`
        UPDATE leads SET corretorId = NULL, updatedAt = NOW() WHERE id = ?
      `, [lead.id]);
      continue;
    }

    // Remover o corretor do lead
    await conn.execute(`
      UPDATE leads SET corretorId = NULL, updatedAt = NOW() WHERE id = ?
    `, [lead.id]);

    // Inserir no estoque
    const tipoFila = lead.tipoFilaOrigem === "foco" ? "foco" : "normal";
    await conn.execute(`
      INSERT INTO lead_estoque (leadId, tipoFila, motivoEstoque, tentativasDistribuicao, status, criadoEm)
      VALUES (?, ?, ?, 0, 'aguardando', NOW())
    `, [
      lead.id,
      tipoFila,
      `Migração: excesso de leads aguardando (${leadsAguardando.length} > 20)`
    ]);

    migradosCorretor++;
  }

  totalMigrados += migradosCorretor;
  totalJaNoEstoque += jaNoEstoqueCorretor;

  console.log(`  ✓ Migrados: ${migradosCorretor} | Já no estoque: ${jaNoEstoqueCorretor}`);
}

// Resumo final
const [estoqueTotal] = await conn.execute(`
  SELECT COUNT(*) as total FROM lead_estoque WHERE status = 'aguardando'
`);

const [semCorretor] = await conn.execute(`
  SELECT COUNT(*) as total FROM leads 
  WHERE corretorId IS NULL AND status = 'aguardando_atendimento' AND naLixeira = false
`);

console.log("\n" + "═".repeat(60));
console.log("RESUMO DA MIGRAÇÃO");
console.log("═".repeat(60));
console.log(`Leads migrados para o estoque: ${totalMigrados}`);
console.log(`Leads que já estavam no estoque: ${totalJaNoEstoque}`);
console.log(`Total no estoque agora: ${estoqueTotal[0].total}`);
console.log(`Leads sem corretor (aguardando): ${semCorretor[0].total}`);
console.log("═".repeat(60));

await conn.end();
console.log("\nMigração concluída com sucesso!");
