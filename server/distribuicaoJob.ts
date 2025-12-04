import { distribuirTodosLeadsNaoDistribuidos } from "./distribution";

/**
 * Job de distribuição automática periódica
 * Executa a cada 5 minutos para distribuir leads não distribuídos
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
  // Executar imediatamente na inicialização (após 30 segundos)
  setTimeout(() => {
    console.log("[Job] Executando primeira distribuição automática...");
    executarDistribuicaoAutomatica().catch(console.error);
  }, 30000);

  // Executar a cada 5 minutos (300000 ms)
  setInterval(() => {
    console.log("[Job] Executando distribuição automática agendada...");
    executarDistribuicaoAutomatica().catch(console.error);
  }, 300000);

  console.log("[Job] Distribuição automática agendada para executar a cada 5 minutos");
}
