import { recalcularPontuacaoTodosCorretores } from './server/db.ts';

async function main() {
  console.log('Recalculando pontuação de TODAS as atividades...');
  const total = await recalcularPontuacaoTodosCorretores();
  console.log(`Pontuação recalculada para ${total} atividades`);
  process.exit(0);
}

main().catch(console.error);
