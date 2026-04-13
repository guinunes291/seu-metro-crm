/**
 * server/db/analytics.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Relatórios, analytics e métricas avançadas de funil de vendas.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export {
  // Funil de conversão
  getFunilConversaoGeral,
  getTaxaConversaoPorCorretor,
  getTempoMedioPorEtapa,
  // Evolução e distribuição
  getEvolucaoVendas,
  getDistribuicaoVendasPorProjeto,
  // Origens e horários
  getOrigemLeadsMaisEfetiva,
  getLeadsPorHorarioEntrada,
  // Rankings e produtividade
  getRankingCorretoresCompleto,
  getProdutividadePorCorretor,
  getComparativoMensalCorretores,
  // Carga e previsão
  getCargaTrabalho,
  getPrevisaoVendas,
} from "../db";
