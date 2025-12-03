import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, index } from "drizzle-orm/mysql-core";

/**
 * Schema do CRM Imobiliário - Seu Metro Quadrado
 * 
 * Este schema implementa um sistema completo de CRM para imobiliárias, incluindo:
 * - Gestão de usuários (corretores e gestores)
 * - Projetos e imóveis
 * - Leads e histórico de interações
 * - Distribuição automática de leads
 * - Sistema de follow-up
 */

// ============================================================================
// TABELA DE USUÁRIOS
// ============================================================================

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "corretor", "gestor"]).default("corretor").notNull(),
  
  // Campos específicos para corretores
  status: mysqlEnum("status", ["presente", "ausente"]).default("ausente").notNull(),
  telefone: varchar("telefone", { length: 20 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// TABELA DE PROJETOS (EMPREENDIMENTOS)
// ============================================================================

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  construtora: varchar("construtora", { length: 255 }),
  endereco: text("endereco"),
  bairro: varchar("bairro", { length: 100 }),
  cidade: varchar("cidade", { length: 100 }).default("Su00e3o Paulo").notNull(),
  estado: varchar("estado", { length: 2 }).default("SP").notNull(),
  
  // Informau00e7u00f5es do projeto
  descricao: text("descricao"),
  tipo: mysqlEnum("tipo", ["mcmv", "sfh", "outro"]).default("mcmv").notNull(),
  status: mysqlEnum("status", ["ativo", "inativo", "esgotado"]).default("ativo").notNull(),
  
  // Valores
  valorMinimo: int("valorMinimo"), // em centavos
  valorMaximo: int("valorMaximo"), // em centavos
  
  // Características
  metragemMinima: int("metragemMinima"),
  metragemMaxima: int("metragemMaxima"),
  dormitorios: varchar("dormitorios", { length: 50 }), // "1, 2, 3"
  vagas: int("vagas").default(0), // Número de vagas de garagem
  
  // Campos específicos do mercado imobiliário
  zona: mysqlEnum("zona", ["norte", "sul", "leste", "oeste", "centro"]),
  enquadramento: mysqlEnum("enquadramento", ["HIS1", "HIS2", "HMP", "R2V"]),
  developer: varchar("developer", { length: 255 }), // Incorporadora
  
  // Imagens
  logoUrl: text("logoUrl"), // Logo da construtora
  imagemPrincipal: text("imagemPrincipal"),
  imagensAdicionais: text("imagensAdicionais"), // JSON array de URLs
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ============================================================================
// TABELA DE UNIDADES (IMÓVEIS ESPECÍFICOS)
// ============================================================================

export const properties = mysqlTable("properties", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  
  // Identificação
  unidade: varchar("unidade", { length: 50 }).notNull(),
  bloco: varchar("bloco", { length: 50 }),
  andar: int("andar"),
  
  // Características
  metragem: int("metragem").notNull(),
  dormitorios: int("dormitorios").notNull(),
  banheiros: int("banheiros").notNull(),
  vagas: int("vagas").default(0).notNull(),
  
  // Valores
  valor: int("valor").notNull(), // em centavos
  
  // Status
  status: mysqlEnum("status", ["disponivel", "reservado", "vendido"]).default("disponivel").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Property = typeof properties.$inferSelect;
export type InsertProperty = typeof properties.$inferInsert;

// ============================================================================
// TABELA DE LEADS
// ============================================================================

export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  
  // Identificação do lead
  idPrincipal: varchar("idPrincipal", { length: 50 }).unique(), // ID da planilha original
  nome: varchar("nome", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  telefone: varchar("telefone", { length: 20 }).notNull(),
  
  // Origem e interesse
  origem: varchar("origem", { length: 255 }), // Canal de captação
  projectId: int("projectId"), // Projeto de interesse
  
  // Atribuição
  corretorId: int("corretorId"), // Corretor responsável
  dataDistribuicao: timestamp("dataDistribuicao"),
  
  // Status no funil
  status: mysqlEnum("status", [
    "novo",
    "aguardando_atendimento",
    "em_atendimento",
    "agendado",
    "visita_realizada",
    "analise_credito",
    "contrato_fechado",
    "perdido"
  ]).default("novo").notNull(),
  
  // Follow-up
  proximoFollowup: timestamp("proximoFollowup"),
  diasFollowupConsecutivos: int("diasFollowupConsecutivos").default(0).notNull(),
  ultimoContato: timestamp("ultimoContato"),
  
  // Observações
  observacoes: text("observacoes"),
  motivoPerdido: text("motivoPerdido"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  telefoneIdx: index("telefone_idx").on(table.telefone),
  corretorIdx: index("corretor_idx").on(table.corretorId),
  statusIdx: index("status_idx").on(table.status),
  projectIdx: index("project_idx").on(table.projectId),
}));

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

// ============================================================================
// TABELA DE HISTÓRICO DE INTERAÇÕES
// ============================================================================

export const leadHistory = mysqlTable("lead_history", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  corretorId: int("corretorId").notNull(),
  
  // Detalhes da interação
  tipo: mysqlEnum("tipo", [
    "ligacao",
    "whatsapp",
    "email",
    "sms",
    "visita",
    "outro"
  ]).notNull(),
  
  resultado: mysqlEnum("resultado", [
    "contato_realizado",
    "nao_atendeu",
    "agendamento",
    "visita_realizada",
    "proposta_enviada",
    "recusou",
    "outro"
  ]).notNull(),
  
  observacoes: text("observacoes"),
  
  // Mudança de status
  statusAnterior: varchar("statusAnterior", { length: 50 }),
  statusNovo: varchar("statusNovo", { length: 50 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LeadHistory = typeof leadHistory.$inferSelect;
export type InsertLeadHistory = typeof leadHistory.$inferInsert;

// ============================================================================
// TABELA DE LOG DE DISTRIBUIÇÃO
// ============================================================================

export const distributionLog = mysqlTable("distribution_log", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  corretorId: int("corretorId").notNull(),
  
  // Tipo de distribuição
  tipo: mysqlEnum("tipo", ["automatica", "manual", "inicial"]).notNull(),
  
  // Motivo da distribuição
  motivo: text("motivo"),
  
  // Quem fez a distribuição (no caso de manual)
  distribuidoPorId: int("distribuidoPorId"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DistributionLog = typeof distributionLog.$inferSelect;
export type InsertDistributionLog = typeof distributionLog.$inferInsert;

// ============================================================================
// TABELA DE ESTATÍSTICAS DE CONVERSÃO (para otimização de distribuição)
// ============================================================================

export const conversionStats = mysqlTable("conversion_stats", {
  id: int("id").autoincrement().primaryKey(),
  corretorId: int("corretorId").notNull(),
  projectId: int("projectId").notNull(),
  
  // Estatísticas
  leadsRecebidos: int("leadsRecebidos").default(0).notNull(),
  leadsContatados: int("leadsContatados").default(0).notNull(),
  agendamentos: int("agendamentos").default(0).notNull(),
  visitas: int("visitas").default(0).notNull(),
  analisesCredito: int("analisesCredito").default(0).notNull(),
  contratosFechados: int("contratosFechados").default(0).notNull(),
  leadsPerdidos: int("leadsPerdidos").default(0).notNull(),
  
  // Taxa de conversão (calculada)
  taxaConversao: int("taxaConversao").default(0).notNull(), // em porcentagem * 100
  
  // Período de referência
  periodoInicio: timestamp("periodoInicio").notNull(),
  periodoFim: timestamp("periodoFim").notNull(),
  
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ConversionStats = typeof conversionStats.$inferSelect;
export type InsertConversionStats = typeof conversionStats.$inferInsert;

// ============================================================================
// TABELA DE MENSAGENS PRONTAS
// ============================================================================

export const quickMessages = mysqlTable("quick_messages", {
  id: int("id").autoincrement().primaryKey(),
  corretorId: int("corretorId"), // null = mensagem global
  
  titulo: varchar("titulo", { length: 100 }).notNull(),
  mensagem: text("mensagem").notNull(),
  tipo: mysqlEnum("tipo", ["whatsapp", "email", "sms"]).notNull(),
  
  // Ordem de exibição
  ordem: int("ordem").default(0).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QuickMessage = typeof quickMessages.$inferSelect;
export type InsertQuickMessage = typeof quickMessages.$inferInsert;
