import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, index, json, date } from "drizzle-orm/mysql-core";

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
  fotoUrl: text("fotoUrl"), // URL da foto de perfil do corretor
  
  // Dados pessoais do corretor
  cpf: varchar("cpf", { length: 14 }), // 000.000.000-00
  dataNascimento: timestamp("dataNascimento"),
  
  // Dados profissionais
  creci: varchar("creci", { length: 20 }), // Número do CRECI se houver
  dataCredenciamento: timestamp("dataCredenciamento"),
  dataDescredenciamento: timestamp("dataDescredenciamento"),
  situacao: mysqlEnum("situacao", ["ativo", "inativo"]).default("ativo").notNull(),
  
  // Endereço completo
  logradouro: varchar("logradouro", { length: 255 }),
  numero: varchar("numero", { length: 20 }),
  complemento: varchar("complemento", { length: 100 }),
  bairro: varchar("bairro", { length: 100 }),
  cidade: varchar("cidade", { length: 100 }),
  estado: varchar("estado", { length: 2 }),
  cep: varchar("cep", { length: 9 }), // 00000-000
  
  // Integração Google Calendar
  googleCalendarId: varchar("googleCalendarId", { length: 255 }), // ID do calendário do Google
  googleRefreshToken: text("googleRefreshToken"), // Refresh token para renovar acesso
  googleCalendarEnabled: boolean("googleCalendarEnabled").default(false).notNull(),
  
  // Sistema de Indicação
  codigoIndicacao: varchar("codigoIndicacao", { length: 20 }).unique(), // Código único para indicação
  indicadoPorId: int("indicadoPorId"), // ID do usuário que indicou
  
  // Controle de distribuição de leads
  limiteDiarioLeads: int("limiteDiarioLeads").default(50).notNull(), // Limite para distribuição automática
  limiteDiarioWebhook: int("limiteDiarioWebhook").default(10).notNull(), // Limite para leads via webhook
  
  // Gamificação de follow-ups
  ultimoDesbloqueio: timestamp("ultimoDesbloqueio"), // Data/hora do último desbloqueio (60%)
  
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
  bookUrl: text("bookUrl"), // URL do PDF de apresentação do projeto
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ============================================================================
// TABELA DE SUGESTÕES DE PROJETOS (PENDENTES DE APROVAÇÃO)
// ============================================================================

export const projectSuggestions = mysqlTable("project_suggestions", {
  id: int("id").autoincrement().primaryKey(),
  
  // Dados do projeto sugerido
  nome: varchar("nome", { length: 255 }).notNull(),
  construtora: varchar("construtora", { length: 255 }),
  endereco: text("endereco"),
  bairro: varchar("bairro", { length: 100 }),
  cidade: varchar("cidade", { length: 100 }).default("São Paulo").notNull(),
  estado: varchar("estado", { length: 2 }).default("SP").notNull(),
  descricao: text("descricao"),
  tipo: mysqlEnum("tipo", ["mcmv", "sfh", "outro"]).default("mcmv").notNull(),
  valorMinimo: int("valorMinimo"),
  valorMaximo: int("valorMaximo"),
  metragemMinima: int("metragemMinima"),
  metragemMaxima: int("metragemMaxima"),
  dormitorios: varchar("dormitorios", { length: 50 }),
  zona: mysqlEnum("zona", ["norte", "sul", "leste", "oeste", "centro"]),
  
  // Quem sugeriu
  corretorId: int("corretorId").notNull(),
  
  // Status da sugestão
  status: mysqlEnum("status", ["pendente", "aprovado", "reprovado"]).default("pendente").notNull(),
  motivoReprovacao: text("motivoReprovacao"),
  aprovadoPor: int("aprovadoPor"), // ID do gestor que aprovou/reprovou
  dataAprovacao: timestamp("dataAprovacao"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProjectSuggestion = typeof projectSuggestions.$inferSelect;
export type InsertProjectSuggestion = typeof projectSuggestions.$inferInsert;

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
  cpf: varchar("cpf", { length: 14 }), // CPF do lead (formato: 000.000.000-00)
  
  // Origem e interesse
  origem: mysqlEnum("origem", [
    "facebook",           // Facebook Lead Ads
    "google_sheets",      // Importado do Google Sheets
    "site",               // Formulário do site
    "indicacao",          // Indicação de cliente
    "captacao_corretor",  // Captação própria do corretor (NÃO transfere após 5/5)
    "whatsapp",           // Contato via WhatsApp
    "telefone",           // Ligação telefônica
    "plantao",            // Plantão de vendas
    "agendamento_self_service", // Agendamento via link self-service
    "chatbot",            // Chatbot de pré-qualificação
    "outro"               // Outras origens
  ]).default("outro"), // Canal de captação
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
  
  // Lixeira - leads perdidos ficam aqui
  naLixeira: boolean("naLixeira").default(false).notNull(),
  dataMovidoLixeira: timestamp("dataMovidoLixeira"),
  corretorAnteriorId: int("corretorAnteriorId"), // Guarda o corretor que perdeu o lead
  
  // Rastreamento de corretores que já tentaram o lead (JSON array de IDs)
  corretoresQueTentaram: text("corretoresQueTentaram"), // JSON: [1, 5, 8] - IDs dos corretores
  
  // Campos do Facebook Lead Ads
  campanha: varchar("campanha", { length: 255 }), // Nome da campanha (campaign_name)
  faixaRenda: varchar("faixaRenda", { length: 100 }), // Faixa de renda (faixa_de_renda)
  prefereContatoPor: varchar("prefereContatoPor", { length: 50 }), // Preferência de contato (prefere_falar_por)
  dataHoraCriacao: timestamp("dataHoraCriacao"), // Data/hora de criação no Facebook (created_time)
  
  // Identificação de leads via webhook (para notificação urgente)
  origemWebhook: boolean("origemWebhook").default(false).notNull(), // true se veio via webhook
  
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
// TABELA DE HISTÓRICO DE TRANSIÇÕES DE STATUS (FUNIL DE VENDAS)
// ============================================================================

/**
 * Registra cada mudança de status de um lead para métricas do funil.
 * Permite contabilizar quantos agendamentos, visitas, análises, etc.
 * cada corretor realizou, independente do status atual do lead.
 */
export const leadStatusTransitions = mysqlTable("lead_status_transitions", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  corretorId: int("corretorId").notNull(),
  
  // Status anterior e novo
  statusAnterior: mysqlEnum("statusAnterior", [
    "novo",
    "aguardando_atendimento",
    "em_atendimento",
    "agendado",
    "visita_realizada",
    "analise_credito",
    "contrato_fechado",
    "perdido"
  ]).notNull(),
  
  statusNovo: mysqlEnum("statusNovo", [
    "novo",
    "aguardando_atendimento",
    "em_atendimento",
    "agendado",
    "visita_realizada",
    "analise_credito",
    "contrato_fechado",
    "perdido"
  ]).notNull(),
  
  // Observações opcionais
  observacao: text("observacao"),
  
  // Data/hora da transição
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  leadIdx: index("transition_lead_idx").on(table.leadId),
  corretorIdx: index("transition_corretor_idx").on(table.corretorId),
  statusNovoIdx: index("transition_status_novo_idx").on(table.statusNovo),
  createdAtIdx: index("transition_created_idx").on(table.createdAt),
}));

export type LeadStatusTransition = typeof leadStatusTransitions.$inferSelect;
export type InsertLeadStatusTransition = typeof leadStatusTransitions.$inferInsert;

// ============================================================================
// TABELA DE AGENDAMENTOS
// ============================================================================

/**
 * Registra todos os agendamentos de visitas.
 * Um lead pode ter múltiplos agendamentos (reagendamentos, diferentes projetos).
 * Para métricas do funil, conta-se leads únicos que tiveram agendamento.
 */
export const agendamentos = mysqlTable("agendamentos", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  corretorId: int("corretorId").notNull(),
  
  // Projeto (pode ser da base ou customizado)
  projectId: int("projectId"), // Projeto da base de dados
  projetoCustom: varchar("projetoCustom", { length: 255 }), // Projeto digitado manualmente
  construtora: varchar("construtora", { length: 255 }),
  
  // Data e hora do agendamento
  dataAgendamento: timestamp("dataAgendamento").notNull(),
  horaAgendamento: varchar("horaAgendamento", { length: 5 }).notNull(), // HH:MM
  
  // Status do agendamento
  status: mysqlEnum("status", [
    "pendente",
    "confirmado", 
    "realizado",
    "cancelado",
    "reagendado"
  ]).default("pendente").notNull(),
  
  // Observações
  observacoes: text("observacoes"),
  
  // Quem criou o agendamento
  criadoPorId: int("criadoPorId"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  leadIdx: index("agendamento_lead_idx").on(table.leadId),
  corretorIdx: index("agendamento_corretor_idx").on(table.corretorId),
  dataIdx: index("agendamento_data_idx").on(table.dataAgendamento),
  statusIdx: index("agendamento_status_idx").on(table.status),
}));

