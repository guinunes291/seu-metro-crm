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

export const construtoras = mysqlTable("construtoras", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  logoUrl: varchar("logo_url", { length: 500 }),
  ativa: boolean("ativa").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projects = mysqlTable(
  "projects",
  {
    id: int("id").autoincrement().primaryKey(),
    nome: varchar("nome", { length: 255 }).notNull(),
    construtoraId: int("construtora_id"),
    construtora: varchar("construtora", { length: 255 }),
    endereco: varchar("endereco", { length: 500 }),
    bairro: varchar("bairro", { length: 100 }),
    cidade: varchar("cidade", { length: 100 }).default("São Paulo").notNull(),
    estado: varchar("estado", { length: 2 }).default("SP").notNull(),
    cep: varchar("cep", { length: 9 }),
    tipo: mysqlEnum("tipo", ["mcmv", "sfh", "outro"]).default("mcmv").notNull(),
    status: mysqlEnum("status", ["ativo", "inativo", "esgotado"]).default("ativo").notNull(),
    valorMinimo: int("valor_minimo").default(0).notNull(),
    valorMaximo: int("valor_maximo").default(0).notNull(),
    metragemMinima: decimal("metragem_minima", { precision: 6, scale: 2 }),
    metragemMaxima: decimal("metragem_maxima", { precision: 6, scale: 2 }),
    dormitorios: varchar("dormitorios", { length: 50 }),
    vagas: int("vagas").default(0).notNull(),
    zona: varchar("zona", { length: 50 }),
    regiao: varchar("regiao", { length: 100 }),
    enquadramento: varchar("enquadramento", { length: 50 }),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    logoUrl: varchar("logo_url", { length: 500 }),
    construtoraLogoUrl: varchar("construtora_logo_url", { length: 500 }),
    dataEntrega: varchar("data_entrega", { length: 50 }),
    standVendas: text("stand_vendas"),
    linkTabela: text("link_tabela"),
    linkBook: text("link_book"),
    linkDrive: text("link_drive"),
    descricao: text("descricao"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    idxStatus: index("projects_status_idx").on(t.status),
    idxZona: index("projects_zona_idx").on(t.zona),
    idxTipo: index("projects_tipo_idx").on(t.tipo),
  })
);

export const tipologias = mysqlTable(
  "tipologias",
  {
    id: int("id").autoincrement().primaryKey(),
    projetoId: int("projeto_id").notNull(),
    nome: varchar("nome", { length: 255 }).notNull(),
    metragem: decimal("metragem", { precision: 6, scale: 2 }),
    dormitorios: int("dormitorios"),
    vagas: int("vagas").default(0).notNull(),
    decorado: boolean("decorado").default(false).notNull(),
    varanda: varchar("varanda", { length: 20 }),
    enquadramento: varchar("enquadramento", { length: 10 }),
    valorTabela: int("valor_tabela"),
    desconto: int("desconto"),
    valorFinal: int("valor_final"),
    valorAvaliacao: int("valor_avaliacao"),
    disponivel: boolean("disponivel").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    idxProjeto: index("tipologias_projeto_idx").on(t.projetoId),
  })
);

export const materiais = mysqlTable(
  "materiais",
  {
    id: int("id").autoincrement().primaryKey(),
    projetoId: int("projeto_id").notNull(),
    tipo: mysqlEnum("tipo", ["book", "foto", "tabela", "planta", "video", "outro"])
      .default("outro")
      .notNull(),
    nome: varchar("nome", { length: 255 }).notNull(),
    driveUrl: text("drive_url"),
    s3Url: text("s3_url"),
    fileKey: varchar("file_key", { length: 500 }),
    mimeType: varchar("mime_type", { length: 100 }),
    tamanho: int("tamanho"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    idxProjeto: index("materiais_projeto_idx").on(t.projetoId),
  })
);

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
export type Tipologia = typeof tipologias.$inferSelect;
