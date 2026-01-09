import { getDb, notifyLeadDistribuido, countLeadsRecebidosHoje } from "./db";
import { users, leads, conversionStats, distributionLog } from "../drizzle/schema";
import { eq, and, sql, isNull } from "drizzle-orm";

// Configurações de distribuição (baseado no AppScript)
const MINIMO_LEADS_GARANTIDO = 30;
const PERCENTUAL_CONCLUSAO_MINIMO = 0.6; // 60%
const LOTE_SIZE = 20; // Total de leads por rodada
const LEADS_POR_RODADA = 4; // Leads distribuídos por vez para cada corretor

interface CorretorStatus {
  id: number;
  nome: string;
  email: string;
  totalLeads: number;
  leadsTrabalhados: number;
  taxaTrabalho: number;
  elegivel: boolean;
  status: string;
}

/**
 * Verifica se um corretor está elegível para receber novos leads
 * Regras baseadas no AppScript:
 * 1. Status deve ser "presente"
 * 2. Deve ter menos de 30 leads OU ter trabalhado pelo menos 60% dos seus leads
 */
export async function isCorretorElegivel(corretorId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Verificar status do corretor
  const corretor = await db
    .select()
    .from(users)
    .where(eq(users.id, corretorId))
    .limit(1);

  if (!corretor.length || corretor[0].status !== "presente") {
    return false;
  }

  // Buscar leads do corretor
  const leadsDoCorretor = await db
    .select()
    .from(leads)
    .where(eq(leads.corretorId, corretorId));

  const totalLeads = leadsDoCorretor.length;

  // Se tem menos que o mínimo garantido, é elegível
  if (totalLeads < MINIMO_LEADS_GARANTIDO) {
    return true;
  }

  // Verificar taxa de trabalho (60% rule)
  const leadsTrabalhados = leadsDoCorretor.filter(
    (lead) => lead.status !== "aguardando_atendimento"
  ).length;

  const taxaTrabalho = leadsTrabalhados / totalLeads;

  return taxaTrabalho >= PERCENTUAL_CONCLUSAO_MINIMO;
}

/**
 * Obtém o status completo de um corretor
 */
export async function getCorretorStatus(corretorId: number): Promise<CorretorStatus | null> {
  const db = await getDb();
  if (!db) return null;

  const corretor = await db
    .select()
    .from(users)
    .where(eq(users.id, corretorId))
    .limit(1);

  if (!corretor.length) return null;

  const leadsDoCorretor = await db
    .select()
    .from(leads)
    .where(eq(leads.corretorId, corretorId));

  const totalLeads = leadsDoCorretor.length;
  const leadsTrabalhados = leadsDoCorretor.filter(
    (lead) => lead.status !== "aguardando_atendimento"
  ).length;

  const taxaTrabalho = totalLeads > 0 ? leadsTrabalhados / totalLeads : 0;
  const elegivel = await isCorretorElegivel(corretorId);

  return {
    id: corretor[0].id,
    nome: corretor[0].name || "",
    email: corretor[0].email || "",
    totalLeads,
    leadsTrabalhados,
    taxaTrabalho,
    elegivel,
    status: corretor[0].status || "ausente",
  };
}

/**
 * Calcula a taxa de conversão de um corretor para um projeto específico
 */
export async function getTaxaConversaoPorProjeto(
  corretorId: number,
  projectId: number | null
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const stats = await db
    .select()
    .from(conversionStats)
    .where(
      and(
        eq(conversionStats.corretorId, corretorId),
        projectId ? eq(conversionStats.projectId, projectId) : sql`${conversionStats.projectId} IS NULL`
      )
    )
    .limit(1);

  if (!stats.length) return 0;

  return stats[0].taxaConversao || 0;
}

/**
 * Calcula a taxa de conversão de um corretor para uma região específica
 */
export async function getTaxaConversaoPorRegiao(
  corretorId: number,
  regiao: string | null
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // Buscar todos os leads do corretor nessa região
  const leadsNaRegiao = await db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.corretorId, corretorId),
        regiao ? eq(leads.origem, regiao) : sql`${leads.origem} IS NULL`
      )
    );

  if (leadsNaRegiao.length === 0) return 0;

  const leadsFechados = leadsNaRegiao.filter(
    (lead) => lead.status === "contrato_fechado"
  ).length;

  return Math.round((leadsFechados / leadsNaRegiao.length) * 10000);
}

/**
 * Retorna lista de corretores elegíveis ordenados por melhor taxa de conversão
 */
