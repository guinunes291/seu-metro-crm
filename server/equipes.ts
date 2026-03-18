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

  const rows = await db
    .select({
      id: equipes.id,
      nome: equipes.nome,
      descricao: equipes.descricao,
      gestorId: equipes.gestorId,
      gestorNome: users.name,
      gestorEmail: users.email,
      superintendenteId: equipes.superintendenteId,
      cor: equipes.cor,
      metaMensal: equipes.metaMensal,
      ativa: equipes.ativa,
      createdAt: equipes.createdAt,
      updatedAt: equipes.updatedAt,
    })
    .from(equipes)
    .leftJoin(users, eq(equipes.gestorId, users.id));

  return apenasAtivas ? rows.filter(e => e.ativa) : rows;
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
      superintendenteId: equipes.superintendenteId,
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

  // Promover usuário selecionado para gestor automaticamente
  await db
    .update(users)
    .set({ role: 'gestor' })
    .where(eq(users.id, data.gestorId));

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

// ============================================================================
// FUNÇÕES DE SUPERINTENDÊNCIA
// ============================================================================

/**
 * Listar equipes de um superintendente específico
 */
export async function listarEquipesPorSuperintendente(superintendenteId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db
    .select({
      id: equipes.id,
      nome: equipes.nome,
      descricao: equipes.descricao,
      gestorId: equipes.gestorId,
      gestorNome: users.name,
      gestorEmail: users.email,
      superintendenteId: equipes.superintendenteId,
      cor: equipes.cor,
      metaMensal: equipes.metaMensal,
      ativa: equipes.ativa,
      createdAt: equipes.createdAt,
      updatedAt: equipes.updatedAt,
    })
    .from(equipes)
    .leftJoin(users, eq(equipes.gestorId, users.id))
    .where(and(
      eq(equipes.superintendenteId, superintendenteId),
      eq(equipes.ativa, true)
    ));
}

/**
 * Atribuir superintendente a uma equipe
 */
export async function atribuirSuperintendenteAEquipe(equipeId: number, superintendenteId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(equipes)
    .set({ superintendenteId, updatedAt: new Date() })
    .where(eq(equipes.id, equipeId));
}

/**
 * Listar todos os superintendentes do sistema
 */
export async function listarSuperintendentes() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      situacao: users.situacao,
    })
    .from(users)
    .where(eq(users.role, 'superintendente'));
}

/**
 * Retorna IDs de todos os corretores das equipes de um superintendente
 */
export async function getCorretoresIdsPorSuperintendente(superintendenteId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const equipesDoSuper = await db
    .select({ id: equipes.id })
    .from(equipes)
    .where(and(
      eq(equipes.superintendenteId, superintendenteId),
      eq(equipes.ativa, true)
    ));
  if (equipesDoSuper.length === 0) return [];
  const equipeIds = equipesDoSuper.map(e => e.id);
  const corretores = await db
    .select({ id: users.id })
    .from(users)
    .where(and(
      sql`${users.equipeId} IN (${sql.join(equipeIds.map(id => sql`${id}`), sql`, `)})`,
      eq(users.role, 'corretor')
    ));
  return corretores.map(c => c.id);
}

// ============================================================================
// HELPERS PARA FILTROS POR EQUIPE
// ============================================================================

/**
 * Retorna os IDs dos corretores da equipe do gestor
 * Se o usuário for admin, retorna null (sem filtro)
 * Se o usuário for gestor, retorna array com IDs dos corretores da sua equipe
 */
export async function getCorretoresIdsParaFiltro(userId: number, userRole: string): Promise<number[] | null> {
  // Admin vê tudo
  if (userRole === 'admin') {
    return null;
  }

  // Superintendente vê apenas as equipes atribuídas a ele
  if (userRole === 'superintendente') {
    const corretoresIds = await getCorretoresIdsPorSuperintendente(userId);
    // Se não tem equipes atribuídas, retorna null (vê tudo) para não bloquear
    return corretoresIds.length > 0 ? corretoresIds : null;
  }
  
  // Gestor vê apenas sua equipe
  if (userRole === 'gestor') {
    const equipe = await getEquipeByGestor(userId);
    if (!equipe) {
      return []; // Gestor sem equipe = não vê nada
    }
    
    const corretores = await getCorretoresDaEquipe(equipe.id);
    const corretoresIds = corretores.map(c => c.id);
    
    // Incluir o próprio gestor nas métricas (caso ele também seja corretor)
    if (!corretoresIds.includes(userId)) {
      corretoresIds.push(userId);
    }
    
    return corretoresIds;
  }
  
  // Corretor vê apenas seus próprios leads (retorna próprio ID)
  return [userId];
}
