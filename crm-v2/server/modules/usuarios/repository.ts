import { eq, and } from "drizzle-orm";
import type { DrizzleDB } from "../../_core/db.js";
import { users, equipes, historicoPresenca } from "../../../drizzle/schema/index.js";

export type UserWithEquipe = typeof users.$inferSelect & { equipeNome: string | null };

export async function getUserById(db: DrizzleDB, id: number) {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getUserByOpenId(db: DrizzleDB, openId: string) {
  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0] ?? null;
}

export async function getAllCorretores(db: DrizzleDB) {
  return db.select().from(users).where(
    and(eq(users.role, "corretor"), eq(users.status, "presente"))
  ).orderBy(users.name);
}

export async function getAllUsers(db: DrizzleDB) {
  return db.select().from(users).orderBy(users.name);
}

export async function getAllUsersWithEquipes(db: DrizzleDB): Promise<UserWithEquipe[]> {
  const [allUsers, allEquipes] = await Promise.all([
    db.select().from(users).orderBy(users.name),
    db.select().from(equipes),
  ]);
  const equipeMap = new Map(allEquipes.map((e) => [e.id, e.nome]));
  return allUsers.map((u) => ({
    ...u,
    equipeNome: u.equipeId ? (equipeMap.get(u.equipeId) ?? null) : null,
  }));
}

export async function upsertUser(
  db: DrizzleDB,
  data: { openId: string; name: string; email?: string | null; fotoUrl?: string | null }
) {
  const existing = await getUserByOpenId(db, data.openId);
  if (existing) {
    await db.update(users).set({
      name: data.name,
      email: data.email ?? existing.email,
      fotoUrl: data.fotoUrl ?? existing.fotoUrl,
      lastSignedIn: new Date(),
    }).where(eq(users.id, existing.id));
    return (await getUserById(db, existing.id))!;
  }
  await db.insert(users).values({
    openId: data.openId,
    name: data.name,
    email: data.email ?? undefined,
    fotoUrl: data.fotoUrl ?? undefined,
    lastSignedIn: new Date(),
  });
  return (await getUserByOpenId(db, data.openId))!;
}

export async function updateUserStatus(
  db: DrizzleDB,
  id: number,
  status: "presente" | "ausente"
) {
  await db.update(users).set({ status }).where(eq(users.id, id));
}

export async function updateUser(
  db: DrizzleDB,
  id: number,
  data: Partial<typeof users.$inferInsert>
) {
  await db.update(users).set(data).where(eq(users.id, id));
}

export async function getCorretoresByEquipe(db: DrizzleDB, equipeId: number) {
  return db.select().from(users).where(
    and(eq(users.equipeId, equipeId), eq(users.role, "corretor"))
  );
}

export async function getAllEquipes(db: DrizzleDB) {
  return db.select().from(equipes).orderBy(equipes.nome);
}

export async function createEquipe(db: DrizzleDB, data: typeof equipes.$inferInsert) {
  await db.insert(equipes).values(data);
}

export async function updateEquipe(
  db: DrizzleDB,
  id: number,
  data: Partial<typeof equipes.$inferInsert>
) {
  await db.update(equipes).set(data).where(eq(equipes.id, id));
}

export async function recordPresenca(
  db: DrizzleDB,
  corretorId: number,
  tipo: "entrada" | "saida",
  statusAnterior: "presente" | "ausente",
  statusNovo: "presente" | "ausente",
  origem: "manual" | "automatico_fim" | "automatico_3h" | "sistema" = "manual"
) {
  await db.insert(historicoPresenca).values({
    corretorId,
    tipo,
    statusAnterior,
    statusNovo,
    origem,
  });
}