export type Agendamento = typeof agendamentos.$inferSelect;
export type InsertAgendamento = typeof agendamentos.$inferInsert;

// ============================================================================
// TABELA DE VISITAS REALIZADAS
// ============================================================================

/**
 * Registra todas as visitas realizadas.
 * Um lead pode ter múltiplas visitas (diferentes projetos, segunda visita).
 * Para métricas do funil, conta-se leads únicos que tiveram visita.
 */
export const visitas = mysqlTable("visitas", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  corretorId: int("corretorId").notNull(),
  agendamentoId: int("agendamentoId"), // Vinculado ao agendamento original (se houver)
  
  // Projeto visitado
  projectId: int("projectId"),
  projetoCustom: varchar("projetoCustom", { length: 255 }),
  construtora: varchar("construtora", { length: 255 }),
  
  // Data e hora da visita
  dataVisita: timestamp("dataVisita").notNull(),
  horaVisita: varchar("horaVisita", { length: 5 }), // HH:MM
  
  // Resultado da visita
  resultado: mysqlEnum("resultado", [
    "interesse_alto",
    "interesse_medio",
    "interesse_baixo",
    "sem_interesse",
    "pendente_documentacao",
    "encaminhado_analise"
  ]).default("interesse_medio").notNull(),
  
  // Observações
  observacoes: text("observacoes"),
  
  // Quem registrou a visita
  registradoPorId: int("registradoPorId"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  leadIdx: index("visita_lead_idx").on(table.leadId),
  corretorIdx: index("visita_corretor_idx").on(table.corretorId),
  dataIdx: index("visita_data_idx").on(table.dataVisita),
  agendamentoIdx: index("visita_agendamento_idx").on(table.agendamentoId),
}));

export type Visita = typeof visitas.$inferSelect;
export type InsertVisita = typeof visitas.$inferInsert;

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


