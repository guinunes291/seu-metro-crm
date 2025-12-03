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

describe("Distribuição Automática - Regras do AppScript", () => {
  it("deve permitir corretor com menos de 30 leads receber novos leads", async () => {
    const ctx = createGestorContext();
    const caller = appRouter.createCaller(ctx);

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Limpar dados
    await db.delete(leads);
    await db.delete(users).where(sql`role = 'corretor'`);

    // Criar corretor presente com 20 leads
    const [corretor] = await db.insert(users).values({
      openId: "corretor-test-minimo",
      name: "Corretor Com Poucos Leads",
      email: "corretor-minimo@test.com",
      role: "corretor",
      status: "presente",
    });

    // Criar 20 leads para o corretor (todos aguardando atendimento)
    for (let i = 0; i < 20; i++) {
      await db.insert(leads).values({
        nome: `Lead ${i}`,
        telefone: `(11) 9999${i.toString().padStart(5, '0')}`,
        corretorId: corretor.insertId,
        status: "aguardando_atendimento",
      });
    }

    // Verificar elegibilidade (deve ser elegível mesmo com 0% de taxa de trabalho)
    const result = await caller.distribution.verificarElegibilidade({
      corretorId: corretor.insertId,
    });

    expect(result.elegivel).toBe(true);
  });

  it("deve exigir 60% de taxa de trabalho para corretor com 30+ leads", async () => {
    const ctx = createGestorContext();
    const caller = appRouter.createCaller(ctx);

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Limpar dados
    await db.delete(leads);
    await db.delete(users).where(sql`role = 'corretor'`);

    // Criar corretor presente com 40 leads
    const [corretor] = await db.insert(users).values({
      openId: "corretor-test-60percent",
      name: "Corretor Com Muitos Leads",
      email: "corretor-60@test.com",
      role: "corretor",
      status: "presente",
    });

    // Criar 40 leads: 20 aguardando (50%) e 20 trabalhados (50%)
    for (let i = 0; i < 20; i++) {
      await db.insert(leads).values({
        nome: `Lead Aguardando ${i}`,
        telefone: `(11) 8888${i.toString().padStart(5, '0')}`,
        corretorId: corretor.insertId,
        status: "aguardando_atendimento",
      });
    }
    for (let i = 0; i < 20; i++) {
      await db.insert(leads).values({
        nome: `Lead Trabalhado ${i}`,
        telefone: `(11) 7777${i.toString().padStart(5, '0')}`,
        corretorId: corretor.insertId,
        status: "em_atendimento",
      });
    }

    // Verificar elegibilidade (deve ser NÃO elegível com 50% de taxa)
    const result = await caller.distribution.verificarElegibilidade({
      corretorId: corretor.insertId,
    });

    expect(result.elegivel).toBe(false);
  });

  it("deve retornar estatísticas completas de distribuição", async () => {
    const ctx = createGestorContext();
    const caller = appRouter.createCaller(ctx);

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Limpar dados
    await db.delete(leads);
    await db.delete(users).where(sql`role = 'corretor'`);

    // Criar 2 corretores
    const [corretor1] = await db.insert(users).values({
      openId: "corretor-stats-1",
      name: "Corretor 1",
      email: "stats1@test.com",
      role: "corretor",
      status: "presente",
    });

    const [corretor2] = await db.insert(users).values({
      openId: "corretor-stats-2",
      name: "Corretor 2",
      email: "stats2@test.com",
      role: "corretor",
      status: "ausente",
    });

    // Criar leads para corretor 1
    for (let i = 0; i < 10; i++) {
      await db.insert(leads).values({
        nome: `Lead C1 ${i}`,
        telefone: `(11) 6666${i.toString().padStart(5, '0')}`,
        corretorId: corretor1.insertId,
        status: i < 7 ? "em_atendimento" : "aguardando_atendimento",
      });
    }

    // Obter estatísticas
    const stats = await caller.distribution.getEstatisticas();

    expect(stats).toHaveLength(2);
    
    const stats1 = stats.find(s => s.id === corretor1.insertId);
    expect(stats1).toBeDefined();
    expect(stats1?.totalLeads).toBe(10);
    expect(stats1?.leadsTrabalhados).toBe(7);
    expect(stats1?.taxaTrabalho).toBe(0.7);
    expect(stats1?.elegivel).toBe(true);
    expect(stats1?.status).toBe("presente");

    const stats2 = stats.find(s => s.id === corretor2.insertId);
    expect(stats2).toBeDefined();
    expect(stats2?.totalLeads).toBe(0);
    expect(stats2?.elegivel).toBe(false); // ausente
    expect(stats2?.status).toBe("ausente");
  });

  it("deve distribuir leads em lote respeitando limite de 20", async () => {
    const ctx = createGestorContext();
    const caller = appRouter.createCaller(ctx);

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Limpar dados
    await db.delete(leads);
    await db.delete(users).where(sql`role = 'corretor'`);

    // Criar corretor elegível
    const [corretor] = await db.insert(users).values({
      openId: "corretor-lote",
      name: "Corretor Lote",
      email: "lote@test.com",
      role: "corretor",
      status: "presente",
    });

    // Criar 30 leads não distribuídos
    for (let i = 0; i < 30; i++) {
      await db.insert(leads).values({
        nome: `Lead Lote ${i}`,
        telefone: `(11) 5555${i.toString().padStart(5, '0')}`,
        status: "novo",
      });
    }

    // Distribuir todos automaticamente (deve processar apenas 20)
    const result = await caller.distribution.distribuirTodosAutomatico();

    expect(result.success).toBe(20); // Limite do lote
    expect(result.failed).toBe(0);

    // Verificar que ainda há 10 leads não distribuídos
    const leadsRestantes = await db
      .select()
      .from(leads)
      .where(sql`${leads.corretorId} IS NULL`);

    expect(leadsRestantes.length).toBe(10);
  });
});
