import { eq, and, desc, sql, gte, lte, inArray, notInArray, gt } from "drizzle-orm";
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
  webhookConfig, InsertWebhookConfig, WebhookConfig,
  tarefas, InsertTarefa, Tarefa,
  followUps, InsertFollowUp, FollowUp,
  atividadesDiarias, InsertAtividadeDiaria, AtividadeDiaria,
  metasDiarias, InsertMetaDiaria, MetaDiaria,
  configuracaoPontuacao, InsertConfiguracaoPontuacao, ConfiguracaoPontuacao,
  alertasProdutividade, InsertAlertaProdutividade, AlertaProdutividade,
  tiposConquista, TipoConquista, InsertTipoConquista,
  conquistas, Conquista, InsertConquista
} from "../drizzle/schema";
import { ENV } from './_core/env';

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
      values.role = 'gestor';
      updateSet.role = 'gestor';
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
  
  return await db.select().from(users).where(eq(users.role, "corretor"));
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
  
  return await db.select().from(projects).orderBy(desc(projects.createdAt));
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

export async function createLead(lead: InsertLead) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(leads).values(lead);
  const insertId = Number(result[0].insertId);
  
  // Retornar o lead criado
  const createdLead = await getLeadById(insertId);
  if (!createdLead) throw new Error("Failed to retrieve created lead");
  
  return createdLead;
}

export async function getAllLeads() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(leads).orderBy(desc(leads.createdAt));
}

export async function getLeadsByCorretor(corretorId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(leads)
    .where(eq(leads.corretorId, corretorId))
    .orderBy(desc(leads.createdAt));
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
    }
  }
  
  await db.update(leads)
    .set({ ...data, updatedAt: new Date() })
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
  return result;
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

interface FiltrosLeadsPorCorretor {
  corretorId?: number;
  status?: string;
  projectId?: number;
  dataInicio?: string;
  dataFim?: string;
}

export async function getLeadsPorCorretorComFiltros(filtros?: FiltrosLeadsPorCorretor) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: any[] = [];
  
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
    .limit(100);
  
  return result;
}

// ============================================================================
// ESTATÍSTICAS POR CORRETOR (PARA GESTOR)
// ============================================================================

export async function getEstatisticasPorCorretor() {
  const db = await getDb();
  if (!db) return [];
  
  // Buscar todos os corretores
  const corretores = await db.select()
    .from(users)
    .where(eq(users.role, 'corretor'));
  
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
}

export async function getDashboardMetrics(filtros?: DashboardFilters) {
  const db = await getDb();
  if (!db) return null;
  
  const conditions: any[] = [];
  
  if (filtros?.dataInicio) {
    conditions.push(gte(leads.createdAt, filtros.dataInicio));
  }
  
  if (filtros?.dataFim) {
    conditions.push(lte(leads.createdAt, filtros.dataFim));
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
    db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(conditions.length > 0 ? and(...conditions, eq(leads.status, 'agendado')) : eq(leads.status, 'agendado')),
    db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(conditions.length > 0 ? and(...conditions, eq(leads.status, 'visita_realizada')) : eq(leads.status, 'visita_realizada')),
    db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(conditions.length > 0 ? and(...conditions, eq(leads.status, 'analise_credito')) : eq(leads.status, 'analise_credito')),
    db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(conditions.length > 0 ? and(...conditions, eq(leads.status, 'contrato_fechado')) : eq(leads.status, 'contrato_fechado')),
    db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(conditions.length > 0 ? and(...conditions, eq(leads.status, 'perdido')) : eq(leads.status, 'perdido')),
  ]);
  
  // VGV - soma dos valores dos projetos dos leads com contrato fechado
  // Por enquanto, vamos calcular baseado no valorMinimo dos projetos
  const vgvResult = await db.select({ 
    total: sql<number>`COALESCE(SUM(${projects.valorMinimo}), 0)` 
  })
    .from(leads)
    .leftJoin(projects, eq(leads.projectId, projects.id))
    .where(conditions.length > 0 
      ? and(...conditions, eq(leads.status, 'contrato_fechado')) 
      : eq(leads.status, 'contrato_fechado'));
  
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
  
  const corretores = await db.select()
    .from(users)
    .where(eq(users.role, 'corretor'));
  
  const result = await Promise.all(corretores.map(async (corretor) => {
    const conditions: any[] = [eq(leads.corretorId, corretor.id)];
    
    if (filtros?.dataInicio) {
      conditions.push(gte(leads.createdAt, filtros.dataInicio));
    }
    
    if (filtros?.dataFim) {
      conditions.push(lte(leads.createdAt, filtros.dataFim));
    }
    
    const totalLeads = await db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(...conditions));
    
    return {
      id: corretor.id,
      nome: corretor.name || 'Sem nome',
      status: corretor.status,
      totalLeads: Number(totalLeads[0]?.count || 0),
    };
  }));
  
  return result.filter(c => c.status === 'presente').sort((a, b) => b.totalLeads - a.totalLeads);
}

