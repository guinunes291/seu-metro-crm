/**
 * Central de Análises — Backend consolidado
 * 
 * Agrupa todas as queries necessárias para a nova Central de Análises,
 * reaproveitando funções existentes de db.ts e adicionando novas.
 */
import { getDb } from "./db";
import { leads, users, contratos, leadStatusTransitions, equipes, metas } from "../drizzle/schema";
import { eq, and, sql, gte, lte, inArray, desc, isNotNull } from "drizzle-orm";

// ============================================================================
// TIPOS
// ============================================================================

export interface VisaoGeralKPIs {
  leads: { valor: number; meta: number; percentual: number };
  agendamentos: { valor: number; meta: number; percentual: number };
  visitas: { valor: number; meta: number; percentual: number };
  contratos_val: { valor: number; meta: number; percentual: number };
  vgv: { valor: number; meta: number; percentual: number };
  taxaConversao: number;
}

export interface AlertaItem {
  tipo: 'perigo' | 'atencao' | 'info';
  titulo: string;
  descricao: string;
  icone: string;
}

export interface EquipeComparativo {
  equipeId: number;
  equipeNome: string;
  gestorNome: string;
  cor: string;
  totalLeads: number;
  agendamentos: number;
  visitas: number;
  contratosCount: number;
  vgv: number;
  metaVGV: number;
  percentualMeta: number;
  taxaConversao: number;
  corretoresCount: number;
}

export interface FunilEtapa {
  etapa: string;
  etapaLabel: string;
  quantidade: number;
  percentualDoTotal: number;
  taxaConversaoProxima: number;
  perda: number;
  isGargalo: boolean;
}

export interface MetaProgresso {
  corretorId: number;
  corretorNome: string;
  fotoUrl: string | null;
  equipeNome: string | null;
  metaContratos: number;
  realizadoContratos: number;
  percentualContratos: number;
  metaVGV: number;
  realizadoVGV: number;
  percentualVGV: number;
  metaLeads: number;
  realizadoLeads: number;
  percentualLeads: number;
  projecaoVGV: number;
  ritmoNecessario: number;
  status: 'verde' | 'amarelo' | 'vermelho';
}

// ============================================================================
// VISÃO GERAL — KPIs + Alertas
// ============================================================================

