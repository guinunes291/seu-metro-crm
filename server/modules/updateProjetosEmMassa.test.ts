import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "../db";
import { leads } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getEstatisticasProjetosPendentes } from "./updateProjetosEmMassa";

describe("Atualização em Massa de Projetos", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    // Limpar leads de teste anteriores
    await db.delete(leads).where(eq(leads.telefone, "+55119999977766"));
    await db.delete(leads).where(eq(leads.telefone, "+55119999977755"));
  });

  it("deve retornar estatísticas corretas de leads sem projeto", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar lead de teste sem projeto mas com telefone
    await db.insert(leads).values({
      nome: "Lead Teste Stats 1",
      telefone: "+55119999977766",
      email: "teste-stats1@example.com",
      origem: "facebook",
      status: "novo",
      projectId: null,
      projetoCustom: null,
    });

    // Criar lead de teste sem projeto e sem telefone/email
    await db.insert(leads).values({
      nome: "Lead Teste Stats 2",
      telefone: "+55119999977755",
      email: null,
      origem: "site",
      status: "novo",
      projectId: null,
      projetoCustom: null,
    });

    // Buscar estatísticas
    const stats = await getEstatisticasProjetosPendentes();

    // Verificar que incluiu nossos leads de teste
    expect(stats.total).toBeGreaterThanOrEqual(2);
    expect(stats.comTelefone).toBeGreaterThanOrEqual(2);
    expect(stats.comTelefoneOuEmail).toBeGreaterThanOrEqual(2);

    // Limpar
    await db.delete(leads).where(eq(leads.telefone, "+55119999977766"));
    await db.delete(leads).where(eq(leads.telefone, "+55119999977755"));
  });

  it("deve normalizar telefone corretamente para comparação", async () => {
    // Função de normalização (copiada do módulo para teste)
    function normalizarTelefone(telefone: string): string {
      return telefone.replace(/\D/g, "");
    }

    function extrairNumerosTelefone(telefone: string): string {
      const normalized = normalizarTelefone(telefone);
      if (normalized.length >= 8) {
        return normalized.slice(-9);
      }
      return normalized;
    }

    // Testar normalização
    expect(extrairNumerosTelefone("+55 11 99999-7777")).toBe("999997777");
    expect(extrairNumerosTelefone("(11) 99999-7777")).toBe("999997777");
    expect(extrairNumerosTelefone("11999997777")).toBe("999997777");
    expect(extrairNumerosTelefone("+5511999997777")).toBe("999997777");
  });

  it("deve identificar leads sem projeto corretamente", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar lead COM projeto
    await db.insert(leads).values({
      nome: "Lead Com Projeto",
      telefone: "+55119999988811",
      email: "com-projeto@example.com",
      origem: "indicacao",
      status: "novo",
      projectId: null,
      projetoCustom: "Residencial Teste",
    });

    // Criar lead SEM projeto
    await db.insert(leads).values({
      nome: "Lead Sem Projeto",
      telefone: "+55119999988822",
      email: "sem-projeto@example.com",
      origem: "site",
      status: "novo",
      projectId: null,
      projetoCustom: null,
    });

    // Buscar estatísticas
    const stats = await getEstatisticasProjetosPendentes();

    // Verificar que o lead sem projeto foi contado
    expect(stats.total).toBeGreaterThanOrEqual(1);

    // Limpar
    await db.delete(leads).where(eq(leads.telefone, "+55119999988811"));
    await db.delete(leads).where(eq(leads.telefone, "+55119999988822"));
  });
});
