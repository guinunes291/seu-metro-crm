import { getDb } from "./db";
import { leads } from "../drizzle/schema";
import { and, eq, lt, sql } from "drizzle-orm";
import { distribuirLeadParaProximoCorretor } from "./distribution";

/**
 * Job que verifica leads com timer ativo que ultrapassaram 5 minutos sem serem trabalhados
 * Executa a cada 1 minuto
 */
export async function verificarTimerLeads() {
  try {
    const db = await getDb();
    if (!db) {
      console.error("[Timer Job] Banco de dados não disponível");
      return;
    }
    const agora = new Date();
    const cincoMinutosAtras = new Date(agora.getTime() - 5 * 60 * 1000);

    console.log(`[Timer Job] Verificando leads com timer ativo...`);

    // Buscar leads com timer ativo que ultrapassaram 5 minutos
    // e ainda estão em status "aguardando_atendimento"
    const leadsExpirados = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.timerAtivo, true),
          eq(leads.status, "aguardando_atendimento"),
          lt(leads.timestampRecebimento, cincoMinutosAtras)
        )
      );

    console.log(`[Timer Job] Encontrados ${leadsExpirados.length} leads expirados`);

    for (const lead of leadsExpirados) {
      try {
        console.log(
          `[Timer Job] Lead ${lead.id} (${lead.nome}) expirou - tentando redistribuir...`
        );

        // Desativar timer do lead atual
        await db
          .update(leads)
          .set({
            timerAtivo: false,
            tentativasRedistribuicao: (lead.tentativasRedistribuicao || 0) + 1,
          })
          .where(eq(leads.id, lead.id));

        // Tentar redistribuir para próximo corretor
        const resultado = await distribuirLeadParaProximoCorretor(lead.id, lead.origem);

        if (resultado.sucesso) {
          console.log(
            `[Timer Job] Lead ${lead.id} redistribuído com sucesso para corretor ${resultado.corretorId}`
          );
        } else {
          console.log(
            `[Timer Job] Lead ${lead.id} foi para estoque: ${resultado.motivo}`
          );
        }
      } catch (error) {
        console.error(`[Timer Job] Erro ao processar lead ${lead.id}:`, error);
      }
    }

    console.log(`[Timer Job] Verificação concluída`);
  } catch (error) {
    console.error("[Timer Job] Erro na verificação de timer:", error);
  }
}

// Job será executado pelo distribuicaoJob.ts
