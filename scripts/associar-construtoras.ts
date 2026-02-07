/**
 * Script para associar projetos existentes às construtoras cadastradas
 * Faz match pelo nome da construtora (campo construtora em projects)
 */

import { getDb } from '../server/db';
import { projects, construtoras } from '../drizzle/schema';
import { eq, sql } from 'drizzle-orm';

async function associarConstrutoras() {
  console.log('🔄 Iniciando associação de projetos às construtoras...\n');

  const db = await getDb();
  if (!db) {
    console.error('❌ Erro ao conectar ao banco de dados');
    return;
  }

  // Buscar todas as construtoras
  const todasConstrutoras = await db.select().from(construtoras);
  console.log(`📋 ${todasConstrutoras.length} construtoras encontradas\n`);

  let totalAtualizados = 0;
  let totalErros = 0;

  for (const construtora of todasConstrutoras) {
    try {
      // Atualizar projetos que têm o nome da construtora no campo construtora
      const result = await db
        .update(projects)
        .set({ construtoraId: construtora.id })
        .where(eq(projects.construtora, construtora.nome));

      const count = result[0].affectedRows || 0;
      
      if (count > 0) {
        console.log(`✅ ${construtora.nome}: ${count} projetos associados`);
        totalAtualizados += count;
      }
    } catch (error) {
      console.error(`❌ Erro ao associar ${construtora.nome}:`, error);
      totalErros++;
    }
  }

  console.log(`\n📊 Resumo:`);
  console.log(`   ✅ ${totalAtualizados} projetos atualizados`);
  console.log(`   ❌ ${totalErros} erros`);

  // Verificar quantos projetos ainda não têm construtoraId
  const semConstrutora = await db
    .select({ count: sql<number>`count(*)` })
    .from(projects)
    .where(sql`construtoraId IS NULL`);

  console.log(`   ⚠️  ${semConstrutora[0].count} projetos sem construtoraId\n`);
}

associarConstrutoras()
  .then(() => {
    console.log('✨ Associação concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
