import { distribuirTodosLeadsNaoDistribuidos } from "./distribution";

/**
 * Job de distribuição automática periódica
 * Executa a cada hora para distribuir leads não distribuídos
 * Baseado no AppScript: processa 20 leads por rodada
 */
export async function executarDistribuicaoAutomatica() {
  console.log("[Job] Iniciando distribuição automática periódica...");
  
  try {
    const resultado = await distribuirTodosLeadsNaoDistribuidos();
    
    console.log(`[Job] Distribuição concluída: ${resultado.success} distribuídos, ${resultado.failed} erros`);
    
    return resultado;
  } catch (error) {
    console.error("[Job] Erro na distribuição automática:", error);
    return {
      success: 0,
      failed: 0,
      details: [],
      error: error instanceof Error ? error.message : "Erro desconhecido"
    };
  }
}

/**
 * Agenda o job para executar a cada hora
 */
export function agendarDistribuicaoAutomatica() {
  // DESABILITADO TEMPORARIAMENTE PARA INVESTIGAÇÃO
  console.log("[Job] Distribuição automática DESABILITADA temporariamente");
  
  // Descomentar para reativar:
  // setTimeout(() => {
  //   console.log("[Job] Executando primeira distribuição automática...");
  //   executarDistribuicaoAutomatica().catch(console.error);
  // }, 30000);
  //
  // setInterval(() => {
  //   console.log("[Job] Executando distribuição automática agendada...");
  //   executarDistribuicaoAutomatica().catch(console.error);
  // }, 300000);
}
