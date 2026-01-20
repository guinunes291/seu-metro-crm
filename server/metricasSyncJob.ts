/**
 * Job de Sincronização de Métricas
 * 
 * Sincroniza todas as métricas de performance pela data de criação dos registros.
 * Executa a cada 10 segundos para garantir que os dashboards estejam sempre atualizados em tempo real.
 */

import { sincronizarTodasMetricasDoDia } from "./db";

let isRunning = false;

export async function startMetricasSyncJob() {
  console.log("[Métricas Sync Job] Iniciando job de sincronização de métricas (intervalo: 10 segundos)");
  
  // Executar imediatamente na inicialização
  await runSync();
  
  // Executar a cada 10 segundos
  setInterval(async () => {
    await runSync();
  }, 10 * 1000); // 10 segundos
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
