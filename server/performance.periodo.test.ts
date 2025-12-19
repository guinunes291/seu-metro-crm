import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { calcularPerformanceCorretor, calcularRankingCorretores } from "./performance";
import { getDb } from "./db";
import { users, leads, projects } from "../drizzle/schema";
import { eq, like, or } from "drizzle-orm";
import { TEST_PREFIX, testName, testEmail, testPhone, cleanupTestData } from "./test-utils";

describe("Performance - Filtro por Período", () => {
  let testCorretorId: number;
  let testProjetoId: number;

  // Limpar dados de teste após todos os testes
  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Limpar apenas dados de teste (com prefixo)
    await cleanupTestData();

    // Criar corretor de teste (com prefixo)
    const [corretor] = await db.insert(users).values({
      openId: `test-periodo-${Date.now()}`,
      name: testName("Corretor Teste Período"),
      email: testEmail("teste-periodo@example.com"),
      role: "corretor",
      status: "presente",
    });

    // Buscar ID do corretor criado
    const corretorCriado = await db.select().from(users).where(like(users.email, `${TEST_PREFIX}teste-periodo@example.com`)).limit(1);
    testCorretorId = corretorCriado[0].id;

    // Criar projeto de teste (com prefixo)
    const [projeto] = await db.insert(projects).values({
      nome: testName("Projeto Teste Período"),
      construtora: "Construtora Teste",
      zona: "sul",
      status: "ativo",
    });

    // Buscar ID do projeto criado
    const projetoCriado = await db.select().from(projects).where(like(projects.nome, `${TEST_PREFIX}Projeto Teste Período`)).limit(1);
    testProjetoId = projetoCriado[0].id;

    // Criar leads em diferentes períodos (com prefixo)
    const hoje = new Date();
    const doisDiasAtras = new Date(hoje);
    doisDiasAtras.setDate(hoje.getDate() - 2);
    const quinzeDiasAtras = new Date(hoje);
    quinzeDiasAtras.setDate(hoje.getDate() - 15);
    const doisMesesAtras = new Date(hoje);
    doisMesesAtras.setMonth(hoje.getMonth() - 2);

    // Lead recente (2 dias atrás - dentro da semana)
    await db.insert(leads).values({
      nome: testName("Lead Semana"),
      telefone: testPhone("11999999991"),
      projectId: testProjetoId,
      corretorId: testCorretorId,
      status: "contrato_fechado",
      createdAt: doisDiasAtras,
    });

    // Lead de 15 dias atrás (dentro do mês, fora da semana)
    await db.insert(leads).values({
      nome: testName("Lead Mês"),
      telefone: testPhone("11999999992"),
      projectId: testProjetoId,
      corretorId: testCorretorId,
      status: "contrato_fechado",
      createdAt: quinzeDiasAtras,
    });

    // Lead de 2 meses atrás (fora do mês)
    await db.insert(leads).values({
      nome: testName("Lead Antigo"),
      telefone: testPhone("11999999993"),
      projectId: testProjetoId,
      corretorId: testCorretorId,
      status: "novo",
      createdAt: doisMesesAtras,
    });
  });

  it("deve filtrar métricas por período de 7 dias", async () => {
    const hoje = new Date();
    const semanaAtras = new Date(hoje);
    semanaAtras.setDate(hoje.getDate() - 7);

    const metricas = await calcularPerformanceCorretor(testCorretorId, {
      dataInicio: semanaAtras,
      dataFim: hoje,
    });

    // Deve contar apenas o lead da última semana
    expect(metricas.totalLeads).toBe(1);
    expect(metricas.taxaConversao).toBe(100); // 1 convertido de 1 total
  });

  it("deve filtrar métricas por período de 30 dias", async () => {
    const hoje = new Date();
    const mesAtras = new Date(hoje);
    mesAtras.setMonth(hoje.getMonth() - 1);

    const metricas = await calcularPerformanceCorretor(testCorretorId, {
      dataInicio: mesAtras,
      dataFim: hoje,
    });

    // Deve contar leads da última semana + mês passado
    expect(metricas.totalLeads).toBe(2);
    expect(metricas.taxaConversao).toBe(100); // 2 convertidos de 2 total
  });

  it("deve retornar todos os leads quando não há filtro de período", async () => {
    const metricas = await calcularPerformanceCorretor(testCorretorId);

    // Deve contar todos os 3 leads de teste
    expect(metricas.totalLeads).toBe(3);
    expect(metricas.taxaConversao).toBeCloseTo(66.67, 1); // 2 convertidos de 3 total
  });

  it("deve filtrar ranking por período", async () => {
    const hoje = new Date();
    const semanaAtras = new Date(hoje);
    semanaAtras.setDate(hoje.getDate() - 7);

    const ranking = await calcularRankingCorretores({
      dataInicio: semanaAtras,
      dataFim: hoje,
    });

    const corretor = ranking.find((r) => r.corretorId === testCorretorId);
    expect(corretor).toBeDefined();
    expect(corretor?.totalLeads).toBe(1); // Apenas lead da última semana
    expect(corretor?.taxaConversao).toBe(100);
  });
});
