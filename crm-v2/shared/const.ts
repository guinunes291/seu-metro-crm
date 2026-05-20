export const COOKIE_NAME = "crm_session";
export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
export const UNAUTHED_ERR_MSG = "UNAUTHORIZED";

export const USER_ROLES = ["admin", "superintendente", "gestor", "corretor"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const LEAD_STATUSES = [
  "novo",
  "aguardando_atendimento",
  "em_atendimento",
  "qualificado",
  "agendado",
  "visita_realizada",
  "proposta_enviada",
  "analise_credito",
  "contrato_fechado",
  "pos_venda",
  "perdido",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_ORIGENS = [
  "facebook",
  "google_sheets",
  "site",
  "indicacao",
  "captacao_corretor",
  "whatsapp",
  "telefone",
  "plantao",
  "agendamento_self_service",
  "chatbot",
  "outro",
] as const;
export type LeadOrigem = (typeof LEAD_ORIGENS)[number];

export const TEMPERATURAS = ["quente", "morno", "frio"] as const;
export type Temperatura = (typeof TEMPERATURAS)[number];

export const TIMER_MINUTOS = 5;
export const LEADS_POR_RODADA = 30;
export const PERCENTUAL_MIN_TRABALHADOS = 0.9;
export const PROTECAO_CARTEIRA_DIAS = 15;
export const RENOVACAO_CARTEIRA_DIAS = 3;