export async function getCorretoresElegiveis(
  projectId?: number,
  regiao?: string
): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  // Buscar todos os corretores
  const todosCorretores = await db
    .select()
    .from(users)
    .where(eq(users.role, "corretor"));

  // Filtrar corretores elegíveis
  const corretoresElegiveis: Array<{ id: number; taxa: number }> = [];

  for (const corretor of todosCorretores) {
    const elegivel = await isCorretorElegivel(corretor.id);
    
    if (elegivel) {
      let taxa = 0;

      // Priorizar taxa por projeto
      if (projectId) {
        taxa = await getTaxaConversaoPorProjeto(corretor.id, projectId);
      }

      // Se não houver taxa por projeto, usar taxa por região
      if (taxa === 0 && regiao) {
        taxa = await getTaxaConversaoPorRegiao(corretor.id, regiao);
      }

      // Se ainda não houver taxa, usar taxa geral
      if (taxa === 0) {
        taxa = await getTaxaConversaoPorProjeto(corretor.id, null);
      }

      corretoresElegiveis.push({ id: corretor.id, taxa });
    }
  }

  // Ordenar por maior taxa de conversão
  corretoresElegiveis.sort((a, b) => b.taxa - a.taxa);

  return corretoresElegiveis.map((c) => c.id);
}

/**
 * Distribui um lead para o melhor corretor disponível
 */
export async function distribuirLeadAutomatico(
  leadId: number
): Promise<{ success: boolean; corretorId?: number; message?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, message: "Database não disponível" };
  }

  // Buscar informações do lead
  const lead = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!lead.length) {
    return { success: false, message: "Lead não encontrado" };
  }

  const leadData = lead[0];

  // Verificar se o lead pertence ao gestor
  const gestores = await db
    .select()
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);

  if (!gestores.length) {
    return { success: false, message: "Gestor não encontrado" };
  }

  const gestorId = gestores[0].id;

  // Só distribui se o lead pertence ao gestor
  if (leadData.corretorId !== gestorId) {
    return { success: false, message: "Lead não pertence ao gestor" };
  }

  // Buscar corretores elegíveis
  const corretoresElegiveis = await getCorretoresElegiveis(
    leadData.projectId || undefined,
    leadData.origem || undefined
  );

  if (corretoresElegiveis.length === 0) {
    return { success: false, message: "Nenhum corretor elegível disponível" };
  }

  // Selecionar o melhor corretor (primeiro da lista ordenada)
  const melhorCorretor = corretoresElegiveis[0];

  // Atualizar lead
  await db
    .update(leads)
    .set({
      corretorId: melhorCorretor,
      dataDistribuicao: new Date(),
      status: "aguardando_atendimento",
    })
    .where(eq(leads.id, leadId));

  // Registrar no log de distribuição
  await db.insert(distributionLog).values({
    leadId: leadId,
    corretorId: melhorCorretor,
    tipo: "automatica",
  });

  // Enviar notificação para o corretor
  try {
    await notifyLeadDistribuido(melhorCorretor, leadId, leadData.nome);
  } catch (error) {
    console.error("Erro ao enviar notificação:", error);
  }

  return { success: true, corretorId: melhorCorretor };
}

/**
 * Distribui múltiplos leads automaticamente usando algoritmo round-robin
 * Baseado no AppScript: distribui 4 leads por vez para cada corretor elegível
 */
export async function distribuirLeadsEmLote(
  leadIds: number[]
): Promise<{
  success: number;
  failed: number;
  details: Array<{ leadId: number; success: boolean; corretorId?: number; message?: string }>;
}> {
  const results = {
    success: 0,
    failed: 0,
    details: [] as Array<{ leadId: number; success: boolean; corretorId?: number; message?: string }>,
  };

  for (const leadId of leadIds) {
    const result = await distribuirLeadAutomatico(leadId);
    
    results.details.push({
      leadId,
      ...result,
    });

    if (result.success) {
      results.success++;
    } else {
      results.failed++;
    }
  }

  return results;
}

/**
 * Distribui todos os leads não atribuídos em lotes
 * Regras:
 * - Distribui leads com corretorId = null (não atribuídos a nenhum corretor)
 * - Apenas para corretores presentes
 * - Apenas para corretores com taxa de trabalho > 60%
 * - Limite de 20 leads por ação
 */
export async function distribuirTodosLeadsNaoDistribuidos(): Promise<{
  success: number;
  failed: number;
  details: Array<{ leadId: number; success: boolean; corretorId?: number; message?: string }>;
}> {
  const db = await getDb();
  if (!db) {
    return { success: 0, failed: 0, details: [] };
  }

  // Buscar leads não atribuídos (corretorId = null)
  const leadsNaoAtribuidos = await db
    .select()
    .from(leads)
    .where(isNull(leads.corretorId))
    .limit(LOTE_SIZE);

  if (leadsNaoAtribuidos.length === 0) {
    return { success: 0, failed: 0, details: [] };
  }

  const leadIds = leadsNaoAtribuidos.map((lead) => lead.id);

  return await distribuirLeadsEmLoteParaElegiveis(leadIds);
}

/**
 * Distribui leads em lote apenas para corretores elegíveis
 * (presentes e com taxa de trabalho > 60%)
 */
