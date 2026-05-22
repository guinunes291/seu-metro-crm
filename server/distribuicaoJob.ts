import { distribuirTodosLeadsNaoDistribuidos, distribuirLeadsDoEstoque } from "./distribution";
import { verificarTimerLeads } from "./timerLeadsJob";
import { agendarPriorizacaoDiaria } from "./agentePriorizacaoJob";

// Flag para evitar execuções concorrentes dos jobs
let distribuicaoEmExecucao = false;
let timerEmExecucao = false;

/**
 * Job de distribuição automática periódica
 * Executa a cada 5 minutos para distribuir leads não distribuídos
 */
export async function executarDistribuicaoAutomatica() {
  if (distribuicaoEmExecucao) {
    console.log("[Job] Distribuição já em execução, pulando...");
    return { success: 0, failed: 0, details: [], skipped: true };
  }
  distribuicaoEmExecucao = true;
  console.log("[Job] Iniciando distribuição automática periódica...");
  
  try {
    // Distribuir leads da carteira do admin (estoque) para corretores elegíveis
    // A função busca leads com corretorId = admin e distribui 30 por corretor elegível
    const resultado = await distribuirTodosLeadsNaoDistribuidos();
    
    console.log(`[Job] Distribuição concluída: ${resultado.success} distribuídos, ${resultado.failed} erros`);
    
    return {
      ...resultado,
      estoque: { distribuidos: resultado.success, erros: resultado.failed, mensagens: [] }
    };
  } catch (error) {
    console.error("[Job] Erro na distribuição automática:", error);
    return {
      success: 0,
      failed: 0,
      details: [],
      error: error instanceof Error ? error.message : "Erro desconhecido"
    };
  } finally {
    distribuicaoEmExecucao = false;
  }
}

/**
 * Wrapper do timer com proteção contra execuções concorrentes
 */
async function executarTimerLeads() {
  if (timerEmExecucao) return;
  timerEmExecucao = true;
  try {
    await verificarTimerLeads();
  } finally {
    timerEmExecucao = false;
  }
}

/**
 * Agenda os jobs periódicos
 */
export function agendarDistribuicaoAutomatica() {
  
  // Distribuição: primeira execução após 60 segundos (servidor precisa estar estável)
  setTimeout(() => {
    console.log("[Job] Executando primeira distribuição automática...");
    executarDistribuicaoAutomatica().catch(console.error);
  }, 60000);

  // Distribuição: a cada 10 minutos (reduzido de 5min para economizar recursos)
  setInterval(() => {
    console.log("[Job] Executando distribuição automática agendada...");
    executarDistribuicaoAutomatica().catch(console.error);
  }, 10 * 60 * 1000);

  console.log("[Job] Distribuição automática agendada para executar a cada 10 minutos");
  
  // Timer de leads: primeira execução após 90 segundos
  setTimeout(() => {
    console.log("[Job] Executando primeira verificação de timer de leads...");
    executarTimerLeads().catch(console.error);
  }, 90000);

  // Timer de leads: a cada 3 minutos — garante redistribuição em ≤ 3 min após vencimento do timer (reduzido de 1min — economia de Cloud)
  setInterval(() => {
    executarTimerLeads().catch(console.error);
  }, 3 * 60 * 1000);

  console.log("[Job] Verificação de timer de leads agendada para executar a cada 3 minutos");

  // Agente de Priorização Diária: executa às 7h SP
  agendarPriorizacaoDiaria();
}