// ============================================================================
// TABELA DE NOTIFICAÇÕES
// ============================================================================

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Usuário que recebe a notificação
  
  // Conteúdo
  titulo: varchar("titulo", { length: 255 }).notNull(),
  mensagem: text("mensagem").notNull(),
  tipo: mysqlEnum("tipo", ["lead_recebido", "follow_up", "sistema", "alerta"]).default("sistema").notNull(),
  
  // Referência opcional
  leadId: int("leadId"), // Lead relacionado (se aplicável)
  
  // Status
  lida: boolean("lida").default(false).notNull(),
  lidaEm: timestamp("lidaEm"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;


// ============================================================================
// TABELA DE METAS POR CORRETOR
// ============================================================================

export const metas = mysqlTable("metas", {
  id: int("id").autoincrement().primaryKey(),
  corretorId: int("corretorId").notNull(),
  
  // Período da meta
  mes: int("mes").notNull(), // 1-12
  ano: int("ano").notNull(),
  
  // Metas
  metaLeads: int("metaLeads").default(0).notNull(), // Quantidade de leads a converter
  metaAgendamentos: int("metaAgendamentos").default(0).notNull(), // Quantidade de agendamentos
  metaVisitas: int("metaVisitas").default(0).notNull(), // Quantidade de visitas
  metaContratos: int("metaContratos").default(0).notNull(), // Quantidade de contratos fechados
  metaVGV: int("metaVGV").default(0).notNull(), // Valor Geral de Venda em centavos
  
  // Observações
  observacoes: text("observacoes"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  corretorMesAnoIdx: index("corretor_mes_ano_idx").on(table.corretorId, table.mes, table.ano),
}));

export type Meta = typeof metas.$inferSelect;
export type InsertMeta = typeof metas.$inferInsert;


// ============================================================================
// TABELA DE FILA DE DISTRIBUIÇÃO (ROLETA)
// ============================================================================

/**
 * Sistema de roleta inteligente para distribuição de leads
 * Cada corretor tem uma posição na fila. Quando recebe um lead, vai para o final.
 * Apenas corretores com status "presente" participam da distribuição.
 */
export const filaDistribuicao = mysqlTable("fila_distribuicao", {
  id: int("id").autoincrement().primaryKey(),
  corretorId: int("corretorId").notNull().unique(), // Cada corretor aparece uma única vez
  
  // Posição na fila (menor = próximo a receber)
  posicao: int("posicao").notNull(),
  
  // Configurações
  ativo: boolean("ativo").default(true).notNull(), // Se está participando da roleta
  maxLeadsDia: int("maxLeadsDia").default(10).notNull(), // Máximo de leads por dia
  leadsRecebidosHoje: int("leadsRecebidosHoje").default(0).notNull(),
  
  // Última distribuição
  ultimaDistribuicao: timestamp("ultimaDistribuicao"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  posicaoIdx: index("posicao_idx").on(table.posicao),
}));

export type FilaDistribuicao = typeof filaDistribuicao.$inferSelect;
export type InsertFilaDistribuicao = typeof filaDistribuicao.$inferInsert;

// ============================================================================
// TABELA DE CONFIGURAÇÃO DO WEBHOOK (FACEBOOK ADS)
// ============================================================================

export const webhookConfig = mysqlTable("webhook_config", {
  id: int("id").autoincrement().primaryKey(),
  
  // Identificador único do webhook (para validação)
  webhookToken: varchar("webhookToken", { length: 64 }).notNull().unique(),
  
  // Nome/descrição da integração
  nome: varchar("nome", { length: 100 }).notNull(),
  fonte: mysqlEnum("fonte", ["facebook", "instagram", "google", "rdstation", "outro"]).default("facebook").notNull(),
  
  // Tipo de fila (geral ou foco)
  tipoFila: mysqlEnum("tipoFila", ["geral", "foco"]).default("geral").notNull(),
  
  // Projeto padrão para leads recebidos
  projectIdPadrao: int("projectIdPadrao"),
  
  // Mapeamento de form_id do Facebook para projeto
  formIdMapping: text("formIdMapping"), // JSON: { "form_id_123": project_id_1, "form_id_456": project_id_2 }
  
  // Status
  ativo: boolean("ativo").default(true).notNull(),
  
  // Estatísticas
  leadsRecebidos: int("leadsRecebidos").default(0).notNull(),
  ultimoLeadRecebido: timestamp("ultimoLeadRecebido"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WebhookConfig = typeof webhookConfig.$inferSelect;
export type InsertWebhookConfig = typeof webhookConfig.$inferInsert;


// ============================================================================
// TABELA DE TAREFAS DO CORRETOR
// ============================================================================

/**
 * Sistema de tarefas personalizadas para corretores
 * Permite criar lembretes e tarefas para datas específicas
 */
export const tarefas = mysqlTable("tarefas", {
  id: int("id").autoincrement().primaryKey(),
  
  // Relacionamentos
  corretorId: int("corretorId").notNull(),
  leadId: int("leadId"), // Opcional - pode ser uma tarefa sem lead específico
  
  // Detalhes da tarefa
  titulo: varchar("titulo", { length: 255 }).notNull(),
  descricao: text("descricao"),
  
  // Tipo de tarefa
  tipo: mysqlEnum("tipo", [
    "follow_up",        // Follow-up automático
    "agendamento",      // Visita/reunião agendada
    "ligacao",          // Lembrete para ligar
    "whatsapp",         // Lembrete para enviar WhatsApp
    "email",            // Lembrete para enviar email
    "visita",           // Lembrete de visita
    "documentacao",     // Lembrete de documentação
    "outro"             // Tarefa personalizada
  ]).default("outro").notNull(),
  
  // Data e hora da tarefa
  dataAgendada: timestamp("dataAgendada").notNull(),
  
  // Status
  status: mysqlEnum("status", [
    "pendente",
    "concluida",
    "cancelada"
  ]).default("pendente").notNull(),
  
  // Prioridade
  prioridade: mysqlEnum("prioridade", ["baixa", "media", "alta"]).default("media").notNull(),
  
  // Conclusão
  concluidaEm: timestamp("concluidaEm"),
  observacoesConclusao: text("observacoesConclusao"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  corretorIdx: index("tarefa_corretor_idx").on(table.corretorId),
  leadIdx: index("tarefa_lead_idx").on(table.leadId),
  dataIdx: index("tarefa_data_idx").on(table.dataAgendada),
  statusIdx: index("tarefa_status_idx").on(table.status),
}));

export type Tarefa = typeof tarefas.$inferSelect;
export type InsertTarefa = typeof tarefas.$inferInsert;

// ============================================================================
// TABELA DE FOLLOW-UPS AUTOMÁTICOS
// ============================================================================

/**
 * Sistema de follow-up automático para leads novos
 * Cria 5 tentativas de contato, se não houver resposta o lead é encerrado
 */
export const followUps = mysqlTable("follow_ups", {
  id: int("id").autoincrement().primaryKey(),
  
  // Relacionamentos
  leadId: int("leadId").notNull(),
  corretorId: int("corretorId").notNull(),
  
  // Controle de tentativas
  tentativaAtual: int("tentativaAtual").default(1).notNull(), // 1 a 3
  maxTentativas: int("maxTentativas").default(3).notNull(),
  
  // Datas
  proximaTentativa: timestamp("proximaTentativa").notNull(),
  ultimaTentativa: timestamp("ultimaTentativa"),
  
  // Status
  status: mysqlEnum("status", [
    "ativo",            // Follow-up em andamento
    "respondido",       // Cliente respondeu (contador resetado)
    "encerrado",        // 5 tentativas sem resposta
    "convertido",       // Lead avançou no funil
    "cancelado"         // Cancelado manualmente
  ]).default("ativo").notNull(),
  
  // Histórico de tentativas (JSON array)
  historicoTentativas: text("historicoTentativas"), // [{ data, resultado, observacao }]
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  leadIdx: index("followup_lead_idx").on(table.leadId),
  corretorIdx: index("followup_corretor_idx").on(table.corretorId),
  proximaIdx: index("followup_proxima_idx").on(table.proximaTentativa),
  statusIdx: index("followup_status_idx").on(table.status),
}));

export type FollowUp = typeof followUps.$inferSelect;
export type InsertFollowUp = typeof followUps.$inferInsert;


// ============================================================================
// TABELA DE ATIVIDADES DIÁRIAS (PARA RANKING TV)
// ============================================================================

/**
 * Registro de atividades diárias dos corretores para o ranking de produtividade
 * Cada registro representa as atividades de um corretor em um dia específico
 */
// Sistema de pontuação por ação:
// - Novo cliente cadastrado = 5 pontos
// - Registro/alteração de status = 2 pontos
// - Agendamento criado = 15 pontos
// - Visita realizada = 25 pontos
// - Documentação/Análise de Crédito = 35 pontos
// - Venda = 80 pontos
export const PONTUACAO = {
  CLIENTE_CADASTRADO: 5,
  ALTERACAO_STATUS: 2,
  AGENDAMENTO: 15,
  VISITA: 25,
  DOCUMENTACAO: 35,
  VENDA: 80,
} as const;

export const atividadesDiarias = mysqlTable("atividades_diarias", {
  id: int("id").autoincrement().primaryKey(),
  
  // Relacionamentos
  corretorId: int("corretorId").notNull(),
  
  // Data do registro (apenas a data, sem hora)
  data: timestamp("data").notNull(),
  
  // Contadores de atividades
  clientesCadastrados: int("clientesCadastrados").default(0).notNull(),
  alteracoesStatus: int("alteracoesStatus").default(0).notNull(),
  ligacoesRealizadas: int("ligacoesRealizadas").default(0).notNull(),
  ligacoesAtendidas: int("ligacoesAtendidas").default(0).notNull(),
  whatsappEnviados: int("whatsappEnviados").default(0).notNull(),
  whatsappRespondidos: int("whatsappRespondidos").default(0).notNull(),
  agendamentosConfirmados: int("agendamentosConfirmados").default(0).notNull(),
  visitasRealizadas: int("visitasRealizadas").default(0).notNull(),
  propostasEnviadas: int("propostasEnviadas").default(0).notNull(),
  documentacoesRecolhidas: int("documentacoesRecolhidas").default(0).notNull(),
  analiseCreditoEnviadas: int("analiseCreditoEnviadas").default(0).notNull(),
  contratosFechados: int("contratosFechados").default(0).notNull(),
  
  // Valor total de vendas do dia (em centavos)
  vgvDia: int("vgvDia").default(0).notNull(),
  
  // Pontuação calculada automaticamente
  pontuacaoTotal: int("pontuacaoTotal").default(0).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  corretorIdx: index("atividades_corretor_idx").on(table.corretorId),
  dataIdx: index("atividades_data_idx").on(table.data),
  corretorDataIdx: index("atividades_corretor_data_idx").on(table.corretorId, table.data),
}));

export type AtividadeDiaria = typeof atividadesDiarias.$inferSelect;
export type InsertAtividadeDiaria = typeof atividadesDiarias.$inferInsert;


// ============================================================================
// TABELA DE METAS DIÁRIAS POR CORRETOR
// ============================================================================

/**
 * Metas diárias de produtividade para cada corretor
 * O gestor pode definir metas específicas para cada corretor
 */
export const metasDiarias = mysqlTable("metas_diarias", {
  id: int("id").autoincrement().primaryKey(),
  corretorId: int("corretorId").notNull(),
  
  // Metas de atividades diárias
  metaLigacoes: int("metaLigacoes").default(20).notNull(),
  metaWhatsapp: int("metaWhatsapp").default(30).notNull(),
  metaAgendamentos: int("metaAgendamentos").default(3).notNull(),
  metaVisitas: int("metaVisitas").default(2).notNull(),
  metaDocumentacoes: int("metaDocumentacoes").default(1).notNull(),
  metaVendas: int("metaVendas").default(1).notNull(),
  
  // Ativo/Inativo
  ativo: boolean("ativo").default(true).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  corretorIdx: index("metas_diarias_corretor_idx").on(table.corretorId),
}));

export type MetaDiaria = typeof metasDiarias.$inferSelect;
export type InsertMetaDiaria = typeof metasDiarias.$inferInsert;

// ============================================================================
// TABELA DE CONFIGURAÇÃO DE PONTUAÇÃO
// ============================================================================

/**
 * Configuração global de pontuação por atividade
 * Permite que o gestor defina quantos pontos vale cada atividade
 */
export const configuracaoPontuacao = mysqlTable("configuracao_pontuacao", {
  id: int("id").autoincrement().primaryKey(),
  
  // Pontos por atividade
  pontosLigacao: int("pontosLigacao").default(1).notNull(),
  pontosLigacaoAtendida: int("pontosLigacaoAtendida").default(2).notNull(),
  pontosWhatsapp: int("pontosWhatsapp").default(1).notNull(),
  pontosWhatsappRespondido: int("pontosWhatsappRespondido").default(2).notNull(),
  pontosAgendamento: int("pontosAgendamento").default(15).notNull(),
  pontosVisita: int("pontosVisita").default(25).notNull(),
  pontosDocumentacao: int("pontosDocumentacao").default(35).notNull(),
  pontosVenda: int("pontosVenda").default(80).notNull(),
  pontosClienteCadastrado: int("pontosClienteCadastrado").default(5).notNull(),
  pontosAlteracaoStatus: int("pontosAlteracaoStatus").default(2).notNull(),
  
  // Metadados
  atualizadoPor: int("atualizadoPor"), // ID do gestor que atualizou
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ConfiguracaoPontuacao = typeof configuracaoPontuacao.$inferSelect;
export type InsertConfiguracaoPontuacao = typeof configuracaoPontuacao.$inferInsert;

// ============================================================================
// TABELA DE ALERTAS DE PRODUTIVIDADE
// ============================================================================

/**
 * Registro de alertas de baixa produtividade
 * Gerados automaticamente quando corretor está abaixo da meta
 */
export const alertasProdutividade = mysqlTable("alertas_produtividade", {
  id: int("id").autoincrement().primaryKey(),
  
  corretorId: int("corretorId").notNull(),
  data: timestamp("data").notNull(),
  
  // Tipo de alerta
  tipo: mysqlEnum("tipo", ["baixa_produtividade", "meta_nao_atingida", "inativo"]).notNull(),
  
  // Detalhes
  mensagem: text("mensagem").notNull(),
  percentualMeta: int("percentualMeta").default(0).notNull(), // % da meta atingida
  
  // Status do alerta
  lido: boolean("lido").default(false).notNull(),
  lidoPor: int("lidoPor"), // ID do gestor que leu
  lidoEm: timestamp("lidoEm"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  corretorIdx: index("alertas_corretor_idx").on(table.corretorId),
  dataIdx: index("alertas_data_idx").on(table.data),
  lidoIdx: index("alertas_lido_idx").on(table.lido),
}));

export type AlertaProdutividade = typeof alertasProdutividade.$inferSelect;
export type InsertAlertaProdutividade = typeof alertasProdutividade.$inferInsert;


// ============================================================================
// TABELA DE CONQUISTAS/MEDALHAS
// ============================================================================

/**
 * Tipos de conquistas disponíveis no sistema
 * Cada tipo define os critérios para ganhar a medalha
 */
export const tiposConquista = mysqlTable("tipos_conquista", {
  id: int("id").autoincrement().primaryKey(),
  
  // Identificação
  codigo: varchar("codigo", { length: 50 }).notNull().unique(), // ex: "top_vendedor_semana"
  nome: varchar("nome", { length: 100 }).notNull(), // ex: "Top Vendedor da Semana"
  descricao: text("descricao"), // ex: "Maior número de vendas na semana"
  
  // Visual
  icone: varchar("icone", { length: 50 }).default("trophy").notNull(), // nome do ícone Lucide
  cor: varchar("cor", { length: 20 }).default("gold").notNull(), // gold, silver, bronze, blue, green
  
  // Categoria
  categoria: mysqlEnum("categoria", ["vendas", "produtividade", "streak", "especial"]).default("vendas").notNull(),
  
  // Critérios (valores numéricos para verificação automática)
  criterioTipo: mysqlEnum("criterioTipo", ["meta_semanal", "meta_mensal", "ranking_semanal", "ranking_mensal", "streak_dias", "total_vendas", "total_leads", "manual"]).notNull(),
  criterioValor: int("criterioValor").default(1).notNull(), // ex: 1 para top 1, 5 para streak de 5 dias
  
  // Configuração
  ativo: boolean("ativo").default(true).notNull(),
  recorrente: boolean("recorrente").default(true).notNull(), // pode ganhar múltiplas vezes?
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TipoConquista = typeof tiposConquista.$inferSelect;
export type InsertTipoConquista = typeof tiposConquista.$inferInsert;

/**
 * Conquistas ganhas pelos corretores
 * Registro histórico de todas as medalhas
 */
export const conquistas = mysqlTable("conquistas", {
  id: int("id").autoincrement().primaryKey(),
  
  corretorId: int("corretorId").notNull(),
  tipoConquistaId: int("tipoConquistaId").notNull(),
  
  // Período de referência (quando aplicável)
  periodoInicio: timestamp("periodoInicio"),
  periodoFim: timestamp("periodoFim"),
  
  // Detalhes da conquista
  valor: int("valor"), // ex: valor de VGV, número de vendas, dias de streak
  posicao: int("posicao"), // ex: 1º lugar, 2º lugar
  observacao: text("observacao"),
  
  // Notificação
  notificado: boolean("notificado").default(false).notNull(),
  notificadoEm: timestamp("notificadoEm"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  corretorIdx: index("conquistas_corretor_idx").on(table.corretorId),
  tipoIdx: index("conquistas_tipo_idx").on(table.tipoConquistaId),
  periodoIdx: index("conquistas_periodo_idx").on(table.periodoInicio, table.periodoFim),
}));

export type Conquista = typeof conquistas.$inferSelect;
export type InsertConquista = typeof conquistas.$inferInsert;


// ============================================================================
// TABELA DE HISTÓRICO DE PRESENÇA/AUSÊNCIA
// ============================================================================

/**
 * Registro histórico de presença/ausência dos corretores
 * Permite acompanhar quando cada corretor marcou presença/ausência
 * e calcular horas trabalhadas por dia, semana e mês
 */
export const historicoPresenca = mysqlTable("historico_presenca", {
  id: int("id").autoincrement().primaryKey(),
  
  // Relacionamento
  corretorId: int("corretorId").notNull(),
  
  // Tipo de registro
  tipo: mysqlEnum("tipo", ["entrada", "saida"]).notNull(),
  
  // Status anterior e novo (para auditoria)
  statusAnterior: mysqlEnum("statusAnterior", ["presente", "ausente"]).notNull(),
  statusNovo: mysqlEnum("statusNovo", ["presente", "ausente"]).notNull(),
  
  // Origem do registro
  origem: mysqlEnum("origem", [
    "manual",           // Corretor alterou manualmente
    "automatico_fim",   // Sistema marcou ausência no fim do expediente
    "automatico_3h",    // Sistema marcou ausência após 3h sem confirmação
    "sistema"           // Outros registros automáticos
  ]).default("manual").notNull(),
  
  // Data e hora do registro
  dataHora: timestamp("dataHora").defaultNow().notNull(),
  
  // Observações (opcional)
  observacao: text("observacao"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  corretorIdx: index("presenca_corretor_idx").on(table.corretorId),
  dataHoraIdx: index("presenca_data_hora_idx").on(table.dataHora),
  tipoIdx: index("presenca_tipo_idx").on(table.tipo),
  corretorDataIdx: index("presenca_corretor_data_idx").on(table.corretorId, table.dataHora),
}));

export type HistoricoPresenca = typeof historicoPresenca.$inferSelect;
export type InsertHistoricoPresenca = typeof historicoPresenca.$inferInsert;

// ============================================================================
// TABELA DE RESUMO DIÁRIO DE PRESENÇA
// ============================================================================

/**
 * Resumo consolidado de presença por dia
 * Facilita consultas de horas trabalhadas e relatórios
 */
export const resumoPresencaDiaria = mysqlTable("resumo_presenca_diaria", {
  id: int("id").autoincrement().primaryKey(),
  
  // Relacionamento
  corretorId: int("corretorId").notNull(),
  
  // Data do resumo
  data: timestamp("data").notNull(),
  
  // Horários
  primeiraEntrada: timestamp("primeiraEntrada"),
  ultimaSaida: timestamp("ultimaSaida"),
  
  // Totais calculados
  totalMinutosPresente: int("totalMinutosPresente").default(0).notNull(),
  totalMinutosAusente: int("totalMinutosAusente").default(0).notNull(),
  
  // Contadores
  quantidadeEntradas: int("quantidadeEntradas").default(0).notNull(),
  quantidadeSaidas: int("quantidadeSaidas").default(0).notNull(),
  
  // Status do dia
  statusDia: mysqlEnum("statusDia", [
    "presente",         // Trabalhou normalmente
    "ausente",          // Não trabalhou
    "parcial",          // Trabalhou parcialmente
    "fora_expediente"   // Trabalhou fora do horário normal
  ]).default("ausente").notNull(),
  
  // Flags
  trabalhouForaExpediente: boolean("trabalhouForaExpediente").default(false).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  corretorIdx: index("resumo_presenca_corretor_idx").on(table.corretorId),
  dataIdx: index("resumo_presenca_data_idx").on(table.data),
  corretorDataIdx: index("resumo_presenca_corretor_data_idx").on(table.corretorId, table.data),
}));

export type ResumoPresencaDiaria = typeof resumoPresencaDiaria.$inferSelect;
export type InsertResumoPresencaDiaria = typeof resumoPresencaDiaria.$inferInsert;


// ============================================================================
// TABELA DE DISPONIBILIDADE DO CORRETOR (AGENDA)
// ============================================================================

/**
 * Configuração de horários de trabalho do corretor
 * Define os dias e horários em que o corretor está disponível para agendamentos
 */
export const disponibilidadeCorretor = mysqlTable("disponibilidade_corretor", {
  id: int("id").autoincrement().primaryKey(),
  
  // Relacionamento
  corretorId: int("corretorId").notNull(),
  
  // Dia da semana (0 = domingo, 1 = segunda, ..., 6 = sábado)
  diaSemana: int("diaSemana").notNull(),
  
  // Horários de trabalho
  horaInicio: varchar("horaInicio", { length: 5 }).notNull(), // "09:00"
  horaFim: varchar("horaFim", { length: 5 }).notNull(), // "18:00"
  
  // Intervalo de almoço (opcional)
  intervaloInicio: varchar("intervaloInicio", { length: 5 }), // "12:00"
  intervaloFim: varchar("intervaloFim", { length: 5 }), // "13:00"
  
  // Duração padrão de cada slot de agendamento (em minutos)
  duracaoSlot: int("duracaoSlot").default(60).notNull(),
  
  // Status
  ativo: boolean("ativo").default(true).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  corretorIdx: index("disponibilidade_corretor_idx").on(table.corretorId),
  diaIdx: index("disponibilidade_dia_idx").on(table.diaSemana),
}));

export type DisponibilidadeCorretor = typeof disponibilidadeCorretor.$inferSelect;
export type InsertDisponibilidadeCorretor = typeof disponibilidadeCorretor.$inferInsert;

// ============================================================================
// TABELA DE BLOQUEIOS DE AGENDA
// ============================================================================

/**
 * Bloqueios específicos na agenda do corretor
 * Para férias, compromissos pessoais, reuniões, etc.
 */
export const bloqueiosAgenda = mysqlTable("bloqueios_agenda", {
  id: int("id").autoincrement().primaryKey(),
  
  // Relacionamento
  corretorId: int("corretorId").notNull(),
  
  // Período do bloqueio
  dataInicio: timestamp("dataInicio").notNull(),
  dataFim: timestamp("dataFim").notNull(),
  
  // Tipo de bloqueio
  tipo: mysqlEnum("tipo", [
    "ferias",
    "folga",
    "reuniao",
    "compromisso_pessoal",
    "treinamento",
    "outro"
  ]).default("outro").notNull(),
  
  // Descrição
  motivo: varchar("motivo", { length: 255 }),
  
  // Se bloqueia o dia inteiro ou apenas um período
  diaInteiro: boolean("diaInteiro").default(false).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  corretorIdx: index("bloqueios_corretor_idx").on(table.corretorId),
  dataInicioIdx: index("bloqueios_data_inicio_idx").on(table.dataInicio),
  dataFimIdx: index("bloqueios_data_fim_idx").on(table.dataFim),
}));

export type BloqueioAgenda = typeof bloqueiosAgenda.$inferSelect;
export type InsertBloqueioAgenda = typeof bloqueiosAgenda.$inferInsert;

// ============================================================================
// TABELA DE LINKS DE AGENDAMENTO SELF-SERVICE
// ============================================================================

/**
 * Links únicos para agendamento self-service
 * Permite que clientes agendem visitas diretamente
 */
export const linksAgendamento = mysqlTable("links_agendamento", {
  id: int("id").autoincrement().primaryKey(),
  
  // Relacionamentos
  corretorId: int("corretorId").notNull(),
  leadId: int("leadId"), // Opcional - pode ser um link genérico
  projectId: int("projectId"), // Opcional - pode ser específico para um projeto
  
  // Token único para o link
  token: varchar("token", { length: 64 }).notNull().unique(),
  
  // Configurações do link
  titulo: varchar("titulo", { length: 255 }), // Ex: "Agende sua visita ao Residencial XYZ"
  mensagemBoasVindas: text("mensagemBoasVindas"),
  
  // Validade do link
  validoAte: timestamp("validoAte"), // Null = sem expiração
  maxAgendamentos: int("maxAgendamentos"), // Null = ilimitado
  agendamentosRealizados: int("agendamentosRealizados").default(0).notNull(),
  
  // Status
  ativo: boolean("ativo").default(true).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  corretorIdx: index("links_corretor_idx").on(table.corretorId),
  tokenIdx: index("links_token_idx").on(table.token),
}));

export type LinkAgendamento = typeof linksAgendamento.$inferSelect;
export type InsertLinkAgendamento = typeof linksAgendamento.$inferInsert;

// ============================================================================
// TABELA DE CONVERSAS DO CHATBOT
// ============================================================================

/**
 * Registro de conversas do chatbot de pré-qualificação
 */
export const conversasChatbot = mysqlTable("conversas_chatbot", {
  id: int("id").autoincrement().primaryKey(),
  
  // Identificador único da sessão
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),
  
  // Dados coletados do visitante
  nome: varchar("nome", { length: 255 }),
  telefone: varchar("telefone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  
  // Interesse
  projectId: int("projectId"), // Projeto de interesse
  tipoImovel: varchar("tipoImovel", { length: 100 }),
  faixaPreco: varchar("faixaPreco", { length: 100 }),
  regiao: varchar("regiao", { length: 100 }),
  
  // Qualificação
  temRenda: boolean("temRenda"),
  rendaFamiliar: varchar("rendaFamiliar", { length: 100 }),
  temEntrada: boolean("temEntrada"),
  valorEntrada: varchar("valorEntrada", { length: 100 }),
  prazoCompra: varchar("prazoCompra", { length: 100 }), // "imediato", "3_meses", "6_meses", "1_ano"
  
  // Status da conversa
  status: mysqlEnum("status", [
    "em_andamento",
    "qualificado",
    "nao_qualificado",
    "agendamento_solicitado",
    "convertido_lead",
    "abandonado"
  ]).default("em_andamento").notNull(),
  
  // Se foi convertido em lead
  leadId: int("leadId"),
  corretorId: int("corretorId"), // Corretor atribuído
  
  // Histórico de mensagens (JSON)
  historico: text("historico"), // [{role: "bot"|"user", message: string, timestamp: string}]
  
  // Agendamento de retorno
  agendamentoRetorno: timestamp("agendamentoRetorno"),
  
  // Origem
  origem: varchar("origem", { length: 100 }), // URL de onde veio
  dispositivo: varchar("dispositivo", { length: 50 }), // mobile, desktop
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  sessionIdx: index("conversas_session_idx").on(table.sessionId),
  statusIdx: index("conversas_status_idx").on(table.status),
  leadIdx: index("conversas_lead_idx").on(table.leadId),
}));

