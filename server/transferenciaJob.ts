import { getDb } from "./db";
import { leads, users, leadEstoque, distributionLog, logTransferencias } from "../drizzle/schema";
import { and, eq, lt, isNotNull, or, isNull } from "drizzle-orm";
import { isLeadProtegidoCarteira } from "./routers/carteiraAtiva";
import { getCorretoresElegiveis } from "./distribution";

/**
 * Job de transferência automática de leads sem interação
 *
 * Regras:
 * 1. Leads webhook (origemWebhook=true) `aguardando_atendimento` sem interação há mais de 30min → reatribuir
 * 2. Leads `aguardando_atendimento` sem interação há mais de 10h → reatribuir
 * 3. Leads `em_atendimento` sem interação há mais de 2 dias → reatribuir
 * 4. Leads na Carteira Ativa → IMUNES (nunca transferir)
 * 5. Leads de origem `captacao_corretor` → IMUNES (nunca transferir)
 * 6. Quando não há corretores disponíveis → ir para o estoque (NUNCA para perdido/lixeira)
 * 7. Novo corretor deve ser alguém que NUNCA trabalhou o lead antes
 *
 * Frequência: a cada 30 segundos
 */

const MINUTOS_SLA_WEBHOOK = 30;    // 30min sem atender lead webhook → redistribuir
const HORAS_SLA_AGUARDANDO = 10;   // 10h sem atender → redistribuir
const DIAS_SLA_EM_ATENDIMENTO = 2; // 2 dias sem interagir → redistribuir

/**
 * Busca IDs de corretores que já trabalharam um lead (via distribution_log)
 */
async function getCorretoresQueJaTrabalharamLead(db: any, leadId: number): Promise<number[]> {
  const logs = await db
    .select({ corretorId: distributionLog.corretorId })
    .from(distributionLog)
    .where(eq(distributionLog.leadId, leadId));
  return logs.map((l: any) => l.corretorId).filter(Boolean);
}

/**
 * Coloca um lead no estoque para redistribuição futura
 */
async function colocarNoEstoque(db: any, leadId: number, motivo: string): Promise<void> {
  // Verificar se já está no estoque
  const jaNoEstoque = await db
    .select({ id: leadEstoque.id })
    .from(leadEstoque)
    .where(and(
      eq(leadEstoque.leadId, leadId),
      eq(leadEstoque.status, "aguardando")
    ))
    .limit(1);

  if (jaNoEstoque.length > 0) {
    return; // Já está no estoque, não duplicar
  }

  // Remover corretor e colocar no estoque
  await db
    .update(leads)
    .set({
      corretorId: null,
      status: "aguardando_atendimento",
      updatedAt: new Date(),
    })
    .where(eq(leads.id, leadId));

  await db.insert(leadEstoque).values({
    leadId,
    tipoFila: "normal",
    motivoEstoque: motivo,
    tentativasDistribuicao: 0,
  });

  console.log(`[Transferência Job] Lead ${leadId} movido para o estoque: ${motivo}`);
}

/**
 * Transfere um lead para um novo corretor que nunca trabalhou o lead
 */
