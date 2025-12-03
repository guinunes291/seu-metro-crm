import { describe, expect, it } from "vitest";
import { validateSheetAccess, extractSpreadsheetId } from "./googleSheets";

describe("Validação da API Key do Google Sheets", () => {
  it("deve validar que a API Key está configurada", () => {
    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toBe("");
    expect(typeof apiKey).toBe("string");
  });

  it("deve extrair o ID da planilha corretamente", () => {
    const url = "https://docs.google.com/spreadsheets/d/1_ufbbfWlo3SRgvng1PvpYCNAHycOMaYmnP4j5ENErLE/edit?usp=sharing";
    const id = extractSpreadsheetId(url);
    expect(id).toBe("1_ufbbfWlo3SRgvng1PvpYCNAHycOMaYmnP4j5ENErLE");
  });

  it("deve validar acesso a uma planilha pública", async () => {
    // Usar a planilha do usuário como teste
    const spreadsheetId = "1_ufbbfWlo3SRgvng1PvpYCNAHycOMaYmnP4j5ENErLE";
    
    try {
      const isValid = await validateSheetAccess(spreadsheetId);
      expect(isValid).toBe(true);
    } catch (error: any) {
      // Se falhar, verificar se é por falta de API Key ou por acesso negado
      if (error.message.includes("GOOGLE_SHEETS_API_KEY")) {
        throw new Error("API Key não configurada. Configure GOOGLE_SHEETS_API_KEY no ambiente.");
      } else if (error.message.includes("API key not valid")) {
        throw new Error("API Key inválida. Verifique se a API Key está correta e se a Google Sheets API está habilitada no Google Cloud Console.");
      } else {
        throw error;
      }
    }
  }, 15000); // Timeout de 15 segundos para chamadas de API
});
