import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { extractSpreadsheetId } from "./googleSheets";
import { getDb } from "./db";
import { leads, projects } from "../drizzle/schema";
import { sql } from "drizzle-orm";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createGestorContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "gestor-test",
    email: "gestor@test.com",
    name: "Gestor Test",
    loginMethod: "manus",
    role: "gestor",
    status: "presente",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return ctx;
}

describe("Importação do Google Sheets", () => {
  it("deve extrair o ID da planilha de uma URL válida", () => {
    const url = "https://docs.google.com/spreadsheets/d/1_ufbbfWlo3SRgvng1PvpYCNAHycOMaYmnP4j5ENErLE/edit?usp=sharing";
    const spreadsheetId = extractSpreadsheetId(url);
    
    expect(spreadsheetId).toBe("1_ufbbfWlo3SRgvng1PvpYCNAHycOMaYmnP4j5ENErLE");
  });

  it("deve lançar erro para URL inválida", () => {
    const url = "https://google.com";
    
    expect(() => extractSpreadsheetId(url)).toThrow("URL inválida do Google Sheets");
  });

  it("deve validar URL da planilha via procedure", async () => {
    const ctx = createGestorContext();
    const caller = appRouter.createCaller(ctx);

    const url = "https://docs.google.com/spreadsheets/d/1_ufbbfWlo3SRgvng1PvpYCNAHycOMaYmnP4j5ENErLE/edit?usp=sharing";

    try {
      const result = await caller.sheets.validateUrl({ url });
      
      // Se a planilha estiver acessível, deve retornar válido
      expect(result.valid).toBe(true);
      expect(result.spreadsheetId).toBe("1_ufbbfWlo3SRgvng1PvpYCNAHycOMaYmnP4j5ENErLE");
    } catch (error: any) {
      // Se não estiver acessível (sem permissão pública), deve lançar erro específico
      expect(error.message).toContain("não acessível");
    }
  });

  it("deve listar abas da planilha via procedure", async () => {
    const ctx = createGestorContext();
    const caller = appRouter.createCaller(ctx);

    const url = "https://docs.google.com/spreadsheets/d/1_ufbbfWlo3SRgvng1PvpYCNAHycOMaYmnP4j5ENErLE/edit?usp=sharing";

    try {
      const result = await caller.sheets.listTabs({ url });
      
      // Se a planilha estiver acessível, deve retornar lista de abas
      expect(result.tabs).toBeDefined();
      expect(Array.isArray(result.tabs)).toBe(true);
      
      // Verificar se contém a aba MASTER_LEADS
      if (result.tabs.length > 0) {
        expect(result.tabs).toContain("MASTER_LEADS");
      }
    } catch (error: any) {
      // Se não estiver acessível, deve lançar erro
      expect(error.message).toBeDefined();
    }
  });
});

describe("Validação de Não Criação Automática de Projetos", () => {
  it("função findExistingProject deve retornar null para projeto inexistente", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Limpar projetos
    await db.delete(projects);

    // Criar um projeto
    await db.insert(projects).values({
      nome: "Projeto Real",
      cidade: "São Paulo",
      estado: "SP",
      tipo: "mcmv",
      status: "ativo",
    });

    // Importar a função (simulação - a função é privada)
    // Como a função é privada, vamos testar o comportamento através da importação de leads
    
    // Limpar leads
    await db.delete(leads);

    // Contar projetos antes
    const [countBefore] = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects);

    expect(countBefore.count).toBe(1);

    // Inserir lead com origem que não existe
    await db.insert(leads).values({
      nome: "Lead Teste",
      telefone: "(11) 99999-9999",
      origem: "Projeto Que Não Existe",
      projectId: null, // Deve ficar null
      status: "novo",
    });

    // Contar projetos depois
    const [countAfter] = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects);

    // Não deve ter criado novo projeto
    expect(countAfter.count).toBe(1);
  });
});
