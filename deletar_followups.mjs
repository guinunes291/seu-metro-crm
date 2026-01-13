import { getDb } from "./server/db.ts";
import { followUps } from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";

const db = await getDb();

console.log("🗑️  Deletando todos os follow-ups ativos...\n");

// Contar follow-ups ativos antes
const todosAtivos = await db.select().from(followUps).where(eq(followUps.status, "ativo"));
console.log(`📊 Total de follow-ups ativos ANTES: ${todosAtivos.length}`);

// Deletar todos os follow-ups ativos
await db.delete(followUps).where(eq(followUps.status, "ativo"));

console.log("\n✅ Follow-ups ativos deletados!");

// Verificar resultado
const aposDelecao = await db.select().from(followUps).where(eq(followUps.status, "ativo"));
console.log(`\n📊 Total de follow-ups ativos DEPOIS: ${aposDelecao.length}`);

// Contar total de follow-ups restantes (outros status)
const todosRestantes = await db.select().from(followUps);
console.log(`📊 Total de follow-ups restantes (todos os status): ${todosRestantes.length}`);

process.exit(0);