export type ConversaChatbot = typeof conversasChatbot.$inferSelect;
export type InsertConversaChatbot = typeof conversasChatbot.$inferInsert;

// ============================================================================
// TABELA DE PERGUNTAS FREQUENTES (FAQ) DO CHATBOT
// ============================================================================

/**
 * Base de conhecimento para o chatbot responder perguntas frequentes
 */
export const faqChatbot = mysqlTable("faq_chatbot", {
  id: int("id").autoincrement().primaryKey(),
  
  // Pergunta e resposta
  pergunta: text("pergunta").notNull(),
  resposta: text("resposta").notNull(),
  
  // Palavras-chave para matching
  palavrasChave: text("palavrasChave"), // JSON array de palavras-chave
  
  // Categoria
  categoria: mysqlEnum("categoria", [
    "financiamento",
    "documentacao",
    "visita",
    "preco",
    "localizacao",
    "empreendimento",
    "empresa",
    "geral"
  ]).default("geral").notNull(),
  
  // Projeto específico (opcional)
  projectId: int("projectId"),
  
  // Ordem de prioridade
  prioridade: int("prioridade").default(0).notNull(),
  
  // Status
  ativo: boolean("ativo").default(true).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  categoriaIdx: index("faq_categoria_idx").on(table.categoria),
  projectIdx: index("faq_project_idx").on(table.projectId),
}));