export async function getVisaoGeralKPIs(
  dataInicio: Date,
  dataFim: Date,
  mes: number,
  ano: number,
  corretoresIds: number[] | null
): Promise<{ kpis: VisaoGeralKPIs; alertas: AlertaItem[] }> {
  const db = await getDb();
  if (!db) return { kpis: emptyKPIs(), alertas: [] };

  // Filtro base de leads
  const leadConditions: any[] = [
    gte(leads.createdAt, dataInicio),
    lte(leads.createdAt, dataFim),
  ];
  if (corretoresIds && corretoresIds.length > 0) {
    leadConditions.push(inArray(leads.corretorId, corretoresIds));
  }

  // Contagem de leads por status
  const statusCounts = await db.select({
    status: leads.status,
    count: sql<number>`COUNT(*)`,
  }).from(leads).where(and(...leadConditions)).groupBy(leads.status);

  const statusMap = new Map<string, number>();
  let totalLeads = 0;
  for (const row of statusCounts) {
    const cnt = Number(row.count);
    statusMap.set(row.status, cnt);
    totalLeads += cnt;
  }

  // Transições no período (agendamentos e visitas)
  const transConditions: any[] = [
    gte(leadStatusTransitions.createdAt, dataInicio),
    lte(leadStatusTransitions.createdAt, dataFim),
  ];
  if (corretoresIds && corretoresIds.length > 0) {
    transConditions.push(inArray(leadStatusTransitions.corretorId, corretoresIds));
  }
  const transCounts = await db.select({
    statusNovo: leadStatusTransitions.statusNovo,
    count: sql<number>`COUNT(DISTINCT ${leadStatusTransitions.leadId})`,
  }).from(leadStatusTransitions).where(and(...transConditions)).groupBy(leadStatusTransitions.statusNovo);

  const transMap = new Map<string, number>();
  for (const row of transCounts) {
    transMap.set(row.statusNovo, Number(row.count));
  }

  const agendamentos = transMap.get('agendado') || 0;
  const visitas = transMap.get('visita_realizada') || 0;

  // Contratos e VGV
  const contratosConditions: any[] = [
    eq(contratos.distrato, false),
    gte(contratos.createdAt, dataInicio),
    lte(contratos.createdAt, dataFim),
  ];
  if (corretoresIds && corretoresIds.length > 0) {
    contratosConditions.push(inArray(contratos.corretorId, corretoresIds));
  }
  const contratosResult = await db.select({
    count: sql<number>`COUNT(*)`,
    vgv: sql<number>`COALESCE(SUM(${contratos.valorVenda}), 0)`,
  }).from(contratos).where(and(...contratosConditions));

  const contratosCount = Number(contratosResult[0]?.count || 0);
  const vgvTotal = Number(contratosResult[0]?.vgv || 0);

  // Metas — somar metas individuais de todos os corretores do filtro
  const metasConditions: any[] = [
    eq(metas.mes, mes),
    eq(metas.ano, ano),
  ];
  if (corretoresIds && corretoresIds.length > 0) {
    metasConditions.push(inArray(metas.corretorId, corretoresIds));
  }
  const metasResult = await db.select({
    metaLeads: sql<number>`COALESCE(SUM(${metas.metaLeads}), 0)`,
    metaAgendamentos: sql<number>`COALESCE(SUM(${metas.metaAgendamentos}), 0)`,
    metaVisitas: sql<number>`COALESCE(SUM(${metas.metaVisitas}), 0)`,
    metaContratos: sql<number>`COALESCE(SUM(${metas.metaContratos}), 0)`,
    metaVGV: sql<number>`COALESCE(SUM(${metas.metaVGV}), 0)`,
  }).from(metas).where(and(...metasConditions));

  const metaLeads = Number(metasResult[0]?.metaLeads || 0);
  const metaAgend = Number(metasResult[0]?.metaAgendamentos || 0);
  const metaVisitas = Number(metasResult[0]?.metaVisitas || 0);
  const metaContratos = Number(metasResult[0]?.metaContratos || 0);
  const metaVGV = Number(metasResult[0]?.metaVGV || 0);

  const pct = (v: number, m: number) => m > 0 ? Math.round((v / m) * 10000) / 100 : 0;
  const taxaConversao = totalLeads > 0 ? Math.round((contratosCount / totalLeads) * 10000) / 100 : 0;

  const kpis: VisaoGeralKPIs = {
    leads: { valor: totalLeads, meta: metaLeads, percentual: pct(totalLeads, metaLeads) },
    agendamentos: { valor: agendamentos, meta: metaAgend, percentual: pct(agendamentos, metaAgend) },
    visitas: { valor: visitas, meta: metaVisitas, percentual: pct(visitas, metaVisitas) },
    contratos_val: { valor: contratosCount, meta: metaContratos, percentual: pct(contratosCount, metaContratos) },
    vgv: { valor: vgvTotal, meta: metaVGV, percentual: pct(vgvTotal, metaVGV) },
    taxaConversao,
  };

  // Alertas
  const alertas: AlertaItem[] = [];

  // Corretores com 0 agendamentos
  if (corretoresIds && corretoresIds.length > 0) {
    const corretoresSemAgend = await db.select({
      id: users.id,
      name: users.name,
    }).from(users).where(
      and(
        inArray(users.id, corretoresIds),
        sql`${users.situacao} != 'inativo'`
      )
    );

    const corretoresComAgend = new Set<number>();
    const transAgendRows = await db.select({
      corretorId: leadStatusTransitions.corretorId,
    }).from(leadStatusTransitions).where(
      and(
        inArray(leadStatusTransitions.corretorId, corretoresIds),
        eq(leadStatusTransitions.statusNovo, 'agendado'),
        gte(leadStatusTransitions.createdAt, dataInicio),
        lte(leadStatusTransitions.createdAt, dataFim),
      )
    ).groupBy(leadStatusTransitions.corretorId);

    for (const row of transAgendRows) {
      if (row.corretorId) corretoresComAgend.add(row.corretorId);
    }

    const semAgend = corretoresSemAgend.filter(c => !corretoresComAgend.has(c.id));
    if (semAgend.length > 0) {
      alertas.push({
        tipo: 'perigo',
        titulo: `${semAgend.length} corretor(es) sem agendamentos`,
        descricao: semAgend.slice(0, 3).map(c => c.name).join(', ') + (semAgend.length > 3 ? ` e mais ${semAgend.length - 3}` : ''),
        icone: 'calendar-x',
      });
    }
  }

  // Meta VGV abaixo de 50%
  if (metaVGV > 0 && kpis.vgv.percentual < 50) {
    alertas.push({
      tipo: 'atencao',
      titulo: 'VGV abaixo de 50% da meta',
      descricao: `R$ ${(vgvTotal / 100).toLocaleString('pt-BR')} de R$ ${(metaVGV / 100).toLocaleString('pt-BR')} (${kpis.vgv.percentual}%)`,
      icone: 'trending-down',
    });
  }

  // Taxa de conversão muito baixa
  if (totalLeads > 50 && taxaConversao < 0.5) {
    alertas.push({
      tipo: 'atencao',
      titulo: 'Taxa de conversão baixa',
      descricao: `Apenas ${taxaConversao}% dos leads estão convertendo em contratos`,
      icone: 'alert-triangle',
    });
  }

  return { kpis, alertas };
}

