import { db } from '../server/db.js';
import { tabeloes } from '../drizzle/schema.js';
import { eq } from 'drizzle-orm';

async function resetTabeloes() {
  try {
    // Marcar todos como pendentes para reprocessar
    const result = await db.update(tabeloes)
      .set({ status: 'pendente', mensagemErro: null });

    console.log('✅ Todos os tabelões marcados para reprocessamento');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

resetTabeloes();
