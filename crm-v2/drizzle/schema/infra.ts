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

export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull(),
    titulo: varchar("titulo", { length: 255 }).notNull(),
    mensagem: text("mensagem").notNull(),
    tipo: mysqlEnum("tipo", [
      "lead_recebido",
      "follow_up",
      "sistema",
      "alerta",
      "conquista",
      "ia_priorizacao",
    ])
      .default("sistema")
      .notNull(),
    leadId: int("lead_id"),
    lida: boolean("lida").default(false).notNull(),
    lidaEm: timestamp("lida_em"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    idxUser: index("notif_user_idx").on(t.userId),
    idxLida: index("notif_lida_idx").on(t.lida),
    idxCreated: index("notif_created_idx").on(t.createdAt),
  })
);

export const jobControl = mysqlTable("job_control", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
