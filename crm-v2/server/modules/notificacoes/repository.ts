import { eq, and, desc, sql } from "drizzle-orm";
import type { DrizzleDB } from "../../_core/db.js";
import { notifications } from "../../../drizzle/schema/index.js";

export async function getNotificacoesByUser(db: DrizzleDB, userId: number, limit = 50) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function countUnread(db: DrizzleDB, userId: number): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.lida, false)));
  return Number(rows[0]?.count ?? 0);
}

export async function markAsRead(db: DrizzleDB, id: number, userId: number): Promise<void> {
  await db
    .update(notifications)
    .set({ lida: true, lidaEm: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllAsRead(db: DrizzleDB, userId: number): Promise<void> {
  await db
    .update(notifications)
    .set({ lida: true, lidaEm: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.lida, false)));
}

export async function createNotificacao(
  db: DrizzleDB,
  data: typeof notifications.$inferInsert
) {
  await db.insert(notifications).values(data);
}
