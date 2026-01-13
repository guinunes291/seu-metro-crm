import { getDb } from "./server/db.ts";
import { followUps } from "./drizzle/schema.ts";
import { eq, sql } from "drizzle-orm";

const db = await getDb();

console.log("🔧 Corrigindo follow-ups com tentativaAtual = 0...");

// Contar follow-ups com tentativaAtual = 0
const comZero = await db.select().from(followUps).where(eq(followUps.tentativaAtual, 0));
console.log(`📊 Follow-ups com tentativaAtual = 0: ${comZero.length}`);

if (comZero.length > 0) {
  console.log("\n🔧 Atualizando para tentativaAtual = 1...");
  
  await db.execute(sql`
    UPDATE follow_ups 
    SET tentativaAtual = 1
    WHERE tentativaAtual = 0
  `);
  
  console.log("✅ Follow-ups atualizados!");
}

// Verificar resultado
const aposCorrecao = await db.select().from(followUps).where(eq(followUps.tentativaAtual, 0));
console.log(`\n📊 Follow-ups com tentativaAtual = 0 após correção: ${aposCorrecao.length}`);

// Mostrar nova distribuição
const todos = await db.select().from(followUps);
const porTentativa = {};
todos.forEach(f => {
  const key = f.tentativaAtual ?? 'NULL';
  porTentativa[key] = (porTentativa[key] || 0) + 1;
});
console.log("\n📊 Nova distribuição por tentativaAtual:");
console.log(porTentativa);

process.exit(0);
