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
  fotoUrl: text("fotoUrl"), // URL da foto de perfil do corretor
  
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
  
  // Lixeira - leads perdidos ficam aqui
  naLixeira: boolean("naLixeira").default(false).notNull(),
  dataMovidoLixeira: timestamp("dataMovidoLixeira"),
  corretorAnteriorId: int("corretorAnteriorId"), // Guarda o corretor que perdeu o lead
  
  // Campos do Facebook Lead Ads
  campanha: varchar("campanha", { length: 255 }), // Nome da campanha (campaign_name)
  faixaRenda: varchar("faixaRenda", { length: 100 }), // Faixa de renda (faixa_de_renda)
  prefereContatoPor: varchar("prefereContatoPor", { length: 50 }), // Preferência de contato (prefere_falar_por)
  dataHoraCriacao: timestamp("dataHoraCriacao"), // Data/hora de criação no Facebook (created_time)
  
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
  
  // Projeto padrão para leads recebidos
  projectIdPadrao: int("projectIdPadrao"),
  
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
  tentativaAtual: int("tentativaAtual").default(1).notNull(), // 1 a 5
  maxTentativas: int("maxTentativas").default(5).notNull(),
  
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
