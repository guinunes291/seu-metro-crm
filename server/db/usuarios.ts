/**
 * server/db/usuarios.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Usuários, corretores e gestores.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export {
  upsertUser,
  getUserByOpenId,
  getUserById,
  getAllCorretores,
  getCorretoresPresentes,
  updateUserStatus,
  updateLimiteDiarioLeads,
  updateLimiteDiarioWebhook,
  updateUser,
  countLeadsRecebidosHoje,
  countLeadsWebhookRecebidosHoje,
  createCorretor,
  updateCorretor,
  updateCorretorFoto,
  deleteCorretor,
  redistribuirLeadsDoCorretor,
  countLeadsByCorretor,
  getAllUsers,
  getCorretoresByIds,
  getUsersByIds,
  getAllCorretoresEGestores,
  getCorretoresEGestoresByIds,
  getCorretoresAtivos,
  getCorretoresByEquipe,
} from "../db";
