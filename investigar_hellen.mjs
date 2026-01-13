import { getDb } from "./server/db.ts";
import { users, leads, followUps } from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";

const db = await getDb();

// Buscar Hellen
const hellen = await db.select().from(users).where(eq(users.email, "hellen.rs0710@gmail.com")).limit(1);

if (hellen.length === 0) {
  console.log("❌ Hellen não encontrada!");
  process.exit(1);
}

const hellenId = hellen[0].id;
console.log("✅ Hellen encontrada:", hellen[0].name, "ID:", hellenId);

// Buscar todos os follow-ups da Hellen
const todosFollowUps = await db.select().from(followUps).where(eq(followUps.corretorId, hellenId));
console.log("\n📊 Total de follow-ups da Hellen:", todosFollowUps.length);

// Buscar follow-ups ativos (tentativasRestantes > 0)
const followUpsAtivos = todosFollowUps.filter(f => f.tentativasRestantes > 0);
console.log("📊 Follow-ups ativos (tentativasRestantes > 0):", followUpsAtivos.length);

// Buscar follow-ups para hoje
const hoje = new Date();
hoje.setHours(23, 59, 59, 999); // Final do dia de hoje

const followUpsHoje = followUpsAtivos.filter(f => {
  const proxTentativa = new Date(f.proximaTentativa);
  return proxTentativa <= hoje;
});

console.log("📊 Follow-ups para hoje ou antes:", followUpsHoje.length);

// Mostrar alguns exemplos
if (followUpsHoje.length > 0) {
  console.log("\n📋 Exemplos de follow-ups para hoje:");
  for (const fu of followUpsHoje.slice(0, 5)) {
    const lead = await db.select().from(leads).where(eq(leads.id, fu.leadId)).limit(1);
    console.log(`  - Lead: ${lead[0]?.nome || "Sem nome"}, Próxima tentativa: ${fu.proximaTentativa}, Status lead: ${lead[0]?.status}`);
  }
}

// Verificar status dos leads dos follow-ups
console.log("\n📊 Status dos leads dos follow-ups ativos:");
const statusCount = {};
for (const fu of followUpsAtivos) {
  const lead = await db.select().from(leads).where(eq(leads.id, fu.leadId)).limit(1);
  const status = lead[0]?.status || "sem_status";
  statusCount[status] = (statusCount[status] || 0) + 1;
}
console.log(statusCount);

process.exit(0);
