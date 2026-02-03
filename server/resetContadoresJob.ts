/**
 * Job de Reset de Contadores Diários
 * 
 * Executa reset dos contadores "Leads Hoje" à meia-noite (00:00) horário de São Paulo
 * para garantir que os contadores comecem zerados a cada novo dia.
 */

import { getDb } from "./db";
import { filaDistribuicao } from "../drizzle/schema";

let isRunning = false;

/**
 * Inicia o job de reset de contadores diários
 * Executa diariamente à meia-noite (00:00 horário de São Paulo)
 */
export async function startResetContadoresJob() {
  console.log("[Reset Contadores Job] Inicializando job de reset diário (meia-noite)");
  
  // Agendar execução diária à meia-noite
  scheduleDailyReset();
  
  console.log("[Reset Contadores Job] Job de reset de contadores inicializado");
}

/**
 * Agenda reset diário à meia-noite (00:00 horário de São Paulo)
 */
function scheduleDailyReset() {
  // Calcular tempo até próxima meia-noite
  const now = new Date();
  const nextRun = new Date();
  
  // Configurar para meia-noite (00:00)
  nextRun.setHours(24, 0, 0, 0); // 24h = próxima meia-noite
  
  const msUntilNextRun = nextRun.getTime() - now.getTime();
  
  console.log(`[Reset Contadores Job] Próximo reset agendado para: ${nextRun.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  
  // Agendar primeira execução
  setTimeout(async () => {
    await runReset();
    
    // Agendar execuções diárias (24 horas)
    setInterval(async () => {
      await runReset();
    }, 24 * 60 * 60 * 1000); // 24 horas
  }, msUntilNextRun);
}

/**
 * Executa o reset dos contadores
 */
async function runReset() {
  if (isRunning) {
    console.log("[Reset Contadores Job] Reset já em execução, aguardando...");
    return;
  }
  
  isRunning = true;
  
  try {
    console.log("[Reset Contadores Job] Iniciando reset de contadores diários...");
    
    const db = await getDb();
    if (!db) {
      console.error("[Reset Contadores Job] Banco de dados não disponível");
      return;
    }
    
    // Resetar leadsRecebidosHoje de todos os corretores na fila
    await db.update(filaDistribuicao)
      .set({ leadsRecebidosHoje: 0 });
    
    console.log("[Reset Contadores Job] Contadores resetados com sucesso");
    
  } catch (error) {
    console.error("[Reset Contadores Job] Erro ao resetar contadores:", error);
  } finally {
    isRunning = false;
  }
}
