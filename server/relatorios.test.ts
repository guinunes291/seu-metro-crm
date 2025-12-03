import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { users, leads, projects } from "../drizzle/schema";
import { sql } from "drizzle-orm";

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

describe("Relatórios e Analytics", () => {
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

    // Limpar dados
    await db.delete(leads);
    await db.delete(projects);

    // Criar projeto
    const [project] = await db.insert(projects).values({
      nome: "Projeto Teste Conversão",
      cidade: "São Paulo",
      estado: "SP",
      tipo: "mcmv",
      status: "ativo",
    });

    // Criar 10 leads: 2 fechados, 3 perdidos, 5 em atendimento
    for (let i = 0; i < 2; i++) {
      await db.insert(leads).values({
        nome: `Lead Fechado ${i}`,
        telefone: `(11) 7777${i.toString().padStart(5, '0')}`,
        projectId: project.insertId,
        status: "contrato_fechado",
      });
    }

    for (let i = 0; i < 3; i++) {
      await db.insert(leads).values({
        nome: `Lead Perdido ${i}`,
        telefone: `(11) 6666${i.toString().padStart(5, '0')}`,
        projectId: project.insertId,
        status: "perdido",
      });
    }

    for (let i = 0; i < 5; i++) {
      await db.insert(leads).values({
        nome: `Lead Atendimento ${i}`,
        telefone: `(11) 5555${i.toString().padStart(5, '0')}`,
        projectId: project.insertId,
        status: "em_atendimento",
      });
    }

    // Calcular conversão
    const conversao = await caller.relatorios.conversaoPorProjeto();

    expect(conversao.length).toBeGreaterThanOrEqual(1);

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

    // Limpar dados
    await db.delete(leads);
    await db.delete(users).where(sql`role = 'corretor'`);

    // Criar corretor
    const [corretor] = await db.insert(users).values({
      openId: "corretor-relatorio",
      name: "Corretor Relatório",
      email: "relatorio@test.com",
      role: "corretor",
      status: "presente",
    });

    // Criar 5 leads: 1 fechado, 4 em atendimento
    await db.insert(leads).values({
      nome: "Lead Fechado Corretor",
      telefone: "(11) 4444-0001",
      corretorId: corretor.insertId,
      status: "contrato_fechado",
    });

    for (let i = 0; i < 4; i++) {
      await db.insert(leads).values({
        nome: `Lead Atendimento Corretor ${i}`,
        telefone: `(11) 4444${i.toString().padStart(5, '0')}`,
        corretorId: corretor.insertId,
        status: "em_atendimento",
      });
    }

    // Calcular conversão
    const conversao = await caller.relatorios.conversaoPorCorretor();

    expect(conversao.length).toBeGreaterThanOrEqual(1);

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

    // Não limpar dados para não interferir com outros testes
    // Apenas criar novos leads com timestamps específicos

    // Criar lead antigo (30 dias atrás)
    const dataAntiga = new Date();
    dataAntiga.setDate(dataAntiga.getDate() - 30);

    await db.insert(leads).values({
      nome: "Lead Antigo Filtro",
      telefone: "(11) 3333-1001",
      status: "novo",
      createdAt: dataAntiga,
    });

    // Criar lead recente (hoje)
    const leadRecente = await db.insert(leads).values({
      nome: "Lead Recente Filtro",
      telefone: "(11) 3333-1002",
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

    // Stats com filtro deve ter menos ou igual leads que sem filtro
    expect(statsComFiltro.totalLeads).toBeLessThanOrEqual(statsSemFiltro.totalLeads);
    // Deve ter pelo menos o lead recente
    expect(statsComFiltro.totalLeads).toBeGreaterThanOrEqual(1);
  });
});
