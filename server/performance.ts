import { getDb } from "./db";
import { leads, leadHistory, users, projects } from "../drizzle/schema";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";

/**
 * Métricas de performance de um corretor
 */
export interface CorretorPerformance {
  // Métricas gerais
  totalLeads: number;
  leadsContatados: number;
  leadsConvertidos: number;
  leadsPerdidos: number;
  
  // Taxas de conversão
  taxaConversao: number; // Percentual de leads convertidos
  taxaContato: number; // Percentual de leads contatados
  
  // Tempo médio de resposta
  tempoMedioResposta: number; // Em horas
  
  // Leads por status
  leadsPorStatus: {
    status: string;
    count: number;
  }[];
  
  // Leads por projeto
  leadsPorProjeto: {
    projectId: number;
    projectName: string;
    count: number;
    convertidos: number;
  }[];
}

/**
 * Ranking de corretores
 */
export interface RankingCorretor {
  corretorId: number;
  corretorNome: string;
  totalLeads: number;
  leadsConvertidos: number;
  taxaConversao: number;
  posicao: number;
}

/**
 * Opções de filtro por período
 */
export interface PeriodoFiltro {
  dataInicio?: Date;
  dataFim?: Date;
}

/**
 * Calcula as métricas de performance de um corretor
 */
export async function calcularPerformanceCorretor(
  corretorId: number,
  periodo?: PeriodoFiltro
): Promise<CorretorPerformance> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Construir condições de filtro
  const conditions = [eq(leads.corretorId, corretorId)];
  if (periodo?.dataInicio) {
    conditions.push(gte(leads.createdAt, periodo.dataInicio));
  }
  if (periodo?.dataFim) {
    conditions.push(lte(leads.createdAt, periodo.dataFim));
  }

  // Total de leads
  const totalLeadsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(and(...conditions));
  
  const totalLeads = Number(totalLeadsResult[0]?.count || 0);

  // Leads contatados (que tiveram alguma interação)
  const leadsContatadosResult = await db
    .select({ count: sql<number>`count(distinct ${leads.id})` })
    .from(leads)
    .innerJoin(leadHistory, eq(leadHistory.leadId, leads.id))
    .where(and(...conditions));
  
  const leadsContatados = Number(leadsContatadosResult[0]?.count || 0);

  // Leads convertidos (status = contrato_fechado)
  const leadsConvertidosResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(
      and(
        ...conditions,
        eq(leads.status, "contrato_fechado")
      )
    );
  
  const leadsConvertidos = Number(leadsConvertidosResult[0]?.count || 0);

  // Leads perdidos
  const leadsPerdidosResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(
      and(
        ...conditions,
        eq(leads.status, "perdido")
      )
    );
  
  const leadsPerdidos = Number(leadsPerdidosResult[0]?.count || 0);

  // Taxas de conversão
  const taxaConversao = totalLeads > 0 ? (leadsConvertidos / totalLeads) * 100 : 0;
  const taxaContato = totalLeads > 0 ? (leadsContatados / totalLeads) * 100 : 0;

  // Tempo médio de resposta (diferença entre createdAt do lead e primeira interação)
  const tempoRespostaResult = await db
    .select({
      avgHours: sql<number>`AVG(TIMESTAMPDIFF(HOUR, ${leads.createdAt}, ${leadHistory.createdAt}))`
    })
    .from(leads)
    .innerJoin(
      leadHistory,
      and(
        eq(leadHistory.leadId, leads.id),
        eq(leadHistory.corretorId, corretorId)
      )
    )
    .where(and(...conditions))
    .groupBy(leads.id);
  
  const tempoMedioResposta = Number(tempoRespostaResult[0]?.avgHours || 0);

  // Leads por status
  const leadsPorStatusResult = await db
    .select({
      status: leads.status,
      count: sql<number>`count(*)`
    })
    .from(leads)
    .where(and(...conditions))
    .groupBy(leads.status);
  
  const leadsPorStatus = leadsPorStatusResult.map((row: any) => ({
    status: row.status,
    count: Number(row.count)
  }));

  // Leads por projeto
  const leadsPorProjetoResult = await db
    .select({
      projectId: leads.projectId,
      count: sql<number>`count(*)`,
      convertidos: sql<number>`SUM(CASE WHEN ${leads.status} = 'contrato_fechado' THEN 1 ELSE 0 END)`
    })
    .from(leads)
    .where(
      and(
        ...conditions,
        sql`${leads.projectId} IS NOT NULL`
      )
    )
    .groupBy(leads.projectId);
  
  // Buscar nomes dos projetos
  const leadsPorProjeto = await Promise.all(
    leadsPorProjetoResult.map(async (row: any) => {
      const projectResult = await db.select().from(projects).where(eq(projects.id, row.projectId!)).limit(1);
      const project = projectResult.length > 0 ? projectResult[0] : null;
      
      return {
        projectId: row.projectId!,
        projectName: project?.nome || "Projeto Desconhecido",
        count: Number(row.count),
        convertidos: Number(row.convertidos)
      };
    })
  );

  return {
    totalLeads,
    leadsContatados,
    leadsConvertidos,
    leadsPerdidos,
    taxaConversao: Math.round(taxaConversao * 100) / 100,
    taxaContato: Math.round(taxaContato * 100) / 100,
    tempoMedioResposta: Math.round(tempoMedioResposta * 100) / 100,
    leadsPorStatus,
    leadsPorProjeto: leadsPorProjeto.sort((a: any, b: any) => b.count - a.count)
  };
}

/**
 * Calcula o ranking de corretores por taxa de conversão
 */
export async function calcularRankingCorretores(periodo?: PeriodoFiltro): Promise<RankingCorretor[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Construir condições de filtro
  const conditions = [sql`${leads.corretorId} IS NOT NULL`];
  if (periodo?.dataInicio) {
    conditions.push(gte(leads.createdAt, periodo.dataInicio));
  }
  if (periodo?.dataFim) {
    conditions.push(lte(leads.createdAt, periodo.dataFim));
  }
  
  const rankingResult = await db
    .select({
      corretorId: leads.corretorId,
      totalLeads: sql<number>`count(*)`,
      leadsConvertidos: sql<number>`SUM(CASE WHEN ${leads.status} = 'contrato_fechado' THEN 1 ELSE 0 END)`
    })
    .from(leads)
    .where(and(...conditions))
    .groupBy(leads.corretorId);

  // Buscar nomes dos corretores e calcular taxa de conversão
  const ranking = await Promise.all(
    rankingResult.map(async (row: any) => {
      const corretorResult = await db.select().from(users).where(eq(users.id, row.corretorId!)).limit(1);
      const corretor = corretorResult.length > 0 ? corretorResult[0] : null;
      
      const totalLeads = Number(row.totalLeads);
      const leadsConvertidos = Number(row.leadsConvertidos);
      const taxaConversao = totalLeads > 0 ? (leadsConvertidos / totalLeads) * 100 : 0;
      
      return {
        corretorId: row.corretorId!,
        corretorNome: corretor?.name || "Corretor Desconhecido",
        totalLeads,
        leadsConvertidos,
        taxaConversao: Math.round(taxaConversao * 100) / 100,
        posicao: 0 // Será preenchido depois da ordenação
      };
    })
  );

  // Ordenar por taxa de conversão (decrescente) e atribuir posições
  ranking.sort((a: RankingCorretor, b: RankingCorretor) => b.taxaConversao - a.taxaConversao);
  ranking.forEach((item: RankingCorretor, index: number) => {
    item.posicao = index + 1;
  });

  return ranking;
}
