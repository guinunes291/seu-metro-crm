import { distribuirTodosLeadsNaoDistribuidos, distribuirLeadsDoEstoque } from "./distribution";
import { verificarTimerLeads } from "./timerLeadsJob";

/**
 * Job de distribuição automática periódica
 * Executa a cada hora para distribuir leads não distribuídos
 * Baseado no AppScript: processa 20 leads por rodada
 */
export async function executarDistribuicaoAutomatica() {
  console.log("[Job] Iniciando distribuição automática periódica...");
  
  try {
    // 1. Distribuir leads do estoque primeiro
    console.log("[Job] Processando estoque de leads...");
    const estoqueResultado = await distribuirLeadsDoEstoque();
    console.log(`[Job] Estoque: ${estoqueResultado.distribuidos} distribuídos, ${estoqueResultado.erros} erros`);
    
    // 2. Distribuir leads não distribuídos do gestor
    const resultado = await distribuirTodosLeadsNaoDistribuidos();
    
    console.log(`[Job] Distribuição concluída: ${resultado.success} distribuídos, ${resultado.failed} erros`);
    
    return {
      ...resultado,
      estoque: estoqueResultado
    };
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
  
  // Agendar verificação de timer de leads (a cada 1 minuto)
  setInterval(() => {
    verificarTimerLeads().catch(console.error);
  }, 60000);
  
  console.log("[Job] Verificação de timer de leads agendada para executar a cada 1 minuto");
}
