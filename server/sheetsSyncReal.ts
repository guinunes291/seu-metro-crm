import { google } from "googleapis";
import { getDb } from "./db";
import { leads, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Configuração da planilha
 */
const SPREADSHEET_ID = "1_ufbbfWlo3SRgvng1PvpYCNAHycOMaYmnP4j5ENErLE";
const SHEET_NAME_LEADS = "Leads para distribuição";
const SHEET_NAME_HISTORICO = "Histórico Distribuição";

/**
 * Colunas da planilha (baseado nas informações fornecidas)
 */
const COLUMNS = {
  TELEFONE: "D",      // Coluna do telefone
  CORRETOR: "J",      // Coluna do nome do corretor
  DISTRIBUIDO: "H",   // Coluna "Distribuído"
};

/**
 * Inicializa o cliente Google Sheets com Service Account
 */
function getGoogleSheetsClient() {
  try {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    
    if (!serviceAccountJson) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não configurada");
    }

    const credentials = JSON.parse(serviceAccountJson);
    
    // Corrigir formato da chave privada (substituir \n literal por quebras de linha reais)
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    return google.sheets({ version: "v4", auth });
  } catch (error) {
    console.error("[Sheets Sync] Erro ao inicializar cliente:", error);
    throw error;
  }
}

/**
 * Busca a linha de um lead na planilha pelo telefone
 * Retorna o índice da linha (1-based) ou null se não encontrado
 */
export async function findLeadRowByPhone(
  telefone: string
): Promise<number | null> {
  try {
    const sheets = getGoogleSheetsClient();

    // Normalizar telefone (apenas números)
    const phoneNumbers = telefone.replace(/\D/g, "");

    // Ler coluna de telefones
    const range = `${SHEET_NAME_LEADS}!${COLUMNS.TELEFONE}:${COLUMNS.TELEFONE}`;
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }

    // Procurar telefone (ignorando primeira linha de cabeçalho)
    for (let i = 1; i < rows.length; i++) {
      const cellValue = rows[i][0] || "";
      const cellNumbers = cellValue.replace(/\D/g, "");
      
      if (cellNumbers === phoneNumbers) {
        return i + 1; // Retornar índice 1-based
      }
    }

    return null;
  } catch (error) {
    console.error("[Sheets Sync] Erro ao buscar lead por telefone:", error);
    return null;
  }
}

/**
 * Atualiza o nome do corretor e marca como "Distribuído" na planilha
 */
