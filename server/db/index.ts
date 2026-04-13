/**
 * server/db/index.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Ponto de entrada organizado por domínio para todas as funções do banco.
 * 
 * Em vez de importar diretamente de "../db", importe daqui por domínio:
 *   import { createLead, getLeadById } from "../db/leads"
 *   import { criarNovoContrato }        from "../db/contratos"
 *   import { getFollowUpsPendentes }    from "../db/followups"
 * 
 * O arquivo server/db.ts original continua funcionando para compatibilidade
 * com todos os arquivos existentes. Esta pasta é a nova forma de importar.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Conexão compartilhada
export { getDb } from "./connection";

// ── Domínios ──────────────────────────────────────────────────────────────────
export * from "./usuarios";
export * from "./projetos";
export * from "./leads";
export * from "./notificacoes";
export * from "./dashboard";
export * from "./metas";
export * from "./followups";
export * from "./agendamentos";
export * from "./contratos";
export * from "./comissoes";
export * from "./analytics";
export * from "./webhook";
export * from "./chatbot";
export * from "./propostas";
export * from "./metricas_sync";
