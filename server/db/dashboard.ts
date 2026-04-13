/**
 * server/db/dashboard.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Métricas do dashboard (gestor e corretor), ranking, performance.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export {
  // Dashboard do gestor
  getDashboardMetrics,
  getLeadsPorCorretorDashboard,
  getAgendamentosPorCorretor,
  getVisitasPorCorretor,
  getPastasPorCorretor,
  getVendasPorCorretor,
  // Relatório de produção
  getRelatorioProducaoCorretores,
  // Métricas históricas
  getMetricasHistoricas,
  getEvolucaoFunil,
  // Ranking
  getRankingCorretores,
  getPerformanceCorretor,
  // Dashboard do corretor
  getMetricasDiariasCorretor,
  // Performance semanal
  getPerformanceSemanal,
  // Dashboard de performance global
  getDashboardPerformance,
  getEvolucaoMensalVGV,
  // Atividades diárias e ranking TV
  getTotalFollowUpsDoDia,
  // Tarefas
  getTarefasByCorretor,
  getTarefasDoDia,
  getTarefaById,
  createTarefa,
  updateTarefa,
  deleteTarefa,
  concluirTarefa,
} from "../db";

// Re-exportar tipos/interfaces
export type {
  DashboardFilters,
  RelatorioProducaoCorretor,
  MetricasDiarias,
  PerformanceSemanalCorretor,
  PerformanceSemanalResumo,
} from "../db";
