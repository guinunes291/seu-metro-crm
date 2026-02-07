/**
 * Script de Processamento de Todos os Tabelões
 * 
 * Processa todos os tabelões pendentes usando o pipeline LLM
 */

import { processAllPendingCatalogs } from "../server/pdfProcessor.ts";

console.log("🚀 Iniciando processamento de todos os tabelões pendentes...\n");
console.log("⏱️  Este processo pode levar de 30 a 60 minutos.\n");

try {
  const result = await processAllPendingCatalogs();
  
  console.log("\n✅ Processamento concluído!");
  console.log("\n📊 Resultados:");
  console.log(`   - Tabelões processados: ${result.processados}`);
  console.log(`   - Projetos extraídos: ${result.projetosExtraidos}`);
  console.log(`   - Erros: ${result.erros}`);
  
  if (result.detalhes && result.detalhes.length > 0) {
    console.log("\n📝 Detalhes:");
    result.detalhes.forEach((detalhe, i) => {
      console.log(`   ${i + 1}. ${detalhe}`);
    });
  }
  
  console.log("\n✅ Script concluído!");
  process.exit(0);
} catch (error) {
  console.error("\n❌ Erro no processamento:", error);
  process.exit(1);
}
