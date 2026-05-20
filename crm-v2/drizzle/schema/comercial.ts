import {
  boolean,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const contratos = mysqlTable(
  "contratos",
  {
    id: int("id").autoincrement().primaryKey(),
    leadId: int("lead_id").notNull(),
    corretorId: int("corretor_id").notNull(),
    projetoId: int("projeto_id"),
    gestorId: int("gestor_id"),
    superintendenteId: int("superintendente_id"),
    valorVenda: int("valor_venda").default(0).notNull(),
    percentualComissao: decimal("percentual_comissao", { precision: 5, scale: 2 }).default("0").notNull(),
    percentualCorretor: decimal("percentual_corretor", { precision: 5, scale: 2 }).default("0").notNull(),
    percentualGerente: decimal("percentual_gerente", { precision: 5, scale: 2 }).default("0").notNull(),
    percentualSuperintendente: decimal("percentual_superintendente", { precision: 5, scale: 2 }).default("0").notNull(),
    distrato: boolean("distrato").default(false).notNull(),
    dataDistrato: timestamp("data_distrato"),
    motivoDistrato: text("motivo_distrato"),
    dataVenda: timestamp("data_venda").defaultNow().notNull(),
    observacao: text("observacao"),
    anexos: text("anexos"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    idxLead: index("contratos_lead_idx").on(t.leadId),
    idxCorretor: index("contratos_corretor_idx").on(t.corretorId),
    idxData: index("contratos_data_idx").on(t.dataVenda),
  })
);

export const comissoes = mysqlTable(
  "comissoes",
  {
    id: int("id").autoincrement().primaryKey(),
    contratoId: int("contrato_id").notNull(),
    usuarioId: int("usuario_id").notNull(),
    tipo: mysqlEnum("tipo", ["corretor", "gerente", "superintendente", "imobiliaria"])
      .notNull(),
    valorBase: int("valor_base").default(0).notNull(),
    percentual: decimal("percentual", { precision: 5, scale: 2 }).default("0").notNull(),
    valorComissao: int("valor_comissao").default(0).notNull(),
    percentualDesconto: decimal("percentual_desconto", { precision: 5, scale: 2 }),
    valorLiquido: int("valor_liquido").default(0).notNull(),
    status: mysqlEnum("status", ["pendente_assinatura", "a_pagar", "paga", "cancelada"])
      .default("pendente_assinatura")
      .notNull(),
    dataPagamento: timestamp("data_pagamento"),
    comprovante: varchar("comprovante", { length: 500 }),
    observacao: text("observacao"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    idxContrato: index("comissoes_contrato_idx").on(t.contratoId),
    idxUsuario: index("comissoes_usuario_idx").on(t.usuarioId),
    idxStatus: index("comissoes_status_idx").on(t.status),
  })
);

export const templatesComissao = mysqlTable("templates_comissao", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  projetoId: int("projeto_id"),
  percentualImobiliaria: decimal("percentual_imobiliaria", { precision: 5, scale: 2 }).default("3.50").notNull(),
  percentualCorretor: decimal("percentual_corretor", { precision: 5, scale: 2 }).default("1.85").notNull(),
  percentualGerente: decimal("percentual_gerente", { precision: 5, scale: 2 }).default("0.50").notNull(),
  percentualSuperintendente: decimal("percentual_superintendente", { precision: 5, scale: 2 }).default("0.30").notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Contrato = typeof contratos.$inferSelect;
export type Comissao = typeof comissoes.$inferSelect;