async function distribuirLeadsEmLoteParaElegiveis(
  leadIds: number[]
): Promise<{
  success: number;
  failed: number;
  details: Array<{ leadId: number; success: boolean; corretorId?: number; message?: string }>;
}> {
  const db = await getDb();
  if (!db) {
    return { success: 0, failed: 0, details: [] };
  }

  const results = {
    success: 0,
    failed: 0,
    details: [] as Array<{ leadId: number; success: boolean; corretorId?: number; message?: string }>,
  };

  // Buscar corretores elegíveis (presentes e com taxa de trabalho > 60%)
  const corretoresElegiveis = await getCorretoresElegiveisParaDistribuicao();

  if (corretoresElegiveis.length === 0) {
    // Nenhum corretor elegível, retornar falha para todos
    for (const leadId of leadIds) {
      results.details.push({
        leadId,
        success: false,
        message: "Nenhum corretor elegível disponível (presente e com taxa de trabalho > 60%)",
      });
      results.failed++;
    }
    return results;
  }

  // Distribuir leads em round-robin entre corretores elegíveis
  let corretorIndex = 0;

  for (const leadId of leadIds) {
    const corretorId = corretoresElegiveis[corretorIndex];

    try {
      // Buscar dados do lead
      const lead = await db
        .select()
        .from(leads)
        .where(eq(leads.id, leadId))
        .limit(1);

      if (!lead.length) {
        results.details.push({
          leadId,
          success: false,
          message: "Lead não encontrado",
        });
        results.failed++;
        continue;
      }

      // Atualizar lead
      await db
        .update(leads)
        .set({
          corretorId,
          dataDistribuicao: new Date(),
          status: "aguardando_atendimento",
        })
        .where(eq(leads.id, leadId));

      // Registrar no log de distribuição
      await db.insert(distributionLog).values({
        leadId,
        corretorId,
        tipo: "automatica",
        motivo: "Distribuição manual via botão Distribuir Agora",
      });

      // Enviar notificação para o corretor
      try {
        await notifyLeadDistribuido(corretorId, leadId, lead[0].nome);
      } catch (error) {
        console.error("Erro ao enviar notificação:", error);
      }

      results.details.push({
        leadId,
        success: true,
        corretorId,
      });
      results.success++;

      // Avançar para o próximo corretor (round-robin)
      corretorIndex = (corretorIndex + 1) % corretoresElegiveis.length;
    } catch (error) {
      results.details.push({
        leadId,
        success: false,
        message: `Erro ao distribuir: ${error}`,
      });
      results.failed++;
    }
  }

  return results;
}

/**
 * Retorna lista de IDs de corretores elegíveis para distribuição
 * Critérios:
 * - Status = "presente"
 * - Taxa de trabalho > 60% (ou menos de 30 leads)
 */
async function getCorretoresElegiveisParaDistribuicao(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  // Buscar todos os corretores presentes
  const corretoresPresentes = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.role, "corretor"),
        eq(users.status, "presente")
      )
    );

  const corretoresElegiveis: number[] = [];

  for (const corretor of corretoresPresentes) {
    // Verificar limite diário de distribuição automática
    const limiteDiario = corretor.limiteDiarioLeads || 50;
    const leadsRecebidosHoje = await countLeadsRecebidosHoje(corretor.id);
    
    if (leadsRecebidosHoje >= limiteDiario) {
      // Corretor já atingiu o limite diário de distribuição automática
      continue;
    }

    // Buscar leads do corretor
    const leadsDoCorretor = await db
      .select()
      .from(leads)
      .where(eq(leads.corretorId, corretor.id));

    const totalLeads = leadsDoCorretor.length;

    // Se tem menos que 30 leads, é elegível
    if (totalLeads < MINIMO_LEADS_GARANTIDO) {
      corretoresElegiveis.push(corretor.id);
      continue;
    }

    // Verificar taxa de trabalho (60% rule)
    const leadsTrabalhados = leadsDoCorretor.filter(
      (lead) => lead.status !== "aguardando_atendimento"
    ).length;

    const taxaTrabalho = leadsTrabalhados / totalLeads;

    if (taxaTrabalho >= PERCENTUAL_CONCLUSAO_MINIMO) {
      corretoresElegiveis.push(corretor.id);
    }
  }

  return corretoresElegiveis;
}

/**
 * Obtém estatísticas de distribuição de todos os corretores
 */
export async function getEstatisticasDistribuicao(): Promise<CorretorStatus[]> {
  const db = await getDb();
  if (!db) return [];

  const todosCorretores = await db
    .select()
    .from(users)
    .where(eq(users.role, "corretor"));

  const estatisticas: CorretorStatus[] = [];

  for (const corretor of todosCorretores) {
    const status = await getCorretorStatus(corretor.id);
    if (status) {
      estatisticas.push(status);
    }
  }

  return estatisticas;
}
