/**
 * Script para executar sincronização histórica diretamente
 * Usa importação ES modules (.mjs) para executar via node
 */

import { executarSincronizacaoHistorica } from './server/syncHistorico.ts';

console.log('🚀 Iniciando sincronização histórica completa...\n');

try {
  const resultado = await executarSincronizacaoHistorica();
  
  console.log('\n✅ Sincronização histórica concluída com sucesso!');
  console.log(`📊 Datas processadas: ${resultado.datasProcessadas}`);
  console.log(`📅 Período: ${resultado.periodoInicio} até ${resultado.periodoFim}`);
  
  process.exit(0);
} catch (error) {
  console.error('\n❌ Erro ao executar sincronização histórica:');
  console.error(error.message);
  console.error(error.stack);
  process.exit(1);
}
