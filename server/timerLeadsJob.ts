import { getDb } from "./db";
import { leads, distributionLog, filaDistribuicao, users, configuracaoProjetoFoco } from "../drizzle/schema";
import { and, eq, lt, sql, ne, inArray } from "drizzle-orm";
import { getUserById, getProjectById } from "./db";

/**
 * ID do admin Guilherme Nunes - fallback quando nenhum corretor está disponível
 */
const ADMIN_GUILHERME_ID = 7722800;

/**
 * Tempo máximo em "Aguardando Atendimento" antes de redistribuir: 30 minutos
 */
const TIMER_MINUTOS = 30;

/**
 * Busca o próximo corretor apto na FILA FOCO.
 * Usa round-robin baseado na configuração do projeto foco.
 * Exclui o corretor atual.
 */
async function getProximoCorretorFilaFocoParaTimer(
  corretorAtualId: number | null
): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  // Buscar configuração do projeto foco
  const configs = await db
    .select()
    .from(configuracaoProjetoFoco)
    .limit(1);

  if (configs.length === 0) return null;

  const config = configs[0];
  if (!config.ativo || !config.corretoresIds) return null;

  const corretoresIds = config.corretoresIds as number[];
  if (corretoresIds.length === 0) return null;

  // Candidatos: corretores da fila foco que estão presentes, excluindo o atual
  const candidatos = await db
    .select({ id: users.id, status: users.status })
    .from(users)
    .where(
      and(
        inArray(users.id, corretoresIds),
        eq(users.status, "presente"),
        corretorAtualId ? ne(users.id, corretorAtualId) : sql`1=1`
      )
    );

  if (candidatos.length === 0) return null;

  // Round-robin: usar posição atual da configuração
  const posicaoAtual = config.posicaoAtual || 0;
  let tentativas = 0;
  let proximaPosicao = posicaoAtual % corretoresIds.length;

  while (tentativas < corretoresIds.length) {
    const corretorId = corretoresIds[proximaPosicao];

    // Verificar se o corretor está presente e não é o atual
    const corretorPresente = candidatos.find(c => c.id === corretorId);

    if (corretorPresente) {
      // Avançar posição para o próximo
      const novaPosicao = (proximaPosicao + 1) % corretoresIds.length;
      await db
        .update(configuracaoProjetoFoco)
        .set({ posicaoAtual: novaPosicao })
        .where(eq(configuracaoProjetoFoco.id, config.id));

      return corretorId;
    }

    proximaPosicao = (proximaPosicao + 1) % corretoresIds.length;
    tentativas++;
  }

  return null;
}

/**
 * Busca o próximo corretor apto na FILA GERAL.
 * Respeita limite diário de webhook e exclui o corretor atual.
 */
async function getProximoCorretorFilaGeralParaTimer(
  corretorAtualId: number | null
): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  const candidatos = await db
    .select({
      corretorId: filaDistribuicao.corretorId,
      posicao: filaDistribuicao.posicao,
      leadsRecebidosHoje: filaDistribuicao.leadsRecebidosHoje,
      corretorStatus: users.status,
      limiteDiarioWebhook: users.limiteDiarioWebhook,
    })
    .from(filaDistribuicao)
    .leftJoin(users, eq(filaDistribuicao.corretorId, users.id))
    .where(
      and(
        eq(filaDistribuicao.ativo, true),
        eq(users.status, "presente"),
        eq(users.role, "corretor"),
        corretorAtualId ? ne(filaDistribuicao.corretorId, corretorAtualId) : sql`1=1`
      )
    )
    .orderBy(filaDistribuicao.posicao);

  for (const candidato of candidatos) {
    const limite = candidato.limiteDiarioWebhook ?? 50;
    const recebidosHoje = candidato.leadsRecebidosHoje ?? 0;

    if (recebidosHoje < limite) {
      return candidato.corretorId;
    }
  }

  return null;
}

