/**
 * server/db/contratos.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Contratos, distratos e funções auxiliares de inserção.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export {
  // Contratos
  getContratosFechados,
  getVGVPorEquipeProjeto,
  atualizarContrato,
  getContratoParaEdicao,
  getOpcoesContrato,
  criarNovoContrato,
  createContrato,
  // Distratos
  registrarDistrato,
  desfazerDistrato,
  getDistratos,
  getMetricasDistratos,
} from "../db";
