import { getDb } from "./db";
import { leads, projects, users } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

interface ConversaoPorProjeto {
  projectId: number;
  projectNome: string;
  totalLeads: number;
  leadsContatados: number;
  leadsAgendados: number;
  visitasRealizadas: number;
  contratosFechados: number;
  leadsPerdidos: number;
  taxaContato: number; // % de leads contatados
  taxaAgendamento: number; // % de leads agendados
  taxaVisita: number; // % de visitas realizadas
  taxaConversao: number; // % de contratos fechados
  ticketMedio: number; // Valor médio dos contratos (se disponível)
}

/**
 * Calcula estatísticas de conversão por projeto
 */
export async function calcularConversaoPorProjeto(
  periodo?: { dataInicio?: Date; dataFim?: Date },
  corretoresIds?: number[]
): Promise<ConversaoPorProjeto[]> {
  const db = await getDb();
  if (!db) return [];

  // Buscar todos os projetos
  const todosProjetos = await db.select().from(projects);

  const resultado: ConversaoPorProjeto[] = [];

  for (const projeto of todosProjetos) {
    // Buscar leads do projeto com filtro de período e equipe se fornecido
    let leadsDoProjeto;
    
    if (periodo?.dataInicio && periodo?.dataFim) {
      leadsDoProjeto = await db
        .select()
        .from(leads)
        .where(
          and(
            eq(leads.projectId, projeto.id),
            sql`${leads.createdAt} >= ${periodo.dataInicio}`,
            sql`${leads.createdAt} <= ${periodo.dataFim}`
          )
        );
    } else {
      leadsDoProjeto = await db
        .select()
        .from(leads)
        .where(eq(leads.projectId, projeto.id));
    }
    
    // Filtrar por equipe se necessário
    if (corretoresIds) {
      leadsDoProjeto = leadsDoProjeto.filter(l => l.corretorId && corretoresIds.includes(l.corretorId));
    }

    if (leadsDoProjeto.length === 0) {
      // Projeto sem leads, pular
      continue;
    }

    const totalLeads = leadsDoProjeto.length;
    const leadsContatados = leadsDoProjeto.filter(
      (l) => l.status !== "novo" && l.status !== "aguardando_atendimento"
    ).length;
    const leadsAgendados = leadsDoProjeto.filter(
      (l) => l.status === "agendado" || l.status === "visita_realizada" || l.status === "analise_credito" || l.status === "contrato_fechado"
    ).length;
    const visitasRealizadas = leadsDoProjeto.filter(
      (l) => l.status === "visita_realizada" || l.status === "analise_credito" || l.status === "contrato_fechado"
    ).length;
    const contratosFechados = leadsDoProjeto.filter(
      (l) => l.status === "contrato_fechado"
    ).length;
    const leadsPerdidos = leadsDoProjeto.filter(
      (l) => l.status === "perdido"
    ).length;

    const taxaContato = totalLeads > 0 ? (leadsContatados / totalLeads) * 100 : 0;
    const taxaAgendamento = totalLeads > 0 ? (leadsAgendados / totalLeads) * 100 : 0;
    const taxaVisita = leadsAgendados > 0 ? (visitasRealizadas / leadsAgendados) * 100 : 0;
    const taxaConversao = totalLeads > 0 ? (contratosFechados / totalLeads) * 100 : 0;

    resultado.push({
      projectId: projeto.id,
      projectNome: projeto.nome,
      totalLeads,
      leadsContatados,
      leadsAgendados,
      visitasRealizadas,
      contratosFechados,
      leadsPerdidos,
      taxaContato: Math.round(taxaContato * 100) / 100,
      taxaAgendamento: Math.round(taxaAgendamento * 100) / 100,
      taxaVisita: Math.round(taxaVisita * 100) / 100,
      taxaConversao: Math.round(taxaConversao * 100) / 100,
      ticketMedio: 0, // TODO: Implementar quando houver campo de valor
    });
  }

  // Ordenar por taxa de conversão (maior primeiro)
  resultado.sort((a, b) => b.taxaConversao - a.taxaConversao);

  return resultado;
}

