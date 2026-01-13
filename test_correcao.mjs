import { getDb } from "./server/db.ts";
import { users } from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";
import { getTotalFollowUpsDoDia } from "./server/db.ts";
import { inicioDoDiaHoje } from "./server/timezone.ts";

const db = await getDb();

// Buscar Hellen
const hellen = await db.select().from(users).where(eq(users.email, "hellen.alves@seumq.com.br")).limit(1);
if (hellen.length === 0) {
  console.log("Hellen não encontrada");
  process.exit(0);
}

console.log("Hellen ID:", hellen[0].id);

// Buscar follow-ups usando a função corrigida
const hoje = inicioDoDiaHoje();
const amanha = new Date(hoje);
amanha.setDate(amanha.getDate() + 1);

const followUps = await getTotalFollowUpsDoDia(hellen[0].id, hoje, amanha);

console.log("\nTotal de follow-ups retornados:", followUps.length);

// Filtrar ativos
const ativos = followUps.filter(f => f.tentativaAtual < f.maxTentativas);
console.log("Follow-ups ativos (tentativaAtual < maxTentativas):", ativos.length);

// Concluídos hoje
const concluidos = followUps.filter(f => {
  if (!f.ultimaTentativa) return false;
  const ultimaTentativaDate = new Date(f.ultimaTentativa);
  return ultimaTentativaDate >= hoje && ultimaTentativaDate < amanha;
});

console.log("Follow-ups concluídos hoje:", concluidos.length);

const percentual = ativos.length > 0 ? Math.round((concluidos.length / ativos.length) * 100) : 100;
const desbloqueado = ativos.length === 0 ? true : percentual >= 60;

console.log("\nResultado:");
console.log(`- Total: ${ativos.length}`);
console.log(`- Concluídos: ${concluidos.length}`);
console.log(`- Percentual: ${percentual}%`);
console.log(`- Desbloqueado: ${desbloqueado ? 'SIM' : 'NÃO'}`);