/**
 * Job que verifica leads com timer ativo que ultrapassaram 30 minutos sem serem trabalhados.
 *
 * Regras de redistribuição:
 * - Leads da fila FOCO (tipoFilaOrigem='foco') → redistribuídos apenas entre corretores da fila foco
 * - Leads da fila GERAL (tipoFilaOrigem='geral') → redistribuídos apenas entre corretores da fila geral
 * - Se nenhum corretor disponível na fila correta → fallback para admin Guilherme Nunes
 *
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

    // Buscar leads com timer ativo que ultrapassaram 30 minutos
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
        const tipoFila = lead.tipoFilaOrigem || "geral";

        console.log(
          `[Timer Job] Lead ${lead.id} (${lead.nome}) expirou após ${TIMER_MINUTOS} min - fila: ${tipoFila} - tentando redistribuir...`
        );

        // Desativar timer do lead atual e incrementar tentativas
        await db
          .update(leads)
          .set({
            timerAtivo: false,
            tentativasRedistribuicao: (lead.tentativasRedistribuicao || 0) + 1,
          })
          .where(eq(leads.id, lead.id));

        // Buscar próximo corretor na fila CORRETA (foco ou geral)
        let proximoCorretorId: number | null = null;

        if (tipoFila === "foco") {
          // Lead da fila foco → redistribuir apenas entre corretores da fila foco
          proximoCorretorId = await getProximoCorretorFilaFocoParaTimer(lead.corretorId);
          console.log(
            `[Timer Job] Lead ${lead.id} (fila foco): próximo corretor foco = ${proximoCorretorId ?? "nenhum"}`
          );
        } else {
          // Lead da fila geral → redistribuir apenas entre corretores da fila geral
          proximoCorretorId = await getProximoCorretorFilaGeralParaTimer(lead.corretorId);
          console.log(
            `[Timer Job] Lead ${lead.id} (fila geral): próximo corretor geral = ${proximoCorretorId ?? "nenhum"}`
          );
        }

        if (proximoCorretorId) {
          // Redistribuir para o próximo corretor apto da mesma fila
          await db
            .update(leads)
            .set({
              corretorId: proximoCorretorId,
              timestampRecebimento: new Date(),
              timerAtivo: true,
              status: "aguardando_atendimento",
              // Manter tipoFilaOrigem inalterado — o lead continua na mesma fila
            })
            .where(eq(leads.id, lead.id));

          // Registrar no log de distribuição
          await db.insert(distributionLog).values({
            leadId: lead.id,
            corretorId: proximoCorretorId,
            tipo: "automatica",
            motivo: `Redistribuição automática por timeout de ${TIMER_MINUTOS} minutos (fila ${tipoFila})`,
          });

          // Atualizar contador na fila geral (fila foco não usa filaDistribuicao)
          if (tipoFila === "geral") {
            await db
              .update(filaDistribuicao)
              .set({
                leadsRecebidosHoje: sql`${filaDistribuicao.leadsRecebidosHoje} + 1`,
                ultimaDistribuicao: new Date(),
              })
              .where(eq(filaDistribuicao.corretorId, proximoCorretorId));
          }

          console.log(
            `[Timer Job] Lead ${lead.id} redistribuído para corretor ${proximoCorretorId} (fila ${tipoFila})`
          );

          // Enviar email ao corretor notificando sobre o lead redistribuído
          try {
            const corretor = await getUserById(proximoCorretorId);
            const projeto = lead.projectId ? await getProjectById(lead.projectId) : null;
            if (corretor && corretor.email) {
              const { enviarNotificacaoLeadRedistribuido } = await import('./emailService');
              await enviarNotificacaoLeadRedistribuido({
                corretorNome: corretor.name,
                corretorEmail: corretor.email,
                leadNome: lead.nome,
                leadTelefone: lead.telefone,
                leadEmail: lead.email || undefined,
                leadOrigem: lead.origem || 'Facebook ADS',
                leadProjeto: projeto?.nome,
                leadFaixaRenda: lead.faixaRenda || undefined,
                tipoFila: tipoFila as 'geral' | 'foco',
                minutosEspera: TIMER_MINUTOS,
              });
              console.log(`[Timer Job] Email de redistribuição enviado para: ${corretor.email}`);
            }
          } catch (emailError) {
            console.error(`[Timer Job] Erro ao enviar email de redistribuição:`, emailError);
          }
        } else {
          // Nenhum corretor disponível na fila correta → fallback para admin Guilherme Nunes
          console.log(
            `[Timer Job] Lead ${lead.id}: nenhum corretor disponível na fila ${tipoFila}, transferindo para admin Guilherme Nunes (ID: ${ADMIN_GUILHERME_ID})`
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
            motivo: `Fallback para admin: nenhum corretor disponível na fila ${tipoFila} após timeout de ${TIMER_MINUTOS} minutos`,
          });

          console.log(
            `[Timer Job] Lead ${lead.id} transferido para admin Guilherme Nunes (fila ${tipoFila} sem corretores)`
          );

          // Admin não recebe email — apenas corretores são notificados por email
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