function emptyKPIs(): VisaoGeralKPIs {
  return {
    leads: { valor: 0, meta: 0, percentual: 0 },
    agendamentos: { valor: 0, meta: 0, percentual: 0 },
    visitas: { valor: 0, meta: 0, percentual: 0 },
    contratos_val: { valor: 0, meta: 0, percentual: 0 },
    vgv: { valor: 0, meta: 0, percentual: 0 },
    taxaConversao: 0,
  };
}

// ============================================================================
// COMPARATIVO DE EQUIPES
// ============================================================================

export async function getComparativoEquipes(
  dataInicio: Date,
  dataFim: Date,
  corretoresIds: number[] | null
): Promise<EquipeComparativo[]> {
  const db = await getDb();
  if (!db) return [];

  // Buscar equipes ativas
  const equipesResult = await db.select({
    id: equipes.id,
    nome: equipes.nome,
    gestorId: equipes.gestorId,
    cor: equipes.cor,
    metaMensal: equipes.metaMensal,
  }).from(equipes).where(eq(equipes.ativa, true));

  if (equipesResult.length === 0) return [];

  // Buscar gestores
  const gestorIds = equipesResult.map(e => e.gestorId).filter(Boolean) as number[];
  const gestores = gestorIds.length > 0 ? await db.select({
    id: users.id,
    name: users.name,
  }).from(users).where(inArray(users.id, gestorIds)) : [];
  const gestorMap = new Map(gestores.map(g => [g.id, g.name || 'Sem nome']));

  // Buscar todos os corretores com equipe
  let corretoresResult = await db.select({
    id: users.id,
    equipeId: users.equipeId,
  }).from(users).where(isNotNull(users.equipeId));

  if (corretoresIds && corretoresIds.length > 0) {
    corretoresResult = corretoresResult.filter(c => corretoresIds.includes(c.id));
  }

  // Agrupar corretores por equipe
  const corretoresPorEquipe = new Map<number, number[]>();
  for (const c of corretoresResult) {
    if (!c.equipeId) continue;
    if (!corretoresPorEquipe.has(c.equipeId)) corretoresPorEquipe.set(c.equipeId, []);
    corretoresPorEquipe.get(c.equipeId)!.push(c.id);
  }

  const resultado: EquipeComparativo[] = [];

  for (const equipe of equipesResult) {
    const membrosIds = corretoresPorEquipe.get(equipe.id) || [];
    
    // Incluir gestor se não estiver na lista
    if (equipe.gestorId && !membrosIds.includes(equipe.gestorId)) {
      membrosIds.push(equipe.gestorId);
    }
    
    if (membrosIds.length === 0) continue;

    // Se temos filtro de corretores, verificar se algum membro está no filtro
    if (corretoresIds && corretoresIds.length > 0) {
      const membrosNoFiltro = membrosIds.filter(id => corretoresIds.includes(id));
      if (membrosNoFiltro.length === 0) continue;
    }

    // Leads
    const leadsCount = await db.select({
      count: sql<number>`COUNT(*)`,
    }).from(leads).where(and(
      inArray(leads.corretorId, membrosIds),
      gte(leads.createdAt, dataInicio),
      lte(leads.createdAt, dataFim),
    ));

    // Transições
    const transResult = await db.select({
      statusNovo: leadStatusTransitions.statusNovo,
      count: sql<number>`COUNT(DISTINCT ${leadStatusTransitions.leadId})`,
    }).from(leadStatusTransitions).where(and(
      inArray(leadStatusTransitions.corretorId, membrosIds),
      gte(leadStatusTransitions.createdAt, dataInicio),
      lte(leadStatusTransitions.createdAt, dataFim),
    )).groupBy(leadStatusTransitions.statusNovo);

    const transMapEquipe = new Map<string, number>();
    for (const row of transResult) {
      transMapEquipe.set(row.statusNovo, Number(row.count));
    }

    // Contratos e VGV
    const contratosResult = await db.select({
      count: sql<number>`COUNT(*)`,
      vgv: sql<number>`COALESCE(SUM(${contratos.valorVenda}), 0)`,
    }).from(contratos).where(and(
      inArray(contratos.corretorId, membrosIds),
      eq(contratos.distrato, false),
      gte(contratos.createdAt, dataInicio),
      lte(contratos.createdAt, dataFim),
    ));

    // Metas da equipe (somar metas individuais dos membros)
    const mesAtual = dataInicio.getMonth() + 1;
    const anoAtual = dataInicio.getFullYear();
    const metasEquipe = await db.select({
      metaVGV: sql<number>`COALESCE(SUM(${metas.metaVGV}), 0)`,
    }).from(metas).where(and(
      inArray(metas.corretorId, membrosIds),
      eq(metas.mes, mesAtual),
      eq(metas.ano, anoAtual),
    ));

    const totalLeads = Number(leadsCount[0]?.count || 0);
    const contratosCountEquipe = Number(contratosResult[0]?.count || 0);
    const vgvEquipe = Number(contratosResult[0]?.vgv || 0);
    const metaVGVEquipe = Number(metasEquipe[0]?.metaVGV || 0);

    resultado.push({
      equipeId: equipe.id,
      equipeNome: equipe.nome,
      gestorNome: gestorMap.get(equipe.gestorId!) || 'Sem gestor',
      cor: equipe.cor || '#3b82f6',
      totalLeads,
      agendamentos: transMapEquipe.get('agendado') || 0,
      visitas: transMapEquipe.get('visita_realizada') || 0,
      contratosCount: contratosCountEquipe,
      vgv: vgvEquipe,
      metaVGV: metaVGVEquipe,
      percentualMeta: metaVGVEquipe > 0 ? Math.round((vgvEquipe / metaVGVEquipe) * 10000) / 100 : 0,
      taxaConversao: totalLeads > 0 ? Math.round((contratosCountEquipe / totalLeads) * 10000) / 100 : 0,
      corretoresCount: membrosIds.length,
    });
  }

  return resultado.sort((a, b) => b.vgv - a.vgv);
}