export async function atualizarLeadNaPlanilha(
  leadId: number
): Promise<{ success: boolean; message: string }> {
  try {
    const db = await getDb();
    if (!db) {
      return { success: false, message: "Database não disponível" };
    }

    // Buscar dados do lead
    const lead = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (lead.length === 0) {
      return { success: false, message: "Lead não encontrado" };
    }

    const leadData = lead[0];

    // Buscar dados do corretor
    let corretorNome = "";
    if (leadData.corretorId) {
      const corretor = await db
        .select()
        .from(users)
        .where(eq(users.id, leadData.corretorId))
        .limit(1);

      if (corretor.length > 0) {
        corretorNome = corretor[0].name || "";
      }
    }

    // Buscar linha do lead na planilha
    const rowIndex = await findLeadRowByPhone(leadData.telefone);
    
    if (!rowIndex) {
      return { 
        success: false, 
        message: `Lead com telefone ${leadData.telefone} não encontrado na planilha` 
      };
    }

    const sheets = getGoogleSheetsClient();

    // Atualizar coluna do corretor (J)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME_LEADS}!${COLUMNS.CORRETOR}${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[corretorNome]],
      },
    });

    // Atualizar coluna "Distribuído" (H)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME_LEADS}!${COLUMNS.DISTRIBUIDO}${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [["Sim"]],
      },
    });

    console.log(`[Sheets Sync] Lead ${leadData.nome} atualizado na planilha (linha ${rowIndex})`);

    return {
      success: true,
      message: `Lead ${leadData.nome} atualizado na planilha (linha ${rowIndex})`,
    };
  } catch (error) {
    console.error("[Sheets Sync] Erro ao atualizar lead na planilha:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Registra a distribuição de um lead no histórico da planilha
 * Adiciona uma nova linha na aba "Histórico Distribuição"
 */
export async function registrarDistribuicaoNaPlanilha(
  leadId: number
): Promise<{ success: boolean; message: string }> {
  try {
    const db = await getDb();
    if (!db) {
      return { success: false, message: "Database não disponível" };
    }

    // Buscar dados do lead e corretor
    const lead = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (lead.length === 0) {
      return { success: false, message: "Lead não encontrado" };
    }

    const leadData = lead[0];

    let corretorNome = "";
    if (leadData.corretorId) {
      const corretor = await db
        .select()
        .from(users)
        .where(eq(users.id, leadData.corretorId))
        .limit(1);

      if (corretor.length > 0) {
        corretorNome = corretor[0].name || "";
      }
    }

    const sheets = getGoogleSheetsClient();

    // Preparar dados para o histórico
    // Colunas: Data/Hora | Base | ID | Nome | Email | Telefone | Origem | Gerente | Consultor | URL
    const dataHora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const baseOrigem = leadData.projectId ? `Projeto ${leadData.projectId}` : "CRM";
    const idLead = leadData.id.toString();
    const nomeLead = leadData.nome;
    const emailLead = leadData.email || "";
    const telefoneLead = leadData.telefone;
    const origemCanal = "CRM - Distribuição Automática";
    const gerente = "Sistema"; // Pode ser ajustado conforme necessário
    const consultor = corretorNome;
    const urlConsultor = ""; // Pode ser adicionado se necessário

    const novaLinha = [
      dataHora,
      baseOrigem,
      idLead,
      nomeLead,
      emailLead,
      telefoneLead,
      origemCanal,
      gerente,
      consultor,
      urlConsultor,
    ];

    // Adicionar nova linha no histórico
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME_HISTORICO}!A:J`,
      valueInputOption: "RAW",
      requestBody: {
        values: [novaLinha],
      },
    });

    console.log(`[Sheets Sync] Distribuição registrada no histórico: ${leadData.nome} → ${corretorNome}`);

    return {
      success: true,
      message: `Distribuição registrada no histórico`,
    };
  } catch (error) {
    console.error("[Sheets Sync] Erro ao registrar no histórico:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Sincroniza um lead distribuído com a planilha
 * Atualiza a linha do lead E registra no histórico
 */
export async function sincronizarLeadDistribuido(
  leadId: number
): Promise<{ success: boolean; message: string; details: string[] }> {
  const details: string[] = [];

  // Atualizar lead na planilha
  const resultadoAtualizacao = await atualizarLeadNaPlanilha(leadId);
  details.push(`Atualização: ${resultadoAtualizacao.message}`);

  if (!resultadoAtualizacao.success) {
    return {
      success: false,
      message: "Falha ao atualizar lead na planilha",
      details,
    };
  }

  // Registrar no histórico
  const resultadoHistorico = await registrarDistribuicaoNaPlanilha(leadId);
  details.push(`Histórico: ${resultadoHistorico.message}`);

  if (!resultadoHistorico.success) {
    return {
      success: false,
      message: "Lead atualizado, mas falha ao registrar no histórico",
      details,
    };
  }

  return {
    success: true,
    message: "Lead sincronizado com sucesso",
    details,
  };
}

/**
 * Testa a conexão com Google Sheets
 */
export async function testarConexaoSheets(): Promise<{ 
  success: boolean; 
  message: string;
  spreadsheetTitle?: string;
}> {
  try {
    const sheets = getGoogleSheetsClient();

    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    return {
      success: true,
      message: "Conexão estabelecida com sucesso",
      spreadsheetTitle: response.data.properties?.title || undefined,
    };
  } catch (error) {
    console.error("[Sheets Sync] Erro ao testar conexão:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}
