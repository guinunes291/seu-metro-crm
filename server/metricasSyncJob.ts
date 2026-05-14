/**
 * Job de Sincronização de Métricas
 *
 * Sincroniza todas as métricas de performance pela data de criação dos registros.
 * Executa a cada 15 minutos (reduzido de 5 min — a TV e o Dashboard toleram dados
 * com até 15 min de defasagem sem impacto perceptível para o usuário).
 *
 * Startup: aguarda 90s antes do primeiro ciclo para não sobrecarregar o banco
 * durante o cold start, quando jobs de distribuição e timer também iniciam.
 */

import {
  sincronizarInteracoesDoDia,
  sincronizarAgendamentosDoDia,
  sincronizarVisitasDoDia,
  sincronizarDocumentacoesDoDia,
  sincronizarAnalisesCreditoDoDia,
  sincronizarContratosDoDia,
} from "./db";

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutos
const STARTUP_DELAY_MS = 90 * 1000;  // 90 segundos de espera no startup

let isRunning = false;

export function startMetricasSyncJob() {
  console.log(`[Métricas Sync Job] Agendado: primeira execução em ${STARTUP_DELAY_MS / 1000}s, depois a cada ${INTERVAL_MS / 60000} minutos`);

  // Primeira execução adiada — deixa o servidor estabilizar
  setTimeout(() => {
    runSync().catch(console.error);
    setInterval(() => runSync().catch(console.error), INTERVAL_MS);
  }, STARTUP_DELAY_MS);
}

async function runSync() {
  if (isRunning) {
    console.log("[Métricas Sync Job] Sincronização já em execução, pulando...");
    return;
  }

  isRunning = true;

  try {
    console.log("[Métricas Sync Job] Executando sincronização paralela de métricas...");
    const inicio = Date.now();

    // Executa as 6 sincronizações em paralelo em vez de sequencialmente
    await Promise.all([
      sincronizarInteracoesDoDia(),
      sincronizarAgendamentosDoDia(),
      sincronizarVisitasDoDia(),
      sincronizarDocumentacoesDoDia(),
      sincronizarAnalisesCreditoDoDia(),
      sincronizarContratosDoDia(),
    ]);

    console.log(`[Métricas Sync Job] Sincronização concluída em ${Date.now() - inicio}ms`);
  } catch (error) {
    console.error("[Métricas Sync Job] Erro na sincronização:", error);
  } finally {
    isRunning = false;
  }
}
