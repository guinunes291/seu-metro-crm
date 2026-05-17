import { eq } from "drizzle-orm";
import type { DrizzleDB } from "../../_core/db.js";
import { webhookConfig } from "../../../drizzle/schema/index.js";
import { sql } from "drizzle-orm";

export async function getWebhookByToken(db: DrizzleDB, token: string) {
  const rows = await db
    .select()
    .from(webhookConfig)
    .where(eq(webhookConfig.token, token))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAllWebhooks(db: DrizzleDB) {
  return db.select().from(webhookConfig).orderBy(webhookConfig.nome);
}

export async function createWebhook(db: DrizzleDB, data: typeof webhookConfig.$inferInsert) {
  await db.insert(webhookConfig).values(data);
  const rows = await db
    .select()
    .from(webhookConfig)
    .where(eq(webhookConfig.token, data.token))
    .limit(1);
  return rows[0]!;
}

export async function updateWebhook(
  db: DrizzleDB,
  id: number,
  data: Partial<typeof webhookConfig.$inferInsert>
) {
  await db.update(webhookConfig).set(data).where(eq(webhookConfig.id, id));
}

export async function incrementLeadsRecebidos(db: DrizzleDB, id: number) {
  await db
    .update(webhookConfig)
    .set({
      leadsRecebidos: sql`leads_recebidos + 1`,
      ultimoLeadRecebido: new Date(),
    })
    .where(eq(webhookConfig.id, id));
}

export async function deleteWebhook(db: DrizzleDB, id: number) {
  await db.delete(webhookConfig).where(eq(webhookConfig.id, id));
}