// ============================================================================
// FUNIL COM GARGALOS
// ============================================================================

export async function getFunilComGargalos(
  dataInicio: Date,
  dataFim: Date,
  corretoresIds: number[] | null
): Promise<FunilEtapa[]> {
  const db = await getDb();
  if (!db) return [];

  const leadConditions: any[] = [
    gte(leads.createdAt, dataInicio),
    lte(leads.createdAt, dataFim),
  ];
  if (corretoresIds && corretoresIds.length > 0) {
    leadConditions.push(inArray(leads.corretorId, corretoresIds));
  }

  // Total de leads no período
  const totalResult = await db.select({
    count: sql<number>`COUNT(*)`,
  }).from(leads).where(and(...leadConditions));
  const totalLeads = Number(totalResult[0]?.count || 0);

  if (totalLeads === 0) return [];

  // Transições por status (usando leadStatusTransitions para dados mais precisos)
  const transConditions: any[] = [
    gte(leadStatusTransitions.createdAt, dataInicio),
    lte(leadStatusTransitions.createdAt, dataFim),
  ];
  if (corretoresIds && corretoresIds.length > 0) {
    transConditions.push(inArray(leadStatusTransitions.corretorId, corretoresIds));
  }

  const transCounts = await db.select({
    statusNovo: leadStatusTransitions.statusNovo,
    count: sql<number>`COUNT(DISTINCT ${leadStatusTransitions.leadId})`,
  }).from(leadStatusTransitions).where(and(...transConditions)).groupBy(leadStatusTransitions.statusNovo);

  const transMap = new Map<string, number>();
  for (const row of transCounts) {
    transMap.set(row.statusNovo, Number(row.count));
  }

  // Leads perdidos
  const perdidosConditions: any[] = [
    eq(leads.status, 'perdido'),
    gte(leads.createdAt, dataInicio),
    lte(leads.createdAt, dataFim),
  ];
  if (corretoresIds && corretoresIds.length > 0) {
    perdidosConditions.push(inArray(leads.corretorId, corretoresIds));
  }
  const perdidosResult = await db.select({
    count: sql<number>`COUNT(*)`,
  }).from(leads).where(and(...perdidosConditions));
  const perdidos = Number(perdidosResult[0]?.count || 0);

  // Montar funil
  const etapas = [
    { etapa: 'leads', label: 'Leads Recebidos', valor: totalLeads },
    { etapa: 'em_atendimento', label: 'Em Atendimento', valor: transMap.get('em_atendimento') || 0 },
    { etapa: 'agendado', label: 'Agendamentos', valor: transMap.get('agendado') || 0 },
    { etapa: 'visita_realizada', label: 'Visitas', valor: transMap.get('visita_realizada') || 0 },
    { etapa: 'analise_credito', label: 'Análise de Crédito', valor: transMap.get('analise_credito') || 0 },
    { etapa: 'contrato_fechado', label: 'Contratos', valor: transMap.get('contrato_fechado') || 0 },
  ];

  // Calcular taxas e identificar gargalos
  let maiorPerda = 0;
  let indiceMaiorPerda = -1;

  const funil: FunilEtapa[] = etapas.map((etapa, index) => {
    const percentualDoTotal = totalLeads > 0 ? Math.round((etapa.valor / totalLeads) * 10000) / 100 : 0;
    
    let taxaConversaoProxima = 0;
    let perda = 0;
    
    if (index < etapas.length - 1) {
      const proxima = etapas[index + 1];
      taxaConversaoProxima = etapa.valor > 0 ? Math.round((proxima.valor / etapa.valor) * 10000) / 100 : 0;
      perda = etapa.valor - proxima.valor;
      
      if (perda > maiorPerda && index > 0) {
        maiorPerda = perda;
        indiceMaiorPerda = index;
      }
    }

    return {
      etapa: etapa.etapa,
      etapaLabel: etapa.label,
      quantidade: etapa.valor,
      percentualDoTotal,
      taxaConversaoProxima,
      perda,
      isGargalo: false,
    };
  });

  // Marcar gargalo
  if (indiceMaiorPerda >= 0) {
    funil[indiceMaiorPerda].isGargalo = true;
  }

  // Adicionar perdidos como etapa separada
  funil.push({
    etapa: 'perdido',
    etapaLabel: 'Perdidos',
    quantidade: perdidos,
    percentualDoTotal: totalLeads > 0 ? Math.round((perdidos / totalLeads) * 10000) / 100 : 0,
    taxaConversaoProxima: 0,
    perda: 0,
    isGargalo: false,
  });

  return funil;
}

