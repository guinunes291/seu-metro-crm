import { eq, and, ne, or, like, desc, lte, sql, isNull } from "drizzle-orm";
import type { DrizzleDB } from "../../_core/db.js";
import {
  leads,
  leadHistory,
  leadStatusTransitions,
  users,
  projects,
} from "../../../drizzle/schema/index.js";
import type { LeadStatus } from "../../../shared/const.js";

export type LeadWithRelations = typeof leads.$inferSelect & {
  projetoNome: string | null;
  corretorNome: string | null;
};

export interface LeadFilters {
  status?: LeadStatus;
  naLixeira?: boolean;
  limit?: number;
  offset?: number;
}

export async function getLeadById(db: DrizzleDB, id: number): Promise<LeadWithRelations | null> {
  const rows = await db
    .select({
      lead: leads,
      projetoNome: projects.nome,
      corretorNome: users.name,
    })
    .from(leads)
    .leftJoin(projects, eq(leads.projetoId, projects.id))
    .leftJoin(users, eq(leads.corretorId, users.id))
    .where(eq(leads.id, id))
    .limit(1);

  if (!rows[0]) return null;
  return { ...rows[0].lead, projetoNome: rows[0].projetoNome ?? null, corretorNome: rows[0].corretorNome ?? null };
}

export async function getLeadsByCorretor(
  db: DrizzleDB,
  corretorId: number,
  filters: LeadFilters = {}
): Promise<LeadWithRelations[]> {
  const { status, naLixeira = false, limit = 50, offset = 0 } = filters;

  const conditions = [
    eq(leads.corretorId, corretorId),
    eq(leads.naLixeira, naLixeira),
  ];
  if (status) conditions.push(eq(leads.status, status));

  const rows = await db
    .select({
      lead: leads,
      projetoNome: projects.nome,
      corretorNome: users.name,
    })
    .from(leads)
    .leftJoin(projects, eq(leads.projetoId, projects.id))
    .leftJoin(users, eq(leads.corretorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(leads.updatedAt))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({ ...r.lead, projetoNome: r.projetoNome ?? null, corretorNome: r.corretorNome ?? null }));
}

export async function countLeadsByCorretor(db: DrizzleDB, corretorId: number): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(leads)
    .where(and(eq(leads.corretorId, corretorId), eq(leads.naLixeira, false)));
  return Number(rows[0]?.count ?? 0);
}

export async function getAllLeadsAtivos(db: DrizzleDB) {
  return db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.naLixeira, false),
        isNull(leads.corretorId),
        ne(leads.status, "perdido"),
        ne(leads.status, "contrato_fechado")
      )
    );
}

export async function countLeadsByStatus(
  db: DrizzleDB,
  corretorId?: number
): Promise<Record<string, number>> {
  const conditions = corretorId ? [eq(leads.corretorId, corretorId)] : [];
  const rows = await db
    .select({ status: leads.status, count: sql<number>`COUNT(*)` })
    .from(leads)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(leads.status);
  const result: Record<string, number> = {};
  for (const row of rows) result[row.status] = Number(row.count);
  return result;
}

export async function createLead(db: DrizzleDB, data: typeof leads.$inferInsert) {
  await db.insert(leads).values(data);
  if (data.telefone) {
    const rows = await db
      .select()
      .from(leads)
      .where(eq(leads.telefone, data.telefone))
      .orderBy(desc(leads.createdAt))
      .limit(1);
    return rows[0] ?? null;
  }
  return null;
}

export async function updateLead(
  db: DrizzleDB,
  id: number,
  data: Partial<typeof leads.$inferInsert>
) {
  await db.update(leads).set(data).where(eq(leads.id, id));
}

export async function moveToLixeira(db: DrizzleDB, id: number) {
  await db
    .update(leads)
    .set({ naLixeira: true, dataMovidoLixeira: new Date() })
    .where(eq(leads.id, id));
}

export async function addHistory(db: DrizzleDB, data: typeof leadHistory.$inferInsert) {
  await db.insert(leadHistory).values(data);
}

export async function getHistory(db: DrizzleDB, leadId: number) {
  return db
    .select()
    .from(leadHistory)
    .where(eq(leadHistory.leadId, leadId))
    .orderBy(desc(leadHistory.createdAt));
}

export async function addStatusTransition(
  db: DrizzleDB,
  leadId: number,
  corretorId: number | null,
  statusAnterior: string,
  statusNovo: string,
  observacao?: string
) {
  await db.insert(leadStatusTransitions).values({
    leadId,
    corretorId: corretorId ?? undefined,
    statusAnterior,
    statusNovo,
    observacao: observacao ?? undefined,
  });
}

export async function getLeadsComTimerAtivo(db: DrizzleDB) {
  return db
    .select()
    .from(leads)
    .where(
      and(eq(leads.timerAtivo, true), lte(leads.timerExpiraEm, new Date()))
    );
}

export async function searchLeads(
  db: DrizzleDB,
  q: string,
  corretorId?: number
): Promise<LeadWithRelations[]> {
  const pattern = `%${q}%`;
  const conditions = [
    or(
      like(leads.nome, pattern),
      like(leads.telefone, pattern),
      like(leads.email, pattern)
    )!,
    eq(leads.naLixeira, false),
  ];
  if (corretorId) conditions.push(eq(leads.corretorId, corretorId));

  const rows = await db
    .select({
      lead: leads,
      projetoNome: projects.nome,
      corretorNome: users.name,
    })
    .from(leads)
    .leftJoin(projects, eq(leads.projetoId, projects.id))
    .leftJoin(users, eq(leads.corretorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(leads.updatedAt))
    .limit(30);

  return rows.map((r) => ({ ...r.lead, projetoNome: r.projetoNome ?? null, corretorNome: r.corretorNome ?? null }));
}

export async function getLeadsByIds(db: DrizzleDB, ids: number[]) {
  if (ids.length === 0) return [];
  return db.select().from(leads).where(
    sql`${leads.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`
  );
}
