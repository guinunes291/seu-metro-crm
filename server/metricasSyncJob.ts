/**
 * Job de Sincronização de Métricas
 * 
 * Sincroniza todas as métricas de performance pela data de criação dos registros.
 * Executa a cada 10 minutos para manter os dashboards atualizados sem sobrecarregar o banco.
 */

import { sincronizarTodasMetricasDoDia } from "./db";

let isRunning = false;

export async function startMetricasSyncJob() {
  console.log("[Métricas Sync Job] Iniciando job de sincronização de métricas (intervalo: 10 minutos)");
  
  // Executar imediatamente na inicialização
  await runSync();
  
  // Executar a cada 10 minutos (reduzido de 5 min para diminuir carga no banco)
  setInterval(async () => {
    await runSync();
  }, 10 * 60 * 1000); // 10 minutos
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
