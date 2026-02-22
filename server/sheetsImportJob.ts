/**
 * Job de Importação Automática de Leads da Planilha Google Sheets
 * 
 * Importa novos leads da planilha "Leads para distribuição" a cada 5 minutos
 * Sincronização bidirecional: Planilha → CRM (este job) + CRM → Planilha (googleSheetsSync.ts)
 */

import { syncLeadsFromSheet } from "./sheetsImport";

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1_ufbbfWlo3SRgvng1PvpYCNAHycOMaYmnP4j5ENErLE";
const SHEET_RANGE = "Leads para distribuição!A:H";

let isRunning = false;

/**
 * Inicia o job de importação automática
 * Executa a cada 5 minutos
 */
export async function startSheetsImportJob() {
  console.log("[Sheets Import Job] Inicializando job de importação automática (intervalo: 5 minutos)");
  
  // Executar imediatamente na inicialização (após 30 segundos)
  setTimeout(async () => {
    await runImport();
  }, 30000); // 30 segundos
  
  // Executar a cada 5 minutos
  setInterval(async () => {
    await runImport();
  }, 5 * 60 * 1000); // 5 minutos
  
  console.log("[Sheets Import Job] Job de importação automática inicializado");
}

/**
 * Executa a importação de leads
 */
async function runImport() {
  if (isRunning) {
    console.log("[Sheets Import Job] Importação já em execução, pulando...");
    return;
  }
  
  isRunning = true;
  
  try {
    console.log("[Sheets Import Job] Iniciando importação de leads da planilha...");
    
    const result = await syncLeadsFromSheet(SHEET_URL, SHEET_RANGE);
    
    if (result.imported > 0 || result.duplicates > 0 || result.errors > 0) {
      console.log(
        `[Sheets Import Job] Importação concluída: ${result.imported} novos, ${result.duplicates} duplicados, ${result.errors} erros`
      );
    } else {
      console.log("[Sheets Import Job] Nenhum lead novo para importar");
    }
  } catch (error) {
    console.error("[Sheets Import Job] Erro na importação:", error);
  } finally {
    isRunning = false;
  }
}