export async function getAgendamentosPorCorretor(filtros?: DashboardFilters) {
  const db = await getDb();
  if (!db) return [];
  
  const corretores = await db.select()
    .from(users)
    .where(eq(users.role, 'corretor'));
  
  const result = await Promise.all(corretores.map(async (corretor) => {
    const conditions: any[] = [
      eq(leads.corretorId, corretor.id),
      eq(leads.status, 'agendado')
    ];
    
    if (filtros?.dataInicio) {
      conditions.push(gte(leads.createdAt, filtros.dataInicio));
    }
    
    if (filtros?.dataFim) {
      conditions.push(lte(leads.createdAt, filtros.dataFim));
    }
    
    const agendados = await db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(...conditions));
    
    return {
      id: corretor.id,
      nome: corretor.name || 'Sem nome',
      status: corretor.status,
      agendados: Number(agendados[0]?.count || 0),
    };
  }));
  
  return result.filter(c => c.status === 'presente').sort((a, b) => b.agendados - a.agendados);
}

export async function getVisitasPorCorretor(filtros?: DashboardFilters) {
  const db = await getDb();
  if (!db) return [];
  
  const corretores = await db.select()
    .from(users)
    .where(eq(users.role, 'corretor'));
  
  const result = await Promise.all(corretores.map(async (corretor) => {
    const conditions: any[] = [
      eq(leads.corretorId, corretor.id),
      eq(leads.status, 'visita_realizada')
    ];
    
    if (filtros?.dataInicio) {
      conditions.push(gte(leads.createdAt, filtros.dataInicio));
    }
    
    if (filtros?.dataFim) {
      conditions.push(lte(leads.createdAt, filtros.dataFim));
    }
    
    const visitas = await db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(...conditions));
    
    return {
      id: corretor.id,
      nome: corretor.name || 'Sem nome',
      status: corretor.status,
      visitas: Number(visitas[0]?.count || 0),
    };
  }));
  
  return result.filter(c => c.status === 'presente').sort((a, b) => b.visitas - a.visitas);
}

export async function getVendasPorCorretor(filtros?: DashboardFilters) {
  const db = await getDb();
  if (!db) return [];
  
  const corretores = await db.select()
    .from(users)
    .where(eq(users.role, 'corretor'));
  
  const result = await Promise.all(corretores.map(async (corretor) => {
    const conditions: any[] = [
      eq(leads.corretorId, corretor.id),
      eq(leads.status, 'contrato_fechado')
    ];
    
    if (filtros?.dataInicio) {
      conditions.push(gte(leads.createdAt, filtros.dataInicio));
    }
    
    if (filtros?.dataFim) {
      conditions.push(lte(leads.createdAt, filtros.dataFim));
    }
    
    // Quantidade de contratos fechados
    const vendas = await db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(...conditions));
    
    // VGV do corretor (soma dos valores dos projetos)
    const vgvResult = await db.select({ 
      total: sql<number>`COALESCE(SUM(${projects.valorMinimo}), 0)` 
    })
      .from(leads)
      .leftJoin(projects, eq(leads.projectId, projects.id))
      .where(and(...conditions));
    
    return {
      id: corretor.id,
      nome: corretor.name || 'Sem nome',
      status: corretor.status,
      vendas: Number(vendas[0]?.count || 0),
      vgv: Number(vgvResult[0]?.total || 0),
    };
  }));
  
  return result.filter(c => c.status === 'presente').sort((a, b) => b.vgv - a.vgv);
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

