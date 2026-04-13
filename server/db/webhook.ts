/**
 * server/db/webhook.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuração de webhooks e fila de distribuição (roleta).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export {
  createWebhookConfig,
  getWebhookConfigs,
  getWebhookConfigByToken,
  incrementarLeadsWebhook,
  toggleWebhookConfig,
  deleteWebhookConfig,
  updateWebhookFormIdMapping,
  processarLeadWebhook,
  processarLeadWebhookFoco,
} from "../db";
