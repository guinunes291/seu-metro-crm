/**
 * Job para limpeza automática de links de agendamento expirados
 * Executa a cada 1 minuto para remover links que passaram da data de validade
 */

import { getDb } from "./db";
import { linksAgendamento } from "../drizzle/schema";
import { lt, and, isNotNull } from "drizzle-orm";

export async function limparLinksExpirados(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const agora = new Date();
  
  // Buscar e deletar links expirados
  const result = await db.delete(linksAgendamento)
    .where(
      and(
        isNotNull(linksAgendamento.validoAte),
        lt(linksAgendamento.validoAte, agora)
      )
    );
  
  return result.rowsAffected || 0;
}

export function iniciarJobLimpezaLinks(): void {
  console.log("[Links Cleanup Job] Iniciando limpeza automática de links expirados...");
  
  // Executar imediatamente na inicialização
  limparLinksExpirados().then(count => {
    if (count > 0) {
      console.log(`[Links Cleanup Job] ${count} links expirados removidos na inicialização`);
    }
  });
  
  // Executar a cada 10 minutos (reduzido de 1 min para diminuir carga no banco)
  setInterval(async () => {
    try {
      const count = await limparLinksExpirados();
      if (count > 0) {
        console.log(`[Links Cleanup Job] ${count} links expirados removidos`);
      }
    } catch (error) {
      console.error("[Links Cleanup Job] Erro ao limpar links expirados:", error);
    }
  }, 60 * 60 * 1000); // 1 hora (reduzido de 10min — links expirados não precisam ser limpos com urgência)
}
