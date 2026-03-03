import { getDb } from "./db";
import { leads, distributionLog, filaDistribuicao, users } from "../drizzle/schema";
import { and, eq, lt, sql, ne } from "drizzle-orm";

/**
 * ID do admin Guilherme Nunes - fallback quando nenhum corretor está disponível
 */
const ADMIN_GUILHERME_ID = 7722800;

/**
 * Tempo máximo em "Aguardando Atendimento" antes de redistribuir: 15 minutos
 */
const TIMER_MINUTOS = 15;

/**
 * Busca o próximo corretor apto na mesma fila de origem do lead.
 * - Se o lead é da fila foco (origemWebhook=true e projeto foco), busca na fila foco
 * - Caso contrário, busca na fila geral (filaDistribuicao)
 * - Exclui o corretor atual para não redistribuir para o mesmo
 * - Retorna null se nenhum corretor estiver disponível
 */
async function getProximoCorretorMesmaFila(
  corretorAtualId: number | null,
  leadId: number
): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  // Buscar corretores na fila geral que estejam presentes e ativos
  const candidatos = await db
    .select({
      corretorId: filaDistribuicao.corretorId,
      posicao: filaDistribuicao.posicao,
      ativo: filaDistribuicao.ativo,
      leadsRecebidosHoje: filaDistribuicao.leadsRecebidosHoje,
      corretorStatus: users.status,
      limiteDiarioWebhook: users.limiteDiarioWebhook,
      corretorNome: users.name,
    })
    .from(filaDistribuicao)
    .leftJoin(users, eq(filaDistribuicao.corretorId, users.id))
    .where(
      and(
        eq(filaDistribuicao.ativo, true),
        eq(users.status, "presente"),
        eq(users.role, "corretor"),
        // Excluir o corretor atual para não redistribuir para o mesmo
        corretorAtualId ? ne(filaDistribuicao.corretorId, corretorAtualId) : sql`1=1`
      )
    )
    .orderBy(filaDistribuicao.posicao);

  for (const candidato of candidatos) {
    // Verificar limite diário de webhook
    const limite = candidato.limiteDiarioWebhook ?? 50;
    const recebidosHoje = candidato.leadsRecebidosHoje ?? 0;

    if (recebidosHoje < limite) {
      return candidato.corretorId;
    }
  }

  return null;
}

/**
 * Job que verifica leads com timer ativo que ultrapassaram 15 minutos sem serem trabalhados.
 * Redistribui para o próximo corretor apto da mesma fila.
 * Se nenhum corretor estiver disponível, transfere para o admin Guilherme Nunes.
 * Executa a cada 1 minuto.
 */
export async function verificarTimerLeads() {
  try {
    const db = await getDb();
    if (!db) {
      console.error("[Timer Job] Banco de dados não disponível");
      return;
    }

    const agora = new Date();
    const limiteTempoAtras = new Date(agora.getTime() - TIMER_MINUTOS * 60 * 1000);

    console.log(`[Timer Job] Verificando leads com timer ativo (limite: ${TIMER_MINUTOS} min)...`);

    // Buscar leads com timer ativo que ultrapassaram 15 minutos
    // e ainda estão em status "aguardando_atendimento"
    const leadsExpirados = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.timerAtivo, true),
          eq(leads.status, "aguardando_atendimento"),
          lt(leads.timestampRecebimento, limiteTempoAtras)
        )
      );

    console.log(`[Timer Job] Encontrados ${leadsExpirados.length} leads expirados`);

    for (const lead of leadsExpirados) {
      try {
        console.log(
          `[Timer Job] Lead ${lead.id} (${lead.nome}) expirou após ${TIMER_MINUTOS} min - tentando redistribuir...`
        );

        // Desativar timer do lead atual e incrementar tentativas
        await db
          .update(leads)
          .set({
            timerAtivo: false,
            tentativasRedistribuicao: (lead.tentativasRedistribuicao || 0) + 1,
          })
          .where(eq(leads.id, lead.id));

        // Buscar próximo corretor apto na mesma fila (excluindo o atual)
        const proximoCorretorId = await getProximoCorretorMesmaFila(
          lead.corretorId,
          lead.id
        );

        if (proximoCorretorId) {
          // Redistribuir para o próximo corretor apto
          await db
            .update(leads)
            .set({
              corretorId: proximoCorretorId,
              timestampRecebimento: new Date(),
              timerAtivo: true,
              status: "aguardando_atendimento",
            })
            .where(eq(leads.id, lead.id));

          // Registrar no log de distribuição
          await db.insert(distributionLog).values({
            leadId: lead.id,
            corretorId: proximoCorretorId,
            tipo: "automatica",
            motivo: `Redistribuição automática por timeout de ${TIMER_MINUTOS} minutos`,
          });

          // Atualizar contador na fila
          await db
            .update(filaDistribuicao)
            .set({
              leadsRecebidosHoje: sql`${filaDistribuicao.leadsRecebidosHoje} + 1`,
              ultimaDistribuicao: new Date(),
            })
            .where(eq(filaDistribuicao.corretorId, proximoCorretorId));

          console.log(
            `[Timer Job] Lead ${lead.id} redistribuído para corretor ${proximoCorretorId}`
          );
        } else {
          // Nenhum corretor disponível → transferir para admin Guilherme Nunes
          console.log(
            `[Timer Job] Lead ${lead.id}: nenhum corretor disponível, transferindo para admin Guilherme Nunes (ID: ${ADMIN_GUILHERME_ID})`
          );

          await db
            .update(leads)
            .set({
              corretorId: ADMIN_GUILHERME_ID,
              timestampRecebimento: new Date(),
              timerAtivo: false,
              status: "aguardando_atendimento",
            })
            .where(eq(leads.id, lead.id));

          // Registrar no log de distribuição
          await db.insert(distributionLog).values({
            leadId: lead.id,
            corretorId: ADMIN_GUILHERME_ID,
            tipo: "automatica",
            motivo: `Fallback para admin: nenhum corretor disponível após timeout de ${TIMER_MINUTOS} minutos`,
          });

          console.log(
            `[Timer Job] Lead ${lead.id} transferido para admin Guilherme Nunes`
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
