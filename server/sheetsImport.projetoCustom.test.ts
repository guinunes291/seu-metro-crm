import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { leads, projects } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Importação de Leads com projetoCustom", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    // Limpar leads de teste anteriores
    await db.delete(leads).where(eq(leads.telefone, "+55119999988877"));
  });

  it("deve armazenar projeto em projetoCustom sem criar na tabela projects", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Contar projetos antes da importação
    const projetosAntes = await db.select().from(projects);
    const countAntes = projetosAntes.length;

    // Simular importação de lead com projeto
    const projectName = "Residencial Teste ProjetoCustom";
    
    await db.insert(leads).values({
      nome: "Lead Teste ProjetoCustom",
      telefone: "+55119999988877",
      email: "teste-projetocustom@example.com",
      origem: "facebook",
      status: "novo",
      projectId: null, // NÃO deve ter projectId
      projetoCustom: projectName, // Deve armazenar aqui como texto livre
    });

    // Verificar que o lead foi criado corretamente
    const leadCriado = await db
      .select()
      .from(leads)
      .where(eq(leads.telefone, "+55119999988877"))
      .limit(1);

    expect(leadCriado).toHaveLength(1);
    expect(leadCriado[0].projetoCustom).toBe(projectName);
    expect(leadCriado[0].projectId).toBeNull();

    // Verificar que NÃO foi criado novo projeto na tabela projects
    const projetosDepois = await db.select().from(projects);
    const countDepois = projetosDepois.length;

    expect(countDepois).toBe(countAntes); // Deve ser igual, não deve ter criado projeto novo

    // Limpar
    await db.delete(leads).where(eq(leads.id, leadCriado[0].id));
  });

  it("deve importar lead sem projeto quando campo projeto está vazio", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Simular importação de lead SEM projeto
    await db.insert(leads).values({
      nome: "Lead Sem Projeto",
      telefone: "+55119999988866",
      email: "sem-projeto@example.com",
      origem: "site",
      status: "novo",
      projectId: null,
      projetoCustom: null, // Sem projeto
    });

    // Verificar que o lead foi criado corretamente
    const leadCriado = await db
      .select()
      .from(leads)
      .where(eq(leads.telefone, "+55119999988866"))
      .limit(1);

    expect(leadCriado).toHaveLength(1);
    expect(leadCriado[0].projetoCustom).toBeNull();
    expect(leadCriado[0].projectId).toBeNull();

    // Limpar
    await db.delete(leads).where(eq(leads.id, leadCriado[0].id));
  });

  it("deve atualizar projetoCustom de lead existente quando vazio", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar lead sem projeto
    await db.insert(leads).values({
      nome: "Lead Para Atualizar",
      telefone: "+55119999988855",
      email: "atualizar@example.com",
      origem: "indicacao",
      status: "novo",
      projectId: null,
      projetoCustom: null,
    });

    const leadCriado = await db
      .select()
      .from(leads)
      .where(eq(leads.telefone, "+55119999988855"))
      .limit(1);

    expect(leadCriado[0].projetoCustom).toBeNull();

    // Simular atualização com projeto
    const projectName = "Novo Projeto Atualizado";
    await db
      .update(leads)
      .set({ projetoCustom: projectName })
      .where(eq(leads.id, leadCriado[0].id));

    // Verificar atualização
    const leadAtualizado = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadCriado[0].id))
      .limit(1);

    expect(leadAtualizado[0].projetoCustom).toBe(projectName);
    expect(leadAtualizado[0].projectId).toBeNull();

    // Limpar
    await db.delete(leads).where(eq(leads.id, leadCriado[0].id));
  });
});
