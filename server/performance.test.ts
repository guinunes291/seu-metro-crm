import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { calcularPerformanceCorretor, calcularRankingCorretores } from "./performance";
import { getDb } from "./db";
import { leads, users, projects } from "../drizzle/schema";
import { eq, like, or } from "drizzle-orm";

describe("Performance - Cálculos de Métricas", () => {
  let testCorretor: any;
  let testProject: any;
  const createdUserOpenIds: string[] = [];
  const createdProjectNames: string[] = [];

  afterEach(async () => {
    const db = await getDb();
    if (!db) return;
    // Limpar usuários de teste criados neste teste
    for (const openId of createdUserOpenIds) {
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.openId, openId)).limit(1);
      if (u) {
        await db.delete(leads).where(eq(leads.corretorId, u.id));
        await db.delete(users).where(eq(users.id, u.id));
      }
    }
    // Limpar projetos de teste
    for (const nome of createdProjectNames) {
      await db.delete(projects).where(eq(projects.nome, nome));
    }
    createdUserOpenIds.length = 0;
    createdProjectNames.length = 0;
    // Limpeza extra: remover qualquer usuário com email @test.com criado por este describe
    await db.delete(leads).where(like(leads.email, '%@test.com'));
    const testUsersLeft = await db.select({ id: users.id }).from(users).where(like(users.email, '%@test.com'));
    for (const u of testUsersLeft) {
      await db.delete(leads).where(eq(leads.corretorId, u.id));
      await db.delete(users).where(eq(users.id, u.id));
    }
  });

  beforeEach(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const uniqueId = Date.now();

    // Criar corretor de teste
    const openId = `test-corretor-${uniqueId}`;
    await db.insert(users).values({
      openId,
      name: "Corretor Teste Performance",
      email: `corretor-perf-${uniqueId}@test.com`,
      role: "corretor",
    });
    createdUserOpenIds.push(openId);
    
    const corretorResult = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    testCorretor = corretorResult[0];

    // Criar projeto de teste
    const projetoNome = `Projeto Teste Performance ${uniqueId}`;
    await db.insert(projects).values({
      nome: projetoNome,
      construtora: "CURY",
      zona: "sul",
      status: "ativo",
    });
    createdProjectNames.push(projetoNome);
    
    const projectResult = await db.select().from(projects).where(eq(projects.nome, projetoNome)).limit(1);
    testProject = projectResult[0];
  });

  it("deve calcular corretamente a taxa de conversão", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar 10 leads: 3 convertidos, 2 perdidos, 5 em atendimento
    for (let i = 0; i < 3; i++) {
      await db.insert(leads).values({
        nome: `Lead Convertido ${i}`,
        telefone: `11999${i}${i}${i}${i}${i}${i}`,
        corretorId: testCorretor.id,
        projectId: testProject.id,
        status: "contrato_fechado",
      });
    }

    for (let i = 0; i < 2; i++) {
      await db.insert(leads).values({
        nome: `Lead Perdido ${i}`,
        telefone: `11998${i}${i}${i}${i}${i}${i}`,
        corretorId: testCorretor.id,
        projectId: testProject.id,
        status: "perdido",
      });
    }

    for (let i = 0; i < 5; i++) {
      await db.insert(leads).values({
        nome: `Lead Atendimento ${i}`,
        telefone: `11997${i}${i}${i}${i}${i}${i}`,
        corretorId: testCorretor.id,
        projectId: testProject.id,
        status: "em_atendimento",
      });
    }

    const performance = await calcularPerformanceCorretor(testCorretor.id);

    expect(performance.totalLeads).toBe(10);
    expect(performance.leadsConvertidos).toBe(3);
    expect(performance.leadsPerdidos).toBe(2);
    expect(performance.taxaConversao).toBe(30); // 3/10 = 30%
  });

  it("deve retornar taxa de conversão 0% quando não há leads", async () => {
    const performance = await calcularPerformanceCorretor(testCorretor.id);

    expect(performance.totalLeads).toBe(0);
    expect(performance.leadsConvertidos).toBe(0);
    expect(performance.taxaConversao).toBe(0);
  });

  it("deve calcular corretamente leads por status", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar leads com diferentes status
    await db.insert(leads).values({
      nome: "Lead Novo",
      telefone: "11999111111",
      corretorId: testCorretor.id,
      status: "novo",
    });

    await db.insert(leads).values({
      nome: "Lead Atendimento",
      telefone: "11999222222",
      corretorId: testCorretor.id,
      status: "em_atendimento",
    });

    await db.insert(leads).values({
      nome: "Lead Convertido",
      telefone: "11999333333",
      corretorId: testCorretor.id,
      status: "contrato_fechado",
    });

    const performance = await calcularPerformanceCorretor(testCorretor.id);

    expect(performance.leadsPorStatus).toHaveLength(3);
    expect(performance.leadsPorStatus.find(s => s.status === "novo")?.count).toBe(1);
    expect(performance.leadsPorStatus.find(s => s.status === "em_atendimento")?.count).toBe(1);
    expect(performance.leadsPorStatus.find(s => s.status === "contrato_fechado")?.count).toBe(1);
  });

  it("deve calcular corretamente leads por projeto", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar 5 leads no projeto de teste
    for (let i = 0; i < 5; i++) {
      await db.insert(leads).values({
        nome: `Lead Projeto ${i}`,
        telefone: `11996${i}${i}${i}${i}${i}${i}`,
        corretorId: testCorretor.id,
        projectId: testProject.id,
        status: i < 2 ? "contrato_fechado" : "em_atendimento",
      });
    }

    const performance = await calcularPerformanceCorretor(testCorretor.id);

    expect(performance.leadsPorProjeto).toHaveLength(1);
    expect(performance.leadsPorProjeto[0].count).toBe(5);
    expect(performance.leadsPorProjeto[0].convertidos).toBe(2);
  });

  it("deve calcular ranking de corretores corretamente", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar segundo corretor
    const uniqueId2 = Date.now() + 1000;
    await db.insert(users).values({
      openId: `test-corretor-2-${uniqueId2}`,
      name: "Corretor 2",
      email: `corretor2-${uniqueId2}@test.com`,
      role: "corretor",
    });
    
    const corretor2Result = await db.select().from(users).where(eq(users.openId, `test-corretor-2-${uniqueId2}`)).limit(1);
    const testCorretor2 = corretor2Result[0];

    // Corretor 1: 10 leads, 5 convertidos (50%)
    for (let i = 0; i < 10; i++) {
      await db.insert(leads).values({
        nome: `Lead C1 ${i}`,
        telefone: `11995${i}${i}${i}${i}${i}${i}`,
        corretorId: testCorretor.id,
        status: i < 5 ? "contrato_fechado" : "em_atendimento",
      });
    }

    // Corretor 2: 10 leads, 3 convertidos (30%)
    for (let i = 0; i < 10; i++) {
      await db.insert(leads).values({
        nome: `Lead C2 ${i}`,
        telefone: `11994${i}${i}${i}${i}${i}${i}`,
        corretorId: testCorretor2.id,
        status: i < 3 ? "contrato_fechado" : "em_atendimento",
      });
    }

    const ranking = await calcularRankingCorretores();

    expect(ranking.length).toBeGreaterThanOrEqual(2);
    
    // Verificar ordenação (maior taxa de conversão primeiro)
    const corretor1Rank = ranking.find(r => r.corretorId === testCorretor.id);
    const corretor2Rank = ranking.find(r => r.corretorId === testCorretor2.id);

    expect(corretor1Rank).toBeDefined();
    expect(corretor2Rank).toBeDefined();
    expect(corretor1Rank!.taxaConversao).toBe(50);
    expect(corretor2Rank!.taxaConversao).toBe(30);
    expect(corretor1Rank!.posicao).toBeLessThan(corretor2Rank!.posicao);
  });

  it("deve atribuir posições corretas no ranking", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar 3 corretores com diferentes taxas de conversão
    const corretores = [];
    const baseId = Date.now();
    for (let c = 0; c < 3; c++) {
      await db.insert(users).values({
        openId: `test-corretor-rank-${c}-${baseId}`,
        name: `Corretor Rank ${c}`,
        email: `corretor-rank-${c}-${baseId}@test.com`,
        role: "corretor",
      });
      
      const corretorResult = await db.select().from(users).where(eq(users.openId, `test-corretor-rank-${c}-${baseId}`)).limit(1);
      corretores.push(corretorResult[0].id);

      // Criar leads com diferentes taxas: 80%, 50%, 20%
      const totalLeads = 10;
      const convertidos = c === 0 ? 8 : c === 1 ? 5 : 2;

      for (let i = 0; i < totalLeads; i++) {
        await db.insert(leads).values({
          nome: `Lead Rank C${c} ${i}`,
          telefone: `1199${c}${i}${i}${i}${i}${i}${i}`,
          corretorId: corretores[c],
          status: i < convertidos ? "contrato_fechado" : "em_atendimento",
        });
      }
    }

    const ranking = await calcularRankingCorretores();

    const rank1 = ranking.find(r => r.corretorId === corretores[0]);
    const rank2 = ranking.find(r => r.corretorId === corretores[1]);
    const rank3 = ranking.find(r => r.corretorId === corretores[2]);

    expect(rank1!.posicao).toBeLessThan(rank2!.posicao);
    expect(rank2!.posicao).toBeLessThan(rank3!.posicao);
  });
});
