import { getDb } from "./server/db.ts";
import { users, followUps, leads } from "./drizzle/schema.ts";
import { eq, and, lte } from "drizzle-orm";
import { inicioDoDiaHoje, fimDoDiaHoje } from "./server/timezone.ts";

const db = await getDb();

// Buscar Hellen
const hellen = await db.select().from(users).where(eq(users.email, "hellen.alves@seumq.com.br")).limit(1);
if (hellen.length === 0) {
  console.log("Hellen não encontrada");
  process.exit(0);
}

console.log("Hellen ID:", hellen[0].id);

// Buscar follow-ups dela
const hoje = inicioDoDiaHoje();
const fimHoje = fimDoDiaHoje();

console.log("Hoje (início):", hoje);
console.log("Hoje (fim):", fimHoje);

const followUpsHellen = await db
  .select()
  .from(followUps)
  .leftJoin(leads, eq(followUps.leadId, leads.id))
  .where(
    and(
      eq(leads.corretorId, hellen[0].id),
      lte(followUps.proximaTentativa, fimHoje)
    )
  );

console.log("\nTotal follow-ups:", followUpsHellen.length);

// Filtrar por tentativaAtual < maxTentativas
const ativos = followUpsHellen.filter(f => 
  f.follow_ups.tentativaAtual < f.follow_ups.maxTentativas
);

console.log("Follow-ups ativos (tentativaAtual < maxTentativas):", ativos.length);

// Verificar concluídos hoje
const concluidos = ativos.filter(f => {
  if (!f.follow_ups.ultimaTentativa) return false;
  const ultimaTentativaDate = new Date(f.follow_ups.ultimaTentativa);
  return ultimaTentativaDate >= hoje && ultimaTentativaDate < new Date(fimHoje);
});

console.log("Follow-ups concluídos hoje:", concluidos.length);

// Mostrar alguns exemplos
console.log("\nExemplos de follow-ups:");
ativos.slice(0, 3).forEach(f => {
  console.log({
    leadNome: f.leads?.nome,
    tentativaAtual: f.follow_ups.tentativaAtual,
    maxTentativas: f.follow_ups.maxTentativas,
    proximaTentativa: f.follow_ups.proximaTentativa,
    ultimaTentativa: f.follow_ups.ultimaTentativa,
  });
});
