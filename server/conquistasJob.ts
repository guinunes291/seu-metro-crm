import { getDb } from "./db";
import * as schema from "../drizzle/schema";
import { users, conquistas, atividadesDiarias, leads } from "../drizzle/schema";
import { eq, and, gte, lte, sql, count, inArray } from "drizzle-orm";
import { CONQUISTAS, type Conquista } from "../shared/conquistas";
import { notifyOwner } from "./_core/notification";

interface EstatisticasCorretor {
  corretorId: number;
  corretorNome: string;
  ligacoes: number;
  whatsapp: number;
  agendamentos: number;
  visitas: number;
  documentacoes: number;
  vendas: number;
  vgvTotal: number;
  diasAtivos: number;
  streakAtual: number;
  leadsRecebidos: number;
  fotoUrl: string | null;
}

// Função para calcular estatísticas de um corretor
async function calcularEstatisticasCorretor(corretorId: number): Promise<EstatisticasCorretor | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Buscar corretor
  const corretorResult = await db.select().from(users).where(eq(users.id, corretorId)).limit(1);
  const corretor = corretorResult[0];
  
  if (!corretor) return null;

  // Contar atividades totais
  const atividadesResult = await db
    .select({
      ligacoes: sql<number>`COALESCE(SUM(${atividadesDiarias.ligacoesRealizadas}), 0)`,
      whatsapp: sql<number>`COALESCE(SUM(${atividadesDiarias.whatsappEnviados}), 0)`,
      agendamentos: sql<number>`COALESCE(SUM(${atividadesDiarias.agendamentosConfirmados}), 0)`,
      visitas: sql<number>`COALESCE(SUM(${atividadesDiarias.visitasRealizadas}), 0)`,
      documentacoes: sql<number>`COALESCE(SUM(${atividadesDiarias.analiseCreditoEnviadas}), 0)`,
    })
    .from(atividadesDiarias)
    .where(eq(atividadesDiarias.corretorId, corretorId));

  // Contar vendas (leads com status "Contrato Fechado")
  const vendasResult = await db
    .select({ count: count() })
    .from(leads)
    .where(and(
      eq(leads.corretorId, corretorId),
      eq(leads.status, "Contrato Fechado")
    ));

  // Calcular VGV total (usando valor do projeto associado ao lead)
  // Por enquanto, retorna 0 pois leads não têm campo valorImovel
  const vgvTotal = 0;

  // Contar leads recebidos
  const leadsResult = await db
    .select({ count: count() })
    .from(leads)
    .where(eq(leads.corretorId, corretorId));

  // Calcular dias ativos (dias com pelo menos uma atividade)
  const diasAtivosResult = await db
    .select({ count: sql<number>`COUNT(DISTINCT DATE(${atividadesDiarias.data}))` })
    .from(atividadesDiarias)
    .where(eq(atividadesDiarias.corretorId, corretorId));

  // Calcular streak atual (dias consecutivos com atividade)
  const streakAtual = await calcularStreakAtual(corretorId);

  return {
    corretorId,
    corretorNome: corretor.name || "Corretor",
    ligacoes: Number(atividadesResult[0]?.ligacoes || 0),
    whatsapp: Number(atividadesResult[0]?.whatsapp || 0),
    agendamentos: Number(atividadesResult[0]?.agendamentos || 0),
    visitas: Number(atividadesResult[0]?.visitas || 0),
    documentacoes: Number(atividadesResult[0]?.documentacoes || 0),
    vendas: Number(vendasResult[0]?.count || 0),
    vgvTotal: vgvTotal,
    diasAtivos: Number(diasAtivosResult[0]?.count || 0),
    streakAtual,
    leadsRecebidos: Number(leadsResult[0]?.count || 0),
    fotoUrl: corretor.fotoUrl
  };
}

