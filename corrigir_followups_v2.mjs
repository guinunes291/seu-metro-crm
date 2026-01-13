import { getDb } from "./server/db.ts";
import { followUps } from "./drizzle/schema.ts";
import { isNull, or, sql } from "drizzle-orm";

const db = await getDb();

console.log("🔧 Corrigindo follow-ups com campos NULL ou undefined...");

// Buscar todos os follow-ups
const todos = await db.select().from(followUps);
console.log(`📊 Total de follow-ups no banco: ${todos.length}`);

// Contar quantos têm tentativaAtual NULL
const semTentativaAtual = todos.filter(f => f.tentativaAtual === null || f.tentativaAtual === undefined);
console.log(`📊 Follow-ups com tentativaAtual NULL: ${semTentativaAtual.length}`);

// Contar quantos têm maxTentativas NULL
const semMaxTentativas = todos.filter(f => f.maxTentativas === null || f.maxTentativas === undefined);
console.log(`📊 Follow-ups com maxTentativas NULL: ${semMaxTentativas.length}`);

if (semTentativaAtual.length > 0 || semMaxTentativas.length > 0) {
  console.log("\n🔧 Atualizando follow-ups...");
  
  // Atualizar TODOS os follow-ups para garantir valores corretos
  await db.execute(sql`
    UPDATE follow_ups 
    SET tentativaAtual = COALESCE(tentativaAtual, 1),
        maxTentativas = COALESCE(maxTentativas, 5)
    WHERE tentativaAtual IS NULL OR maxTentativas IS NULL
  `);
  
  console.log("✅ Follow-ups atualizados!");
}

// Verificar resultado
const todosApos = await db.select().from(followUps);
const aindaSemTentativa = todosApos.filter(f => f.tentativaAtual === null || f.tentativaAtual === undefined);
const aindaSemMax = todosApos.filter(f => f.maxTentativas === null || f.maxTentativas === undefined);

console.log("\n📊 Após correção:");
console.log(`  - Follow-ups com tentativaAtual NULL: ${aindaSemTentativa.length}`);
console.log(`  - Follow-ups com maxTentativas NULL: ${aindaSemMax.length}`);

// Mostrar distribuição
const porTentativa = {};
todosApos.forEach(f => {
  const key = f.tentativaAtual ?? 'NULL';
  porTentativa[key] = (porTentativa[key] || 0) + 1;
});
console.log("\n📊 Distribuição por tentativaAtual:");
console.log(porTentativa);

process.exit(0);
