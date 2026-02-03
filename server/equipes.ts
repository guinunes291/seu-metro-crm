import { getDb } from "./db";
import { equipes, users } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import type { InsertEquipe } from "../drizzle/schema";

// ============================================================================
// CRUD DE EQUIPES
// ============================================================================

/**
 * Listar todas as equipes
 */
export async function listarEquipes(apenasAtivas = false) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let query = db
    .select({
      id: equipes.id,
      nome: equipes.nome,
      descricao: equipes.descricao,
      gestorId: equipes.gestorId,
      gestorNome: users.name,
      gestorEmail: users.email,
      cor: equipes.cor,
      metaMensal: equipes.metaMensal,
      ativa: equipes.ativa,
      createdAt: equipes.createdAt,
      updatedAt: equipes.updatedAt,
    })
    .from(equipes)
    .leftJoin(users, eq(equipes.gestorId, users.id));

  if (apenasAtivas) {
    query = query.where(eq(equipes.ativa, true));
  }

  return await query;
}

/**
 * Buscar equipe por ID
 */
export async function getEquipeById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select({
      id: equipes.id,
      nome: equipes.nome,
      descricao: equipes.descricao,
      gestorId: equipes.gestorId,
      gestorNome: users.name,
      gestorEmail: users.email,
      cor: equipes.cor,
      metaMensal: equipes.metaMensal,
      ativa: equipes.ativa,
      createdAt: equipes.createdAt,
      updatedAt: equipes.updatedAt,
    })
    .from(equipes)
    .leftJoin(users, eq(equipes.gestorId, users.id))
    .where(eq(equipes.id, id))
    .limit(1);

  return result[0] || null;
}

/**
 * Buscar equipe por gestor
 */
export async function getEquipeByGestor(gestorId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(equipes)
    .where(and(
      eq(equipes.gestorId, gestorId),
      eq(equipes.ativa, true)
    ))
    .limit(1);

  return result[0] || null;
}

/**
 * Criar nova equipe
 */
export async function createEquipe(data: InsertEquipe) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(equipes).values(data);
  return result[0].insertId;
}

/**
 * Atualizar equipe
 */
export async function updateEquipe(id: number, data: Partial<InsertEquipe>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(equipes)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(equipes.id, id));
}

/**
 * Deletar equipe (soft delete - marca como inativa)
 */
export async function deleteEquipe(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(equipes)
    .set({ ativa: false, updatedAt: new Date() })
    .where(eq(equipes.id, id));
}

/**
 * Listar corretores de uma equipe
 */
export async function getCorretoresDaEquipe(equipeId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      telefone: users.telefone,
      status: users.status,
      situacao: users.situacao,
      role: users.role,
      equipeId: users.equipeId,
    })
    .from(users)
    .where(and(
      eq(users.equipeId, equipeId),
      eq(users.role, "corretor")
    ));
}

/**
 * Adicionar corretor à equipe
 */
export async function adicionarCorretorNaEquipe(corretorId: number, equipeId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set({ equipeId, updatedAt: new Date() })
    .where(eq(users.id, corretorId));
}

/**
 * Remover corretor da equipe
 */
export async function removerCorretorDaEquipe(corretorId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set({ equipeId: null, updatedAt: new Date() })
    .where(eq(users.id, corretorId));
}

/**
 * Contar membros da equipe
 */
export async function contarMembrosEquipe(equipeId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(
      eq(users.equipeId, equipeId),
      eq(users.role, "corretor")
    ));

  return result[0]?.count || 0;
}

/**
 * Verificar se usuário pertence à equipe
 */
export async function usuarioPertenceAEquipe(userId: number, equipeId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .select({ id: users.id })
    .from(users)
    .where(and(
      eq(users.id, userId),
      eq(users.equipeId, equipeId)
    ))
    .limit(1);

  return result.length > 0;
}
