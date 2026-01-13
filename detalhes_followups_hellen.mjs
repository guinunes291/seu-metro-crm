import { getDb } from "./server/db.ts";
import { users, leads, followUps } from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";

const db = await getDb();

// Buscar Hellen
const hellen = await db.select().from(users).where(eq(users.email, "hellen.rs0710@gmail.com")).limit(1);
const hellenId = hellen[0].id;

// Buscar todos os follow-ups da Hellen
const todosFollowUps = await db.select().from(followUps).where(eq(followUps.corretorId, hellenId));

console.log("📊 Análise detalhada dos follow-ups da Hellen:");
console.log("Total:", todosFollowUps.length);

// Agrupar por tentativasRestantes
const porTentativas = {};
todosFollowUps.forEach(f => {
  const key = f.tentativasRestantes;
  porTentativas[key] = (porTentativas[key] || 0) + 1;
});
console.log("\n📊 Por tentativasRestantes:");
console.log(porTentativas);

// Mostrar alguns exemplos de follow-ups
console.log("\n📋 Exemplos de follow-ups (primeiros 5):");
for (const fu of todosFollowUps.slice(0, 5)) {
  const lead = await db.select().from(leads).where(eq(leads.id, fu.leadId)).limit(1);
  console.log({
    leadNome: lead[0]?.nome || "Sem nome",
    tentativasRestantes: fu.tentativasRestantes,
    proximaTentativa: fu.proximaTentativa,
    ultimaTentativa: fu.ultimaTentativa,
    statusLead: lead[0]?.status,
    criadoEm: fu.criadoEm
  });
}

// Verificar datas das próximas tentativas
console.log("\n📅 Distribuição por data de próxima tentativa:");
const porData = {};
todosFollowUps.forEach(f => {
  const data = new Date(f.proximaTentativa).toISOString().split('T')[0];
  porData[data] = (porData[data] || 0) + 1;
});
console.log(porData);

// Verificar se há leads "em_atendimento" da Hellen
const leadsEmAtendimento = await db.select().from(leads)
  .where(eq(leads.corretorId, hellenId));

const emAtendimento = leadsEmAtendimento.filter(l => l.status === 'em_atendimento');
console.log("\n📊 Leads da Hellen por status:");
const statusCount = {};
leadsEmAtendimento.forEach(l => {
  statusCount[l.status] = (statusCount[l.status] || 0) + 1;
});
console.log(statusCount);
console.log("\nLeads em_atendimento:", emAtendimento.length);

process.exit(0);