// ============================================================================
// METAS COM PROJEÇÃO
// ============================================================================

export async function getMetasProgresso(
  mes: number,
  ano: number,
  corretoresIds: number[] | null
): Promise<MetaProgresso[]> {
  const db = await getDb();
  if (!db) return [];

  const dataInicio = new Date(ano, mes - 1, 1);
  const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999);
  const hoje = new Date();
  const diaAtual = hoje.getDate();
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const diasRestantes = Math.max(diasNoMes - diaAtual, 0);

  // Buscar corretores
  let corretoresResult = await db.select({
    id: users.id,
    name: users.name,
    fotoUrl: users.fotoUrl,
    equipeId: users.equipeId,
  }).from(users).where(
    and(
      inArray(users.role, ['corretor', 'gestor', 'admin']),
      sql`${users.situacao} != 'inativo'`
    )
  );

  if (corretoresIds && corretoresIds.length > 0) {
    corretoresResult = corretoresResult.filter(c => corretoresIds.includes(c.id));
  }

  if (corretoresResult.length === 0) return [];

  const ids = corretoresResult.map(c => c.id);

  // Buscar equipes para nomes
  const equipesResult = await db.select({
    id: equipes.id,
    nome: equipes.nome,
  }).from(equipes);
  const equipeMap = new Map(equipesResult.map(e => [e.id, e.nome]));

  // Metas
  const metasResult = await db.select().from(metas).where(
    and(
      inArray(metas.corretorId, ids),
      eq(metas.mes, mes),
      eq(metas.ano, ano),
    )
  );
  const metasMap = new Map(metasResult.map(m => [m.corretorId, m]));

  // Contratos e VGV por corretor
  const contratosResult = await db.select({
    corretorId: contratos.corretorId,
    count: sql<number>`COUNT(*)`,
    vgv: sql<number>`COALESCE(SUM(${contratos.valorVenda}), 0)`,
  }).from(contratos).where(and(
    inArray(contratos.corretorId, ids),
    eq(contratos.distrato, false),
    gte(contratos.createdAt, dataInicio),
    lte(contratos.createdAt, dataFim),
  )).groupBy(contratos.corretorId);
  const contratosMap = new Map(contratosResult.map(r => [r.corretorId!, { count: Number(r.count), vgv: Number(r.vgv) }]));

  // Leads por corretor
  const leadsResult = await db.select({
    corretorId: leads.corretorId,
    count: sql<number>`COUNT(*)`,
  }).from(leads).where(and(
    inArray(leads.corretorId, ids),
    gte(leads.createdAt, dataInicio),
    lte(leads.createdAt, dataFim),
  )).groupBy(leads.corretorId);
  const leadsMap = new Map(leadsResult.map(r => [r.corretorId!, Number(r.count)]));

  const resultado: MetaProgresso[] = [];

  for (const corretor of corretoresResult) {
    const meta = metasMap.get(corretor.id);
    const contratoData = contratosMap.get(corretor.id) || { count: 0, vgv: 0 };
    const leadsCount = leadsMap.get(corretor.id) || 0;

    const metaContratos = meta?.metaContratos || 0;
    const metaVGV = meta?.metaVGV || 0;
    const metaLeads = meta?.metaLeads || 0;

    const pctContratos = metaContratos > 0 ? Math.round((contratoData.count / metaContratos) * 10000) / 100 : 0;
    const pctVGV = metaVGV > 0 ? Math.round((contratoData.vgv / metaVGV) * 10000) / 100 : 0;
    const pctLeads = metaLeads > 0 ? Math.round((leadsCount / metaLeads) * 10000) / 100 : 0;

    // Projeção: VGV atual * (dias no mês / dias passados)
    const diasPassados = Math.max(diaAtual, 1);
    const projecaoVGV = Math.round((contratoData.vgv / diasPassados) * diasNoMes);

    // Ritmo necessário: quanto precisa vender por dia restante para bater a meta
    const gapVGV = Math.max(metaVGV - contratoData.vgv, 0);
    const ritmoNecessario = diasRestantes > 0 ? Math.round(gapVGV / diasRestantes) : gapVGV;

    // Status semáforo
    let status: 'verde' | 'amarelo' | 'vermelho' = 'verde';
    if (metaVGV > 0) {
      const progressoEsperado = (diasPassados / diasNoMes) * 100;
      if (pctVGV < progressoEsperado * 0.5) status = 'vermelho';
      else if (pctVGV < progressoEsperado * 0.8) status = 'amarelo';
    } else if (metaContratos > 0) {
      if (pctContratos < 50) status = 'vermelho';
      else if (pctContratos < 80) status = 'amarelo';
    }

    resultado.push({
      corretorId: corretor.id,
      corretorNome: corretor.name || 'Sem nome',
      fotoUrl: corretor.fotoUrl,
      equipeNome: corretor.equipeId ? equipeMap.get(corretor.equipeId) || null : null,
      metaContratos,
      realizadoContratos: contratoData.count,
      percentualContratos: pctContratos,
      metaVGV,
      realizadoVGV: contratoData.vgv,
      percentualVGV: pctVGV,
      metaLeads,
      realizadoLeads: leadsCount,
      percentualLeads: pctLeads,
      projecaoVGV,
      ritmoNecessario,
      status,
    });
  }

  return resultado.sort((a, b) => b.realizadoVGV - a.realizadoVGV);
}

