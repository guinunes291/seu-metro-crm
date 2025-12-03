import { google } from "googleapis";

/**
 * Configuração do Google Sheets API
 * Usa autenticação via API Key para acesso público (sem OAuth)
 */

interface SheetRow {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  origem: string;
  status?: string;
  dataDistribuicao?: string;
  distribuido?: string;
}

/**
 * Lê dados de uma planilha pública do Google Sheets
 * @param spreadsheetId ID da planilha (extraído da URL)
 * @param range Range da planilha (ex: "MASTER_LEADS!A:H")
 */
export async function readGoogleSheet(
  spreadsheetId: string,
  range: string
): Promise<SheetRow[]> {
  try {
    // Usar API Key para autenticação
    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_SHEETS_API_KEY não configurada");
    }

    const sheets = google.sheets({ version: "v4", auth: apiKey });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return [];
    }

    // Primeira linha são os headers
    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Mapear para objetos
    const mappedData: SheetRow[] = dataRows.map((row) => {
      const obj: any = {};
      
      headers.forEach((header: string, index: number) => {
        const normalizedHeader = header.toLowerCase().trim();
        obj[normalizedHeader] = row[index] || "";
      });

      return {
        id: obj.id || "",
        nome: obj.nome || obj.name || "",
        email: obj.email || obj["e-mail"] || "",
        telefone: obj.telefone || obj.phone || "",
        origem: obj.origem || obj.origin || "",
        status: obj.status || "",
        dataDistribuicao: obj["data distribuição"] || obj["data_distribuicao"] || "",
        distribuido: obj.distribuido || obj.distributed || "",
      };
    });

    return mappedData;
  } catch (error: any) {
    console.error("Erro ao ler Google Sheets:", error);
    throw new Error(`Erro ao acessar planilha: ${error.message}`);
  }
}

/**
 * Extrai o ID da planilha de uma URL do Google Sheets
 * @param url URL completa da planilha
 */
export function extractSpreadsheetId(url: string): string {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    throw new Error("URL inválida do Google Sheets");
  }
  return match[1];
}

/**
 * Valida se uma planilha está acessível
 */
export async function validateSheetAccess(
  spreadsheetId: string
): Promise<boolean> {
  try {
    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_SHEETS_API_KEY não configurada");
    }

    const sheets = google.sheets({ version: "v4", auth: apiKey });
    
    await sheets.spreadsheets.get({
      spreadsheetId,
    });

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Lista todas as abas de uma planilha
 */
export async function listSheetTabs(
  spreadsheetId: string
): Promise<string[]> {
  try {
    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_SHEETS_API_KEY não configurada");
    }

    const sheets = google.sheets({ version: "v4", auth: apiKey });
    
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const sheetNames = response.data.sheets?.map(
      (sheet) => sheet.properties?.title || ""
    ) || [];

    return sheetNames.filter((name) => name !== "");
  } catch (error: any) {
    console.error("Erro ao listar abas:", error);
    throw new Error(`Erro ao listar abas: ${error.message}`);
  }
}
