import { eq, and, desc, asc, sql, gte, lte, lt, inArray, notInArray, gt, or, isNull, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  projects, InsertProject, Project,
  projectSuggestions, InsertProjectSuggestion, ProjectSuggestion,
  properties, InsertProperty, Property,
  leads, InsertLead, Lead,
  leadHistory, InsertLeadHistory,
  leadStatusTransitions, InsertLeadStatusTransition, LeadStatusTransition,
  agendamentos, InsertAgendamento, Agendamento,
  visitas, InsertVisita, Visita,
  distributionLog, InsertDistributionLog,
  conversionStats, InsertConversionStats,
  quickMessages, InsertQuickMessage,
  notifications, InsertNotification,
  metas, InsertMeta, Meta,
  filaDistribuicao, InsertFilaDistribuicao, FilaDistribuicao,
  configuracaoProjetoFoco, InsertConfiguracaoProjetoFoco, ConfiguracaoProjetoFoco,
  webhookConfig, InsertWebhookConfig, WebhookConfig,
  tarefas, InsertTarefa, Tarefa,
  followUps, InsertFollowUp, FollowUp,
  atividadesDiarias, InsertAtividadeDiaria, AtividadeDiaria,
  metasDiarias, InsertMetaDiaria, MetaDiaria,
  configuracaoPontuacao, InsertConfiguracaoPontuacao, ConfiguracaoPontuacao,
  alertasProdutividade, InsertAlertaProdutividade, AlertaProdutividade,
  tiposConquista, TipoConquista, InsertTipoConquista,
  conquistas, Conquista, InsertConquista,
  disponibilidadeCorretor, InsertDisponibilidadeCorretor, DisponibilidadeCorretor,
  bloqueiosAgenda, InsertBloqueioAgenda, BloqueioAgenda,
  linksAgendamento, InsertLinkAgendamento, LinkAgendamento,
  conversasChatbot, InsertConversaChatbot, ConversaChatbot,
  faqChatbot, InsertFaqChatbot, FaqChatbot,
  propostas, InsertProposta, Proposta,
  propostasVisitantes, InsertPropostaVisitante, PropostaVisitante,
  logTransferencias,
  interacoes, InsertInteracao, Interacao,
  documentacoes, InsertDocumentacao, Documentacao,
  analises_credito, InsertAnaliseCredito, AnaliseCredito,
  contratos, InsertContrato, Contrato,
  metasGlobais,
  equipes
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { appendLead } from './googleSheetsSync';

// Função helper para sincronizar lead com Google Sheets (não bloqueia)
async function syncLeadToGoogleSheets(lead: Lead) {
  try {
    // Buscar nome do corretor e projeto para a planilha
    const db = await getDb();
    if (!db) return;
    
    let corretorNome = '';
    let projetoNome = '';
    
    if (lead.corretorId) {
      const corretor = await db.select({ name: users.name }).from(users).where(eq(users.id, lead.corretorId)).limit(1);
      corretorNome = corretor[0]?.name || '';
    }
    
    if (lead.projectId) {
      const projeto = await db.select({ nome: projects.nome }).from(projects).where(eq(projects.id, lead.projectId)).limit(1);
      projetoNome = projeto[0]?.nome || '';
    }
    
    await appendLead({
      id: lead.id,
      createdAt: lead.createdAt,
      nome: lead.nome,
      email: lead.email,
      telefone: lead.telefone,
      cpf: lead.cpf,
      origem: lead.origem,
      projetoNome,
      corretorNome,
      status: lead.status,
      dataDistribuicao: lead.dataDistribuicao,
      ultimoContato: lead.ultimoContato,
      observacoes: lead.observacoes,
      campanha: lead.campanha,
      faixaRenda: lead.faixaRenda,
    });
  } catch (err: any) {
    console.error('[GoogleSheets] Erro ao sincronizar lead:', err.message);
  }
}

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================================================
// USUÁRIOS
// ============================================================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "telefone"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      // Para o owner, só define admin se for um novo usuário (insert)
      // Não sobrescreve o role existente no update
      values.role = 'admin';
      // NÃO adiciona role ao updateSet - preserva o role existente no banco
    }
    if (user.status !== undefined) {
      values.status = user.status;
      updateSet.status = user.status;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllCorretores() {
  const db = await getDb();
  if (!db) return [];
  
  const corretores = await db.select().from(users).where(eq(users.role, "corretor"));
  
  // Mapear 'name' para 'nome' para compatibilidade com o frontend
  return corretores.map(c => ({
    ...c,
    nome: c.name
  }));
}

export async function getCorretoresPresentes() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(users)
    .where(and(
      eq(users.role, "corretor"),
      eq(users.status, "presente")
    ));
}

