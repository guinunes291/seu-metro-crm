import { recalcularPontuacaoTodosCorretores } from '../server/db.ts';

console.log('Iniciando recálculo de pontuação para todos os corretores...');

const total = await recalcularPontuacaoTodosCorretores();

console.log(`✅ Recalculadas ${total} atividades com sucesso!`);
process.exit(0);