interface ConversaoPorCorretor {
  corretorId: number;
  corretorNome: string;
  totalLeads: number;
  leadsContatados: number;
  leadsAgendados: number;
  visitasRealizadas: number;
  contratosFechados: number;
  leadsPerdidos: number;
  taxaContato: number;
  taxaAgendamento: number;
  taxaVisita: number;
  taxaConversao: number;
  tempoMedioResposta: number; // Em horas
}

/**
 * Calcula estatísticas de conversão por corretor
 */
export async function calcularConversaoPorCorretor(
  periodo?: { dataInicio?: Date; dataFim?: Date },
  corretoresIds?: number[]
): Promise<ConversaoPorCorretor[]> {
  const db = await getDb();
  if (!db) return [];

  // Buscar todos os corretores com leads
  let query = db
    .select({
      corretorId: leads.corretorId,
    })
    .from(leads)
    .where(sql`${leads.corretorId} IS NOT NULL`);
  
  const corretoresComLeads = await query.groupBy(leads.corretorId);

  const resultado: ConversaoPorCorretor[] = [];

  for (const { corretorId } of corretoresComLeads) {
    if (!corretorId) continue;
    
    // Filtrar por equipe se necessário
    if (corretoresIds && !corretoresIds.includes(corretorId)) continue;

    // Buscar dados do corretor
    const corretor = await db
      .select()
      .from(users)
      .where(eq(users.id, corretorId))
      .limit(1);

    if (corretor.length === 0) continue;

    // Buscar leads do corretor com filtro de período
    let leadsDoCorretor;
    
    if (periodo?.dataInicio && periodo?.dataFim) {
      leadsDoCorretor = await db
        .select()
        .from(leads)
        .where(
          and(
            eq(leads.corretorId, corretorId),
            sql`${leads.createdAt} >= ${periodo.dataInicio}`,
            sql`${leads.createdAt} <= ${periodo.dataFim}`
          )
        );
    } else {
      leadsDoCorretor = await db
        .select()
        .from(leads)
        .where(eq(leads.corretorId, corretorId));
    }

    if (leadsDoCorretor.length === 0) continue;

    const totalLeads = leadsDoCorretor.length;
    const leadsContatados = leadsDoCorretor.filter(
      (l) => l.status !== "novo" && l.status !== "aguardando_atendimento"
    ).length;
    const leadsAgendados = leadsDoCorretor.filter(
      (l) => l.status === "agendado" || l.status === "visita_realizada" || l.status === "analise_credito" || l.status === "contrato_fechado"
    ).length;
    const visitasRealizadas = leadsDoCorretor.filter(
      (l) => l.status === "visita_realizada" || l.status === "analise_credito" || l.status === "contrato_fechado"
    ).length;
    const contratosFechados = leadsDoCorretor.filter(
      (l) => l.status === "contrato_fechado"
    ).length;
    const leadsPerdidos = leadsDoCorretor.filter(
      (l) => l.status === "perdido"
    ).length;

    const taxaContato = totalLeads > 0 ? (leadsContatados / totalLeads) * 100 : 0;
    const taxaAgendamento = totalLeads > 0 ? (leadsAgendados / totalLeads) * 100 : 0;
    const taxaVisita = leadsAgendados > 0 ? (visitasRealizadas / leadsAgendados) * 100 : 0;
    const taxaConversao = totalLeads > 0 ? (contratosFechados / totalLeads) * 100 : 0;

    // Calcular tempo médio de resposta (simplificado)
    // TODO: Implementar cálculo real baseado em leadHistory
    const tempoMedioResposta = 0;

    resultado.push({
      corretorId: corretor[0].id,
      corretorNome: corretor[0].name || "",
      totalLeads,
      leadsContatados,
      leadsAgendados,
      visitasRealizadas,
      contratosFechados,
      leadsPerdidos,
      taxaContato: Math.round(taxaContato * 100) / 100,
      taxaAgendamento: Math.round(taxaAgendamento * 100) / 100,
      taxaVisita: Math.round(taxaVisita * 100) / 100,
      taxaConversao: Math.round(taxaConversao * 100) / 100,
      tempoMedioResposta,
    });
  }

  // Ordenar por taxa de conversão (maior primeiro)
  resultado.sort((a, b) => b.taxaConversao - a.taxaConversao);

  return resultado;
}