export type FaqChatbot = typeof faqChatbot.$inferSelect;
export type InsertFaqChatbot = typeof faqChatbot.$inferInsert;

// ============================================================================
// TABELA DE PROPOSTAS DIGITAIS
// ============================================================================

/**
 * Propostas digitais interativas geradas para clientes
 */
export const propostas = mysqlTable("propostas", {
  id: int("id").autoincrement().primaryKey(),
  
  // Relacionamentos
  leadId: int("leadId").notNull(),
  corretorId: int("corretorId").notNull(),
  projectId: int("projectId").notNull(),
  
  // Token único para acesso
  token: varchar("token", { length: 64 }).notNull().unique(),
  
  // Dados do cliente na proposta
  nomeCliente: varchar("nomeCliente", { length: 255 }).notNull(),
  emailCliente: varchar("emailCliente", { length: 320 }),
  telefoneCliente: varchar("telefoneCliente", { length: 20 }),
  
  // Dados do imóvel
  unidade: varchar("unidade", { length: 50 }), // Ex: "Apto 101, Torre A"
  tipologia: varchar("tipologia", { length: 100 }), // Ex: "2 dormitórios, 1 suíte"
  metragem: int("metragem"), // m²
  
  // Valores
  valorImovel: int("valorImovel").notNull(), // em centavos
  valorEntrada: int("valorEntrada"), // em centavos
  valorFinanciamento: int("valorFinanciamento"), // em centavos
  parcelas: int("parcelas"),
  valorParcela: int("valorParcela"), // em centavos
  taxaJuros: varchar("taxaJuros", { length: 20 }), // Ex: "9.5% a.a."
  
  // Condições especiais
  desconto: int("desconto"), // em centavos
  motivoDesconto: varchar("motivoDesconto", { length: 255 }),
  
  // Conteúdo personalizado
  mensagemPersonalizada: text("mensagemPersonalizada"),
  
  // Tabela de pagamento (JSON array de parcelas)
  tabelaPagamento: text("tabelaPagamento"),
  
  // Imagens selecionadas (JSON array de URLs)
  imagensSelecionadas: text("imagensSelecionadas"),
  
  // Plantas selecionadas (JSON array de URLs)
  plantasSelecionadas: text("plantasSelecionadas"),
  
  // Vídeos (JSON array de URLs)
  videos: text("videos"),
  
  // Validade da proposta
  validoAte: timestamp("validoAte"),
  
  // Status
  status: mysqlEnum("status", [
    "rascunho",
    "enviada",
    "visualizada",
    "aceita",
    "recusada",
    "expirada"
  ]).default("rascunho").notNull(),
  
  // Tracking
  visualizacoes: int("visualizacoes").default(0).notNull(),
  primeiraVisualizacao: timestamp("primeiraVisualizacao"),
  ultimaVisualizacao: timestamp("ultimaVisualizacao"),
  
  // Aceite digital
  aceiteEm: timestamp("aceiteEm"),
  ipAceite: varchar("ipAceite", { length: 45 }),
  assinaturaDigital: text("assinaturaDigital"), // Base64 da assinatura
  
  // URL do PDF gerado
  pdfUrl: text("pdfUrl"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  leadIdx: index("propostas_lead_idx").on(table.leadId),
  corretorIdx: index("propostas_corretor_idx").on(table.corretorId),
  projectIdx: index("propostas_project_idx").on(table.projectId),
  tokenIdx: index("propostas_token_idx").on(table.token),
  statusIdx: index("propostas_status_idx").on(table.status),
}));

