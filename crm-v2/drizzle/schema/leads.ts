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

export const leads = mysqlTable(
  "leads",
  {
    id: int("id").autoincrement().primaryKey(),
    nome: varchar("nome", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }),
    telefone: varchar("telefone", { length: 20 }).notNull(),
    cpf: varchar("cpf", { length: 14 }),
    origem: mysqlEnum("origem", [
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
    ])
      .default("outro")
      .notNull(),
    idExterno: varchar("id_externo", { length: 100 }),
    projetoId: int("projeto_id"),
    projetoCustom: varchar("projeto_custom", { length: 255 }),
    corretorId: int("corretor_id"),
    dataDistribuicao: timestamp("data_distribuicao"),
    timestampRecebimento: timestamp("timestamp_recebimento"),
    timerAtivo: boolean("timer_ativo").default(false).notNull(),
    timerExpiraEm: timestamp("timer_expira_em"),
    tentativasRedistribuicao: int("tentativas_redistribuicao").default(0).notNull(),
    corretoresTentaram: text("corretores_tentaram"),
    tipoFilaOrigem: mysqlEnum("tipo_fila_origem", ["geral", "foco"]).default("geral").notNull(),
    status: mysqlEnum("status", [
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
    ])
      .default("novo")
      .notNull(),
    temperatura: mysqlEnum("temperatura", ["quente", "morno", "frio"]),
    proximoFollowup: timestamp("proximo_followup"),
    diasFollowupConsecutivos: int("dias_followup_consecutivos").default(0).notNull(),
    ultimoContato: timestamp("ultimo_contato"),
    ultimaInteracao: timestamp("ultima_interacao"),
    proximaTarefaData: timestamp("proxima_tarefa_data"),
    faixaRenda: varchar("faixa_renda", { length: 100 }),
    finalidadeImovel: varchar("finalidade_imovel", { length: 50 }),
    prefereContatoPor: varchar("prefere_contato_por", { length: 50 }),
    campanha: varchar("campanha", { length: 255 }),
    utmSource: varchar("utm_source", { length: 255 }),
    utmMedium: varchar("utm_medium", { length: 255 }),
    utmCampaign: varchar("utm_campaign", { length: 255 }),
    observacoes: text("observacoes"),
    motivoPerdido: text("motivo_perdido"),
    motivoPerdaCategoria: varchar("motivo_perda_categoria", { length: 50 }),
    naLixeira: boolean("na_lixeira").default(false).notNull(),
    dataMovidoLixeira: timestamp("data_movido_lixeira"),
    corretorAnteriorId: int("corretor_anterior_id"),
    origemWebhook: boolean("origem_webhook").default(false).notNull(),
    transferidoManualmentePorAdmin: boolean("transferido_manualmente_por_admin")
      .default(false)
      .notNull(),
    primeiroContatoEm: timestamp("primeiro_contato_em"),
    tempoAtePrimeiroContato: int("tempo_ate_primeiro_contato"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    idxTelefone: index("leads_telefone_idx").on(t.telefone),
    idxCorretor: index("leads_corretor_idx").on(t.corretorId),
    idxStatus: index("leads_status_idx").on(t.status),
    idxProjeto: index("leads_projeto_idx").on(t.projetoId),
    idxLixeira: index("leads_lixeira_idx").on(t.naLixeira),
    idxProximoFollowup: index("leads_proximo_followup_idx").on(t.proximoFollowup),
    idxCorretorStatus: index("leads_corretor_status_idx").on(t.corretorId, t.status),
    idxCreatedAt: index("leads_created_at_idx").on(t.createdAt),
  })
);

export const leadHistory = mysqlTable(
  "lead_history",
  {
    id: int("id").autoincrement().primaryKey(),
    leadId: int("lead_id").notNull(),
    corretorId: int("corretor_id"),
    tipo: mysqlEnum("tipo", [
      "ligacao",
      "whatsapp",
      "email",
      "sms",
      "visita",
      "nota",
      "distribuicao",
      "status",
      "outro",
    ])
      .default("nota")
      .notNull(),
    resultado: text("resultado"),
    duracaoSegundos: int("duracao_segundos"),
    atendida: boolean("atendida"),
    respondida: boolean("respondida"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    idxLead: index("lead_history_lead_idx").on(t.leadId),
    idxCorretor: index("lead_history_corretor_idx").on(t.corretorId),
  })
);

export const leadStatusTransitions = mysqlTable(
  "lead_status_transitions",
  {
    id: int("id").autoincrement().primaryKey(),
    leadId: int("lead_id").notNull(),
    corretorId: int("corretor_id"),
    statusAnterior: varchar("status_anterior", { length: 50 }).notNull(),
    statusNovo: varchar("status_novo", { length: 50 }).notNull(),
    observacao: text("observacao"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    idxLead: index("transitions_lead_idx").on(t.leadId),
  })
);

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;
export type LeadHistory = typeof leadHistory.$inferSelect;
