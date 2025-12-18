import { describe, it, expect, beforeEach } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';
import { getDb } from './db';
import { leads } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createCorretorContext(corretorId: number = 2): TrpcContext {
  const user: AuthenticatedUser = {
    id: corretorId,
    openId: `corretor-kanban-${corretorId}`,
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

describe('Kanban - Atualização de Status de Leads', () => {
  it('deve atualizar status do lead de "novo" para "em_atendimento"', async () => {
    const db = await getDb();
    if (!db) {
      console.warn("Database não disponível, pulando teste");
      return;
    }

    // Criar um lead de teste
    const [testLead] = await db.insert(leads).values({
      nome: "Lead Kanban Test 1",
      telefone: "(11) 99999-0001",
      corretorId: 2,
      status: "novo",
    });

    const ctx = createCorretorContext(2);
    const caller = appRouter.createCaller(ctx);

    // Atualizar status via procedure
    const result = await caller.leads.update({
      id: testLead.insertId,
      data: { status: "em_atendimento" },
    });

    expect(result.success).toBe(true);

    // Verificar atualização no banco
    const [updatedLead] = await db.select().from(leads).where(eq(leads.id, testLead.insertId));
    expect(updatedLead.status).toBe("em_atendimento");

    // Limpar dados de teste
    await db.delete(leads).where(eq(leads.id, testLead.insertId));
  });

  it('deve atualizar status do lead de "em_atendimento" para "agendado"', async () => {
    const db = await getDb();
    if (!db) {
      console.warn("Database não disponível, pulando teste");
      return;
    }

    // Criar um lead de teste com status em_atendimento
    const [testLead] = await db.insert(leads).values({
      nome: "Lead Kanban Test 2",
      telefone: "(11) 99999-0002",
      corretorId: 2,
      status: "em_atendimento",
    });

    const ctx = createCorretorContext(2);
    const caller = appRouter.createCaller(ctx);

    // Atualizar status via procedure
    const result = await caller.leads.update({
      id: testLead.insertId,
      data: { status: "agendado" },
    });

    expect(result.success).toBe(true);

    // Verificar atualização no banco
    const [updatedLead] = await db.select().from(leads).where(eq(leads.id, testLead.insertId));
    expect(updatedLead.status).toBe("agendado");

    // Limpar dados de teste
    await db.delete(leads).where(eq(leads.id, testLead.insertId));
  });

  it('deve atualizar status do lead para "contrato_fechado"', async () => {
    const db = await getDb();
    if (!db) {
      console.warn("Database não disponível, pulando teste");
      return;
    }

    // Criar um lead de teste
    const [testLead] = await db.insert(leads).values({
      nome: "Lead Kanban Test 3",
      telefone: "(11) 99999-0003",
      corretorId: 2,
      status: "agendado",
    });

    const ctx = createCorretorContext(2);
    const caller = appRouter.createCaller(ctx);

    // Atualizar status via procedure
    const result = await caller.leads.update({
      id: testLead.insertId,
      data: { status: "contrato_fechado" },
    });

    expect(result.success).toBe(true);

    // Verificar atualização no banco
    const [updatedLead] = await db.select().from(leads).where(eq(leads.id, testLead.insertId));
    expect(updatedLead.status).toBe("contrato_fechado");

    // Limpar dados de teste
    await db.delete(leads).where(eq(leads.id, testLead.insertId));
  });

  it('deve atualizar status do lead para "perdido"', async () => {
    const db = await getDb();
    if (!db) {
      console.warn("Database não disponível, pulando teste");
      return;
    }

    // Criar um lead de teste
    const [testLead] = await db.insert(leads).values({
      nome: "Lead Kanban Test 4",
      telefone: "(11) 99999-0004",
      corretorId: 2,
      status: "em_atendimento",
    });

    const ctx = createCorretorContext(2);
    const caller = appRouter.createCaller(ctx);

    // Atualizar status via procedure
    const result = await caller.leads.update({
      id: testLead.insertId,
      data: { status: "perdido" },
    });

    expect(result.success).toBe(true);

    // Verificar atualização no banco
    const [updatedLead] = await db.select().from(leads).where(eq(leads.id, testLead.insertId));
    expect(updatedLead.status).toBe("perdido");

    // Limpar dados de teste
    await db.delete(leads).where(eq(leads.id, testLead.insertId));
  });

  it('deve manter outros campos do lead inalterados ao atualizar status', async () => {
    const db = await getDb();
    if (!db) {
      console.warn("Database não disponível, pulando teste");
      return;
    }

    // Criar um lead de teste com dados completos
    const [testLead] = await db.insert(leads).values({
      nome: "Lead Kanban Test 5",
      telefone: "(11) 99999-0005",
      email: "kanban-test@example.com",
      corretorId: 2,
      status: "novo",
      origem: "Teste Kanban",
    });

    // Buscar lead antes da atualização
    const [leadBefore] = await db.select().from(leads).where(eq(leads.id, testLead.insertId));

    const ctx = createCorretorContext(2);
    const caller = appRouter.createCaller(ctx);

    // Atualizar apenas o status
    await caller.leads.update({
      id: testLead.insertId,
      data: { status: "visita_realizada" },
    });

    // Verificar que outros campos não foram alterados
    const [leadAfter] = await db.select().from(leads).where(eq(leads.id, testLead.insertId));
    
    expect(leadAfter.nome).toBe(leadBefore.nome);
    expect(leadAfter.telefone).toBe(leadBefore.telefone);
    expect(leadAfter.email).toBe(leadBefore.email);
    expect(leadAfter.corretorId).toBe(leadBefore.corretorId);
    expect(leadAfter.origem).toBe(leadBefore.origem);
    expect(leadAfter.status).toBe("visita_realizada");

    // Limpar dados de teste
    await db.delete(leads).where(eq(leads.id, testLead.insertId));
  });

  it('deve permitir transição entre todos os status do Kanban', async () => {
    const db = await getDb();
    if (!db) {
      console.warn("Database não disponível, pulando teste");
      return;
    }

    // Criar um lead de teste
    const [testLead] = await db.insert(leads).values({
      nome: "Lead Kanban Test 6",
      telefone: "(11) 99999-0006",
      corretorId: 2,
      status: "novo",
    });

    const ctx = createCorretorContext(2);
    const caller = appRouter.createCaller(ctx);

    // Lista de status do Kanban
    const statusList = [
      "aguardando_atendimento",
      "em_atendimento",
      "agendado",
      "visita_realizada",
      "analise_credito",
      "contrato_fechado",
    ];

    // Testar transição para cada status
    for (const status of statusList) {
      const result = await caller.leads.update({
        id: testLead.insertId,
        data: { status: status as any },
      });

      expect(result.success).toBe(true);

      // Verificar no banco
      const [lead] = await db.select().from(leads).where(eq(leads.id, testLead.insertId));
      expect(lead.status).toBe(status);
    }

    // Limpar dados de teste
    await db.delete(leads).where(eq(leads.id, testLead.insertId));
  });
});
