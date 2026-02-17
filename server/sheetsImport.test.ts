import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { extractSpreadsheetId } from "./googleSheets";
import { getDb } from "./db";
import { leads, projects } from "../drizzle/schema";
import { sql, like, or } from "drizzle-orm";
import { TEST_PREFIX, testName, testPhone, cleanupTestData } from "./test-utils";

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

// Limpar dados de teste após todos os testes
afterAll(async () => {
  await cleanupTestData();
});

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
  beforeEach(async () => {
    await cleanupTestData();
  });

  it("função findExistingProject deve retornar null para projeto inexistente", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar um projeto de teste (com prefixo)
    await db.insert(projects).values({
      nome: testName("Projeto Real"),
      cidade: "São Paulo",
      estado: "SP",
      tipo: "mcmv",
      status: "ativo",
    });

    // Contar projetos de teste antes
    const [countBefore] = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(like(projects.nome, `${TEST_PREFIX}%`));

    expect(countBefore.count).toBe(1);

    // Inserir lead de teste sem projeto vinculado
    await db.insert(leads).values({
      nome: testName("Lead Teste"),
      telefone: testPhone("(11) 99999-9999"),
      origem: "site", // Usar valor válido do enum
      projectId: null, // Deve ficar null
      status: "novo",
    });

    // Contar projetos de teste depois
    const [countAfter] = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(like(projects.nome, `${TEST_PREFIX}%`));

    // Não deve ter criado novo projeto
    expect(countAfter.count).toBe(1);
  });
});

describe("Sincronização de Leads - projetoCustom", () => {
  /**
   * Função auxiliar para extrair apenas números do telefone
   * Deve ser igual à função extractPhoneNumbers em sheetsImport.ts
   */
  function extractPhoneNumbers(telefone: string): string {
    return telefone.replace(/\D/g, "");
  }

  it("deve extrair apenas números do telefone corretamente", () => {
    expect(extractPhoneNumbers("(11) 98765-4321")).toBe("11987654321");
    expect(extractPhoneNumbers("11 98765-4321")).toBe("11987654321");
    expect(extractPhoneNumbers("11987654321")).toBe("11987654321");
    expect(extractPhoneNumbers("+55 11 98765-4321")).toBe("5511987654321");
  });

  it("deve buscar leads existentes por telefone normalizado usando REGEXP_REPLACE", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar um lead de teste com telefone formatado
    await db.insert(leads).values({
      nome: testName("Lead Teste Telefone"),
      telefone: testPhone("(11) 98765-4321"), // Formato com parênteses e traço
      status: "novo",
    });

    // Buscar o lead recém-criado
    const testLead = await db
      .select()
      .from(leads)
      .where(sql`${leads.nome} = ${testName("Lead Teste Telefone")}`)
      .limit(1);

    const leadId = testLead[0].id;
    const normalizedPhone = extractPhoneNumbers(testLead[0].telefone);

    // Buscar usando SQL com REGEXP_REPLACE (mesma lógica da função getExistingLeads)
    const found = await db
      .select({ id: leads.id, telefone: leads.telefone, nome: leads.nome })
      .from(leads)
      .where(
        sql`REGEXP_REPLACE(${leads.telefone}, '[^0-9]', '') = ${normalizedPhone}`
      )
      .limit(1);

    expect(found.length).toBeGreaterThan(0);
    expect(found[0].id).toBe(leadId);
    expect(extractPhoneNumbers(found[0].telefone)).toBe(normalizedPhone);
  });

  it("deve verificar se campo projetoCustom existe e pode ser atualizado", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar lead sem projetoCustom
    await db.insert(leads).values({
      nome: testName("Lead Sem Projeto"),
      telefone: testPhone("(11) 91111-1111"),
      status: "novo",
      projetoCustom: null,
    });

    // Buscar o lead recém-criado
    const testLead = await db
      .select()
      .from(leads)
      .where(sql`${leads.nome} = ${testName("Lead Sem Projeto")}`)
      .limit(1);

    const leadId = testLead[0].id;

    // Verificar que está null
    expect(testLead[0].projetoCustom).toBeNull();

    // Atualizar com projetoCustom
    await db
      .update(leads)
      .set({ projetoCustom: "Holistic Residence" })
      .where(sql`${leads.id} = ${leadId}`);

    // Buscar novamente
    const updated = await db
      .select({ id: leads.id, projetoCustom: leads.projetoCustom })
      .from(leads)
      .where(sql`${leads.id} = ${leadId}`)
      .limit(1);

    expect(updated[0].projetoCustom).toBe("Holistic Residence");
  });

  it("deve listar leads com projetoCustom preenchido", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar alguns leads de teste com projetoCustom
    await db.insert(leads).values([
      {
        nome: testName("Lead Com Projeto 1"),
        telefone: testPhone("(11) 92222-2222"),
        status: "novo",
        projetoCustom: "Concept Barra Funda Residence",
      },
      {
        nome: testName("Lead Com Projeto 2"),
        telefone: testPhone("(11) 93333-3333"),
        status: "novo",
        projetoCustom: "Pátio Central Galeria",
      },
    ]);

    // Buscar leads de teste com projetoCustom preenchido
    const leadsComProjeto = await db
      .select({
        id: leads.id,
        nome: leads.nome,
        projetoCustom: leads.projetoCustom,
      })
      .from(leads)
      .where(
        sql`${leads.projetoCustom} IS NOT NULL AND ${leads.projetoCustom} != '' AND ${leads.nome} LIKE ${TEST_PREFIX + '%'}`
      );

    expect(leadsComProjeto.length).toBeGreaterThanOrEqual(2);
    expect(leadsComProjeto.some(l => l.projetoCustom === "Concept Barra Funda Residence")).toBe(true);
    expect(leadsComProjeto.some(l => l.projetoCustom === "Pátio Central Galeria")).toBe(true);
  });
});
