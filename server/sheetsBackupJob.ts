/**
 * Job de Backup Horário para Google Sheets
 *
 * Executa a cada hora para exportar todos os dados críticos do banco
 * para a planilha de backup no Google Sheets.
 *
 * Também executa imediatamente na inicialização do servidor se o
 * último backup foi há mais de 1 hora.
 */

import { performSheetsBackup } from "./sheetsBackup";
import { getSystemConfig, setSystemConfig } from "./systemConfigDb";

const LAST_SHEETS_BACKUP_KEY = "last_sheets_backup_date";

const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 horas (backup diário — economiza 24x queries vs backup horário original)

let isRunning = false;
let jobInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Retorna o timestamp do último backup (em ms) ou 0 se nunca executou
 */
function getLastBackupTime(): number {
  try {
    if (existsSync(LAST_SHEETS_BACKUP_FILE)) {
      return parseInt(readFileSync(LAST_SHEETS_BACKUP_FILE, "utf-8").trim(), 10) || 0;
    }
  } catch {}
  return 0;
}

/**
 * Salva o timestamp do backup atual
 */
function saveLastBackupTime(): void {
  try {
    writeFileSync(LAST_SHEETS_BACKUP_FILE, String(Date.now()), "utf-8");
  } catch {}
}

/**
 * Executa o backup para o Google Sheets
 */
async function runSheetsBackup(reason: string = "horário"): Promise<void> {
  if (isRunning) {
    console.log("[Sheets Backup Job] Backup já em execução, pulando...");
    return;
  }

  isRunning = true;
  console.log(`[Sheets Backup Job] Iniciando backup ${reason}...`);

  try {
    const result = await performSheetsBackup();
    if (result.success) {
      saveLastBackupTime();
      const total = result.tables.filter(t => t.rowCount > 0).reduce((s, t) => s + t.rowCount, 0);
      console.log(`[Sheets Backup Job] ✅ Backup concluído! ${total} registros exportados para Google Sheets`);
    } else {
      console.error(`[Sheets Backup Job] ❌ Falha: ${result.error}`);
    }
  } catch (err: any) {
    console.error("[Sheets Backup Job] Erro:", err.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Inicia o job de backup horário para Google Sheets
 */
export async function startSheetsBackupJob(): Promise<void> {
  console.log("[Sheets Backup Job] Inicializando job de backup horário para Google Sheets...");

  const lastBackup = getLastBackupTime();
  const timeSinceLast = Date.now() - lastBackup;

  if (timeSinceLast > BACKUP_INTERVAL_MS || lastBackup === 0) {
    // Último backup foi há mais de 24 horas (ou nunca executou) — executar após 20s
    const minutesAgo = lastBackup === 0 ? "nunca" : `${Math.round(timeSinceLast / 60000)} min atrás`;
    console.log(`[Sheets Backup Job] Último backup: ${minutesAgo}. Executando em 20s...`);
    setTimeout(() => runSheetsBackup("imediato (inicialização)"), 20_000);
  } else {
    const nextIn = Math.round((BACKUP_INTERVAL_MS - timeSinceLast) / 60000);
    console.log(`[Sheets Backup Job] Próximo backup em ~${nextIn} minutos`);
  }

  // Executar a cada 24 horas
  jobInterval = setInterval(() => runSheetsBackup("horário agendado"), BACKUP_INTERVAL_MS);

  console.log("[Sheets Backup Job] Job inicializado (execução diária a cada 24 horas)");
}

/**
 * Para o job (útil para testes)
 */
export function stopSheetsBackupJob(): void {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
  }
}