export async function updateUserStatus(userId: number, status: "presente" | "ausente") {
  const db = await getDb();
  if (!db) return;
  
  await db.update(users)
    .set({ status, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function updateLimiteDiarioLeads(userId: number, limite: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(users)
    .set({ limiteDiarioLeads: limite, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function updateLimiteDiarioWebhook(userId: number, limite: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(users)
    .set({ limiteDiarioWebhook: limite, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function updateUser(userId: number, data: Partial<typeof users.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function countLeadsRecebidosHoje(corretorId: number, dataInicio?: Date) {
  const db = await getDb();
  if (!db) return 0;
  
  // Importar funções de timezone
  const { inicioDoDiaHoje, fimDoDiaHoje, inicioDoDia, fimDoDia } = await import('./timezone');
  
  // Se não passar data, usar hoje no fuso de São Paulo
  const dataInicioSP = dataInicio ? inicioDoDia(dataInicio) : inicioDoDiaHoje();
  const dataFimSP = dataInicio ? fimDoDia(dataInicio) : fimDoDiaHoje();
  
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(leads)
    .where(
      and(
        eq(leads.corretorId, corretorId),
        gte(leads.createdAt, dataInicioSP),
        lte(leads.createdAt, dataFimSP)
      )
    );
  
  return result[0]?.count || 0;
}

/**
 * Conta leads recebidos via webhook (facebook, site, etc.) hoje
 * Exclui leads de captação própria do corretor
 */
export async function countLeadsWebhookRecebidosHoje(corretorId: number, dataInicio?: Date) {
  const db = await getDb();
  if (!db) return 0;
  
  // Importar funções de timezone
  const { inicioDoDiaHoje, fimDoDiaHoje, inicioDoDia, fimDoDia } = await import('./timezone');
  
  // Se não passar data, usar hoje no fuso de São Paulo
  const dataInicioSP = dataInicio ? inicioDoDia(dataInicio) : inicioDoDiaHoje();
  const dataFimSP = dataInicio ? fimDoDia(dataInicio) : fimDoDiaHoje();
  
  // Origens consideradas como webhook (não inclui captacao_corretor)
  const origensWebhook = ['facebook', 'google_sheets', 'site', 'whatsapp', 'telefone', 'plantao', 'agendamento_self_service', 'chatbot', 'outro'];
  
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(leads)
    .where(
      and(
        eq(leads.corretorId, corretorId),
        gte(leads.createdAt, dataInicioSP),
        lte(leads.createdAt, dataFimSP),
        sql`${leads.origem} IN (${sql.join(origensWebhook.map(o => sql`${o}`), sql`, `)})`
      )
    );
  
  return result[0]?.count || 0;
}

export async function createCorretor(data: {
  name: string;
  email?: string;
  telefone?: string;
  status?: "presente" | "ausente";
  fotoUrl?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Gera um openId temporário para corretores criados manualmente
  const openId = `corretor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const result = await db.insert(users).values({
    openId,
    name: data.name,
    email: data.email || null,
    telefone: data.telefone || null,
    role: "corretor",
    status: data.status || "ausente",
    fotoUrl: data.fotoUrl || null,
  });
  
  return result;
}

export async function updateCorretor(id: number, data: {
  name?: string;
  email?: string;
  telefone?: string;
  status?: "presente" | "ausente";
  fotoUrl?: string;
  // Dados pessoais
  cpf?: string;
  dataNascimento?: Date | null;
  // Dados profissionais
  creci?: string;
  dataCredenciamento?: Date | null;
  dataDescredenciamento?: Date | null;
  situacao?: "ativo" | "inativo";
  // Endereço
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id));
}

export async function updateCorretorFoto(id: number, fotoUrl: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users)
    .set({ fotoUrl, updatedAt: new Date() })
    .where(eq(users.id, id));
}

export async function deleteCorretor(id: number, redistribuirLeads: boolean = false) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Verifica se o corretor tem leads atribuídos
  const leadsDoCorretor = await db.select()
    .from(leads)
    .where(eq(leads.corretorId, id));
  
  const leadsCount = leadsDoCorretor.length;
  
  if (leadsCount > 0) {
    if (!redistribuirLeads) {
      throw new Error(`Corretor possui ${leadsCount} lead(s) atribuído(s). Use a opção de redistribuir leads para excluir.`);
    }
    
    // Redistribuir leads para outros corretores
    const leadsRedistribuidos = await redistribuirLeadsDoCorretor(id);
    console.log(`[DeleteCorretor] ${leadsRedistribuidos} leads redistribuídos do corretor ${id}`);
  }
  
  // Remover corretor da fila de distribuição
  await db.delete(filaDistribuicao).where(eq(filaDistribuicao.corretorId, id));
  
  // Excluir o corretor
  await db.delete(users).where(eq(users.id, id));
  
  return { leadsRedistribuidos: leadsCount };
}

/**
 * Redistribui todos os leads de um corretor para outros corretores disponíveis
 * Usa a roleta para distribuição justa
 */
export async function redistribuirLeadsDoCorretor(corretorId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar todos os leads do corretor (exceto perdidos e contratos fechados)
  const leadsDoCorretor = await db.select()
    .from(leads)
    .where(and(
      eq(leads.corretorId, corretorId),
      notInArray(leads.status, ['perdido', 'contrato_fechado'])
    ));
  
  if (leadsDoCorretor.length === 0) {
    // Se só tem leads perdidos/fechados, apenas desvincula
    await db.update(leads)
      .set({ corretorId: null })
      .where(eq(leads.corretorId, corretorId));
    return 0;
  }
  
  // Buscar outros corretores disponíveis (presentes)
  const outrosCorretores = await db.select()
    .from(users)
    .where(and(
      inArray(users.role, ['corretor', 'gestor']),
      eq(users.status, 'presente'),
      sql`${users.id} != ${corretorId}`
    ));
  
  if (outrosCorretores.length === 0) {
    // Se não há outros corretores, buscar qualquer corretor (mesmo ausente)
    const todosCorretores = await db.select()
      .from(users)
      .where(and(
        inArray(users.role, ['corretor', 'gestor']),
        sql`${users.id} != ${corretorId}`
      ));
    
    if (todosCorretores.length === 0) {
      // Se realmente não há outros corretores, desvincular leads
      await db.update(leads)
        .set({ corretorId: null })
        .where(eq(leads.corretorId, corretorId));
      return leadsDoCorretor.length;
    }
    
    outrosCorretores.push(...todosCorretores);
  }
  
  // Distribuir leads de forma rotativa entre os corretores disponíveis
  let corretorIndex = 0;
  for (const lead of leadsDoCorretor) {
    const novoCorretor = outrosCorretores[corretorIndex % outrosCorretores.length];
    
    // Atualizar o lead com o novo corretor
    await db.update(leads)
      .set({ 
        corretorId: novoCorretor.id,
        dataDistribuicao: new Date()
      })
      .where(eq(leads.id, lead.id));
    
    // Registrar no log de distribuição
    await db.insert(distributionLog).values({
      leadId: lead.id,
      corretorId: novoCorretor.id,
      tipo: 'manual',
      motivo: `Redistribuição automática - corretor anterior excluído`,
    });
    
    corretorIndex++;
  }
  
  // Desvincular leads perdidos/fechados (manter histórico mas sem corretor)
  await db.update(leads)
    .set({ corretorId: null })
    .where(and(
      eq(leads.corretorId, corretorId),
      inArray(leads.status, ['perdido', 'contrato_fechado'])
    ));
  
  return leadsDoCorretor.length;
}

/**
 * Conta quantos leads um corretor possui
 */
export async function countLeadsByCorretor(corretorId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(eq(leads.corretorId, corretorId));
  
  return Number(result[0]?.count) || 0;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

/**
 * Buscar corretores por IDs (para filtro de equipe)
 */
export async function getCorretoresByIds(ids: number[]) {
  const db = await getDb();
  if (!db) return [];
  if (ids.length === 0) return [];
  
  const corretores = await db.select().from(users)
    .where(and(
      eq(users.role, "corretor"),
      inArray(users.id, ids)
    ));
  
  // Mapear 'name' para 'nome' para compatibilidade com o frontend
  return corretores.map(c => ({
    ...c,
    nome: c.name
  }));
}

/**
 * Buscar usuários por IDs (para filtro de equipe)
 */
export async function getUsersByIds(ids: number[]) {
  const db = await getDb();
  if (!db) return [];
  if (ids.length === 0) return [];
  
  return await db.select().from(users)
    .where(inArray(users.id, ids))
    .orderBy(desc(users.createdAt));
}

// ============================================================================
// PROJETOS
// ============================================================================

export async function createProject(project: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(projects).values(project);
  return result;
}

export async function getAllProjects() {
  const db = await getDb();
  if (!db) return [];
  
  // Importar construtoras do schema
  const { construtoras } = await import('../drizzle/schema');
  const { getTableColumns } = await import('drizzle-orm');
  
  // Fazer LEFT JOIN com construtoras para trazer o logoUrl e nome
  const result = await db
    .select({
      ...getTableColumns(projects),
      logoUrl: construtoras.logoUrl,
      construtoraName: construtoras.nome,
    })
    .from(projects)
    .leftJoin(construtoras, eq(projects.construtoraId, construtoras.id))
    .orderBy(desc(projects.createdAt));
  
  return result;
}

export async function getProjectsForMap() {
  const db = await getDb();
  if (!db) return [];
  
  const { construtoras } = await import('../drizzle/schema');
  
  // Query otimizada: apenas campos necessários para o mapa
  const result = await db
    .select({
      id: projects.id,
      nome: projects.nome,
      construtora: projects.construtora,
      endereco: projects.endereco,
      bairro: projects.bairro,
      cidade: projects.cidade,
      zona: projects.zona,
      status: projects.status,
      dormitorios: projects.dormitorios,
      valorMinimo: projects.valorMinimo,
      vagas: projects.vagas,
      enquadramento: projects.enquadramento,
      latitude: projects.latitude,
      longitude: projects.longitude,
      logoUrl: construtoras.logoUrl,
      construtoraName: construtoras.nome,
    })
    .from(projects)
    .leftJoin(construtoras, eq(projects.construtoraId, construtoras.id))
    .where(
      and(
        isNotNull(projects.latitude),
        isNotNull(projects.longitude)
      )
    );
  
  return result;
}

export async function getProjectById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateProject(id: number, data: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projects.id, id));
}

export async function deleteProject(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(projects).where(eq(projects.id, id));
}

// Função para atualizar o book URL de um projeto
export async function updateProjectBook(projectId: number, bookUrl: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(projects)
    .set({ bookUrl, updatedAt: new Date() })
    .where(eq(projects.id, projectId));
}

// ============================================================================
// SUGESTÕES DE PROJETOS
// ============================================================================

export async function createProjectSuggestion(suggestion: InsertProjectSuggestion) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(projectSuggestions).values(suggestion);
  return Number(result[0].insertId);
}

export async function getPendingProjectSuggestions() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(projectSuggestions)
    .where(eq(projectSuggestions.status, "pendente"))
    .orderBy(desc(projectSuggestions.createdAt));
}

export async function getProjectSuggestionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select()
    .from(projectSuggestions)
    .where(eq(projectSuggestions.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getProjectSuggestionsByCorretor(corretorId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(projectSuggestions)
    .where(eq(projectSuggestions.corretorId, corretorId))
    .orderBy(desc(projectSuggestions.createdAt));
}

export async function approveProjectSuggestion(suggestionId: number, gestorId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar a sugestão
  const suggestion = await getProjectSuggestionById(suggestionId);
  if (!suggestion) throw new Error("Sugestão não encontrada");
  
  // Criar o projeto com os dados da sugestão
  const projectData: InsertProject = {
    nome: suggestion.nome,
    construtora: suggestion.construtora,
    endereco: suggestion.endereco,
    bairro: suggestion.bairro,
    cidade: suggestion.cidade,
    estado: suggestion.estado,
    descricao: suggestion.descricao,
    tipo: suggestion.tipo,
    valorMinimo: suggestion.valorMinimo,
    valorMaximo: suggestion.valorMaximo,
    metragemMinima: suggestion.metragemMinima,
    metragemMaxima: suggestion.metragemMaxima,
    dormitorios: suggestion.dormitorios,
    zona: suggestion.zona,
    status: "ativo"
  };
  
  await db.insert(projects).values(projectData);
  
  // Atualizar status da sugestão
  await db.update(projectSuggestions)
    .set({
      status: "aprovado",
      aprovadoPor: gestorId,
      dataAprovacao: new Date(),
      updatedAt: new Date()
    })
    .where(eq(projectSuggestions.id, suggestionId));
  
  return suggestion;
}

export async function rejectProjectSuggestion(suggestionId: number, gestorId: number, motivo: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(projectSuggestions)
    .set({
      status: "reprovado",
      aprovadoPor: gestorId,
      motivoReprovacao: motivo,
      dataAprovacao: new Date(),
      updatedAt: new Date()
    })
    .where(eq(projectSuggestions.id, suggestionId));
}

export async function deleteProjectSuggestion(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(projectSuggestions).where(eq(projectSuggestions.id, id));
}

// ============================================================================
// UNIDADES (PROPERTIES)
// ============================================================================

export async function createProperty(property: InsertProperty) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(properties).values(property);
  return result;
}

export async function getPropertiesByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(properties).where(eq(properties.projectId, projectId));
}

// ============================================================================
// LEADS
// ============================================================================

/**
 * Normaliza telefone removendo todos os caracteres não-numéricos
 * Retorna os últimos 9 dígitos (número sem DDD internacional)
 */
function normalizarTelefone(telefone: string): string {
  // Remove todos os caracteres não-numéricos
  const apenasDigitos = telefone.replace(/\D/g, '');
  
  // Se começa com 55 (Brasil) e tem mais de 11 dígitos, remove o 55
  if (apenasDigitos.startsWith('55') && apenasDigitos.length > 11) {
    return apenasDigitos.slice(2);
  }
  
  return apenasDigitos;
}

/**
 * Verifica se já existe um lead com o mesmo telefone, email ou CPF
 * Telefone é normalizado para comparar independente do formato
 */
export async function checkLeadDuplicado(
  telefone?: string | null,
  email?: string | null,
  cpf?: string | null
): Promise<{ isDuplicate: boolean; reason?: string; leadId?: number }> {
  const db = await getDb();
  if (!db) return { isDuplicate: false };
  
  // Verificar telefone duplicado (se fornecido e não vazio)
  if (telefone && telefone.trim()) {
    const telefoneNormalizado = normalizarTelefone(telefone);
    // Pegar os últimos 9 dígitos (número do celular sem DDD)
    const ultimosDigitos = telefoneNormalizado.slice(-9);
    
    if (ultimosDigitos.length >= 8) {
      // Busca comparando os últimos 9 dígitos do telefone armazenado
      const [existingByPhone] = await db
        .select({ id: leads.id, nome: leads.nome, telefone: leads.telefone })
        .from(leads)
        .where(sql`RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${leads.telefone}, '(', ''), ')', ''), '-', ''), ' ', ''), '+', ''), '55', ''), 9) = ${ultimosDigitos}`)
        .limit(1);
      
      if (existingByPhone) {
        return { isDuplicate: true, reason: `Já existe um lead com este telefone: ${existingByPhone.nome} (${existingByPhone.telefone})`, leadId: existingByPhone.id };
      }
    }
  }
  
  // Verificar email duplicado (se fornecido e não vazio)
  if (email && email.trim()) {
    const [existingByEmail] = await db
      .select({ id: leads.id, nome: leads.nome })
      .from(leads)
      .where(eq(leads.email, email.trim().toLowerCase()))
      .limit(1);
    
    if (existingByEmail) {
      return { isDuplicate: true, reason: `Já existe um lead com este email (${existingByEmail.nome})` };
    }
  }
  
  // Verificar CPF duplicado (se fornecido e não vazio)
  if (cpf && cpf.trim()) {
    const cpfNormalizado = cpf.replace(/\D/g, ''); // Remove não-dígitos
    if (cpfNormalizado.length === 11) {
      const [existingByCpf] = await db
        .select({ id: leads.id, nome: leads.nome })
        .from(leads)
        .where(sql`REPLACE(REPLACE(${leads.cpf}, '.', ''), '-', '') = ${cpfNormalizado}`)
        .limit(1);
      
      if (existingByCpf) {
        return { isDuplicate: true, reason: `Já existe um lead com este CPF (${existingByCpf.nome})` };
      }
    }
  }
  
  return { isDuplicate: false };
}

export async function createLead(lead: InsertLead) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Validar leads duplicados por telefone, email ou CPF
  const duplicateCheck = await checkLeadDuplicado(lead.telefone, lead.email, lead.cpf);
  if (duplicateCheck.isDuplicate) {
    throw new Error(`Lead duplicado: ${duplicateCheck.reason}`);
  }
  
  const result = await db.insert(leads).values(lead);
  const insertId = Number(result[0].insertId);
  
  // Retornar o lead criado
  const createdLead = await getLeadById(insertId);
  if (!createdLead) throw new Error("Failed to retrieve created lead");
  
  // Sincronizar com Google Sheets (async, não bloqueia)
  syncLeadToGoogleSheets(createdLead);
  
  return createdLead;
}

export async function getAllLeads(options?: {
  page?: number;
  limit?: number;
  searchTerm?: string;
  status?: string;
  projectId?: number;
  origem?: string;
  corretorId?: number;
  corretoresIds?: number[] | null; // Filtro por equipe
  dataInicio?: string;
  dataFim?: string;
}) {
  const db = await getDb();
  if (!db) return { leads: [], total: 0, page: 1, limit: 50, totalPages: 0 };
  
  const page = options?.page || 1;
  const limit = options?.limit || 50;
  const offset = (page - 1) * limit;
  
  // Construir condições de filtro
  const conditions: any[] = [];
  
  // Filtro por equipe (corretoresIds)
  if (options?.corretoresIds && options.corretoresIds.length > 0) {
    conditions.push(inArray(leads.corretorId, options.corretoresIds));
  }
  
  // Busca por nome, telefone ou email
  if (options?.searchTerm) {
    const searchLower = `%${options.searchTerm.toLowerCase()}%`;
    conditions.push(
      or(
        sql`LOWER(${leads.nome}) LIKE ${searchLower}`,
        sql`LOWER(${leads.telefone}) LIKE ${searchLower}`,
        sql`LOWER(${leads.email}) LIKE ${searchLower}`
      )
    );
  }
  
  // Filtro por status
  if (options?.status) {
    conditions.push(eq(leads.status, options.status));
  }
  
  // Filtro por projeto
  if (options?.projectId) {
    conditions.push(eq(leads.projectId, options.projectId));
  }
  
  // Filtro por origem
  if (options?.origem) {
    conditions.push(eq(leads.origem, options.origem));
  }
  
  // Filtro por corretor específico (quando selecionado no dropdown)
  if (options?.corretorId) {
    conditions.push(eq(leads.corretorId, options.corretorId));
  }
  
  // Filtro por data
  if (options?.dataInicio) {
    conditions.push(gte(leads.createdAt, new Date(options.dataInicio)));
  }
  if (options?.dataFim) {
    const dataFimDate = new Date(options.dataFim);
    dataFimDate.setHours(23, 59, 59, 999);
    conditions.push(lte(leads.createdAt, dataFimDate));
  }
  
  // Query base
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  // Contar total de leads
  const countResult = await db.select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(whereClause);
  const total = Number(countResult[0]?.count || 0);
  
  // Buscar leads com paginação e nome do corretor
  // Ordenar com prioridade:
  // 1. Facebook ADS + Aguardando Atendimento (mais recentes primeiro)
  // 2. Aguardando Atendimento sem ADS (mais recentes primeiro)
  // 3. Facebook ADS + Em Atendimento (mais recentes primeiro)
  // 4. Demais leads (mais recentes primeiro)
  const leadsResult = await db.select({
    ...leads,
    corretorNome: users.name,
  }).from(leads)
    .leftJoin(users, eq(leads.corretorId, users.id))
    .where(whereClause)
    .orderBy(
      sql`CASE 
        WHEN ${leads.origemWebhook} = 1 AND ${leads.status} = 'aguardando_atendimento' THEN 1
        WHEN ${leads.origemWebhook} = 0 AND ${leads.status} = 'aguardando_atendimento' THEN 2
        WHEN ${leads.origemWebhook} = 1 AND ${leads.status} = 'em_atendimento' THEN 3
        ELSE 4
      END`,
      desc(leads.createdAt)
    )
    .limit(limit)
    .offset(offset);
  
  return {
    leads: leadsResult,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

export async function getLeadsByCorretor(corretorId: number, options?: {
  page?: number;
  limit?: number;
  searchTerm?: string;
  status?: string;
  projectId?: number;
  origem?: string;
  dataInicio?: string;
  dataFim?: string;
}) {
  const db = await getDb();
  if (!db) return { leads: [], total: 0 };
  
  const page = options?.page || 1;
  const limit = options?.limit || 50;
  const offset = (page - 1) * limit;
  
  // Construir condições de filtro
  const conditions = [eq(leads.corretorId, corretorId)];
  
  // Busca por nome, telefone ou email
  if (options?.searchTerm) {
    const searchLower = `%${options.searchTerm.toLowerCase()}%`;
    conditions.push(
      or(
        sql`LOWER(${leads.nome}) LIKE ${searchLower}`,
        sql`${leads.telefone} LIKE ${searchLower}`,
        sql`LOWER(${leads.email}) LIKE ${searchLower}`
      )!
    );
  }
  
  // Filtro por status
  if (options?.status && options.status !== 'all') {
    conditions.push(eq(leads.status, options.status));
  }
  
  // Filtro por projeto
  if (options?.projectId) {
    conditions.push(eq(leads.projectId, options.projectId));
  }
  
  // Filtro por origem
  if (options?.origem && options.origem !== 'all') {
    conditions.push(eq(leads.origem, options.origem));
  }
  
  // Filtro por data de criação
  if (options?.dataInicio) {
    conditions.push(gte(leads.createdAt, new Date(options.dataInicio)));
  }
  if (options?.dataFim) {
    const endDate = new Date(options.dataFim);
    endDate.setHours(23, 59, 59, 999);
    conditions.push(lte(leads.createdAt, endDate));
  }
  
  // Buscar total de leads com filtros
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(and(...conditions));
  
  const total = Number(countResult?.count || 0);
  
  // Buscar leads paginados com filtros
  // Ordenação prioritária:
  // 1. Leads Facebook (origem='facebook') + Status 'Aguardando Atendimento' (mais urgentes no topo)
  // 2. Outros leads por webhook (origemWebhook=true)
  // 3. Demais leads por data de criação
  const leadsData = await db.select().from(leads)
    .where(and(...conditions))
    .orderBy(
      desc(sql`CASE WHEN ${leads.origem} = 'facebook' AND ${leads.status} = 'aguardando_atendimento' THEN 1 ELSE 0 END`),
      desc(leads.origemWebhook),
      desc(leads.createdAt)
    )
    .limit(limit)
    .offset(offset);
  
  return { leads: leadsData, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Busca novos leads via webhook de um corretor desde um timestamp
 * Usado para notificação em tempo real
 */
export async function getNewWebhookLeadsSince(corretorId: number, since: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select({
      id: leads.id,
      nome: leads.nome,
      telefone: leads.telefone,
      email: leads.email,
      projectId: leads.projectId,
      projectNome: projects.nome,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .leftJoin(projects, eq(leads.projectId, projects.id))
    .where(
      and(
        eq(leads.corretorId, corretorId),
        eq(leads.origemWebhook, true),
        gt(leads.createdAt, since)
      )
    )
    .orderBy(leads.createdAt);

  return result;
}

export async function getLeadById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateLead(id: number, data: Partial<InsertLead>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Se está mudando o status, registrar a transição
  if (data.status) {
    // Buscar o lead atual para pegar o status anterior e corretorId
    const leadAtual = await getLeadById(id);
    if (leadAtual && leadAtual.status !== data.status) {
      // Registrar a transição de status
      await registrarTransicaoStatus({
        leadId: id,
        corretorId: leadAtual.corretorId || 0,
        statusAnterior: leadAtual.status as any,
        statusNovo: data.status as any,
      });
      
      // Se mudou para "em_atendimento", criar follow-up automático para o próximo dia às 09:00
      if (data.status === 'em_atendimento' && leadAtual.corretorId) {
        const { proximoDiaAs9h } = await import('./timezone');
        const dataFollowUp = proximoDiaAs9h();
        
        // Verificar se já existe follow-up pendente para este lead na mesma data
        const existente = await db.select()
          .from(followUps)
          .where(and(
            eq(followUps.leadId, id),
            eq(followUps.corretorId, leadAtual.corretorId),
            eq(followUps.status, 'pendente'),
            sql`DATE(${followUps.dataFollowUp}) = DATE(${dataFollowUp})`
          ))
          .limit(1);
        
        if (!existente[0]) {
          await db.insert(followUps).values({
            leadId: id,
            corretorId: leadAtual.corretorId,
            dataFollowUp,
            status: 'pendente',
          });
          
          console.log(`[updateLead] Follow-up automático criado para lead ${id} em ${dataFollowUp.toISOString()}`);
        } else {
          console.log(`[updateLead] Follow-up já existe para lead ${id} em ${dataFollowUp.toISOString()}, pulando criação`);
        }
      }
    }
  }
  
  // Atualizar ultimaInteracao sempre que houver mudança de status ou dados
  const updateData = { ...data, updatedAt: new Date() };
  if (data.status || data.observacoes) {
    updateData.ultimaInteracao = new Date();
  }
  
  await db.update(leads)
    .set(updateData)
    .where(eq(leads.id, id));
}

// Função para registrar transição de status
export async function registrarTransicaoStatus(data: {
  leadId: number;
  corretorId: number;
  statusAnterior: string;
  statusNovo: string;
  observacao?: string;
}) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(leadStatusTransitions).values({
    leadId: data.leadId,
    corretorId: data.corretorId,
    statusAnterior: data.statusAnterior as any,
    statusNovo: data.statusNovo as any,
    observacao: data.observacao,
  });
}

export async function deleteLead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Primeiro excluir histórico do lead
  await db.delete(leadHistory).where(eq(leadHistory.leadId, id));
  
  // Excluir registros de distribuição
  await db.delete(distributionLog).where(eq(distributionLog.leadId, id));
  
  // Excluir o lead
  await db.delete(leads).where(eq(leads.id, id));
}

export async function getLeadsNaoDistribuidos() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(leads)
    .where(eq(leads.status, "novo"))
    .orderBy(leads.createdAt);
}

export async function getLeadsPendentesFollowup() {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  return await db.select().from(leads)
    .where(
      and(
        lte(leads.proximoFollowup, now),
        inArray(leads.status, ["aguardando_atendimento", "em_atendimento", "agendado"])
      )
    )
    .orderBy(leads.proximoFollowup);
}

// ============================================================================
// HISTÓRICO DE INTERAÇÕES
// ============================================================================

export async function createLeadHistory(history: InsertLeadHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(leadHistory).values(history);
  
  // Atualizar ultimaInteracao do lead
  await db.update(leads)
    .set({ ultimaInteracao: new Date() })
    .where(eq(leads.id, history.leadId));
  
  // Atualizar contador de follow-up do lead
  await atualizarContadorFollowUp(history.leadId);
  
  return result;
}

/**
 * Atualiza o contador de dias consecutivos de follow-up do lead
 * Conta quantos dias consecutivos (incluindo hoje) o corretor fez contato
 */
export async function atualizarContadorFollowUp(leadId: number) {
  const db = await getDb();
  if (!db) return;
  
  // Buscar histórico de interações ordenado por data (mais recente primeiro)
  const historico = await db
    .select({ createdAt: leadHistory.createdAt })
    .from(leadHistory)
    .where(eq(leadHistory.leadId, leadId))
    .orderBy(desc(leadHistory.createdAt));
  
  if (historico.length === 0) {
    await db.update(leads).set({ diasFollowupConsecutivos: 0 }).where(eq(leads.id, leadId));
    return;
  }
  
  // Agrupar interações por dia (usando data local)
  const diasComContato = new Set<string>();
  for (const h of historico) {
    const data = new Date(h.createdAt);
    const diaStr = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
    diasComContato.add(diaStr);
  }
  
  // Ordenar dias (mais recente primeiro)
  const diasOrdenados = Array.from(diasComContato).sort().reverse();
  
  // Contar dias consecutivos a partir de hoje
  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  
  let diasConsecutivos = 0;
  let dataVerificar = new Date(hoje);
  
  for (let i = 0; i < 5; i++) {
    const diaStr = `${dataVerificar.getFullYear()}-${String(dataVerificar.getMonth() + 1).padStart(2, '0')}-${String(dataVerificar.getDate()).padStart(2, '0')}`;
    
    if (diasComContato.has(diaStr)) {
      diasConsecutivos++;
      dataVerificar.setDate(dataVerificar.getDate() - 1);
    } else {
      break;
    }
  }
  
  // Atualizar o lead
  await db.update(leads).set({ diasFollowupConsecutivos: diasConsecutivos }).where(eq(leads.id, leadId));
}

export async function getLeadHistory(leadId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(leadHistory)
    .where(eq(leadHistory.leadId, leadId))
    .orderBy(desc(leadHistory.createdAt));
}

// ============================================================================
// LOG DE DISTRIBUIÇÃO
// ============================================================================

export async function createDistributionLog(log: InsertDistributionLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(distributionLog).values(log);
  return result;
}

export async function getDistributionHistory(corretorId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  if (corretorId) {
    return await db.select().from(distributionLog)
      .where(eq(distributionLog.corretorId, corretorId))
      .orderBy(desc(distributionLog.createdAt));
  }
  
  return await db.select().from(distributionLog)
    .orderBy(desc(distributionLog.createdAt));
}

// ============================================================================
// ESTATÍSTICAS DE CONVERSÃO
// ============================================================================

export async function getConversionStats(corretorId: number, projectId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  if (projectId) {
    return await db.select().from(conversionStats)
      .where(and(
        eq(conversionStats.corretorId, corretorId),
        eq(conversionStats.projectId, projectId)
      ));
  }
  
  return await db.select().from(conversionStats)
    .where(eq(conversionStats.corretorId, corretorId));
}

export async function updateConversionStats(stats: InsertConversionStats) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Calcular taxa de conversão
  const leadsRec = stats.leadsRecebidos ?? 0;
  const contratosFech = stats.contratosFechados ?? 0;
  const taxaConversao = leadsRec > 0 
    ? Math.round((contratosFech / leadsRec) * 10000) 
    : 0;
  
  const result = await db.insert(conversionStats)
    .values({ ...stats, taxaConversao })
    .onDuplicateKeyUpdate({
      set: {
        ...stats,
        taxaConversao,
        updatedAt: new Date()
      }
    });
  
  return result;
}

// ============================================================================
// MENSAGENS PRONTAS
// ============================================================================

export async function getQuickMessages(corretorId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  if (corretorId) {
    return await db.select().from(quickMessages)
      .where(eq(quickMessages.corretorId, corretorId))
      .orderBy(quickMessages.ordem);
  }
  
  // Mensagens globais
  return await db.select().from(quickMessages)
    .where(eq(quickMessages.corretorId, null as any))
    .orderBy(quickMessages.ordem);
}

export async function createQuickMessage(message: InsertQuickMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(quickMessages).values(message);
  return result;
}


// ============================================================================
// HISTÓRICO DE DISTRIBUIÇÕES (PARA GESTOR)
// ============================================================================

export async function getHistoricoDistribuicoes(limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    id: distributionLog.id,
    leadId: distributionLog.leadId,
    corretorId: distributionLog.corretorId,
    tipo: distributionLog.tipo,
    motivo: distributionLog.motivo,
    createdAt: distributionLog.createdAt,
    leadNome: leads.nome,
    leadTelefone: leads.telefone,
    corretorNome: users.name,
    corretorEmail: users.email,
  })
    .from(distributionLog)
    .leftJoin(leads, eq(distributionLog.leadId, leads.id))
    .leftJoin(users, eq(distributionLog.corretorId, users.id))
    .orderBy(desc(distributionLog.createdAt))
    .limit(limit);
  
  return result;
}

// ============================================================================
// LEADS POR CORRETOR COM FILTROS (PARA GESTOR)
// ============================================================================
export interface FiltrosLeadsPorCorretor {
  corretorId?: number;
  corretoresIds?: number[] | null; // Filtro por equipe
  status?: string;
  projectId?: number;
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  pageSize?: number;
}

export async function getLeadsPorCorretorComFiltros(filtros?: FiltrosLeadsPorCorretor) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: any[] = [];
  
  // Filtro por equipe (corretoresIds)
  if (filtros?.corretoresIds && filtros.corretoresIds.length > 0) {
    conditions.push(inArray(leads.corretorId, filtros.corretoresIds));
  }
  
  if (filtros?.corretorId) {
    conditions.push(eq(leads.corretorId, filtros.corretorId));
  }
  
  if (filtros?.status) {
    conditions.push(eq(leads.status, filtros.status as any));
  }
  
  if (filtros?.projectId) {
    conditions.push(eq(leads.projectId, filtros.projectId));
  }
  
  if (filtros?.dataInicio) {
    conditions.push(gte(leads.createdAt, new Date(filtros.dataInicio)));
  }
  
  if (filtros?.dataFim) {
    conditions.push(lte(leads.createdAt, new Date(filtros.dataFim)));
  }
  
  const page = filtros?.page || 1;
  const pageSize = filtros?.pageSize || 50;
  const offset = (page - 1) * pageSize;
  
  // Contar total de leads
  const totalResult = await db.select({ count: sql<number>`count(*)` })
    .from(leads)
    .leftJoin(users, eq(leads.corretorId, users.id))
    .leftJoin(projects, eq(leads.projectId, projects.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  
  const total = Number(totalResult[0]?.count || 0);
  
  const result = await db.select({
    id: leads.id,
    nome: leads.nome,
    telefone: leads.telefone,
    email: leads.email,
    status: leads.status,
    origem: leads.origem,
    createdAt: leads.createdAt,
    updatedAt: leads.updatedAt,
    projectId: leads.projectId,
    corretorId: leads.corretorId,
    corretorNome: users.name,
    corretorEmail: users.email,
    projectNome: projects.nome,
  })
    .from(leads)
    .leftJoin(users, eq(leads.corretorId, users.id))
    .leftJoin(projects, eq(leads.projectId, projects.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(leads.createdAt))
    .limit(pageSize)
    .offset(offset);
  
  return { leads: result, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// ============================================================================
// ESTATÍSTICAS POR CORRETOR (PARA GESTOR)
// ============================================================================

export async function getEstatisticasPorCorretor(corretoresIds?: number[] | null) {
  const db = await getDb();
  if (!db) return [];
  
  // Buscar corretores (filtrados por equipe se fornecido)
  let corretores;
  if (corretoresIds && corretoresIds.length > 0) {
    // Filtrar apenas corretores da equipe
    corretores = await db.select()
      .from(users)
      .where(and(
        eq(users.role, 'corretor'),
        inArray(users.id, corretoresIds)
      ));
  } else {
    // Buscar todos os corretores
    corretores = await db.select()
      .from(users)
      .where(eq(users.role, 'corretor'));
  }
  
  const estatisticas = await Promise.all(corretores.map(async (corretor) => {
    // Total de leads
    const totalLeads = await db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.corretorId, corretor.id));
    
    // Leads por status
    const leadsNovos = await db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(eq(leads.corretorId, corretor.id), eq(leads.status, 'novo')));
    
    const leadsAguardando = await db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(eq(leads.corretorId, corretor.id), eq(leads.status, 'aguardando_atendimento')));
    
    const leadsEmAtendimento = await db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(eq(leads.corretorId, corretor.id), eq(leads.status, 'em_atendimento')));
    
    const leadsAgendados = await db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(eq(leads.corretorId, corretor.id), eq(leads.status, 'agendado')));
    
    const leadsVisitou = await db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(eq(leads.corretorId, corretor.id), eq(leads.status, 'visita_realizada')));
    
    const leadsAnalise = await db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(eq(leads.corretorId, corretor.id), eq(leads.status, 'analise_credito')));
    
    const leadsContrato = await db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(eq(leads.corretorId, corretor.id), eq(leads.status, 'contrato_fechado')));
    
    const leadsPerdidos = await db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(eq(leads.corretorId, corretor.id), eq(leads.status, 'perdido')));
    
    const total = Number(totalLeads[0]?.count || 0);
    const contratos = Number(leadsContrato[0]?.count || 0);
    const taxaConversao = total > 0 ? (contratos / total) * 100 : 0;
    
    return {
      id: corretor.id,
      nome: corretor.name || 'Sem nome',
      email: corretor.email || '',
      status: corretor.status || 'ausente',
      totalLeads: total,
      novos: Number(leadsNovos[0]?.count || 0),
      aguardando: Number(leadsAguardando[0]?.count || 0),
      emAtendimento: Number(leadsEmAtendimento[0]?.count || 0),
      agendados: Number(leadsAgendados[0]?.count || 0),
      visitou: Number(leadsVisitou[0]?.count || 0),
      analise: Number(leadsAnalise[0]?.count || 0),
      contratos,
      perdidos: Number(leadsPerdidos[0]?.count || 0),
      taxaConversao: taxaConversao.toFixed(1),
    };
  }));
  
  return estatisticas;
}


// ============================================================================
// NOTIFICAÇÕES
// ============================================================================

export async function createNotification(notification: InsertNotification) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(notifications).values(notification);
  return result;
}

export async function getNotificationsForUser(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getUnreadNotificationsCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.lida, false)
    ));
  
  return Number(result[0]?.count || 0);
}

export async function markNotificationAsRead(notificationId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(notifications)
    .set({ lida: true, lidaEm: new Date() })
    .where(and(
      eq(notifications.id, notificationId),
      eq(notifications.userId, userId)
    ));
}

export async function markAllNotificationsAsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(notifications)
    .set({ lida: true, lidaEm: new Date() })
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.lida, false)
    ));
}

// Função para criar notificação quando lead é distribuído
export async function notifyLeadDistribuido(corretorId: number, leadId: number, leadNome: string) {
  return await createNotification({
    userId: corretorId,
    titulo: "Novo lead recebido!",
    mensagem: `Você recebeu um novo lead: ${leadNome}. Entre em contato o mais rápido possível.`,
    tipo: "lead_recebido",
    leadId: leadId,
  });
}


// ============================================================================
// MÉTRICAS DO DASHBOARD DO GESTOR
// ============================================================================

export interface DashboardFilters {
  dataInicio?: Date;
  dataFim?: Date;
  corretoresIds?: number[] | null; // null = sem filtro (admin), [] = nenhum corretor, [ids] = filtrar por esses corretores
}

export async function getDashboardMetrics(filtros?: DashboardFilters) {
  console.log('[getDashboardMetrics] Filtros recebidos:', JSON.stringify(filtros));
  
  const db = await getDb();
  if (!db) return null;
  
  const conditions: any[] = [];
  
  if (filtros?.dataInicio) {
    conditions.push(gte(leads.createdAt, filtros.dataInicio));
  }
  
  if (filtros?.dataFim) {
    conditions.push(lte(leads.createdAt, filtros.dataFim));
  }
  
  // Filtro por corretores (para gestores verem apenas sua equipe)
  if (filtros?.corretoresIds !== undefined && filtros.corretoresIds !== null) {
    if (filtros.corretoresIds.length === 0) {
      // Gestor sem corretores = não vê nada
      conditions.push(sql`1 = 0`);
    } else {
      conditions.push(inArray(leads.corretorId, filtros.corretoresIds));
    }
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  // Total de leads
  const totalResult = await db.select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(whereClause);
  
  // Leads por status
  const statusCounts = await Promise.all([
    db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(conditions.length > 0 ? and(...conditions, eq(leads.status, 'aguardando_atendimento')) : eq(leads.status, 'aguardando_atendimento')),
    db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(conditions.length > 0 ? and(...conditions, eq(leads.status, 'em_atendimento')) : eq(leads.status, 'em_atendimento')),
    db.select({ count: sql<number>`count(DISTINCT ${agendamentos.id})` })
      .from(agendamentos)
      .leftJoin(leads, eq(agendamentos.leadId, leads.id))
      .where(and(
        ...(filtros?.dataInicio ? [gte(agendamentos.createdAt, filtros.dataInicio)] : []),
        ...(filtros?.dataFim ? [lte(agendamentos.createdAt, filtros.dataFim)] : []),
        ...(filtros?.corretoresIds && filtros.corretoresIds.length > 0 ? [inArray(leads.corretorId, filtros.corretoresIds)] : [])
      )),
    db.select({ count: sql<number>`count(DISTINCT ${visitas.id})` })
      .from(visitas)
      .leftJoin(leads, eq(visitas.leadId, leads.id))
      .where(and(
        ...(filtros?.dataInicio ? [gte(visitas.createdAt, filtros.dataInicio)] : []),
        ...(filtros?.dataFim ? [lte(visitas.createdAt, filtros.dataFim)] : []),
        ...(filtros?.corretoresIds && filtros.corretoresIds.length > 0 ? [inArray(leads.corretorId, filtros.corretoresIds)] : [])
      )),
    db.select({ count: sql<number>`count(DISTINCT ${analises_credito.id})` })
      .from(analises_credito)
      .leftJoin(leads, eq(analises_credito.leadId, leads.id))
      .where(and(
        ...(filtros?.dataInicio ? [gte(analises_credito.createdAt, filtros.dataInicio)] : []),
        ...(filtros?.dataFim ? [lte(analises_credito.createdAt, filtros.dataFim)] : []),
        ...(filtros?.corretoresIds && filtros.corretoresIds.length > 0 ? [inArray(leads.corretorId, filtros.corretoresIds)] : [])
      )),
    db.select({ count: sql<number>`count(DISTINCT ${contratos.id})` })
      .from(contratos)
      .leftJoin(leads, eq(contratos.leadId, leads.id))
      .where(and(
        ...(filtros?.dataInicio ? [gte(contratos.createdAt, filtros.dataInicio)] : []),
        ...(filtros?.dataFim ? [lte(contratos.createdAt, filtros.dataFim)] : []),
        ...(filtros?.corretoresIds && filtros.corretoresIds.length > 0 ? [inArray(leads.corretorId, filtros.corretoresIds)] : [])
      )),
    db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(conditions.length > 0 ? and(...conditions, eq(leads.status, 'perdido')) : eq(leads.status, 'perdido')),
  ]);
  
  // VGV - soma dos valores dos contratos fechados
  // Calcular baseado no valorVenda da tabela contratos
  const vgvResult = await db.select({ 
    total: sql<number>`COALESCE(SUM(${contratos.valorVenda}), 0)` 
  })
    .from(contratos)
    .leftJoin(leads, eq(contratos.leadId, leads.id))
    .where(and(
      ...(filtros?.dataInicio ? [gte(contratos.createdAt, filtros.dataInicio)] : []),
      ...(filtros?.dataFim ? [lte(contratos.createdAt, filtros.dataFim)] : []),
      ...(filtros?.corretoresIds && filtros.corretoresIds.length > 0 ? [inArray(leads.corretorId, filtros.corretoresIds)] : [])
    ));
  
  return {
    total: Number(totalResult[0]?.count || 0),
    aguardando: Number(statusCounts[0][0]?.count || 0),
    emAtendimento: Number(statusCounts[1][0]?.count || 0),
    agendado: Number(statusCounts[2][0]?.count || 0),
    visitaRealizada: Number(statusCounts[3][0]?.count || 0),
    analiseCredito: Number(statusCounts[4][0]?.count || 0),
    contratoFechado: Number(statusCounts[5][0]?.count || 0),
    perdido: Number(statusCounts[6][0]?.count || 0),
    vgv: Number(vgvResult[0]?.total || 0),
  };
}

export async function getLeadsPorCorretorDashboard(filtros?: DashboardFilters) {
  const db = await getDb();
  if (!db) return [];
  
  // Query 1: Buscar todos os usuários que podem ter vendas (filtrados por equipe se necessário)
  // Incluir corretores, gestores e admins que tenham vendas
  const corretoresConditions: any[] = [];
  if (filtros?.corretoresIds && filtros.corretoresIds.length > 0) {
    corretoresConditions.push(inArray(users.id, filtros.corretoresIds));
  }
  
  const corretores = await db.select({
    id: users.id,
    nome: users.name,
    status: users.status,
  })
    .from(users)
    .where(corretoresConditions.length > 0 ? and(...corretoresConditions) : undefined);
  
  // Query 2: Contar leads por corretor em uma única query com GROUP BY
  const leadsConditions: any[] = [];
  if (filtros?.dataInicio) {
    leadsConditions.push(gte(leads.createdAt, filtros.dataInicio));
  }
  if (filtros?.dataFim) {
    leadsConditions.push(lte(leads.createdAt, filtros.dataFim));
  }
  if (filtros?.corretoresIds && filtros.corretoresIds.length > 0) {
    leadsConditions.push(inArray(leads.corretorId, filtros.corretoresIds));
  }
  
  const leadsCounts = await db.select({
    corretorId: leads.corretorId,
    count: sql<number>`count(*)`
  })
    .from(leads)
    .where(leadsConditions.length > 0 ? and(...leadsConditions) : undefined)
    .groupBy(leads.corretorId);
  
  // Criar map de contagens para lookup O(1)
  const countsMap = new Map(leadsCounts.map(lc => [lc.corretorId, Number(lc.count)]));
  
  // Combinar resultados
  const result = corretores.map(corretor => ({
    id: corretor.id,
    nome: corretor.nome || 'Sem nome',
    status: corretor.status,
    totalLeads: countsMap.get(corretor.id) || 0,
  }));
  
  return result.filter(c => c.status === 'presente').sort((a, b) => b.totalLeads - a.totalLeads);
}

export async function getAgendamentosPorCorretor(filtros?: DashboardFilters) {
  const db = await getDb();
  if (!db) return [];
  
  // Query 1: Buscar todos os usuários que podem ter vendas (filtrados por equipe se necessário)
  // Incluir corretores, gestores e admins que tenham vendas
  const corretoresConditions: any[] = [];
  if (filtros?.corretoresIds && filtros.corretoresIds.length > 0) {
    corretoresConditions.push(inArray(users.id, filtros.corretoresIds));
  }
  
  const corretores = await db.select({
    id: users.id,
    nome: users.name,
    status: users.status,
  })
    .from(users)
    .where(corretoresConditions.length > 0 ? and(...corretoresConditions) : undefined);
  
  // Query 2: Contar agendamentos por corretor com GROUP BY
  const agendamentosConditions: any[] = [];
  if (filtros?.dataInicio) {
    agendamentosConditions.push(gte(agendamentos.createdAt, filtros.dataInicio));
  }
  if (filtros?.dataFim) {
    agendamentosConditions.push(lte(agendamentos.createdAt, filtros.dataFim));
  }
  if (filtros?.corretoresIds && filtros.corretoresIds.length > 0) {
    agendamentosConditions.push(inArray(agendamentos.corretorId, filtros.corretoresIds));
  }
  
  const agendamentosCounts = await db.select({
    corretorId: agendamentos.corretorId,
    count: sql<number>`count(*)`
  })
    .from(agendamentos)
    .where(agendamentosConditions.length > 0 ? and(...agendamentosConditions) : undefined)
    .groupBy(agendamentos.corretorId);
  
  const countsMap = new Map(agendamentosCounts.map(ac => [ac.corretorId, Number(ac.count)]));
  
  const result = corretores.map(corretor => ({
    id: corretor.id,
    nome: corretor.nome || 'Sem nome',
    status: corretor.status,
    agendados: countsMap.get(corretor.id) || 0,
  }));
  
  return result.filter(c => c.status === 'presente').sort((a, b) => b.agendados - a.agendados);
}

export async function getVisitasPorCorretor(filtros?: DashboardFilters) {
  const db = await getDb();
  if (!db) return [];
  
  // Query 1: Buscar todos os usuários que podem ter vendas (filtrados por equipe se necessário)
  // Incluir corretores, gestores e admins que tenham vendas
  const corretoresConditions: any[] = [];
  if (filtros?.corretoresIds && filtros.corretoresIds.length > 0) {
    corretoresConditions.push(inArray(users.id, filtros.corretoresIds));
  }
  
  const corretores = await db.select({
    id: users.id,
    nome: users.name,
    status: users.status,
  })
    .from(users)
    .where(corretoresConditions.length > 0 ? and(...corretoresConditions) : undefined);
  
  // Query 2: Contar visitas por corretor com GROUP BY
  const visitasConditions: any[] = [];
  if (filtros?.dataInicio) {
    visitasConditions.push(gte(visitas.createdAt, filtros.dataInicio));
  }
  if (filtros?.dataFim) {
    visitasConditions.push(lte(visitas.createdAt, filtros.dataFim));
  }
  if (filtros?.corretoresIds && filtros.corretoresIds.length > 0) {
    visitasConditions.push(inArray(visitas.corretorId, filtros.corretoresIds));
  }
  
  const visitasCounts = await db.select({
    corretorId: visitas.corretorId,
    count: sql<number>`count(*)`
  })
    .from(visitas)
    .where(visitasConditions.length > 0 ? and(...visitasConditions) : undefined)
    .groupBy(visitas.corretorId);
  
  const countsMap = new Map(visitasCounts.map(vc => [vc.corretorId, Number(vc.count)]));
  
  const result = corretores.map(corretor => ({
    id: corretor.id,
    nome: corretor.nome || 'Sem nome',
    status: corretor.status,
    visitas: countsMap.get(corretor.id) || 0,
  }));
  
  return result.filter(c => c.status === 'presente').sort((a, b) => b.visitas - a.visitas);
}

export async function getVendasPorCorretor(filtros?: DashboardFilters) {
  const db = await getDb();
  if (!db) return [];
  
  // Query 1: Buscar todos os usuários que podem ter vendas (filtrados por equipe se necessário)
  // Incluir corretores, gestores e admins que tenham vendas
  const corretoresConditions: any[] = [];
  if (filtros?.corretoresIds && filtros.corretoresIds.length > 0) {
    corretoresConditions.push(inArray(users.id, filtros.corretoresIds));
  }
  
  const corretores = await db.select({
    id: users.id,
    nome: users.name,
    status: users.status,
  })
    .from(users)
    .where(corretoresConditions.length > 0 ? and(...corretoresConditions) : undefined);
  
  // Query 2: Buscar VGV real da tabela de contratos (valorVenda em reais)
  const contratosConditions: any[] = [];
  if (filtros?.dataInicio) {
    contratosConditions.push(gte(contratos.createdAt, filtros.dataInicio));
  }
  if (filtros?.dataFim) {
    contratosConditions.push(lte(contratos.createdAt, filtros.dataFim));
  }
  if (filtros?.corretoresIds && filtros.corretoresIds.length > 0) {
    contratosConditions.push(inArray(contratos.corretorId, filtros.corretoresIds));
  }
  
  const vendasQuery = db.select({
    corretorId: contratos.corretorId,
    count: sql<number>`count(*)`,
    vgv: sql<number>`COALESCE(SUM(${contratos.valorVenda}), 0)`
  })
    .from(contratos)
    .groupBy(contratos.corretorId);
  
  const vendasData = contratosConditions.length > 0
    ? await vendasQuery.where(and(...contratosConditions))
    : await vendasQuery;
  
  const vendasMap = new Map(vendasData.map(vd => [
    vd.corretorId, 
    { vendas: Number(vd.count), vgv: Number(vd.vgv) }
  ]));
  
  const result = corretores.map(corretor => {
    const data = vendasMap.get(corretor.id) || { vendas: 0, vgv: 0 };
    return {
      id: corretor.id,
      nome: corretor.nome || 'Sem nome',
      status: corretor.status,
      vendas: data.vendas,
      vgv: data.vgv,
    };
  });
  
  // Retornar todos os corretores com vendas, independentemente do status
  // Filtrar apenas inativos se necessário
  return result.filter(c => c.vendas > 0).sort((a, b) => b.vgv - a.vgv);
}


// ============================================================================
// MÉTRICAS HISTÓRICAS PARA GRÁFICOS
// ============================================================================

export interface MetricasDiarias {
  data: string; // YYYY-MM-DD
  novos: number;
  aguardando: number;
  emAtendimento: number;
  agendados: number;
  visitasRealizadas: number;
  analiseCredito: number;
  contratosFechados: number;
  perdidos: number;
  total: number;
}

export async function getMetricasHistoricas(dias: number = 30, corretoresIds?: number[] | null): Promise<MetricasDiarias[]> {
  const db = await getDb();
  if (!db) return [];
  
  const { agora, inicioDoDia, fimDoDia } = await import('./timezone');
  
  const resultado: MetricasDiarias[] = [];
  const hoje = agora(); // Usar timezone de São Paulo
  
  for (let i = dias - 1; i >= 0; i--) {
    const dataBase = new Date(hoje);
    dataBase.setDate(dataBase.getDate() - i);
    
    const data = inicioDoDia(dataBase); // Início do dia em SP
    const dataFim = fimDoDia(dataBase); // Fim do dia em SP
    
    const dataStr = data.toISOString().split('T')[0];
    
    // Buscar leads criados nesse dia (filtrados por equipe se necessário)
    const conditions: any[] = [
      gte(leads.createdAt, data),
      lte(leads.createdAt, dataFim)
    ];
    if (corretoresIds && corretoresIds.length > 0) {
      conditions.push(inArray(leads.corretorId, corretoresIds));
    }
    
    const leadsNoDia = await db.select({
      status: leads.status,
      count: sql<number>`count(*)`
    })
      .from(leads)
      .where(and(...conditions))
      .groupBy(leads.status);
    
    const metricas: MetricasDiarias = {
      data: dataStr,
      novos: 0,
      aguardando: 0,
      emAtendimento: 0,
      agendados: 0,
      visitasRealizadas: 0,
      analiseCredito: 0,
      contratosFechados: 0,
      perdidos: 0,
      total: 0,
    };
    
    for (const row of leadsNoDia) {
      const count = Number(row.count);
      metricas.total += count;
      
      switch (row.status) {
        case 'novo': metricas.novos = count; break;
        case 'aguardando_atendimento': metricas.aguardando = count; break;
        case 'em_atendimento': metricas.emAtendimento = count; break;
        case 'agendado': metricas.agendados = count; break;
        case 'visita_realizada': metricas.visitasRealizadas = count; break;
        case 'analise_credito': metricas.analiseCredito = count; break;
        case 'contrato_fechado': metricas.contratosFechados = count; break;
        case 'perdido': metricas.perdidos = count; break;
      }
    }
    
    resultado.push(metricas);
  }
  
  return resultado;
}

export async function getEvolucaoFunil(dias: number = 30, corretoresIds?: number[] | null) {
  const db = await getDb();
  if (!db) return [];
  
  const hoje = new Date();
  const dataInicio = new Date(hoje);
  dataInicio.setDate(dataInicio.getDate() - dias);
  dataInicio.setHours(0, 0, 0, 0);
  
  // Buscar totais acumulados por status (filtrados por equipe se necessário)
  const conditions: any[] = [gte(leads.createdAt, dataInicio)];
  if (corretoresIds && corretoresIds.length > 0) {
    conditions.push(inArray(leads.corretorId, corretoresIds));
  }
  
  const totais = await db.select({
    status: leads.status,
    count: sql<number>`count(*)`
  })
    .from(leads)
    .where(and(...conditions))
    .groupBy(leads.status);
  
  const funil = [
    { etapa: 'Novos', valor: 0, cor: '#6366f1' },
    { etapa: 'Aguardando', valor: 0, cor: '#f59e0b' },
    { etapa: 'Em Atendimento', valor: 0, cor: '#3b82f6' },
    { etapa: 'Agendados', valor: 0, cor: '#8b5cf6' },
    { etapa: 'Visitas', valor: 0, cor: '#06b6d4' },
    { etapa: 'Análise de Crédito', valor: 0, cor: '#f97316' },
    { etapa: 'Contratos Fechados', valor: 0, cor: '#22c55e' },
    { etapa: 'Perdidos', valor: 0, cor: '#ef4444' },
  ];
  
  for (const row of totais) {
    const count = Number(row.count);
    switch (row.status) {
      case 'novo': funil[0].valor = count; break;
      case 'aguardando_atendimento': funil[1].valor = count; break;
      case 'em_atendimento': funil[2].valor = count; break;
      case 'agendado': funil[3].valor = count; break;
      case 'visita_realizada': funil[4].valor = count; break;
      case 'analise_credito': funil[5].valor = count; break;
      case 'contrato_fechado': funil[6].valor = count; break;
      case 'perdido': funil[7].valor = count; break;
    }
  }
  
  return funil;
}

// ============================================================================
// SISTEMA DE METAS POR CORRETOR
// ============================================================================

export async function createMeta(meta: {
  corretorId: number;
  mes: number;
  ano: number;
  metaLeads?: number;
  metaAgendamentos?: number;
  metaVisitas?: number;
  metaContratos?: number;
  metaVGV?: number;
  observacoes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(metas).values({
    corretorId: meta.corretorId,
    mes: meta.mes,
    ano: meta.ano,
    metaLeads: meta.metaLeads || 0,
    metaAgendamentos: meta.metaAgendamentos || 0,
    metaVisitas: meta.metaVisitas || 0,
    metaContratos: meta.metaContratos || 0,
    metaVGV: meta.metaVGV || 0,
    observacoes: meta.observacoes,
  });
  
  // Buscar a meta criada para retornar
  const metaCriada = await getMetaByCorretorMesAno(meta.corretorId, meta.mes, meta.ano);
  return metaCriada;
}

export async function updateMeta(id: number, meta: {
  metaLeads?: number;
  metaAgendamentos?: number;
  metaVisitas?: number;
  metaContratos?: number;
  metaVGV?: number;
  observacoes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: any = {};
  if (meta.metaLeads !== undefined) updateData.metaLeads = meta.metaLeads;
  if (meta.metaAgendamentos !== undefined) updateData.metaAgendamentos = meta.metaAgendamentos;
  if (meta.metaVisitas !== undefined) updateData.metaVisitas = meta.metaVisitas;
  if (meta.metaContratos !== undefined) updateData.metaContratos = meta.metaContratos;
  if (meta.metaVGV !== undefined) updateData.metaVGV = meta.metaVGV;
  if (meta.observacoes !== undefined) updateData.observacoes = meta.observacoes;
  
  await db.update(metas).set(updateData).where(eq(metas.id, id));
}

export async function deleteMeta(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(metas).where(eq(metas.id, id));
}

export async function getMetaByCorretorMesAno(corretorId: number, mes: number, ano: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(metas)
    .where(and(
      eq(metas.corretorId, corretorId),
      eq(metas.mes, mes),
      eq(metas.ano, ano)
    ))
    .limit(1);
  
  return result[0] || null;
}

export async function getMetasDoMes(mes: number, ano: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(metas)
    .where(and(
      eq(metas.mes, mes),
      eq(metas.ano, ano)
    ));
}

export async function getMetasDoCorretor(corretorId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(metas)
    .where(eq(metas.corretorId, corretorId))
    .orderBy(desc(metas.ano), desc(metas.mes));
}

export async function getProgressoMeta(corretorId: number, mes: number, ano: number) {
  const db = await getDb();
  if (!db) return null;
  
  // Buscar meta do corretor
  const meta = await getMetaByCorretorMesAno(corretorId, mes, ano);
  if (!meta) return null;
  
  // Calcular período do mês
  const dataInicio = new Date(ano, mes - 1, 1);
  const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999);
  
  // Buscar realizados no período
  // IMPORTANTE: Leads só contam se forem de captação própria
  const leadsDoMes = await db.select({
    status: leads.status,
    count: sql<number>`count(*)`
  })
    .from(leads)
    .where(and(
      eq(leads.corretorId, corretorId),
      eq(leads.origem, 'captacao_corretor'), // Apenas captação própria
      gte(leads.createdAt, dataInicio),
      lte(leads.createdAt, dataFim)
    ))
    .groupBy(leads.status);
  
  let totalLeads = 0;
  let agendamentos = 0;
  let visitas = 0;
  let contratos = 0;
  
  for (const row of leadsDoMes) {
    const count = Number(row.count);
    totalLeads += count;
    
    if (row.status === 'agendado') agendamentos = count;
    if (row.status === 'visita_realizada') visitas = count;
    if (row.status === 'contrato_fechado') contratos = count;
  }
  
  // Calcular VGV realizado
  const vgvResult = await db.select({
    total: sql<number>`COALESCE(SUM(${projects.valorMinimo}), 0)`
  })
    .from(leads)
    .leftJoin(projects, eq(leads.projectId, projects.id))
    .where(and(
      eq(leads.corretorId, corretorId),
      eq(leads.status, 'contrato_fechado'),
      gte(leads.createdAt, dataInicio),
      lte(leads.createdAt, dataFim)
    ));
  
  const vgvRealizado = Number(vgvResult[0]?.total || 0);
  
  // Calcular progresso individual (pode ultrapassar 100%)
  const progressoLeads = meta.metaLeads > 0 ? Math.round((totalLeads / meta.metaLeads) * 100) : 0;
  const progressoAgendamentos = meta.metaAgendamentos > 0 ? Math.round((agendamentos / meta.metaAgendamentos) * 100) : 0;
  const progressoVisitas = meta.metaVisitas > 0 ? Math.round((visitas / meta.metaVisitas) * 100) : 0;
  const progressoContratos = meta.metaContratos > 0 ? Math.round((contratos / meta.metaContratos) * 100) : 0;
  const progressoVGV = meta.metaVGV > 0 ? Math.round((vgvRealizado / meta.metaVGV) * 100) : 0;
  
  // Calcular progresso geral (cada meta contribui no máximo 20%)
  const contribuicaoLeads = Math.min(20, (progressoLeads / 100) * 20);
  const contribuicaoAgendamentos = Math.min(20, (progressoAgendamentos / 100) * 20);
  const contribuicaoVisitas = Math.min(20, (progressoVisitas / 100) * 20);
  const contribuicaoContratos = Math.min(20, (progressoContratos / 100) * 20);
  const contribuicaoVGV = Math.min(20, (progressoVGV / 100) * 20);
  
  const progressoGeral = Math.round(
    contribuicaoLeads + 
    contribuicaoAgendamentos + 
    contribuicaoVisitas + 
    contribuicaoContratos + 
    contribuicaoVGV
  );
  
  return {
    meta,
    realizado: {
      leads: totalLeads,
      agendamentos,
      visitas,
      contratos,
      vgv: vgvRealizado,
    },
    progresso: {
      leads: progressoLeads,
      agendamentos: progressoAgendamentos,
      visitas: progressoVisitas,
      contratos: progressoContratos,
      vgv: progressoVGV,
    },
    progressoGeral, // Meta geral limitada a 100% (5 metas × 20% cada)
  };
}

export async function getProgressoMetasTodosCorretores(mes: number, ano: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Buscar todos os corretores ativos
  const corretores = await db.select()
    .from(users)
    .where(eq(users.role, 'corretor'));
  
  const resultados = [];
  
  for (const corretor of corretores) {
    const progresso = await getProgressoMeta(corretor.id, mes, ano);
    
    resultados.push({
      corretor: {
        id: corretor.id,
        nome: corretor.name || 'Sem nome',
        status: corretor.status,
      },
      progresso,
    });
  }
  
  return resultados;
}


// ============================================================================
// RANKING DE CORRETORES
// ============================================================================

export async function getRankingCorretores(mes?: number | null, ano?: number | null, dataInicio?: Date | null, dataFim?: Date | null) {
  const db = await getDb();
  if (!db) return [];
  
  try {
    // Definir filtro de data para contratos
    let contratosWhere = undefined;
    if (dataInicio && dataFim) {
      // Filtro por range de datas (prioridade)
      contratosWhere = and(
        gte(contratos.createdAt, dataInicio),
        lte(contratos.createdAt, dataFim)
      );
    } else if (mes !== null && mes !== undefined && ano !== null && ano !== undefined) {
      const inicio = new Date(ano, mes - 1, 1);
      const fim = new Date(ano, mes, 0, 23, 59, 59, 999);
      contratosWhere = and(
        gte(contratos.createdAt, inicio),
        lte(contratos.createdAt, fim)
      );
    }
    
    // Buscar contratos agrupados por corretor usando Drizzle ORM
    const result = await db
      .select({
        corretorId: leads.corretorId,
        corretorNome: users.name,
        corretorFoto: users.fotoUrl,
        contratosFechados: sql<number>`COUNT(${contratos.id})`.as('contratosFechados'),
        vgvTotal: sql<number>`COALESCE(SUM(${contratos.valorVenda}), 0)`.as('vgvTotal'),
      })
      .from(contratos)
      .innerJoin(leads, eq(contratos.leadId, leads.id))
      .innerJoin(users, eq(leads.corretorId, users.id))
      .where(contratosWhere)
      .groupBy(leads.corretorId, users.name, users.fotoUrl)
      .orderBy(sql`vgvTotal DESC`);
    
    return result.map((row, index) => ({
      corretorId: Number(row.corretorId),
      corretorNome: row.corretorNome || 'Sem nome',
      corretorFoto: row.corretorFoto || null,
      vgvTotal: Number(row.vgvTotal || 0),
      contratosFechados: Number(row.contratosFechados || 0),
      posicao: index + 1,
    }));
  } catch (error) {
    console.error('[getRankingCorretores] Erro:', error);
    return [];
  }
}

export async function getPerformanceCorretor(corretorId: number, mes?: number, ano?: number) {
  const db = await getDb();
  if (!db) return null;
  
  // Se não especificado, usa o mês/ano atual
  const dataAtual = new Date();
  const mesAtual = mes || dataAtual.getMonth() + 1;
  const anoAtual = ano || dataAtual.getFullYear();
  
  // Período do mês
  const dataInicio = new Date(anoAtual, mesAtual - 1, 1);
  const dataFim = new Date(anoAtual, mesAtual, 0, 23, 59, 59, 999);
  
  // Buscar corretor
  const corretor = await getUserById(corretorId);
  if (!corretor) return null;
  
  // Buscar métricas do corretor no período
  const leadsDoMes = await db.select({
    status: leads.status,
    count: sql<number>`count(*)`
  })
    .from(leads)
    .where(and(
      eq(leads.corretorId, corretorId),
      gte(leads.createdAt, dataInicio),
      lte(leads.createdAt, dataFim)
    ))
    .groupBy(leads.status);
  
  let totalLeads = 0;
  let novos = 0;
  let aguardando = 0;
  let emAtendimento = 0;
  let agendamentos = 0;
  let visitas = 0;
  let analiseCredito = 0;
  let contratos = 0;
  let perdidos = 0;
  
  for (const row of leadsDoMes) {
    const count = Number(row.count);
    totalLeads += count;
    
    switch (row.status) {
      case 'novo': novos = count; break;
      case 'aguardando_atendimento': aguardando = count; break;
      case 'em_atendimento': emAtendimento = count; break;
      case 'agendado': agendamentos = count; break;
      case 'visita_realizada': visitas = count; break;
      case 'analise_credito': analiseCredito = count; break;
      case 'contrato_fechado': contratos = count; break;
      case 'perdido': perdidos = count; break;
    }
  }
  
  // Calcular VGV
  const vgvResult = await db.select({
    total: sql<number>`COALESCE(SUM(${projects.valorMinimo}), 0)`
  })
    .from(leads)
    .leftJoin(projects, eq(leads.projectId, projects.id))
    .where(and(
      eq(leads.corretorId, corretorId),
      eq(leads.status, 'contrato_fechado'),
      gte(leads.createdAt, dataInicio),
      lte(leads.createdAt, dataFim)
    ));
  
  const vgv = Number(vgvResult[0]?.total || 0);
  
  // Buscar meta do corretor
  const meta = await getMetaByCorretorMesAno(corretorId, mesAtual, anoAtual);
  
  // Calcular taxa de conversão
  const taxaConversao = totalLeads > 0 ? Math.round((contratos / totalLeads) * 100) : 0;
  
  return {
    corretor: {
      id: corretor.id,
      nome: corretor.name || 'Sem nome',
      email: corretor.email,
      fotoUrl: corretor.fotoUrl,
      status: corretor.status,
    },
    periodo: {
      mes: mesAtual,
      ano: anoAtual,
    },
    metricas: {
      totalLeads,
      novos,
      aguardando,
      emAtendimento,
      agendamentos,
      visitas,
      analiseCredito,
      contratos,
      perdidos,
      vgv,
      taxaConversao,
    },
    meta: meta ? {
      leads: meta.metaLeads,
      agendamentos: meta.metaAgendamentos,
      visitas: meta.metaVisitas,
      contratos: meta.metaContratos,
      vgv: meta.metaVGV,
    } : null,
    progresso: meta ? {
      leads: meta.metaLeads > 0 ? Math.round((totalLeads / meta.metaLeads) * 100) : 0,
      agendamentos: meta.metaAgendamentos > 0 ? Math.round((agendamentos / meta.metaAgendamentos) * 100) : 0,
      visitas: meta.metaVisitas > 0 ? Math.round((visitas / meta.metaVisitas) * 100) : 0,
      contratos: meta.metaContratos > 0 ? Math.round((contratos / meta.metaContratos) * 100) : 0,
      vgv: meta.metaVGV > 0 ? Math.round((vgv / meta.metaVGV) * 100) : 0,
    } : null,
  };
}


// ============================================================================
// SISTEMA DE FILA/ROLETA DE DISTRIBUIÇÃO
// ============================================================================

/**
 * Inicializa a fila de distribuição com todos os corretores ativos
 */
export async function inicializarFilaDistribuicao() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar todos os corretores
  const corretores = await db.select()
    .from(users)
    .where(eq(users.role, 'corretor'));
  
  // Verificar quais já estão na fila
  const filaAtual = await db.select()
    .from(filaDistribuicao);
  
  const corretoresNaFila = new Set(filaAtual.map(f => f.corretorId));
  
  // Adicionar corretores que não estão na fila
  let posicaoAtual = filaAtual.length > 0 
    ? Math.max(...filaAtual.map(f => f.posicao)) + 1 
    : 1;
  
  for (const corretor of corretores) {
    if (!corretoresNaFila.has(corretor.id)) {
      await db.insert(filaDistribuicao).values({
        corretorId: corretor.id,
        posicao: posicaoAtual++,
        ativo: corretor.status === 'presente',
      });
    }
  }
  
  return await getFilaDistribuicao();
}

/**
 * Busca a fila de distribuição ordenada por posição
 * Filtra apenas corretores ativos no sistema (role = 'corretor' e não excluídos)
 */
export async function getFilaDistribuicao() {
  const db = await getDb();
  if (!db) return [];
  
  const fila = await db.select({
    id: filaDistribuicao.id,
    corretorId: filaDistribuicao.corretorId,
    posicao: filaDistribuicao.posicao,
    ativo: filaDistribuicao.ativo,
    maxLeadsDia: filaDistribuicao.maxLeadsDia,
    leadsRecebidosHoje: filaDistribuicao.leadsRecebidosHoje,
    ultimaDistribuicao: filaDistribuicao.ultimaDistribuicao,
    corretorNome: users.name,
    corretorStatus: users.status,
    corretorFoto: users.fotoUrl,
  })
    .from(filaDistribuicao)
    .innerJoin(users, eq(filaDistribuicao.corretorId, users.id))
    .where(eq(users.role, 'corretor')) // Apenas corretores ativos no sistema
    .orderBy(filaDistribuicao.posicao);
  
  return fila;
}

/**
 * Atualiza a posição de um corretor na fila
 */
export async function atualizarPosicaoFila(corretorId: number, novaPosicao: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(filaDistribuicao)
    .set({ posicao: novaPosicao })
    .where(eq(filaDistribuicao.corretorId, corretorId));
}

/**
 * Ativa/desativa um corretor na fila
 */
export async function toggleCorretorFila(corretorId: number, ativo: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(filaDistribuicao)
    .set({ ativo })
    .where(eq(filaDistribuicao.corretorId, corretorId));
}

/**
 * Atualiza o limite de leads por dia de um corretor
 */
export async function atualizarMaxLeadsDia(corretorId: number, maxLeadsDia: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(filaDistribuicao)
    .set({ maxLeadsDia })
    .where(eq(filaDistribuicao.corretorId, corretorId));
}

/**
 * Reseta o contador de leads recebidos hoje (deve ser chamado diariamente)
 */
export async function resetarContadorLeadsDiarios() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(filaDistribuicao)
    .set({ leadsRecebidosHoje: 0 });
}

/**
 * Busca o próximo corretor disponível na fila (roleta)
 * Considera: posição na fila, status presente, ativo na roleta, limite diário
 */
export async function getProximoCorretorFila(): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Buscar fila ordenada por posição com limite de webhook do corretor
  const fila = await db.select({
    corretorId: filaDistribuicao.corretorId,
    posicao: filaDistribuicao.posicao,
    ativo: filaDistribuicao.ativo,
    leadsRecebidosHoje: filaDistribuicao.leadsRecebidosHoje,
    corretorStatus: users.status,
    limiteDiarioWebhook: users.limiteDiarioWebhook,
  })
    .from(filaDistribuicao)
    .leftJoin(users, eq(filaDistribuicao.corretorId, users.id))
    .orderBy(filaDistribuicao.posicao);
  
  // Encontrar o primeiro corretor disponível
  for (const item of fila) {
    // Verificar se está ativo na roleta
    if (!item.ativo) continue;
    
    // Verificar se está presente
    if (item.corretorStatus !== 'presente') continue;
    
    // Contar leads recebidos via webhook hoje (função já usa fuso de SP)
    const leadsWebhookHoje = await countLeadsWebhookRecebidosHoje(item.corretorId);
    
    // Verificar se não atingiu o limite diário de webhook
    const limiteWebhook = item.limiteDiarioWebhook || 10;
    if (leadsWebhookHoje >= limiteWebhook) continue;
    
    return item.corretorId;
  }
  
  return null; // Nenhum corretor disponível
}

/**
 * Move um corretor para o final da fila após receber um lead
 */
export async function moverCorretorParaFinalFila(corretorId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar a maior posição atual
  const maxPosicaoResult = await db.select({
    maxPosicao: sql<number>`MAX(${filaDistribuicao.posicao})`
  }).from(filaDistribuicao);
  
  const novaPosicao = (maxPosicaoResult[0]?.maxPosicao || 0) + 1;
  
  // Atualizar posição do corretor e incrementar contador
  await db.update(filaDistribuicao)
    .set({ 
      posicao: novaPosicao,
      leadsRecebidosHoje: sql`${filaDistribuicao.leadsRecebidosHoje} + 1`,
      ultimaDistribuicao: new Date(),
    })
    .where(eq(filaDistribuicao.corretorId, corretorId));
}

/**
 * Distribui um lead para o próximo corretor da fila
 * Retorna o ID do corretor que recebeu o lead, ou null se não houver corretor disponível
 */
export async function distribuirLeadPelaRoleta(leadId: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Buscar dados do lead para verificar o projeto
  const leadInfo = await getLeadById(leadId);
  if (!leadInfo) return null;
  
  // Verificar se o lead é do projeto foco
  const config = await getConfiguracaoProjetoFoco();
  const isProjetoFoco = config && config.ativo && config.projetoId === leadInfo.projectId;
  
  let corretorId: number | null = null;
  
  if (isProjetoFoco) {
    // Lead do projeto foco - usar fila foco (SEM LIMITE)
    corretorId = await getProximoCorretorFilaFoco();
    console.log(`[Roleta] Lead do projeto foco - tentando fila foco: ${corretorId ? 'sucesso' : 'sem corretor'}`);
  }
  
  if (!corretorId) {
    // Lead de outro projeto OU fila foco sem corretores - usar fila geral (COM LIMITE)
    corretorId = await getProximoCorretorFila();
    console.log(`[Roleta] Usando fila geral: ${corretorId ? 'sucesso' : 'sem corretor'}`);
  }
  
  if (!corretorId) {
    console.log('[Roleta] Nenhum corretor disponível para receber o lead');
    return null;
  }
  
  // Atribuir lead ao corretor
  await db.update(leads)
    .set({ 
      corretorId,
      status: 'aguardando_atendimento',
    })
    .where(eq(leads.id, leadId));
  
  // Mover corretor para o final da fila
  await moverCorretorParaFinalFila(corretorId);
  
  // Registrar log de distribuição
  await db.insert(distributionLog).values({
    leadId,
    corretorId,
    tipo: 'automatica',
    motivo: 'Distribuição automática via roleta',
  });
  
  // Criar follow-up automático para o lead
  try {
    await criarFollowUpParaLead(leadId, corretorId);
  } catch (e) {
    console.log('[Roleta] Erro ao criar follow-up:', e);
  }
  
  // Buscar dados do lead para notificação
  const leadData = await getLeadById(leadId);
  if (leadData) {
    await notifyLeadDistribuido(corretorId, leadId, leadData.nome);
  }
  
  console.log(`[Roleta] Lead ${leadId} distribuído para corretor ${corretorId}`);
  
  return corretorId;
}

// ============================================================================
// WEBHOOK CONFIG
// ============================================================================

export async function createWebhookConfig(config: {
  nome: string;
  fonte?: 'facebook' | 'instagram' | 'google' | 'rdstation' | 'outro';
  projectIdPadrao?: number;
  tipoFila?: 'geral' | 'foco';
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Gerar token único
  const webhookToken = crypto.randomUUID().replace(/-/g, '');
  
  const result = await db.insert(webhookConfig).values({
    webhookToken,
    nome: config.nome,
    fonte: config.fonte || 'facebook',
    projectIdPadrao: config.projectIdPadrao,
    tipoFila: config.tipoFila || 'geral',
  });
  
  return {
    id: Number(result[0].insertId),
    webhookToken,
  };
}

export async function getWebhookConfigs() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(webhookConfig)
    .orderBy(desc(webhookConfig.createdAt));
}

export async function getWebhookConfigByToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(webhookConfig)
    .where(eq(webhookConfig.webhookToken, token));
  
  return result[0] || null;
}

export async function incrementarLeadsWebhook(webhookId: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(webhookConfig)
    .set({
      leadsRecebidos: sql`${webhookConfig.leadsRecebidos} + 1`,
      ultimoLeadRecebido: new Date(),
    })
    .where(eq(webhookConfig.id, webhookId));
}

export async function toggleWebhookConfig(webhookId: number, ativo: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(webhookConfig)
    .set({ ativo })
    .where(eq(webhookConfig.id, webhookId));
}

export async function deleteWebhookConfig(webhookId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(webhookConfig)
    .where(eq(webhookConfig.id, webhookId));
}

export async function updateWebhookFormIdMapping(webhookId: number, formIdMapping: Record<string, number>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(webhookConfig)
    .set({ formIdMapping: JSON.stringify(formIdMapping) })
    .where(eq(webhookConfig.id, webhookId));
}

/**
 * Processa um lead recebido via webhook
 * Cria o lead e distribui automaticamente pela roleta
 */
export async function processarLeadWebhook(webhookToken: string, dadosLead: {
  nome: string;
  email?: string;
  telefone: string;
  origem?: string;
  projectId?: number; // Projeto mapeado pelo Form ID
  // Campos do Facebook Lead Ads
  campanha?: string;
  faixaRenda?: string;
  prefereContatoPor?: string;
  finalidadeImovel?: string;
  dataHoraCriacao?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Verificar se o webhook é válido
  const webhook = await getWebhookConfigByToken(webhookToken);
  
  if (!webhook || !webhook.ativo) {
    throw new Error("Webhook inválido ou inativo");
  }
  
  // Processar data/hora de criação do Facebook
  let dataHoraCriacao: Date | undefined;
  if (dadosLead.dataHoraCriacao) {
    try {
      dataHoraCriacao = new Date(dadosLead.dataHoraCriacao);
    } catch (e) {
      console.log('[Webhook] Erro ao parsear data:', dadosLead.dataHoraCriacao);
    }
  }
  
  // Criar o lead (marcar como origemWebhook para notificação urgente)
  const leadCriado = await createLead({
    nome: dadosLead.nome,
    email: dadosLead.email,
    telefone: dadosLead.telefone,
    origem: dadosLead.origem || webhook.fonte,
    projectId: dadosLead.projectId || webhook.projectId || null,
    status: 'novo',
    campanha: dadosLead.campanha,
    faixaRenda: dadosLead.faixaRenda,
    prefereContatoPor: dadosLead.prefereContatoPor,
    finalidadeImovel: dadosLead.finalidadeImovel,
    dataHoraCriacao: dadosLead.dataHoraCriacao ? new Date(dadosLead.dataHoraCriacao) : undefined,
    origemWebhook: true, // Marcar como lead via webhook para notificação urgente
  });
  
  console.log('[Webhook] Lead criado com sucesso:', {
    leadId: leadCriado.id,
    nome: leadCriado.nome,
    projectId: leadCriado.projectId,
    faixaRenda: leadCriado.faixaRenda,
    origemWebhook: leadCriado.origemWebhook
  });
  
  // Incrementar contador do webhook
  await incrementarLeadsWebhook(webhook.id);
  
  // Distribuir pela roleta
  const corretorId = await distribuirLeadPelaRoleta(leadCriado.id);
  
  // Notificar corretor via Email e Zapier (WhatsApp)
  if (corretorId && leadCriado.origemWebhook) {
    try {
      const corretor = await getUserById(corretorId);
      const projeto = leadCriado.projectId ? await getProjectById(leadCriado.projectId) : null;
      
      if (corretor) {
        // Enviar notificação por EMAIL
        try {
          const { enviarNotificacaoLeadWebhook } = await import('./emailService');
          await enviarNotificacaoLeadWebhook({
            corretorNome: corretor.name,
            corretorEmail: corretor.email,
            leadNome: leadCriado.nome,
            leadTelefone: leadCriado.telefone,
            leadEmail: leadCriado.email || undefined,
            leadOrigem: leadCriado.origem,
            leadProjeto: projeto?.nome,
            leadCampanha: leadCriado.campanha || undefined,
            leadFaixaRenda: leadCriado.faixaRenda || undefined,
          });
          console.log('[Webhook] Notificação por email enviada para:', corretor.email);
        } catch (emailError) {
          console.error('[Webhook] Erro ao enviar email:', emailError);
        }
        
        // Enviar notificação via Zapier (WhatsApp) - se configurado
        try {
          const { notificarCorretorLeadWebhook } = await import('./zapierWebhook');
          await notificarCorretorLeadWebhook({
            corretor: {
              id: corretor.id,
              nome: corretor.name,
              telefone: corretor.telefone || undefined,
              email: corretor.email,
            },
            lead: {
              id: leadCriado.id,
              nome: leadCriado.nome,
              telefone: leadCriado.telefone,
              email: leadCriado.email || undefined,
              status: leadCriado.status,
              origem: leadCriado.origem,
              projeto: projeto?.nome,
            },
          });
        } catch (zapierError) {
          console.error('[Webhook] Erro ao notificar via Zapier:', zapierError);
        }
      }
    } catch (error) {
      console.error('[Webhook] Erro ao notificar corretor:', error);
    }
  }
  
  return {
    lead: leadCriado,
    corretorId,
    distribuido: corretorId !== null,
  };
}

/**
 * Processa um lead recebido via webhook FOCO (SEM LIMITES)
 * Cria o lead e distribui APENAS para corretores da Fila Foco
 */
export async function processarLeadWebhookFoco(webhookToken: string, dadosLead: {
  nome: string;
  email?: string;
  telefone: string;
  origem?: string;
  faixaRenda?: string;
  prefereContatoPor?: string;
  finalidadeImovel?: string;
  projectId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Verificar se o webhook é válido e do tipo 'foco'
  const webhook = await getWebhookConfigByToken(webhookToken);
  
  if (!webhook || !webhook.ativo) {
    throw new Error("Webhook inválido ou inativo");
  }
  
  if (webhook.tipoFila !== 'foco') {
    throw new Error("Este webhook não é da Fila Foco");
  }
  
  // Criar o lead (usar projectId do input, do webhook ou deixar null)
  const leadCriado = await createLead({
    nome: dadosLead.nome,
    email: dadosLead.email,
    telefone: dadosLead.telefone,
    origem: dadosLead.origem || webhook.fonte,
    projectId: dadosLead.projectId || webhook.projectIdPadrao || undefined,
    status: 'novo',
    faixaRenda: dadosLead.faixaRenda,
    prefereContatoPor: dadosLead.prefereContatoPor,
    finalidadeImovel: dadosLead.finalidadeImovel,
    origemWebhook: true, // Marcar como lead via webhook para notificação urgente
  });
  
  console.log('[Webhook Foco] Lead criado com sucesso:', {
    leadId: leadCriado.id,
    nome: leadCriado.nome,
    projectId: leadCriado.projectId,
    faixaRenda: leadCriado.faixaRenda,
    origemWebhook: leadCriado.origemWebhook
  });
  
  // Incrementar contador do webhook
  await incrementarLeadsWebhook(webhook.id);
  
  // Distribuir APENAS para corretores da Fila Foco (SEM LIMITES)
  const corretorId = await getProximoCorretorFilaFoco();
  
  if (corretorId) {
    // Atribuir lead ao corretor
    await db.update(leads)
      .set({ 
        corretorId,
        status: 'aguardando_atendimento',
      })
      .where(eq(leads.id, leadCriado.id));
    
    // Mover corretor para o final da fila
    await moverCorretorParaFinalFila(corretorId);
    
    // Registrar log de distribuição
    await db.insert(distributionLog).values({
      leadId: leadCriado.id,
      corretorId,
      tipo: 'automatica',
      motivo: 'Distribuição automática via Fila Foco (sem limites)',
    });
    
    // Criar follow-up automático
    try {
      await criarFollowUpParaLead(leadCriado.id, corretorId);
    } catch (e) {
      console.log('[Webhook Foco] Erro ao criar follow-up:', e);
    }
    
    // Notificar corretor
    await notifyLeadDistribuido(corretorId, leadCriado.id, leadCriado.nome);
    
    // Notificar corretor via Email e Zapier (WhatsApp)
    try {
      const corretor = await getUserById(corretorId);
      const projeto = leadCriado.projectId ? await getProjectById(leadCriado.projectId) : null;
      
      if (corretor) {
        // Enviar notificação por EMAIL
        try {
          const { enviarNotificacaoLeadWebhook } = await import('./emailService');
          await enviarNotificacaoLeadWebhook({
            corretorNome: corretor.name,
            corretorEmail: corretor.email,
            leadNome: leadCriado.nome,
            leadTelefone: leadCriado.telefone,
            leadEmail: leadCriado.email || undefined,
            leadOrigem: leadCriado.origem,
            leadProjeto: projeto?.nome,
            leadCampanha: undefined,
            leadFaixaRenda: leadCriado.faixaRenda || undefined,
          });
          console.log('[Webhook Foco] Notificação por email enviada para:', corretor.email);
        } catch (emailError) {
          console.error('[Webhook Foco] Erro ao enviar email:', emailError);
        }
        
        // Enviar notificação via Zapier (WhatsApp) - se configurado
        try {
          const { notificarCorretorLeadWebhook } = await import('./zapierWebhook');
          await notificarCorretorLeadWebhook({
            corretor: {
              id: corretor.id,
              nome: corretor.name,
              telefone: corretor.telefone || undefined,
              email: corretor.email,
            },
            lead: {
              id: leadCriado.id,
              nome: leadCriado.nome,
              telefone: leadCriado.telefone,
              email: leadCriado.email || undefined,
              status: leadCriado.status,
              origem: leadCriado.origem,
              projeto: projeto?.nome,
            },
          });
        } catch (zapierError) {
          console.error('[Webhook Foco] Erro ao notificar via Zapier:', zapierError);
        }
      }
    } catch (error) {
      console.error('[Webhook Foco] Erro ao notificar corretor:', error);
    }
    
    console.log(`[Webhook Foco] Lead ${leadCriado.id} distribuído para corretor ${corretorId} (Fila Foco)`);
  }
  
  return {
    lead: leadCriado,
    corretorId,
    distribuido: corretorId !== null,
  };
}

// Buscar novas notificações desde um timestamp (para polling em tempo real)
export async function getNewNotificationsSince(userId: number, since: Date) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      gt(notifications.createdAt, since)
    ))
    .orderBy(desc(notifications.createdAt));
}


// ============================================================================
// HISTÓRICO DE DISTRIBUIÇÃO
// ============================================================================

export interface HistoricoDistribuicaoItem {
  id: number;
  leadId: number;
  leadNome: string;
  leadTelefone: string | null;
  corretorId: number;
  corretorNome: string | null;
  tipo: 'automatica' | 'manual' | 'inicial';
  motivo: string | null;
  distribuidoPorId: number | null;
  distribuidoPorNome: string | null;
  createdAt: Date;
}

export async function getHistoricoDistribuicao(filtros?: {
  dataInicio?: Date;
  dataFim?: Date;
  corretorId?: number;
  tipo?: 'automatica' | 'manual' | 'inicial';
  limit?: number;
  offset?: number;
}): Promise<{ items: HistoricoDistribuicaoItem[]; total: number }> {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  
  const conditions = [];
  
  if (filtros?.dataInicio) {
    conditions.push(gte(distributionLog.createdAt, filtros.dataInicio));
  }
  
  if (filtros?.dataFim) {
    conditions.push(lte(distributionLog.createdAt, filtros.dataFim));
  }
  
  if (filtros?.corretorId) {
    conditions.push(eq(distributionLog.corretorId, filtros.corretorId));
  }
  
  if (filtros?.tipo) {
    conditions.push(eq(distributionLog.tipo, filtros.tipo));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  // Contar total
  const countResult = await db.select({ count: sql<number>`count(*)` })
    .from(distributionLog)
    .where(whereClause);
  
  const total = Number(countResult[0]?.count || 0);
  
  // Buscar items com joins
  const items = await db.select({
    id: distributionLog.id,
    leadId: distributionLog.leadId,
    leadNome: leads.nome,
    leadTelefone: leads.telefone,
    corretorId: distributionLog.corretorId,
    corretorNome: users.name,
    tipo: distributionLog.tipo,
    motivo: distributionLog.motivo,
    distribuidoPorId: distributionLog.distribuidoPorId,
    createdAt: distributionLog.createdAt,
  })
    .from(distributionLog)
    .leftJoin(leads, eq(distributionLog.leadId, leads.id))
    .leftJoin(users, eq(distributionLog.corretorId, users.id))
    .where(whereClause)
    .orderBy(desc(distributionLog.createdAt))
    .limit(filtros?.limit || 50)
    .offset(filtros?.offset || 0);
  
  // Buscar nomes dos distribuidores (se manual)
  const itemsWithDistribuidor = await Promise.all(items.map(async (item) => {
    let distribuidoPorNome: string | null = null;
    if (item.distribuidoPorId) {
      const distribuidor = await db.select({ name: users.name })
        .from(users)
        .where(eq(users.id, item.distribuidoPorId))
        .limit(1);
      distribuidoPorNome = distribuidor[0]?.name || null;
    }
    return {
      ...item,
      distribuidoPorNome,
    } as HistoricoDistribuicaoItem;
  }));
  
  return { items: itemsWithDistribuidor, total };
}

// Contar distribuições por período
export async function getDistribuicoesPorPeriodo(dias: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - dias);
  
  // Usar raw SQL para evitar problemas com ONLY_FULL_GROUP_BY
  const result = await db.execute(sql`
    SELECT 
      DATE(createdAt) as data,
      SUM(CASE WHEN tipo = 'automatica' THEN 1 ELSE 0 END) as automaticas,
      SUM(CASE WHEN tipo = 'manual' THEN 1 ELSE 0 END) as manuais,
      COUNT(*) as total
    FROM distribution_log
    WHERE createdAt >= ${dataInicio}
    GROUP BY DATE(createdAt)
    ORDER BY DATE(createdAt)
  `);
  
  const rows = (result as any)[0] as any[];
  return rows.map(r => ({
    data: String(r.data),
    automaticas: Number(r.automaticas || 0),
    manuais: Number(r.manuais || 0),
    total: Number(r.total || 0),
  }));
}


// ============================================================================
// DASHBOARD DO CORRETOR - MÉTRICAS INDIVIDUAIS
// ============================================================================

export async function getCorretorDashboardMetrics(corretorId: number, filtros?: DashboardFilters) {
  const db = await getDb();
  if (!db) return null;
  
  const conditions: any[] = [eq(leads.corretorId, corretorId)];
  
  if (filtros?.dataInicio) {
    conditions.push(gte(leads.createdAt, filtros.dataInicio));
  }
  
  if (filtros?.dataFim) {
    conditions.push(lte(leads.createdAt, filtros.dataFim));
  }
  
  const whereClause = and(...conditions);
  
  // Total de leads
  const totalResult = await db.select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(whereClause);
  
  // Leads por status
  const statusCounts = await Promise.all([
    db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(...conditions, eq(leads.status, 'aguardando_atendimento'))),
    db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(...conditions, eq(leads.status, 'em_atendimento'))),
    db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(...conditions, eq(leads.status, 'agendado'))),
    db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(...conditions, eq(leads.status, 'visita_realizada'))),
    db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(...conditions, eq(leads.status, 'analise_credito'))),
    db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(...conditions, eq(leads.status, 'contrato_fechado'))),
    db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(...conditions, eq(leads.status, 'perdido'))),
    db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(...conditions, eq(leads.status, 'novo'))),
  ]);
  
  // VGV do corretor
  const vgvResult = await db.select({ 
    total: sql<number>`COALESCE(SUM(${projects.valorMinimo}), 0)` 
  })
    .from(leads)
    .leftJoin(projects, eq(leads.projectId, projects.id))
    .where(and(...conditions, eq(leads.status, 'contrato_fechado')));
  
  const total = Number(totalResult[0]?.count || 0);
  const contratosFechados = Number(statusCounts[5][0]?.count || 0);
  const taxaConversao = total > 0 ? Math.round((contratosFechados / total) * 100) : 0;
  
  return {
    total,
    novos: Number(statusCounts[7][0]?.count || 0),
    aguardando: Number(statusCounts[0][0]?.count || 0),
    emAtendimento: Number(statusCounts[1][0]?.count || 0),
    agendado: Number(statusCounts[2][0]?.count || 0),
    visitaRealizada: Number(statusCounts[3][0]?.count || 0),
    analiseCredito: Number(statusCounts[4][0]?.count || 0),
    contratoFechado: contratosFechados,
    perdido: Number(statusCounts[6][0]?.count || 0),
    vgv: Number(vgvResult[0]?.total || 0),
    taxaConversao,
  };
}

export async function getCorretorMetricasHistoricas(corretorId: number, dias: number = 30): Promise<MetricasDiarias[]> {
  const db = await getDb();
  if (!db) return [];
  
  const resultado: MetricasDiarias[] = [];
  const hoje = new Date();
  
  for (let i = dias - 1; i >= 0; i--) {
    const data = new Date(hoje);
    data.setDate(data.getDate() - i);
    data.setHours(0, 0, 0, 0);
    
    const dataFim = new Date(data);
    dataFim.setHours(23, 59, 59, 999);
    
    const dataStr = data.toISOString().split('T')[0];
    
    // Buscar leads do corretor criados nesse dia
    const leadsNoDia = await db.select({
      status: leads.status,
      count: sql<number>`count(*)`
    })
      .from(leads)
      .where(and(
        eq(leads.corretorId, corretorId),
        gte(leads.createdAt, data),
        lte(leads.createdAt, dataFim)
      ))
      .groupBy(leads.status);
    
    const metricas: MetricasDiarias = {
      data: dataStr,
      novos: 0,
      aguardando: 0,
      emAtendimento: 0,
      agendados: 0,
      visitasRealizadas: 0,
      analiseCredito: 0,
      contratosFechados: 0,
      perdidos: 0,
      total: 0,
    };
    
    for (const row of leadsNoDia) {
      const count = Number(row.count);
      metricas.total += count;
      
      switch (row.status) {
        case 'novo': metricas.novos = count; break;
        case 'aguardando_atendimento': metricas.aguardando = count; break;
        case 'em_atendimento': metricas.emAtendimento = count; break;
        case 'agendado': metricas.agendados = count; break;
        case 'visita_realizada': metricas.visitasRealizadas = count; break;
        case 'analise_credito': metricas.analiseCredito = count; break;
        case 'contrato_fechado': metricas.contratosFechados = count; break;
        case 'perdido': metricas.perdidos = count; break;
      }
    }
    
    resultado.push(metricas);
  }
  
  return resultado;
}

export async function getCorretorEvolucaoFunil(corretorId: number, dias: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const hoje = new Date();
  const dataInicio = new Date(hoje);
  dataInicio.setDate(dataInicio.getDate() - dias);
  dataInicio.setHours(0, 0, 0, 0);
  
  // Buscar totais acumulados por status do corretor
  const totais = await db.select({
    status: leads.status,
    count: sql<number>`count(*)`
  })
    .from(leads)
    .where(and(
      eq(leads.corretorId, corretorId),
      gte(leads.createdAt, dataInicio)
    ))
    .groupBy(leads.status);
  
  const funil = [
    { etapa: 'Novos', valor: 0, cor: '#6366f1' },
    { etapa: 'Aguardando', valor: 0, cor: '#f59e0b' },
    { etapa: 'Em Atendimento', valor: 0, cor: '#3b82f6' },
    { etapa: 'Agendados', valor: 0, cor: '#8b5cf6' },
    { etapa: 'Visitas', valor: 0, cor: '#06b6d4' },
    { etapa: 'Análise de Crédito', valor: 0, cor: '#f97316' },
    { etapa: 'Contratos Fechados', valor: 0, cor: '#22c55e' },
    { etapa: 'Perdidos', valor: 0, cor: '#ef4444' },
  ];
  
  for (const row of totais) {
    const count = Number(row.count);
    switch (row.status) {
      case 'novo': funil[0].valor = count; break;
      case 'aguardando_atendimento': funil[1].valor = count; break;
      case 'em_atendimento': funil[2].valor = count; break;
      case 'agendado': funil[3].valor = count; break;
      case 'visita_realizada': funil[4].valor = count; break;
      case 'analise_credito': funil[5].valor = count; break;
      case 'contrato_fechado': funil[6].valor = count; break;
      case 'perdido': funil[7].valor = count; break;
    }
  }
  
  return funil;
}


// ============================================================================
// TAREFAS DO CORRETOR
// ============================================================================

export async function createTarefa(tarefa: InsertTarefa) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(tarefas).values(tarefa);
  return result[0].insertId;
}

export async function getTarefasByCorretor(corretorId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(tarefas)
    .where(eq(tarefas.corretorId, corretorId))
    .orderBy(desc(tarefas.dataAgendada));
}

export async function getTarefasDoDia(corretorId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  
  return await db.select({
    id: tarefas.id,
    titulo: tarefas.titulo,
    descricao: tarefas.descricao,
    tipo: tarefas.tipo,
    dataAgendada: tarefas.dataAgendada,
    status: tarefas.status,
    prioridade: tarefas.prioridade,
    leadId: tarefas.leadId,
    leadNome: leads.nome,
    leadTelefone: leads.telefone,
    leadEmail: leads.email,
  })
    .from(tarefas)
    .leftJoin(leads, eq(tarefas.leadId, leads.id))
    .where(and(
      eq(tarefas.corretorId, corretorId),
      eq(tarefas.status, "pendente"),
      gte(tarefas.dataAgendada, hoje),
      lte(tarefas.dataAgendada, amanha)
    ))
    .orderBy(tarefas.prioridade, tarefas.dataAgendada);
}

export async function updateTarefa(id: number, data: Partial<InsertTarefa>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(tarefas)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tarefas.id, id));
}

export async function getTarefaById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(tarefas)
    .where(eq(tarefas.id, id))
    .limit(1);
  
  return result[0] || null;
}

export async function concluirTarefa(id: number, observacoes?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(tarefas)
    .set({ 
      status: "concluida", 
      concluidaEm: new Date(),
      observacoesConclusao: observacoes,
      updatedAt: new Date() 
    })
    .where(eq(tarefas.id, id));
}

export async function updateLeadProximaTarefaData(leadId: number, data: Date | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(leads)
    .set({ proximaTarefaData: data })
    .where(eq(leads.id, leadId));
}

export async function deleteTarefa(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(tarefas).where(eq(tarefas.id, id));
}

// ============================================================================
// FOLLOW-UPS AUTOMÁTICOS
// ============================================================================

export async function createFollowUp(followUp: InsertFollowUp) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(followUps).values(followUp);
  return result[0].insertId;
}

export async function getFollowUpByLead(leadId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(followUps)
    .where(eq(followUps.leadId, leadId))
    .limit(1);
  
  return result[0] || null;
}

export async function getFollowUpsPendentes(corretorId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const agora = new Date();
  
  return await db.select({
    id: followUps.id,
    leadId: followUps.leadId,
    dataFollowUp: followUps.dataFollowUp,
    dataRegistro: followUps.dataRegistro,
    resultado: followUps.resultado,
    observacao: followUps.observacao,
    status: followUps.status,
    leadNome: leads.nome,
    leadTelefone: leads.telefone,
    leadEmail: leads.email,
    leadStatus: leads.status,
    diasFollowupConsecutivos: leads.diasFollowupConsecutivos,
  })
    .from(followUps)
    .innerJoin(leads, eq(followUps.leadId, leads.id))
    .where(and(
      eq(followUps.corretorId, corretorId),
      eq(followUps.status, "pendente"),
      lte(followUps.dataFollowUp, agora),
      // Excluir leads que têm tarefa agendada no futuro
      or(
        isNull(leads.proximaTarefaData),
        lte(leads.proximaTarefaData, agora)
      )
    ))
    .orderBy(followUps.dataFollowUp);
}

export async function getFollowUpsDoDia(corretorId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Usar timezone de São Paulo
  const { fimDoDiaHoje, inicioDoDiaHoje } = await import('./timezone');
  const inicioDeHoje = inicioDoDiaHoje(); // 00:00:00 de hoje
  const fimDeHoje = fimDoDiaHoje(); // 23:59:59.999 de hoje
  
  const agora = new Date();
  
  return await db.select({
    id: followUps.id,
    leadId: followUps.leadId,
    dataFollowUp: followUps.dataFollowUp,
    dataRegistro: followUps.dataRegistro,
    resultado: followUps.resultado,
    status: followUps.status,
    leadNome: leads.nome,
    leadTelefone: leads.telefone,
    leadEmail: leads.email,
    leadStatus: leads.status,
  })
    .from(followUps)
    .innerJoin(leads, eq(followUps.leadId, leads.id))
    .where(and(
      eq(followUps.corretorId, corretorId),
      eq(followUps.status, "pendente"),
      gte(followUps.dataFollowUp, inicioDeHoje),
      lte(followUps.dataFollowUp, fimDeHoje),
      // Excluir leads que têm tarefa agendada no futuro
      or(
        isNull(leads.proximaTarefaData),
        lte(leads.proximaTarefaData, agora)
      )
    ))
    .orderBy(followUps.dataFollowUp);
}

export async function registrarTentativaFollowUp(
  followUpId: number, 
  resultado: "nao_atendeu" | "respondeu" | "outro",
  observacao?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar follow-up atual
  const followUp = await db.select()
    .from(followUps)
    .where(eq(followUps.id, followUpId))
    .limit(1);
  
  if (!followUp[0]) throw new Error("Follow-up não encontrado");
  
  const atual = followUp[0];
  const agora = new Date();
  
  // Buscar dados do lead
  const leadData = await db.select().from(leads).where(eq(leads.id, atual.leadId)).limit(1);
  if (!leadData[0]) throw new Error("Lead não encontrado");
  const lead = leadData[0];
  
  if (resultado === "respondeu") {
    // Cliente respondeu - marcar follow-up atual como concluído
    await db.update(followUps)
      .set({
        status: "concluido",
        resultado: "respondeu",
        observacao,
        dataRegistro: agora,
        updatedAt: agora
      })
      .where(eq(followUps.id, followUpId));
    
    // Atualizar ultimaInteracao do lead
    await db.update(leads)
      .set({
        ultimaInteracao: agora,
        updatedAt: agora
      })
      .where(eq(leads.id, atual.leadId));
    
    // Criar novo follow-up para amanhã às 09:00 (se lead ainda estiver em atendimento)
    if (lead.status === "em_atendimento") {
      const { proximoDiaAs9h } = await import('./timezone');
      const proximoFollowUp = proximoDiaAs9h();
      
      // Verificar se já existe follow-up pendente para este lead na mesma data
      const existente = await db.select()
        .from(followUps)
        .where(and(
          eq(followUps.leadId, atual.leadId),
          eq(followUps.corretorId, atual.corretorId),
          eq(followUps.status, "pendente"),
          sql`DATE(${followUps.dataFollowUp}) = DATE(${proximoFollowUp})`
        ))
        .limit(1);
      
      if (!existente[0]) {
        await db.insert(followUps).values({
          leadId: atual.leadId,
          corretorId: atual.corretorId,
          dataFollowUp: proximoFollowUp,
          status: "pendente"
        });
        
        console.log(`[registrarTentativaFollowUp] Novo follow-up criado para lead ${atual.leadId} em ${proximoFollowUp.toISOString()}`);
      } else {
        console.log(`[registrarTentativaFollowUp] Follow-up já existe para lead ${atual.leadId} em ${proximoFollowUp.toISOString()}, pulando criação`);
      }
    }
    
    return { 
      status: "respondeu", 
      mensagem: "Cliente respondeu! Novo follow-up criado para amanhã às 09:00."
    };
  }
  
  // resultado === "nao_atendeu" ou "outro"
  // Cliente não respondeu - marcar follow-up como concluído SEM criar novo follow-up
  await db.update(followUps)
    .set({
      status: "concluido",
      resultado: "nao_respondeu",
      observacao,
      dataRegistro: agora,
      updatedAt: agora
    })
    .where(eq(followUps.id, followUpId));
  
  // Atualizar ultimaInteracao do lead (para contagem de 2 dias sem interação)
  await db.update(leads)
    .set({
      ultimaInteracao: agora,
      updatedAt: agora
    })
    .where(eq(leads.id, atual.leadId));
  
  return { 
    status: "nao_respondeu", 
    mensagem: "Registrado. Lead volta para sua base sem follow-up agendado."
  };
}

export async function criarFollowUpParaLead(leadId: number, corretorId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Verificar se já existe follow-up pendente para este lead
  const existente = await db.select()
    .from(followUps)
    .where(and(
      eq(followUps.leadId, leadId),
      eq(followUps.status, "pendente")
    ))
    .limit(1);
  
  if (existente[0]) {
    return existente[0].id; // Já existe, retorna o ID
  }
  
  // Criar novo follow-up para AMANHÃ às 9h (novo fluxo de 1 dia)
  // Usar timezone de São Paulo
  const { agora } = await import('./timezone');
  const amanha = agora();
  amanha.setDate(amanha.getDate() + 1);
  amanha.setHours(9, 0, 0, 0);
  
  const result = await db.insert(followUps).values({
    leadId,
    corretorId,
    dataFollowUp: amanha,
    status: "pendente"
  });
  
  return result[0].insertId;
}

/**
 * [DESABILITADO] Função antiga de criação automática de follow-ups
 * No novo fluxo de 1 dia, follow-ups são criados APENAS quando lead muda para "em_atendimento"
 * via função criarFollowUpParaLead()
 */
export async function criarFollowUpsAutomaticos(corretorId: number) {
  // Função desabilitada no novo fluxo
  return { criados: 0 };
}

/**
 * Busca follow-ups pendentes para hoje (novo fluxo de 1 dia)
 * Retorna leads que têm follow-up agendado para hoje e ainda não foi registrado
 */
/**
 * Busca follow-ups pendentes para hoje (novo fluxo de 1 dia)
 * Retorna leads que têm follow-up agendado para hoje e ainda não foi registrado
 */
/**
 * Busca follow-ups pendentes para hoje (ABORDAGEM 3: Duas queries separadas)
 * Query 1: Buscar follow-ups pendentes de hoje
 * Query 2: Buscar dados dos leads correspondentes
 */
/**
 * Busca follow-ups pendentes para hoje (ABORDAGEM 4: Drizzle ORM correto)
 * Usa leftJoin, funções nativas do Drizzle e comparação de data correta
 */
export async function getFollowUpsDoDiaExpandido(
  corretorId: number,
  ordenacao?: "mais_antigos" | "mais_recentes" | "menos_tentativas" | "mais_tentativas",
  projetoId?: number,
  origem?: string
) {
  const db = await getDb();
  if (!db) {
    console.log("[getFollowUpsDoDiaExpandido] Erro: banco de dados não disponível");
    return [];
  }
  
  try {
    // Buscar data de hoje (timezone São Paulo)
    const { inicioDoDiaHoje } = await import('./timezone');
    const hoje = inicioDoDiaHoje();
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    
    console.log("[getFollowUpsDoDiaExpandido] Buscando follow-ups para corretorId:", corretorId);
    console.log("[getFollowUpsDoDiaExpandido] Período: de", hoje.toISOString(), "até", amanha.toISOString());
    
    // Construir condições de filtro
    const conditions = [
      eq(followUps.corretorId, corretorId),
      eq(followUps.status, "pendente"),
      gte(followUps.dataFollowUp, hoje),
      lt(followUps.dataFollowUp, amanha),
      eq(leads.status, "em_atendimento") // APENAS leads Em Atendimento aparecem em Tarefas do Dia
    ];
    
    // Filtro por projeto (aplicado no lead)
    if (projetoId) {
      conditions.push(eq(leads.projectId, projetoId));
    }
    
    // Filtro por origem (aplicado no lead)
    if (origem) {
      conditions.push(eq(leads.origem, origem));
    }
    
    // Query com leftJoin
    let query = db.select({
      id: followUps.id,
      leadId: followUps.leadId,
      dataFollowUp: followUps.dataFollowUp,
      dataRegistro: followUps.dataRegistro,
      resultado: followUps.resultado,
      status: followUps.status,
      leadNome: leads.nome,
      leadTelefone: leads.telefone,
      leadEmail: leads.email,
      leadStatus: leads.status,
      leadProjectId: leads.projectId,
      leadOrigem: leads.origem,
      leadCriadoEm: leads.createdAt,
    })
      .from(followUps)
      .leftJoin(leads, eq(followUps.leadId, leads.id))
      .where(and(...conditions));
    
    // Aplicar ordenação
    switch (ordenacao) {
      case "mais_recentes":
        query = query.orderBy(desc(leads.createdAt));
        break;
      case "mais_antigos":
      default:
        query = query.orderBy(asc(leads.createdAt));
        break;
    }
    
    const resultado = await query;
    
    console.log("[getFollowUpsDoDiaExpandido] Resultado: encontrados", resultado.length, "follow-ups");
    
    return resultado;
    
  } catch (error) {
    console.error('[getFollowUpsDoDiaExpandido] Erro:', error);
    return [];
  }
}

// Buscar leads agendados para Tarefas do Dia
// Mostra agendamentos: 24h antes do horário E no dia do agendamento
export async function getLeadsAgendadosHoje(corretorId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const agora = new Date();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  // Fim do dia de hoje (23:59:59)
  const fimDeHoje = new Date(hoje);
  fimDeHoje.setHours(23, 59, 59, 999);
  
  // 24h a partir de agora (para mostrar agendamentos das próximas 24h)
  const em24h = new Date(agora);
  em24h.setHours(em24h.getHours() + 24);
  
  // Buscar leads agendados que:
  // 1. São para hoje (qualquer horário)
  // 2. OU são para as próximas 24h (inclui amanhã se for menos de 24h)
  return await db.select()
    .from(leads)
    .where(and(
      eq(leads.corretorId, corretorId),
      eq(leads.status, "agendado"),
      or(
        // Agendamentos de hoje
        and(
          gte(leads.proximoFollowup, hoje),
          lte(leads.proximoFollowup, fimDeHoje)
        ),
        // Agendamentos nas próximas 24h (inclui amanhã se estiver dentro de 24h)
        and(
          gte(leads.proximoFollowup, agora),
          lte(leads.proximoFollowup, em24h)
        )
      )
    ))
    .orderBy(leads.proximoFollowup);
}


// ============================================================================
// ATIVIDADES DIÁRIAS E RANKING TV
// ============================================================================

// Obter ou criar registro de atividade diária do corretor
export async function getOrCreateAtividadeDiaria(corretorId: number, data?: Date): Promise<AtividadeDiaria | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Usar timezone de São Paulo se data não for fornecida
  let dataRef: Date;
  if (data) {
    dataRef = new Date(data);
    dataRef.setHours(0, 0, 0, 0);
  } else {
    const { inicioDoDiaHoje } = await import('./timezone');
    dataRef = inicioDoDiaHoje();
  }
  
  // Buscar registro existente
  const existing = await db.select()
    .from(atividadesDiarias)
    .where(and(
      eq(atividadesDiarias.corretorId, corretorId),
      eq(atividadesDiarias.data, dataRef)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    return existing[0];
  }
  
  // Criar novo registro
  const result = await db.insert(atividadesDiarias).values({
    corretorId,
    data: dataRef,
  });
  
  const newRecord = await db.select()
    .from(atividadesDiarias)
    .where(eq(atividadesDiarias.id, result[0].insertId))
    .limit(1);
  
  return newRecord[0] || null;
}

// Incrementar atividade específica
export async function incrementarAtividade(
  corretorId: number, 
  tipo: 'ligacoesRealizadas' | 'ligacoesAtendidas' | 'whatsappEnviados' | 'whatsappRespondidos' | 
        'agendamentosConfirmados' | 'visitasRealizadas' | 'propostasEnviadas' | 
        'documentacoesRecolhidas' | 'analiseCreditoEnviadas' | 'contratosFechados',
  quantidade: number = 1
) {
  const db = await getDb();
  if (!db) return;
  
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  // Garantir que existe o registro
  await getOrCreateAtividadeDiaria(corretorId, hoje);
  
  // Incrementar o campo específico
  await db.update(atividadesDiarias)
    .set({
      [tipo]: sql`${atividadesDiarias[tipo]} + ${quantidade}`,
      updatedAt: new Date()
    })
    .where(and(
      eq(atividadesDiarias.corretorId, corretorId),
      eq(atividadesDiarias.data, hoje)
    ));
}

// Adicionar VGV do dia
export async function adicionarVgvDia(corretorId: number, valor: number) {
  const db = await getDb();
  if (!db) return;
  
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  await getOrCreateAtividadeDiaria(corretorId, hoje);
  
  await db.update(atividadesDiarias)
    .set({
      vgvDia: sql`${atividadesDiarias.vgvDia} + ${valor}`,
      contratosFechados: sql`${atividadesDiarias.contratosFechados} + 1`,
      updatedAt: new Date()
    })
    .where(and(
      eq(atividadesDiarias.corretorId, corretorId),
      eq(atividadesDiarias.data, hoje)
    ));
}

// Obter ranking do dia para TV Dashboard
export async function getRankingDia(data?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  // Usar início e fim do dia para evitar problemas de fuso horário
  const dataRef = data || new Date();
  const inicioDia = new Date(dataRef);
  inicioDia.setHours(0, 0, 0, 0);
  const fimDia = new Date(dataRef);
  fimDia.setHours(23, 59, 59, 999);
  
  // Buscar TODOS os corretores ativos e fazer LEFT JOIN com atividades do dia
  const todosCorretores = await db.select({
    corretorId: users.id,
    corretorNome: users.name,
    corretorFoto: users.fotoUrl,
  })
    .from(users)
    .where(eq(users.role, 'corretor'));
  
  // Para cada corretor, buscar suas atividades do dia
  const ranking = await Promise.all(todosCorretores.map(async (corretor) => {
    // Buscar atividades do corretor no dia
    const atividadesCorretor = await db.select()
      .from(atividadesDiarias)
      .where(and(
        eq(atividadesDiarias.corretorId, corretor.corretorId),
        gte(atividadesDiarias.data, inicioDia),
        lte(atividadesDiarias.data, fimDia)
      ));
    
    // Somar todas as atividades do corretor no dia
    const totais = atividadesCorretor.reduce((acc, ativ) => ({
      ligacoesRealizadas: acc.ligacoesRealizadas + ativ.ligacoesRealizadas,
      ligacoesAtendidas: acc.ligacoesAtendidas + ativ.ligacoesAtendidas,
      whatsappEnviados: acc.whatsappEnviados + ativ.whatsappEnviados,
      whatsappRespondidos: acc.whatsappRespondidos + ativ.whatsappRespondidos,
      agendamentosConfirmados: acc.agendamentosConfirmados + ativ.agendamentosConfirmados,
      visitasRealizadas: acc.visitasRealizadas + ativ.visitasRealizadas,
      propostasEnviadas: acc.propostasEnviadas + ativ.propostasEnviadas,
      documentacoesRecolhidas: acc.documentacoesRecolhidas + ativ.documentacoesRecolhidas,
      analiseCreditoEnviadas: acc.analiseCreditoEnviadas + ativ.analiseCreditoEnviadas,
      contratosFechados: acc.contratosFechados + ativ.contratosFechados,
      vgvDia: acc.vgvDia + ativ.vgvDia,
      pontuacaoTotal: acc.pontuacaoTotal + ativ.pontuacaoTotal,
    }), {
      ligacoesRealizadas: 0,
      ligacoesAtendidas: 0,
      whatsappEnviados: 0,
      whatsappRespondidos: 0,
      agendamentosConfirmados: 0,
      visitasRealizadas: 0,
      propostasEnviadas: 0,
      documentacoesRecolhidas: 0,
      analiseCreditoEnviadas: 0,
      contratosFechados: 0,
      vgvDia: 0,
      pontuacaoTotal: 0,
    });
    
    // Buscar metas do corretor
    const metasCorretor = await db.select()
      .from(metas)
      .where(eq(metas.corretorId, corretor.corretorId))
      .limit(1);
    
    const meta = metasCorretor[0];
    
    return {
      id: corretor.corretorId,
      corretorId: corretor.corretorId,
      corretorNome: corretor.corretorNome,
      corretorFoto: corretor.corretorFoto,
      ...totais,
      metas: meta ? {
        ligacoesMeta: Math.ceil(meta.metaLeads / 22) || 0,
        agendamentosMeta: Math.ceil(meta.metaAgendamentos / 22) || 0,
        visitasMeta: Math.ceil(meta.metaVisitas / 22) || 0,
        contratosMeta: Math.ceil(meta.metaContratos / 22) || 0,
      } : null
    };
  }));
  
  // Ordenar por pontuação (maior para menor)
  return ranking.sort((a, b) => b.pontuacaoTotal - a.pontuacaoTotal);
}

// Obter ranking por período (com filtro de datas)
export async function getRankingPorPeriodo(dataInicio?: Date, dataFim?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  // Se não tiver datas, retornar tudo
  const conditions = [];
  
  if (dataInicio) {
    const inicio = new Date(dataInicio);
    inicio.setHours(0, 0, 0, 0);
    conditions.push(gte(atividadesDiarias.data, inicio));
  }
  
  if (dataFim) {
    const fim = new Date(dataFim);
    fim.setHours(23, 59, 59, 999);
    conditions.push(lte(atividadesDiarias.data, fim));
  }
  
  const ranking = await db.select({
    corretorId: atividadesDiarias.corretorId,
    corretorNome: users.name,
    corretorFoto: users.fotoUrl,
    totalLigacoes: sql<number>`SUM(${atividadesDiarias.ligacoesRealizadas})`,
    totalWhatsapp: sql<number>`SUM(${atividadesDiarias.whatsappEnviados})`,
    totalAgendamentos: sql<number>`SUM(${atividadesDiarias.agendamentosConfirmados})`,
    totalVisitas: sql<number>`SUM(${atividadesDiarias.visitasRealizadas})`,
    totalDocumentacoes: sql<number>`SUM(${atividadesDiarias.documentacoesRecolhidas})`,
    totalAnalises: sql<number>`SUM(${atividadesDiarias.analiseCreditoEnviadas})`,
    totalContratos: sql<number>`SUM(${atividadesDiarias.contratosFechados})`,
    totalVgv: sql<number>`SUM(${atividadesDiarias.vgvDia})`,
    totalPontos: sql<number>`SUM(${atividadesDiarias.pontuacaoTotal})`,
  })
    .from(atividadesDiarias)
    .innerJoin(users, eq(atividadesDiarias.corretorId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(atividadesDiarias.corretorId, users.name, users.fotoUrl)
    .orderBy(desc(sql`SUM(${atividadesDiarias.pontuacaoTotal})`));
  
  return ranking;
}

// Obter ranking semanal
export async function getRankingSemanal() {
  const db = await getDb();
  if (!db) return [];
  
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  // Início da semana (segunda-feira)
  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(hoje.getDate() - hoje.getDay() + 1);
  
  // Buscar TODOS os corretores ativos
  const todosCorretores = await db.select({
    corretorId: users.id,
    corretorNome: users.name,
    corretorFoto: users.fotoUrl,
  })
    .from(users)
    .where(eq(users.role, 'corretor'));
  
  // Para cada corretor, buscar suas atividades da semana
  const ranking = await Promise.all(todosCorretores.map(async (corretor) => {
    const atividadesCorretor = await db.select()
      .from(atividadesDiarias)
      .where(and(
        eq(atividadesDiarias.corretorId, corretor.corretorId),
        gte(atividadesDiarias.data, inicioSemana)
      ));
    
    // Somar todas as atividades
    const totais = atividadesCorretor.reduce((acc, ativ) => ({
      totalLigacoes: acc.totalLigacoes + ativ.ligacoesRealizadas,
      totalAgendamentos: acc.totalAgendamentos + ativ.agendamentosConfirmados,
      totalVisitas: acc.totalVisitas + ativ.visitasRealizadas,
      totalDocumentacoes: acc.totalDocumentacoes + ativ.documentacoesRecolhidas,
      totalContratos: acc.totalContratos + ativ.contratosFechados,
      totalVgv: acc.totalVgv + ativ.vgvDia,
      totalPontos: acc.totalPontos + ativ.pontuacaoTotal,
    }), {
      totalLigacoes: 0,
      totalAgendamentos: 0,
      totalVisitas: 0,
      totalDocumentacoes: 0,
      totalContratos: 0,
      totalVgv: 0,
      totalPontos: 0,
    });
    
    return {
      corretorId: corretor.corretorId,
      corretorNome: corretor.corretorNome,
      corretorFoto: corretor.corretorFoto,
      ...totais,
    };
  }));
  
  // Ordenar por pontuação (maior para menor)
  return ranking.sort((a, b) => b.totalPontos - a.totalPontos);
}

// Obter ranking mensal
export async function getRankingMensal() {
  const db = await getDb();
  if (!db) return [];
  
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  
  // Buscar TODOS os corretores ativos
  const todosCorretores = await db.select({
    corretorId: users.id,
    corretorNome: users.name,
    corretorFoto: users.fotoUrl,
  })
    .from(users)
    .where(eq(users.role, 'corretor'));
  
  // Para cada corretor, buscar suas atividades do mês
  const ranking = await Promise.all(todosCorretores.map(async (corretor) => {
    const atividadesCorretor = await db.select()
      .from(atividadesDiarias)
      .where(and(
        eq(atividadesDiarias.corretorId, corretor.corretorId),
        gte(atividadesDiarias.data, inicioMes)
      ));
    
    // Somar todas as atividades
    const totais = atividadesCorretor.reduce((acc, ativ) => ({
      totalLigacoes: acc.totalLigacoes + ativ.ligacoesRealizadas,
      totalAgendamentos: acc.totalAgendamentos + ativ.agendamentosConfirmados,
      totalVisitas: acc.totalVisitas + ativ.visitasRealizadas,
      totalDocumentacoes: acc.totalDocumentacoes + ativ.documentacoesRecolhidas,
      totalContratos: acc.totalContratos + ativ.contratosFechados,
      totalVgv: acc.totalVgv + ativ.vgvDia,
      totalPontos: acc.totalPontos + ativ.pontuacaoTotal,
    }), {
      totalLigacoes: 0,
      totalAgendamentos: 0,
      totalVisitas: 0,
      totalDocumentacoes: 0,
      totalContratos: 0,
      totalVgv: 0,
      totalPontos: 0,
    });
    
    return {
      corretorId: corretor.corretorId,
      corretorNome: corretor.corretorNome,
      corretorFoto: corretor.corretorFoto,
      ...totais,
    };
  }));
  
  // Ordenar por pontuação (maior para menor)
  return ranking.sort((a, b) => b.totalPontos - a.totalPontos);
}

// Calcular e atualizar pontuação do corretor baseado nas metas
export async function calcularPontuacaoDiaria(corretorId: number) {
  const db = await getDb();
  if (!db) return;
  
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  // Buscar atividade do dia
  const atividade = await getOrCreateAtividadeDiaria(corretorId, hoje);
  if (!atividade) return;
  
  // Buscar metas do corretor
  const metasCorretor = await db.select()
    .from(metas)
    .where(eq(metas.corretorId, corretorId))
    .limit(1);
  
  const meta = metasCorretor[0];
  
  // Sistema de pontuação (definido pelo gestor - atualizado 22/12/2025):
  // - Ligação realizada = 5 pontos
  // - WhatsApp enviado = 1 ponto
  // - Agendamento confirmado = 25 pontos
  // - Visita realizada = 40 pontos
  // - Análise de Crédito enviada = 60 pontos
  // - Contrato fechado (venda) = 150 pontos
  
  const PONTOS = {
    LIGACAO: 5,
    LIGACAO_ATENDIDA: 0, // Não usado mais
    WHATSAPP: 1,
    WHATSAPP_RESPONDIDO: 0, // Não usado mais
    CLIENTE_CADASTRADO: 0, // Não usado mais
    ALTERACAO_STATUS: 0, // Não usado mais
    AGENDAMENTO: 25,
    VISITA: 40,
    DOCUMENTACAO: 60,
    VENDA: 150,
  };
  
  let pontuacao = 0;
  
  // Pontos por ligações/contatos realizados (+1 por cada contato)
  pontuacao += (atividade.ligacoesRealizadas || 0) * PONTOS.LIGACAO;
  
  // Pontos extras por ligações atendidas (+2 por cada atendida)
  pontuacao += (atividade.ligacoesAtendidas || 0) * PONTOS.LIGACAO_ATENDIDA;
  
  // Pontos por WhatsApp enviados (+1 por cada)
  pontuacao += (atividade.whatsappEnviados || 0) * PONTOS.WHATSAPP;
  
  // Pontos extras por WhatsApp respondidos (+2 por cada)
  pontuacao += (atividade.whatsappRespondidos || 0) * PONTOS.WHATSAPP_RESPONDIDO;
  
  // Pontos por clientes cadastrados
  pontuacao += (atividade.clientesCadastrados || 0) * PONTOS.CLIENTE_CADASTRADO;
  
  // Pontos por alterações de status
  pontuacao += (atividade.alteracoesStatus || 0) * PONTOS.ALTERACAO_STATUS;
  
  // Pontos por agendamentos
  pontuacao += atividade.agendamentosConfirmados * PONTOS.AGENDAMENTO;
  
  // Pontos por visitas realizadas
  pontuacao += atividade.visitasRealizadas * PONTOS.VISITA;
  
  // Pontos por documentação/análise de crédito
  pontuacao += atividade.documentacoesRecolhidas * PONTOS.DOCUMENTACAO;
  pontuacao += atividade.analiseCreditoEnviadas * PONTOS.DOCUMENTACAO;
  
  // Pontos por vendas
  pontuacao += atividade.contratosFechados * PONTOS.VENDA;
  
  // Bônus por atingir metas diárias
  if (meta) {
    const metaLigacoesDiarias = Math.ceil(meta.metaLeads / 22);
    const metaAgendamentosDiarios = Math.ceil(meta.metaAgendamentos / 22);
    const metaVisitasDiarias = Math.ceil(meta.metaVisitas / 22);
    
    if (metaLigacoesDiarias && atividade.ligacoesRealizadas >= metaLigacoesDiarias) {
      pontuacao += Math.floor(atividade.ligacoesRealizadas * 1 * 0.5);
    }
    if (metaAgendamentosDiarios && atividade.agendamentosConfirmados >= metaAgendamentosDiarios) {
      pontuacao += Math.floor(atividade.agendamentosConfirmados * 10 * 0.5);
    }
    if (metaVisitasDiarias && atividade.visitasRealizadas >= metaVisitasDiarias) {
      pontuacao += Math.floor(atividade.visitasRealizadas * 15 * 0.5);
    }
  }
  
  // Atualizar pontuação
  await db.update(atividadesDiarias)
    .set({ pontuacaoTotal: pontuacao })
    .where(eq(atividadesDiarias.id, atividade.id));
}

// DEPRECATED: Esta função não é mais usada.
// Todas as métricas agora são registradas pela data de criação nas tabelas dedicadas:
// - interacoes (ligações/WhatsApp)
// - agendamentos
// - visitas
// - documentacoes
// - analises_credito
// - contratos
export async function registrarAtividadePorStatus(
  corretorId: number, 
  statusAnterior: string | null, 
  statusNovo: string,
  valorVenda?: number
) {
  // Esta função foi desativada. Métricas são sincronizadas automaticamente via jobs periódicos.
  console.log('[DEPRECATED] registrarAtividadePorStatus chamada - esta função não faz mais nada');
}

// Registrar cliente cadastrado pelo corretor (5 pontos)
export async function registrarClienteCadastrado(corretorId: number) {
  // clientesCadastrados não é um campo válido para incrementar
  // Usar ligacoesRealizadas como proxy para atividade
  await incrementarAtividade(corretorId, 'ligacoesRealizadas');
  await calcularPontuacaoDiaria(corretorId);
}

// Recalcular pontuação de todos os corretores para TODAS as atividades
export async function recalcularPontuacaoTodosCorretores() {
  const db = await getDb();
  if (!db) return;
  
  // Buscar TODAS as atividades (não só do dia atual)
  const atividades = await db.select()
    .from(atividadesDiarias);
  
  // Recalcular pontuação de cada atividade
  for (const atividade of atividades) {
    await recalcularPontuacaoAtividade(atividade.id);
  }
  
  return atividades.length;
}

// Recalcular pontuação de uma atividade específica pelo ID
// Sistema simplificado: 1 ponto por ligação/contato realizado
export async function recalcularPontuacaoAtividade(atividadeId: number) {
  const db = await getDb();
  if (!db) return;
  
  // Buscar a atividade
  const [atividade] = await db.select()
    .from(atividadesDiarias)
    .where(eq(atividadesDiarias.id, atividadeId))
    .limit(1);
  
  if (!atividade) return;
  
  // Sistema de pontuação (atualizado 22/12/2025)
  const PONTOS = {
    LIGACAO: 5,           // 5 pontos por ligação
    WHATSAPP: 1,          // 1 ponto por WhatsApp
    AGENDAMENTO: 25,      // 25 pontos por agendamento
    VISITA: 40,           // 40 pontos por visita
    DOCUMENTACAO: 60,     // 60 pontos por análise de crédito
    VENDA: 150,           // 150 pontos por venda
  };
  
  let pontuacao = 0;
  
  // Pontos por ligações/contatos realizados (+1 por cada contato)
  pontuacao += (atividade.ligacoesRealizadas || 0) * PONTOS.LIGACAO;
  
  // Pontos por WhatsApp enviados (+1 por cada)
  pontuacao += (atividade.whatsappEnviados || 0) * PONTOS.WHATSAPP;
  
  // Pontos por agendamentos
  pontuacao += (atividade.agendamentosConfirmados || 0) * PONTOS.AGENDAMENTO;
  
  // Pontos por visitas realizadas
  pontuacao += (atividade.visitasRealizadas || 0) * PONTOS.VISITA;
  
  // Pontos por documentação/análise de crédito (contabilizar apenas uma vez)
  // documentacoesRecolhidas e analiseCreditoEnviadas são a mesma coisa, usar o maior valor
  const docsOuAnalise = Math.max(
    (atividade.documentacoesRecolhidas || 0),
    (atividade.analiseCreditoEnviadas || 0)
  );
  pontuacao += docsOuAnalise * PONTOS.DOCUMENTACAO;
  
  // Pontos por vendas
  pontuacao += (atividade.contratosFechados || 0) * PONTOS.VENDA;
  
  // Atualizar pontuação
  await db.update(atividadesDiarias)
    .set({ pontuacaoTotal: pontuacao })
    .where(eq(atividadesDiarias.id, atividadeId));
  
  return pontuacao;
}


// ============================================================================
// LIXEIRA DE LEADS PERDIDOS
// ============================================================================

/**
 * Busca leads que estão na lixeira (perdidos)
 */
export async function getLeadsNaLixeira(page: number = 1, limit: number = 50) {
  const db = await getDb();
  if (!db) return { leads: [], total: 0, page, limit };
  
  const offset = (page - 1) * limit;
  
  const [leadsResult, countResult] = await Promise.all([
    db.select({
      id: leads.id,
      nome: leads.nome,
      email: leads.email,
      telefone: leads.telefone,
      origem: leads.origem,
      status: leads.status,
      motivoPerdido: leads.motivoPerdido,
      dataMovidoLixeira: leads.dataMovidoLixeira,
      corretorAnteriorId: leads.corretorAnteriorId,
      projectId: leads.projectId,
      createdAt: leads.createdAt,
    })
      .from(leads)
      .where(eq(leads.naLixeira, true))
      .orderBy(desc(leads.dataMovidoLixeira))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.naLixeira, true))
  ]);
  
  // Buscar nomes dos corretores anteriores e projetos
  const leadsComInfo = await Promise.all(leadsResult.map(async (lead) => {
    let corretorAnteriorNome = null;
    let projectNome = null;
    
    if (lead.corretorAnteriorId) {
      const corretor = await db.select({ name: users.name })
        .from(users)
        .where(eq(users.id, lead.corretorAnteriorId))
        .limit(1);
      corretorAnteriorNome = corretor[0]?.name || null;
    }
    
    if (lead.projectId) {
      const project = await db.select({ nome: projects.nome })
        .from(projects)
        .where(eq(projects.id, lead.projectId))
        .limit(1);
      projectNome = project[0]?.nome || null;
    }
    
    return {
      ...lead,
      corretorAnteriorNome,
      projectNome,
    };
  }));
  
  return {
    leads: leadsComInfo,
    total: Number(countResult[0]?.count || 0),
    page,
    limit,
  };
}

/**
 * Conta quantos leads estão na lixeira
 */
export async function countLeadsNaLixeira(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(eq(leads.naLixeira, true));
  
  return Number(result[0]?.count || 0);
}

// ============================================================================
// EXPORTAÇÃO DE LEADS EM CSV
// ============================================================================

interface ExportFilters {
  status?: string;
  corretorId?: number;
  projectId?: number;
  naLixeira?: boolean;
}

/**
 * Busca leads para exportação em CSV
 */
export async function getLeadsParaExportar(filters?: ExportFilters) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (filters?.status) {
    conditions.push(eq(leads.status, filters.status as any));
  }
  
  if (filters?.corretorId) {
    conditions.push(eq(leads.corretorId, filters.corretorId));
  }
  
  if (filters?.projectId) {
    conditions.push(eq(leads.projectId, filters.projectId));
  }
  
  if (filters?.naLixeira !== undefined) {
    conditions.push(eq(leads.naLixeira, filters.naLixeira));
  }
  
  const result = await db.select({
    id: leads.id,
    nome: leads.nome,
    email: leads.email,
    telefone: leads.telefone,
    origem: leads.origem,
    status: leads.status,
    observacoes: leads.observacoes,
    motivoPerdido: leads.motivoPerdido,
    campanha: leads.campanha,
    faixaRenda: leads.faixaRenda,
    prefereContatoPor: leads.prefereContatoPor,
    createdAt: leads.createdAt,
    updatedAt: leads.updatedAt,
    dataDistribuicao: leads.dataDistribuicao,
    ultimoContato: leads.ultimoContato,
    naLixeira: leads.naLixeira,
    dataMovidoLixeira: leads.dataMovidoLixeira,
    corretorId: leads.corretorId,
    projectId: leads.projectId,
  })
    .from(leads)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(leads.createdAt));
  
  // Buscar nomes de corretores e projetos
  const leadsComInfo = await Promise.all(result.map(async (lead) => {
    let corretorNome = null;
    let projectNome = null;
    
    if (lead.corretorId) {
      const corretor = await db.select({ name: users.name })
        .from(users)
        .where(eq(users.id, lead.corretorId))
        .limit(1);
      corretorNome = corretor[0]?.name || null;
    }
    
    if (lead.projectId) {
      const project = await db.select({ nome: projects.nome })
        .from(projects)
        .where(eq(projects.id, lead.projectId))
        .limit(1);
      projectNome = project[0]?.nome || null;
    }
    
    return {
      ...lead,
      corretorNome,
      projectNome,
    };
  }));
  
  return leadsComInfo;
}


// ============================================================================
// METAS DIÁRIAS
// ============================================================================

export async function getMetasDiarias(corretorId?: number): Promise<MetaDiaria[]> {
  const db = await getDb();
  if (!db) return [];
  
  if (corretorId) {
    return db.select().from(metasDiarias).where(eq(metasDiarias.corretorId, corretorId));
  }
  return db.select().from(metasDiarias);
}

export async function getMetaDiariaCorretor(corretorId: number): Promise<MetaDiaria | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(metasDiarias)
    .where(and(
      eq(metasDiarias.corretorId, corretorId),
      eq(metasDiarias.ativo, true)
    ))
    .limit(1);
  
  return result[0] || null;
}

export async function createMetaDiaria(data: InsertMetaDiaria): Promise<MetaDiaria | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Desativar metas anteriores do corretor
  await db.update(metasDiarias)
    .set({ ativo: false })
    .where(eq(metasDiarias.corretorId, data.corretorId));
  
  const result = await db.insert(metasDiarias).values(data);
  const insertId = result[0].insertId;
  
  const newMeta = await db.select().from(metasDiarias).where(eq(metasDiarias.id, insertId)).limit(1);
  return newMeta[0] || null;
}

export async function updateMetaDiaria(id: number, data: Partial<InsertMetaDiaria>): Promise<MetaDiaria | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(metasDiarias).set(data).where(eq(metasDiarias.id, id));
  
  const updated = await db.select().from(metasDiarias).where(eq(metasDiarias.id, id)).limit(1);
  return updated[0] || null;
}

export async function deleteMetaDiaria(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(metasDiarias).where(eq(metasDiarias.id, id));
  return true;
}

// ============================================================================
// CONFIGURAÇÃO DE PONTUAÇÃO
// ============================================================================

export async function getConfiguracaoPontuacao(): Promise<ConfiguracaoPontuacao | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(configuracaoPontuacao).limit(1);
  return result[0] || null;
}

export async function upsertConfiguracaoPontuacao(data: Partial<InsertConfiguracaoPontuacao>): Promise<ConfiguracaoPontuacao | null> {
  const db = await getDb();
  if (!db) return null;
  
  const existing = await getConfiguracaoPontuacao();
  
  if (existing) {
    await db.update(configuracaoPontuacao).set(data).where(eq(configuracaoPontuacao.id, existing.id));
    const updated = await db.select().from(configuracaoPontuacao).where(eq(configuracaoPontuacao.id, existing.id)).limit(1);
    return updated[0] || null;
  } else {
    const result = await db.insert(configuracaoPontuacao).values(data as InsertConfiguracaoPontuacao);
    const insertId = result[0].insertId;
    const newConfig = await db.select().from(configuracaoPontuacao).where(eq(configuracaoPontuacao.id, insertId)).limit(1);
    return newConfig[0] || null;
  }
}

// ============================================================================
// ALERTAS DE PRODUTIVIDADE
// ============================================================================

export async function getAlertasProdutividade(filtros?: {
  corretorId?: number;
  lido?: boolean;
  dataInicio?: Date;
  dataFim?: Date;
}): Promise<AlertaProdutividade[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (filtros?.corretorId) {
    conditions.push(eq(alertasProdutividade.corretorId, filtros.corretorId));
  }
  if (filtros?.lido !== undefined) {
    conditions.push(eq(alertasProdutividade.lido, filtros.lido));
  }
  if (filtros?.dataInicio) {
    conditions.push(gte(alertasProdutividade.data, filtros.dataInicio));
  }
  if (filtros?.dataFim) {
    conditions.push(lte(alertasProdutividade.data, filtros.dataFim));
  }
  
  if (conditions.length > 0) {
    return db.select()
      .from(alertasProdutividade)
      .where(and(...conditions))
      .orderBy(desc(alertasProdutividade.createdAt));
  }
  
  return db.select()
    .from(alertasProdutividade)
    .orderBy(desc(alertasProdutividade.createdAt));
}

export async function getAlertasNaoLidos(): Promise<AlertaProdutividade[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(alertasProdutividade)
    .where(eq(alertasProdutividade.lido, false))
    .orderBy(desc(alertasProdutividade.createdAt));
}

export async function createAlertaProdutividade(data: InsertAlertaProdutividade): Promise<AlertaProdutividade | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(alertasProdutividade).values(data);
  const insertId = result[0].insertId;
  
  const newAlerta = await db.select().from(alertasProdutividade).where(eq(alertasProdutividade.id, insertId)).limit(1);
  return newAlerta[0] || null;
}

export async function marcarAlertaComoLido(id: number, gestorId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(alertasProdutividade)
    .set({ 
      lido: true, 
      lidoPor: gestorId,
      lidoEm: new Date()
    })
    .where(eq(alertasProdutividade.id, id));
  
  return true;
}

export async function marcarTodosAlertasComoLidos(gestorId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(alertasProdutividade)
    .set({ 
      lido: true, 
      lidoPor: gestorId,
      lidoEm: new Date()
    })
    .where(eq(alertasProdutividade.lido, false));
  
  return true;
}

// ============================================================================
// VERIFICAÇÃO DE PRODUTIVIDADE E GERAÇÃO DE ALERTAS
// ============================================================================

export async function verificarProdutividadeEGerarAlertas(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  // Buscar todos os corretores ativos
  const corretores = await db.select()
    .from(users)
    .where(eq(users.role, 'corretor'));
  
  let alertasGerados = 0;
  
  for (const corretor of corretores) {
    // Buscar meta diária do corretor
    const meta = await getMetaDiariaCorretor(corretor.id);
    if (!meta) continue;
    
    // Buscar atividades do dia
    const atividades = await db.select()
      .from(atividadesDiarias)
      .where(and(
        eq(atividadesDiarias.corretorId, corretor.id),
        gte(atividadesDiarias.data, hoje)
      ))
      .limit(1);
    
    const atividadeDia = atividades[0];
    
    // Calcular percentual de meta atingida
    let totalMeta = 0;
    let totalRealizado = 0;
    
    if (meta.metaLigacoes > 0) {
      totalMeta += meta.metaLigacoes;
      totalRealizado += atividadeDia?.ligacoesRealizadas || 0;
    }
    if (meta.metaAgendamentos > 0) {
      totalMeta += meta.metaAgendamentos * 5; // Peso maior para agendamentos
      totalRealizado += (atividadeDia?.agendamentosConfirmados || 0) * 5;
    }
    if (meta.metaVisitas > 0) {
      totalMeta += meta.metaVisitas * 10; // Peso maior para visitas
      totalRealizado += (atividadeDia?.visitasRealizadas || 0) * 10;
    }
    
    const percentualMeta = totalMeta > 0 ? Math.round((totalRealizado / totalMeta) * 100) : 0;
    
    // Gerar alerta se abaixo de 50%
    if (percentualMeta < 50) {
      // Verificar se já existe alerta para hoje
      const alertaExistente = await db.select()
        .from(alertasProdutividade)
        .where(and(
          eq(alertasProdutividade.corretorId, corretor.id),
          gte(alertasProdutividade.data, hoje)
        ))
        .limit(1);
      
      if (alertaExistente.length === 0) {
        await createAlertaProdutividade({
          corretorId: corretor.id,
          data: hoje,
          tipo: 'baixa_produtividade',
          mensagem: `${corretor.name || 'Corretor'} está com apenas ${percentualMeta}% da meta diária atingida.`,
          percentualMeta,
        });
        alertasGerados++;
      }
    }
  }
  
  return alertasGerados;
}

// ============================================================================
// PROGRESSO DE METAS DIÁRIAS
// ============================================================================

export async function getProgressoMetasDiarias(corretorId?: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  // Buscar corretores
  let corretoresQuery = db.select().from(users).where(eq(users.role, 'corretor'));
  if (corretorId) {
    corretoresQuery = db.select().from(users).where(eq(users.id, corretorId));
  }
  const corretores = await corretoresQuery;
  
  const resultado = [];
  
  for (const corretor of corretores) {
    // Buscar meta diária
    const meta = await getMetaDiariaCorretor(corretor.id);
    
    // Buscar atividades do dia
    const atividades = await db.select()
      .from(atividadesDiarias)
      .where(and(
        eq(atividadesDiarias.corretorId, corretor.id),
        gte(atividadesDiarias.data, hoje)
      ))
      .limit(1);
    
    const atividadeDia = atividades[0] || {
      ligacoesRealizadas: 0,
      ligacoesAtendidas: 0,
      whatsappEnviados: 0,
      whatsappRespondidos: 0,
      agendamentosConfirmados: 0,
      visitasRealizadas: 0,
      documentacoesRecolhidas: 0,
      vendasRealizadas: 0,
      pontuacaoTotal: 0,
    };
    
    // Calcular progresso
    const progresso = {
      ligacoes: meta?.metaLigacoes ? Math.round((atividadeDia.ligacoesRealizadas / meta.metaLigacoes) * 100) : 0,
      whatsapp: meta?.metaWhatsapp ? Math.round((atividadeDia.whatsappEnviados / meta.metaWhatsapp) * 100) : 0,
      agendamentos: meta?.metaAgendamentos ? Math.round((atividadeDia.agendamentosConfirmados / meta.metaAgendamentos) * 100) : 0,
      visitas: meta?.metaVisitas ? Math.round((atividadeDia.visitasRealizadas / meta.metaVisitas) * 100) : 0,
      documentacoes: meta?.metaDocumentacoes ? Math.round((atividadeDia.documentacoesRecolhidas / meta.metaDocumentacoes) * 100) : 0,
      vendas: meta?.metaVendas ? Math.round(((atividadeDia as any).vendasRealizadas || 0) / meta.metaVendas * 100) : 0,
    };
    
    // Calcular progresso geral
    const totalProgresso = Object.values(progresso).reduce((a, b) => a + b, 0);
    const mediaProgresso = Math.round(totalProgresso / Object.keys(progresso).length);
    
    resultado.push({
      corretor: {
        id: corretor.id,
        nome: corretor.name,
        foto: corretor.fotoUrl,
        status: corretor.status,
      },
      meta: meta || {
        metaLigacoes: 20,
        metaWhatsapp: 30,
        metaAgendamentos: 3,
        metaVisitas: 2,
        metaDocumentacoes: 1,
        metaVendas: 1,
      },
      realizado: atividadeDia,
      progresso,
      progressoGeral: mediaProgresso,
      pontuacaoTotal: atividadeDia.pontuacaoTotal,
    });
  }
  
  // Ordenar por progresso geral (maior primeiro)
  resultado.sort((a, b) => b.progressoGeral - a.progressoGeral);
  
  return resultado;
}


// ============================================================================
// FOTO DE PERFIL DO CORRETOR
// ============================================================================

export async function atualizarFotoPerfil(userId: number, fotoUrl: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(users)
    .set({ fotoUrl })
    .where(eq(users.id, userId));
  
  return true;
}

export async function getFotoPerfil(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select({ fotoUrl: users.fotoUrl })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  return result[0]?.fotoUrl || null;
}

// ============================================================================
// SISTEMA DE CONQUISTAS
// ============================================================================

// Criar tipos de conquistas padrão
export async function criarTiposConquistaPadrao(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const tiposPadrao = [
    // Conquistas de Vendas
    { codigo: "top_vendedor_semana", nome: "Top Vendedor da Semana", descricao: "Maior VGV na semana", icone: "trophy", cor: "gold", categoria: "vendas" as const, criterioTipo: "ranking_semanal" as const, criterioValor: 1 },
    { codigo: "top_vendedor_mes", nome: "Top Vendedor do Mês", descricao: "Maior VGV no mês", icone: "crown", cor: "gold", categoria: "vendas" as const, criterioTipo: "ranking_mensal" as const, criterioValor: 1 },
    { codigo: "segundo_lugar_semana", nome: "Vice-Campeão Semanal", descricao: "2º maior VGV na semana", icone: "medal", cor: "silver", categoria: "vendas" as const, criterioTipo: "ranking_semanal" as const, criterioValor: 2 },
    { codigo: "terceiro_lugar_semana", nome: "Bronze Semanal", descricao: "3º maior VGV na semana", icone: "award", cor: "bronze", categoria: "vendas" as const, criterioTipo: "ranking_semanal" as const, criterioValor: 3 },
    
    // Conquistas de Meta
    { codigo: "meta_semanal_batida", nome: "Meta Semanal Batida", descricao: "Atingiu 100% da meta semanal", icone: "target", cor: "green", categoria: "produtividade" as const, criterioTipo: "meta_semanal" as const, criterioValor: 100 },
    { codigo: "meta_mensal_batida", nome: "Meta Mensal Batida", descricao: "Atingiu 100% da meta mensal", icone: "flag", cor: "blue", categoria: "produtividade" as const, criterioTipo: "meta_mensal" as const, criterioValor: 100 },
    { codigo: "meta_superada_120", nome: "Superação 120%", descricao: "Superou 120% da meta mensal", icone: "rocket", cor: "purple", categoria: "produtividade" as const, criterioTipo: "meta_mensal" as const, criterioValor: 120 },
    
    // Conquistas de Streak
    { codigo: "streak_5_dias", nome: "Streak de 5 Dias", descricao: "5 dias consecutivos batendo meta diária", icone: "flame", cor: "orange", categoria: "streak" as const, criterioTipo: "streak_dias" as const, criterioValor: 5 },
    { codigo: "streak_10_dias", nome: "Streak de 10 Dias", descricao: "10 dias consecutivos batendo meta diária", icone: "fire-extinguisher", cor: "red", categoria: "streak" as const, criterioTipo: "streak_dias" as const, criterioValor: 10 },
    { codigo: "streak_30_dias", nome: "Mês Perfeito", descricao: "30 dias consecutivos batendo meta diária", icone: "star", cor: "gold", categoria: "streak" as const, criterioTipo: "streak_dias" as const, criterioValor: 30 },
    
    // Conquistas Especiais
    { codigo: "primeira_venda", nome: "Primeira Venda", descricao: "Fechou a primeira venda no sistema", icone: "sparkles", cor: "blue", categoria: "especial" as const, criterioTipo: "total_vendas" as const, criterioValor: 1, recorrente: false },
    { codigo: "10_vendas", nome: "10 Vendas", descricao: "Acumulou 10 vendas no sistema", icone: "gem", cor: "purple", categoria: "especial" as const, criterioTipo: "total_vendas" as const, criterioValor: 10, recorrente: false },
    { codigo: "50_vendas", nome: "50 Vendas", descricao: "Acumulou 50 vendas no sistema", icone: "diamond", cor: "gold", categoria: "especial" as const, criterioTipo: "total_vendas" as const, criterioValor: 50, recorrente: false },
  ];
  
  for (const tipo of tiposPadrao) {
    // Verificar se já existe
    const existente = await db.select().from(tiposConquista).where(eq(tiposConquista.codigo, tipo.codigo)).limit(1);
    if (existente.length === 0) {
      await db.insert(tiposConquista).values(tipo as any);
    }
  }
}

// Buscar todos os tipos de conquistas
export async function getTiposConquista(): Promise<TipoConquista[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(tiposConquista).where(eq(tiposConquista.ativo, true));
}

// Buscar conquistas de um corretor
// Retorna apenas os campos básicos da conquista, sem JOIN com tipos_conquista
// pois o sistema de gamificação usa IDs do arquivo shared/conquistas.ts
export async function getConquistasCorretor(corretorId: number): Promise<Conquista[]> {
  const db = await getDb();
  if (!db) return [];
  
  const resultado = await db.select()
    .from(conquistas)
    .where(eq(conquistas.corretorId, corretorId))
    .orderBy(desc(conquistas.createdAt));
  
  return resultado;
}

// Conceder conquista a um corretor
export async function concederConquista(
  corretorId: number, 
  tipoConquistaCodigo: string,
  dados?: { valor?: number; posicao?: number; periodoInicio?: Date; periodoFim?: Date; observacao?: string }
): Promise<Conquista | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Buscar tipo de conquista
  const tipos = await db.select().from(tiposConquista).where(eq(tiposConquista.codigo, tipoConquistaCodigo)).limit(1);
  if (tipos.length === 0) return null;
  
  const tipo = tipos[0];
  
  // Verificar se já tem essa conquista (se não for recorrente)
  if (!tipo.recorrente) {
    const existente = await db.select().from(conquistas)
      .where(and(
        eq(conquistas.corretorId, corretorId),
        eq(conquistas.tipoConquistaId, tipo.id)
      ))
      .limit(1);
    
    if (existente.length > 0) return null; // Já tem essa conquista
  }
  
  // Verificar se já ganhou no mesmo período (para conquistas recorrentes)
  if (tipo.recorrente && dados?.periodoInicio && dados?.periodoFim) {
    const existente = await db.select().from(conquistas)
      .where(and(
        eq(conquistas.corretorId, corretorId),
        eq(conquistas.tipoConquistaId, tipo.id),
        eq(conquistas.periodoInicio, dados.periodoInicio),
        eq(conquistas.periodoFim, dados.periodoFim)
      ))
      .limit(1);
    
    if (existente.length > 0) return null; // Já ganhou nesse período
  }
  
  // Conceder conquista
  const [result] = await db.insert(conquistas).values({
    corretorId,
    tipoConquistaId: tipo.id,
    valor: dados?.valor,
    posicao: dados?.posicao,
    periodoInicio: dados?.periodoInicio,
    periodoFim: dados?.periodoFim,
    observacao: dados?.observacao,
  });
  
  const novaConquista = await db.select().from(conquistas).where(eq(conquistas.id, result.insertId)).limit(1);
  return novaConquista[0] || null;
}

// Verificar e conceder conquistas automaticamente
export async function verificarConquistas(corretorId: number): Promise<Conquista[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conquistasGanhas: Conquista[] = [];
  const tipos = await getTiposConquista();
  
  // Buscar dados do corretor
  const corretorData = await db.select().from(users).where(eq(users.id, corretorId)).limit(1);
  if (corretorData.length === 0) return [];
  
  // Buscar leads do corretor
  const leadsCorretor = await db.select().from(leads).where(eq(leads.corretorId, corretorId));
  const vendasTotais = leadsCorretor.filter(l => l.status === 'contrato_fechado').length;
  
  for (const tipo of tipos) {
    let conquistaGanha: Conquista | null = null;
    
    switch (tipo.criterioTipo) {
      case 'total_vendas':
        if (vendasTotais >= tipo.criterioValor) {
          conquistaGanha = await concederConquista(corretorId, tipo.codigo, { valor: vendasTotais });
        }
        break;
        
      // Outros tipos serão verificados por jobs periódicos
    }
    
    if (conquistaGanha) {
      conquistasGanhas.push(conquistaGanha);
    }
  }
  
  return conquistasGanhas;
}

// Verificar conquistas de ranking semanal/mensal (chamado por job)
export async function verificarConquistasRanking(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  let conquistasConcedidas = 0;
  const agora = new Date();
  
  // Calcular início e fim da semana atual
  const inicioSemana = new Date(agora);
  inicioSemana.setDate(agora.getDate() - agora.getDay());
  inicioSemana.setHours(0, 0, 0, 0);
  
  const fimSemana = new Date(inicioSemana);
  fimSemana.setDate(inicioSemana.getDate() + 6);
  fimSemana.setHours(23, 59, 59, 999);
  
  // Buscar ranking da semana
  const ranking = await getRankingCorretores();
  
  // Conceder conquistas de ranking semanal
  const conquistasRanking = [
    { posicao: 1, codigo: "top_vendedor_semana" },
    { posicao: 2, codigo: "segundo_lugar_semana" },
    { posicao: 3, codigo: "terceiro_lugar_semana" },
  ];
  
  for (const { posicao, codigo } of conquistasRanking) {
    if (ranking[posicao - 1] && ranking[posicao - 1].metricas.vgv > 0) {
      const conquista = await concederConquista(
        ranking[posicao - 1].corretor.id,
        codigo,
        {
          valor: ranking[posicao - 1].metricas.vgv,
          posicao,
          periodoInicio: inicioSemana,
          periodoFim: fimSemana,
        }
      );
      if (conquista) conquistasConcedidas++;
    }
  }
  
  return conquistasConcedidas;
}

// Buscar resumo de conquistas para exibição no perfil
// Usa o arquivo shared/conquistas.ts para obter informações das conquistas
export async function getResumoConquistas(corretorId: number): Promise<{
  total: number;
  porCategoria: Record<string, number>;
  recentes: { id: number; tipoConquistaId: number; nome: string; categoria: string; pontos: number; createdAt: Date }[];
  destaque: { id: number; tipoConquistaId: number; nome: string; categoria: string; pontos: number } | null;
}> {
  const db = await getDb();
  if (!db) return { total: 0, porCategoria: {}, recentes: [], destaque: null };
  
  // Importar conquistas do arquivo shared
  const { CONQUISTAS } = await import("../shared/conquistas");
  
  const conquistasDb = await getConquistasCorretor(corretorId);
  
  // Mapear conquistas do banco com informações do arquivo shared
  const todasConquistas = conquistasDb.map(c => {
    const info = CONQUISTAS.find(cq => cq.id === c.tipoConquistaId);
    return {
      id: c.id,
      tipoConquistaId: c.tipoConquistaId,
      nome: info?.nome || "Conquista",
      categoria: info?.categoria || "Geral",
      pontos: info?.pontos || 0,
      createdAt: c.createdAt,
    };
  });
  
  // Contar por categoria
  const porCategoria: Record<string, number> = {};
  for (const c of todasConquistas) {
    porCategoria[c.categoria] = (porCategoria[c.categoria] || 0) + 1;
  }
  
  // Pegar as 5 mais recentes
  const recentes = todasConquistas.slice(0, 5);
  
  // Pegar a de maior pontuação como destaque
  const destaque = [...todasConquistas].sort((a, b) => b.pontos - a.pontos)[0] || null;
  
  return {
    total: todasConquistas.length,
    porCategoria,
    recentes,
    destaque,
  };
}


// ============================================================================
// MÉTRICAS DO FUNIL DE VENDAS (BASEADAS EM TRANSIÇÕES DE STATUS)
// ============================================================================

/**
 * Busca todas as transições de status de um corretor em um período
 */
export async function getTransicoesCorretor(
  corretorId: number,
  dataInicio?: Date,
  dataFim?: Date
): Promise<LeadStatusTransition[]> {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select()
    .from(leadStatusTransitions)
    .where(eq(leadStatusTransitions.corretorId, corretorId))
    .orderBy(desc(leadStatusTransitions.createdAt));
  
  if (dataInicio && dataFim) {
    query = db.select()
      .from(leadStatusTransitions)
      .where(and(
        eq(leadStatusTransitions.corretorId, corretorId),
        gte(leadStatusTransitions.createdAt, dataInicio),
        lte(leadStatusTransitions.createdAt, dataFim)
      ))
      .orderBy(desc(leadStatusTransitions.createdAt));
  }
  
  return await query;
}

/**
 * Conta quantas vezes um corretor atingiu cada status no funil
 * Isso permite saber quantos agendamentos, visitas, etc. foram feitos
 * independente do status atual do lead
 */
export async function getMetricasFunilCorretor(
  corretorId: number,
  dataInicio?: Date,
  dataFim?: Date
): Promise<{
  agendamentos: number;
  visitasRealizadas: number;
  analisesCredito: number;
  contratosFechados: number;
  perdidos: number;
  emAtendimento: number;
}> {
  const db = await getDb();
  if (!db) return {
    agendamentos: 0,
    visitasRealizadas: 0,
    analisesCredito: 0,
    contratosFechados: 0,
    perdidos: 0,
    emAtendimento: 0
  };
  
  // Construir condições de filtro
  const conditions = [eq(leadStatusTransitions.corretorId, corretorId)];
  if (dataInicio) {
    conditions.push(gte(leadStatusTransitions.createdAt, dataInicio));
  }
  if (dataFim) {
    conditions.push(lte(leadStatusTransitions.createdAt, dataFim));
  }
  
  // Contar transições para cada status
  const transicoes = await db.select({
    statusNovo: leadStatusTransitions.statusNovo,
    total: sql<number>`COUNT(*)`
  })
    .from(leadStatusTransitions)
    .where(and(...conditions))
    .groupBy(leadStatusTransitions.statusNovo);
  
  // Mapear resultados
  const metricas = {
    agendamentos: 0,
    visitasRealizadas: 0,
    analisesCredito: 0,
    contratosFechados: 0,
    perdidos: 0,
    emAtendimento: 0
  };
  
  for (const t of transicoes) {
    switch (t.statusNovo) {
      case 'agendado':
        metricas.agendamentos = Number(t.total);
        break;
      case 'visita_realizada':
        metricas.visitasRealizadas = Number(t.total);
        break;
      case 'analise_credito':
        metricas.analisesCredito = Number(t.total);
        break;
      case 'contrato_fechado':
        metricas.contratosFechados = Number(t.total);
        break;
      case 'perdido':
        metricas.perdidos = Number(t.total);
        break;
      case 'em_atendimento':
        metricas.emAtendimento = Number(t.total);
        break;
    }
  }
  
  return metricas;
}

/**
 * Busca métricas do funil para todos os corretores
 */
export async function getMetricasFunilTodosCorretores(
  dataInicio?: Date,
  dataFim?: Date,
  corretoresIds?: number[] | null
): Promise<{
  corretorId: number;
  corretorNome: string;
  corretorFoto: string | null;
  metricas: {
    agendamentos: number;
    visitasRealizadas: number;
    analisesCredito: number;
    contratosFechados: number;
    perdidos: number;
    emAtendimento: number;
  };
}[]> {
  const db = await getDb();
  if (!db) return [];
  
  // Buscar corretores (filtrados por equipe se necessário)
  const conditions: any[] = [sql`${users.role} IN ('corretor', 'user')`];
  if (corretoresIds && corretoresIds.length > 0) {
    conditions.push(inArray(users.id, corretoresIds));
  }
  
  const corretores = await db.select()
    .from(users)
    .where(and(...conditions));
  
  const resultado = [];
  
  for (const corretor of corretores) {
    const metricas = await getMetricasFunilCorretor(corretor.id, dataInicio, dataFim);
    resultado.push({
      corretorId: corretor.id,
      corretorNome: corretor.name || 'Corretor',
      corretorFoto: corretor.fotoUrl,
      metricas
    });
  }
  
  return resultado;
}

/**
 * Busca métricas gerais do funil (soma de todos os corretores)
 */
export async function getMetricasFunilGeral(
  dataInicio?: Date,
  dataFim?: Date,
  corretoresIds?: number[] | null
): Promise<{
  agendamentos: number;
  visitasRealizadas: number;
  analisesCredito: number;
  contratosFechados: number;
  perdidos: number;
  emAtendimento: number;
  totalTransicoes: number;
}> {
  const db = await getDb();
  if (!db) return {
    agendamentos: 0,
    visitasRealizadas: 0,
    analisesCredito: 0,
    contratosFechados: 0,
    perdidos: 0,
    emAtendimento: 0,
    totalTransicoes: 0
  };
  
  // Construir condições de filtro
  const conditions: any[] = [];
  if (dataInicio) {
    conditions.push(gte(leadStatusTransitions.createdAt, dataInicio));
  }
  if (dataFim) {
    conditions.push(lte(leadStatusTransitions.createdAt, dataFim));
  }
  if (corretoresIds && corretoresIds.length > 0) {
    conditions.push(inArray(leadStatusTransitions.corretorId, corretoresIds));
  }
  
  // Contar transições para cada status
  const transicoes = await db.select({
    statusNovo: leadStatusTransitions.statusNovo,
    total: sql<number>`COUNT(*)`
  })
    .from(leadStatusTransitions)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(leadStatusTransitions.statusNovo);
  
  // Mapear resultados
  const metricas = {
    agendamentos: 0,
    visitasRealizadas: 0,
    analisesCredito: 0,
    contratosFechados: 0,
    perdidos: 0,
    emAtendimento: 0,
    totalTransicoes: 0
  };
  
  for (const t of transicoes) {
    metricas.totalTransicoes += Number(t.total);
    switch (t.statusNovo) {
      case 'agendado':
        metricas.agendamentos = Number(t.total);
        break;
      case 'visita_realizada':
        metricas.visitasRealizadas = Number(t.total);
        break;
      case 'analise_credito':
        metricas.analisesCredito = Number(t.total);
        break;
      case 'contrato_fechado':
        metricas.contratosFechados = Number(t.total);
        break;
      case 'perdido':
        metricas.perdidos = Number(t.total);
        break;
      case 'em_atendimento':
        metricas.emAtendimento = Number(t.total);
        break;
    }
  }
  
  return metricas;
}

/**
 * Busca histórico de transições de um lead específico
 */
export async function getHistoricoTransicoesLead(leadId: number): Promise<LeadStatusTransition[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(leadStatusTransitions)
    .where(eq(leadStatusTransitions.leadId, leadId))
    .orderBy(leadStatusTransitions.createdAt);
}


// ============================================================================
// AGENDAMENTOS
// ============================================================================

/**
 * Verificar se já existe um agendamento duplicado (mesmo lead + data + hora + status ativo)
 */
export async function checkAgendamentoDuplicado(params: {
  leadId: number;
  dataAgendamento: Date;
  horaAgendamento: string;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(agendamentos)
    .where(and(
      eq(agendamentos.leadId, params.leadId),
      eq(agendamentos.dataAgendamento, params.dataAgendamento),
      eq(agendamentos.horaAgendamento, params.horaAgendamento),
      inArray(agendamentos.status, ['pendente', 'confirmado'])
    ));
  
  return (result[0]?.count || 0) > 0;
}

/**
 * Criar um novo agendamento
 * Automaticamente atualiza o status do lead para "agendado" se necessário
 */
export async function createAgendamento(data: {
  leadId: number;
  corretorId: number;
  projectId?: number;
  projetoCustom?: string;
  construtora?: string;
  dataAgendamento: Date;
  horaAgendamento: string;
  observacoes?: string;
  criadoPorId?: number;
}): Promise<Agendamento | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Inserir o agendamento
  const result = await db.insert(agendamentos).values({
    leadId: data.leadId,
    corretorId: data.corretorId,
    projectId: data.projectId,
    projetoCustom: data.projetoCustom,
    construtora: data.construtora,
    dataAgendamento: data.dataAgendamento,
    horaAgendamento: data.horaAgendamento,
    observacoes: data.observacoes,
    criadoPorId: data.criadoPorId,
    status: 'pendente'
  });
  
  const insertId = result[0].insertId;
  
  // Buscar o lead atual
  const lead = await getLeadById(data.leadId);
  
  // Se o lead não está em status posterior a "agendado", atualizar para "agendado"
  const statusOrdem = ['novo', 'aguardando_atendimento', 'em_atendimento', 'agendado', 'visita_realizada', 'analise_credito', 'contrato_fechado', 'perdido'];
  const statusAtualIdx = statusOrdem.indexOf(lead?.status || 'novo');
  const agendadoIdx = statusOrdem.indexOf('agendado');
  
  // Criar data/hora completa do agendamento para o proximoFollowup
  const dataHoraAgendamento = new Date(data.dataAgendamento);
  const [hora, minuto] = data.horaAgendamento.split(':').map(Number);
  dataHoraAgendamento.setHours(hora || 9, minuto || 0, 0, 0);
  
  if (statusAtualIdx < agendadoIdx) {
    // Atualizar status e proximoFollowup para aparecer em Tarefas do Dia
    await updateLead(data.leadId, { 
      status: 'agendado',
      proximoFollowup: dataHoraAgendamento
    });
  } else {
    // Apenas atualizar proximoFollowup para aparecer em Tarefas do Dia
    await updateLead(data.leadId, { 
      proximoFollowup: dataHoraAgendamento
    });
  }
  
  // Retornar o agendamento criado
  const agendamento = await db.select().from(agendamentos).where(eq(agendamentos.id, insertId)).limit(1);
  return agendamento[0] || null;
}

/**
 * Buscar agendamento por ID
 */
export async function getAgendamentoById(id: number): Promise<Agendamento | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(agendamentos).where(eq(agendamentos.id, id)).limit(1);
  return result[0] || null;
}

/**
 * Buscar agendamentos de um corretor
 */
export async function getAgendamentosCorretor(
  corretorId: number,
  filtros?: {
    dataInicio?: Date;
    dataFim?: Date;
    status?: string;
  }
): Promise<Agendamento[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(agendamentos.corretorId, corretorId)];
  
  if (filtros?.dataInicio) {
    conditions.push(gte(agendamentos.dataAgendamento, filtros.dataInicio));
  }
  if (filtros?.dataFim) {
    conditions.push(lte(agendamentos.dataAgendamento, filtros.dataFim));
  }
  if (filtros?.status) {
    conditions.push(eq(agendamentos.status, filtros.status as any));
  }
  
  return await db.select()
    .from(agendamentos)
    .where(and(...conditions))
    .orderBy(desc(agendamentos.dataAgendamento));
}

/**
 * Buscar agendamentos de um lead
 */
export async function getAgendamentosLead(leadId: number): Promise<Agendamento[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(agendamentos)
    .where(eq(agendamentos.leadId, leadId))
    .orderBy(desc(agendamentos.dataAgendamento));
}

/**
 * Atualizar status de um agendamento
 */
export async function updateAgendamentoStatus(
  id: number,
  status: 'pendente' | 'confirmado' | 'realizado' | 'cancelado' | 'reagendado',
  corretorId?: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  // Buscar agendamento para obter leadId e corretorId
  const agendamento = await getAgendamentoById(id);
  if (!agendamento) return false;
  
  // Atualizar status do agendamento
  await db.update(agendamentos)
    .set({ status, updatedAt: new Date() })
    .where(eq(agendamentos.id, id));
  
  // Se status mudou para "realizado", mudar lead para "visita_realizada" automaticamente
  if (status === 'realizado') {
    const lead = await getLeadById(agendamento.leadId);
    if (lead && lead.status !== 'visita_realizada') {
      await updateLead(agendamento.leadId, { status: 'visita_realizada' });
      await registrarAlteracaoStatus({
        leadId: agendamento.leadId,
        corretorId: corretorId || agendamento.corretorId,
        statusAnterior: lead.status,
        statusNovo: 'visita_realizada',
        observacoes: `Status alterado automaticamente ao marcar agendamento como realizado`
      });
    }
  }
  
  return true;
}

/**
 * Atualizar agendamento
 */
export async function updateAgendamento(id: number, data: Partial<InsertAgendamento>): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(agendamentos)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(agendamentos.id, id));
  
  return true;
}

/**
 * Excluir agendamento
 */
export async function deleteAgendamento(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(agendamentos).where(eq(agendamentos.id, id));
  return true;
}

/**
 * Buscar agendamentos do dia
 */
export async function getAgendamentosDoDia(corretorId?: number): Promise<Agendamento[]> {
  const db = await getDb();
  if (!db) return [];
  
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  
  const conditions = [
    gte(agendamentos.dataAgendamento, hoje),
    lte(agendamentos.dataAgendamento, amanha)
  ];
  
  if (corretorId) {
    conditions.push(eq(agendamentos.corretorId, corretorId));
  }
  
  return await db.select()
    .from(agendamentos)
    .where(and(...conditions))
    .orderBy(agendamentos.horaAgendamento);
}

// ============================================================================
// VISITAS
// ============================================================================

/**
 * Criar uma nova visita
 * Automaticamente atualiza o status do lead para "visita_realizada" se necessário
 */
export async function createVisita(data: {
  leadId: number;
  corretorId: number;
  agendamentoId?: number;
  projectId?: number;
  projetoCustom?: string;
  construtora?: string;
  dataVisita: Date;
  horaVisita?: string;
  resultado?: 'interesse_alto' | 'interesse_medio' | 'interesse_baixo' | 'sem_interesse' | 'pendente_documentacao' | 'encaminhado_analise';
  observacoes?: string;
  registradoPorId?: number;
}): Promise<Visita | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Inserir a visita
  const result = await db.insert(visitas).values({
    leadId: data.leadId,
    corretorId: data.corretorId,
    agendamentoId: data.agendamentoId,
    projectId: data.projectId,
    projetoCustom: data.projetoCustom,
    construtora: data.construtora,
    dataVisita: data.dataVisita,
    horaVisita: data.horaVisita,
    resultado: data.resultado || 'interesse_medio',
    observacoes: data.observacoes,
    registradoPorId: data.registradoPorId
  });
  
  const insertId = result[0].insertId;
  
  // Se veio de um agendamento, marcar como realizado
  if (data.agendamentoId) {
    await updateAgendamentoStatus(data.agendamentoId, 'realizado');
  }
  
  // Buscar o lead atual
  const lead = await getLeadById(data.leadId);
  
  // Se o lead não está em status posterior a "visita_realizada", atualizar
  const statusOrdem = ['novo', 'aguardando_atendimento', 'em_atendimento', 'agendado', 'visita_realizada', 'analise_credito', 'contrato_fechado', 'perdido'];
  const statusAtualIdx = statusOrdem.indexOf(lead?.status || 'novo');
  const visitaIdx = statusOrdem.indexOf('visita_realizada');
  
  if (statusAtualIdx < visitaIdx) {
    await updateLead(data.leadId, { status: 'visita_realizada' });
  }
  
  // Retornar a visita criada
  const visita = await db.select().from(visitas).where(eq(visitas.id, insertId)).limit(1);
  return visita[0] || null;
}

/**
 * Buscar visita por ID
 */
export async function getVisitaById(id: number): Promise<Visita | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(visitas).where(eq(visitas.id, id)).limit(1);
  return result[0] || null;
}

/**
 * Buscar visitas de um corretor
 */
export async function getVisitasCorretor(
  corretorId: number,
  filtros?: {
    dataInicio?: Date;
    dataFim?: Date;
  }
): Promise<Visita[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(visitas.corretorId, corretorId)];
  
  if (filtros?.dataInicio) {
    conditions.push(gte(visitas.dataVisita, filtros.dataInicio));
  }
  if (filtros?.dataFim) {
    conditions.push(lte(visitas.dataVisita, filtros.dataFim));
  }
  
  return await db.select()
    .from(visitas)
    .where(and(...conditions))
    .orderBy(desc(visitas.dataVisita));
}

/**
 * Buscar visitas de um lead
 */
export async function getVisitasLead(leadId: number): Promise<Visita[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(visitas)
    .where(eq(visitas.leadId, leadId))
    .orderBy(desc(visitas.dataVisita));
}

/**
 * Buscar todas as visitas (para gestor)
 */
export async function getAllVisitas(filtros?: {
  dataInicio?: Date;
  dataFim?: Date;
  corretorId?: number;
  corretoresIds?: number[] | null; // Filtro por equipe
}): Promise<Visita[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: any[] = [];
  
  // Filtro por equipe (corretoresIds)
  if (filtros?.corretoresIds && filtros.corretoresIds.length > 0) {
    conditions.push(inArray(visitas.corretorId, filtros.corretoresIds));
  }
  if (filtros?.dataInicio) {
    conditions.push(gte(visitas.dataVisita, filtros.dataInicio));
  }
  if (filtros?.dataFim) {
    conditions.push(lte(visitas.dataVisita, filtros.dataFim));
  }
  if (filtros?.corretorId) {
    conditions.push(eq(visitas.corretorId, filtros.corretorId));
  }
  
  return await db.select()
    .from(visitas)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(visitas.dataVisita));
}

/**
 * Atualizar visita
 */
export async function updateVisita(id: number, data: Partial<InsertVisita>): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(visitas)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(visitas.id, id));
  
  return true;
}

/**
 * Excluir visita
 */
export async function deleteVisita(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(visitas).where(eq(visitas.id, id));
  return true;
}

// ============================================================================
// BUSCA DE LEAD POR TELEFONE/EMAIL/CPF
// ============================================================================

/**
 * Buscar lead por telefone (para autocomplete)
 */
export async function searchLeadByTelefone(telefone: string, corretorId?: number): Promise<Lead[]> {
  const db = await getDb();
  if (!db) return [];
  
  // Limpar telefone (remover caracteres não numéricos)
  const telefoneLimpo = telefone.replace(/\D/g, '');
  
  const conditions = [
    sql`REPLACE(REPLACE(REPLACE(${leads.telefone}, '-', ''), ' ', ''), '(', '') LIKE ${`%${telefoneLimpo}%`}`
  ];
  
  if (corretorId) {
    conditions.push(eq(leads.corretorId, corretorId));
  }
  
  return await db.select()
    .from(leads)
    .where(and(...conditions))
    .limit(10);
}

/**
 * Buscar lead por email
 */
export async function searchLeadByEmail(email: string, corretorId?: number): Promise<Lead[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [
    sql`${leads.email} LIKE ${`%${email}%`}`
  ];
  
  if (corretorId) {
    conditions.push(eq(leads.corretorId, corretorId));
  }
  
  return await db.select()
    .from(leads)
    .where(and(...conditions))
    .limit(10);
}

/**
 * Buscar lead por CPF
 */
export async function searchLeadByCpf(cpf: string, corretorId?: number): Promise<Lead[]> {
  const db = await getDb();
  if (!db) return [];
  
  // Limpar CPF (remover caracteres não numéricos)
  const cpfLimpo = cpf.replace(/\D/g, '');
  
  const conditions = [
    sql`REPLACE(REPLACE(${leads.cpf}, '.', ''), '-', '') LIKE ${`%${cpfLimpo}%`}`
  ];
  
  if (corretorId) {
    conditions.push(eq(leads.corretorId, corretorId));
  }
  
  return await db.select()
    .from(leads)
    .where(and(...conditions))
    .limit(10);
}

/**
 * Buscar lead por qualquer identificador (telefone, email, CPF ou nome)
 * Busca flexível que funciona independente do formato de digitação:
 * - Telefone: (11) 98175-6334 = 11981756334 = +5511981756334
 * - Email: case-insensitive
 * - CPF: com ou sem formatação
 * - Nome: case-insensitive e parcial
 */
export async function searchLeadByIdentifier(query: string, corretorId?: number): Promise<Lead[]> {
  const db = await getDb();
  if (!db) return [];
  
  // Limpar query
  const queryLimpa = query.trim();
  if (queryLimpa.length < 2) return [];
  
  // Extrair apenas dígitos para busca por telefone/CPF
  let querySemCaracteres = queryLimpa.replace(/\D/g, '');
  
  // Se começa com 55 (código Brasil) e tem mais de 11 dígitos, remove o 55
  if (querySemCaracteres.startsWith('55') && querySemCaracteres.length > 11) {
    querySemCaracteres = querySemCaracteres.slice(2);
  }
  
  const conditions = [];
  
  // Busca por telefone (se tem pelo menos 2 dígitos)
  if (querySemCaracteres.length >= 2) {
    // Busca simples por telefone normalizado - LIKE é mais confiável
    conditions.push(
      sql`REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        ${leads.telefone}, 
        '(', ''), ')', ''), '-', ''), ' ', ''), '+', ''), 'p:', ''), '55', '') 
        LIKE ${`%${querySemCaracteres}%`}`
    );
    
    // Busca por CPF normalizado
    conditions.push(
      sql`REPLACE(REPLACE(${leads.cpf}, '.', ''), '-', '') LIKE ${`%${querySemCaracteres}%`}`
    );
  }
  
  // Busca por email (case-insensitive)
  // Funciona com ou sem @
  conditions.push(
    sql`LOWER(${leads.email}) LIKE ${`%${queryLimpa.toLowerCase()}%`}`
  );
  
  // Buscar por nome (case-insensitive e parcial)
  conditions.push(
    sql`LOWER(${leads.nome}) LIKE ${`%${queryLimpa.toLowerCase()}%`}`
  );
  
  // Construir query base
  let baseQuery = db.select()
    .from(leads)
    .where(sql`(${sql.join(conditions, sql` OR `)})`);
  
  // Se é corretor, filtrar apenas seus leads
  if (corretorId) {
    baseQuery = db.select()
      .from(leads)
      .where(and(
        sql`(${sql.join(conditions, sql` OR `)})`,
        eq(leads.corretorId, corretorId)
      ));
  }
  
  // Ordenar por relevância (nome primeiro, depois telefone)
  return await baseQuery
    .orderBy(leads.nome)
    .limit(20);
}

// ============================================================================
// MÉTRICAS DO FUNIL COM LEADS ÚNICOS
// ============================================================================

/**
 * Conta leads únicos que atingiram cada etapa do funil
 * Usa as tabelas de agendamentos e visitas para contagem precisa
 */
export async function getMetricasFunilLeadsUnicos(
  corretorId?: number,
  dataInicio?: Date,
  dataFim?: Date
): Promise<{
  leadsRecebidos: number;
  emAtendimento: number;
  agendados: number;
  visitasRealizadas: number;
  analisesCredito: number;
  contratosFechados: number;
  perdidos: number;
}> {
  const db = await getDb();
  if (!db) return {
    leadsRecebidos: 0,
    emAtendimento: 0,
    agendados: 0,
    visitasRealizadas: 0,
    analisesCredito: 0,
    contratosFechados: 0,
    perdidos: 0
  };
  
  // Condições base
  const leadConditions = [];
  const agendamentoConditions = [];
  const visitaConditions = [];
  const transicaoConditions = [];
  
  if (corretorId) {
    leadConditions.push(eq(leads.corretorId, corretorId));
    agendamentoConditions.push(eq(agendamentos.corretorId, corretorId));
    visitaConditions.push(eq(visitas.corretorId, corretorId));
    transicaoConditions.push(eq(leadStatusTransitions.corretorId, corretorId));
  }
  
  if (dataInicio) {
    leadConditions.push(gte(leads.createdAt, dataInicio));
    agendamentoConditions.push(gte(agendamentos.createdAt, dataInicio));
    visitaConditions.push(gte(visitas.createdAt, dataInicio));
    transicaoConditions.push(gte(leadStatusTransitions.createdAt, dataInicio));
  }
  
  if (dataFim) {
    leadConditions.push(lte(leads.createdAt, dataFim));
    agendamentoConditions.push(lte(agendamentos.createdAt, dataFim));
    visitaConditions.push(lte(visitas.createdAt, dataFim));
    transicaoConditions.push(lte(leadStatusTransitions.createdAt, dataFim));
  }
  
  // Leads recebidos (total de leads)
  const leadsRecebidosResult = await db.select({ count: sql<number>`COUNT(DISTINCT ${leads.id})` })
    .from(leads)
    .where(leadConditions.length > 0 ? and(...leadConditions) : undefined);
  
  // Leads únicos com agendamento
  const agendadosResult = await db.select({ count: sql<number>`COUNT(DISTINCT ${agendamentos.leadId})` })
    .from(agendamentos)
    .where(agendamentoConditions.length > 0 ? and(...agendamentoConditions) : undefined);
  
  // Leads únicos com visita
  const visitasResult = await db.select({ count: sql<number>`COUNT(DISTINCT ${visitas.leadId})` })
    .from(visitas)
    .where(visitaConditions.length > 0 ? and(...visitaConditions) : undefined);
  
  // Leads únicos que passaram por cada status (via transições)
  const emAtendimentoResult = await db.select({ count: sql<number>`COUNT(DISTINCT ${leadStatusTransitions.leadId})` })
    .from(leadStatusTransitions)
    .where(and(
      eq(leadStatusTransitions.statusNovo, 'em_atendimento'),
      ...(transicaoConditions.length > 0 ? transicaoConditions : [])
    ));
  
  const analiseCreditoResult = await db.select({ count: sql<number>`COUNT(DISTINCT ${leadStatusTransitions.leadId})` })
    .from(leadStatusTransitions)
    .where(and(
      eq(leadStatusTransitions.statusNovo, 'analise_credito'),
      ...(transicaoConditions.length > 0 ? transicaoConditions : [])
    ));
  
  const contratosFechadosResult = await db.select({ count: sql<number>`COUNT(DISTINCT ${leadStatusTransitions.leadId})` })
    .from(leadStatusTransitions)
    .where(and(
      eq(leadStatusTransitions.statusNovo, 'contrato_fechado'),
      ...(transicaoConditions.length > 0 ? transicaoConditions : [])
    ));
  
  const perdidosResult = await db.select({ count: sql<number>`COUNT(DISTINCT ${leadStatusTransitions.leadId})` })
    .from(leadStatusTransitions)
    .where(and(
      eq(leadStatusTransitions.statusNovo, 'perdido'),
      ...(transicaoConditions.length > 0 ? transicaoConditions : [])
    ));
  
  return {
    leadsRecebidos: Number(leadsRecebidosResult[0]?.count || 0),
    emAtendimento: Number(emAtendimentoResult[0]?.count || 0),
    agendados: Number(agendadosResult[0]?.count || 0),
    visitasRealizadas: Number(visitasResult[0]?.count || 0),
    analisesCredito: Number(analiseCreditoResult[0]?.count || 0),
    contratosFechados: Number(contratosFechadosResult[0]?.count || 0),
    perdidos: Number(perdidosResult[0]?.count || 0)
  };
}


// ============================================================================
// RELATÓRIO DE LEADS CRIADOS POR CORRETOR
// ============================================================================

/**
 * Busca relatório detalhado de leads criados por corretor
 * Retorna dados para tabela e gráfico de barras horizontal
 */
export async function getRelatorioLeadsCriados(
  dataInicio?: Date,
  dataFim?: Date,
  corretoresIds?: number[] | null
): Promise<{
  porCorretor: {
    corretorId: number;
    corretorNome: string;
    corretorFoto: string | null;
    totalLeads: number;
    porOrigem: Record<string, number>;
    porProjeto: { projetoId: number | null; projetoNome: string; quantidade: number }[];
  }[];
  porOrigem: { origem: string; quantidade: number }[];
  porProjeto: { projetoId: number | null; projetoNome: string; quantidade: number }[];
  totalGeral: number;
  leadsDetalhados: {
    id: number;
    nome: string;
    telefone: string;
    origem: string | null;
    projetoNome: string | null;
    corretorNome: string | null;
    createdAt: Date;
  }[];
}> {
  const db = await getDb();
  if (!db) return { 
    porCorretor: [], 
    porOrigem: [], 
    porProjeto: [], 
    totalGeral: 0,
    leadsDetalhados: []
  };

  // Construir condições de filtro
  const conditions: any[] = [];
  if (dataInicio) {
    conditions.push(gte(leads.createdAt, dataInicio));
  }
  if (dataFim) {
    conditions.push(lte(leads.createdAt, dataFim));
  }
  if (corretoresIds && corretoresIds.length > 0) {
    conditions.push(inArray(leads.corretorId, corretoresIds));
  }

  // Buscar todos os leads com filtro de data
  const leadsQuery = await db.select({
    id: leads.id,
    nome: leads.nome,
    telefone: leads.telefone,
    origem: leads.origem,
    projectId: leads.projectId,
    corretorId: leads.corretorId,
    createdAt: leads.createdAt,
  })
    .from(leads)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(leads.createdAt));

  // Buscar corretores
  const corretoresQuery = await db.select({
    id: users.id,
    name: users.name,
    fotoUrl: users.fotoUrl,
  })
    .from(users)
    .where(inArray(users.role, ['corretor', 'gestor', 'admin']));

  const corretoresMap = new Map(corretoresQuery.map(c => [c.id, c]));

  // Buscar projetos
  const projetosQuery = await db.select({
    id: projects.id,
    nome: projects.nome,
  }).from(projects);

  const projetosMap = new Map(projetosQuery.map(p => [p.id, p.nome]));

  // Agrupar por corretor
  const porCorretorMap = new Map<number, {
    corretorId: number;
    corretorNome: string;
    corretorFoto: string | null;
    totalLeads: number;
    porOrigem: Record<string, number>;
    porProjeto: Map<number | null, { projetoId: number | null; projetoNome: string; quantidade: number }>;
  }>();

  // Contadores gerais
  const origemGeral = new Map<string, number>();
  const projetoGeral = new Map<number | null, { projetoId: number | null; projetoNome: string; quantidade: number }>();

  // Leads detalhados para tabela
  const leadsDetalhados: {
    id: number;
    nome: string;
    telefone: string;
    origem: string | null;
    projetoNome: string | null;
    corretorNome: string | null;
    createdAt: Date;
  }[] = [];

  for (const lead of leadsQuery) {
    const corretorId = lead.corretorId || 0;
    const corretor = corretoresMap.get(corretorId);
    const corretorNome = corretor?.name || 'Sem Corretor';
    const corretorFoto = corretor?.fotoUrl || null;
    const origem = lead.origem || 'outro';
    const projetoId = lead.projectId;
    const projetoNome = projetoId ? (projetosMap.get(projetoId) || 'Projeto Desconhecido') : 'Sem Projeto';

    // Adicionar ao mapa do corretor
    if (!porCorretorMap.has(corretorId)) {
      porCorretorMap.set(corretorId, {
        corretorId,
        corretorNome,
        corretorFoto,
        totalLeads: 0,
        porOrigem: {},
        porProjeto: new Map(),
      });
    }

    const corretorData = porCorretorMap.get(corretorId)!;
    corretorData.totalLeads++;
    corretorData.porOrigem[origem] = (corretorData.porOrigem[origem] || 0) + 1;

    if (!corretorData.porProjeto.has(projetoId)) {
      corretorData.porProjeto.set(projetoId, { projetoId, projetoNome, quantidade: 0 });
    }
    corretorData.porProjeto.get(projetoId)!.quantidade++;

    // Contadores gerais
    origemGeral.set(origem, (origemGeral.get(origem) || 0) + 1);

    if (!projetoGeral.has(projetoId)) {
      projetoGeral.set(projetoId, { projetoId, projetoNome, quantidade: 0 });
    }
    projetoGeral.get(projetoId)!.quantidade++;

    // Adicionar aos leads detalhados (limitar a 100 para performance)
    if (leadsDetalhados.length < 100) {
      leadsDetalhados.push({
        id: lead.id,
        nome: lead.nome,
        telefone: lead.telefone,
        origem: lead.origem,
        projetoNome,
        corretorNome,
        createdAt: lead.createdAt,
      });
    }
  }

  // Converter mapas para arrays
  const porCorretor = Array.from(porCorretorMap.values())
    .map(c => ({
      ...c,
      porProjeto: Array.from(c.porProjeto.values()).sort((a, b) => b.quantidade - a.quantidade),
    }))
    .sort((a, b) => b.totalLeads - a.totalLeads);

  const porOrigem = Array.from(origemGeral.entries())
    .map(([origem, quantidade]) => ({ origem, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);

  const porProjeto = Array.from(projetoGeral.values())
    .sort((a, b) => b.quantidade - a.quantidade);

  return {
    porCorretor,
    porOrigem,
    porProjeto,
    totalGeral: leadsQuery.length,
    leadsDetalhados,
  };
}


// ============================================================================
// SINCRONIZAÇÃO COM GOOGLE SHEETS
// ============================================================================

/**
 * Busca todos os leads com dados completos para sincronização com Google Sheets
 */
export async function getAllLeadsForSync(): Promise<{
  id: number;
  createdAt: Date;
  nome: string;
  email: string | null;
  telefone: string;
  cpf: string | null;
  origem: string | null;
  projetoNome: string | null;
  corretorNome: string | null;
  status: string;
  dataDistribuicao: Date | null;
  ultimoContato: Date | null;
  observacoes: string | null;
  campanha: string | null;
  faixaRenda: string | null;
}[]> {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select({
    id: leads.id,
    createdAt: leads.createdAt,
    nome: leads.nome,
    email: leads.email,
    telefone: leads.telefone,
    cpf: leads.cpf,
    origem: leads.origem,
    projectId: leads.projectId,
    corretorId: leads.corretorId,
    status: leads.status,
    dataDistribuicao: leads.dataDistribuicao,
    ultimoContato: leads.ultimoContato,
    observacoes: leads.observacoes,
    campanha: leads.campanha,
    faixaRenda: leads.faixaRenda,
  })
    .from(leads)
    .where(eq(leads.naLixeira, false))
    .orderBy(desc(leads.createdAt));

  // Buscar nomes dos projetos e corretores
  const projectIds = [...new Set(result.filter(l => l.projectId).map(l => l.projectId!))];
  const corretorIds = [...new Set(result.filter(l => l.corretorId).map(l => l.corretorId!))];

  const projectsMap = new Map<number, string>();
  const corretoresMap = new Map<number, string>();

  if (projectIds.length > 0) {
    const projectsResult = await db.select({ id: projects.id, nome: projects.nome })
      .from(projects)
      .where(inArray(projects.id, projectIds));
    projectsResult.forEach(p => projectsMap.set(p.id, p.nome));
  }

  if (corretorIds.length > 0) {
    const corretoresResult = await db.select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, corretorIds));
    corretoresResult.forEach(c => corretoresMap.set(c.id, c.name || 'Sem Nome'));
  }

  return result.map(lead => ({
    id: lead.id,
    createdAt: lead.createdAt,
    nome: lead.nome,
    email: lead.email,
    telefone: lead.telefone,
    cpf: lead.cpf,
    origem: lead.origem,
    projetoNome: lead.projectId ? projectsMap.get(lead.projectId) || null : null,
    corretorNome: lead.corretorId ? corretoresMap.get(lead.corretorId) || null : null,
    status: lead.status,
    dataDistribuicao: lead.dataDistribuicao,
    ultimoContato: lead.ultimoContato,
    observacoes: lead.observacoes,
    campanha: lead.campanha,
    faixaRenda: lead.faixaRenda,
  }));
}


// ============================================================================
// DISPONIBILIDADE DO CORRETOR (AGENDA)
// ============================================================================

/**
 * Buscar disponibilidade do corretor
 */
export async function getDisponibilidadeCorretor(corretorId: number): Promise<DisponibilidadeCorretor[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(disponibilidadeCorretor)
    .where(and(
      eq(disponibilidadeCorretor.corretorId, corretorId),
      eq(disponibilidadeCorretor.ativo, true)
    ))
    .orderBy(disponibilidadeCorretor.diaSemana);
}

/**
 * Criar ou atualizar disponibilidade do corretor
 */
export async function upsertDisponibilidadeCorretor(data: InsertDisponibilidadeCorretor): Promise<DisponibilidadeCorretor | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Verificar se já existe para este dia
  const existing = await db.select()
    .from(disponibilidadeCorretor)
    .where(and(
      eq(disponibilidadeCorretor.corretorId, data.corretorId),
      eq(disponibilidadeCorretor.diaSemana, data.diaSemana)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    // Atualizar
    await db.update(disponibilidadeCorretor)
      .set({
        horaInicio: data.horaInicio,
        horaFim: data.horaFim,
        intervaloInicio: data.intervaloInicio,
        intervaloFim: data.intervaloFim,
        duracaoSlot: data.duracaoSlot,
        ativo: data.ativo ?? true
      })
      .where(eq(disponibilidadeCorretor.id, existing[0].id));
    
    const updated = await db.select().from(disponibilidadeCorretor).where(eq(disponibilidadeCorretor.id, existing[0].id)).limit(1);
    return updated[0] || null;
  } else {
    // Inserir
    const result = await db.insert(disponibilidadeCorretor).values(data);
    const inserted = await db.select().from(disponibilidadeCorretor).where(eq(disponibilidadeCorretor.id, result[0].insertId)).limit(1);
    return inserted[0] || null;
  }
}

/**
 * Deletar disponibilidade
 */
export async function deleteDisponibilidadeCorretor(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(disponibilidadeCorretor).where(eq(disponibilidadeCorretor.id, id));
  return true;
}

// ============================================================================
// BLOQUEIOS DE AGENDA
// ============================================================================

/**
 * Buscar bloqueios de agenda do corretor
 */
export async function getBloqueiosAgenda(corretorId: number, dataInicio?: Date, dataFim?: Date): Promise<BloqueioAgenda[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(bloqueiosAgenda.corretorId, corretorId)];
  
  if (dataInicio) {
    conditions.push(gte(bloqueiosAgenda.dataFim, dataInicio));
  }
  if (dataFim) {
    conditions.push(lte(bloqueiosAgenda.dataInicio, dataFim));
  }
  
  return await db.select()
    .from(bloqueiosAgenda)
    .where(and(...conditions))
    .orderBy(bloqueiosAgenda.dataInicio);
}

/**
 * Criar bloqueio de agenda
 */
export async function createBloqueioAgenda(data: InsertBloqueioAgenda): Promise<BloqueioAgenda | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(bloqueiosAgenda).values(data);
  const inserted = await db.select().from(bloqueiosAgenda).where(eq(bloqueiosAgenda.id, result[0].insertId)).limit(1);
  return inserted[0] || null;
}

/**
 * Deletar bloqueio de agenda
 */
export async function deleteBloqueioAgenda(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(bloqueiosAgenda).where(eq(bloqueiosAgenda.id, id));
  return true;
}

// ============================================================================
// LINKS DE AGENDAMENTO SELF-SERVICE
// ============================================================================

/**
 * Criar link de agendamento
 */
export async function createLinkAgendamento(data: InsertLinkAgendamento): Promise<LinkAgendamento | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Gerar token único
  const token = crypto.randomUUID().replace(/-/g, '');
  
  const result = await db.insert(linksAgendamento).values({
    ...data,
    token
  });
  
  const inserted = await db.select().from(linksAgendamento).where(eq(linksAgendamento.id, result[0].insertId)).limit(1);
  return inserted[0] || null;
}

/**
 * Buscar link por token
 */
export async function getLinkAgendamentoByToken(token: string): Promise<LinkAgendamento | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(linksAgendamento)
    .where(and(
      eq(linksAgendamento.token, token),
      eq(linksAgendamento.ativo, true)
    ))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Buscar links do corretor
 */
export async function getLinksAgendamentoCorretor(corretorId: number): Promise<LinkAgendamento[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(linksAgendamento)
    .where(eq(linksAgendamento.corretorId, corretorId))
    .orderBy(desc(linksAgendamento.createdAt));
}

/**
 * Incrementar contador de agendamentos do link
 */
export async function incrementarAgendamentosLink(linkId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(linksAgendamento)
    .set({
      agendamentosRealizados: sql`${linksAgendamento.agendamentosRealizados} + 1`
    })
    .where(eq(linksAgendamento.id, linkId));
}

/**
 * Buscar slots disponíveis para agendamento
 */
export async function getSlotsDisponiveis(corretorId: number, data: Date): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  
  // Usar getUTCDay() para consistência com datas enviadas via toISOString()
  const diaSemana = data.getUTCDay(); // 0 = domingo, 1 = segunda, etc.
  
  // Buscar disponibilidade do corretor para este dia
  const disponibilidade = await db.select()
    .from(disponibilidadeCorretor)
    .where(and(
      eq(disponibilidadeCorretor.corretorId, corretorId),
      eq(disponibilidadeCorretor.diaSemana, diaSemana),
      eq(disponibilidadeCorretor.ativo, true)
    ))
    .limit(1);
  
  if (disponibilidade.length === 0) {
    return []; // Corretor não trabalha neste dia
  }
  
  const config = disponibilidade[0];
  const slots: string[] = [];
  
  // Gerar slots baseado no horário de trabalho
  const [horaInicio, minInicio] = config.horaInicio.split(':').map(Number);
  const [horaFim, minFim] = config.horaFim.split(':').map(Number);
  const duracaoSlot = config.duracaoSlot || 60;
  
  let horaAtual = horaInicio;
  let minAtual = minInicio;
  
  while (horaAtual < horaFim || (horaAtual === horaFim && minAtual < minFim)) {
    const slot = `${String(horaAtual).padStart(2, '0')}:${String(minAtual).padStart(2, '0')}`;
    
    // Verificar se está no intervalo de almoço
    if (config.intervaloInicio && config.intervaloFim) {
      const [intInicio, intMinInicio] = config.intervaloInicio.split(':').map(Number);
      const [intFim, intMinFim] = config.intervaloFim.split(':').map(Number);
      
      const slotMinutos = horaAtual * 60 + minAtual;
      const intervaloInicioMin = intInicio * 60 + intMinInicio;
      const intervaloFimMin = intFim * 60 + intMinFim;
      
      if (slotMinutos >= intervaloInicioMin && slotMinutos < intervaloFimMin) {
        // Pular para o fim do intervalo
        horaAtual = intFim;
        minAtual = intMinFim;
        continue;
      }
    }
    
    slots.push(slot);
    
    // Avançar para o próximo slot
    minAtual += duracaoSlot;
    while (minAtual >= 60) {
      minAtual -= 60;
      horaAtual++;
    }
  }
  
  // Remover slots já ocupados por agendamentos
  const inicioData = new Date(data);
  inicioData.setHours(0, 0, 0, 0);
  const fimData = new Date(data);
  fimData.setHours(23, 59, 59, 999);
  
  const agendamentosExistentes = await db.select({ horaAgendamento: agendamentos.horaAgendamento })
    .from(agendamentos)
    .where(and(
      eq(agendamentos.corretorId, corretorId),
      gte(agendamentos.dataAgendamento, inicioData),
      lte(agendamentos.dataAgendamento, fimData),
      inArray(agendamentos.status, ['pendente', 'confirmado'])
    ));
  
  const horariosOcupados = new Set(agendamentosExistentes.map(a => a.horaAgendamento));
  
  // Verificar bloqueios
  const bloqueios = await getBloqueiosAgenda(corretorId, inicioData, fimData);
  
  return slots.filter(slot => {
    // Verificar se não está ocupado
    if (horariosOcupados.has(slot)) return false;
    
    // Verificar se não está em um bloqueio
    const [h, m] = slot.split(':').map(Number);
    const slotDate = new Date(data);
    slotDate.setHours(h, m, 0, 0);
    
    for (const bloqueio of bloqueios) {
      if (bloqueio.diaInteiro) return false;
      if (slotDate >= bloqueio.dataInicio && slotDate < bloqueio.dataFim) return false;
    }
    
    return true;
  });
}

// ============================================================================
// CHATBOT DE PRÉ-QUALIFICAÇÃO
// ============================================================================

/**
 * Criar sessão de chatbot
 */
export async function createConversaChatbot(data: Partial<InsertConversaChatbot>): Promise<ConversaChatbot | null> {
  const db = await getDb();
  if (!db) return null;
  
  const sessionId = crypto.randomUUID().replace(/-/g, '');
  
  const result = await db.insert(conversasChatbot).values({
    sessionId,
    historico: JSON.stringify([]),
    ...data
  });
  
  const inserted = await db.select().from(conversasChatbot).where(eq(conversasChatbot.id, result[0].insertId)).limit(1);
  return inserted[0] || null;
}

/**
 * Buscar conversa por sessionId
 */
export async function getConversaChatbotBySession(sessionId: string): Promise<ConversaChatbot | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(conversasChatbot)
    .where(eq(conversasChatbot.sessionId, sessionId))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Atualizar conversa do chatbot
 */
export async function updateConversaChatbot(sessionId: string, data: Partial<InsertConversaChatbot>): Promise<ConversaChatbot | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(conversasChatbot)
    .set(data)
    .where(eq(conversasChatbot.sessionId, sessionId));
  
  return await getConversaChatbotBySession(sessionId);
}

/**
 * Adicionar mensagem ao histórico
 */
export async function addMensagemChatbot(sessionId: string, role: 'bot' | 'user', message: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const conversa = await getConversaChatbotBySession(sessionId);
  if (!conversa) return;
  
  const historico = conversa.historico ? JSON.parse(conversa.historico) : [];
  historico.push({
    role,
    message,
    timestamp: new Date().toISOString()
  });
  
  await db.update(conversasChatbot)
    .set({ historico: JSON.stringify(historico) })
    .where(eq(conversasChatbot.sessionId, sessionId));
}

/**
 * Buscar FAQs do chatbot
 */
export async function getFaqsChatbot(categoria?: string, projectId?: number): Promise<FaqChatbot[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(faqChatbot.ativo, true)];
  
  if (categoria) {
    conditions.push(eq(faqChatbot.categoria, categoria as any));
  }
  if (projectId) {
    conditions.push(or(
      eq(faqChatbot.projectId, projectId),
      sql`${faqChatbot.projectId} IS NULL`
    )!);
  }
  
  return await db.select()
    .from(faqChatbot)
    .where(and(...conditions))
    .orderBy(desc(faqChatbot.prioridade));
}

/**
 * Criar FAQ
 */
export async function createFaqChatbot(data: InsertFaqChatbot): Promise<FaqChatbot | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(faqChatbot).values(data);
  const inserted = await db.select().from(faqChatbot).where(eq(faqChatbot.id, result[0].insertId)).limit(1);
  return inserted[0] || null;
}

/**
 * Converter conversa em lead
 */
export async function converterConversaEmLead(sessionId: string, corretorId?: number): Promise<Lead | null> {
  const db = await getDb();
  if (!db) return null;
  
  const conversa = await getConversaChatbotBySession(sessionId);
  if (!conversa || !conversa.nome || !conversa.telefone) return null;
  
  // Criar lead
  const lead = await createLead({
    nome: conversa.nome,
    telefone: conversa.telefone,
    email: conversa.email || undefined,
    projectId: conversa.projectId || undefined,
    origem: 'chatbot',
    faixaRenda: conversa.rendaFamiliar || undefined,
    observacoes: `Lead gerado pelo chatbot. Prazo de compra: ${conversa.prazoCompra || 'não informado'}`,
    corretorId: corretorId
  });
  
  if (lead) {
    // Atualizar conversa com o lead criado
    await db.update(conversasChatbot)
      .set({
        status: 'convertido_lead',
        leadId: lead.id,
        corretorId: corretorId
      })
      .where(eq(conversasChatbot.sessionId, sessionId));
  }
  
  return lead;
}

// ============================================================================
// PROPOSTAS DIGITAIS
// ============================================================================

/**
 * Criar proposta
 */
export async function createProposta(data: InsertProposta): Promise<Proposta | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Gerar token único
  const token = crypto.randomUUID().replace(/-/g, '');
  
  const result = await db.insert(propostas).values({
    ...data,
    token
  });
  
  const inserted = await db.select().from(propostas).where(eq(propostas.id, result[0].insertId)).limit(1);
  return inserted[0] || null;
}

/**
 * Buscar proposta por ID
 */
export async function getPropostaById(id: number): Promise<Proposta | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(propostas)
    .where(eq(propostas.id, id))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Buscar proposta por token
 */
export async function getPropostaByToken(token: string): Promise<Proposta | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(propostas)
    .where(eq(propostas.token, token))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Buscar propostas do corretor
 */
export async function getPropostasCorretor(corretorId: number): Promise<Proposta[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(propostas)
    .where(eq(propostas.corretorId, corretorId))
    .orderBy(desc(propostas.createdAt));
}

/**
 * Buscar propostas do lead
 */
export async function getPropostasLead(leadId: number): Promise<Proposta[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(propostas)
    .where(eq(propostas.leadId, leadId))
    .orderBy(desc(propostas.createdAt));
}

/**
 * Atualizar proposta
 */
export async function updateProposta(id: number, data: Partial<InsertProposta>): Promise<Proposta | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(propostas)
    .set(data)
    .where(eq(propostas.id, id));
  
  return await getPropostaById(id);
}

/**
 * Registrar visualização da proposta (apenas visitantes únicos)
 */
export async function registrarVisualizacaoProposta(token: string, visitorId: string, ip?: string, userAgent?: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const proposta = await getPropostaByToken(token);
  if (!proposta) return false;
  
  // Verificar se este visitante já visualizou esta proposta
  const visitanteExistente = await db.select()
    .from(propostasVisitantes)
    .where(and(
      eq(propostasVisitantes.propostaId, proposta.id),
      eq(propostasVisitantes.visitorId, visitorId)
    ))
    .limit(1);
  
  // Se já visitou, apenas atualizar ultima visualização sem incrementar contador
  if (visitanteExistente.length > 0) {
    await db.update(propostas)
      .set({ ultimaVisualizacao: new Date() })
      .where(eq(propostas.token, token));
    return false; // Não é nova visualização
  }
  
  // Registrar novo visitante
  await db.insert(propostasVisitantes).values({
    propostaId: proposta.id,
    visitorId,
    ip,
    userAgent
  });
  
  // Incrementar contador de visualizações únicas
  const updates: Partial<Proposta> = {
    visualizacoes: (proposta.visualizacoes || 0) + 1,
    ultimaVisualizacao: new Date()
  };
  
  if (!proposta.primeiraVisualizacao) {
    updates.primeiraVisualizacao = new Date();
  }
  
  if (proposta.status === 'enviada') {
    updates.status = 'visualizada';
  }
  
  await db.update(propostas)
    .set(updates)
    .where(eq(propostas.token, token));
  
  return true; // Nova visualização registrada
}

/**
 * Registrar aceite da proposta
 */
export async function registrarAceiteProposta(token: string, ip: string, assinatura?: string): Promise<Proposta | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(propostas)
    .set({
      status: 'aceita',
      aceiteEm: new Date(),
      ipAceite: ip,
      assinaturaDigital: assinatura
    })
    .where(eq(propostas.token, token));
  
  return await getPropostaByToken(token);
}

/**
 * Buscar todas as propostas (para gestores)
 */
export async function getAllPropostas(filtros?: {
  corretorId?: number;
  projectId?: number;
  status?: string;
  dataInicio?: Date;
  dataFim?: Date;
}): Promise<Proposta[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (filtros?.corretorId) {
    conditions.push(eq(propostas.corretorId, filtros.corretorId));
  }
  if (filtros?.projectId) {
    conditions.push(eq(propostas.projectId, filtros.projectId));
  }
  if (filtros?.status) {
    conditions.push(eq(propostas.status, filtros.status as any));
  }
  if (filtros?.dataInicio) {
    conditions.push(gte(propostas.createdAt, filtros.dataInicio));
  }
  if (filtros?.dataFim) {
    conditions.push(lte(propostas.createdAt, filtros.dataFim));
  }
  
  if (conditions.length === 0) {
    return await db.select()
      .from(propostas)
      .orderBy(desc(propostas.createdAt))
      .limit(100);
  }
  
  return await db.select()
    .from(propostas)
    .where(and(...conditions))
    .orderBy(desc(propostas.createdAt));
}


/**
 * Excluir proposta
 */
export async function deleteProposta(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Primeiro excluir visitantes da proposta
  await db.delete(propostasVisitantes)
    .where(eq(propostasVisitantes.propostaId, id));
  
  // Depois excluir a proposta
  await db.delete(propostas)
    .where(eq(propostas.id, id));
}

/**
 * Desativar link de agendamento (após uso ou expiração)
 */
export async function desativarLinkAgendamento(linkId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(linksAgendamento)
    .set({ ativo: false })
    .where(eq(linksAgendamento.id, linkId));
}


/**
 * Buscar todos os agendamentos (para gestor)
 */
export async function getAllAgendamentos(filters?: {
  dataInicio?: string;
  dataFim?: string;
  corretorId?: number;
  corretoresIds?: number[] | null; // Filtro por equipe
  status?: string;
}): Promise<Array<{
  id: number;
  leadId: number;
  leadNome: string;
  leadTelefone: string;
  corretorId: number | null;
  corretorNome: string | null;
  projectId: number | null;
  projetoNome: string | null;
  dataAgendamento: Date;
  horaAgendamento: string;
  status: string;
  observacoes: string | null;
  createdAt: Date;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  let query = db
    .select({
      id: agendamentos.id,
      leadId: agendamentos.leadId,
      leadNome: leads.nome,
      leadTelefone: leads.telefone,
      corretorId: agendamentos.corretorId,
      corretorNome: users.name,
      projectId: agendamentos.projectId,
      projetoNome: projects.nome,
      dataAgendamento: agendamentos.dataAgendamento,
      horaAgendamento: agendamentos.horaAgendamento,
      status: agendamentos.status,
      observacoes: agendamentos.observacoes,
      createdAt: agendamentos.createdAt
    })
    .from(agendamentos)
    .leftJoin(leads, eq(agendamentos.leadId, leads.id))
    .leftJoin(users, eq(agendamentos.corretorId, users.id))
    .leftJoin(projects, eq(agendamentos.projectId, projects.id));
  
  const conditions: any[] = [];
  
  if (filters?.dataInicio) {
    conditions.push(gte(agendamentos.dataAgendamento, new Date(filters.dataInicio)));
  }
  if (filters?.dataFim) {
    conditions.push(lte(agendamentos.dataAgendamento, new Date(filters.dataFim)));
  }
  // Filtro por equipe (corretoresIds)
  if (filters?.corretoresIds && filters.corretoresIds.length > 0) {
    conditions.push(inArray(agendamentos.corretorId, filters.corretoresIds));
  }
  if (filters?.corretorId) {
    conditions.push(eq(agendamentos.corretorId, filters.corretorId));
  }
  if (filters?.status) {
    conditions.push(eq(agendamentos.status, filters.status as any));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  const result = await query.orderBy(desc(agendamentos.dataAgendamento));
  
  return result.map(r => ({
    ...r,
    leadNome: r.leadNome || 'Desconhecido',
    leadTelefone: r.leadTelefone || '',
    corretorNome: r.corretorNome || null,
    projetoNome: r.projetoNome || null
  }));
}


// ============================================================================
// DELETAR LINK DE AGENDAMENTO
// ============================================================================

export async function deleteLinkAgendamento(linkId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(linksAgendamento).where(eq(linksAgendamento.id, linkId));
}


// ============================================================================
// PROJETO FOCO DO MÊS
// ============================================================================

/**
 * Obtém a configuração do projeto foco
 */
export async function getConfiguracaoProjetoFoco() {
  const db = await getDb();
  if (!db) return null;
  
  // Buscar configuração (deve ter apenas 1 registro)
  const configs = await db.select()
    .from(configuracaoProjetoFoco)
    .limit(1);
  
  if (configs.length === 0) {
    // Criar configuração padrão se não existir
    await db.insert(configuracaoProjetoFoco).values({
      projetoId: null,
      corretoresIds: null,
      posicaoAtual: 0,
      ativo: false,
    });
    
    return {
      id: 1,
      projetoId: null,
      corretoresIds: [],
      posicaoAtual: 0,
      ativo: false,
      observacoes: null,
    };
  }
  
  const config = configs[0];
  
  // Se tem projeto foco, buscar dados do projeto
  if (config.projetoId) {
    const projeto = await db.select()
      .from(projects)
      .where(eq(projects.id, config.projetoId))
      .limit(1);
    
    return {
      ...config,
      corretoresIds: (config.corretoresIds as number[]) || [],
      projeto: projeto[0] || null,
    };
  }
  
  return {
    ...config,
    corretoresIds: (config.corretoresIds as number[]) || [],
    projeto: null,
  };
}

/**
 * Configura o projeto foco e os corretores da fila
 */
export async function setConfiguracaoProjetoFoco(
  projetoId: number | null,
  corretoresIds: number[],
  observacoes?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Verificar se já existe configuração
  const configs = await db.select()
    .from(configuracaoProjetoFoco)
    .limit(1);
  
  if (configs.length === 0) {
    // Criar nova configuração
    await db.insert(configuracaoProjetoFoco).values({
      projetoId,
      corretoresIds: corretoresIds as any,
      posicaoAtual: 0,
      ativo: true,
      observacoes: observacoes || null,
    });
  } else {
    // Atualizar configuração existente
    await db.update(configuracaoProjetoFoco)
      .set({
        projetoId,
        corretoresIds: corretoresIds as any,
        posicaoAtual: 0, // Reset posição ao mudar configuração
        ativo: true, // Ativar automaticamente ao salvar
        observacoes: observacoes || null,
      })
      .where(eq(configuracaoProjetoFoco.id, configs[0].id));
  }
}

/**
 * Ativa/desativa o projeto foco
 */
export async function toggleProjetoFoco(ativo: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const configs = await db.select()
    .from(configuracaoProjetoFoco)
    .limit(1);
  
  if (configs.length > 0) {
    await db.update(configuracaoProjetoFoco)
      .set({ ativo })
      .where(eq(configuracaoProjetoFoco.id, configs[0].id));
  }
}

/**
 * Busca o próximo corretor da fila do projeto foco (round-robin)
 */
export async function getProximoCorretorFilaFoco(): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Buscar configuração do projeto foco
  const config = await getConfiguracaoProjetoFoco();
  
  if (!config || !config.ativo || !config.corretoresIds || config.corretoresIds.length === 0) {
    return null; // Projeto foco não configurado ou inativo
  }
  
  const corretoresIds = config.corretoresIds as number[];
  const posicaoAtual = config.posicaoAtual || 0;
  
  // Buscar corretores da fila foco que estão presentes
  const corretoresPresentes = await db.select({
    id: users.id,
    status: users.status,
  })
    .from(users)
    .where(and(
      inArray(users.id, corretoresIds),
      eq(users.status, 'presente')
    ));
  
  if (corretoresPresentes.length === 0) {
    return null; // Nenhum corretor presente na fila foco
  }
  
  // Encontrar próximo corretor a partir da posição atual (round-robin)
  let tentativas = 0;
  let proximaPosicao = posicaoAtual;
  
  while (tentativas < corretoresIds.length) {
    const corretorId = corretoresIds[proximaPosicao];
    
    // Verificar se o corretor está presente
    const corretorPresente = corretoresPresentes.find(c => c.id === corretorId);
    
    if (corretorPresente) {
      // Atualizar posição para o próximo
      const novaPosicao = (proximaPosicao + 1) % corretoresIds.length;
      await db.update(configuracaoProjetoFoco)
        .set({ posicaoAtual: novaPosicao })
        .where(eq(configuracaoProjetoFoco.id, config.id));
      
      return corretorId;
    }
    
    // Próxima posição
    proximaPosicao = (proximaPosicao + 1) % corretoresIds.length;
    tentativas++;
  }
  
  return null; // Nenhum corretor disponível
}


/**
 * Busca leads que tiveram interação HOJE (ultimaTentativa atualizada hoje)
 * Usado para calcular progresso de follow-ups do dia
 */
export async function getLeadsComInteracaoHoje(corretorId: number, hoje: Date, amanha: Date) {
  const db = await getDb();
  if (!db) return [];
  
  // Buscar follow-ups que tiveram ultimaTentativa atualizada hoje
  return await db.select({
    leadId: followUps.leadId,
    ultimaTentativa: followUps.ultimaTentativa,
  })
    .from(followUps)
    .where(and(
      eq(followUps.corretorId, corretorId),
      gte(followUps.ultimaTentativa, hoje),
      lt(followUps.ultimaTentativa, amanha)
    ));
}

/**
 * Retorna TODOS os follow-ups que estavam agendados para hoje ou antes
 * (independente de terem sido trabalhados ou não)
 * Usado para cálculo de progresso com total fixo
 */
/**
 * Busca todos os corretores ativos (role = 'corretor')
 */
export async function getCorretoresAtivos() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
  })
    .from(users)
    .where(eq(users.role, 'corretor'));
}

/**
 * Busca corretores de uma equipe específica
 */
export async function getCorretoresByEquipe(equipeId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    equipeId: users.equipeId
  })
    .from(users)
    .where(and(
      eq(users.role, 'corretor'),
      eq(users.equipeId, equipeId)
    ));
}

export async function getTotalFollowUpsDoDia(corretorId: number, hojeParam?: Date, amanhaParam?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  // Usar timezone de São Paulo
  const { fimDoDiaHoje, inicioDoDiaHoje } = await import('./timezone');
  const inicioDeHoje = hojeParam || inicioDoDiaHoje(); // 00:00:00 de hoje
  const fimDeHoje = fimDoDiaHoje(); // 23:59:59.999 de hoje
  
  // Buscar follow-ups pendentes do dia atual (hoje)
  // Novo fluxo: apenas follow-ups com status "pendente" e dataFollowUp de hoje
  
  // IMPORTANTE: Filtrar apenas leads com status "em_atendimento"
  // para ser consistente com getFollowUpsDoDiaExpandido
  return await db.select({
    id: followUps.id,
    leadId: followUps.leadId,
    dataFollowUp: followUps.dataFollowUp,
    dataRegistro: followUps.dataRegistro,
    resultado: followUps.resultado,
    status: followUps.status,
  })
    .from(followUps)
    .leftJoin(leads, eq(followUps.leadId, leads.id))
    .where(and(
      eq(followUps.corretorId, corretorId),
      eq(followUps.status, "pendente"),
      gte(followUps.dataFollowUp, inicioDeHoje),
      lte(followUps.dataFollowUp, fimDeHoje),
      eq(leads.status, "em_atendimento") // APENAS leads Em Atendimento
    ));
}


/**
 * Cria ou atualiza follow-up quando lead muda para "Em Atendimento"
 * Esta é a ÚNICA forma de criar follow-ups no sistema
 */
export async function criarOuAtualizarFollowUp(leadId: number, corretorId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Verificar se já existe follow-up ativo para este lead
  const existente = await db.select()
    .from(followUps)
    .where(and(
      eq(followUps.leadId, leadId),
      eq(followUps.status, "ativo")
    ))
    .limit(1);
  
  if (existente[0]) {
    // Já existe, apenas atualizar próxima tentativa para amanhã
    const proximaTentativa = new Date();
    proximaTentativa.setDate(proximaTentativa.getDate() + 1);
    proximaTentativa.setHours(9, 0, 0, 0);
    
    await db.update(followUps)
      .set({ proximaTentativa })
      .where(eq(followUps.id, existente[0].id));
    
    return existente[0].id;
  }
  
  // Criar novo follow-up para amanhã às 9h
  const proximaTentativa = new Date();
  proximaTentativa.setDate(proximaTentativa.getDate() + 1);
  proximaTentativa.setHours(9, 0, 0, 0);
  
  const result = await db.insert(followUps).values({
    leadId,
    corretorId,
    tentativaAtual: 1, // Primeira tentativa
    maxTentativas: 3,
    proximaTentativa,
    status: "ativo",
    historicoTentativas: "[]"
  });
  
  return result[0].insertId;
}

/**
 * Busca próximo corretor disponível que ainda não tentou este lead
 */
export async function getProximoCorretorDisponivel(corretoresQueTentaram: number[]) {
  const db = await getDb();
  if (!db) return null;
  
  // Buscar TODOS os corretores que não estão na lista de quem já tentou
  // Não filtra por status (presente/ausente) - todos podem receber leads perdidos
  let whereConditions;
  if (corretoresQueTentaram.length > 0) {
    whereConditions = and(
      eq(users.role, 'corretor'),
      notInArray(users.id, corretoresQueTentaram)
    );
  } else {
    whereConditions = eq(users.role, 'corretor');
  }
  
  const corretoresDisponiveis = await db.select()
    .from(users)
    .where(whereConditions)
    .limit(1);
  
  return corretoresDisponiveis[0] || null;
}

// ============================================================================
// RELATÓRIOS E ANALYTICS
// ============================================================================

/**
 * Funil de Conversão Geral
 * Retorna quantidade de leads em cada etapa e taxa de conversão entre etapas
 */
export async function getFunilConversaoGeral(dataInicio?: Date, dataFim?: Date) {
  const db = await getDb();
  if (!db) return [];

  let whereCondition = undefined;
  if (dataInicio && dataFim) {
    whereCondition = and(
      gte(leads.createdAt, dataInicio),
      lte(leads.createdAt, dataFim)
    );
  }

  // Buscar contagem por status
  const statusCounts = await db
    .select({
      status: leads.status,
      count: sql<number>`COUNT(*)`.as('count')
    })
    .from(leads)
    .where(whereCondition)
    .groupBy(leads.status);

  // Ordenar status na sequência do funil
  const statusOrder = [
    'novo',
    'aguardando_atendimento',
    'em_atendimento',
    'agendado',
    'visita_realizada',
    'analise_credito',
    'contrato_fechado',
    'perdido'
  ];

  const funil = statusOrder.map(status => {
    const found = statusCounts.find(s => s.status === status);
    return {
      status,
      count: found ? Number(found.count) : 0
    };
  });

  // Calcular taxas de conversão entre etapas
  const funilComTaxas = funil.map((etapa, index) => {
    if (index === 0) {
      return { ...etapa, taxaConversao: 100 };
    }
    const etapaAnterior = funil[index - 1];
    const taxa = etapaAnterior.count > 0 
      ? (etapa.count / etapaAnterior.count) * 100 
      : 0;
    return { ...etapa, taxaConversao: Number(taxa.toFixed(2)) };
  });

  return funilComTaxas;
}

/**
 * Taxa de Conversão por Corretor
 * Retorna % de conversão de cada corretor (leads fechados / total de leads)
 */
export async function getTaxaConversaoPorCorretor(dataInicio?: Date, dataFim?: Date) {
  const db = await getDb();
  if (!db) return [];

  let whereCondition = undefined;
  if (dataInicio && dataFim) {
    whereCondition = and(
      gte(leads.createdAt, dataInicio),
      lte(leads.createdAt, dataFim)
    );
  }

  const stats = await db
    .select({
      corretorId: leads.corretorId,
      corretorNome: users.name,
      totalLeads: sql<number>`COUNT(*)`.as('totalLeads'),
      leadsFechados: sql<number>`SUM(CASE WHEN ${leads.status} = 'contrato_fechado' THEN 1 ELSE 0 END)`.as('leadsFechados')
    })
    .from(leads)
    .leftJoin(users, eq(leads.corretorId, users.id))
    .where(whereCondition)
    .groupBy(leads.corretorId, users.name);

  return stats.map(stat => ({
    corretorId: stat.corretorId,
    corretorNome: stat.corretorNome || 'Não atribuído',
    totalLeads: Number(stat.totalLeads),
    leadsFechados: Number(stat.leadsFechados),
    taxaConversao: Number(stat.totalLeads) > 0 
      ? Number(((Number(stat.leadsFechados) / Number(stat.totalLeads)) * 100).toFixed(2))
      : 0
  }));
}

/**
 * Tempo Médio por Etapa do Funil
 * Calcula tempo médio que leads permanecem em cada status
 */
export async function getTempoMedioPorEtapa(dataInicio?: Date, dataFim?: Date) {
  const db = await getDb();
  if (!db) return [];

  let whereCondition = undefined;
  if (dataInicio && dataFim) {
    whereCondition = and(
      gte(leadStatusTransitions.transitionAt, dataInicio),
      lte(leadStatusTransitions.transitionAt, dataFim)
    );
  }

  // Buscar transições de status
  const transitions = await db
    .select()
    .from(leadStatusTransitions)
    .where(whereCondition)
    .orderBy(asc(leadStatusTransitions.leadId), asc(leadStatusTransitions.transitionAt));

  // Calcular tempo em cada status
  const temposPorStatus: Record<string, number[]> = {};

  let currentLeadId: number | null = null;
  let currentStatus: string | null = null;
  let currentTime: Date | null = null;

  for (const transition of transitions) {
    if (transition.leadId !== currentLeadId) {
      // Novo lead
      currentLeadId = transition.leadId;
      currentStatus = transition.toStatus;
      currentTime = transition.transitionAt;
    } else if (currentStatus && currentTime) {
      // Calcular tempo no status anterior
      const tempoEmHoras = (transition.transitionAt.getTime() - currentTime.getTime()) / (1000 * 60 * 60);
      
      if (!temposPorStatus[currentStatus]) {
        temposPorStatus[currentStatus] = [];
      }
      temposPorStatus[currentStatus].push(tempoEmHoras);

      currentStatus = transition.toStatus;
      currentTime = transition.transitionAt;
    }
  }

  // Calcular médias
  return Object.entries(temposPorStatus).map(([status, tempos]) => ({
    status,
    tempoMedioHoras: Number((tempos.reduce((a, b) => a + b, 0) / tempos.length).toFixed(2)),
    tempoMedioDias: Number(((tempos.reduce((a, b) => a + b, 0) / tempos.length) / 24).toFixed(2)),
    quantidadeLeads: tempos.length
  }));
}

/**
 * Evolução de Vendas (VGV)
 * Mostra valor total de vendas por período
 */
export async function getEvolucaoVendas(
  dataInicio: Date,
  dataFim: Date,
  agrupamento: 'dia' | 'semana' | 'mes' = 'dia'
) {
  const db = await getDb();
  if (!db) return [];

  let dateFormat: string;
  switch (agrupamento) {
    case 'dia':
      dateFormat = '%Y-%m-%d';
      break;
    case 'semana':
      dateFormat = '%Y-%u'; // Ano-Semana
      break;
    case 'mes':
      dateFormat = '%Y-%m';
      break;
  }

  // Valor médio estimado por venda (R$ 300.000)
  const valorMedioPorVenda = 300000;

  const vendas = await db
    .select({
      periodo: sql<string>`DATE_FORMAT(${leads.createdAt}, ${dateFormat})`.as('periodo'),
      vgv: sql<number>`SUM(${valorMedioPorVenda})`.as('vgv'),
      quantidade: sql<number>`COUNT(*)`.as('quantidade')
    })
    .from(leads)
    .where(
      and(
        eq(leads.status, 'contrato_fechado'),
        gte(leads.createdAt, dataInicio),
        lte(leads.createdAt, dataFim)
      )
    )
    .groupBy(sql`periodo`)
    .orderBy(sql`periodo`);

  return vendas.map(v => ({
    periodo: v.periodo,
    vgv: Number(v.vgv),
    quantidade: Number(v.quantidade)
  }));
}

/**
 * Distribuição de Vendas por Projeto
 * Mostra % de vendas de cada empreendimento
 */
export async function getDistribuicaoVendasPorProjeto(dataInicio?: Date, dataFim?: Date) {
  const db = await getDb();
  if (!db) return [];

  let whereCondition = and(eq(leads.status, 'contrato_fechado'));
  if (dataInicio && dataFim) {
    whereCondition = and(
      whereCondition,
      gte(leads.createdAt, dataInicio),
      lte(leads.createdAt, dataFim)
    );
  }

  const vendas = await db
    .select({
      projetoId: leads.projectId,
      projetoNome: projects.nome,
      quantidade: sql<number>`COUNT(*)`.as('quantidade'),
      vgv: sql<number>`SUM(300000)`.as('vgv') // Valor médio estimado por venda
    })
    .from(leads)
    .leftJoin(projects, eq(leads.projetoId, projects.id))
    .where(whereCondition)
    .groupBy(leads.projetoId, projects.nome);

  const total = vendas.reduce((sum, v) => sum + Number(v.quantidade), 0);

  return vendas.map(v => ({
    projetoId: v.projetoId,
    projetoNome: v.projetoNome || 'Não especificado',
    quantidade: Number(v.quantidade),
    vgv: Number(v.vgv),
    percentual: total > 0 ? Number(((Number(v.quantidade) / total) * 100).toFixed(2)) : 0
  }));
}

/**
 * Origem de Leads mais Efetiva
 * Compara volume e taxa de conversão por origem
 */
export async function getOrigemLeadsMaisEfetiva(dataInicio?: Date, dataFim?: Date) {
  const db = await getDb();
  if (!db) return [];

  let whereCondition = undefined;
  if (dataInicio && dataFim) {
    whereCondition = and(
      gte(leads.createdAt, dataInicio),
      lte(leads.createdAt, dataFim)
    );
  }

  const stats = await db
    .select({
      origem: leads.origem,
      totalLeads: sql<number>`COUNT(*)`.as('totalLeads'),
      leadsFechados: sql<number>`SUM(CASE WHEN ${leads.status} = 'contrato_fechado' THEN 1 ELSE 0 END)`.as('leadsFechados')
    })
    .from(leads)
    .where(whereCondition)
    .groupBy(leads.origem);

  return stats.map(stat => ({
    origem: stat.origem || 'Não especificado',
    totalLeads: Number(stat.totalLeads),
    leadsFechados: Number(stat.leadsFechados),
    taxaConversao: Number(stat.totalLeads) > 0 
      ? Number(((Number(stat.leadsFechados) / Number(stat.totalLeads)) * 100).toFixed(2))
      : 0
  }));
}

/**
 * Leads por Horário de Entrada
 * Retorna matriz de dia da semana x hora do dia
 */
export async function getLeadsPorHorarioEntrada(dataInicio?: Date, dataFim?: Date) {
  const db = await getDb();
  if (!db) return [];

  let whereCondition = undefined;
  if (dataInicio && dataFim) {
    whereCondition = and(
      gte(leads.createdAt, dataInicio),
      lte(leads.createdAt, dataFim)
    );
  }

  const heatmapData = await db
    .select({
      diaSemana: sql<number>`DAYOFWEEK(${leads.createdAt})`.as('diaSemana'), // 1=Domingo, 7=Sábado
      hora: sql<number>`HOUR(${leads.createdAt})`.as('hora'),
      quantidade: sql<number>`COUNT(*)`.as('quantidade')
    })
    .from(leads)
    .where(whereCondition)
    .groupBy(sql`diaSemana`, sql`hora`);

  return heatmapData.map(d => ({
    diaSemana: Number(d.diaSemana),
    hora: Number(d.hora),
    quantidade: Number(d.quantidade)
  }));
}

/**
 * Ranking de Corretores Completo
 * Tabela com múltiplas métricas (versão detalhada para relatórios)
 */
export async function getRankingCorretoresCompleto(dataInicio?: Date, dataFim?: Date) {
  const db = await getDb();
  if (!db) return [];

  let whereCondition = undefined;
  if (dataInicio && dataFim) {
    whereCondition = and(
      gte(leads.createdAt, dataInicio),
      lte(leads.createdAt, dataFim)
    );
  }

  const ranking = await db
    .select({
      corretorId: leads.corretorId,
      corretorNome: users.name,
      leadsAtendidos: sql<number>`COUNT(*)`.as('leadsAtendidos'),
      leadsFechados: sql<number>`SUM(CASE WHEN ${leads.status} = 'contrato_fechado' THEN 1 ELSE 0 END)`.as('leadsFechados'),
      vgvGerado: sql<number>`SUM(CASE WHEN ${leads.status} = 'contrato_fechado' THEN 300000 ELSE 0 END)`.as('vgvGerado') // Valor médio estimado
    })
    .from(leads)
    .leftJoin(users, eq(leads.corretorId, users.id))
    .where(whereCondition)
    .groupBy(leads.corretorId, users.name);

  // Calcular tempo médio de resposta (primeira interação)
  const temposResposta = await db
    .select({
      corretorId: leadHistory.userId,
      tempoMedioMinutos: sql<number>`AVG(TIMESTAMPDIFF(MINUTE, ${leads.createdAt}, ${leadHistory.createdAt}))`.as('tempoMedioMinutos')
    })
    .from(leadHistory)
    .innerJoin(leads, eq(leadHistory.leadId, leads.id))
    .where(
      and(
        whereCondition,
        sql`${leadHistory.createdAt} = (SELECT MIN(createdAt) FROM lead_history WHERE lead_id = ${leadHistory.leadId})`
      )
    )
    .groupBy(leadHistory.userId);

  return ranking.map(r => {
    const tempoResposta = temposResposta.find(t => t.corretorId === r.corretorId);
    const totalLeads = Number(r.leadsAtendidos);
    const fechados = Number(r.leadsFechados);

    return {
      corretorId: r.corretorId,
      corretorNome: r.corretorNome || 'Não atribuído',
      leadsAtendidos: totalLeads,
      leadsFechados: fechados,
      taxaConversao: totalLeads > 0 ? Number(((fechados / totalLeads) * 100).toFixed(2)) : 0,
      vgvGerado: Number(r.vgvGerado),
      tempoMedioRespostaMinutos: tempoResposta ? Number(tempoResposta.tempoMedioMinutos) : null
    };
  }).sort((a, b) => b.vgvGerado - a.vgvGerado);
}

/**
 * Produtividade por Corretor
 * Distribuição de atividades
 */
export async function getProdutividadePorCorretor(dataInicio?: Date, dataFim?: Date) {
  const db = await getDb();
  if (!db) return [];

  let whereCondition = undefined;
  if (dataInicio && dataFim) {
    whereCondition = and(
      gte(leads.updatedAt, dataInicio),
      lte(leads.updatedAt, dataFim)
    );
  }

  const produtividade = await db
    .select({
      corretorId: leads.corretorId,
      corretorNome: users.name,
      emAtendimento: sql<number>`SUM(CASE WHEN ${leads.status} = 'em_atendimento' THEN 1 ELSE 0 END)`.as('emAtendimento'),
      agendados: sql<number>`SUM(CASE WHEN ${leads.status} = 'agendado' THEN 1 ELSE 0 END)`.as('agendados'),
      visitasRealizadas: sql<number>`SUM(CASE WHEN ${leads.status} = 'visita_realizada' THEN 1 ELSE 0 END)`.as('visitasRealizadas'),
      analiseCredito: sql<number>`SUM(CASE WHEN ${leads.status} = 'analise_credito' THEN 1 ELSE 0 END)`.as('analiseCredito')
    })
    .from(leads)
    .leftJoin(users, eq(leads.corretorId, users.id))
    .where(whereCondition)
    .groupBy(leads.corretorId, users.name);

  return produtividade.map(p => ({
    corretorId: p.corretorId,
    corretorNome: p.corretorNome || 'Não atribuído',
    emAtendimento: Number(p.emAtendimento),
    agendados: Number(p.agendados),
    visitasRealizadas: Number(p.visitasRealizadas),
    analiseCredito: Number(p.analiseCredito)
  }));
}

/**
 * Comparativo Mensal de Corretores
 * Evolução de vendas mês a mês
 */
export async function getComparativoMensalCorretores(anoInicio: number, anoFim: number) {
  const db = await getDb();
  if (!db) return [];

  const comparativo = await db
    .select({
      corretorId: leads.corretorId,
      corretorNome: users.name,
      mes: sql<string>`DATE_FORMAT(${leads.createdAt}, '%Y-%m')`.as('mes'),
      vendas: sql<number>`COUNT(*)`.as('vendas'),
      vgv: sql<number>`SUM(300000)`.as('vgv') // Valor médio estimado por venda
    })
    .from(leads)
    .leftJoin(users, eq(leads.corretorId, users.id))
    .where(
      and(
        eq(leads.status, 'contrato_fechado'),
        gte(leads.createdAt, new Date(`${anoInicio}-01-01`)),
        lte(leads.createdAt, new Date(`${anoFim}-12-31`))
      )
    )
    .groupBy(leads.corretorId, users.name, sql`mes`)
    .orderBy(sql`mes`);

  return comparativo.map(c => ({
    corretorId: c.corretorId,
    corretorNome: c.corretorNome || 'Não atribuído',
    mes: c.mes,
    vendas: Number(c.vendas),
    vgv: Number(c.vgv)
  }));
}

/**
 * Carga de Trabalho
 * Quantidade de leads ativos por corretor
 */
export async function getCargaTrabalho() {
  const db = await getDb();
  if (!db) return [];

  const carga = await db
    .select({
      corretorId: leads.corretorId,
      corretorNome: users.name,
      leadsAtivos: sql<number>`COUNT(*)`.as('leadsAtivos')
    })
    .from(leads)
    .leftJoin(users, eq(leads.corretorId, users.id))
    .where(
      and(
        notInArray(leads.status, ['contrato_fechado', 'perdido'])
      )
    )
    .groupBy(leads.corretorId, users.name);

  // Capacidade ideal: 50 leads ativos por corretor
  const capacidadeIdeal = 50;

  return carga.map(c => ({
    corretorId: c.corretorId,
    corretorNome: c.corretorNome || 'Não atribuído',
    leadsAtivos: Number(c.leadsAtivos),
    capacidadeIdeal,
    percentualCapacidade: Number(((Number(c.leadsAtivos) / capacidadeIdeal) * 100).toFixed(2))
  }));
}

/**
 * Previsão de Vendas
 * Projeção baseada em pipeline e taxa de conversão
 */
export async function getPrevisaoVendas() {
  const db = await getDb();
  if (!db) return { previsao: 0, pipeline: [] };

  // Buscar leads no pipeline (não fechados nem perdidos)
  const pipeline = await db
    .select({
      status: leads.status,
      quantidade: sql<number>`COUNT(*)`.as('quantidade'),
      vgvPotencial: sql<number>`SUM(300000)`.as('vgvPotencial') // Valor médio estimado por venda
    })
    .from(leads)
    .where(
      and(
        notInArray(leads.status, ['contrato_fechado', 'perdido'])
      )
    )
    .groupBy(leads.status);

  // Calcular taxa de conversão histórica
  const totalLeads = await db
    .select({
      total: sql<number>`COUNT(*)`.as('total'),
      fechados: sql<number>`SUM(CASE WHEN ${leads.status} = 'contrato_fechado' THEN 1 ELSE 0 END)`.as('fechados')
    })
    .from(leads);

  const taxaConversaoHistorica = Number(totalLeads[0]?.total) > 0
    ? Number(totalLeads[0].fechados) / Number(totalLeads[0].total)
    : 0.1; // 10% default

  // Pesos por status (probabilidade de conversão)
  const pesosPorStatus: Record<string, number> = {
    'novo': 0.05,
    'aguardando_atendimento': 0.1,
    'em_atendimento': 0.2,
    'agendado': 0.4,
    'visita_realizada': 0.6,
    'analise_credito': 0.8
  };

  let previsaoVGV = 0;
  const pipelineDetalhado = pipeline.map(p => {
    const peso = pesosPorStatus[p.status] || 0.1;
    const vgvPonderado = Number(p.vgvPotencial) * peso;
    previsaoVGV += vgvPonderado;

    return {
      status: p.status,
      quantidade: Number(p.quantidade),
      vgvPotencial: Number(p.vgvPotencial),
      peso,
      vgvPonderado
    };
  });

  return {
    previsaoVGV: Number(previsaoVGV.toFixed(2)),
    taxaConversaoHistorica: Number((taxaConversaoHistorica * 100).toFixed(2)),
    pipeline: pipelineDetalhado
  };
}

// ============================================================================
// LOGS DE TRANSFERÊNCIAS AUTOMÁTICAS
// ============================================================================

interface LogTransferenciasFilters {
  dataInicio?: string;
  dataFim?: string;
  corretorOrigemId?: number;
  corretorDestinoId?: number;
  motivo?: "2_dias_sem_interacao" | "sem_corretores_disponiveis";
  statusFinal?: "transferido" | "perdido";
  limit?: number;
  offset?: number;
}

export async function getLogTransferencias(filters: LogTransferenciasFilters) {
  const db = await getDb();
  if (!db) return [];

  const { 
    dataInicio, 
    dataFim, 
    corretorOrigemId, 
    corretorDestinoId, 
    motivo, 
    statusFinal,
    limit = 100,
    offset = 0 
  } = filters;

  let query = db.select().from(logTransferencias);

  const conditions = [];
  
  if (dataInicio) {
    conditions.push(gte(logTransferencias.dataTransferencia, new Date(dataInicio)));
  }
  
  if (dataFim) {
    const dataFimDate = new Date(dataFim);
    dataFimDate.setHours(23, 59, 59, 999); // Incluir todo o dia final
    conditions.push(lte(logTransferencias.dataTransferencia, dataFimDate));
  }
  
  if (corretorOrigemId) {
    conditions.push(eq(logTransferencias.corretorOrigemId, corretorOrigemId));
  }
  
  if (corretorDestinoId) {
    conditions.push(eq(logTransferencias.corretorDestinoId, corretorDestinoId));
  }
  
  if (motivo) {
    conditions.push(eq(logTransferencias.motivo, motivo));
  }
  
  if (statusFinal) {
    conditions.push(eq(logTransferencias.statusFinal, statusFinal));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  const results = await query
    .orderBy(desc(logTransferencias.dataTransferencia))
    .limit(limit)
    .offset(offset);

  // Buscar nomes dos corretores
  const corretorIds = new Set<number>();
  for (const log of results) {
    if (log.corretorOrigemId) corretorIds.add(log.corretorOrigemId);
    if (log.corretorDestinoId) corretorIds.add(log.corretorDestinoId);
  }
  
  const corretoresMap = new Map<number, string>();
  if (corretorIds.size > 0) {
    const corretores = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, Array.from(corretorIds)));
    
    for (const corretor of corretores) {
      corretoresMap.set(corretor.id, corretor.name || 'Sem nome');
    }
  }
  
  // Adicionar nomes aos resultados
  const resultsWithNames = results.map(log => ({
    ...log,
    corretorOrigemNome: log.corretorOrigemId ? corretoresMap.get(log.corretorOrigemId) || null : null,
    corretorDestinoNome: log.corretorDestinoId ? corretoresMap.get(log.corretorDestinoId) || null : null,
  }));

  return resultsWithNames;
}

export async function countLogTransferencias(filters: Omit<LogTransferenciasFilters, 'limit' | 'offset'>) {
  const db = await getDb();
  if (!db) return 0;

  const { 
    dataInicio, 
    dataFim, 
    corretorOrigemId, 
    corretorDestinoId, 
    motivo, 
    statusFinal 
  } = filters;

  const conditions = [];
  
  if (dataInicio) {
    conditions.push(gte(logTransferencias.dataTransferencia, new Date(dataInicio)));
  }
  
  if (dataFim) {
    const dataFimDate = new Date(dataFim);
    dataFimDate.setHours(23, 59, 59, 999);
    conditions.push(lte(logTransferencias.dataTransferencia, dataFimDate));
  }
  
  if (corretorOrigemId) {
    conditions.push(eq(logTransferencias.corretorOrigemId, corretorOrigemId));
  }
  
  if (corretorDestinoId) {
    conditions.push(eq(logTransferencias.corretorDestinoId, corretorDestinoId));
  }
  
  if (motivo) {
    conditions.push(eq(logTransferencias.motivo, motivo));
  }
  
  if (statusFinal) {
    conditions.push(eq(logTransferencias.statusFinal, statusFinal));
  }

  let query = db.select({ count: sql<number>`count(*)` }).from(logTransferencias);

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  const result = await query;
  return result[0]?.count || 0;
}


/**
 * Cancela follow-ups pendentes de um lead quando ele muda de status
 * para qualquer status diferente de "em_atendimento"
 * 
 * @param leadId ID do lead
 * @returns Número de follow-ups cancelados
 */
export async function cancelarFollowUpsPendentes(leadId: number) {
  const db = await getDb();
  if (!db) return 0;
  
  try {
    // Buscar lead para verificar status atual
    const lead = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    
    if (!lead[0]) {
      console.log(`[cancelarFollowUpsPendentes] Lead ${leadId} não encontrado`);
      return 0;
    }
    
    // Se lead está "em_atendimento", não cancela follow-ups
    if (lead[0].status === 'em_atendimento') {
      console.log(`[cancelarFollowUpsPendentes] Lead ${leadId} está em atendimento, mantendo follow-ups`);
      return 0;
    }
    
    // Cancelar todos os follow-ups pendentes deste lead
    const resultado = await db
      .update(followUps)
      .set({ 
        status: 'cancelado',
        observacao: `Cancelado automaticamente: lead mudou para status "${lead[0].status}"`
      })
      .where(and(
        eq(followUps.leadId, leadId),
        eq(followUps.status, 'pendente')
      ));
    
    console.log(`[cancelarFollowUpsPendentes] Lead ${leadId}: ${resultado.rowsAffected || 0} follow-ups cancelados`);
    return resultado.rowsAffected || 0;
    
  } catch (error) {
    console.error('[cancelarFollowUpsPendentes] Erro:', error);
    return 0;
  }
}

/**
 * Job de limpeza periódica: cancela follow-ups pendentes de leads
 * que não estão mais com status "em_atendimento"
 * 
 * @returns Estatísticas da limpeza
 */
export async function limparFollowUpsOrfaos() {
  const db = await getDb();
  if (!db) return { total: 0, cancelados: 0 };
  
  try {
    console.log('[limparFollowUpsOrfaos] Iniciando limpeza de follow-ups órfãos...');
    
    // Buscar todos os follow-ups pendentes com seus leads
    const followUpsPendentes = await db
      .select({
        followUpId: followUps.id,
        leadId: followUps.leadId,
        leadStatus: leads.status,
      })
      .from(followUps)
      .leftJoin(leads, eq(followUps.leadId, leads.id))
      .where(eq(followUps.status, 'pendente'));
    
    console.log(`[limparFollowUpsOrfaos] Encontrados ${followUpsPendentes.length} follow-ups pendentes`);
    
    // Filtrar follow-ups de leads que não estão "em_atendimento"
    const orfaos = followUpsPendentes.filter(f => f.leadStatus !== 'em_atendimento');
    
    if (orfaos.length === 0) {
      console.log('[limparFollowUpsOrfaos] Nenhum follow-up órfão encontrado');
      return { total: followUpsPendentes.length, cancelados: 0 };
    }
    
    console.log(`[limparFollowUpsOrfaos] Encontrados ${orfaos.length} follow-ups órfãos para cancelar`);
    
    // Cancelar cada follow-up órfão
    let cancelados = 0;
    for (const orfao of orfaos) {
      try {
        await db
          .update(followUps)
          .set({ 
            status: 'cancelado',
            observacao: `Cancelado automaticamente: lead com status "${orfao.leadStatus}"`
          })
          .where(eq(followUps.id, orfao.followUpId));
        
        cancelados++;
      } catch (error) {
        console.error(`[limparFollowUpsOrfaos] Erro ao cancelar follow-up ${orfao.followUpId}:`, error);
      }
    }
    
    console.log(`[limparFollowUpsOrfaos] Limpeza concluída: ${cancelados} follow-ups cancelados`);
    
    return {
      total: followUpsPendentes.length,
      cancelados,
    };
    
  } catch (error) {
    console.error('[limparFollowUpsOrfaos] Erro:', error);
    return { total: 0, cancelados: 0 };
  }
}

// Sincronizar agendamentos criados hoje com atividades diárias
export async function sincronizarAgendamentosDoDia() {
  const db = await getDb();
  if (!db) return;
  
  // Usar timezone de São Paulo
  const { inicioDoDiaHoje, fimDoDiaHoje } = await import('./timezone');
  const hoje = inicioDoDiaHoje();
  const fimDia = fimDoDiaHoje();
  
  // Buscar todos os agendamentos criados hoje
  const agendamentosHoje = await db.select({
    corretorId: agendamentos.corretorId,
    count: sql<number>`COUNT(*)`,
  })
    .from(agendamentos)
    .where(and(
      gte(agendamentos.createdAt, hoje),
      lte(agendamentos.createdAt, fimDia)
    ))
    .groupBy(agendamentos.corretorId);
  
  // Atualizar atividades diárias de cada corretor
  for (const { corretorId, count } of agendamentosHoje) {
    // Garantir que existe registro para hoje
    await getOrCreateAtividadeDiaria(corretorId, hoje);
    
    // Atualizar diretamente o campo agendamentosConfirmados
    // Usar DATE() para garantir comparação correta independente de timezone
    await db.execute(sql`
      UPDATE atividades_diarias 
      SET agendamentosConfirmados = ${count}
      WHERE corretorId = ${corretorId} 
        AND DATE(data) = DATE(${hoje})
      LIMIT 1
    `);
    
    // Recalcular pontuação
    await calcularPontuacaoDiaria(corretorId);
  }
}

// ============================================================================
// SINCRONIZAÇÃO DE MÉTRICAS PELA DATA DE CRIAÇÃO
// ============================================================================

/**
 * Helper para obter intervalo de hoje (início e fim) no timezone de São Paulo
 */
function obterIntervaloHoje() {
  const now = new Date();
  const saoPauloOffset = -3 * 60; // GMT-3 em minutos
  const localOffset = now.getTimezoneOffset();
  const offsetDiff = (saoPauloOffset - localOffset) * 60 * 1000;
  
  const saoPauloNow = new Date(now.getTime() + offsetDiff);
  
  // Início do dia (00:00:00)
  const inicioHoje = new Date(saoPauloNow);
  inicioHoje.setHours(0, 0, 0, 0);
  
  // Fim do dia (23:59:59)
  const fimHoje = new Date(saoPauloNow);
  fimHoje.setHours(23, 59, 59, 999);
  
  // Data para comparação no banco (formato YYYY-MM-DD)
  const hoje = new Date(saoPauloNow);
  hoje.setHours(0, 0, 0, 0);
  
  return { inicioHoje, fimHoje, hoje };
}

/**
 * Garante que existe um registro em atividadesDiarias para o corretor na data especificada
 * Se não existir, cria um novo registro com valores zerados
 */
async function garantirAtividadeDiariaExiste(corretorId: number, data: Date) {
  const db = await getDb();
  if (!db) return;
  
  // Verificar se já existe
  const existente = await db
    .select()
    .from(atividadesDiarias)
    .where(
      and(
        eq(atividadesDiarias.corretorId, corretorId),
        eq(atividadesDiarias.data, data)
      )
    )
    .limit(1);
  
  // Se não existe, criar com valores zerados
  if (existente.length === 0) {
    await db.insert(atividadesDiarias).values({
      corretorId,
      data,
      ligacoesRealizadas: 0,
      ligacoesAtendidas: 0,
      whatsappEnviados: 0,
      whatsappRespondidos: 0,
      agendamentosConfirmados: 0,
      visitasRealizadas: 0,
      documentacoesRecolhidas: 0,
      analisesCredito: 0,
      contratosFechados: 0,
      pontuacao: 0,
    });
    console.log(`[garantirAtividadeDiariaExiste] Criado registro para corretor ${corretorId} na data ${data.toISOString().split('T')[0]}`);
  }
}

/**
 * Sincroniza interações (ligações e WhatsApp) criadas hoje
 * Conta pela data de criação (createdAt), não pela mudança de status
 */
export async function sincronizarInteracoesDoDia() {
  const db = await getDb();
  if (!db) return;
  
  // Usar funções corretas de timezone
  const { inicioDoDiaHoje, fimDoDiaHoje } = await import('./timezone');
  const inicioHoje = inicioDoDiaHoje();
  const fimHoje = fimDoDiaHoje();
  const hoje = new Date(inicioHoje);
  hoje.setHours(0, 0, 0, 0);
  
  // Buscar da tabela interacoes
  const interacoesHoje = await db
    .select({
      corretorId: interacoes.corretorId,
      tipo: interacoes.tipo,
      total: sql<number>`COUNT(*)`,
      atendidas: sql<number>`SUM(CASE WHEN ${interacoes.atendida} = 1 THEN 1 ELSE 0 END)`,
      respondidas: sql<number>`SUM(CASE WHEN ${interacoes.respondida} = 1 THEN 1 ELSE 0 END)`,
    })
    .from(interacoes)
    .where(
      and(
        gte(interacoes.createdAt, inicioHoje),
        lte(interacoes.createdAt, fimHoje)
      )
    )
    .groupBy(interacoes.corretorId, interacoes.tipo);
  
  // Atualizar contadores para cada corretor
  const corretoresMap = new Map<number, { ligacoes: number, ligacoesAtendidas: number, whatsapp: number, whatsappRespondidos: number }>();
  
  for (const interacao of interacoesHoje) {
    if (!corretoresMap.has(interacao.corretorId)) {
      corretoresMap.set(interacao.corretorId, { ligacoes: 0, ligacoesAtendidas: 0, whatsapp: 0, whatsappRespondidos: 0 });
    }
    
    const corretor = corretoresMap.get(interacao.corretorId)!;
    
    if (interacao.tipo === 'ligacao') {
      corretor.ligacoes = interacao.total;
      corretor.ligacoesAtendidas = interacao.atendidas;
    } else if (interacao.tipo === 'whatsapp') {
      corretor.whatsapp = interacao.total;
      corretor.whatsappRespondidos = interacao.respondidas;
    }
  }
  
  // Atualizar banco de dados
  for (const [corretorId, contadores] of corretoresMap.entries()) {
    // Garantir que existe registro antes de UPDATE
    await garantirAtividadeDiariaExiste(corretorId, hoje);
    
    await db
      .update(atividadesDiarias)
      .set({
        ligacoesRealizadas: contadores.ligacoes,
        ligacoesAtendidas: contadores.ligacoesAtendidas,
        whatsappEnviados: contadores.whatsapp,
        whatsappRespondidos: contadores.whatsappRespondidos,
      })
      .where(
        and(
          eq(atividadesDiarias.corretorId, corretorId),
          eq(atividadesDiarias.data, hoje)
        )
      );
    
    // Recalcular pontuação
    await calcularPontuacaoDiaria(corretorId);
  }
  
  console.log(`[Sync] Sincronizadas ${interacoesHoje.length} interações de ${corretoresMap.size} corretores`);
}

/**
 * Sincroniza visitas criadas hoje
 * Conta pela data de criação (createdAt), não pela mudança de status
 */
export async function sincronizarVisitasDoDia() {
  const db = await getDb();
  if (!db) return;
  
  // Usar funções corretas de timezone
  const { inicioDoDiaHoje, fimDoDiaHoje } = await import('./timezone');
  const inicioHoje = inicioDoDiaHoje();
  const fimHoje = fimDoDiaHoje();
  const hoje = new Date(inicioHoje);
  hoje.setHours(0, 0, 0, 0);
  
  // Buscar da tabela visitas
  const visitasHoje = await db
    .select({
      corretorId: visitas.corretorId,
      total: sql<number>`COUNT(*)`,
    })
    .from(visitas)
    .where(
      and(
        gte(visitas.createdAt, inicioHoje),
        lte(visitas.createdAt, fimHoje)
      )
    )
    .groupBy(visitas.corretorId);
  
  // Atualizar contadores para cada corretor
  for (const visita of visitasHoje) {
    // Garantir que existe registro antes de UPDATE
    await garantirAtividadeDiariaExiste(visita.corretorId, hoje);
    
    await db
      .update(atividadesDiarias)
      .set({
        visitasRealizadas: visita.total,
      })
      .where(
        and(
          eq(atividadesDiarias.corretorId, visita.corretorId),
          eq(atividadesDiarias.data, hoje)
        )
      );
    
    // Recalcular pontuação
    await calcularPontuacaoDiaria(visita.corretorId);
  }
  
  console.log(`[Sync] Sincronizadas ${visitasHoje.length} visitas`);
}

/**
 * Sincroniza documentações criadas hoje
 * Conta pela data de criação (createdAt), não pela mudança de status
 */
export async function sincronizarDocumentacoesDoDia() {
  const db = await getDb();
  if (!db) return;
  
  // Usar funções corretas de timezone
  const { inicioDoDiaHoje, fimDoDiaHoje } = await import('./timezone');
  const inicioHoje = inicioDoDiaHoje();
  const fimHoje = fimDoDiaHoje();
  const hoje = new Date(inicioHoje);
  hoje.setHours(0, 0, 0, 0);
  
  // Buscar da tabela documentacoes
  const documentacoesHoje = await db
    .select({
      corretorId: documentacoes.corretorId,
      total: sql<number>`COUNT(*)`,
    })
    .from(documentacoes)
    .where(
      and(
        gte(documentacoes.createdAt, inicioHoje),
        lte(documentacoes.createdAt, fimHoje)
      )
    )
    .groupBy(documentacoes.corretorId);
  
  // Atualizar contadores para cada corretor
  for (const doc of documentacoesHoje) {
    // Garantir que existe registro antes de UPDATE
    await garantirAtividadeDiariaExiste(doc.corretorId, hoje);
    
    await db
      .update(atividadesDiarias)
      .set({
        documentacoesRecolhidas: doc.total,
      })
      .where(
        and(
          eq(atividadesDiarias.corretorId, doc.corretorId),
          eq(atividadesDiarias.data, hoje)
        )
      );
    
    // Recalcular pontuação
    await calcularPontuacaoDiaria(doc.corretorId);
  }
  
  console.log(`[Sync] Sincronizadas ${documentacoesHoje.length} documentações`);
}

/**
 * Sincroniza análises de crédito criadas hoje
 * Conta pela data de criação (createdAt), não pela mudança de status
 */
export async function sincronizarAnalisesCreditoDoDia() {
  const db = await getDb();
  if (!db) return;
  
  // Usar funções corretas de timezone
  const { inicioDoDiaHoje, fimDoDiaHoje } = await import('./timezone');
  const inicioHoje = inicioDoDiaHoje();
  const fimHoje = fimDoDiaHoje();
  const hoje = new Date(inicioHoje);
  hoje.setHours(0, 0, 0, 0);
  
  // Buscar da tabela analises_credito
  const analisesHoje = await db
    .select({
      corretorId: analises_credito.corretorId,
      total: sql<number>`COUNT(*)`,
    })
    .from(analises_credito)
    .where(
      and(
        gte(analises_credito.createdAt, inicioHoje),
        lte(analises_credito.createdAt, fimHoje)
      )
    )
    .groupBy(analises_credito.corretorId);
  
  // Atualizar contadores para cada corretor
  for (const analise of analisesHoje) {
    // Garantir que existe registro antes de UPDATE
    await garantirAtividadeDiariaExiste(analise.corretorId, hoje);
    
    await db
      .update(atividadesDiarias)
      .set({
        analiseCreditoEnviadas: analise.total,
      })
      .where(
        and(
          eq(atividadesDiarias.corretorId, analise.corretorId),
          eq(atividadesDiarias.data, hoje)
        )
      );
    
    // Recalcular pontuação
    await calcularPontuacaoDiaria(analise.corretorId);
  }
  
  console.log(`[Sync] Sincronizadas ${analisesHoje.length} análises de crédito`);
}

/**
 * Sincroniza contratos fechados hoje
 * Conta pela data de criação (createdAt), não pela mudança de status
 */
export async function sincronizarContratosDoDia() {
  const db = await getDb();
  if (!db) return;
  
  // Usar funções corretas de timezone
  const { inicioDoDiaHoje, fimDoDiaHoje } = await import('./timezone');
  const inicioHoje = inicioDoDiaHoje();
  const fimHoje = fimDoDiaHoje();
  const hoje = new Date(inicioHoje);
  hoje.setHours(0, 0, 0, 0);
  
  // Buscar da tabela contratos
  const contratosHoje = await db
    .select({
      corretorId: contratos.corretorId,
      total: sql<number>`COUNT(*)`,
      vgvTotal: sql<number>`COALESCE(SUM(${contratos.valorVenda}), 0)`,
    })
    .from(contratos)
    .where(
      and(
        gte(contratos.createdAt, inicioHoje),
        lte(contratos.createdAt, fimHoje)
      )
    )
    .groupBy(contratos.corretorId);
  
  // Atualizar contadores para cada corretor
  for (const contrato of contratosHoje) {
    // Garantir que existe registro antes de UPDATE
    await garantirAtividadeDiariaExiste(contrato.corretorId, hoje);
    
    await db
      .update(atividadesDiarias)
      .set({
        contratosFechados: contrato.total,
        vgv: contrato.vgvTotal.toString(),
      })
      .where(
        and(
          eq(atividadesDiarias.corretorId, contrato.corretorId),
          eq(atividadesDiarias.data, hoje)
        )
      );
    
    // Recalcular pontuação
    await calcularPontuacaoDiaria(contrato.corretorId);
  }
  
  console.log(`[Sync] Sincronizados ${contratosHoje.length} contratos`);
}

/**
 * Sincroniza todas as métricas do dia
 * Executa todas as sincronizações em sequência
 */
export async function sincronizarTodasMetricasDoDia() {
  console.log('[Sync] Iniciando sincronização de todas as métricas...');
  
  try {
    await sincronizarInteracoesDoDia();
    await sincronizarAgendamentosDoDia();
    await sincronizarVisitasDoDia();
    await sincronizarDocumentacoesDoDia();
    await sincronizarAnalisesCreditoDoDia();
    await sincronizarContratosDoDia();
    
    console.log('[Sync] Sincronização completa!');
  } catch (error) {
    console.error('[Sync] Erro na sincronização:', error);
  }
}

// ============================================================================
// FUNÇÕES PARA INSERIR REGISTROS NAS NOVAS TABELAS
// ============================================================================

/**
 * Criar registro de interação (ligação ou WhatsApp)
 */
export async function createInteracao(data: InsertInteracao): Promise<Interacao | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(interacoes).values(data);
  const insertId = result[0].insertId;
  
  const interacao = await db.select().from(interacoes).where(eq(interacoes.id, insertId)).limit(1);
  return interacao[0] || null;
}

/**
 * Criar registro de documentação recolhida
 */
export async function createDocumentacao(data: InsertDocumentacao): Promise<Documentacao | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(documentacoes).values(data);
  const insertId = result[0].insertId;
  
  const doc = await db.select().from(documentacoes).where(eq(documentacoes.id, insertId)).limit(1);
  return doc[0] || null;
}

/**
 * Criar registro de análise de crédito
 */
export async function createAnaliseCredito(data: InsertAnaliseCredito): Promise<AnaliseCredito | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(analises_credito).values(data);
  const insertId = result[0].insertId;
  
  const analise = await db.select().from(analises_credito).where(eq(analises_credito.id, insertId)).limit(1);
  return analise[0] || null;
}

/**
 * Criar registro de contrato fechado
 */
export async function createContrato(data: InsertContrato): Promise<Contrato | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(contratos).values(data);
  const insertId = result[0].insertId;
  
  const contrato = await db.select().from(contratos).where(eq(contratos.id, insertId)).limit(1);
  return contrato[0] || null;
}


// ============================================================================
// METAS GLOBAIS E DASHBOARD DE PERFORMANCE
// ============================================================================

/**
 * Buscar ou criar meta global para um mês/ano
 */
export async function getMetaGlobal(mes: number, ano: number) {
  const db = await getDb();
  if (!db) return null;
  
  const existing = await db.select()
    .from(metasGlobais)
    .where(and(
      eq(metasGlobais.mes, mes),
      eq(metasGlobais.ano, ano)
    ))
    .limit(1);
  
  if (existing.length > 0) return existing[0];
  
  // Criar meta padrão se não existir
  await db.insert(metasGlobais).values({
    mes,
    ano,
    metaVGV: '50000000', // R$ 500.000 padrão
    metaContratos: 10,
    metaLeads: 200,
    metaAgendamentos: 50,
    metaVisitas: 30,
  });
  
  const created = await db.select()
    .from(metasGlobais)
    .where(and(
      eq(metasGlobais.mes, mes),
      eq(metasGlobais.ano, ano)
    ))
    .limit(1);
  
  return created[0] || null;
}

/**
 * Atualizar meta global
 */
export async function updateMetaGlobal(id: number, data: {
  metaVGV?: string;
  metaContratos?: number;
  metaLeads?: number;
  metaAgendamentos?: number;
  metaVisitas?: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(metasGlobais)
    .set(data)
    .where(eq(metasGlobais.id, id));
  
  const updated = await db.select()
    .from(metasGlobais)
    .where(eq(metasGlobais.id, id))
    .limit(1);
  
  return updated[0] || null;
}

/**
 * Dashboard de Performance: dados agregados de VGV por corretor vs meta
 * Retorna dados para gráficos e tabelas do dashboard
 */
export async function getDashboardPerformance(mes: number, ano: number, equipeId?: number) {
  const db = await getDb();
  if (!db) return null;
  
  // Buscar meta global
  const metaGlobal = await getMetaGlobal(mes, ano);
  
  // Período do mês
  const dataInicio = new Date(ano, mes - 1, 1);
  const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999);
  
  // Buscar todos os vendedores (corretores, gestores e admins que também vendem)
  let corretoresResult = await db.select().from(users).where(
    inArray(users.role, ['corretor', 'gestor', 'admin'])
  );
  
  if (equipeId) {
    // Buscar membros da equipe + gestor
    const { getCorretoresDaEquipe, getEquipeById } = await import('./equipes');
    const equipe = await getEquipeById(equipeId);
    const membros = await getCorretoresDaEquipe(equipeId);
    const membrosIds = membros.map(m => m.id);
    
    // Incluir o gestor da equipe
    if (equipe?.gestorId && !membrosIds.includes(equipe.gestorId)) {
      membrosIds.push(equipe.gestorId);
    }
    
    // Filtrar apenas membros da equipe + gestor
    corretoresResult = corretoresResult.filter(c => membrosIds.includes(c.id));
  }
  
  // Dados por corretor
  const corretoresData = [];
  let totalVGV = 0;
  let totalContratos = 0;
  let totalLeads = 0;
  let totalAgendamentos = 0;
  let totalVisitas = 0;
  
  for (const corretor of corretoresResult) {
    if (corretor.situacao === 'inativo') continue;
    
    // VGV do corretor (contratos fechados)
    const vgvResult = await db.select({
      total: sql<number>`COALESCE(SUM(${contratos.valorVenda}), 0)`,
      count: sql<number>`COUNT(*)`
    })
      .from(contratos)
      .where(and(
        eq(contratos.corretorId, corretor.id),
        gte(contratos.createdAt, dataInicio),
        lte(contratos.createdAt, dataFim)
      ));
    
    const vgvCorretor = Number(vgvResult[0]?.total || 0); // Manter em reais
    const contratosCorretor = Number(vgvResult[0]?.count || 0);
    
    // Leads do corretor no período
    const leadsResult = await db.select({
      status: leads.status,
      count: sql<number>`COUNT(*)`
    })
      .from(leads)
      .where(and(
        eq(leads.corretorId, corretor.id),
        gte(leads.createdAt, dataInicio),
        lte(leads.createdAt, dataFim)
      ))
      .groupBy(leads.status);
    
    let leadsCorretor = 0;
    let agendamentosCorretor = 0;
    let visitasCorretor = 0;
    
    for (const row of leadsResult) {
      const count = Number(row.count);
      leadsCorretor += count;
      if (row.status === 'agendado') agendamentosCorretor = count;
      if (row.status === 'visita_realizada') visitasCorretor = count;
    }
    
    // Buscar meta individual do corretor
    const metaIndividual = await getMetaByCorretorMesAno(corretor.id, mes, ano);
    
    totalVGV += vgvCorretor;
    totalContratos += contratosCorretor;
    totalLeads += leadsCorretor;
    totalAgendamentos += agendamentosCorretor;
    totalVisitas += visitasCorretor;
    
    corretoresData.push({
      id: corretor.id,
      nome: corretor.name || 'Sem nome',
      fotoUrl: corretor.fotoUrl,
      equipeId: corretor.equipeId,
      vgv: vgvCorretor,
      contratos: contratosCorretor,
      leads: leadsCorretor,
      agendamentos: agendamentosCorretor,
      visitas: visitasCorretor,
      metaVGV: metaIndividual?.metaVGV || 0,
      metaContratos: metaIndividual?.metaContratos || 0,
      metaLeads: metaIndividual?.metaLeads || 0,
    });
  }
  
  // Filtrar corretores sem nenhuma atividade no período (evita duplicados sem dados)
  const corretoresAtivos = corretoresData.filter(c => c.vgv > 0 || c.contratos > 0 || c.leads > 0);
  
  // Ordenar por VGV (maior primeiro)
  corretoresAtivos.sort((a, b) => b.vgv - a.vgv);
  
  // Calcular percentuais
  const metaVGVGlobal = Number(metaGlobal?.metaVGV || 0);
  const percentualAtingimento = metaVGVGlobal > 0 ? Math.round((totalVGV / metaVGVGlobal) * 10000) / 100 : 0;
  const gapMeta = metaVGVGlobal - totalVGV;
  
  return {
    metaGlobal,
    resumo: {
      totalVGV,
      totalContratos,
      totalLeads,
      totalAgendamentos,
      totalVisitas,
      metaVGV: metaVGVGlobal,
      percentualAtingimento,
      gapMeta,
      totalCorretores: corretoresAtivos.length,
    },
    corretores: corretoresAtivos,
  };
}

/**
 * Evolução mensal de VGV (últimos 12 meses)
 */
export async function getEvolucaoMensalVGV(anoReferencia: number, equipeId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const resultado = [];
  
  for (let mes = 1; mes <= 12; mes++) {
    const dataInicio = new Date(anoReferencia, mes - 1, 1);
    const dataFim = new Date(anoReferencia, mes, 0, 23, 59, 59, 999);
    
    // Buscar meta global do mês
    const metaGlobal = await db.select()
      .from(metasGlobais)
      .where(and(
        eq(metasGlobais.mes, mes),
        eq(metasGlobais.ano, anoReferencia)
      ))
      .limit(1);
    
    const metaVGV = Number(metaGlobal[0]?.metaVGV || 0);
    
    // VGV realizado
    let vgvQuery = db.select({
      total: sql<number>`COALESCE(SUM(${contratos.valorVenda}), 0)`
    }).from(contratos);
    
    if (equipeId) {
      // Buscar IDs dos corretores da equipe
      const corretoresEquipe = await db.select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, 'corretor'), eq(users.equipeId, equipeId)));
      const membroIds = corretoresEquipe.map(c => c.id);
      
      if (membroIds.length > 0) {
        vgvQuery = vgvQuery.where(and(
          inArray(contratos.corretorId, membroIds),
          gte(contratos.createdAt, dataInicio),
          lte(contratos.createdAt, dataFim)
        ));
      } else {
        resultado.push({
          mes,
          mesNome: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][mes - 1],
          vgvRealizado: 0,
          metaVGV,
          percentual: 0,
          diferenca: -metaVGV,
        });
        continue;
      }
    } else {
      vgvQuery = vgvQuery.where(and(
        gte(contratos.createdAt, dataInicio),
        lte(contratos.createdAt, dataFim)
      ));
    }
    
    const vgvResult = await vgvQuery;
    const vgvRealizado = Number(vgvResult[0]?.total || 0); // Manter em reais
    const percentual = metaVGV > 0 ? Math.round((vgvRealizado / metaVGV) * 10000) / 100 : 0;
    
    resultado.push({
      mes,
      mesNome: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][mes - 1],
      vgvRealizado,
      metaVGV,
      percentual,
      diferenca: vgvRealizado - metaVGV,
    });
  }
  
  return resultado;
}


// ============================================================================
// RELATÓRIO DE PERFORMANCE SEMANAL POR CORRETOR
// ============================================================================

export interface PerformanceSemanalCorretor {
  corretorId: number;
  corretorNome: string;
  corretorFoto: string | null;
  semanas: {
    semana: string; // "Sem 1", "Sem 2", etc.
    dataInicio: string; // ISO date
    dataFim: string; // ISO date
    leadsRecebidos: number;
    leadsContatados: number; // em_atendimento ou superior
    agendamentos: number;
    visitas: number;
    analisesCredito: number;
    contratosFechados: number;
    taxaConversao: number; // % leads que viraram contrato
    taxaContato: number; // % leads contatados
    taxaAgendamento: number; // % leads que tiveram agendamento
  }[];
}

export interface PerformanceSemanalResumo {
  semanas: string[];
  corretores: PerformanceSemanalCorretor[];
  totaisPorSemana: {
    semana: string;
    leadsRecebidos: number;
    leadsContatados: number;
    agendamentos: number;
    visitas: number;
    analisesCredito: number;
    contratosFechados: number;
    taxaConversao: number;
  }[];
}

export async function getPerformanceSemanal(
  numSemanas: number = 8,
  corretoresIds?: number[] | null
): Promise<PerformanceSemanalResumo> {
  const db = await getDb();
  if (!db) return { semanas: [], corretores: [], totaisPorSemana: [] };

  const { agora: agoraSP } = await import('./timezone');
  const hoje = agoraSP();

  // Calcular as datas de início e fim de cada semana (domingo a sábado)
  const semanas: { label: string; inicio: Date; fim: Date }[] = [];
  
  for (let i = numSemanas - 1; i >= 0; i--) {
    const dataRef = new Date(hoje);
    dataRef.setDate(dataRef.getDate() - (i * 7));
    
    // Encontrar o domingo dessa semana
    const diaSemana = dataRef.getDay(); // 0 = domingo
    const domingo = new Date(dataRef);
    domingo.setDate(dataRef.getDate() - diaSemana);
    domingo.setHours(0, 0, 0, 0);
    
    // Sábado dessa semana
    const sabado = new Date(domingo);
    sabado.setDate(domingo.getDate() + 6);
    sabado.setHours(23, 59, 59, 999);
    
    const labelDia = String(domingo.getDate()).padStart(2, '0');
    const labelMes = String(domingo.getMonth() + 1).padStart(2, '0');
    
    semanas.push({
      label: `${labelDia}/${labelMes}`,
      inicio: domingo,
      fim: sabado,
    });
  }

  // Deduplicate semanas (se a mesma semana aparece mais de uma vez)
  const semanasUnicas: typeof semanas = [];
  const semanasVistas = new Set<string>();
  for (const s of semanas) {
    const key = s.inicio.toISOString().split('T')[0];
    if (!semanasVistas.has(key)) {
      semanasVistas.add(key);
      semanasUnicas.push(s);
    }
  }

  // Buscar todos os corretores relevantes
  let corretoresQuery = db.select({
    id: users.id,
    nome: users.name,
    foto: users.fotoUrl,
  }).from(users);

  if (corretoresIds && corretoresIds.length > 0) {
    corretoresQuery = corretoresQuery.where(inArray(users.id, corretoresIds)) as any;
  } else {
    corretoresQuery = corretoresQuery.where(
      or(eq(users.role, 'corretor'), eq(users.role, 'gestor'), eq(users.role, 'admin'))
    ) as any;
  }

  const corretoresResult = await corretoresQuery;

  // Para cada corretor e cada semana, buscar métricas
  const corretoresPerformance: PerformanceSemanalCorretor[] = [];

  for (const corretor of corretoresResult) {
    const semanasData: PerformanceSemanalCorretor['semanas'] = [];

    for (const semana of semanasUnicas) {
      // Leads recebidos nessa semana
      const leadsRecebidosResult = await db.select({
        count: sql<number>`COUNT(*)`
      })
        .from(leads)
        .where(and(
          eq(leads.corretorId, corretor.id),
          gte(leads.createdAt, semana.inicio),
          lte(leads.createdAt, semana.fim)
        ));
      const leadsRecebidos = Number(leadsRecebidosResult[0]?.count || 0);

      // Leads contatados (status >= em_atendimento) - usando transições de status
      const leadsContatadosResult = await db.select({
        count: sql<number>`COUNT(DISTINCT ${leadStatusTransitions.leadId})`
      })
        .from(leadStatusTransitions)
        .where(and(
          eq(leadStatusTransitions.corretorId, corretor.id),
          inArray(leadStatusTransitions.statusNovo, ['em_atendimento', 'agendado', 'visita_realizada', 'analise_credito', 'contrato_fechado']),
          gte(leadStatusTransitions.createdAt, semana.inicio),
          lte(leadStatusTransitions.createdAt, semana.fim)
        ));
      const leadsContatados = Number(leadsContatadosResult[0]?.count || 0);

      // Agendamentos nessa semana (transições para status agendado)
      const agendamentosResult = await db.select({
        count: sql<number>`COUNT(DISTINCT ${leadStatusTransitions.leadId})`
      })
        .from(leadStatusTransitions)
        .where(and(
          eq(leadStatusTransitions.corretorId, corretor.id),
          eq(leadStatusTransitions.statusNovo, 'agendado'),
          gte(leadStatusTransitions.createdAt, semana.inicio),
          lte(leadStatusTransitions.createdAt, semana.fim)
        ));
      const agendamentosCount = Number(agendamentosResult[0]?.count || 0);

      // Visitas realizadas nessa semana
      const visitasResult = await db.select({
        count: sql<number>`COUNT(DISTINCT ${leadStatusTransitions.leadId})`
      })
        .from(leadStatusTransitions)
        .where(and(
          eq(leadStatusTransitions.corretorId, corretor.id),
          eq(leadStatusTransitions.statusNovo, 'visita_realizada'),
          gte(leadStatusTransitions.createdAt, semana.inicio),
          lte(leadStatusTransitions.createdAt, semana.fim)
        ));
      const visitasCount = Number(visitasResult[0]?.count || 0);

      // Análises de crédito nessa semana
      const analisesResult = await db.select({
        count: sql<number>`COUNT(DISTINCT ${leadStatusTransitions.leadId})`
      })
        .from(leadStatusTransitions)
        .where(and(
          eq(leadStatusTransitions.corretorId, corretor.id),
          eq(leadStatusTransitions.statusNovo, 'analise_credito'),
          gte(leadStatusTransitions.createdAt, semana.inicio),
          lte(leadStatusTransitions.createdAt, semana.fim)
        ));
      const analisesCount = Number(analisesResult[0]?.count || 0);

      // Contratos fechados nessa semana
      const contratosResult = await db.select({
        count: sql<number>`COUNT(*)`
      })
        .from(contratos)
        .where(and(
          eq(contratos.corretorId, corretor.id),
          gte(contratos.createdAt, semana.inicio),
          lte(contratos.createdAt, semana.fim)
        ));
      const contratosCount = Number(contratosResult[0]?.count || 0);

      semanasData.push({
        semana: semana.label,
        dataInicio: semana.inicio.toISOString(),
        dataFim: semana.fim.toISOString(),
        leadsRecebidos,
        leadsContatados,
        agendamentos: agendamentosCount,
        visitas: visitasCount,
        analisesCredito: analisesCount,
        contratosFechados: contratosCount,
        taxaConversao: leadsRecebidos > 0 ? Math.round((contratosCount / leadsRecebidos) * 10000) / 100 : 0,
        taxaContato: leadsRecebidos > 0 ? Math.round((leadsContatados / leadsRecebidos) * 10000) / 100 : 0,
        taxaAgendamento: leadsRecebidos > 0 ? Math.round((agendamentosCount / leadsRecebidos) * 10000) / 100 : 0,
      });
    }

    // Só incluir corretores que tiveram alguma atividade
    const temAtividade = semanasData.some(s => 
      s.leadsRecebidos > 0 || s.leadsContatados > 0 || s.agendamentos > 0 || 
      s.visitas > 0 || s.contratosFechados > 0
    );

    if (temAtividade) {
      corretoresPerformance.push({
        corretorId: corretor.id,
        corretorNome: corretor.nome || 'Sem nome',
        corretorFoto: corretor.foto || null,
        semanas: semanasData,
      });
    }
  }

  // Calcular totais por semana
  const totaisPorSemana = semanasUnicas.map((semana, idx) => {
    let totalLeads = 0, totalContatados = 0, totalAgendamentos = 0;
    let totalVisitas = 0, totalAnalises = 0, totalContratos = 0;

    for (const corretor of corretoresPerformance) {
      const s = corretor.semanas[idx];
      if (s) {
        totalLeads += s.leadsRecebidos;
        totalContatados += s.leadsContatados;
        totalAgendamentos += s.agendamentos;
        totalVisitas += s.visitas;
        totalAnalises += s.analisesCredito;
        totalContratos += s.contratosFechados;
      }
    }

    return {
      semana: semana.label,
      leadsRecebidos: totalLeads,
      leadsContatados: totalContatados,
      agendamentos: totalAgendamentos,
      visitas: totalVisitas,
      analisesCredito: totalAnalises,
      contratosFechados: totalContratos,
      taxaConversao: totalLeads > 0 ? Math.round((totalContratos / totalLeads) * 10000) / 100 : 0,
    };
  });

  return {
    semanas: semanasUnicas.map(s => s.label),
    corretores: corretoresPerformance,
    totaisPorSemana,
  };
}

/**
 * Buscar todos os corretores E gestores (para transferência de leads)
 * Inclui gestores na lista para permitir que leads sejam transferidos para eles
 */
export async function getAllCorretoresEGestores() {
  const db = await getDb();
  if (!db) return [];
  
  const resultado = await db.select().from(users)
    .where(or(eq(users.role, "corretor"), eq(users.role, "gestor")));
  
  return resultado.map(c => ({
    ...c,
    nome: c.name
  }));
}

/**
 * Buscar corretores E gestores por IDs (para transferência de leads com filtro de equipe)
 * Inclui gestores na lista para permitir que leads sejam transferidos para eles
 */
export async function getCorretoresEGestoresByIds(ids: number[]) {
  const db = await getDb();
  if (!db) return [];
  if (ids.length === 0) return [];
  
  const resultado = await db.select().from(users)
    .where(and(
      or(eq(users.role, "corretor"), eq(users.role, "gestor")),
      inArray(users.id, ids)
    ));
  
  return resultado.map(c => ({
    ...c,
    nome: c.name
  }));
}

/**
 * Distribuir todos os leads sem corretor pela roleta
 * Retorna o número de leads distribuídos
 */
export async function distribuirLeadsSemCorretor(): Promise<{ distribuidos: number; erros: number; semCorretorDisponivel: number }> {
  const db = await getDb();
  if (!db) return { distribuidos: 0, erros: 0, semCorretorDisponivel: 0 };
  
  // Buscar todos os leads sem corretor
  const leadsSemCorretor = await db.select()
    .from(leads)
    .where(isNull(leads.corretorId))
    .orderBy(leads.createdAt);
  
  console.log(`[Distribuição] Encontrados ${leadsSemCorretor.length} leads sem corretor`);
  
  let distribuidos = 0;
  let erros = 0;
  let semCorretorDisponivel = 0;
  
  for (const lead of leadsSemCorretor) {
    try {
      const corretorId = await distribuirLeadPelaRoleta(lead.id);
      
      if (corretorId) {
        distribuidos++;
      } else {
        semCorretorDisponivel++;
      }
    } catch (error) {
      console.error(`[Distribuição] Erro ao distribuir lead ${lead.id}:`, error);
      erros++;
    }
  }
  
  console.log(`[Distribuição] Resultado: ${distribuidos} distribuídos, ${semCorretorDisponivel} sem corretor disponível, ${erros} erros`);
  
  return { distribuidos, erros, semCorretorDisponivel };
}


// ============================================================================
// TABELAS DE CONTRATOS PARA DASHBOARD DO GESTOR
// ============================================================================

/**
 * Lista detalhada de contratos fechados com dados de corretor, cliente, projeto, VGV e data
 */
export async function getContratosFechados(filtros?: DashboardFilters) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: any[] = [];
  
  if (filtros?.dataInicio) {
    conditions.push(gte(contratos.createdAt, filtros.dataInicio));
  }
  if (filtros?.dataFim) {
    conditions.push(lte(contratos.createdAt, filtros.dataFim));
  }
  if (filtros?.corretoresIds && filtros.corretoresIds.length > 0) {
    conditions.push(inArray(contratos.corretorId, filtros.corretoresIds));
  }
  
  const result = await db.select({
    id: contratos.id,
    corretorId: contratos.corretorId,
    corretorNome: users.name,
    corretorFoto: users.fotoUrl,
    clienteNome: leads.nome,
    clienteTelefone: leads.telefone,
    clienteEmail: leads.email,
    projectId: leads.projectId,
    projetoCustom: leads.projetoCustom,
    valorVenda: contratos.valorVenda,
    dataVenda: contratos.createdAt,
    observacoes: contratos.observacoes,
    anexos: contratos.anexos,
  })
    .from(contratos)
    .innerJoin(users, eq(contratos.corretorId, users.id))
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(contratos.createdAt));
  
  // Buscar nomes dos projetos
  const projectIds = [...new Set(result.filter(r => r.projectId).map(r => r.projectId!))];
  let projectsMap = new Map<number, string>();
  
  if (projectIds.length > 0) {
    const projectsData = await db.select({
      id: projects.id,
      nome: projects.nome,
    })
      .from(projects)
      .where(inArray(projects.id, projectIds));
    
    projectsMap = new Map(projectsData.map(p => [p.id, p.nome]));
  }
  
  return result.map(r => ({
    id: r.id,
    corretor: r.corretorNome || 'Sem nome',
    corretorFoto: r.corretorFoto,
    cliente: r.clienteNome || 'Sem nome',
    clienteTelefone: r.clienteTelefone || '',
    clienteEmail: r.clienteEmail || '',
    projeto: r.projectId ? (projectsMap.get(r.projectId) || 'Projeto removido') : (r.projetoCustom || 'Não informado'),
    vgv: Number(r.valorVenda || 0),
    dataVenda: r.dataVenda,
    anexos: r.anexos || [],
  }));
}

/**
 * VGV agrupado por equipe e projeto
 */
export async function getVGVPorEquipeProjeto(filtros?: DashboardFilters) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: any[] = [];
  
  if (filtros?.dataInicio) {
    conditions.push(gte(contratos.createdAt, filtros.dataInicio));
  }
  if (filtros?.dataFim) {
    conditions.push(lte(contratos.createdAt, filtros.dataFim));
  }
  if (filtros?.corretoresIds && filtros.corretoresIds.length > 0) {
    conditions.push(inArray(contratos.corretorId, filtros.corretoresIds));
  }
  
  // Buscar todos os contratos com dados do corretor (para pegar equipeId)
  const result = await db.select({
    contratoId: contratos.id,
    corretorId: contratos.corretorId,
    equipeId: users.equipeId,
    leadId: contratos.leadId,
    valorVenda: contratos.valorVenda,
    projectId: leads.projectId,
    projetoCustom: leads.projetoCustom,
  })
    .from(contratos)
    .innerJoin(users, eq(contratos.corretorId, users.id))
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  
  // Buscar nomes das equipes
  const equipeIds = [...new Set(result.filter(r => r.equipeId).map(r => r.equipeId!))];
  let equipesMap = new Map<number, string>();
  
  if (equipeIds.length > 0) {
    const equipesData = await db.select({
      id: equipes.id,
      nome: equipes.nome,
    })
      .from(equipes)
      .where(inArray(equipes.id, equipeIds));
    
    equipesMap = new Map(equipesData.map(e => [e.id, e.nome]));
  }
  
  // Buscar nomes dos projetos
  const projectIds = [...new Set(result.filter(r => r.projectId).map(r => r.projectId!))];
  let projectsMap = new Map<number, string>();
  
  if (projectIds.length > 0) {
    const projectsData = await db.select({
      id: projects.id,
      nome: projects.nome,
    })
      .from(projects)
      .where(inArray(projects.id, projectIds));
    
    projectsMap = new Map(projectsData.map(p => [p.id, p.nome]));
  }
  
  // Agrupar apenas por equipe (uma linha por equipe)
  const agrupado = new Map<string, { equipe: string; vgv: number; contratos: number }>();
  
  for (const r of result) {
    const equipeNome = r.equipeId ? (equipesMap.get(r.equipeId) || 'Equipe removida') : 'Sem equipe';
    
    const existing = agrupado.get(equipeNome);
    if (existing) {
      existing.vgv += Number(r.valorVenda || 0);
      existing.contratos += 1;
    } else {
      agrupado.set(equipeNome, {
        equipe: equipeNome,
        vgv: Number(r.valorVenda || 0),
        contratos: 1,
      });
    }
  }
  
  // Converter para array e ordenar por VGV
  return Array.from(agrupado.values()).sort((a, b) => b.vgv - a.vgv);
}


/**
 * Atualizar um contrato fechado (admin only)
 * Atualiza dados do contrato, do lead associado e do corretor vinculado
 */
export async function atualizarContrato(contratoId: number, dados: {
  corretorId?: number;
  clienteNome?: string;
  clienteTelefone?: string;
  clienteEmail?: string;
  projectId?: number | null;
  projetoCustom?: string | null;
  valorVenda?: number;
  dataVenda?: Date;
  equipeCorretorId?: number | null;
  anexos?: string[];
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Buscar contrato atual para obter leadId
  const [contratoAtual] = await db.select({
    id: contratos.id,
    leadId: contratos.leadId,
    corretorId: contratos.corretorId,
  })
    .from(contratos)
    .where(eq(contratos.id, contratoId))
    .limit(1);

  if (!contratoAtual) throw new Error('Contrato não encontrado');

  // Atualizar contrato
  const contratoUpdate: Record<string, any> = {};
  if (dados.corretorId !== undefined) contratoUpdate.corretorId = dados.corretorId;
  if (dados.valorVenda !== undefined) contratoUpdate.valorVenda = String(dados.valorVenda);
  if (dados.dataVenda !== undefined) contratoUpdate.createdAt = dados.dataVenda;
  if (dados.anexos !== undefined) contratoUpdate.anexos = JSON.stringify(dados.anexos);

  if (Object.keys(contratoUpdate).length > 0) {
    await db.update(contratos)
      .set(contratoUpdate)
      .where(eq(contratos.id, contratoId));
  }

  // Atualizar lead associado (cliente, projeto)
  const leadUpdate: Record<string, any> = {};
  if (dados.clienteNome !== undefined) leadUpdate.nome = dados.clienteNome;
  if (dados.clienteTelefone !== undefined) leadUpdate.telefone = dados.clienteTelefone;
  if (dados.clienteEmail !== undefined) leadUpdate.email = dados.clienteEmail;
  if (dados.projectId !== undefined) {
    leadUpdate.projectId = dados.projectId;
    if (dados.projectId !== null) {
      leadUpdate.projetoCustom = null; // Limpar projeto custom se selecionou um projeto real
    }
  }
  if (dados.projetoCustom !== undefined) {
    leadUpdate.projetoCustom = dados.projetoCustom;
    if (dados.projetoCustom !== null) {
      leadUpdate.projectId = null; // Limpar projectId se digitou projeto custom
    }
  }
  if (dados.corretorId !== undefined) leadUpdate.corretorId = dados.corretorId;

  if (Object.keys(leadUpdate).length > 0) {
    await db.update(leads)
      .set(leadUpdate)
      .where(eq(leads.id, contratoAtual.leadId));
  }

  // Atualizar equipe do corretor se necessário
  if (dados.equipeCorretorId !== undefined && dados.corretorId) {
    await db.update(users)
      .set({ equipeId: dados.equipeCorretorId })
      .where(eq(users.id, dados.corretorId));
  }

  return { success: true };
}

/**
 * Obter detalhes completos de um contrato para edição
 */
export async function getContratoParaEdicao(contratoId: number) {
  const db = await getDb();
  if (!db) return null;

  const [result] = await db.select({
    id: contratos.id,
    leadId: contratos.leadId,
    corretorId: contratos.corretorId,
    corretorNome: users.name,
    corretorEquipeId: users.equipeId,
    clienteNome: leads.nome,
    clienteTelefone: leads.telefone,
    clienteEmail: leads.email,
    projectId: leads.projectId,
    projetoCustom: leads.projetoCustom,
    valorVenda: contratos.valorVenda,
    dataVenda: contratos.createdAt,
    observacoes: contratos.observacoes,
    anexos: contratos.anexos,
  })
    .from(contratos)
    .innerJoin(users, eq(contratos.corretorId, users.id))
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(eq(contratos.id, contratoId))
    .limit(1);

  if (!result) return null;

  return {
    id: result.id,
    leadId: result.leadId,
    corretorId: result.corretorId,
    corretorNome: result.corretorNome || '',
    corretorEquipeId: result.corretorEquipeId,
    clienteNome: result.clienteNome || '',
    clienteTelefone: result.clienteTelefone || '',
    clienteEmail: result.clienteEmail || '',
    projectId: result.projectId,
    projetoCustom: result.projetoCustom || '',
    valorVenda: Number(result.valorVenda || 0),
    dataVenda: result.dataVenda,
    observacoes: result.observacoes || '',
    anexos: result.anexos ? JSON.parse(result.anexos) : [],
  };
}

/**
 * Listar opções para selects de edição de contrato
 */
export async function getOpcoesContrato() {
  const db = await getDb();
  if (!db) return { corretores: [], projetos: [], equipes: [] };

  const [corretoresData, projetosData, equipesData] = await Promise.all([
    db.select({
      id: users.id,
      nome: users.name,
      equipeId: users.equipeId,
    })
      .from(users)
      .where(inArray(users.role, ['corretor', 'gestor', 'admin']))
      .orderBy(users.name),
    db.select({
      id: projects.id,
      nome: projects.nome,
    })
      .from(projects)
      .where(eq(projects.status, 'ativo'))
      .orderBy(projects.nome),
    db.select({
      id: equipes.id,
      nome: equipes.nome,
    })
      .from(equipes)
      .where(eq(equipes.ativa, true))
      .orderBy(equipes.nome),
  ]);

  return {
    corretores: corretoresData.map(c => ({ id: c.id, nome: c.nome || 'Sem nome', equipeId: c.equipeId })),
    projetos: projetosData.map(p => ({ id: p.id, nome: p.nome })),
    equipes: equipesData.map(e => ({ id: e.id, nome: e.nome })),
  };
}

/**
 * Criar novo contrato
 */
export async function criarNovoContrato(dados: {
  corretorId: number;
  clienteNome: string;
  clienteTelefone: string;
  clienteEmail: string;
  projectId: number | null;
  projetoCustom: string;
  valorVenda: number;
  dataVenda: Date;
  observacoes?: string;
  anexos?: string[];
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // 1. Criar ou encontrar o lead
  let leadId: number;
  
  // Verificar se já existe um lead com esse telefone ou email
  const leadExistente = await db.select()
    .from(leads)
    .where(
      or(
        eq(leads.telefone, dados.clienteTelefone),
        eq(leads.email, dados.clienteEmail)
      )
    )
    .limit(1);

  if (leadExistente.length > 0) {
    leadId = leadExistente[0].id;
    
    // Atualizar o lead existente
    await db.update(leads)
      .set({
        nome: dados.clienteNome,
        telefone: dados.clienteTelefone,
        email: dados.clienteEmail,
        corretorId: dados.corretorId,
        projectId: dados.projectId,
        projetoCustom: dados.projetoCustom,
        status: 'contrato_fechado',
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId));
  } else {
    // Criar novo lead
    const [novoLead] = await db.insert(leads)
      .values({
        nome: dados.clienteNome,
        telefone: dados.clienteTelefone,
        email: dados.clienteEmail,
        corretorId: dados.corretorId,
        projectId: dados.projectId,
        projetoCustom: dados.projetoCustom,
        status: 'contrato_fechado',
        origem: 'captacao_corretor',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .$returningId();
    
    leadId = novoLead.id;
  }

  // 2. Criar o contrato
  const [novoContrato] = await db.insert(contratos)
    .values({
      leadId,
      corretorId: dados.corretorId,
      valorVenda: dados.valorVenda.toString(),
      observacoes: dados.observacoes || '',
      anexos: dados.anexos || [],
      createdAt: dados.dataVenda,
    })
    .$returningId();

  return { contratoId: novoContrato.id, leadId };
}
