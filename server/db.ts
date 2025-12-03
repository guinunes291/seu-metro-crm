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
  quickMessages, InsertQuickMessage
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
