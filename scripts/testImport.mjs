/**
 * Script de Teste de Importação de Tabelões
 * 
 * Testa a função de importação diretamente
 */

import { importAllTabeloes } from "../server/importadorTabeloes.ts";

console.log("🚀 Iniciando teste de importação de tabelões...\n");

try {
  const result = await importAllTabeloes();
  
  console.log("\n✅ Importação concluída com sucesso!");
  console.log("\n📊 Estatísticas:");
  console.log(`   - Construtoras: ${result.construtoras}`);
  console.log(`   - Tabelões: ${result.tabeloes}`);
  console.log(`   - Pendentes de processamento: ${result.pendentes}`);
  
  if (result.erros.length > 0) {
    console.log(`\n⚠️  Erros encontrados: ${result.erros.length}`);
    console.log("\nPrimeiros 5 erros:");
    result.erros.slice(0, 5).forEach((erro, i) => {
      console.log(`   ${i + 1}. ${erro}`);
    });
  }
  
  console.log("\n✅ Teste concluído!");
  process.exit(0);
} catch (error) {
  console.error("\n❌ Erro no teste:", error);
  process.exit(1);
}
