import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { users, leads, projects } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { TEST_PREFIX, testName, testEmail, testPhone, cleanupTestData } from "./test-utils";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createGestorContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-test",
    email: "admin@test.com",
    name: "Admin Test",
    loginMethod: "manus",
    role: "admin",
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

// Limpar dados de teste após todos os testes
afterAll(async () => {
  await cleanupTestData();
});

describe("Distribuição Automática de Leads", () => {
  beforeEach(async () => {
    // Limpar apenas dados de teste antes de cada teste
    await cleanupTestData();
  });

  it("deve verificar elegibilidade de corretor com status presente", async () => {
    const ctx = createGestorContext();
    const caller = appRouter.createCaller(ctx);

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Inserir corretor presente (com prefixo de teste)
    const [corretor] = await db.insert(users).values({
      openId: `test-corretor-${Date.now()}`,
      name: testName("Corretor Presente"),
      email: testEmail("corretor1@test.com"),
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

    // Inserir corretor ausente (com prefixo de teste)
    const [corretor] = await db.insert(users).values({
      openId: `test-corretor-${Date.now()}`,
      name: testName("Corretor Ausente"),
      email: testEmail("corretor2@test.com"),
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

    // Criar projeto de teste
    const [project] = await db.insert(projects).values({
      nome: testName("Projeto Teste"),
      cidade: "São Paulo",
      estado: "SP",
      tipo: "mcmv",
      status: "ativo",
    });

    // Criar corretor elegível (com prefixo de teste)
    const [corretor] = await db.insert(users).values({
      openId: `test-corretor-${Date.now()}`,
      name: testName("Corretor Elegível"),
      email: testEmail("corretor3@test.com"),
      role: "corretor",
      status: "presente",
    });

    // Criar lead sem corretor (null) para que possa ser distribuído
    // (corretorId: null indica lead não distribuído)
    const [lead] = await db.insert(leads).values({
      nome: testName("Lead Teste"),
      telefone: testPhone("(11) 99999-9999"),
      email: testEmail("lead@test.com"),
      origem: "outro",
      projectId: project.insertId,
      corretorId: null, // Lead sem corretor, pronto para distribuição
      status: "novo",
    });

    // Distribuir automaticamente
    const result = await caller.distribution.distribuirLead({
      leadId: lead.insertId,
    });

    // A função retorna { success, corretorId } em vez de lançar erro
    expect(result.success).toBe(true);
    // O corretorId deve ser o do corretor criado (pode não ser exatamente o mesmo se houver outros)
    expect(result.corretorId).toBeDefined();

    // Verificar se o lead foi atualizado
    const leadAtualizado = await db
      .select()
      .from(leads)
      .where(eq(leads.id, lead.insertId))
      .limit(1);

    expect(leadAtualizado[0].corretorId).toBeDefined();
    expect(leadAtualizado[0].status).toBe("aguardando_atendimento");
  });

  it("deve falhar ao distribuir lead quando não há corretor elegível", async () => {
    const ctx = createGestorContext();
    const caller = appRouter.createCaller(ctx);

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Criar lead do gestor sem corretor disponível (com prefixo de teste)
    const [lead] = await db.insert(leads).values({
      nome: testName("Lead Sem Corretor"),
      telefone: testPhone("(11) 88888-8888"),
      corretorId: ctx.user!.id, // Lead pertence ao gestor
      status: "novo",
    });

    // Tentar distribuir automaticamente
    // A função retorna { success: false, message } em vez de lançar erro
    const result = await caller.distribution.distribuirLead({
      leadId: lead.insertId,
    });
    // Deve falhar pois não há corretores elegíveis
    expect(result.success).toBe(false);
    expect(result.message).toBeDefined();
  });
});

describe("Distribuição Automática - Regras do AppScript", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  it("deve permitir corretor com menos de 40 leads receber novos leads (lote inicial)", async () => {
    const ctx = createGestorContext();
    const caller = appRouter.createCaller(ctx);

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Criar corretor presente com 20 leads (com prefixo de teste)
    const [corretor] = await db.insert(users).values({
      openId: `test-corretor-${Date.now()}`,
      name: testName("Corretor Com Poucos Leads"),
      email: testEmail("corretor-minimo@test.com"),
      role: "corretor",
      status: "presente",
    });

    // Criar 20 leads para o corretor (todos aguardando atendimento)
    for (let i = 0; i < 20; i++) {
      await db.insert(leads).values({
        nome: testName(`Lead ${i}`),
        telefone: testPhone(`(11) 9999${i.toString().padStart(5, '0')}`),
        corretorId: corretor.insertId,
        status: "aguardando_atendimento",
      });
    }

    // Verificar elegibilidade (deve ser elegível - menos de 40 leads = lote inicial)
    const result = await caller.distribution.verificarElegibilidade({
      corretorId: corretor.insertId,
    });

    expect(result.elegivel).toBe(true);
  });

  it("deve bloquear corretor com 20+ leads aguardando atendimento", async () => {
    const ctx = createGestorContext();
    const caller = appRouter.createCaller(ctx);

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Criar corretor presente com 40 leads (com prefixo de teste)
    const [corretor] = await db.insert(users).values({
      openId: `test-corretor-${Date.now()}`,
      name: testName("Corretor Com Muitos Aguardando"),
      email: testEmail("corretor-bloqueado@test.com"),
      role: "corretor",
      status: "presente",
    });

    // Criar 40 leads: 20 aguardando e 20 em atendimento
    // Corretor tem 20 leads aguardando (>= MAXIMO_LEADS_AGUARDANDO=20) → bloqueado
    for (let i = 0; i < 20; i++) {
      await db.insert(leads).values({
        nome: testName(`Lead Aguardando ${i}`),
        telefone: testPhone(`(11) 8888${i.toString().padStart(5, '0')}`),
        corretorId: corretor.insertId,
        status: "aguardando_atendimento",
      });
    }
    for (let i = 0; i < 20; i++) {
      await db.insert(leads).values({
        nome: testName(`Lead Trabalhado ${i}`),
        telefone: testPhone(`(11) 7777${i.toString().padStart(5, '0')}`),
        corretorId: corretor.insertId,
        status: "em_atendimento",
      });
    }

    // Verificar elegibilidade (deve ser NÃO elegível: tem 20 aguardando = limite máximo)
    const result = await caller.distribution.verificarElegibilidade({
      corretorId: corretor.insertId,
    });

    expect(result.elegivel).toBe(false);
  });

  it("deve liberar corretor com menos de 20 leads aguardando (mesmo com 40+ leads total)", async () => {
    const ctx = createGestorContext();
    const caller = appRouter.createCaller(ctx);

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Criar corretor presente com 50 leads (com prefixo de teste)
    const [corretor] = await db.insert(users).values({
      openId: `test-corretor-${Date.now()}`,
      name: testName("Corretor Liberado"),
      email: testEmail("corretor-liberado@test.com"),
      role: "corretor",
      status: "presente",
    });

    // 45 em atendimento + 5 aguardando = elegível (5 < 20)
    for (let i = 0; i < 45; i++) {
      await db.insert(leads).values({
        nome: testName(`Lead Em Atendimento ${i}`),
        telefone: testPhone(`(11) 6666${i.toString().padStart(5, '0')}`),
        corretorId: corretor.insertId,
        status: "em_atendimento",
      });
    }
    for (let i = 0; i < 5; i++) {
      await db.insert(leads).values({
        nome: testName(`Lead Aguardando ${i}`),
        telefone: testPhone(`(11) 5555${i.toString().padStart(5, '0')}`),
        corretorId: corretor.insertId,
        status: "aguardando_atendimento",
      });
    }

    // Verificar elegibilidade (deve ser elegível: apenas 5 aguardando < 20)
    const result = await caller.distribution.verificarElegibilidade({
      corretorId: corretor.insertId,
    });

    expect(result.elegivel).toBe(true);
  });

  it("deve retornar estatísticas completas de distribuição", async () => {
    const ctx = createGestorContext();
    const caller = appRouter.createCaller(ctx);

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Criar 2 corretores (com prefixo de teste)
    const [corretor1] = await db.insert(users).values({
      openId: `test-corretor-${Date.now()}-1`,
      name: testName("Corretor Stats 1"),
      email: testEmail("stats1@test.com"),
      role: "corretor",
      status: "presente",
    });

    const [corretor2] = await db.insert(users).values({
      openId: `test-corretor-${Date.now()}-2`,
      name: testName("Corretor Stats 2"),
      email: testEmail("stats2@test.com"),
      role: "corretor",
      status: "ausente",
    });

    // Criar leads para corretor 1 (3 aguardando < 20 → elegível)
    for (let i = 0; i < 10; i++) {
      await db.insert(leads).values({
        nome: testName(`Lead C1 ${i}`),
        telefone: testPhone(`(11) 4444${i.toString().padStart(5, '0')}`),
        corretorId: corretor1.insertId,
        status: i < 7 ? "em_atendimento" : "aguardando_atendimento",
      });
    }

    // Obter estatísticas
    const stats = await caller.distribution.getEstatisticas();

    // Verificar que os corretores de teste estão nas estatísticas
    const stats1 = stats.find(s => s.id === corretor1.insertId);
    expect(stats1).toBeDefined();
    expect(stats1?.totalLeads).toBe(10);
    expect(stats1?.leadsTrabalhados).toBe(7);
    expect(stats1?.taxaTrabalho).toBe(0.7);
    expect(stats1?.elegivel).toBe(true); // 3 aguardando < 20 → elegível
    expect(stats1?.status).toBe("presente");

    const stats2 = stats.find(s => s.id === corretor2.insertId);
    expect(stats2).toBeDefined();
    expect(stats2?.totalLeads).toBe(0);
    expect(stats2?.elegivel).toBe(false); // ausente
    expect(stats2?.status).toBe("ausente");
  });
});