export type Proposta = typeof propostas.$inferSelect;
export type InsertProposta = typeof propostas.$inferInsert;

// Tabela para rastrear visitantes únicos de propostas
export const propostasVisitantes = mysqlTable("propostas_visitantes", {
  id: int("id").primaryKey().autoincrement(),
  propostaId: int("propostaId").notNull(),
  visitorId: varchar("visitorId", { length: 64 }).notNull(), // Hash do IP + User-Agent ou cookie
  ip: varchar("ip", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  propostaIdx: index("propostas_visitantes_proposta_idx").on(table.propostaId),
  visitorIdx: index("propostas_visitantes_visitor_idx").on(table.visitorId),
  uniqueVisitor: index("propostas_visitantes_unique").on(table.propostaId, table.visitorId),
}));

export type PropostaVisitante = typeof propostasVisitantes.$inferSelect;
export type InsertPropostaVisitante = typeof propostasVisitantes.$inferInsert;

// ============================================================================
// TABELA DE INDICAÇÕES
// ============================================================================

export const indicacoes = mysqlTable("indicacoes", {
  id: int("id").primaryKey().autoincrement(),
  indicadorId: int("indicadorId").notNull(), // ID do usuário que indicou
  indicadoId: int("indicadoId").notNull(), // ID do usuário indicado
  codigoUsado: varchar("codigoUsado", { length: 20 }).notNull(), // Código de indicação usado
  
  // Status da indicação
  status: mysqlEnum("status", [
    "pendente",      // Usuário se cadastrou mas ainda não completou onboarding
    "confirmada",    // Usuário completou cadastro e está ativo
    "bonus_pago",    // Bônus foi pago ao indicador
    "cancelada"      // Indicação cancelada (usuário inativo)
  ]).default("pendente").notNull(),
  
  // Valor do bônus
  valorBonus: int("valorBonus").default(50000).notNull(), // R$ 500,00 em centavos
  dataPagamento: timestamp("dataPagamento"),
  
  // Tracking
  ip: varchar("ip", { length: 45 }),
  userAgent: text("userAgent"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  indicadorIdx: index("indicacoes_indicador_idx").on(table.indicadorId),
  indicadoIdx: index("indicacoes_indicado_idx").on(table.indicadoId),
  statusIdx: index("indicacoes_status_idx").on(table.status),
}));

