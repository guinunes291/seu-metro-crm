import { getDb } from "./server/db.ts";
import { users } from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";
import { inicioDoDiaHoje } from "./server/timezone.ts";

const db = await getDb();

// Buscar Hellen
const hellen = await db.select().from(users).where(eq(users.email, "hellen.alves@seumq.com.br")).limit(1);
if (hellen.length === 0) {
  console.log("Hellen não encontrada");
  process.exit(0);
}

const hoje = inicioDoDiaHoje();
const amanha = new Date(hoje);
amanha.setDate(amanha.getDate() + 1);

console.log("Hellen:", hellen[0].nome);
console.log("ultimoDesbloqueio:", hellen[0].ultimoDesbloqueio);
console.log("\nComparação de datas:");
console.log("hoje (início):", hoje.toISOString());
console.log("amanha (início):", amanha.toISOString());

if (hellen[0].ultimoDesbloqueio) {
  const ultimoDesbloqueioDate = new Date(hellen[0].ultimoDesbloqueio);
  console.log("ultimoDesbloqueio:", ultimoDesbloqueioDate.toISOString());
  
  const jaDesbloqueouHoje = ultimoDesbloqueioDate >= hoje && ultimoDesbloqueioDate < amanha;
  console.log("\njaDesbloqueouHoje:", jaDesbloqueouHoje);
  console.log("- ultimoDesbloqueio >= hoje:", ultimoDesbloqueioDate >= hoje);
  console.log("- ultimoDesbloqueio < amanha:", ultimoDesbloqueioDate < amanha);
} else {
  console.log("\nNunca desbloqueou (campo NULL)");
}
