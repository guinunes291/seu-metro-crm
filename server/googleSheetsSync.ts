import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";

/**
 * Módulo de Sincronização com Google Sheets
 * Usa Service Account para escrita automática de leads na planilha
 */

// ID da planilha de destino
const SPREADSHEET_ID = "1or0l4OToJUsGW8FpyGjSOovjc27riV4Wmi0YWQze8X8";
const SHEET_NAME = "Leads";

// Estrutura das colunas da planilha
const HEADERS = [
  "ID",
  "Data Criação",
  "Nome",
  "Email",
  "Telefone",
  "CPF",
  "Origem",
  "Projeto Interesse",
  "Corretor",
  "Status",
  "Data Distribuição",
  "Último Contato",
  "Observações",
  "Campanha",
  "Faixa de Renda",
];

interface LeadData {
  id: number;
  createdAt: Date;
  nome: string;
  email?: string | null;
  telefone: string;
  cpf?: string | null;
  origem?: string | null;
  projetoNome?: string | null;
  corretorNome?: string | null;
  status: string;
  dataDistribuicao?: Date | null;
  ultimoContato?: Date | null;
  observacoes?: string | null;
  campanha?: string | null;
  faixaRenda?: string | null;
}

// Caminho do arquivo de credenciais
const CREDENTIALS_PATH = path.resolve(process.cwd(), "server/google-service-account.json");

/**
 * Obtém cliente autenticado do Google Sheets usando Service Account
 */
async function getAuthenticatedClient() {
  // Usar GoogleAuth com keyFile para evitar problemas com OpenSSL
  const auth = new GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const authClient = await auth.getClient();
  return google.sheets({ version: "v4", auth: authClient as any });
}

/**
 * Formata data para exibição na planilha
 */
function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formata status para exibição legível
 */
function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    novo: "Novo",
    aguardando_atendimento: "Aguardando Atendimento",
    em_atendimento: "Em Atendimento",
    agendado: "Agendado",
    visita_realizada: "Visita Realizada",
    analise_credito: "Análise de Crédito",
    contrato_fechado: "Contrato Fechado",
    perdido: "Perdido",
  };
  return statusMap[status] || status;
}

/**
 * Formata origem para exibição legível
 */
function formatOrigem(origem: string | null | undefined): string {
  if (!origem) return "";
  const origemMap: Record<string, string> = {
    facebook: "Facebook",
    google_sheets: "Google Sheets",
    site: "Site",
    indicacao: "Indicação",
    captacao_corretor: "Captação Corretor",
    whatsapp: "WhatsApp",
    telefone: "Telefone",
    plantao: "Plantão",
    outro: "Outro",
  };
  return origemMap[origem] || origem;
}

/**
 * Converte lead para linha da planilha
 */
function leadToRow(lead: LeadData): string[] {
  return [
    String(lead.id),
    formatDate(lead.createdAt),
    lead.nome || "",
    lead.email || "",
    lead.telefone || "",
    lead.cpf || "",
    formatOrigem(lead.origem),
    lead.projetoNome || "Sem Projeto",
    lead.corretorNome || "Sem Corretor",
    formatStatus(lead.status),
    formatDate(lead.dataDistribuicao),
    formatDate(lead.ultimoContato),
    lead.observacoes || "",
    lead.campanha || "",
    lead.faixaRenda || "",
  ];
}

/**
 * Inicializa a planilha com headers se necessário
 */
