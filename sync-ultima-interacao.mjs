import { getDb } from "./server/db.js";
import { leads, leadHistory } from "./drizzle/schema.js";
import { eq, desc } from "drizzle-orm";

/**
 * Script para sincronizar o campo ultimaInteracao de todos os leads
 * com base na interação mais recente do histórico
 */

async function syncUltimaInteracao() {
  const db = await getDb();
  if (!db) {
    console.error("Banco de dados não disponível");
    process.exit(1);
  }

  console.log("[Sync] Buscando todos os leads...");
  
  const allLeads = await db.select({ id: leads.id }).from(leads);
  
  console.log(`[Sync] Encontrados ${allLeads.length} leads`);
  
  let atualizados = 0;
  let semHistorico = 0;
  
  for (const lead of allLeads) {
    // Buscar a interação mais recente do histórico
    const ultimaInteracaoHistorico = await db
      .select({ createdAt: leadHistory.createdAt })
      .from(leadHistory)
      .where(eq(leadHistory.leadId, lead.id))
      .orderBy(desc(leadHistory.createdAt))
      .limit(1);
    
    if (ultimaInteracaoHistorico.length > 0) {
      // Atualizar o campo ultimaInteracao do lead
      await db
        .update(leads)
        .set({ ultimaInteracao: ultimaInteracaoHistorico[0].createdAt })
        .where(eq(leads.id, lead.id));
      
      atualizados++;
      
      if (atualizados % 100 === 0) {
        console.log(`[Sync] ${atualizados} leads atualizados...`);
      }
    } else {
      semHistorico++;
    }
  }
  
  console.log(`[Sync] Sincronização concluída!`);
  console.log(`[Sync] - Leads atualizados: ${atualizados}`);
  console.log(`[Sync] - Leads sem histórico: ${semHistorico}`);
  
  process.exit(0);
}

syncUltimaInteracao().catch(err => {
  console.error("[Sync] Erro:", err);
  process.exit(1);
});
