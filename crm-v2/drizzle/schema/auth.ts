import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("open_id", { length: 255 }).unique().notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }),
    role: mysqlEnum("role", ["admin", "superintendente", "gestor", "corretor"])
      .default("corretor")
      .notNull(),
    status: mysqlEnum("status", ["presente", "ausente"]).default("ausente").notNull(),
    telefone: varchar("telefone", { length: 20 }),
    fotoUrl: varchar("foto_url", { length: 500 }),
    cpf: varchar("cpf", { length: 14 }),
    creci: varchar("creci", { length: 50 }),
    equipeId: int("equipe_id"),
    limiteDiarioLeads: int("limite_diario_leads").default(30).notNull(),
    googleCalendarId: varchar("google_calendar_id", { length: 255 }),
    googleRefreshToken: varchar("google_refresh_token", { length: 500 }),
    lastSignedIn: timestamp("last_signed_in"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    idxOpenId: index("users_open_id_idx").on(t.openId),
    idxRole: index("users_role_idx").on(t.role),
    idxEquipe: index("users_equipe_idx").on(t.equipeId),
  })
);

export const equipes = mysqlTable("equipes", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  gestorId: int("gestor_id"),
  superintendenteId: int("superintendente_id"),
  cor: varchar("cor", { length: 7 }).default("#3b82f6").notNull(),
  metaMensal: int("meta_mensal").default(0).notNull(),
  ativa: boolean("ativa").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const historicoPresenca = mysqlTable(
  "historico_presenca",
  {
    id: int("id").autoincrement().primaryKey(),
    corretorId: int("corretor_id").notNull(),
    tipo: mysqlEnum("tipo", ["entrada", "saida"]).notNull(),
    statusAnterior: mysqlEnum("status_anterior", ["presente", "ausente"]).notNull(),
    statusNovo: mysqlEnum("status_novo", ["presente", "ausente"]).notNull(),
    origem: mysqlEnum("origem", [
      "manual",
      "automatico_fim",
      "automatico_3h",
      "sistema",
    ])
      .default("manual")
      .notNull(),
    dataHora: timestamp("data_hora").defaultNow().notNull(),
  },
  (t) => ({
    idxCorretor: index("presenca_corretor_idx").on(t.corretorId),
    idxDataHora: index("presenca_data_hora_idx").on(t.dataHora),
  })
);

export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  endpoint: varchar("endpoint", { length: 500 }).notNull(),
  p256dh: varchar("p256dh", { length: 255 }).notNull(),
  auth: varchar("auth", { length: 255 }).notNull(),
  userAgent: varchar("user_agent", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Equipe = typeof equipes.$inferSelect;
