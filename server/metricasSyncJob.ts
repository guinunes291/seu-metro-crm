/**
 * Job de Sincronização de Métricas
 * 
 * Sincroniza todas as métricas de performance pela data de criação dos registros.
 * Executa a cada 30 minutos para reduzir carga no banco (era 10 min — 3x menos queries).
 */

import { sincronizarTodasMetricasDoDia } from "./db";

let isRunning = false;

export async function startMetricasSyncJob() {
  console.log("[Métricas Sync Job] Iniciando job de sincronização de métricas (intervalo: 30 minutos)");
  
  // Executar imediatamente na inicialização
  await runSync();
  
  // Executar a cada 30 minutos (reduzido de 10 min para economizar recursos — 3x menos queries)
  setInterval(async () => {
    await runSync();
  }, 30 * 60 * 1000); // 30 minutos
}

async function runSync() {
  if (isRunning) {
    console.log("[Métricas Sync Job] Sincronização já em execução, pulando...");
    return;
  }
  
  isRunning = true;
  
  try {
    console.log("[Métricas Sync Job] Executando sincronização de métricas...");
    await sincronizarTodasMetricasDoDia();
    console.log("[Métricas Sync Job] Sincronização concluída com sucesso");
  } catch (error) {
    console.error("[Métricas Sync Job] Erro na sincronização:", error);
  } finally {
    isRunning = false;
  }
}
