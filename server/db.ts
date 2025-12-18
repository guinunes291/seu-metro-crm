import { eq, and, desc, sql, gte, lte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  projects, InsertProject, Project,
  properties, InsertProperty, Property,
  leads, InsertLead, Lead,
  leadHistory, InsertLeadHistory,
  distributionLog, InsertDistributionLog,
  conversionStats, InsertConversionStats,
  quickMessages, InsertQuickMessage,
  notifications, InsertNotification
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
  });
  
  return result;
}

export async function updateCorretor(id: number, data: {
  name?: string;
  email?: string;
  telefone?: string;
  status?: "presente" | "ausente";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id));
}

export async function deleteCorretor(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Verifica se o corretor tem leads atribuídos
  const leadsCount = await db.select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(eq(leads.corretorId, id));
  
  if (Number(leadsCount[0]?.count) > 0) {
    throw new Error("Não é possível excluir corretor que possui leads atribuídos");
  }
  
  await db.delete(users).where(eq(users.id, id));
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
  return result;
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
  
  await db.update(leads)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(leads.id, id));
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