export async function getMetricasHistoricas(dias: number = 30): Promise<MetricasDiarias[]> {
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
    
    // Buscar leads criados nesse dia
    const leadsNoDia = await db.select({
      status: leads.status,
      count: sql<number>`count(*)`
    })
      .from(leads)
      .where(and(
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

export async function getEvolucaoFunil(dias: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const hoje = new Date();
  const dataInicio = new Date(hoje);
  dataInicio.setDate(dataInicio.getDate() - dias);
  dataInicio.setHours(0, 0, 0, 0);
  
  // Buscar totais acumulados por status
  const totais = await db.select({
    status: leads.status,
    count: sql<number>`count(*)`
  })
    .from(leads)
    .where(gte(leads.createdAt, dataInicio))
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
      leads: meta.metaLeads > 0 ? Math.round((totalLeads / meta.metaLeads) * 100) : 0,
      agendamentos: meta.metaAgendamentos > 0 ? Math.round((agendamentos / meta.metaAgendamentos) * 100) : 0,
      visitas: meta.metaVisitas > 0 ? Math.round((visitas / meta.metaVisitas) * 100) : 0,
      contratos: meta.metaContratos > 0 ? Math.round((contratos / meta.metaContratos) * 100) : 0,
      vgv: meta.metaVGV > 0 ? Math.round((vgvRealizado / meta.metaVGV) * 100) : 0,
    },
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

export async function getRankingCorretores(mes?: number, ano?: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Se não especificado, usa o mês/ano atual
  const dataAtual = new Date();
  const mesAtual = mes || dataAtual.getMonth() + 1;
  const anoAtual = ano || dataAtual.getFullYear();
  
  // Período do mês
  const dataInicio = new Date(anoAtual, mesAtual - 1, 1);
  const dataFim = new Date(anoAtual, mesAtual, 0, 23, 59, 59, 999);
  
  // Buscar todos os corretores
  const corretores = await db.select()
    .from(users)
    .where(eq(users.role, 'corretor'));
  
  const ranking = [];
  
  for (const corretor of corretores) {
    // Buscar métricas do corretor no período
    const leadsDoMes = await db.select({
      status: leads.status,
      count: sql<number>`count(*)`
    })
      .from(leads)
      .where(and(
        eq(leads.corretorId, corretor.id),
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
    
    // Calcular VGV
    const vgvResult = await db.select({
      total: sql<number>`COALESCE(SUM(${projects.valorMinimo}), 0)`
    })
      .from(leads)
      .leftJoin(projects, eq(leads.projectId, projects.id))
      .where(and(
        eq(leads.corretorId, corretor.id),
        eq(leads.status, 'contrato_fechado'),
        gte(leads.createdAt, dataInicio),
        lte(leads.createdAt, dataFim)
      ));
    
    const vgv = Number(vgvResult[0]?.total || 0);
    
    // Calcular pontuação (peso maior para contratos e VGV)
    const pontuacao = (totalLeads * 1) + (agendamentos * 5) + (visitas * 10) + (contratos * 50) + (vgv / 10000);
    
    ranking.push({
      corretor: {
        id: corretor.id,
        nome: corretor.name || 'Sem nome',
        email: corretor.email,
        fotoUrl: corretor.fotoUrl,
        status: corretor.status,
      },
      metricas: {
        totalLeads,
        agendamentos,
        visitas,
        contratos,
        vgv,
      },
      pontuacao: Math.round(pontuacao),
    });
  }
  
  // Ordenar por pontuação (maior primeiro)
  ranking.sort((a, b) => b.pontuacao - a.pontuacao);
  
  // Adicionar posição
  return ranking.map((item, index) => ({
    ...item,
    posicao: index + 1,
  }));
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
    .leftJoin(users, eq(filaDistribuicao.corretorId, users.id))
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
  
  // Buscar fila ordenada por posição
  const fila = await db.select({
    corretorId: filaDistribuicao.corretorId,
    posicao: filaDistribuicao.posicao,
    ativo: filaDistribuicao.ativo,
    maxLeadsDia: filaDistribuicao.maxLeadsDia,
    leadsRecebidosHoje: filaDistribuicao.leadsRecebidosHoje,
    corretorStatus: users.status,
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
    
    // Verificar se não atingiu o limite diário
    if (item.leadsRecebidosHoje >= item.maxLeadsDia) continue;
    
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
  
  // Buscar próximo corretor disponível
  const corretorId = await getProximoCorretorFila();
  
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
  const lead = await getLeadById(leadId);
  if (lead) {
    await notifyLeadDistribuido(corretorId, leadId, lead.nome);
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

/**
 * Processa um lead recebido via webhook
 * Cria o lead e distribui automaticamente pela roleta
 */
export async function processarLeadWebhook(webhookToken: string, dadosLead: {
  nome: string;
  email?: string;
  telefone: string;
  origem?: string;
  // Campos do Facebook Lead Ads
  campanha?: string;
  faixaRenda?: string;
  prefereContatoPor?: string;
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
  
  // Criar o lead com os novos campos
  const lead = await createLead({
    nome: dadosLead.nome,
    email: dadosLead.email,
    telefone: dadosLead.telefone,
    origem: dadosLead.origem || webhook.fonte,
    projectId: webhook.projectIdPadrao || undefined,
    status: 'novo',
    // Campos do Facebook Lead Ads
    campanha: dadosLead.campanha,
    faixaRenda: dadosLead.faixaRenda,
    prefereContatoPor: dadosLead.prefereContatoPor,
    dataHoraCriacao: dataHoraCriacao,
  });
  
  // Incrementar contador do webhook
  await incrementarLeadsWebhook(webhook.id);
  
  // Distribuir pela roleta
  const corretorId = await distribuirLeadPelaRoleta(lead.id);
  
  return {
    lead,
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
    tentativaAtual: followUps.tentativaAtual,
    maxTentativas: followUps.maxTentativas,
    proximaTentativa: followUps.proximaTentativa,
    ultimaTentativa: followUps.ultimaTentativa,
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
      eq(followUps.status, "ativo"),
      lte(followUps.proximaTentativa, agora)
    ))
    .orderBy(followUps.proximaTentativa);
}

export async function getFollowUpsDoDia(corretorId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  
  return await db.select({
    id: followUps.id,
    leadId: followUps.leadId,
    tentativaAtual: followUps.tentativaAtual,
    maxTentativas: followUps.maxTentativas,
    proximaTentativa: followUps.proximaTentativa,
    ultimaTentativa: followUps.ultimaTentativa,
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
      eq(followUps.status, "ativo"),
      gte(followUps.proximaTentativa, hoje),
      lte(followUps.proximaTentativa, amanha)
    ))
    .orderBy(followUps.proximaTentativa);
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
  
  // Parsear histórico existente
  let historico: any[] = [];
  try {
    historico = atual.historicoTentativas ? JSON.parse(atual.historicoTentativas) : [];
  } catch (e) {
    historico = [];
  }
  
  // Adicionar nova tentativa ao histórico
  historico.push({
    data: agora.toISOString(),
    tentativa: atual.tentativaAtual,
    resultado,
    observacao
  });
  
  if (resultado === "respondeu") {
    // Cliente respondeu - resetar contador e marcar como respondido
    await db.update(followUps)
      .set({
        status: "respondido",
        ultimaTentativa: agora,
        historicoTentativas: JSON.stringify(historico),
        updatedAt: agora
      })
      .where(eq(followUps.id, followUpId));
    
    return { status: "respondido", mensagem: "Follow-up concluído - cliente respondeu" };
  }
  
  if (atual.tentativaAtual >= atual.maxTentativas) {
    // Atingiu máximo de tentativas - encerrar follow-up atual
    await db.update(followUps)
      .set({
        status: "encerrado",
        ultimaTentativa: agora,
        historicoTentativas: JSON.stringify(historico),
        updatedAt: agora
      })
      .where(eq(followUps.id, followUpId));
    
    // Buscar o lead para ver quais corretores já tentaram
    const leadData = await db.select().from(leads).where(eq(leads.id, atual.leadId)).limit(1);
    if (!leadData[0]) throw new Error("Lead não encontrado");
    
    // Se o lead for de captação própria do corretor, NÃO transferir - apenas encerrar
    if (leadData[0].origem === "captacao_corretor") {
      // Registrar interação no histórico
      await db.insert(leadHistory).values({
        leadId: atual.leadId,
        corretorId: atual.corretorId,
        tipo: "outro",
        resultado: "outro",
        observacoes: `Follow-up encerrado após 5 tentativas sem resposta (lead de captação própria - não transferível)`,
        statusAnterior: leadData[0].status,
        statusNovo: leadData[0].status
      });
      
      return { 
        status: "encerrado", 
        mensagem: "Follow-up encerrado após 5 tentativas. Lead de captação própria não é transferido." 
      };
    }
    
    // Parsear lista de corretores que já tentaram
    let corretoresQueTentaram: number[] = [];
    try {
      corretoresQueTentaram = leadData[0].corretoresQueTentaram 
        ? JSON.parse(leadData[0].corretoresQueTentaram) 
        : [];
    } catch (e) {
      corretoresQueTentaram = [];
    }
    
    // Adicionar corretor atual à lista se ainda não estiver
    if (!corretoresQueTentaram.includes(atual.corretorId)) {
      corretoresQueTentaram.push(atual.corretorId);
    }
    
    // Buscar corretores disponíveis que ainda não tentaram este lead
    const todosCorretores = await db.select({ id: users.id })
      .from(users)
      .where(and(
        eq(users.role, "corretor"),
        eq(users.status, "presente")
      ));
    
    const corretoresDisponiveis = todosCorretores.filter(
      c => !corretoresQueTentaram.includes(c.id)
    );
    
    if (corretoresDisponiveis.length > 0) {
      // Transferir para outro corretor
      const novoCorretor = corretoresDisponiveis[0];
      
      // Atualizar lead com novo corretor e lista de quem já tentou
      await db.update(leads)
        .set({
          corretorId: novoCorretor.id,
          corretorAnteriorId: atual.corretorId,
          corretoresQueTentaram: JSON.stringify(corretoresQueTentaram),
          status: "aguardando_atendimento",
          updatedAt: agora
        })
        .where(eq(leads.id, atual.leadId));
      
      // Criar novo follow-up para o novo corretor
      const proximaTentativa = new Date(agora);
      proximaTentativa.setDate(proximaTentativa.getDate() + 1);
      proximaTentativa.setHours(9, 0, 0, 0);
      
      await db.insert(followUps).values({
        leadId: atual.leadId,
        corretorId: novoCorretor.id,
        tentativaAtual: 1,
        maxTentativas: 5,
        proximaTentativa,
        status: "ativo",
        historicoTentativas: "[]"
      });
      
      // Registrar interação no histórico
      await db.insert(leadHistory).values({
        leadId: atual.leadId,
        corretorId: atual.corretorId,
        tipo: "outro",
        resultado: "outro",
        observacoes: `Lead transferido para outro corretor após 5 tentativas sem resposta`,
        statusAnterior: leadData[0].status,
        statusNovo: "aguardando_atendimento"
      });
      
      return { 
        status: "transferido", 
        mensagem: "Lead transferido para outro corretor após 5 tentativas sem resposta" 
      };
    } else {
      // Todos os corretores já tentaram - mover para lixeira
      await db.update(leads)
        .set({
          naLixeira: true,
          dataMovidoLixeira: agora,
          corretoresQueTentaram: JSON.stringify(corretoresQueTentaram),
          motivoPerdido: "Sem resposta após todos os corretores tentarem 5x",
          updatedAt: agora
        })
        .where(eq(leads.id, atual.leadId));
      
      // Registrar interação no histórico
      await db.insert(leadHistory).values({
        leadId: atual.leadId,
        corretorId: atual.corretorId,
        tipo: "outro",
        resultado: "outro",
        observacoes: `Lead movido para lixeira - todos os corretores completaram 5 tentativas sem resposta`,
        statusAnterior: leadData[0].status,
        statusNovo: "perdido"
      });
      
      return { 
        status: "lixeira", 
        mensagem: "Lead movido para lixeira - todos os corretores já tentaram 5x sem resposta" 
      };
    }
  }
  
  // Agendar próxima tentativa para amanhã
  const proximaTentativa = new Date(agora);
  proximaTentativa.setDate(proximaTentativa.getDate() + 1);
  proximaTentativa.setHours(9, 0, 0, 0); // Agendar para 9h do próximo dia
  
  await db.update(followUps)
    .set({
      tentativaAtual: atual.tentativaAtual + 1,
      proximaTentativa,
      ultimaTentativa: agora,
      historicoTentativas: JSON.stringify(historico),
      updatedAt: agora
    })
    .where(eq(followUps.id, followUpId));
  
  return { 
    status: "agendado", 
    mensagem: `Tentativa ${atual.tentativaAtual} registrada. Próxima tentativa: ${proximaTentativa.toLocaleDateString('pt-BR')}`,
    proximaTentativa
  };
}

export async function criarFollowUpParaLead(leadId: number, corretorId: number) {
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
    return existente[0].id; // Já existe, retorna o ID
  }
  
  // Criar novo follow-up
  const proximaTentativa = new Date();
  proximaTentativa.setDate(proximaTentativa.getDate() + 1);
  proximaTentativa.setHours(9, 0, 0, 0);
  
  const result = await db.insert(followUps).values({
    leadId,
    corretorId,
    tentativaAtual: 1,
    maxTentativas: 5,
    proximaTentativa,
    status: "ativo",
    historicoTentativas: "[]"
  });
  
  return result[0].insertId;
}

// Buscar leads agendados para hoje (para a aba Tarefas do Dia)
export async function getLeadsAgendadosHoje(corretorId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  
  return await db.select()
    .from(leads)
    .where(and(
      eq(leads.corretorId, corretorId),
      eq(leads.status, "agendado"),
      gte(leads.proximoFollowup, hoje),
      lte(leads.proximoFollowup, amanha)
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
  
  const dataRef = data || new Date();
  dataRef.setHours(0, 0, 0, 0);
  
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
  
  const dataRef = data || new Date();
  dataRef.setHours(0, 0, 0, 0);
  
  // Buscar atividades do dia com dados do corretor
  const atividades = await db.select({
    id: atividadesDiarias.id,
    corretorId: atividadesDiarias.corretorId,
    corretorNome: users.name,
    corretorFoto: users.fotoUrl,
    ligacoesRealizadas: atividadesDiarias.ligacoesRealizadas,
    ligacoesAtendidas: atividadesDiarias.ligacoesAtendidas,
    whatsappEnviados: atividadesDiarias.whatsappEnviados,
    whatsappRespondidos: atividadesDiarias.whatsappRespondidos,
    agendamentosConfirmados: atividadesDiarias.agendamentosConfirmados,
    visitasRealizadas: atividadesDiarias.visitasRealizadas,
    propostasEnviadas: atividadesDiarias.propostasEnviadas,
    documentacoesRecolhidas: atividadesDiarias.documentacoesRecolhidas,
    analiseCreditoEnviadas: atividadesDiarias.analiseCreditoEnviadas,
    contratosFechados: atividadesDiarias.contratosFechados,
    vgvDia: atividadesDiarias.vgvDia,
    pontuacaoTotal: atividadesDiarias.pontuacaoTotal,
  })
    .from(atividadesDiarias)
    .innerJoin(users, eq(atividadesDiarias.corretorId, users.id))
    .where(eq(atividadesDiarias.data, dataRef))
    .orderBy(desc(atividadesDiarias.pontuacaoTotal));
  
  // Buscar metas de cada corretor para calcular percentuais
  const resultado = await Promise.all(atividades.map(async (atividade) => {
    const metasCorretor = await db.select()
      .from(metas)
      .where(eq(metas.corretorId, atividade.corretorId))
      .limit(1);
    
    const meta = metasCorretor[0];
    
    return {
      ...atividade,
      metas: meta ? {
        ligacoesMeta: Math.ceil(meta.metaLeads / 22) || 0, // Meta diária = mensal / 22 dias úteis
        agendamentosMeta: Math.ceil(meta.metaAgendamentos / 22) || 0,
        visitasMeta: Math.ceil(meta.metaVisitas / 22) || 0,
        contratosMeta: Math.ceil(meta.metaContratos / 22) || 0,
      } : null
    };
  }));
  
  return resultado;
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
  
  const ranking = await db.select({
    corretorId: atividadesDiarias.corretorId,
    corretorNome: users.name,
    corretorFoto: users.fotoUrl,
    totalLigacoes: sql<number>`SUM(${atividadesDiarias.ligacoesRealizadas})`,
    totalAgendamentos: sql<number>`SUM(${atividadesDiarias.agendamentosConfirmados})`,
    totalVisitas: sql<number>`SUM(${atividadesDiarias.visitasRealizadas})`,
    totalDocumentacoes: sql<number>`SUM(${atividadesDiarias.documentacoesRecolhidas})`,
    totalContratos: sql<number>`SUM(${atividadesDiarias.contratosFechados})`,
    totalVgv: sql<number>`SUM(${atividadesDiarias.vgvDia})`,
    totalPontos: sql<number>`SUM(${atividadesDiarias.pontuacaoTotal})`,
  })
    .from(atividadesDiarias)
    .innerJoin(users, eq(atividadesDiarias.corretorId, users.id))
    .where(gte(atividadesDiarias.data, inicioSemana))
    .groupBy(atividadesDiarias.corretorId, users.name, users.fotoUrl)
    .orderBy(desc(sql`SUM(${atividadesDiarias.pontuacaoTotal})`));
  
  return ranking;
}

// Obter ranking mensal
export async function getRankingMensal() {
  const db = await getDb();
  if (!db) return [];
  
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  
  const ranking = await db.select({
    corretorId: atividadesDiarias.corretorId,
    corretorNome: users.name,
    corretorFoto: users.fotoUrl,
    totalLigacoes: sql<number>`SUM(${atividadesDiarias.ligacoesRealizadas})`,
    totalAgendamentos: sql<number>`SUM(${atividadesDiarias.agendamentosConfirmados})`,
    totalVisitas: sql<number>`SUM(${atividadesDiarias.visitasRealizadas})`,
    totalDocumentacoes: sql<number>`SUM(${atividadesDiarias.documentacoesRecolhidas})`,
    totalContratos: sql<number>`SUM(${atividadesDiarias.contratosFechados})`,
    totalVgv: sql<number>`SUM(${atividadesDiarias.vgvDia})`,
    totalPontos: sql<number>`SUM(${atividadesDiarias.pontuacaoTotal})`,
  })
    .from(atividadesDiarias)
    .innerJoin(users, eq(atividadesDiarias.corretorId, users.id))
    .where(gte(atividadesDiarias.data, inicioMes))
    .groupBy(atividadesDiarias.corretorId, users.name, users.fotoUrl)
    .orderBy(desc(sql`SUM(${atividadesDiarias.pontuacaoTotal})`));
  
  return ranking;
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
  
  // Sistema de pontuação (definido pelo gestor):
  // - Novo cliente cadastrado = 5 pontos
  // - Registro/alteração de status = 2 pontos
  // - Agendamento criado = 15 pontos
  // - Visita realizada = 25 pontos
  // - Documentação/Análise de Crédito = 35 pontos
  // - Venda = 80 pontos
  // - Bônus por atingir meta: +50% dos pontos
  
  const PONTOS = {
    CLIENTE_CADASTRADO: 5,
    ALTERACAO_STATUS: 2,
    AGENDAMENTO: 15,
    VISITA: 25,
    DOCUMENTACAO: 35,
    VENDA: 80,
  };
  
  let pontuacao = 0;
  
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

// Registrar atividade automaticamente baseado em mudança de status do lead
export async function registrarAtividadePorStatus(
  corretorId: number, 
  statusAnterior: string | null, 
  statusNovo: string,
  valorVenda?: number
) {
  // Alterações de status são registradas automaticamente pelo sistema
  
  // Mapear mudanças de status para atividades específicas
  if (statusNovo === 'em_atendimento' && statusAnterior === 'aguardando_atendimento') {
    await incrementarAtividade(corretorId, 'ligacoesRealizadas');
    await incrementarAtividade(corretorId, 'ligacoesAtendidas');
  }
  
  if (statusNovo === 'agendado') {
    await incrementarAtividade(corretorId, 'agendamentosConfirmados');
  }
  
  if (statusNovo === 'visita_realizada') {
    await incrementarAtividade(corretorId, 'visitasRealizadas');
  }
  
  if (statusNovo === 'analise_credito') {
    await incrementarAtividade(corretorId, 'documentacoesRecolhidas');
    await incrementarAtividade(corretorId, 'analiseCreditoEnviadas');
  }
  
  if (statusNovo === 'contrato_fechado') {
    await incrementarAtividade(corretorId, 'contratosFechados');
    if (valorVenda) {
      await adicionarVgvDia(corretorId, valorVenda);
    }
  }
  
  // Recalcular pontuação
  await calcularPontuacaoDiaria(corretorId);
}

// Registrar cliente cadastrado pelo corretor (5 pontos)
export async function registrarClienteCadastrado(corretorId: number) {
  // clientesCadastrados não é um campo válido para incrementar
  // Usar ligacoesRealizadas como proxy para atividade
  await incrementarAtividade(corretorId, 'ligacoesRealizadas');
  await calcularPontuacaoDiaria(corretorId);
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
export async function getConquistasCorretor(corretorId: number): Promise<(Conquista & { tipo: TipoConquista })[]> {
  const db = await getDb();
  if (!db) return [];
  
  const resultado = await db.select({
    conquista: conquistas,
    tipo: tiposConquista,
  })
    .from(conquistas)
    .innerJoin(tiposConquista, eq(conquistas.tipoConquistaId, tiposConquista.id))
    .where(eq(conquistas.corretorId, corretorId))
    .orderBy(desc(conquistas.createdAt));
  
  return resultado.map(r => ({ ...r.conquista, tipo: r.tipo }));
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
export async function getResumoConquistas(corretorId: number): Promise<{
  total: number;
  porCategoria: Record<string, number>;
  recentes: (Conquista & { tipo: TipoConquista })[];
  destaque: (Conquista & { tipo: TipoConquista }) | null;
}> {
  const db = await getDb();
  if (!db) return { total: 0, porCategoria: {}, recentes: [], destaque: null };
  
  const todasConquistas = await getConquistasCorretor(corretorId);
  
  // Contar por categoria
  const porCategoria: Record<string, number> = {};
  for (const c of todasConquistas) {
    const cat = c.tipo.categoria;
    porCategoria[cat] = (porCategoria[cat] || 0) + 1;
  }
  
  // Pegar as 5 mais recentes
  const recentes = todasConquistas.slice(0, 5);
  
  // Pegar a mais importante (gold > silver > bronze > outras)
  const ordemCor = ['gold', 'purple', 'blue', 'silver', 'bronze', 'green', 'orange', 'red'];
  const destaque = todasConquistas.sort((a, b) => {
    const idxA = ordemCor.indexOf(a.tipo.cor);
    const idxB = ordemCor.indexOf(b.tipo.cor);
    return idxA - idxB;
  })[0] || null;
  
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
  dataFim?: Date
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
  
  // Buscar todos os corretores
  const corretores = await db.select()
    .from(users)
    .where(sql`${users.role} IN ('corretor', 'user')`);
  
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
  dataFim?: Date
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
  const conditions = [];
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
  
  if (statusAtualIdx < agendadoIdx) {
    await updateLead(data.leadId, { status: 'agendado' });
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
 * Buscar todos os agendamentos (para gestor)
 */
export async function getAllAgendamentos(filtros?: {
  dataInicio?: Date;
  dataFim?: Date;
  corretorId?: number;
  status?: string;
}): Promise<Agendamento[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (filtros?.dataInicio) {
    conditions.push(gte(agendamentos.dataAgendamento, filtros.dataInicio));
  }
  if (filtros?.dataFim) {
    conditions.push(lte(agendamentos.dataAgendamento, filtros.dataFim));
  }
  if (filtros?.corretorId) {
    conditions.push(eq(agendamentos.corretorId, filtros.corretorId));
  }
  if (filtros?.status) {
    conditions.push(eq(agendamentos.status, filtros.status as any));
  }
  
  return await db.select()
    .from(agendamentos)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(agendamentos.dataAgendamento));
}

/**
 * Atualizar status de um agendamento
 */
export async function updateAgendamentoStatus(
  id: number,
  status: 'pendente' | 'confirmado' | 'realizado' | 'cancelado' | 'reagendado'
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(agendamentos)
    .set({ status, updatedAt: new Date() })
    .where(eq(agendamentos.id, id));
  
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
}): Promise<Visita[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
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
 * Buscar lead por qualquer identificador (telefone, email ou CPF)
 */
export async function searchLeadByIdentifier(query: string, corretorId?: number): Promise<Lead[]> {
  const db = await getDb();
  if (!db) return [];
  
  // Limpar query
  const queryLimpa = query.trim();
  const querySemCaracteres = queryLimpa.replace(/\D/g, '');
  
  const conditions = [];
  
  // Se parece com telefone ou CPF (só números)
  if (querySemCaracteres.length >= 3) {
    conditions.push(
      sql`REPLACE(REPLACE(REPLACE(${leads.telefone}, '-', ''), ' ', ''), '(', '') LIKE ${`%${querySemCaracteres}%`}`
    );
    conditions.push(
      sql`REPLACE(REPLACE(${leads.cpf}, '.', ''), '-', '') LIKE ${`%${querySemCaracteres}%`}`
    );
  }
  
  // Se parece com email
  if (queryLimpa.includes('@') || queryLimpa.length >= 3) {
    conditions.push(
      sql`${leads.email} LIKE ${`%${queryLimpa}%`}`
    );
  }
  
  // Buscar também por nome
  conditions.push(
    sql`${leads.nome} LIKE ${`%${queryLimpa}%`}`
  );
  
  let baseQuery = db.select()
    .from(leads)
    .where(sql`(${sql.join(conditions, sql` OR `)})`);
  
  if (corretorId) {
    baseQuery = db.select()
      .from(leads)
      .where(and(
        sql`(${sql.join(conditions, sql` OR `)})`,
        eq(leads.corretorId, corretorId)
      ));
  }
  
  return await baseQuery.limit(10);
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
