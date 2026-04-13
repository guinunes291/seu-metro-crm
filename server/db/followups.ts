/**
 * server/db/followups.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Follow-ups automáticos, atividades diárias e ranking TV.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export {
  // Follow-ups
  createFollowUp,
  getFollowUpByLead,
  getFollowUpsPendentes,
  getFollowUpsDoDia,
  getFollowUpsDoDiaExpandido,
  registrarTentativaFollowUp,
  criarFollowUpParaLead,
  criarFollowUpsAutomaticos,
  cancelarFollowUpsPendentes,
  cancelarFollowUpsPorTransferencia,
  limparFollowUpsOrfaos,
  criarOuAtualizarFollowUp,
  // Atividades diárias
  getOrCreateAtividadeDiaria,
  incrementarAtividade,
  registrarAtividadePorStatus,
  // Ranking TV
  getRankingDia,
  getRankingPorPeriodo,
  getRankingSemanal,
  getRankingMensal,
  // Métricas funil
  getTransicoesCorretor,
  getMetricasFunilCorretor,
  getMetricasFunilTodosCorretores,
  getMetricasFunilGeral,
  getHistoricoTransicoesLead,
  getMetricasFunilLeadsUnicos,
  // Relatório de leads criados
  getRelatorioLeadsCriados,
  getRelatorioLeadsTimerPorCorretor,
} from "../db";
