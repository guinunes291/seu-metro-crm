/**
 * Job de limpeza de follow-ups órfãos
 * 
 * Cancela follow-ups pendentes de leads que não estão mais com status "em_atendimento"
 * Executa periodicamente para manter a consistência do sistema
 */

import { limparFollowUpsOrfaos } from "./db";

/**
 * Executa a limpeza de follow-ups órfãos
 */
export async function executarLimpezaFollowUps() {
  try {
    console.log("[Limpeza Follow-ups Job] Iniciando limpeza de follow-ups órfãos...");
    
    const resultado = await limparFollowUpsOrfaos();
    
    if (resultado.cancelados > 0) {
      console.log(
        `[Limpeza Follow-ups Job] Limpeza concluída: ${resultado.cancelados} follow-ups cancelados de ${resultado.total} pendentes`
      );
    } else {
      console.log(
        `[Limpeza Follow-ups Job] Nenhum follow-up órfão encontrado (${resultado.total} pendentes verificados)`
      );
    }
    
    return {
      success: true,
      total: resultado.total,
      cancelados: resultado.cancelados,
    };
  } catch (error) {
    console.error("[Limpeza Follow-ups Job] Erro na limpeza:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Agenda o job de limpeza para executar periodicamente
 */
export function agendarLimpezaFollowUps() {
  // Executar imediatamente na inicialização (após 2 minutos)
  setTimeout(() => {
    console.log("[Limpeza Follow-ups Job] Executando primeira limpeza...");
    executarLimpezaFollowUps().catch(console.error);
  }, 120000); // 2 minutos

  // Executar a cada 1 hora (3600000 ms)
  setInterval(() => {
    console.log("[Limpeza Follow-ups Job] Executando limpeza periódica...");
    executarLimpezaFollowUps().catch(console.error);
  }, 3600000); // 1 hora

  console.log("[Limpeza Follow-ups Job] Job de limpeza agendado para executar a cada 1 hora");
}
