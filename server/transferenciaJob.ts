import { getDb } from "./db";
import { distribuirLeadAutomatico } from "./distribution";
import { leads } from "../drizzle/schema";
import { and, eq, lt, isNotNull } from "drizzle-orm";
import { isLeadProtegidoCarteira } from "./routers/carteiraAtiva";

/**
 * Job de transferência automática de leads sem interação
 * 
 * Fluxo:
 * 1. Busca leads com aguardandoTransferencia = true
 * 2. Verifica se dataUltimaInteracao foi há mais de 2 dias
 * 3. Transfere para outro corretor (exceto origem "captacao_corretor")
 * 4. Leads na Carteira Ativa são IMUNES a esta transferência
 * 5. Novo corretor recebe lead em status "em_atendimento" com follow-up para amanhã
 */
export async function verificarTransferenciasAutomaticas() {
  console.log("[Transferência Job] Verificando leads para transferência automática...");
  
  try {
    const db = await getDb();
    if (!db) {
      console.error("[Transferência Job] Database não disponível");
      return { transferidos: 0, erros: 0 };
    }
    
    // Calcular data limite (2 dias atrás)
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 2);
    
    // Buscar leads sem interação há mais de 2 dias (status em_atendimento)
    const leadsParaTransferir = await db.select()
      .from(leads)
      .where(and(
        isNotNull(leads.ultimaInteracao),
        lt(leads.ultimaInteracao, dataLimite),
        eq(leads.status, "em_atendimento"), // Apenas leads em atendimento
        isNotNull(leads.corretorId) // Apenas leads atribuídos
      ));
    
    if (leadsParaTransferir.length === 0) {
      console.log("[Transferência Job] Nenhum lead para transferir");
      return { transferidos: 0, erros: 0 };
    }
    
    console.log(`[Transferência Job] Encontrados ${leadsParaTransferir.length} leads para transferir`);
    
    let transferidos = 0;
    let erros = 0;
    let imunes = 0;
    
    for (const lead of leadsParaTransferir) {
      try {
        // Não transferir leads de origem "captacao_corretor"
        if (lead.origem === "captacao_corretor") {
          console.log(`[Transferência Job] Lead ${lead.id} ignorado (origem: captacao_corretor)`);
          continue;
        }
        
        // ⚠️ IMUNIDADE: Não transferir leads protegidos pela Carteira Ativa
        const protegido = await isLeadProtegidoCarteira(lead.id);
        if (protegido) {
          console.log(`[Transferência Job] Lead ${lead.id} IMUNE (Carteira Ativa ativa)`);
          imunes++;
          continue;
        }
        
        // Transferir para outro corretor usando distribuirLeadAutomatico
        const resultado = await distribuirLeadAutomatico(lead.id);
        
        if (resultado.success) {
          transferidos++;
          console.log(`[Transferência Job] Lead ${lead.id} transferido com sucesso para corretor ${resultado.corretorId}`);
        } else {
          erros++;
          console.error(`[Transferência Job] Erro ao transferir lead ${lead.id}:`, resultado.message);
        }
      } catch (error) {
        erros++;
        console.error(`[Transferência Job] Erro ao processar lead ${lead.id}:`, error);
      }
    }
    
    console.log(`[Transferência Job] Concluído: ${transferidos} transferidos, ${imunes} imunes (Carteira Ativa), ${erros} erros`);
    
    return { transferidos, erros, imunes };
  } catch (error) {
    console.error("[Transferência Job] Erro na verificação:", error);
    return { transferidos: 0, erros: 0 };
  }
}
