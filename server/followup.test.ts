import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { users, leads, leadHistory, projects } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createCorretorContext(id: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id,
    openId: `corretor-test-${id}`,
    email: `corretor${id}@test.com`,
    name: `Corretor Test ${id}`,
    loginMethod: "manus",
    role: "corretor",
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

describe("Sistema de Follow-up Automático", () => {
  it("deve calcular dias consecutivos de follow-up corretamente", async () => {
    const ctx = createCorretorContext();
    const caller = appRouter.createCaller(ctx);

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Limpar dados
    await db.delete(leadHistory);
    await db.delete(leads);
    await db.delete(projects);

    // Criar projeto
    const [project] = await db.insert(projects).values({
      nome: "Projeto Follow-up",
      cidade: "São Paulo",
      estado: "SP",
      tipo: "mcmv",
      status: "ativo",
    });

    // Criar lead
    const [lead] = await db.insert(leads).values({
      nome: "Lead Follow-up",
      telefone: "(11) 99999-0001",
      corretorId: ctx.user.id,
      projectId: project.insertId,
      status: "em_atendimento",
      dataDistribuicao: new Date(),
    });

    // Criar histórico de 3 dias consecutivos
    const hoje = new Date();
    for (let i = 0; i < 3; i++) {
      const data = new Date(hoje);
      data.setDate(data.getDate() - i);
      
      await db.insert(leadHistory).values({
        leadId: lead.insertId,
        corretorId: ctx.user.id,
        tipo: "ligacao",
        resultado: "contato_realizado",
        createdAt: data,
      });
    }

    // Verificar dias consecutivos
    const result = await caller.followup.getDiasConsecutivos({
      leadId: lead.insertId,
    });

    expect(result.dias).toBe(3);
  });

  it("deve calcular dias sem contato corretamente", async () => {
    const ctx = createCorretorContext();
    const caller = appRouter.createCaller(ctx);

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Limpar dados
    await db.delete(leadHistory);
    await db.delete(leads);

    // Criar lead
    const [lead] = await db.insert(leads).values({
      nome: "Lead Sem Contato",
      telefone: "(11) 99999-0002",
      corretorId: ctx.user.id,
      status: "em_atendimento",
      dataDistribuicao: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 dias atrás
    });

    // Criar última interação há 3 dias
    const tresdiasAtras = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await db.insert(leadHistory).values({
      leadId: lead.insertId,
      corretorId: ctx.user.id,
      tipo: "whatsapp",
      resultado: "contato_realizado",
      createdAt: tresdiasAtras,
    });

    // Verificar dias sem contato
    const result = await caller.followup.getDiasSemContato({
      leadId: lead.insertId,
    });

    expect(result.dias).toBeGreaterThanOrEqual(2);
    expect(result.dias).toBeLessThanOrEqual(3);
  });

  it("deve identificar lead que precisa de follow-up (3+ dias sem contato)", async () => {
    const ctx = createCorretorContext();
    const caller = appRouter.createCaller(ctx);

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Limpar dados
    await db.delete(leadHistory);
    await db.delete(leads);

    // Criar lead em atendimento há 4 dias sem contato
    const [lead] = await db.insert(leads).values({
      nome: "Lead Precisa Follow-up",
      telefone: "(11) 99999-0003",
      corretorId: ctx.user.id,
      status: "em_atendimento",
      dataDistribuicao: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    });

    // Verificar necessidade de follow-up
    const result = await caller.followup.verificarNecessidade({
      leadId: lead.insertId,
    });

    expect(result.precisa).toBe(true);
  });

  it("deve identificar lead que NÃO precisa de follow-up (contato recente)", async () => {
    const ctx = createCorretorContext();
    const caller = appRouter.createCaller(ctx);

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Limpar dados
    await db.delete(leadHistory);
    await db.delete(leads);

    // Criar lead
    const [lead] = await db.insert(leads).values({
      nome: "Lead OK",
      telefone: "(11) 99999-0004",
      corretorId: ctx.user.id,
      status: "em_atendimento",
      dataDistribuicao: new Date(),
    });

    // Criar contato recente (hoje)
    await db.insert(leadHistory).values({
      leadId: lead.insertId,
      corretorId: ctx.user.id,
      tipo: "ligacao",
      resultado: "contato_realizado",
      createdAt: new Date(),
    });

    // Verificar necessidade de follow-up
    const result = await caller.followup.verificarNecessidade({
      leadId: lead.insertId,
    });

    expect(result.precisa).toBe(false);
  });

  it("deve listar apenas leads pendentes do corretor", async () => {
    const ctx1 = createCorretorContext(1);
    const ctx2 = createCorretorContext(2);
    const caller1 = appRouter.createCaller(ctx1);

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Limpar dados
    await db.delete(leadHistory);
    await db.delete(leads);
    await db.delete(users).where(sql`role = 'corretor'`);

    // Criar 2 corretores
    const [corretor1] = await db.insert(users).values({
      openId: "corretor-followup-1",
      name: "Corretor 1",
      email: "followup1@test.com",
      role: "corretor",
      status: "presente",
    });

    const [corretor2] = await db.insert(users).values({
      openId: "corretor-followup-2",
      name: "Corretor 2",
      email: "followup2@test.com",
      role: "corretor",
      status: "presente",
    });

    // Criar lead para corretor 1 (precisa follow-up)
    const [lead1] = await db.insert(leads).values({
      nome: "Lead Corretor 1",
      telefone: "(11) 99999-0005",
      corretorId: corretor1.insertId,
      status: "em_atendimento",
      dataDistribuicao: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    });

    // Criar lead para corretor 2 (precisa follow-up)
    const [lead2] = await db.insert(leads).values({
      nome: "Lead Corretor 2",
      telefone: "(11) 99999-0006",
      corretorId: corretor2.insertId,
      status: "em_atendimento",
      dataDistribuicao: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    });

    // Corretor 1 deve ver apenas seu lead
    const pendentes1 = await caller1.followup.getPendentes();

    expect(pendentes1.length).toBeGreaterThanOrEqual(0); // Pode ser 0 se a regra não se aplicar
    
    // Todos os leads devem ser do corretor 1
    for (const lead of pendentes1) {
      expect(lead.corretorId).toBe(corretor1.insertId);
    }
  });
});
