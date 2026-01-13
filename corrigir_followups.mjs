import { getDb } from "./server/db.ts";
import { followUps } from "./drizzle/schema.ts";
import { isNull, sql } from "drizzle-orm";

const db = await getDb();

console.log("🔧 Corrigindo follow-ups com tentativasRestantes NULL...");

// Buscar todos os follow-ups com tentativasRestantes NULL
const followUpsNull = await db.select().from(followUps).where(isNull(followUps.tentativasRestantes));

console.log(`📊 Encontrados ${followUpsNull.length} follow-ups com tentativasRestantes NULL`);

if (followUpsNull.length > 0) {
  // Atualizar todos para tentativasRestantes = 3
  await db.update(followUps)
    .set({ tentativasRestantes: 3 })
    .where(isNull(followUps.tentativasRestantes));
  
  console.log(`✅ ${followUpsNull.length} follow-ups atualizados com tentativasRestantes = 3`);
}

// Verificar resultado
const followUpsAposCorrecao = await db.select().from(followUps).where(isNull(followUps.tentativasRestantes));
console.log(`📊 Follow-ups ainda com NULL após correção: ${followUpsAposCorrecao.length}`);

// Contar follow-ups por tentativasRestantes
const todos = await db.select().from(followUps);
const porTentativas = {};
todos.forEach(f => {
  const key = f.tentativasRestantes ?? 'NULL';
  porTentativas[key] = (porTentativas[key] || 0) + 1;
});
console.log("\n📊 Distribuição por tentativasRestantes após correção:");
console.log(porTentativas);

process.exit(0);
