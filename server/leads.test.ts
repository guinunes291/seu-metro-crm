import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { leads, users, projects } from "../drizzle/schema";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createCorretorContext(corretorId: number = 2): TrpcContext {
  const user: AuthenticatedUser = {
    id: corretorId,
    openId: `corretor-${corretorId}`,
    email: `corretor${corretorId}@test.com`,
    name: `Corretor ${corretorId}`,
    loginMethod: "manus",
    role: "corretor",
    status: "presente",
    telefone: "(11) 98888-8888",
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

describe("Interface de Leads para Corretores", () => {
  it("deve listar apenas os leads do corretor autenticado", async () => {
    const ctx = createCorretorContext(2);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.leads.list();

    // Deve retornar apenas leads do corretor 2
    expect(Array.isArray(result)).toBe(true);
    
    // Todos os leads retornados devem pertencer ao corretor autenticado
    result.forEach((lead: any) => {
      if (lead.corretorId) {
        expect(lead.corretorId).toBe(2);
      }
    });
  });

  it("deve permitir corretor atualizar status do seu próprio lead", async () => {
    const db = await getDb();
    if (!db) {
      console.warn("Database não disponível, pulando teste");
      return;
    }

    // Criar um lead de teste para o corretor 2
    const [testLead] = await db.insert(leads).values({
      nome: "Lead Teste Corretor",
      telefone: "(11) 99999-9999",
      corretorId: 2,
      status: "novo",
    });

    const ctx = createCorretorContext(2);
    const caller = appRouter.createCaller(ctx);

    // Atualizar status
    const result = await caller.leads.update({
      id: testLead.insertId,
      data: { status: "em_atendimento" },
    });

    expect(result.success).toBe(true);

    // Limpar dados de teste
    await db.delete(leads).where({ id: testLead.insertId } as any);
  });

  it("deve permitir corretor adicionar interação ao seu lead", async () => {
    const db = await getDb();
    if (!db) {
      console.warn("Database não disponível, pulando teste");
      return;
    }

    // Criar um lead de teste para o corretor 2
    const [testLead] = await db.insert(leads).values({
      nome: "Lead Teste Interação",
      telefone: "(11) 99999-9998",
      corretorId: 2,
      status: "novo",
    });

    const ctx = createCorretorContext(2);
    const caller = appRouter.createCaller(ctx);

    // Adicionar interação
    const result = await caller.leads.addInteraction({
      leadId: testLead.insertId,
      tipo: "whatsapp",
      resultado: "contato_realizado",
      observacoes: "Cliente interessado no projeto",
    });

    expect(result.success).toBe(true);

    // Limpar dados de teste
    await db.delete(leads).where({ id: testLead.insertId } as any);
  });

  it("deve retornar histórico de interações do lead", async () => {
    const db = await getDb();
    if (!db) {
      console.warn("Database não disponível, pulando teste");
      return;
    }

    // Criar um lead de teste para o corretor 2
    const [testLead] = await db.insert(leads).values({
      nome: "Lead Teste Histórico",
      telefone: "(11) 99999-9997",
      corretorId: 2,
      status: "novo",
    });

    const ctx = createCorretorContext(2);
    const caller = appRouter.createCaller(ctx);

    // Adicionar interação
    await caller.leads.addInteraction({
      leadId: testLead.insertId,
      tipo: "ligacao",
      resultado: "nao_atendeu",
      observacoes: "Não atendeu a ligação",
    });

    // Buscar histórico
    const history = await caller.leads.getHistory({
      leadId: testLead.insertId,
    });

    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].tipo).toBe("ligacao");
    expect(history[0].resultado).toBe("nao_atendeu");

    // Limpar dados de teste
    await db.delete(leads).where({ id: testLead.insertId } as any);
  });

  it("gestor deve ver todos os leads, corretor apenas os seus", async () => {
    const gestorCtx = createGestorContext();
    const gestorCaller = appRouter.createCaller(gestorCtx);

    const corretorCtx = createCorretorContext(2);
    const corretorCaller = appRouter.createCaller(corretorCtx);

    const gestorLeads = await gestorCaller.leads.list();
    const corretorLeads = await corretorCaller.leads.list();

    // Gestor pode ver todos os leads (ou pelo menos >= leads do corretor)
    expect(gestorLeads.length).toBeGreaterThanOrEqual(corretorLeads.length);

    // Corretor vê apenas seus leads
    corretorLeads.forEach((lead: any) => {
      if (lead.corretorId) {
        expect(lead.corretorId).toBe(2);
      }
    });
  });
});
