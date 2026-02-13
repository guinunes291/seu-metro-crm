import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { db } from "./db";
import { alertas, users, leads } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Sistema de Alertas", () => {
  let testCorretor: any;
  let testGestor: any;
  let testLead: any;
  
  beforeAll(async () => {
    // Criar corretor de teste
    const [corretor] = await db.insert(users).values({
      openId: "test-corretor-alertas",
      name: "Corretor Teste Alertas",
      email: "corretor-alertas@test.com",
      role: "corretor",
      status: "presente",
    }).returning();
    testCorretor = corretor;
    
    // Criar gestor de teste
    const [gestor] = await db.insert(users).values({
      openId: "test-gestor-alertas",
      name: "Gestor Teste Alertas",
      email: "gestor-alertas@test.com",
      role: "gestor",
      status: "presente",
    }).returning();
    testGestor = gestor;
    
    // Criar lead de teste
    const [lead] = await db.insert(leads).values({
      nome: "Lead Teste Alertas",
      telefone: "11999998888",
      email: "lead-alertas@test.com",
      origem: "manual",
      status: "aguardando_atendimento",
      corretorId: testCorretor.id,
    }).returning();
    testLead = lead;
  });
  
  afterAll(async () => {
    // Limpar dados de teste
    if (testLead) {
      await db.delete(leads).where(eq(leads.id, testLead.id));
    }
    if (testCorretor) {
      await db.delete(users).where(eq(users.id, testCorretor.id));
    }
    if (testGestor) {
      await db.delete(users).where(eq(users.id, testGestor.id));
    }
  });
  
  it("Gestor consegue enviar alerta para corretor", async () => {
    const caller = appRouter.createCaller({
      user: testGestor,
      db,
    });
    
    const result = await caller.alertas.enviar({
      leadId: testLead.id,
      corretorId: testCorretor.id,
    });
    
    expect(result.success).toBe(true);
    expect(result.alertaId).toBeDefined();
    
    // Limpar alerta criado
    if (result.alertaId) {
      await db.delete(alertas).where(eq(alertas.id, result.alertaId));
    }
  });
  
  it("Corretor consegue listar seus alertas não lidos", async () => {
    // Criar alerta de teste
    const [alerta] = await db.insert(alertas).values({
      corretorId: testCorretor.id,
      leadId: testLead.id,
      mensagem: "Alerta de teste",
      lido: false,
    }).returning();
    
    const caller = appRouter.createCaller({
      user: testCorretor,
      db,
    });
    
    const result = await caller.alertas.meus({
      apenasNaoLidos: true,
    });
    
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(a => a.id === alerta.id)).toBe(true);
    
    // Limpar alerta criado
    await db.delete(alertas).where(eq(alertas.id, alerta.id));
  });
  
  it("Corretor consegue marcar alerta como lido", async () => {
    // Criar alerta de teste
    const [alerta] = await db.insert(alertas).values({
      corretorId: testCorretor.id,
      leadId: testLead.id,
      mensagem: "Alerta de teste",
      lido: false,
    }).returning();
    
    const caller = appRouter.createCaller({
      user: testCorretor,
      db,
    });
    
    const result = await caller.alertas.marcarLido({
      id: alerta.id,
    });
    
    expect(result.success).toBe(true);
    
    // Verificar que foi marcado como lido
    const [alertaAtualizado] = await db
      .select()
      .from(alertas)
      .where(eq(alertas.id, alerta.id));
    
    expect(alertaAtualizado.lido).toBe(true);
    
    // Limpar alerta criado
    await db.delete(alertas).where(eq(alertas.id, alerta.id));
  });
  
  it("Corretor não vê alertas de outros corretores", async () => {
    // Criar outro corretor
    const [outroCorretor] = await db.insert(users).values({
      openId: "test-outro-corretor",
      name: "Outro Corretor",
      email: "outro@test.com",
      role: "corretor",
      status: "presente",
    }).returning();
    
    // Criar alerta para outro corretor
    const [alertaOutro] = await db.insert(alertas).values({
      corretorId: outroCorretor.id,
      leadId: testLead.id,
      mensagem: "Alerta de outro corretor",
      lido: false,
    }).returning();
    
    const caller = appRouter.createCaller({
      user: testCorretor,
      db,
    });
    
    const result = await caller.alertas.meus({
      apenasNaoLidos: true,
    });
    
    expect(result.every(a => a.id !== alertaOutro.id)).toBe(true);
    
    // Limpar dados criados
    await db.delete(alertas).where(eq(alertas.id, alertaOutro.id));
    await db.delete(users).where(eq(users.id, outroCorretor.id));
  });
});
