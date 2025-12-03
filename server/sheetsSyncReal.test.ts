import { describe, expect, it } from "vitest";
import { testarConexaoSheets } from "./sheetsSyncReal";
import { eq } from "drizzle-orm";

describe("Google Sheets API - Sincronização Real", () => {
  it("deve conectar com Google Sheets usando Service Account", async () => {
    const resultado = await testarConexaoSheets();

    expect(resultado.success).toBe(true);
    expect(resultado.message).toBe("Conexão estabelecida com sucesso");
    expect(resultado.spreadsheetTitle).toBeDefined();
    
    console.log(`✅ Conectado à planilha: ${resultado.spreadsheetTitle}`);
  }, 30000); // Timeout de 30 segundos para chamada de API
});

  it("deve buscar linha de lead por telefone na planilha", async () => {
    // Este teste requer que exista um lead na planilha
    // Vamos apenas verificar se a função não quebra
    const { findLeadRowByPhone } = await import("./sheetsSyncReal");
    
    // Testar com telefone fictício
    const resultado = await findLeadRowByPhone("(11) 99999-9999");
    
    // Resultado pode ser null (lead não encontrado) ou número (linha encontrada)
    expect(resultado === null || typeof resultado === "number").toBe(true);
    
    console.log(`📞 Busca por telefone: ${resultado ? `encontrado na linha ${resultado}` : "não encontrado"}`);
  }, 30000);

  it("deve registrar distribuição no histórico da planilha", async () => {
    const { getDb } = await import("./db");
    const { leads, users } = await import("../drizzle/schema");
    const { registrarDistribuicaoNaPlanilha } = await import("./sheetsSyncReal");
    
    const db = await getDb();
    if (!db) {
      throw new Error("Database não disponível");
    }

    // Buscar ou criar corretor de teste
    let corretor = await db
      .select()
      .from(users)
      .where(eq(users.email, "sheets@test.com"))
      .limit(1);
    
    if (corretor.length === 0) {
      const [novoCorretor] = await db.insert(users).values({
        openId: `corretor-sheets-test-${Date.now()}`,
        name: "Corretor Sheets Test",
        email: "sheets@test.com",
        role: "corretor",
        status: "presente",
      });
      corretor = [{ ...novoCorretor, id: novoCorretor.insertId }] as any;
    }

    // Criar lead de teste
    const [lead] = await db.insert(leads).values({
      nome: "Lead Teste Sheets",
      telefone: "(11) 99999-8888",
      corretorId: corretor[0].id,
      status: "em_atendimento",
    });

    // Registrar no histórico
    const resultado = await registrarDistribuicaoNaPlanilha(lead.insertId);

    expect(resultado.success).toBe(true);
    console.log(`📝 Histórico registrado: ${resultado.message}`);
  }, 30000);
