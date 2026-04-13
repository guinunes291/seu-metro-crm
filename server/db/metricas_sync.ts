/**
 * server/db/metricas_sync.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Sincronização de métricas diárias com atividades (chamado por jobs).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export {
  sincronizarAgendamentosDoDia,
  sincronizarInteracoesDoDia,
  sincronizarVisitasDoDia,
  sincronizarDocumentacoesDoDia,
  sincronizarAnalisesCreditoDoDia,
  sincronizarContratosDoDia,
  sincronizarTodasMetricasDoDia,
} from "../db";
