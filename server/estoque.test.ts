import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { distribuirLeadAutomatico, distribuirLeadsDoEstoque, getEstatisticasEstoque } from "./distribution";
import { users, leads, leadEstoque } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Sistema de Estoque de Leads", () => {
  let gestorId: number;
  let corretorId: number;
  let leadId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database não disponível");

    // Buscar gestor (pode ser admin ou gestor)
    let gestores = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
    if (gestores.length === 0) {
      gestores = await db.select().from(users).where(eq(users.role, "gestor")).limit(1);
    }
    if (gestores.length === 0) throw new Error("Gestor não encontrado");
    gestorId = gestores[0].id;

    // Buscar corretor
    const corretores = await db.select().from(users).where(eq(users.role, "corretor")).limit(1);
    if (corretores.length > 0) {
      corretorId = corretores[0].id;
      
      // Marcar corretor como ausente para forçar estoque
      await db.update(users).set({ status: "ausente" }).where(eq(users.id, corretorId));
    }

    // Criar lead de teste
    const [novoLead] = await db.insert(leads).values({
      nome: "Lead Teste Estoque",
      email: "teste.estoque@example.com",
      telefone: "(11) 99999-9999",
      corretorId: gestorId,
      status: "aguardando_atendimento",
      origem: "teste",
    }).$returningId();

    leadId = novoLead.id;
  });

  it("deve adicionar lead ao estoque quando não houver corretor disponível", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database não disponível");

    // Tentar distribuir lead (deve falhar e ir para estoque)
    const resultado = await distribuirLeadAutomatico(leadId);

    expect(resultado.success).toBe(false);
    expect(resultado.message).toContain("estoque");

    // Verificar se foi adicionado ao estoque
    const estoqueItems = await db
      .select()
      .from(leadEstoque)
      .where(eq(leadEstoque.leadId, leadId));

    expect(estoqueItems.length).toBe(1);
    expect(estoqueItems[0].status).toBe("aguardando");
    expect(estoqueItems[0].tipoFila).toBe("normal");
  });

  it("deve retornar estatísticas corretas do estoque", async () => {
    const estatisticas = await getEstatisticasEstoque();

    expect(estatisticas.totalEmEstoque).toBeGreaterThan(0);
    expect(estatisticas.porFila).toHaveProperty("normal");
    expect(estatisticas.porFila).toHaveProperty("foco");
    expect(estatisticas.tentativasMedia).toBeGreaterThanOrEqual(0);
  });

  it("deve distribuir lead do estoque quando corretor ficar disponível", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database não disponível");

    // Marcar corretor como presente
    await db.update(users).set({ status: "presente" }).where(eq(users.id, corretorId));

    // Tentar distribuir leads do estoque
    const resultado = await distribuirLeadsDoEstoque();

    expect(resultado.distribuidos).toBeGreaterThan(0);
    expect(resultado.erros).toBe(0);

    // Verificar se lead foi distribuído
    const leadAtualizado = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    expect(leadAtualizado[0].corretorId).toBe(corretorId);
    expect(leadAtualizado[0].status).toBe("aguardando_atendimento");

    // Verificar se foi marcado como distribuído no estoque
    const estoqueItems = await db
      .select()
      .from(leadEstoque)
      .where(eq(leadEstoque.leadId, leadId));

    expect(estoqueItems[0].status).toBe("distribuido");
    expect(estoqueItems[0].distribuidoParaCorretorId).toBe(corretorId);
  });

  it("deve incrementar tentativas quando não conseguir distribuir", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database não disponível");

    // Criar outro lead de teste
    const [novoLead] = await db.insert(leads).values({
      nome: "Lead Teste Tentativas",
      email: "teste.tentativas@example.com",
      telefone: "(11) 99999-8888",
      corretorId: gestorId,
      status: "aguardando_atendimento",
      origem: "teste",
    }).$returningId();

    // Marcar corretor como ausente novamente
    await db.update(users).set({ status: "ausente" }).where(eq(users.id, corretorId));

    // Adicionar ao estoque
    await distribuirLeadAutomatico(novoLead.id);

    // Tentar distribuir (deve falhar)
    const resultado = await distribuirLeadsDoEstoque();

    // Verificar tentativas
    const estoqueItems = await db
      .select()
      .from(leadEstoque)
      .where(eq(leadEstoque.leadId, novoLead.id));

    expect(estoqueItems[0].tentativasDistribuicao).toBeGreaterThan(0);
    expect(estoqueItems[0].ultimaTentativa).not.toBeNull();
  });
});
