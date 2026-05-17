import { eq, and, desc, sql } from "drizzle-orm";
import type { DrizzleDB } from "../../_core/db.js";
import {
  filaDistribuicao,
  distributionLog,
  leadEstoque,
  configuracaoProjetoFoco,
  users,
} from "../../../drizzle/schema/index.js";

export async function getFilaAtiva(db: DrizzleDB) {
  const rows = await db
    .select({ fila: filaDistribuicao, nomeCorretor: users.name })
    .from(filaDistribuicao)
    .leftJoin(users, eq(filaDistribuicao.corretorId, users.id))
    .where(eq(filaDistribuicao.ativo, true))
    .orderBy(filaDistribuicao.posicao);
  return rows.map((r) => ({ ...r.fila, nomeCorretor: r.nomeCorretor ?? null }));
}

export async function getFilaByCorretor(db: DrizzleDB, corretorId: number) {
  const rows = await db
    .select()
    .from(filaDistribuicao)
    .where(eq(filaDistribuicao.corretorId, corretorId))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertFila(
  db: DrizzleDB,
  corretorId: number,
  data: Partial<typeof filaDistribuicao.$inferInsert>
) {
  const existing = await getFilaByCorretor(db, corretorId);
  if (existing) {
    await db.update(filaDistribuicao).set(data).where(eq(filaDistribuicao.corretorId, corretorId));
  } else {
    const maxRows = await db
      .select({ maxPos: sql<number>`MAX(posicao)` })
      .from(filaDistribuicao);
    const nextPos = Number(maxRows[0]?.maxPos ?? -1) + 1;
    await db.insert(filaDistribuicao).values({
      corretorId,
      posicao: nextPos,
      ...data,
    });
  }
}

export async function incrementLeadsRecebidos(db: DrizzleDB, corretorId: number) {
  await db
    .update(filaDistribuicao)
    .set({
      leadsRecebidosHoje: sql`leads_recebidos_hoje + 1`,
      ultimaDistribuicao: new Date(),
    })
    .where(eq(filaDistribuicao.corretorId, corretorId));
}

export async function moverParaFinalDaFila(db: DrizzleDB, corretorId: number) {
  const maxRows = await db
    .select({ maxPos: sql<number>`MAX(posicao)` })
    .from(filaDistribuicao);
  const maxPos = Number(maxRows[0]?.maxPos ?? 0);
  await db
    .update(filaDistribuicao)
    .set({ posicao: maxPos + 1 })
    .where(eq(filaDistribuicao.corretorId, corretorId));
}

export async function resetLeadsRecebidos(db: DrizzleDB) {
  await db.update(filaDistribuicao).set({ leadsRecebidosHoje: 0 });
}

export async function addToEstoque(
  db: DrizzleDB,
  leadId: number,
  tipoFila: "geral" | "foco",
  motivo?: string
) {
  const existing = await db
    .select()
    .from(leadEstoque)
    .where(eq(leadEstoque.leadId, leadId))
    .limit(1);
  if (existing[0]) {
    await db
      .update(leadEstoque)
      .set({ status: "aguardando", motivo })
      .where(eq(leadEstoque.leadId, leadId));
  } else {
    await db.insert(leadEstoque).values({ leadId, tipoFila, motivo, status: "aguardando" });
  }
}

export async function getEstoqueAguardando(db: DrizzleDB) {
  return db
    .select()
    .from(leadEstoque)
    .where(eq(leadEstoque.status, "aguardando"))
    .orderBy(leadEstoque.createdAt);
}

export async function markEstoqueDistribuido(db: DrizzleDB, leadId: number) {
  await db
    .update(leadEstoque)
    .set({ status: "distribuido" })
    .where(eq(leadEstoque.leadId, leadId));
}

export async function getConfigFoco(db: DrizzleDB, projetoId?: number) {
  const conditions = [eq(configuracaoProjetoFoco.ativo, true)];
  if (projetoId) conditions.push(eq(configuracaoProjetoFoco.projetoId, projetoId));
  return db.select().from(configuracaoProjetoFoco).where(and(...conditions));
}

export async function atualizarPosicaoFoco(db: DrizzleDB, configId: number, novaPosicao: number) {
  await db
    .update(configuracaoProjetoFoco)
    .set({ posicaoAtual: novaPosicao })
    .where(eq(configuracaoProjetoFoco.id, configId));
}

export async function getDistributionStats(db: DrizzleDB, diasAtras = 30) {
  const desde = new Date(Date.now() - diasAtras * 86_400_000);
  return db
    .select({
      corretorId: distributionLog.corretorId,
      nomeCorretor: users.name,
      tipo: distributionLog.tipo,
      count: sql<number>`COUNT(*)`,
    })
    .from(distributionLog)
    .leftJoin(users, eq(distributionLog.corretorId, users.id))
    .where(sql`${distributionLog.createdAt} >= ${desde}`)
    .groupBy(distributionLog.corretorId, distributionLog.tipo, users.name)
    .orderBy(desc(sql`COUNT(*)`));
}
