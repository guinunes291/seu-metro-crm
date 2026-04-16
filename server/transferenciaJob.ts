import { getDb } from "./db";
import { leads, users, leadEstoque, distributionLog, logTransferencias, filaDistribuicao, configuracaoProjetoFoco, followUps } from "../drizzle/schema";
import { and, eq, lt, isNotNull, isNull, inArray, ne, sql, notInArray } from "drizzle-orm";
import { isLeadProtegidoCarteira } from "./routers/carteiraAtiva";
import { getCorretoresElegiveis, getCorretoresParaRedistribuicao, distribuirLeadsDoEstoque } from "./distribution";

/**
 * Job de transferência automática de leads sem follow-up
 *
 * Regra única:
 * - Lead ativo (aguardando_atendimento ou em_atendimento) sem follow-up realizado/registro
 *   nos últimos 5 dias → redistribuir para outro corretor
 *
 * Imunidades:
 * - Leads de origem `captacao_corretor` → NUNCA transferir
 * - Leads na Carteira Ativa → NUNCA transferir
 *
 * Quando não há corretores disponíveis → vai para o estoque global
 *
 * Frequência: a cada 6 horas
 */

const DIAS_SEM_FOLLOWUP = 5; // 5 dias sem follow-up/registro → redistribuir

/**
 * Cache de configuração do projeto foco (válido por 10 minutos)
 */
let _configFocoCache: { data: any; ts: number } | null = null;
async function getConfigFocoCache(db: any) {
  const now = Date.now();
  if (_configFocoCache && now - _configFocoCache.ts < 10 * 60 * 1000) {
    return _configFocoCache.data;
  }
  const configs = await db.select().from(configuracaoProjetoFoco).limit(1);
  const config = configs[0] || null;
  _configFocoCache = { data: config, ts: now };
  return config;
}

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
 * Busca IDs de corretores da FILA FOCO que estão presentes.
 */
async function getCorretoresFilaFoco(
  db: any,
  excluirCorretorId?: number | null
): Promise<number[]> {
  const configFoco = await getConfigFocoCache(db);
  if (!configFoco || !configFoco.ativo || !configFoco.corretoresIds) return [];

  const corretoresIds = configFoco.corretoresIds as number[];
  if (corretoresIds.length === 0) return [];

  const candidatos = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        inArray(users.id, corretoresIds),
        eq(users.status, "presente"),
        excluirCorretorId ? ne(users.id, excluirCorretorId) : sql`1=1`
      )
    );

  if (candidatos.length === 0) return [];

  const posicaoAtual = configFoco.posicaoAtual || 0;
  const resultado: number[] = [];
  for (let i = 0; i < corretoresIds.length; i++) {
    const idx = (posicaoAtual + i) % corretoresIds.length;
    const corretorId = corretoresIds[idx];
    if (candidatos.find((c: any) => c.id === corretorId)) {
      resultado.push(corretorId);
    }
  }
  return resultado;
}

/**
 * Busca IDs de corretores da FILA GERAL que estão presentes.
 */
async function getCorretoresFilaGeral(
  db: any,
  excluirCorretorId?: number | null
): Promise<number[]> {
  const configFoco = await getConfigFocoCache(db);
  const corretoresFocoIds: number[] =
    configFoco && configFoco.ativo && configFoco.corretoresIds
      ? (configFoco.corretoresIds as number[])
      : [];

  const candidatos = await db
    .select({
      corretorId: filaDistribuicao.corretorId,
      posicao: filaDistribuicao.posicao,
    })
    .from(filaDistribuicao)
    .leftJoin(users, eq(filaDistribuicao.corretorId, users.id))
    .where(
      and(
        eq(filaDistribuicao.ativo, true),
        eq(users.status, "presente"),
        eq(users.role, "corretor"),
        excluirCorretorId ? ne(filaDistribuicao.corretorId, excluirCorretorId) : sql`1=1`
      )
    )
    .orderBy(filaDistribuicao.posicao);

  const candidatosFiltrados = candidatos.filter(
    (c: any) => !corretoresFocoIds.includes(c.corretorId)
  );

  return candidatosFiltrados.map((c: any) => c.corretorId);
}

/**
 * Coloca um lead no estoque para redistribuição futura
 */
async function colocarNoEstoque(
  db: any,
  leadId: number,
  motivo: string,
  tipoFilaLead?: string
): Promise<void> {
  const jaNoEstoque = await db
    .select({ id: leadEstoque.id })
    .from(leadEstoque)
    .where(and(
      eq(leadEstoque.leadId, leadId),
      eq(leadEstoque.status, "aguardando")
    ))
    .limit(1);

  if (jaNoEstoque.length > 0) return;

  await db
    .update(leads)
    .set({ corretorId: null, status: "aguardando_atendimento", updatedAt: new Date() })
    .where(eq(leads.id, leadId));

  const tipoFilaEstoque: "normal" | "foco" = tipoFilaLead === "foco" ? "foco" : "normal";

  await db.insert(leadEstoque).values({
    leadId,
    tipoFila: tipoFilaEstoque,
    motivoEstoque: motivo,
    tentativasDistribuicao: 0,
  });

  console.log(`[Transferência Job] Lead ${leadId} → estoque (${tipoFilaEstoque}): ${motivo}`);
}

/**
 * Transfere um lead para um novo corretor que nunca trabalhou o lead.
 */
