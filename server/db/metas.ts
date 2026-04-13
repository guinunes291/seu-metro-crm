/**
 * server/db/metas.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Metas por corretor, metas diárias, metas globais e alertas de produtividade.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export {
  // Metas por corretor
  createMeta,
  updateMeta,
  deleteMeta,
  getMetaByCorretorMesAno,
  getMetasDoMes,
  getMetasDoCorretor,
  getProgressoMeta,
  getProgressoMetasTodosCorretores,
  // Metas diárias
  getMetasDiarias,
  getMetaDiariaCorretor,
  createMetaDiaria,
  // Metas globais
  getMetaGlobal,
  updateMetaGlobal,
  // Alertas de produtividade
  getAlertasProdutividade,
  getAlertasNaoLidos,
  createAlertaProdutividade,
  marcarAlertaComoLido,
  marcarTodosAlertasComoLidos,
  verificarProdutividadeEGerarAlertas,
  // Conquistas e gamificação
  getTiposConquista,
  getConquistasCorretor,
  concederConquista,
  verificarConquistas,
  verificarConquistasRanking,
  getResumoConquistas,
  // Pontuação
  getConfiguracaoPontuacao,
  upsertConfiguracaoPontuacao,
  calcularPontuacaoDiaria,
  recalcularPontuacaoTodosCorretores,
} from "../db";