async function transferirLead(
  db: any,
  lead: any,
  motivo: "30min_webhook_sem_atendimento" | "10h_sem_atendimento" | "2_dias_sem_interacao"
): Promise<"transferido" | "estoque" | "imune"> {
  // 1. Imunidade: captacao_corretor
  if (lead.origem === "captacao_corretor") {
    return "imune";
  }

  // 2. Imunidade: Carteira Ativa
  const protegido = await isLeadProtegidoCarteira(lead.id);
  if (protegido) {
    return "imune";
  }

  // 3. Buscar corretores que já trabalharam o lead
  const jaTrabalharamIds = await getCorretoresQueJaTrabalharamLead(db, lead.id);

  // 4. Buscar corretores elegíveis
  const elegiveisIds = await getCorretoresElegiveis(
    lead.projectId || undefined,
    lead.origem || undefined
  );

  // 5. Filtrar: excluir quem já trabalhou o lead
  const novosElegiveisIds = (elegiveisIds as number[]).filter(
    (id: number) => !jaTrabalharamIds.includes(id)
  );

  if (novosElegiveisIds.length === 0) {
    // Sem corretores disponíveis → estoque (nunca para perdido/lixeira)
    await colocarNoEstoque(db, lead.id, `Sem corretores disponíveis após SLA (${motivo})`);

    await db.insert(logTransferencias).values({
      leadId: lead.id,
      leadNome: lead.nome,
      corretorOrigemId: lead.corretorId || null,
      corretorOrigemNome: null,
      corretorDestinoId: null,
      corretorDestinoNome: null,
      motivo,
      statusFinal: "estoque",
      dataTransferencia: new Date(),
    });

    return "estoque";
  }

  // 6. Selecionar o primeiro elegível
  const novoCorretorId = novosElegiveisIds[0];

  // 7. Buscar nome do novo corretor
  const novoCorretorRows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, novoCorretorId))
    .limit(1);
  const novoCorretorNome = novoCorretorRows[0]?.name || "Desconhecido";

  // 8. Atualizar lead
  await db
    .update(leads)
    .set({
      corretorId: novoCorretorId,
      dataDistribuicao: new Date(),
      timestampRecebimento: new Date(),
      status: "aguardando_atendimento",
      updatedAt: new Date(),
    })
    .where(eq(leads.id, lead.id));

  // 9. Registrar no distribution_log (para rastrear histórico de corretores)
  await db.insert(distributionLog).values({
    leadId: lead.id,
    corretorId: novoCorretorId,
    tipo: "automatica",
    motivo: `Transferência automática: ${motivo}`,
  });

  // 10. Registrar no log_transferencias
  await db.insert(logTransferencias).values({
    leadId: lead.id,
    leadNome: lead.nome,
    corretorOrigemId: lead.corretorId || null,
    corretorOrigemNome: null,
    corretorDestinoId: novoCorretorId,
    corretorDestinoNome: novoCorretorNome,
    motivo,
    statusFinal: "transferido",
    dataTransferencia: new Date(),
  });

  console.log(
    `[Transferência Job] Lead ${lead.id} (${lead.nome}) transferido de corretor ${lead.corretorId} para ${novoCorretorId} (${novoCorretorNome}) — motivo: ${motivo}`
  );

  return "transferido";
}

/**
 * Verifica e processa todas as transferências automáticas pendentes
 */
