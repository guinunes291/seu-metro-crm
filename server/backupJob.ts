/**
 * Job de Backup Automático — versão robusta
 *
 * Estratégia: setInterval a cada 10 minutos verificando se chegou o horário.
 * Isso garante funcionamento mesmo após reinicializações, pois não depende de
 * um único setTimeout que pode ser perdido quando o servidor hiberna.
 *
 * Horário: diariamente às 3h da manhã (horário de Brasília, UTC-3)
 * Na inicialização: executa backup imediato se o backup de hoje ainda não foi feito.
 *
 * Rastreamento: usa a tabela system_config no banco de dados para persistir
 * a data do último backup entre reinicializações do servidor.
 */

import { performBackup } from "./backup";
import { getSystemConfig, setSystemConfig } from "./systemConfigDb";

let isRunning = false;
let checkInterval: ReturnType<typeof setInterval> | null = null;

const LAST_BACKUP_KEY = "last_backup_date";

/**
 * Retorna a data de hoje no formato YYYY-MM-DD no fuso de Brasília
 */
function todayBrasilia(): string {
  return new Date()
    .toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .split("/")
    .reverse()
    .join("-"); // dd/mm/yyyy → yyyy-mm-dd
}

/**
 * Retorna a hora atual em Brasília (0–23)
 */
function hourBrasilia(): number {
  const timeStr = new Date().toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hour12: false,
  });
  return parseInt(timeStr, 10);
}

/**
 * Lê a data do último backup do banco de dados
 */
async function getLastBackupDate(): Promise<string | null> {
  return await getSystemConfig(LAST_BACKUP_KEY);
}

/**
 * Salva a data do último backup no banco de dados
 */
async function saveLastBackupDate(date: string): Promise<void> {
  await setSystemConfig(LAST_BACKUP_KEY, date);
}

/**
 * Executa o backup e registra a data
 */
async function runBackup(reason: string = "agendado"): Promise<void> {
  if (isRunning) {
    console.log("[Backup Job] Backup já em execução, pulando...");
    return;
  }

  isRunning = true;
  console.log(`[Backup Job] Iniciando backup ${reason}...`);

  try {
    const result = await performBackup();

    if (result.success) {
      const today = todayBrasilia();
      await saveLastBackupDate(today);
      console.log(`[Backup Job] ✅ Backup concluído com sucesso!`);
      console.log(`[Backup Job] Arquivo: ${result.filename}`);
      console.log(`[Backup Job] URL: ${result.url}`);
      console.log(
        `[Backup Job] Tabelas: ${result.tables
          .map((t) => `${t.name}(${t.rowCount})`)
          .join(", ")}`
      );
    } else {
      console.error(`[Backup Job] ❌ Falha no backup: ${result.error}`);
    }
  } catch (error) {
    console.error("[Backup Job] Erro ao executar backup:", error);
  } finally {
    isRunning = false;
  }
}

/**
 * Inicia o job de backup automático.
 *
 * - Executa backup imediato na inicialização se o backup de hoje ainda não foi feito.
 * - Verifica a cada 10 minutos se chegou o horário (3h em Brasília).
 * - Resistente a hibernações e reinicializações do servidor.
 */
export async function startBackupJob(): Promise<void> {
  console.log(
    "[Backup Job] Inicializando job de backup automático (diário às 3h, horário de Brasília)"
  );

  const lastBackupDate = await getLastBackupDate();
  const today = todayBrasilia();

  if (lastBackupDate !== today) {
    // Backup de hoje ainda não foi feito — executar após 15s (servidor inicializando)
    console.log(
      `[Backup Job] Último backup: ${lastBackupDate || "nunca"}. Backup imediato em 15s...`
    );
    setTimeout(() => runBackup("imediato (primeiro do dia)"), 15_000);
  } else {
    console.log(
      `[Backup Job] Backup de hoje (${today}) já realizado. Próximo às 3h.`
    );
  }

  // Verificar a cada 10 minutos se chegou o horário do backup diário (reduzido de 60s — economia de Cloud)
  checkInterval = setInterval(async () => {
    const hour = hourBrasilia();
    const currentDate = todayBrasilia();
    const lastDate = await getLastBackupDate();

    // Executar se: hora >= 3h E backup de hoje ainda não foi feito
    if (hour >= 3 && lastDate !== currentDate) {
      console.log(
        `[Backup Job] Horário de backup atingido (${hour}h em Brasília). Iniciando...`
      );
      await runBackup("diário agendado");
    }
  }, 10 * 60_000);

  console.log(
    "[Backup Job] Job de backup automático inicializado (verificação a cada 10 minutos)"
  );
}

/**
 * Para o job de backup (útil para testes)
 */
export function stopBackupJob(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    console.log("[Backup Job] Job de backup parado");
  }
}