export type Indicacao = typeof indicacoes.$inferSelect;
export type InsertIndicacao = typeof indicacoes.$inferInsert;

// ============================================================================
// TABELA DE CONFIGURAÇÃO DO PROJETO FOCO DO MÊS
// ============================================================================

/**
 * Tabela: desbloqueio_corretor
 * Registra quando um corretor foi desbloqueado (manual ou automático)
 * Usado para gamificação e controle de acesso às abas
 */
export const desbloqueioCorretor = mysqlTable("desbloqueio_corretor", {
  id: int("id").primaryKey().autoincrement(),
  corretorId: int("corretor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  data: date("data").notNull(), // Data do desbloqueio
  desbloqueadoPor: int("desbloqueado_por").references(() => users.id), // Gestor que desbloqueou (null = desbloqueio automático)
  motivo: text("motivo"), // Motivo do desbloqueio manual
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const configuracaoProjetoFoco = mysqlTable("configuracao_projeto_foco", {
  id: int("id").primaryKey().autoincrement(),
  
  // Projeto foco atual
  projetoId: int("projetoId"), // NULL = nenhum projeto foco ativo
  
  // Corretores na fila do projeto foco (JSON array de IDs)
  corretoresIds: json("corretoresIds").$type<number[]>(),
  
  // Posição atual na fila foco (para round-robin)
  posicaoAtual: int("posicaoAtual").default(0).notNull(),
  
  // Metadata
  ativo: boolean("ativo").default(true).notNull(),
  observacoes: text("observacoes"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  projetoIdx: index("config_projeto_foco_projeto_idx").on(table.projetoId),
}));

export type ConfiguracaoProjetoFoco = typeof configuracaoProjetoFoco.$inferSelect;
export type InsertConfiguracaoProjetoFoco = typeof configuracaoProjetoFoco.$inferInsert;

// ============================================================================
// ESTOQUE DE LEADS (FILA DE ESPERA)
// ============================================================================

/**
 * Tabela para armazenar leads que não puderam ser distribuídos
 * por falta de corretores disponíveis.
 * 
 * Leads ficam em estoque até que:
 * - Um corretor fique disponível (automático a cada 5 min)
 * - Gestor force distribuição manual
 */
export const leadEstoque = mysqlTable("lead_estoque", {
  id: int("id").primaryKey().autoincrement(),
  
  // Lead em estoque
  leadId: int("leadId").notNull().references(() => leads.id, { onDelete: "cascade" }),
  
  // Tipo de fila (normal ou foco)
  tipoFila: mysqlEnum("tipoFila", ["normal", "foco"]).default("normal").notNull(),
  
  // Motivo de estar em estoque
  motivoEstoque: text("motivoEstoque"), // Ex: "Nenhum corretor disponível", "Limite diário atingido"
  
  // Tentativas de redistribuição
  tentativasDistribuicao: int("tentativasDistribuicao").default(0).notNull(),
  ultimaTentativa: timestamp("ultimaTentativa"),
  
  // Status do estoque
  status: mysqlEnum("status", ["aguardando", "distribuido", "cancelado"]).default("aguardando").notNull(),
  
  // Metadata
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
  distribuidoEm: timestamp("distribuidoEm"),
  distribuidoParaCorretorId: int("distribuidoParaCorretorId"),
}, (table) => ({
  leadIdx: index("lead_estoque_lead_idx").on(table.leadId),
  statusIdx: index("lead_estoque_status_idx").on(table.status),
  tipoFilaIdx: index("lead_estoque_tipo_fila_idx").on(table.tipoFila),
}));

export type LeadEstoque = typeof leadEstoque.$inferSelect;
export type InsertLeadEstoque = typeof leadEstoque.$inferInsert;