// ============================================================================
// EVOLUÇÃO TEMPORAL
// ============================================================================

export async function getEvolucaoTemporal(
  dataInicio: Date,
  dataFim: Date,
  corretoresIds: number[] | null,
  agrupamento: 'dia' | 'semana' | 'mes' = 'dia'
): Promise<Array<{
  periodo: string;
  leads: number;
  agendamentos: number;
  visitas: number;
  contratos_val: number;
  vgv: number;
}>> {
  const db = await getDb();
  if (!db) return [];

  const dateFormat = agrupamento === 'dia' ? '%Y-%m-%d' : agrupamento === 'semana' ? '%Y-%u' : '%Y-%m';

  // Leads por período
  const leadsConditions: any[] = [
    gte(leads.createdAt, dataInicio),
    lte(leads.createdAt, dataFim),
  ];
  if (corretoresIds && corretoresIds.length > 0) {
    leadsConditions.push(inArray(leads.corretorId, corretoresIds));
  }

  const leadsData = await db.select({
    periodo: sql<string>`DATE_FORMAT(${leads.createdAt}, ${dateFormat})`,
    count: sql<number>`COUNT(*)`,
  }).from(leads).where(and(...leadsConditions)).groupBy(sql`periodo`).orderBy(sql`periodo`);

  // Transições por período
  const transConditions: any[] = [
    gte(leadStatusTransitions.createdAt, dataInicio),
    lte(leadStatusTransitions.createdAt, dataFim),
  ];
  if (corretoresIds && corretoresIds.length > 0) {
    transConditions.push(inArray(leadStatusTransitions.corretorId, corretoresIds));
  }

  const transData = await db.select({
    periodo: sql<string>`DATE_FORMAT(${leadStatusTransitions.createdAt}, ${dateFormat})`,
    statusNovo: leadStatusTransitions.statusNovo,
    count: sql<number>`COUNT(DISTINCT ${leadStatusTransitions.leadId})`,
  }).from(leadStatusTransitions).where(and(...transConditions))
    .groupBy(sql`periodo`, leadStatusTransitions.statusNovo)
    .orderBy(sql`periodo`);

  // Contratos por período
  const contratosConditions: any[] = [
    eq(contratos.distrato, false),
    gte(contratos.createdAt, dataInicio),
    lte(contratos.createdAt, dataFim),
  ];
  if (corretoresIds && corretoresIds.length > 0) {
    contratosConditions.push(inArray(contratos.corretorId, corretoresIds));
  }

  const contratosData = await db.select({
    periodo: sql<string>`DATE_FORMAT(${contratos.createdAt}, ${dateFormat})`,
    count: sql<number>`COUNT(*)`,
    vgv: sql<number>`COALESCE(SUM(${contratos.valorVenda}), 0)`,
  }).from(contratos).where(and(...contratosConditions)).groupBy(sql`periodo`).orderBy(sql`periodo`);

  // Consolidar
  const periodosSet = new Set<string>();
  for (const row of leadsData) periodosSet.add(row.periodo);
  for (const row of transData) periodosSet.add(row.periodo);
  for (const row of contratosData) periodosSet.add(row.periodo);

  const periodos = Array.from(periodosSet).sort();

  return periodos.map(periodo => {
    const leadsCount = Number(leadsData.find(r => r.periodo === periodo)?.count || 0);
    const agendamentos = Number(transData.find(r => r.periodo === periodo && r.statusNovo === 'agendado')?.count || 0);
    const visitasCount = Number(transData.find(r => r.periodo === periodo && r.statusNovo === 'visita_realizada')?.count || 0);
    const contratosRow = contratosData.find(r => r.periodo === periodo);

    return {
      periodo,
      leads: leadsCount,
      agendamentos,
      visitas: visitasCount,
      contratos_val: Number(contratosRow?.count || 0),
      vgv: Number(contratosRow?.vgv || 0),
    };
  });
}

