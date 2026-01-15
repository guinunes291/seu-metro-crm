import { getFollowUpsDoDiaExpandido } from './server/db.ts';

const corretorId = 5055943;

console.log('=== TESTANDO getFollowUpsDoDiaExpandido ===');
console.log('Corretor ID:', corretorId);

try {
  const result = await getFollowUpsDoDiaExpandido(corretorId);
  console.log('\n=== RESULTADO ===');
  console.log('Total:', result.length);
  if (result.length > 0) {
    console.table(result);
  } else {
    console.log('Nenhum follow-up encontrado!');
  }
} catch (error) {
  console.error('ERRO:', error.message);
  console.error(error.stack);
}

process.exit(0);
