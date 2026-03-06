/**
 * Job de Sincronização Automática com a Planilha DRE
 *
 * Executa a cada hora para sincronizar todos os contratos do CRM
 * com a aba "Lançamentos" da planilha DRE do Google Sheets.
 *
 * Também executa imediatamente após criar/editar/distratar um contrato.
 *
 * Planilha DRE: https://docs.google.com/spreadsheets/d/10GeJ8Zba4kFUJa2HwvUVu09BDkGuKCQGrpBDaLVlr38
 */
import { sincronizarDRE } from "./dreSync";
import { writeFileSync, readFileSync, existsSync } from "fs";

const LAST_DRE_SYNC_FILE = "/tmp/last-dre-sync.txt";
const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hora

let isRunning = false;
let jobInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Retorna o timestamp da última sincronização (em ms) ou 0 se nunca executou
 */
function getLastSyncTime(): number {
  try {
    if (existsSync(LAST_DRE_SYNC_FILE)) {
      return parseInt(readFileSync(LAST_DRE_SYNC_FILE, "utf-8").trim(), 10) || 0;
    }
  } catch {}
  return 0;
}

/**
 * Salva o timestamp da sincronização atual
 */
function saveLastSyncTime(): void {
  try {
    writeFileSync(LAST_DRE_SYNC_FILE, String(Date.now()), "utf-8");
  } catch {}
}

/**
 * Executa a sincronização com a planilha DRE
 */
export async function runDreSync(reason: string = "horário"): Promise<void> {
  if (isRunning) {
    console.log("[DRE Sync Job] Sincronização já em execução, pulando...");
    return;
  }
  isRunning = true;
  console.log(`[DRE Sync Job] Iniciando sincronização ${reason}...`);
  try {
    const result = await sincronizarDRE();
    if (result.success) {
      saveLastSyncTime();
      console.log(
        `[DRE Sync Job] ✅ Sincronização concluída! ${result.totalContratos} contratos ativos, ${result.totalDistratados} distratados exportados para planilha DRE`
      );
    } else {
      console.error(`[DRE Sync Job] ❌ Falha: ${result.error}`);
    }
  } catch (err: any) {
    console.error("[DRE Sync Job] Erro:", err.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Inicia o job de sincronização horária com a planilha DRE
 */
export async function startDreSyncJob(): Promise<void> {
  console.log("[DRE Sync Job] Inicializando job de sincronização com planilha DRE...");

  const lastSync = getLastSyncTime();
  const timeSinceLast = Date.now() - lastSync;

  if (timeSinceLast > SYNC_INTERVAL_MS || lastSync === 0) {
    const minutesAgo = lastSync === 0 ? "nunca" : `${Math.round(timeSinceLast / 60000)} min atrás`;
    console.log(`[DRE Sync Job] Última sincronização: ${minutesAgo}. Executando em 30s...`);
    // Executar após 30s para não sobrecarregar na inicialização
    setTimeout(() => runDreSync("imediato (inicialização)"), 30_000);
  } else {
    const nextIn = Math.round((SYNC_INTERVAL_MS - timeSinceLast) / 60000);
    console.log(`[DRE Sync Job] Próxima sincronização em ~${nextIn} minutos`);
  }

  // Executar a cada 1 hora
  jobInterval = setInterval(() => runDreSync("horário agendado"), SYNC_INTERVAL_MS);
  console.log("[DRE Sync Job] Job inicializado (execução a cada 1 hora)");
}

/**
 * Para o job (útil para testes)
 */
export function stopDreSyncJob(): void {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
  }
}
