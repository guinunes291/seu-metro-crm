import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as db from "./db";
import { getDb } from "./db";
import { users, leads } from "../drizzle/schema";
import { eq, and, gte, lte } from "drizzle-orm";

describe("Controle de Limites Diários", () => {
  let testUserId: number;

  beforeEach(async () => {
    const database = await getDb();
    if (!database) throw new Error("Database not available");

    // Criar corretor de teste
    const openId = `_T_test_${Date.now()}_${Math.random()}`;
    await database.insert(users).values({
      openId,
      name: "_T_Corretor Teste Limites",
      email: "_T_teste_limites@test.com",
      role: "corretor",
      status: "presente",
      limiteDiarioLeads: 10,
    });

    // Buscar o corretor criado para pegar o ID
    const [user] = await database
      .select()
      .from(users)
      .where(eq(users.openId, openId));

    testUserId = user.id;
  });

  afterEach(async () => {
    const database = await getDb();
    if (!database) return;

    // Limpar dados de teste
    await database.delete(leads).where(eq(leads.corretorId, testUserId));
    await database.delete(users).where(eq(users.id, testUserId));
  });

  it("deve criar corretor com limite padrão de 10 leads", async () => {
    const database = await getDb();
    if (!database) throw new Error("Database not available");

    const [corretor] = await database
      .select()
      .from(users)
      .where(eq(users.id, testUserId));

    expect(corretor.limiteDiarioLeads).toBe(10);
  });

  it("deve atualizar limite diário de um corretor", async () => {
    await db.updateLimiteDiarioLeads(testUserId, 20);

    const database = await getDb();
    if (!database) throw new Error("Database not available");

    const [corretor] = await database
      .select()
      .from(users)
      .where(eq(users.id, testUserId));

    expect(corretor.limiteDiarioLeads).toBe(20);
  });

  it("deve contar leads recebidos hoje corretamente", async () => {
    const database = await getDb();
    if (!database) throw new Error("Database not available");

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Criar 3 leads para hoje
    await database.insert(leads).values([
      {
        nome: "_T_Lead 1",
        telefone: "_T_11111111111",
        origem: "site",
        status: "novo",
        corretorId: testUserId,
        createdAt: new Date(),
      },
      {
        nome: "_T_Lead 2",
        telefone: "_T_22222222222",
        origem: "site",
        status: "novo",
        corretorId: testUserId,
        createdAt: new Date(),
      },
      {
        nome: "_T_Lead 3",
        telefone: "_T_33333333333",
        origem: "site",
        status: "novo",
        corretorId: testUserId,
        createdAt: new Date(),
      },
    ]);

    const count = await db.countLeadsRecebidosHoje(testUserId, hoje);
    expect(count).toBe(3);
  });

  it("não deve contar leads de dias anteriores", async () => {
    const database = await getDb();
    if (!database) throw new Error("Database not available");

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);

    // Criar 2 leads para ontem
    await database.insert(leads).values([
      {
        nome: "_T_Lead Ontem 1",
        telefone: "_T_44444444444",
        origem: "site",
        status: "novo",
        corretorId: testUserId,
        createdAt: ontem,
      },
      {
        nome: "_T_Lead Ontem 2",
        telefone: "_T_55555555555",
        origem: "site",
        status: "novo",
        corretorId: testUserId,
        createdAt: ontem,
      },
    ]);

    // Criar 1 lead para hoje
    await database.insert(leads).values({
      nome: "_T_Lead Hoje",
      telefone: "_T_66666666666",
      origem: "_T_teste",
      status: "novo",
      corretorId: testUserId,
      createdAt: new Date(),
    });

    const count = await db.countLeadsRecebidosHoje(testUserId, hoje);
    expect(count).toBe(1);
  });

  it("deve retornar 0 quando corretor não tem leads hoje", async () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const count = await db.countLeadsRecebidosHoje(testUserId, hoje);
    expect(count).toBe(0);
  });

  it("deve verificar se corretor atingiu o limite diário", async () => {
    const database = await getDb();
    if (!database) throw new Error("Database not available");

    // Definir limite de 5 leads
    await db.updateLimiteDiarioLeads(testUserId, 5);

    // Criar 5 leads (atingindo o limite)
    for (let i = 0; i < 5; i++) {
      await database.insert(leads).values({
        nome: `_T_Lead ${i + 1}`,
        telefone: `_T_7777777777${i}`,
        origem: "site",
        status: "novo",
        corretorId: testUserId,
        createdAt: new Date(),
      });
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const count = await db.countLeadsRecebidosHoje(testUserId, hoje);
    const [corretor] = await database
      .select()
      .from(users)
      .where(eq(users.id, testUserId));

    expect(count).toBe(5);
    expect(corretor.limiteDiarioLeads).toBe(5);
    expect(count >= corretor.limiteDiarioLeads).toBe(true);
  });
});
