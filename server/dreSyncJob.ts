/**
 * Sincronização com a Planilha DRE — APENAS MANUAL
 *
 * O job automático foi desativado por decisão do usuário para reduzir custos de Cloud.
 * A sincronização é acionada manualmente via procedure admin no painel.
 *
 * Também executa automaticamente após criar/editar/distratar um contrato (event-driven).
 *
 * Planilha DRE: https://docs.google.com/spreadsheets/d/10GeJ8Zba4kFUJa2HwvUVu09BDkGuKCQGrpBDaLVlr38
 */
import { sincronizarDRE } from "./dreSync";

let isRunning = false;

/**
 * Executa a sincronização com a planilha DRE (chamada manual ou event-driven)
 */
export async function runDreSync(reason: string = "manual"): Promise<void> {
  if (isRunning) {
    console.log("[DRE Sync] Sincronização já em execução, pulando...");
    return;
  }
  isRunning = true;
  console.log(`[DRE Sync] Iniciando sincronização ${reason}...`);
  try {
    const result = await sincronizarDRE();
    if (result.success) {
      console.log(
        `[DRE Sync] ✅ Concluída! ${result.totalContratos} contratos ativos, ${result.totalDistratados} distratados exportados para planilha DRE`
      );
    } else {
      console.error(`[DRE Sync] ❌ Falha: ${result.error}`);
    }
  } catch (err: any) {
    console.error("[DRE Sync] Erro:", err.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Stub mantido para compatibilidade — não inicia nenhum job automático
 */
export async function startDreSyncJob(): Promise<void> {
  console.log("[DRE Sync] Job automático DESATIVADO — sincronização apenas manual ou event-driven.");
}

/**
 * Stub mantido para compatibilidade
 */
export function stopDreSyncJob(): void {
  // noop
}