// ============================================================================
// ORIGENS COM CONVERSÃO
// ============================================================================

export async function getOrigensComConversao(
  dataInicio: Date,
  dataFim: Date,
  corretoresIds: number[] | null
): Promise<Array<{
  origem: string;
  totalLeads: number;
  emAtendimento: number;
  agendados: number;
  visitasRealizadas: number;
  contratosFechados: number;
  perdidos: number;
  taxaConversao: number;
  vgv: number;
}>> {
  const db = await getDb();
  if (!db) return [];

  const leadConditions: any[] = [
    gte(leads.createdAt, dataInicio),
    lte(leads.createdAt, dataFim),
  ];
  if (corretoresIds && corretoresIds.length > 0) {
    leadConditions.push(inArray(leads.corretorId, corretoresIds));
  }

  const origemData = await db.select({
    origem: leads.origem,
    status: leads.status,
    count: sql<number>`COUNT(*)`,
  }).from(leads).where(and(...leadConditions)).groupBy(leads.origem, leads.status);

  // Agrupar por origem
  const origemMap = new Map<string, any>();
  for (const row of origemData) {
    const origem = row.origem || 'Não especificado';
    if (!origemMap.has(origem)) {
      origemMap.set(origem, {
        origem,
        totalLeads: 0,
        emAtendimento: 0,
        agendados: 0,
        visitasRealizadas: 0,
        contratosFechados: 0,
        perdidos: 0,
        vgv: 0,
      });
    }
    const entry = origemMap.get(origem)!;
    const cnt = Number(row.count);
    entry.totalLeads += cnt;
    if (row.status === 'em_atendimento') entry.emAtendimento += cnt;
    if (row.status === 'agendado') entry.agendados += cnt;
    if (row.status === 'visita_realizada') entry.visitasRealizadas += cnt;
    if (row.status === 'contrato_fechado') entry.contratosFechados += cnt;
    if (row.status === 'perdido') entry.perdidos += cnt;
  }

  // VGV por origem (via contratos + leads)
  const contratosConditions: any[] = [
    eq(contratos.distrato, false),
    gte(contratos.createdAt, dataInicio),
    lte(contratos.createdAt, dataFim),
  ];
  if (corretoresIds && corretoresIds.length > 0) {
    contratosConditions.push(inArray(contratos.corretorId, corretoresIds));
  }

  // Buscar VGV por lead que tem contrato
  const contratosComLead = await db.select({
    leadId: contratos.leadId,
    vgv: contratos.valorVenda,
  }).from(contratos).where(and(...contratosConditions));

  if (contratosComLead.length > 0) {
    const leadIds = contratosComLead.filter(c => c.leadId).map(c => c.leadId!) as number[];
    if (leadIds.length > 0) {
      const leadsComOrigem = await db.select({
        id: leads.id,
        origem: leads.origem,
      }).from(leads).where(inArray(leads.id, leadIds));

      const leadOrigemMap = new Map(leadsComOrigem.map(l => [l.id, l.origem || 'Não especificado']));

      for (const contrato of contratosComLead) {
        if (contrato.leadId) {
          const origem = leadOrigemMap.get(contrato.leadId) || 'Não especificado';
          if (origemMap.has(origem)) {
            origemMap.get(origem)!.vgv += Number(contrato.vgv || 0);
          }
        }
      }
    }
  }

  const resultado = Array.from(origemMap.values()).map(entry => ({
    ...entry,
    taxaConversao: entry.totalLeads > 0 ? Math.round((entry.contratosFechados / entry.totalLeads) * 10000) / 100 : 0,
  }));

  return resultado.sort((a, b) => b.totalLeads - a.totalLeads);
}
