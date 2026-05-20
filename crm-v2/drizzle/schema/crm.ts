import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const followUps = mysqlTable(
  "follow_ups",
  {
    id: int("id").autoincrement().primaryKey(),
    leadId: int("lead_id").notNull(),
    corretorId: int("corretor_id").notNull(),
    dataFollowUp: timestamp("data_follow_up").notNull(),
    dataRegistro: timestamp("data_registro"),
    resultado: mysqlEnum("resultado", ["respondeu", "nao_respondeu"]),
    observacao: text("observacao"),
    status: mysqlEnum("status", ["pendente", "concluido", "cancelado"])
      .default("pendente")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    idxLead: index("followups_lead_idx").on(t.leadId),
    idxCorretor: index("followups_corretor_idx").on(t.corretorId),
    idxData: index("followups_data_idx").on(t.dataFollowUp),
    idxStatus: index("followups_status_idx").on(t.status),
  })
);

export const carteiraAtiva = mysqlTable(
  "carteira_ativa",
  {
    id: int("id").autoincrement().primaryKey(),
    leadId: int("lead_id").notNull(),
    corretorId: int("corretor_id").notNull(),
    protecaoAte: timestamp("protecao_ate").notNull(),
    renovacoes: int("renovacoes").default(0).notNull(),
    observacao: text("observacao"),
    ativo: boolean("ativo").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    idxLead: index("carteira_lead_idx").on(t.leadId),
    idxCorretor: index("carteira_corretor_idx").on(t.corretorId),
  })
);

export const tarefas = mysqlTable(
  "tarefas",
  {
    id: int("id").autoincrement().primaryKey(),
    corretorId: int("corretor_id").notNull(),
    leadId: int("lead_id"),
    titulo: varchar("titulo", { length: 255 }).notNull(),
    descricao: text("descricao"),
    tipo: mysqlEnum("tipo", [
      "follow_up",
      "agendamento",
      "ligacao",
      "whatsapp",
      "email",
      "visita",
      "documentacao",
      "outro",
    ])
      .default("outro")
      .notNull(),
    dataAgendada: timestamp("data_agendada").notNull(),
    status: mysqlEnum("status", ["pendente", "concluida", "cancelada"])
      .default("pendente")
      .notNull(),
    prioridade: mysqlEnum("prioridade", ["baixa", "media", "alta", "urgente"])
      .default("media")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    idxCorretor: index("tarefas_corretor_idx").on(t.corretorId),
    idxData: index("tarefas_data_idx").on(t.dataAgendada),
    idxStatus: index("tarefas_status_idx").on(t.status),
  })
);

export const agendamentos = mysqlTable(
  "agendamentos",
  {
    id: int("id").autoincrement().primaryKey(),
    leadId: int("lead_id").notNull(),
    corretorId: int("corretor_id").notNull(),
    projetoId: int("projeto_id"),
    dataAgendamento: timestamp("data_agendamento").notNull(),
    status: mysqlEnum("status", [
      "pendente",
      "confirmado",
      "realizado",
      "cancelado",
      "reagendado",
      "nao_compareceu",
    ])
      .default("pendente")
      .notNull(),
    observacao: text("observacao"),
    linkZapier: varchar("link_zapier", { length: 500 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    idxLead: index("agend_lead_idx").on(t.leadId),
    idxCorretor: index("agend_corretor_idx").on(t.corretorId),
    idxData: index("agend_data_idx").on(t.dataAgendamento),
  })
);

export const visitas = mysqlTable(
  "visitas",
  {
    id: int("id").autoincrement().primaryKey(),
    leadId: int("lead_id").notNull(),
    corretorId: int("corretor_id").notNull(),
    agendamentoId: int("agendamento_id"),
    projetoId: int("projeto_id"),
    dataVisita: timestamp("data_visita").notNull(),
    resultado: mysqlEnum("resultado", [
      "interesse_alto",
      "interesse_medio",
      "interesse_baixo",
      "sem_interesse",
      "pendente_documentacao",
      "encaminhado_analise",
    ]),
    observacao: text("observacao"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    idxLead: index("visitas_lead_idx").on(t.leadId),
    idxCorretor: index("visitas_corretor_idx").on(t.corretorId),
  })
);

export type FollowUp = typeof followUps.$inferSelect;
export type Agendamento = typeof agendamentos.$inferSelect;
export type Visita = typeof visitas.$inferSelect;
