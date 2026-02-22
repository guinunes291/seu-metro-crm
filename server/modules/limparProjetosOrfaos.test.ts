import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "../db";
import { projects, leads } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { identificarProjetosOrfaos } from "./limparProjetosOrfaos";

describe("Limpeza de Projetos Órfãos", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    // Limpar projetos de teste anteriores
    await db.delete(projects).where(eq(projects.nome, "Projeto Teste Órfão"));
    await db.delete(projects).where(eq(projects.nome, "Projeto Teste Com Lead"));
    await db.delete(projects).where(eq(projects.nome, "Projeto Teste Stats Órfão"));
    await db.delete(leads).where(eq(leads.telefone, "+55119999966655"));
  });

  it("deve identificar projetos órfãos corretamente", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar projeto órfão (sem leads)
    await db.insert(projects).values({
      nome: "Projeto Teste Órfão",
      cidade: "São Paulo",
      estado: "SP",
      tipo: "mcmv",
      status: "ativo",
    });

    // Buscar ID do projeto criado
    const projetosOrfaos = await db
      .select()
      .from(projects)
      .where(eq(projects.nome, "Projeto Teste Órfão"));
    const projetoOrfaoId = projetosOrfaos[0].id;

    // Criar projeto com lead associado
    await db.insert(projects).values({
      nome: "Projeto Teste Com Lead",
      cidade: "São Paulo",
      estado: "SP",
      tipo: "mcmv",
      status: "ativo",
    });

    // Buscar ID do projeto criado
    const projetosComLead = await db
      .select()
      .from(projects)
      .where(eq(projects.nome, "Projeto Teste Com Lead"));
    const projetoComLeadId = projetosComLead[0].id;

    // Criar lead associado ao segundo projeto
    await db.insert(leads).values({
      nome: "Lead Teste Projeto",
      telefone: "+55119999966655",
      email: "teste-projeto@example.com",
      origem: "site",
      status: "novo",
      projectId: projetoComLeadId,
      projetoCustom: null,
    });

    // Identificar órfãos
    const stats = await identificarProjetosOrfaos();

    // Verificar que o projeto órfão foi identificado
    const orfaoEncontrado = stats.listaOrfaos.some(p => p.id === projetoOrfaoId);
    expect(orfaoEncontrado).toBe(true);

    // Verificar que o projeto com lead NÃO foi identificado como órfão
    const projetoComLeadEhOrfao = stats.listaOrfaos.some(p => p.id === projetoComLeadId);
    expect(projetoComLeadEhOrfao).toBe(false);

    // Limpar
    await db.delete(leads).where(eq(leads.telefone, "+55119999966655"));
    await db.delete(projects).where(eq(projects.nome, "Projeto Teste Órfão"));
    await db.delete(projects).where(eq(projects.nome, "Projeto Teste Com Lead"));
  });

  it("deve retornar estatísticas corretas", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar projeto órfão
    await db.insert(projects).values({
      nome: "Projeto Teste Stats Órfão",
      cidade: "São Paulo",
      estado: "SP",
      tipo: "mcmv",
      status: "ativo",
    });

    // Identificar órfãos
    const stats = await identificarProjetosOrfaos();

    // Verificar estrutura das estatísticas
    expect(stats).toHaveProperty("total");
    expect(stats).toHaveProperty("comLeads");
    expect(stats).toHaveProperty("orfaos");
    expect(stats).toHaveProperty("listaOrfaos");

    // Verificar que total = comLeads + orfaos
    expect(stats.total).toBe(stats.comLeads + stats.orfaos);

    // Verificar que listaOrfaos tem o tamanho correto
    expect(stats.listaOrfaos.length).toBe(stats.orfaos);

    // Limpar
    await db.delete(projects).where(eq(projects.nome, "Projeto Teste Stats Órfão"));
  });
});
