import { syncAllBI } from "./biSync";

/**
 * Job de Sincronização Automática com Google Sheets para BI
 * Sincroniza Contratos, Métricas e Performance a cada 1 hora
 */

let syncInterval: NodeJS.Timeout | null = null;

/**
 * Executa sincronização completa
 */
async function executarSincronizacao() {
  try {
    console.log("[BI Sync Job] Iniciando sincronização automática...");
    
    const result = await syncAllBI();
    
    const totalSuccess = result.contratos.success + result.metricas.success + result.performance.success;
    const totalErrors = result.contratos.errors + result.metricas.errors + result.performance.errors;
    
    if (totalErrors === 0) {
      console.log(
        `[BI Sync Job] Sincronização concluída com sucesso: ${result.contratos.success} contratos, ${result.metricas.success} dias de métricas, ${result.performance.success} corretores`
      );
    } else {
      console.error(
        `[BI Sync Job] Sincronização concluída com erros: ${totalSuccess} sucessos, ${totalErrors} erros`
      );
    }
  } catch (error: any) {
    console.error("[BI Sync Job] Erro na sincronização automática:", error.message);
  }
}

/**
 * Inicia o job de sincronização automática
 */
export function startBISyncJob() {
  if (syncInterval) {
    console.log("[BI Sync Job] Job já está rodando");
    return;
  }

  // Executar primeira sincronização após 5 minutos (para não sobrecarregar o startup)
  setTimeout(() => {
    console.log("[BI Sync Job] Executando primeira sincronização...");
    executarSincronizacao();
  }, 5 * 60 * 1000);

  // Executar sincronização a cada 4 horas (reduzido de 1h para economizar 4x queries no banco)
  syncInterval = setInterval(() => {
    executarSincronizacao();
  }, 4 * 60 * 60 * 1000); // 4 horas em ms

  console.log("[BI Sync Job] Job de sincronização BI iniciado (intervalo: 4 horas)");
}

/**
 * Para o job de sincronização automática
 */
export function stopBISyncJob() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log("[BI Sync Job] Job de sincronização BI parado");
  }
}
