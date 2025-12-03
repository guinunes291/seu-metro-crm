import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { users, leads, projects } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createGestorContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "gestor-test",
    email: "gestor@test.com",
    name: "Gestor Test",
    loginMethod: "manus",
    role: "gestor",
    status: "presente",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return ctx;
}

describe("Distribuição Automática de Leads", () => {
  it("deve verificar elegibilidade de corretor com status presente", async () => {
    const ctx = createGestorContext();
    const caller = appRouter.createCaller(ctx);

    // Criar um corretor de teste
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Limpar dados de teste anteriores
    await db.delete(leads);
    await db.delete(users).where(sql`role = 'corretor'`);

    // Inserir corretor presente
    const [corretor] = await db.insert(users).values({
      openId: "corretor-test-1",
      name: "Corretor Presente",
      email: "corretor1@test.com",
      role: "corretor",
      status: "presente",
    });

    // Verificar elegibilidade
    const result = await caller.distribution.verificarElegibilidade({
      corretorId: corretor.insertId,
    });

    expect(result.elegivel).toBe(true);
  });

  it("deve rejeitar corretor com status ausente", async () => {
    const ctx = createGestorContext();
    const caller = appRouter.createCaller(ctx);

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Inserir corretor ausente
    const [corretor] = await db.insert(users).values({
      openId: "corretor-test-2",
      name: "Corretor Ausente",
      email: "corretor2@test.com",
      role: "corretor",
      status: "ausente",
    });

    // Verificar elegibilidade
    const result = await caller.distribution.verificarElegibilidade({
      corretorId: corretor.insertId,
    });

    expect(result.elegivel).toBe(false);
  });

  it("deve distribuir lead automaticamente para corretor elegível", async () => {
    const ctx = createGestorContext();
    const caller = appRouter.createCaller(ctx);

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Limpar dados
    await db.delete(leads);
    await db.delete(projects);
    await db.delete(users).where(sql`role = 'corretor'`);

    // Criar projeto
    const [project] = await db.insert(projects).values({
      nome: "Projeto Teste",
      cidade: "São Paulo",
      estado: "SP",
      tipo: "mcmv",
      status: "ativo",
    });

    // Criar corretor elegível
    const [corretor] = await db.insert(users).values({
      openId: "corretor-test-3",
      name: "Corretor Elegível",
      email: "corretor3@test.com",
      role: "corretor",
      status: "presente",
    });

    // Criar lead sem distribuição
    const [lead] = await db.insert(leads).values({
      nome: "Lead Teste",
      telefone: "(11) 99999-9999",
      email: "lead@test.com",
      origem: "Teste",
      projectId: project.insertId,
      status: "novo",
    });

    // Distribuir automaticamente
    const result = await caller.distribution.distribuirAutomatico({
      leadId: lead.insertId,
    });

    expect(result.success).toBe(true);
    expect(result.corretorId).toBe(corretor.insertId);

    // Verificar se o lead foi atualizado
    const leadAtualizado = await db
      .select()
      .from(leads)
      .where(eq(leads.id, lead.insertId))
      .limit(1);

    expect(leadAtualizado[0].corretorId).toBe(corretor.insertId);
    expect(leadAtualizado[0].status).toBe("aguardando_atendimento");
  });

  it("deve falhar ao distribuir lead quando não há corretor elegível", async () => {
    const ctx = createGestorContext();
    const caller = appRouter.createCaller(ctx);

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Limpar dados
    await db.delete(leads);
    await db.delete(users).where(sql`role = 'corretor'`);

    // Criar lead sem corretor disponível
    const [lead] = await db.insert(leads).values({
      nome: "Lead Sem Corretor",
      telefone: "(11) 88888-8888",
      status: "novo",
    });

    // Tentar distribuir automaticamente
    try {
      await caller.distribution.distribuirAutomatico({
        leadId: lead.insertId,
      });
      // Se não lançar erro, o teste falha
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toContain("Nenhum corretor elegível disponível");
    }
  });
});