/**
 * Calcula estatísticas gerais do CRM
 */
export async function calcularEstatisticasGerais(
  periodo?: { dataInicio?: Date; dataFim?: Date },
  corretoresIds?: number[]
): Promise<{
  totalLeads: number;
  leadsDistribuidos: number;
  leadsNaoDistribuidos: number;
  leadsContatados: number;
  leadsAgendados: number;
  visitasRealizadas: number;
  contratosFechados: number;
  leadsPerdidos: number;
  taxaDistribuicao: number;
  taxaContato: number;
  taxaConversao: number;
  projetosAtivos: number;
  corretoresAtivos: number;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalLeads: 0,
      leadsDistribuidos: 0,
      leadsNaoDistribuidos: 0,
      leadsContatados: 0,
      leadsAgendados: 0,
      visitasRealizadas: 0,
      contratosFechados: 0,
      leadsPerdidos: 0,
      taxaDistribuicao: 0,
      taxaContato: 0,
      taxaConversao: 0,
      projetosAtivos: 0,
      corretoresAtivos: 0,
    };
  }

  // Buscar todos os leads (com filtro de período e equipe se fornecido)
  let todosLeads;

  if (periodo?.dataInicio && periodo?.dataFim) {
    todosLeads = await db
      .select()
      .from(leads)
      .where(
        and(
          sql`${leads.createdAt} >= ${periodo.dataInicio}`,
          sql`${leads.createdAt} <= ${periodo.dataFim}`
        )
      );
  } else {
    todosLeads = await db.select().from(leads);
  }
  
  // Filtrar por equipe se necessário
  if (corretoresIds) {
    todosLeads = todosLeads.filter(l => l.corretorId && corretoresIds.includes(l.corretorId));
  }

  const totalLeads = todosLeads.length;
  const leadsDistribuidos = todosLeads.filter((l) => l.corretorId !== null).length;
  const leadsNaoDistribuidos = todosLeads.filter((l) => l.corretorId === null).length;
  const leadsContatados = todosLeads.filter(
    (l) => l.status !== "novo" && l.status !== "aguardando_atendimento"
  ).length;
  const leadsAgendados = todosLeads.filter(
    (l) => l.status === "agendado" || l.status === "visita_realizada" || l.status === "analise_credito" || l.status === "contrato_fechado"
  ).length;
  const visitasRealizadas = todosLeads.filter(
    (l) => l.status === "visita_realizada" || l.status === "analise_credito" || l.status === "contrato_fechado"
  ).length;
  const contratosFechados = todosLeads.filter((l) => l.status === "contrato_fechado").length;
  const leadsPerdidos = todosLeads.filter((l) => l.status === "perdido").length;

  const taxaDistribuicao = totalLeads > 0 ? (leadsDistribuidos / totalLeads) * 100 : 0;
  const taxaContato = leadsDistribuidos > 0 ? (leadsContatados / leadsDistribuidos) * 100 : 0;
  const taxaConversao = totalLeads > 0 ? (contratosFechados / totalLeads) * 100 : 0;

  // Contar projetos ativos
  const projetosAtivos = await db
    .select()
    .from(projects)
    .where(eq(projects.status, "ativo"));

  // Contar corretores ativos (presentes)
  const corretoresAtivos = await db
    .select()
    .from(users)
    .where(and(eq(users.role, "corretor"), eq(users.status, "presente")));

  return {
    totalLeads,
    leadsDistribuidos,
    leadsNaoDistribuidos,
    leadsContatados,
    leadsAgendados,
    visitasRealizadas,
    contratosFechados,
    leadsPerdidos,
    taxaDistribuicao: Math.round(taxaDistribuicao * 100) / 100,
    taxaContato: Math.round(taxaContato * 100) / 100,
    taxaConversao: Math.round(taxaConversao * 100) / 100,
    projetosAtivos: projetosAtivos.length,
    corretoresAtivos: corretoresAtivos.length,
  };
}
