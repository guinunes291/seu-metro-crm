/**
 * Utilitários para testes - Isolamento de dados de teste
 * 
 * IMPORTANTE: Todos os testes devem usar estes utilitários para evitar
 * apagar dados de produção acidentalmente.
 */

import { getDb } from "./db";
import { users, leads, projects, leadHistory, distributionLog, metas, tarefas, followUps, notifications, atividadesDiarias, filaDistribuicao } from "../drizzle/schema";
import { eq, like, sql, and, or, inArray } from "drizzle-orm";

// Prefixo usado para identificar dados de teste (curto para não estourar campos)
export const TEST_PREFIX = "_T_";

// Função para criar nome de teste
export function testName(name: string): string {
  return `${TEST_PREFIX}${name}`;
}

// Função para criar email de teste
export function testEmail(email: string): string {
  return `${TEST_PREFIX}${email}`;
}

// Função para criar telefone de teste (não adiciona prefixo para não estourar o campo)
export function testPhone(phone: string): string {
  // Telefone de teste usa formato especial que não existe em produção
  return `99${phone.replace(/\D/g, '').slice(-8)}`;
}

/**
 * Limpa APENAS os dados de teste (com prefixo _T_)
 * NUNCA apaga dados de produção
 */
export async function cleanupTestData() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Primeiro, buscar IDs dos leads de teste
    const testLeads = await db.select({ id: leads.id }).from(leads).where(
      or(
        like(leads.nome, `${TEST_PREFIX}%`),
        like(leads.telefone, `${TEST_PREFIX}%`)
      )
    );
    const testLeadIds = testLeads.map(l => l.id);

    // Buscar IDs dos usuários de teste
    const testUsers = await db.select({ id: users.id }).from(users).where(
      or(
        like(users.email, `${TEST_PREFIX}%`),
        like(users.name, `${TEST_PREFIX}%`)
      )
    );
    const testUserIds = testUsers.map(u => u.id);

    // Limpar na ordem correta para respeitar foreign keys
    
    // 1. Limpar histórico de leads de teste
    if (testLeadIds.length > 0) {
      await db.delete(leadHistory).where(inArray(leadHistory.leadId, testLeadIds));
    }

    // 2. Limpar logs de distribuição de leads de teste
    if (testLeadIds.length > 0) {
      await db.delete(distributionLog).where(inArray(distributionLog.leadId, testLeadIds));
    }

    // 3. Limpar follow-ups de leads de teste
    if (testLeadIds.length > 0) {
      await db.delete(followUps).where(inArray(followUps.leadId, testLeadIds));
    }

    // 4. Limpar tarefas de leads de teste
    if (testLeadIds.length > 0) {
      await db.delete(tarefas).where(inArray(tarefas.leadId, testLeadIds));
    }

    // 5. Limpar leads de teste
    if (testLeadIds.length > 0) {
      await db.delete(leads).where(inArray(leads.id, testLeadIds));
    }

    // 6. Limpar projetos de teste
    await db.delete(projects).where(like(projects.nome, `${TEST_PREFIX}%`));

    // 7. Limpar metas de corretores de teste
    if (testUserIds.length > 0) {
      await db.delete(metas).where(inArray(metas.corretorId, testUserIds));
    }

    // 8. Limpar notificações de usuários de teste
    if (testUserIds.length > 0) {
      await db.delete(notifications).where(inArray(notifications.userId, testUserIds));
    }

    // 9. Limpar atividades diárias de corretores de teste
    if (testUserIds.length > 0) {
      await db.delete(atividadesDiarias).where(inArray(atividadesDiarias.corretorId, testUserIds));
    }

    // 10. Limpar fila de distribuição de corretores de teste
    if (testUserIds.length > 0) {
      await db.delete(filaDistribuicao).where(inArray(filaDistribuicao.corretorId, testUserIds));
    }

    // 11. Limpar usuários de teste (corretores)
    if (testUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, testUserIds));
    }

    console.log("[Test] Dados de teste limpos com sucesso");
  } catch (error) {
    console.error("[Test] Erro ao limpar dados de teste:", error);
    // Não propagar o erro para não quebrar os testes
  }
}

/**
 * Cria um corretor de teste com prefixo
 */
export async function createTestCorretor(data: {
  name: string;
  email: string;
  status?: "presente" | "ausente";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [corretor] = await db.insert(users).values({
    openId: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: testName(data.name),
    email: testEmail(data.email),
    role: "corretor",
    status: data.status || "presente",
  });

  return corretor;
}

/**
 * Cria um projeto de teste com prefixo
 */
export async function createTestProject(data: {
  nome: string;
  cidade?: string;
  estado?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [project] = await db.insert(projects).values({
    nome: testName(data.nome),
    cidade: data.cidade || "São Paulo",
    estado: data.estado || "SP",
    tipo: "mcmv",
    status: "ativo",
  });

  return project;
}

/**
 * Cria um lead de teste com prefixo
 */
export async function createTestLead(data: {
  nome: string;
  telefone: string;
  email?: string;
  corretorId?: number;
  projectId?: number;
  status?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [lead] = await db.insert(leads).values({
    nome: testName(data.nome),
    telefone: testPhone(data.telefone),
    email: data.email ? testEmail(data.email) : undefined,
    corretorId: data.corretorId,
    projectId: data.projectId,
    status: (data.status as any) || "novo",
    origem: "Teste",
  });

  return lead;
}
