/**
 * Job de Backup Automático
 * 
 * Executa backup diário de todas as tabelas críticas às 3h da manhã (horário de Brasília)
 * e armazena no S3 para garantir durabilidade dos dados.
 */

import { performBackup } from "./backup";

let isRunning = false;

/**
 * Inicia o job de backup automático
 * Executa diariamente às 3h da manhã (horário de Brasília)
 */
export async function startBackupJob() {
  console.log("[Backup Job] Inicializando job de backup automático (diário às 3h)");
  
  // Agendar execução diária às 3h da manhã
  scheduleDailyBackup();
  
  console.log("[Backup Job] Job de backup automático inicializado");
}

/**
 * Agenda backup diário às 3h da manhã (horário de Brasília)
 */
function scheduleDailyBackup() {
  // Calcular tempo até próxima execução às 3h
  const now = new Date();
  const nextRun = new Date();
  
  // Configurar para 3h da manhã
  nextRun.setHours(3, 0, 0, 0);
  
  // Se já passou das 3h hoje, agendar para amanhã
  if (now.getHours() >= 3) {
    nextRun.setDate(nextRun.getDate() + 1);
  }
  
  const msUntilNextRun = nextRun.getTime() - now.getTime();
  
  console.log(`[Backup Job] Próximo backup agendado para: ${nextRun.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  
  // Agendar primeira execução
  setTimeout(async () => {
    await runBackup();
    
    // Agendar execuções diárias (24 horas)
    setInterval(async () => {
      await runBackup();
    }, 24 * 60 * 60 * 1000); // 24 horas
  }, msUntilNextRun);
}

/**
 * Executa o backup
 */
async function runBackup() {
  if (isRunning) {
    console.log("[Backup Job] Backup já em execução, pulando...");
    return;
  }
  
  isRunning = true;
  
  try {
    console.log("[Backup Job] Iniciando backup automático...");
    const result = await performBackup();
    
    if (result.success) {
      console.log(`[Backup Job] ✅ Backup concluído com sucesso!`);
      console.log(`[Backup Job] Arquivo: ${result.filename}`);
      console.log(`[Backup Job] URL: ${result.url}`);
      console.log(`[Backup Job] Tabelas: ${result.tables.map(t => `${t.name}(${t.rowCount})`).join(", ")}`);
    } else {
      console.error(`[Backup Job] ❌ Falha no backup: ${result.error}`);
    }
  } catch (error) {
    console.error("[Backup Job] Erro ao executar backup:", error);
  } finally {
    isRunning = false;
  }
}
