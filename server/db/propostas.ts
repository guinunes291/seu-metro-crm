/**
 * server/db/propostas.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Propostas digitais.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export {
  createProposta,
  getPropostaById,
  getPropostaByToken,
  getPropostasCorretor,
  getPropostasLead,
  updateProposta,
  registrarVisualizacaoProposta,
  registrarAceiteProposta,
  getAllPropostas,
  deleteProposta,
} from "../db";
