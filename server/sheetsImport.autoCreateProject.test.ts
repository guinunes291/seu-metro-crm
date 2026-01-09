import { describe, it, expect, beforeEach } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { projects, leads } from "../drizzle/schema";

// Função de teste que simula a importação
async function testAutoCreateProject(projectName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Importar a função findExistingProject
  const { findExistingProject } = await import("./sheetsImport");
  
  // Buscar ou criar projeto
  const projectId = await (findExistingProject as any)(projectName);
  
  return projectId;
}

describe("Criação Automática de Projetos na Importação", () => {
  beforeEach(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Limpar dados de teste
    await db.delete(projects).where(sql`nome LIKE 'TEST_AUTO_%'`);
  });

  it("deve criar projeto automaticamente se não existir", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const projectName = "TEST_AUTO_Novo Projeto";

    // Verificar que não existe
    const [countBefore] = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(sql`nome = ${projectName}`);

    expect(Number(countBefore.count)).toBe(0);

    // Executar função que deve criar o projeto
    const projectId = await testAutoCreateProject(projectName);

    // Verificar que foi criado
    expect(projectId).not.toBeNull();
    expect(projectId).toBeGreaterThan(0);

    const [countAfter] = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(sql`nome = ${projectName}`);

    expect(Number(countAfter.count)).toBe(1);
  });

  it("deve reutilizar projeto existente sem criar duplicata", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const projectName = "TEST_AUTO_Projeto Existente";

    // Criar projeto manualmente
    const inserted = await db.insert(projects).values({
      nome: projectName,
      cidade: "São Paulo",
      estado: "SP",
      tipo: "mcmv",
      status: "ativo",
    });

    const originalId = Number(inserted.insertId);

    // Executar função duas vezes
    const projectId1 = await testAutoCreateProject(projectName);
    const projectId2 = await testAutoCreateProject(projectName);

    // Verificar que retornou o mesmo ID
    expect(projectId1).toBe(originalId);
    expect(projectId2).toBe(originalId);

    // Verificar que não criou duplicata
    const [count] = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(sql`nome = ${projectName}`);

    expect(Number(count.count)).toBe(1);
  });

  it("deve criar múltiplos projetos diferentes", async () => {
    const projects = [
      "TEST_AUTO_Projeto A",
      "TEST_AUTO_Projeto B",
      "TEST_AUTO_Projeto C",
    ];

    const ids = [];
    for (const projectName of projects) {
      const id = await testAutoCreateProject(projectName);
      ids.push(id);
    }

    // Verificar que todos têm IDs diferentes
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);

    // Verificar que todos foram criados
    for (const id of ids) {
      expect(id).not.toBeNull();
      expect(id).toBeGreaterThan(0);
    }
  });
});
