import { getDb } from "./server/db.ts";
import { followUps } from "./drizzle/schema.ts";
import { sql } from "drizzle-orm";

const db = await getDb();

console.log("🔧 Corrigindo maxTentativas para 3...");

// Verificar distribuição atual
const todos = await db.select().from(followUps);
const porMax = {};
todos.forEach(f => {
  const key = f.maxTentativas ?? 'NULL';
  porMax[key] = (porMax[key] || 0) + 1;
});
console.log("\n📊 Distribuição ANTES por maxTentativas:");
console.log(porMax);

// Atualizar todos para maxTentativas = 3
await db.execute(sql`
  UPDATE follow_ups 
  SET maxTentativas = 3
`);

console.log("\n✅ Todos os follow-ups atualizados para maxTentativas = 3");

// Verificar resultado
const todosApos = await db.select().from(followUps);
const porMaxApos = {};
todosApos.forEach(f => {
  const key = f.maxTentativas ?? 'NULL';
  porMaxApos[key] = (porMaxApos[key] || 0) + 1;
});
console.log("\n📊 Distribuição DEPOIS por maxTentativas:");
console.log(porMaxApos);

// Verificar se há follow-ups com tentativaAtual > 3 (inválidos)
const invalidos = todosApos.filter(f => f.tentativaAtual > 3);
console.log(`\n⚠️  Follow-ups com tentativaAtual > 3: ${invalidos.length}`);

if (invalidos.length > 0) {
  console.log("🔧 Corrigindo follow-ups inválidos (tentativaAtual > 3)...");
  await db.execute(sql`
    UPDATE follow_ups 
    SET tentativaAtual = 3
    WHERE tentativaAtual > 3
  `);
  console.log("✅ Follow-ups inválidos corrigidos!");
}

process.exit(0);
