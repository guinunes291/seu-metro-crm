import { getDb } from "./db";
import { users, leads, conversionStats } from "../drizzle/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

/**
 * Verifica se um corretor está elegível para receber novos leads
 * Regras:
 * 1. Status deve ser "presente"
 * 2. Deve ter trabalhado pelo menos 60% dos seus leads (status diferente de "aguardando_atendimento")
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

  // Verificar taxa de trabalho (60% rule)
  const leadsDoCorretor = await db
    .select()
    .from(leads)
    .where(eq(leads.corretorId, corretorId));

  if (leadsDoCorretor.length === 0) {
    // Corretor sem leads pode receber
    return true;
  }

  const totalLeads = leadsDoCorretor.length;
  const leadsTrabalhados = leadsDoCorretor.filter(
    (lead) => lead.status !== "aguardando_atendimento"
  ).length;

  const taxaTrabalho = (leadsTrabalhados / totalLeads) * 100;

  return taxaTrabalho >= 60;
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
): Promise<{ success: boolean; corretorId?: number; motivo?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, motivo: "Database não disponível" };
  }

  // Buscar informações do lead
  const lead = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!lead.length) {
    return { success: false, motivo: "Lead não encontrado" };
  }

  const leadData = lead[0];

  // Lead já distribuído
  if (leadData.corretorId) {
    return { success: false, motivo: "Lead já distribuído" };
  }

  // Buscar corretores elegíveis
  const corretoresElegiveis = await getCorretoresElegiveis(
    leadData.projectId || undefined,
    leadData.origem || undefined
  );

  if (corretoresElegiveis.length === 0) {
    return { success: false, motivo: "Nenhum corretor elegível disponível" };
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

  return { success: true, corretorId: melhorCorretor };
}

/**
 * Distribui múltiplos leads automaticamente
 */
export async function distribuirLeadsEmLote(
  leadIds: number[]
): Promise<{
  success: number;
  failed: number;
  details: Array<{ leadId: number; success: boolean; corretorId?: number; motivo?: string }>;
}> {
  const results = {
    success: 0,
    failed: 0,
    details: [] as Array<{ leadId: number; success: boolean; corretorId?: number; motivo?: string }>,
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
 * Distribui todos os leads não distribuídos
 */
export async function distribuirTodosLeadsNaoDistribuidos(): Promise<{
  success: number;
  failed: number;
  details: Array<{ leadId: number; success: boolean; corretorId?: number; motivo?: string }>;
}> {
  const db = await getDb();
  if (!db) {
    return { success: 0, failed: 0, details: [] };
  }

  // Buscar todos os leads sem corretor
  const leadsNaoDistribuidos = await db
    .select()
    .from(leads)
    .where(sql`${leads.corretorId} IS NULL`);

  const leadIds = leadsNaoDistribuidos.map((lead) => lead.id);

  return await distribuirLeadsEmLote(leadIds);
}
