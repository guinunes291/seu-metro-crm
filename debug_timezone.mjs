import { getDb } from "./server/db.ts";
import { users, leads, followUps } from "./drizzle/schema.ts";
import { eq, and, lte } from "drizzle-orm";

const db = await getDb();

console.log("🕐 DEBUG: Timezone e Follow-ups da Hellen\n");

// 1. Verificar timezone atual do servidor
const agora = new Date();
console.log("📅 Data/hora do servidor:", agora.toISOString());
console.log("📅 Data/hora local (toString):", agora.toString());

// 2. Importar função de timezone
const { inicioDoDiaHoje } = await import('./server/timezone.ts');
const hoje = inicioDoDiaHoje();
console.log("\n📅 inicioDoDiaHoje() retorna:", hoje.toISOString());
console.log("📅 inicioDoDiaHoje() toString:", hoje.toString());

// 3. Buscar Hellen
const hellen = await db.select().from(users).where(eq(users.email, "hellen.rs0710@gmail.com")).limit(1);
if (hellen.length === 0) {
  console.log("\n❌ Hellen não encontrada!");
  process.exit(1);
}
const hellenId = hellen[0].id;
console.log("\n✅ Hellen ID:", hellenId);

// 4. Buscar follow-ups da Hellen
const todosFollowUps = await db.select().from(followUps).where(eq(followUps.corretorId, hellenId));
console.log("\n📊 Total de follow-ups:", todosFollowUps.length);

// 5. Verificar follow-ups ativos
const ativos = todosFollowUps.filter(f => f.status === 'ativo');
console.log("📊 Follow-ups ativos:", ativos.length);

// 6. Mostrar datas de alguns follow-ups
console.log("\n📋 Primeiros 5 follow-ups (datas):");
ativos.slice(0, 5).forEach(f => {
  const proxTent = new Date(f.proximaTentativa);
  console.log(`  - ID ${f.id}: proximaTentativa = ${proxTent.toISOString()} (${proxTent.toString()})`);
  console.log(`    Comparação: proxTent <= hoje? ${proxTent <= hoje}`);
});

// 7. Simular query exata da interface
const followUpsQuery = await db.select({
  id: followUps.id,
  leadId: followUps.leadId,
  proximaTentativa: followUps.proximaTentativa,
  leadStatus: leads.status,
})
  .from(followUps)
  .innerJoin(leads, eq(followUps.leadId, leads.id))
  .where(and(
    eq(followUps.corretorId, hellenId),
    eq(followUps.status, "ativo"),
    eq(leads.status, "em_atendimento"),
    lte(followUps.proximaTentativa, hoje)
  ));

console.log("\n✅ Follow-ups que DEVERIAM aparecer (query exata):", followUpsQuery.length);

// 8. Verificar se o problema é o filtro de data
const semFiltroData = await db.select({
  id: followUps.id,
  leadId: followUps.leadId,
  proximaTentativa: followUps.proximaTentativa,
  leadStatus: leads.status,
})
  .from(followUps)
  .innerJoin(leads, eq(followUps.leadId, leads.id))
  .where(and(
    eq(followUps.corretorId, hellenId),
    eq(followUps.status, "ativo"),
    eq(leads.status, "em_atendimento")
  ));

console.log("📊 Follow-ups SEM filtro de data:", semFiltroData.length);

if (semFiltroData.length > 0) {
  console.log("\n📋 Datas dos follow-ups SEM filtro:");
  semFiltroData.slice(0, 5).forEach(f => {
    const proxTent = new Date(f.proximaTentativa);
    console.log(`  - proximaTentativa: ${proxTent.toISOString()}`);
    console.log(`    <= hoje (${hoje.toISOString()})? ${proxTent <= hoje}`);
  });
}

process.exit(0);