async function transferirLead(
  db: any,
  lead: any
): Promise<"transferido" | "estoque" | "imune"> {
  // Imunidade: captacao_corretor
  if (lead.origem === "captacao_corretor") return "imune";

  // Imunidade: transferido manualmente pelo admin (fica fixo no corretor)
  if (lead.transferidoManualmentePorAdmin) return "imune";

  // Imunidade: Carteira Ativa
  const protegido = await isLeadProtegidoCarteira(lead.id);
  if (protegido) return "imune";

  const jaTrabalharamIds = await getCorretoresQueJaTrabalharamLead(db, lead.id);

  const tipoFila = lead.tipoFilaOrigem || "geral";
  let elegiveisIds: number[];

  if (tipoFila === "foco") {
    elegiveisIds = await getCorretoresFilaFoco(db, lead.corretorId);
    if (elegiveisIds.length === 0) {
      await colocarNoEstoque(db, lead.id, "5_dias_sem_followup_sem_corretor_foco", tipoFila);
      return "estoque";
    }
  } else {
    elegiveisIds = await getCorretoresFilaGeral(db, lead.corretorId);
    if (elegiveisIds.length === 0) {
      const todos = await getCorretoresParaRedistribuicao();
      const configFoco = await getConfigFocoCache(db);
      const focoIds: number[] =
        configFoco && configFoco.ativo && configFoco.corretoresIds
          ? (configFoco.corretoresIds as number[])
          : [];
      elegiveisIds = todos.filter((id: number) => !focoIds.includes(id));
    }
  }

  const novosElegiveisIds = (elegiveisIds as number[]).filter(
    (id: number) => !jaTrabalharamIds.includes(id)
  );

  if (novosElegiveisIds.length === 0) {
    await colocarNoEstoque(db, lead.id, "5_dias_sem_followup_sem_corretor_disponivel", tipoFila);
    return "estoque";
  }

  const novoCorretorId = novosElegiveisIds[0];

  const corretorInfo = await db
    .select({ nome: users.name })
    .from(users)
    .where(eq(users.id, novoCorretorId))
    .limit(1);
  const novoCorretorNome = corretorInfo[0]?.nome || "desconhecido";

  await db
    .update(leads)
    .set({
      corretorId: novoCorretorId,
      status: "aguardando_atendimento",
      ultimaInteracao: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(leads.id, lead.id));

  await db.insert(distributionLog).values({
    leadId: lead.id,
    corretorId: novoCorretorId,
    motivo: "5_dias_sem_followup",
    timestamp: new Date(),
  }).catch(() => {});

  await db.insert(logTransferencias).values({
    leadId: lead.id,
    corretorAntigoId: lead.corretorId,
    corretorNovoId: novoCorretorId,
    motivo: "5_dias_sem_followup",
    timestamp: new Date(),
  }).catch(() => {});

  console.log(
    `[Transferência Job] Lead ${lead.id} (${lead.nome}) transferido de ${lead.corretorId} → ${novoCorretorId} (${novoCorretorNome})`
  );

  return "transferido";
}

/**
 * Verifica e processa leads sem follow-up nos últimos 5 dias
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
    const limite5dias = new Date();
    limite5dias.setDate(limite5dias.getDate() - DIAS_SEM_FOLLOWUP);

    // Buscar leads ativos com corretor atribuído que não tiveram follow-up/registro nos últimos 5 dias
    // Excluir leads transferidos manualmente pelo admin (ficam fixos no corretor)
    const leadsParaTransferir = await db
      .select()
      .from(leads)
      .where(and(
        isNotNull(leads.corretorId),
        sql`${leads.status} IN ('aguardando_atendimento', 'em_atendimento')`,
        eq(leads.transferidoManualmentePorAdmin, false),
        sql`(
          (${leads.ultimaInteracao} IS NOT NULL AND ${leads.ultimaInteracao} < ${limite5dias})
          OR
          (${leads.ultimaInteracao} IS NULL AND ${leads.createdAt} < ${limite5dias})
        )`
      ))
      .limit(50); // processar até 50 por ciclo

    if (leadsParaTransferir.length > 0) {
      console.log(`[Transferência Job] ${leadsParaTransferir.length} leads sem follow-up há mais de 5 dias`);
    }

    for (const lead of leadsParaTransferir) {
      try {
        const resultado = await transferirLead(db, lead);
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

    // Distribuir leads do estoque para corretores elegíveis
    try {
      const resultadoEstoque = await distribuirLeadsDoEstoque();
      if (resultadoEstoque.distribuidos > 0) {
        console.log(`[Transferência Job] Estoque: ${resultadoEstoque.distribuidos} leads distribuídos`);
      }
    } catch (estoqueError) {
      console.error("[Transferência Job] Erro ao distribuir estoque:", estoqueError);
    }

  } catch (error) {
    console.error("[Transferência Job] Erro no ciclo:", error);
    erros++;
  }

  return { transferidos, noEstoque, imunes, erros };
}

/**
 * Agenda o job de transferência para rodar a cada 6 horas
 */
export function agendarTransferenciaAutomatica() {
  const INTERVALO_MS = 6 * 60 * 60 * 1000; // 6 horas

  // Primeira execução após 5 minutos (para o servidor inicializar)
  setTimeout(async () => {
    console.log("[Transferência Job] Iniciando primeira verificação (regra: 5 dias sem follow-up)...");
    await verificarTransferenciasAutomaticas().catch(console.error);

    setInterval(async () => {
      await verificarTransferenciasAutomaticas().catch(console.error);
    }, INTERVALO_MS);
  }, 5 * 60 * 1000);

  console.log("[Transferência Job] Agendado para rodar a cada 6 horas (regra: 5 dias sem follow-up)");
}
