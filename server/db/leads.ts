/**
 * server/db/leads.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Leads — CRUD, busca, distribuição, histórico, log de distribuição.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export {
  // CRUD básico
  checkLeadDuplicado,
  createLead,
  getAllLeads,
  getLeadsByCorretor,
  getNewWebhookLeadsSince,
  getLeadById,
  updateLead,
  deleteLead,
  // Transições de status
  registrarTransicaoStatus,
  // Distribuição
  getLeadsNaoDistribuidos,
  getLeadsPendentesFollowup,
  distribuirLeadsSemCorretor,
  distribuirLeadPelaRoleta,
  getProximoCorretorFila,
  moverCorretorParaFinalFila,
  // Fila de distribuição
  inicializarFilaDistribuicao,
  getFilaDistribuicao,
  atualizarPosicaoFila,
  toggleCorretorFila,
  atualizarMaxLeadsDia,
  resetarContadorLeadsDiarios,
  // Histórico
  createLeadHistory,
  atualizarContadorFollowUp,
  getLeadHistory,
  // Log de distribuição
  createDistributionLog,
  getDistributionHistory,
  getHistoricoDistribuicoes,
  getLogTransferencias,
  countLogTransferencias,
  // Estatísticas
  getConversionStats,
  updateConversionStats,
  // Filtros para gestor
  getLeadsPorCorretorComFiltros,
  getEstatisticasPorCorretor,
  // Busca por identificador
  searchLeadByTelefone,
  searchLeadByEmail,
  searchLeadByCpf,
  searchLeadByIdentifier,
  // Sync Google Sheets
  getAllLeadsForSync,
  // Interações com leads
  getLeadsComInteracaoHoje,
} from "../db";

// Re-exportar tipos/interfaces
export type { FiltrosLeadsPorCorretor } from "../db";