export async function verificarTransferenciasAutomaticas() {
  const db = await getDb();
  if (!db) {
    console.error("[Transferência Job] Database não disponível");
    return { transferidos: 0, noEstoque: 0, imunes: 0, erros: 0 };
  }

  let transferidos = 0;
  let noEstoque = 0;
  let imunes = 0;
  let erros = 0;

  try {
    // ── CASO 0: leads WEBHOOK com status != em_atendimento há mais de 30min ──
    // Regra: lead ADS chegou → 30 min → se não entrou em em_atendimento → transfere
    // Não importa se teve interação ou não — o critério é o STATUS
    const limite30min = new Date();
    limite30min.setMinutes(limite30min.getMinutes() - MINUTOS_SLA_WEBHOOK);

    const leadsWebhookExpirados = await db
      .select()
      .from(leads)
      .where(and(
        eq(leads.origemWebhook, true),
        isNotNull(leads.corretorId),
        isNotNull(leads.timestampRecebimento),
        lt(leads.timestampRecebimento, limite30min),
        // Qualquer status que NÃO seja em_atendimento (ou mais avançado)
        // Transfere apenas aguardando_atendimento — status mais avançados são respeitados
        eq(leads.status, "aguardando_atendimento")
      ))
      .limit(100);

    for (const lead of leadsWebhookExpirados) {
      try {
        const resultado = await transferirLead(db, lead, "30min_webhook_sem_atendimento");
        if (resultado === "transferido") transferidos++;
        else if (resultado === "estoque") noEstoque++;
        else if (resultado === "imune") imunes++;
      } catch (error) {
        erros++;
        console.error(`[Transferência Job] Erro ao processar lead webhook ${lead.id}:`, error);
      }
    }

    // ── CASO 1: leads aguardando_atendimento sem interação há mais de 10h ──
    const limite10h = new Date();
    limite10h.setHours(limite10h.getHours() - HORAS_SLA_AGUARDANDO);

    const leadsAguardando = await db
      .select()
      .from(leads)
      .where(and(
        eq(leads.status, "aguardando_atendimento"),
        isNotNull(leads.corretorId),
        or(
          // Tem interação mas foi há mais de 10h
          and(
            isNotNull(leads.ultimaInteracao),
            lt(leads.ultimaInteracao, limite10h)
          ),
          // Nunca teve interação mas foi recebido há mais de 10h (não webhook — esses já foram tratados acima)
          and(
            isNull(leads.ultimaInteracao),
            isNotNull(leads.timestampRecebimento),
            lt(leads.timestampRecebimento, limite10h),
            eq(leads.origemWebhook, false)
          )
        )
      ))
      .limit(200); // processar até 200 por rodada

    for (const lead of leadsAguardando) {
      try {
        const resultado = await transferirLead(db, lead, "10h_sem_atendimento");
        if (resultado === "transferido") transferidos++;
        else if (resultado === "estoque") noEstoque++;
        else if (resultado === "imune") imunes++;
      } catch (error) {
        erros++;
        console.error(`[Transferência Job] Erro ao processar lead ${lead.id}:`, error);
      }
    }

    // ── CASO 2: leads em_atendimento sem interação há mais de 2 dias ──
    const limite2dias = new Date();
    limite2dias.setDate(limite2dias.getDate() - DIAS_SLA_EM_ATENDIMENTO);

    const leadsEmAtendimento = await db
      .select()
      .from(leads)
      .where(and(
        eq(leads.status, "em_atendimento"),
        isNotNull(leads.corretorId),
        isNotNull(leads.ultimaInteracao),
        lt(leads.ultimaInteracao, limite2dias)
      ))
      .limit(200);

    for (const lead of leadsEmAtendimento) {
      try {
        const resultado = await transferirLead(db, lead, "2_dias_sem_interacao");
        if (resultado === "transferido") transferidos++;
        else if (resultado === "estoque") noEstoque++;
        else if (resultado === "imune") imunes++;
      } catch (error) {
        erros++;
        console.error(`[Transferência Job] Erro ao processar lead ${lead.id}:`, error);
      }
    }

    if (transferidos > 0 || noEstoque > 0) {
      console.log(
        `[Transferência Job] Ciclo: ${transferidos} transferidos, ${noEstoque} para estoque, ${imunes} imunes, ${erros} erros`
      );
    }

  } catch (error) {
    console.error("[Transferência Job] Erro no ciclo:", error);
    erros++;
  }

  return { transferidos, noEstoque, imunes, erros };
}

/**
 * Agenda o job de transferência para rodar a cada 30 segundos
 */
export function agendarTransferenciaAutomatica() {
  const INTERVALO_MS = 30 * 1000; // 30 segundos

  // Primeira execução após 30 segundos (para o servidor inicializar)
  setTimeout(async () => {
    console.log("[Transferência Job] Iniciando primeira verificação...");
    await verificarTransferenciasAutomaticas().catch(console.error);

    // Executar a cada 30 segundos
    setInterval(async () => {
      await verificarTransferenciasAutomaticas().catch(console.error);
    }, INTERVALO_MS);
  }, 30000);

  console.log("[Transferência Job] Agendado para rodar a cada 30 segundos");
}
