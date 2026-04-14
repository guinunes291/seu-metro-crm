/**
 * Job periódico para sincronizar agendamentos criados com atividades diárias
 * Roda a cada 5 minutos para garantir que a contagem esteja sempre atualizada
 */

import * as db from "./db";

export async function iniciarJobSincronizacaoAgendamentos() {
  console.log("[AgendamentosSync] Job iniciado - sincronizará agendamentos a cada 5 minutos");
  
  // Executar imediatamente na inicialização
  await sincronizarAgendamentos();
  
  // Depois executar a cada 30 minutos (reduzido de 5min — agendamentos não mudam com alta frequência)
  setInterval(async () => {
    await sincronizarAgendamentos();
  }, 30 * 60 * 1000); // 30 minutos
}

async function sincronizarAgendamentos() {
  try {
    console.log("[AgendamentosSync] Sincronizando agendamentos do dia...");
    await db.sincronizarAgendamentosDoDia();
    console.log("[AgendamentosSync] Sincronização concluída");
  } catch (error) {
    console.error("[AgendamentosSync] Erro ao sincronizar agendamentos:", error);
  }
}
