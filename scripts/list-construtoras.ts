import { db } from '../server/db';
import { construtoras } from '../drizzle/schema';
import { asc } from 'drizzle-orm';

async function listConstrutoras() {
  const lista = await db.select({
    id: construtoras.id,
    nome: construtoras.nome,
    logoUrl: construtoras.logoUrl
  })
  .from(construtoras)
  .orderBy(asc(construtoras.nome));

  console.log('\n=== CONSTRUTORAS CADASTRADAS ===\n');
  lista.forEach((c, idx) => {
    console.log(`${idx + 1}. ${c.nome} ${c.logoUrl ? '✓' : '✗'}`);
  });
  console.log(`\nTotal: ${lista.length} construtoras\n`);
}

listConstrutoras().then(() => process.exit(0)).catch(console.error);