// Função para calcular streak atual de dias consecutivos
async function calcularStreakAtual(corretorId: number): Promise<number> {
  const db = await getDb();
  
  // Buscar datas de atividades ordenadas
  const atividades = await db
    .select({ data: atividadesDiarias.data })
    .from(atividadesDiarias)
    .where(eq(atividadesDiarias.corretorId, corretorId))
    .orderBy(sql`${atividadesDiarias.data} DESC`);

  if (atividades.length === 0) return 0;

  let streak = 1;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  const ultimaAtividade = new Date(atividades[0].data);
  ultimaAtividade.setHours(0, 0, 0, 0);
  
  // Se a última atividade não foi hoje ou ontem, streak é 0
  const diffDias = Math.floor((hoje.getTime() - ultimaAtividade.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDias > 1) return 0;

  // Contar dias consecutivos
  for (let i = 1; i < atividades.length; i++) {
    const dataAtual = new Date(atividades[i - 1].data);
    const dataAnterior = new Date(atividades[i].data);
    dataAtual.setHours(0, 0, 0, 0);
    dataAnterior.setHours(0, 0, 0, 0);
    
    const diff = Math.floor((dataAtual.getTime() - dataAnterior.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// Função para verificar se uma conquista foi atingida
function verificarConquistaAtingida(conquista: Conquista, stats: EstatisticasCorretor): boolean {
  switch (conquista.metaTipo) {
    case 'ligacoes':
      return stats.ligacoes >= conquista.metaValor;
    case 'whatsapp':
      return stats.whatsapp >= conquista.metaValor;
    case 'agendamentos':
      return stats.agendamentos >= conquista.metaValor;
    case 'visitas':
      return stats.visitas >= conquista.metaValor;
    case 'documentacoes':
      return stats.documentacoes >= conquista.metaValor;
    case 'vendas':
      return stats.vendas >= conquista.metaValor;
    case 'vgv':
      return stats.vgvTotal >= conquista.metaValor;
    case 'dias':
      return stats.diasAtivos >= conquista.metaValor;
    case 'streak':
      return stats.streakAtual >= conquista.metaValor;
    case 'especial':
      // Conquistas especiais são verificadas individualmente
      return verificarConquistaEspecial(conquista, stats);
    default:
      return false;
  }
}

// Função para verificar conquistas especiais
function verificarConquistaEspecial(conquista: Conquista, stats: EstatisticasCorretor): boolean {
  switch (conquista.id) {
    case 1: // Primeiro Lead
      return stats.leadsRecebidos >= 1;
    case 9: // Foto de Perfil
      return stats.fotoUrl !== null && stats.fotoUrl !== "";
    default:
      return false;
  }
}

// Função para calcular progresso de uma conquista
function calcularProgresso(conquista: Conquista, stats: EstatisticasCorretor): number {
  let atual = 0;
  
  switch (conquista.metaTipo) {
    case 'ligacoes':
      atual = stats.ligacoes;
      break;
    case 'whatsapp':
      atual = stats.whatsapp;
      break;
    case 'agendamentos':
      atual = stats.agendamentos;
      break;
    case 'visitas':
      atual = stats.visitas;
      break;
    case 'documentacoes':
      atual = stats.documentacoes;
      break;
    case 'vendas':
      atual = stats.vendas;
      break;
    case 'vgv':
      atual = stats.vgvTotal;
      break;
    case 'dias':
      atual = stats.diasAtivos;
      break;
    case 'streak':
      atual = stats.streakAtual;
      break;
    case 'especial':
      if (conquista.id === 1) atual = stats.leadsRecebidos;
      else if (conquista.id === 9) atual = stats.fotoUrl ? 1 : 0;
      break;
  }
  
  return Math.min((atual / conquista.metaValor) * 100, 100);
}

// Função principal para verificar conquistas de um corretor
export async function verificarConquistasCorretor(corretorId: number): Promise<{
  novasConquistas: Conquista[];
  progressos: { conquistaId: number; progresso: number; atual: number; meta: number }[];
}> {
  const db = await getDb();
  if (!db) {
    return { novasConquistas: [], progressos: [] };
  }
  
  // Calcular estatísticas do corretor
  const stats = await calcularEstatisticasCorretor(corretorId);
  if (!stats) {
    return { novasConquistas: [], progressos: [] };
  }

  // Buscar conquistas já desbloqueadas
  const conquistasDesbloqueadas = await db.select().from(conquistas).where(eq(conquistas.corretorId, corretorId));
  const idsDesbloqueadas = new Set(conquistasDesbloqueadas.map(c => c.tipoConquistaId));

  const novasConquistas: Conquista[] = [];
  const progressos: { conquistaId: number; progresso: number }[] = [];

  // Verificar cada conquista
  for (const conquista of CONQUISTAS) {
    // Calcular progresso
    const progresso = calcularProgresso(conquista, stats);
    progressos.push({ conquistaId: conquista.id, progresso });

    // Se já foi desbloqueada, pular
    if (idsDesbloqueadas.has(conquista.id)) continue;

    // Verificar se foi atingida
    if (verificarConquistaAtingida(conquista, stats)) {
      // Registrar conquista no banco
      await db.insert(conquistas).values({
        corretorId,
        tipoConquistaId: conquista.id,
        valor: conquista.pontos,
        observacao: conquista.nome
      });

      novasConquistas.push(conquista);
    }
  }

  return { novasConquistas, progressos };
}

// Função para verificar conquistas de todos os corretores (versão batch otimizada)
export async function verificarConquistasTodosCorretores(): Promise<{
  corretorId: number;
  corretorNome: string;
  novasConquistas: Conquista[];
}[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }
  
  // BATCH QUERY 1: Buscar todos os corretores ativos
  const corretores = await db.select({
    id: users.id,
    name: users.name,
    fotoUrl: users.fotoUrl,
  }).from(users).where(
    sql`${users.role} IN ('corretor', 'user', 'gestor')`
  );

  if (corretores.length === 0) return [];

  const corretorIds = corretores.map(c => c.id);

  // BATCH QUERY 2: Atividades agregadas de todos os corretores de uma vez
  const atividadesBatch = await db.select({
    corretorId: atividadesDiarias.corretorId,
    ligacoes: sql<number>`COALESCE(SUM(${atividadesDiarias.ligacoesRealizadas}), 0)`,
    whatsapp: sql<number>`COALESCE(SUM(${atividadesDiarias.whatsappEnviados}), 0)`,
    agendamentos: sql<number>`COALESCE(SUM(${atividadesDiarias.agendamentosConfirmados}), 0)`,
    visitas: sql<number>`COALESCE(SUM(${atividadesDiarias.visitasRealizadas}), 0)`,
    documentacoes: sql<number>`COALESCE(SUM(${atividadesDiarias.analiseCreditoEnviadas}), 0)`,
    diasAtivos: sql<number>`COUNT(DISTINCT DATE(${atividadesDiarias.data}))`,
  }).from(atividadesDiarias)
    .where(inArray(atividadesDiarias.corretorId, corretorIds))
    .groupBy(atividadesDiarias.corretorId);
  const atividadesMap = new Map(atividadesBatch.map(a => [a.corretorId, a]));

  // BATCH QUERY 3: Vendas (leads com status Contrato Fechado) por corretor
  const vendasBatch = await db.select({
    corretorId: leads.corretorId,
    count: sql<number>`COUNT(*)`,
  }).from(leads)
    .where(and(
      inArray(leads.corretorId, corretorIds),
      eq(leads.status, "Contrato Fechado")
    ))
    .groupBy(leads.corretorId);
  const vendasMap = new Map(vendasBatch.map(v => [v.corretorId, Number(v.count)]));

  // BATCH QUERY 4: Total de leads recebidos por corretor
  const leadsBatch = await db.select({
    corretorId: leads.corretorId,
    count: sql<number>`COUNT(*)`,
  }).from(leads)
    .where(inArray(leads.corretorId, corretorIds))
    .groupBy(leads.corretorId);
  const leadsMap = new Map(leadsBatch.map(l => [l.corretorId, Number(l.count)]));

  // BATCH QUERY 5: Conquistas já desbloqueadas de todos os corretores
  const conquistasDesbloqueadas = await db.select({
    corretorId: conquistas.corretorId,
    tipoConquistaId: conquistas.tipoConquistaId,
  }).from(conquistas)
    .where(inArray(conquistas.corretorId, corretorIds));
  // Map: corretorId -> Set<tipoConquistaId>
  const conquistasMap = new Map<number, Set<number>>();
  for (const c of conquistasDesbloqueadas) {
    if (!conquistasMap.has(c.corretorId)) conquistasMap.set(c.corretorId, new Set());
    conquistasMap.get(c.corretorId)!.add(c.tipoConquistaId);
  }

  // BATCH QUERY 6: Última data de atividade por corretor (para streak)
  const ultimasAtividades = await db.select({
    corretorId: atividadesDiarias.corretorId,
    ultimaData: sql<string>`MAX(DATE(${atividadesDiarias.data}))`,
  }).from(atividadesDiarias)
    .where(inArray(atividadesDiarias.corretorId, corretorIds))
    .groupBy(atividadesDiarias.corretorId);
  const ultimaAtividadeMap = new Map(ultimasAtividades.map(u => [u.corretorId, u.ultimaData]));

  // Processar cada corretor com os dados já carregados (sem queries adicionais)
  const resultados: {
    corretorId: number;
    corretorNome: string;
    novasConquistas: Conquista[];
  }[] = [];

  // Coletar todos os inserts necessários para batch insert
  const novosRegistros: { corretorId: number; tipoConquistaId: number; valor: number; observacao: string }[] = [];

  for (const corretor of corretores) {
    const ativ = atividadesMap.get(corretor.id);
    const idsDesbloqueadas = conquistasMap.get(corretor.id) || new Set<number>();
    const ultimaData = ultimaAtividadeMap.get(corretor.id);

    // Calcular streak simples (se teve atividade hoje ou ontem = 1, senão 0)
    let streakAtual = 0;
    if (ultimaData) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const ultima = new Date(ultimaData);
      ultima.setHours(0, 0, 0, 0);
      const diffDias = Math.floor((hoje.getTime() - ultima.getTime()) / (1000 * 60 * 60 * 24));
      streakAtual = diffDias <= 1 ? 1 : 0;
    }

    const stats: EstatisticasCorretor = {
      corretorId: corretor.id,
      corretorNome: corretor.name || 'Corretor',
      ligacoes: Number(ativ?.ligacoes || 0),
      whatsapp: Number(ativ?.whatsapp || 0),
      agendamentos: Number(ativ?.agendamentos || 0),
      visitas: Number(ativ?.visitas || 0),
      documentacoes: Number(ativ?.documentacoes || 0),
      vendas: vendasMap.get(corretor.id) || 0,
      vgvTotal: 0,
      diasAtivos: Number(ativ?.diasAtivos || 0),
      streakAtual,
      leadsRecebidos: leadsMap.get(corretor.id) || 0,
      fotoUrl: corretor.fotoUrl || null,
    };

    const novasConquistas: Conquista[] = [];
    for (const conquista of CONQUISTAS) {
      if (idsDesbloqueadas.has(conquista.id)) continue;
      if (verificarConquistaAtingida(conquista, stats)) {
        novasConquistas.push(conquista);
        novosRegistros.push({
          corretorId: corretor.id,
          tipoConquistaId: conquista.id,
          valor: conquista.pontos,
          observacao: conquista.nome,
        });
      }
    }

    if (novasConquistas.length > 0) {
      resultados.push({
        corretorId: corretor.id,
        corretorNome: corretor.name || 'Corretor',
        novasConquistas,
      });
      const conquistasNomes = novasConquistas.map(c => c.nome).join(', ');
      console.log(`[Conquistas] ${corretor.name} desbloqueou: ${conquistasNomes}`);
    }
  }

  // BATCH INSERT: Inserir todas as novas conquistas de uma vez
  if (novosRegistros.length > 0) {
    await db.insert(conquistas).values(novosRegistros).onDuplicateKeyUpdate({
      set: { observacao: sql`VALUES(${conquistas.observacao})` }
    });
  }

  return resultados;
}

// Job de verificação automática (executado periodicamente)
export async function jobVerificacaoConquistas(): Promise<void> {
  console.log("[Conquistas Job] Iniciando verificação automática de conquistas...");
  
  try {
    const resultados = await verificarConquistasTodosCorretores();
    
    const totalNovas = resultados.reduce((acc, r) => acc + r.novasConquistas.length, 0);
    console.log(`[Conquistas Job] Verificação concluída: ${totalNovas} novas conquistas desbloqueadas`);

    // Se houver novas conquistas, notificar o gestor
    if (totalNovas > 0) {
      const detalhes = resultados
        .filter(r => r.novasConquistas.length > 0)
        .map(r => `${r.corretorNome}: ${r.novasConquistas.map(c => c.nome).join(", ")}`)
        .join("\n");

      await notifyOwner({
        title: `🏆 ${totalNovas} Nova(s) Conquista(s) Desbloqueada(s)!`,
        content: `Os seguintes corretores desbloquearam conquistas:\n\n${detalhes}`
      });
    }
  } catch (error) {
    console.error("[Conquistas Job] Erro na verificação:", error);
  }
}

// Iniciar job de verificação periódica (a cada 5 minutos)
let conquistasInterval: NodeJS.Timeout | null = null;

export function iniciarJobConquistas(): void {
  if (conquistasInterval) {
    clearInterval(conquistasInterval);
  }

  // Executar imediatamente na primeira vez
  jobVerificacaoConquistas();

  // Executar a cada 4 horas (reduzido para diminuir carga no banco)
  conquistasInterval = setInterval(() => {
    jobVerificacaoConquistas();
  }, 4 * 60 * 60 * 1000); // 4 horas

  console.log("[Conquistas Job] Job de verificação automática iniciado (intervalo: 4 horas)");
}

export function pararJobConquistas(): void {
  if (conquistasInterval) {
    clearInterval(conquistasInterval);
    conquistasInterval = null;
    console.log("[Conquistas Job] Job de verificação automática parado");
  }
}
