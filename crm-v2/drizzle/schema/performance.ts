import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
  date,
} from "drizzle-orm/mysql-core";

export const atividadesDiarias = mysqlTable(
  "atividades_diarias",
  {
    id: int("id").autoincrement().primaryKey(),
    corretorId: int("corretor_id").notNull(),
    data: date("data").notNull(),
    ligacoesRealizadas: int("ligacoes_realizadas").default(0).notNull(),
    ligacoesAtendidas: int("ligacoes_atendidas").default(0).notNull(),
    whatsappEnviados: int("whatsapp_enviados").default(0).notNull(),
    whatsappRespondidos: int("whatsapp_respondidos").default(0).notNull(),
    agendamentosConfirmados: int("agendamentos_confirmados").default(0).notNull(),
    visitasRealizadas: int("visitas_realizadas").default(0).notNull(),
    analiseCreditoEnviadas: int("analise_credito_enviadas").default(0).notNull(),
    contratosFechados: int("contratos_fechados").default(0).notNull(),
    vgvDia: int("vgv_dia").default(0).notNull(),
    pontuacaoTotal: int("pontuacao_total").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    idxCorretorData: index("atividades_corretor_data_idx").on(t.corretorId, t.data),
    uniqCorretorData: index("atividades_unique_idx").on(t.corretorId, t.data),
  })
);

export const metas = mysqlTable(
  "metas",
  {
    id: int("id").autoincrement().primaryKey(),
    corretorId: int("corretor_id").notNull(),
    mes: int("mes").notNull(),
    ano: int("ano").notNull(),
    metaLeads: int("meta_leads").default(0).notNull(),
    metaAgendamentos: int("meta_agendamentos").default(0).notNull(),
    metaVisitas: int("meta_visitas").default(0).notNull(),
    metaContratos: int("meta_contratos").default(0).notNull(),
    metaVgv: int("meta_vgv").default(0).notNull(),
    observacao: varchar("observacao", { length: 500 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    idxCorretorMesAno: index("metas_corretor_mes_ano_idx").on(t.corretorId, t.mes, t.ano),
  })
);

export const metasDiarias = mysqlTable("metas_diarias", {
  id: int("id").autoincrement().primaryKey(),
  corretorId: int("corretor_id").notNull().unique(),
  metaLigacoes: int("meta_ligacoes").default(20).notNull(),
  metaWhatsapp: int("meta_whatsapp").default(30).notNull(),
  metaAgendamentos: int("meta_agendamentos").default(3).notNull(),
  metaVisitas: int("meta_visitas").default(2).notNull(),
  metaDocumentacoes: int("meta_documentacoes").default(1).notNull(),
  metaVendas: int("meta_vendas").default(1).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const conquistas = mysqlTable(
  "conquistas",
  {
    id: int("id").autoincrement().primaryKey(),
    corretorId: int("corretor_id").notNull(),
    tipo: varchar("tipo", { length: 50 }).notNull(),
    nome: varchar("nome", { length: 100 }).notNull(),
    icone: varchar("icone", { length: 50 }).notNull(),
    pontos: int("pontos").default(0).notNull(),
    periodoInicio: timestamp("periodo_inicio"),
    periodoFim: timestamp("periodo_fim"),
    valor: int("valor"),
    posicao: int("posicao"),
    notificado: boolean("notificado").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    idxCorretor: index("conquistas_corretor_idx").on(t.corretorId),
  })
);

export type AtividadeDiaria = typeof atividadesDiarias.$inferSelect;
export type Meta = typeof metas.$inferSelect;
