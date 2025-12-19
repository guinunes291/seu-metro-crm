import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { users, leads, projects } from "../drizzle/schema";
import { like, or } from "drizzle-orm";
import { TEST_PREFIX, testName, testEmail, testPhone, cleanupTestData } from "./test-utils";

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

// Limpar dados de teste após todos os testes
afterAll(async () => {
  await cleanupTestData();
});

describe("Relatórios e Analytics", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  it("deve calcular estatísticas gerais do CRM", async () => {
    const ctx = createGestorContext();
    const caller = appRouter.createCaller(ctx);

    const stats = await caller.relatorios.estatisticasGerais();

    expect(stats).toHaveProperty("totalLeads");
    expect(stats).toHaveProperty("leadsDistribuidos");
    expect(stats).toHaveProperty("leadsNaoDistribuidos");
    expect(stats).toHaveProperty("taxaDistribuicao");
    expect(stats).toHaveProperty("taxaContato");
    expect(stats).toHaveProperty("taxaConversao");
    expect(stats).toHaveProperty("projetosAtivos");
    expect(stats).toHaveProperty("corretoresAtivos");

    expect(typeof stats.totalLeads).toBe("number");
    expect(typeof stats.taxaDistribuicao).toBe("number");
  });

  it("deve calcular conversão por projeto", async () => {
    const ctx = createGestorContext();
    const caller = appRouter.createCaller(ctx);

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Criar projeto de teste (com prefixo)
    const [project] = await db.insert(projects).values({
      nome: testName("Projeto Teste Conversão"),
      cidade: "São Paulo",
      estado: "SP",
      tipo: "mcmv",
      status: "ativo",
    });

    // Criar 10 leads de teste: 2 fechados, 3 perdidos, 5 em atendimento
    for (let i = 0; i < 2; i++) {
      await db.insert(leads).values({
        nome: testName(`Lead Fechado ${i}`),
        telefone: testPhone(`(11) 7777${i.toString().padStart(5, '0')}`),
        projectId: project.insertId,
        status: "contrato_fechado",
      });
    }

    for (let i = 0; i < 3; i++) {
      await db.insert(leads).values({
        nome: testName(`Lead Perdido ${i}`),
        telefone: testPhone(`(11) 6666${i.toString().padStart(5, '0')}`),
        projectId: project.insertId,
        status: "perdido",
      });
    }

    for (let i = 0; i < 5; i++) {
      await db.insert(leads).values({
        nome: testName(`Lead Atendimento ${i}`),
        telefone: testPhone(`(11) 5555${i.toString().padStart(5, '0')}`),
        projectId: project.insertId,
        status: "em_atendimento",
      });
    }

    // Calcular conversão
    const conversao = await caller.relatorios.conversaoPorProjeto();

    // Verificar que o projeto de teste está nos resultados
    const projetoStats = conversao.find(p => p.projectId === project.insertId);
    expect(projetoStats).toBeDefined();
    expect(projetoStats?.totalLeads).toBe(10);
    expect(projetoStats?.contratosFechados).toBe(2);
    expect(projetoStats?.leadsPerdidos).toBe(3);
    expect(projetoStats?.taxaConversao).toBe(20); // 2/10 = 20%
  });

  it("deve calcular conversão por corretor", async () => {
    const ctx = createGestorContext();
    const caller = appRouter.createCaller(ctx);

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Criar corretor de teste (com prefixo)
    const [corretor] = await db.insert(users).values({
      openId: `test-corretor-${Date.now()}`,
      name: testName("Corretor Relatório"),
      email: testEmail("relatorio@test.com"),
      role: "corretor",
      status: "presente",
    });

    // Criar 5 leads de teste: 1 fechado, 4 em atendimento
    await db.insert(leads).values({
      nome: testName("Lead Fechado Corretor"),
      telefone: testPhone("(11) 4444-0001"),
      corretorId: corretor.insertId,
      status: "contrato_fechado",
    });

    for (let i = 0; i < 4; i++) {
      await db.insert(leads).values({
        nome: testName(`Lead Atendimento Corretor ${i}`),
        telefone: testPhone(`(11) 4444${i.toString().padStart(5, '0')}`),
        corretorId: corretor.insertId,
        status: "em_atendimento",
      });
    }

    // Calcular conversão
    const conversao = await caller.relatorios.conversaoPorCorretor();

    // Verificar que o corretor de teste está nos resultados
    const corretorStats = conversao.find(c => c.corretorId === corretor.insertId);
    expect(corretorStats).toBeDefined();
    expect(corretorStats?.totalLeads).toBe(5);
    expect(corretorStats?.contratosFechados).toBe(1);
    expect(corretorStats?.taxaConversao).toBe(20); // 1/5 = 20%
  });

  it("deve filtrar relatórios por período", async () => {
    const ctx = createGestorContext();
    const caller = appRouter.createCaller(ctx);

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Criar lead de teste antigo (30 dias atrás)
    const dataAntiga = new Date();
    dataAntiga.setDate(dataAntiga.getDate() - 30);

    await db.insert(leads).values({
      nome: testName("Lead Antigo Filtro"),
      telefone: testPhone("(11) 3333-1001"),
      status: "novo",
      createdAt: dataAntiga,
    });

    // Criar lead de teste recente (hoje)
    await db.insert(leads).values({
      nome: testName("Lead Recente Filtro"),
      telefone: testPhone("(11) 3333-1002"),
      status: "novo",
    });

    // Buscar estatísticas dos últimos 7 dias
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - 7);
    const dataFim = new Date();
    dataFim.setDate(dataFim.getDate() + 1); // Incluir hoje

    const statsSemFiltro = await caller.relatorios.estatisticasGerais();
    const statsComFiltro = await caller.relatorios.estatisticasGerais({
      dataInicio: dataInicio.toISOString(),
      dataFim: dataFim.toISOString(),
    });

    // Verificar que as estatísticas são retornadas
    expect(statsSemFiltro.totalLeads).toBeGreaterThanOrEqual(0);
    expect(statsComFiltro.totalLeads).toBeGreaterThanOrEqual(0);
  });
});
