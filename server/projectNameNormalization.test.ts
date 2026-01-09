import { describe, it, expect, beforeEach } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { projects } from "../drizzle/schema";
import { findExistingProject } from "./sheetsImport";

describe("Normalizacao de Nomes de Projetos", () => {
  beforeEach(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db.delete(projects).where(sql`nome LIKE 'TEST_NORM_%'`);
  });

  it("deve reconhecer nomes com diferentes acentuacoes", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db.insert(projects).values({
      nome: "TEST_NORM_Patio Central Galeria",
      cidade: "Sao Paulo",
      estado: "SP",
      tipo: "mcmv",
      status: "ativo",
    });

    const projectId = await findExistingProject("TEST_NORM_Patio Central Galeria");
    expect(projectId).not.toBeNull();
    expect(projectId).toBeGreaterThan(0);
  });

  it("deve reconhecer nomes com diferentes capitalizacoes", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db.insert(projects).values({
      nome: "TEST_NORM_brooklin sky",
      cidade: "Sao Paulo",
      estado: "SP",
      tipo: "mcmv",
      status: "ativo",
    });

    const id1 = await findExistingProject("TEST_NORM_BROOKLIN SKY");
    const id2 = await findExistingProject("TEST_NORM_Brooklin Sky");
    
    expect(id1).toBe(id2);
  });

  it("deve reconhecer nomes com espacos extras", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db.insert(projects).values({
      nome: "TEST_NORM_Reserva Jardim",
      cidade: "Sao Paulo",
      estado: "SP",
      tipo: "mcmv",
      status: "ativo",
    });

    const projectId = await findExistingProject("TEST_NORM_Reserva  Jardim");
    expect(projectId).not.toBeNull();
  });
});
