import { getDb } from "./server/db.ts";
import { users, leads, followUps } from "./drizzle/schema.ts";
import { eq, and, lte } from "drizzle-orm";

const db = await getDb();

// Buscar Hellen
const hellen = await db.select().from(users).where(eq(users.email, "hellen.rs0710@gmail.com")).limit(1);
const hellenId = hellen[0].id;

console.log("✅ Hellen encontrada:", hellen[0].name, "ID:", hellenId);

// Buscar todos os follow-ups da Hellen
const todosFollowUps = await db.select().from(followUps).where(eq(followUps.corretorId, hellenId));
console.log("\n📊 Total de follow-ups da Hellen:", todosFollowUps.length);

// Agrupar por tentativaAtual
const porTentativa = {};
todosFollowUps.forEach(f => {
  const key = f.tentativaAtual ?? 'NULL';
  porTentativa[key] = (porTentativa[key] || 0) + 1;
});
console.log("\n📊 Distribuição por tentativaAtual:");
console.log(porTentativa);

// Buscar follow-ups ativos
const ativos = todosFollowUps.filter(f => f.status === 'ativo');
console.log("\n📊 Follow-ups ativos:", ativos.length);

// Buscar follow-ups para hoje
const hoje = new Date();
hoje.setHours(23, 59, 59, 999);

const followUpsHoje = ativos.filter(f => {
  const proxTentativa = new Date(f.proximaTentativa);
  return proxTentativa <= hoje;
});

console.log("📊 Follow-ups para hoje ou antes:", followUpsHoje.length);

// Verificar leads em_atendimento
const leadsEmAtendimento = await db.select()
  .from(leads)
  .where(and(
    eq(leads.corretorId, hellenId),
    eq(leads.status, "em_atendimento")
  ));

console.log("\n📊 Leads da Hellen em status 'em_atendimento':", leadsEmAtendimento.length);

// Simular query da interface (getFollowUpsDoDiaExpandido)
const followUpsInterface = await db.select({
  id: followUps.id,
  leadId: followUps.leadId,
  tentativaAtual: followUps.tentativaAtual,
  maxTentativas: followUps.maxTentativas,
  proximaTentativa: followUps.proximaTentativa,
  leadNome: leads.nome,
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

console.log("\n✅ Follow-ups que DEVEM aparecer na interface:", followUpsInterface.length);

if (followUpsInterface.length > 0) {
  console.log("\n📋 Primeiros 5 follow-ups:");
  followUpsInterface.slice(0, 5).forEach(f => {
    console.log(`  - ${f.leadNome} (tentativa ${f.tentativaAtual}/${f.maxTentativas})`);
  });
}

process.exit(0);
