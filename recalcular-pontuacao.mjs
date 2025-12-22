import { recalcularPontuacaoTodosCorretores } from './server/db.ts';

async function main() {
  console.log('Recalculando pontuação de todos os corretores...');
  const total = await recalcularPontuacaoTodosCorretores();
  console.log(`Pontuação recalculada para ${total} corretores`);
  process.exit(0);
}

main().catch(console.error);
