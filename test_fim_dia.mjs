import { getDb } from "./server/db.ts";
import { users, leads, followUps } from "./drizzle/schema.ts";
import { eq, and, lte } from "drizzle-orm";

const db = await getDb();

console.log("🕐 TESTE: fimDoDiaHoje\n");

// Importar função de timezone
const { fimDoDiaHoje } = await import('./server/timezone.ts');
const fimDeHoje = fimDoDiaHoje();
console.log("📅 fimDoDiaHoje() retorna:", fimDeHoje.toISOString());
console.log("📅 fimDoDiaHoje() toString:", fimDeHoje.toString());

// Buscar Hellen
const hellen = await db.select().from(users).where(eq(users.email, "hellen.rs0710@gmail.com")).limit(1);
const hellenId = hellen[0].id;

// Testar query com fimDoDiaHoje
const followUpsQuery = await db.select({
  id: followUps.id,
  leadId: followUps.leadId,
  proximaTentativa: followUps.proximaTentativa,
})
  .from(followUps)
  .innerJoin(leads, eq(followUps.leadId, leads.id))
  .where(and(
    eq(followUps.corretorId, hellenId),
    eq(followUps.status, "ativo"),
    eq(leads.status, "em_atendimento"),
    lte(followUps.proximaTentativa, fimDeHoje)
  ));

console.log("\n✅ Follow-ups com fimDoDiaHoje:", followUpsQuery.length);

if (followUpsQuery.length > 0) {
  console.log("\n📋 Primeiros 5:");
  followUpsQuery.slice(0, 5).forEach(f => {
    const proxTent = new Date(f.proximaTentativa);
    console.log(`  - proximaTentativa: ${proxTent.toISOString()}`);
    console.log(`    <= fimDeHoje (${fimDeHoje.toISOString()})? ${proxTent <= fimDeHoje}`);
  });
}

process.exit(0);
