/**
 * server/db/notificacoes.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Notificações e mensagens prontas (quick messages).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export {
  createNotification,
  getNotificationsForUser,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  notifyLeadDistribuido,
  getQuickMessages,
  createQuickMessage,
} from "../db";
