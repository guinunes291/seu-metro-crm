import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const filaDistribuicao = mysqlTable("fila_distribuicao", {
  id: int("id").autoincrement().primaryKey(),
  corretorId: int("corretor_id").notNull().unique(),
  posicao: int("posicao").default(0).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  maxLeadsDia: int("max_leads_dia").default(30).notNull(),
  leadsRecebidosHoje: int("leads_recebidos_hoje").default(0).notNull(),
  ultimaDistribuicao: timestamp("ultima_distribuicao"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const distributionLog = mysqlTable(
  "distribution_log",
  {
    id: int("id").autoincrement().primaryKey(),
    leadId: int("lead_id").notNull(),
    corretorId: int("corretor_id").notNull(),
    tipo: mysqlEnum("tipo", ["automatica", "manual", "redistribuicao", "timeout", "foco"])
      .default("automatica")
      .notNull(),
    motivo: varchar("motivo", { length: 255 }),
    distribuidoPorId: int("distribuido_por_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    idxLead: index("distlog_lead_idx").on(t.leadId),
    idxCorretor: index("distlog_corretor_idx").on(t.corretorId),
    idxCreated: index("distlog_created_idx").on(t.createdAt),
  })
);

export const leadEstoque = mysqlTable("lead_estoque", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("lead_id").notNull().unique(),
  tipoFila: mysqlEnum("tipo_fila", ["geral", "foco"]).default("geral").notNull(),
  motivo: varchar("motivo", { length: 255 }),
  tentativas: int("tentativas").default(0).notNull(),
  status: mysqlEnum("status", ["aguardando", "distribuido", "cancelado"])
    .default("aguardando")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const configuracaoProjetoFoco = mysqlTable("configuracao_projeto_foco", {
  id: int("id").autoincrement().primaryKey(),
  projetoId: int("projeto_id").notNull(),
  corretoresIds: json("corretores_ids").$type<number[]>().default([]).notNull(),
  posicaoAtual: int("posicao_atual").default(0).notNull(),
  webhookNotificacaoCorretor: varchar("webhook_notificacao_corretor", { length: 500 }),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const webhookConfig = mysqlTable("webhook_config", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 64 }).unique().notNull(),
  nome: varchar("nome", { length: 100 }).notNull(),
  fonte: mysqlEnum("fonte", ["facebook", "instagram", "rdstation", "outro"])
    .default("facebook")
    .notNull(),
  tipoFila: mysqlEnum("tipo_fila", ["geral", "foco"]).default("geral").notNull(),
  projectIdPadrao: int("project_id_padrao"),
  formIdMapping: json("form_id_mapping").$type<Record<string, number>>().default({}).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  leadsRecebidos: int("leads_recebidos").default(0).notNull(),
  ultimoLeadRecebido: timestamp("ultimo_lead_recebido"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FilaDistribuicao = typeof filaDistribuicao.$inferSelect;
export type WebhookConfig = typeof webhookConfig.$inferSelect;