export async function initializeSheet(): Promise<void> {
  try {
    const sheets = await getAuthenticatedClient();

    // Verificar se a aba existe
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const sheetExists = spreadsheet.data.sheets?.some(
      (s) => s.properties?.title === SHEET_NAME
    );

    if (!sheetExists) {
      // Criar aba se não existir
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: SHEET_NAME,
                },
              },
            },
          ],
        },
      });
    }

    // Verificar se já tem headers
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:O1`,
    });

    if (!response.data.values || response.data.values.length === 0) {
      // Adicionar headers
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:O1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [HEADERS],
        },
      });

      // Formatar headers (negrito e cor de fundo)
      const sheetId = spreadsheet.data.sheets?.find(
        (s) => s.properties?.title === SHEET_NAME
      )?.properties?.sheetId;

      if (sheetId !== undefined) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [
              {
                repeatCell: {
                  range: {
                    sheetId,
                    startRowIndex: 0,
                    endRowIndex: 1,
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 0.2, green: 0.4, blue: 0.6 },
                      textFormat: {
                        bold: true,
                        foregroundColor: { red: 1, green: 1, blue: 1 },
                      },
                    },
                  },
                  fields: "userEnteredFormat(backgroundColor,textFormat)",
                },
              },
              {
                updateSheetProperties: {
                  properties: {
                    sheetId,
                    gridProperties: {
                      frozenRowCount: 1,
                    },
                  },
                  fields: "gridProperties.frozenRowCount",
                },
              },
            ],
          },
        });
      }

      console.log("[GoogleSheets] Planilha inicializada com headers");
    }
  } catch (error: any) {
    console.error("[GoogleSheets] Erro ao inicializar planilha:", error.message);
    throw error;
  }
}

/**
 * Adiciona um único lead à planilha
 */
export async function appendLead(lead: LeadData): Promise<void> {
  try {
    const sheets = await getAuthenticatedClient();
    const row = leadToRow(lead);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:O`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [row],
      },
    });

    console.log(`[GoogleSheets] Lead ${lead.id} adicionado à planilha`);
  } catch (error: any) {
    console.error("[GoogleSheets] Erro ao adicionar lead:", error.message);
    throw error;
  }
}

/**
 * Adiciona múltiplos leads à planilha (em lote)
 */
export async function appendLeads(leads: LeadData[]): Promise<{ success: number; errors: number }> {
  if (leads.length === 0) {
    return { success: 0, errors: 0 };
  }

  try {
    const sheets = await getAuthenticatedClient();
    const rows = leads.map(leadToRow);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:O`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: rows,
      },
    });

    console.log(`[GoogleSheets] ${leads.length} leads adicionados à planilha`);
    return { success: leads.length, errors: 0 };
  } catch (error: any) {
    console.error("[GoogleSheets] Erro ao adicionar leads em lote:", error.message);
    return { success: 0, errors: leads.length };
  }
}

/**
 * Atualiza um lead existente na planilha (busca por ID)
 */
export async function updateLead(lead: LeadData): Promise<boolean> {
  try {
    const sheets = await getAuthenticatedClient();

    // Buscar todas as linhas para encontrar o lead pelo ID
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:A`,
    });

    const rows = response.data.values || [];
    let rowIndex = -1;

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === String(lead.id)) {
        rowIndex = i + 1; // +1 porque índice começa em 1 no Sheets
        break;
      }
    }

    if (rowIndex === -1) {
      // Lead não encontrado, adicionar como novo
      await appendLead(lead);
      return true;
    }

    // Atualizar linha existente
    const row = leadToRow(lead);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A${rowIndex}:O${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [row],
      },
    });

    console.log(`[GoogleSheets] Lead ${lead.id} atualizado na linha ${rowIndex}`);
    return true;
  } catch (error: any) {
    console.error("[GoogleSheets] Erro ao atualizar lead:", error.message);
    return false;
  }
}

/**
 * Sincroniza todos os leads do banco para a planilha
 * Limpa a planilha e reescreve todos os dados
 */
export async function syncAllLeads(leads: LeadData[]): Promise<{ success: number; errors: number }> {
  try {
    const sheets = await getAuthenticatedClient();

    // Limpar dados existentes (mantendo headers)
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:O`,
    });

    if (leads.length === 0) {
      console.log("[GoogleSheets] Nenhum lead para sincronizar");
      return { success: 0, errors: 0 };
    }

    // Adicionar todos os leads
    const rows = leads.map(leadToRow);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:O`,
      valueInputOption: "RAW",
      requestBody: {
        values: rows,
      },
    });

    console.log(`[GoogleSheets] ${leads.length} leads sincronizados`);
    return { success: leads.length, errors: 0 };
  } catch (error: any) {
    console.error("[GoogleSheets] Erro na sincronização completa:", error.message);
    return { success: 0, errors: leads.length };
  }
}

/**
 * Verifica se a conexão com o Google Sheets está funcionando
 */
export async function testConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const sheets = await getAuthenticatedClient();

    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    return {
      success: true,
      message: `Conectado à planilha: ${response.data.properties?.title}`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Erro de conexão: ${error.message}`,
    };
  }
}

/**
 * Retorna o ID da planilha configurada
 */
export function getSpreadsheetId(): string {
  return SPREADSHEET_ID;
}

/**
 * Retorna o link da planilha
 */
export function getSpreadsheetUrl(): string {
  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`;
}
