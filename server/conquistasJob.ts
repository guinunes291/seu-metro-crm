import { getDb } from "./db";
import * as schema from "../drizzle/schema";
import { users, conquistas, atividadesDiarias, leads } from "../drizzle/schema";
import { eq, and, gte, sql, count } from "drizzle-orm";
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
      ligacoes: sql<number>`COALESCE(SUM(ligacoesRealizadas), 0)`,
      whatsapp: sql<number>`COALESCE(SUM(whatsappEnviados), 0)`,
      agendamentos: sql<number>`COALESCE(SUM(agendamentosConfirmados), 0)`,
      visitas: sql<number>`COALESCE(SUM(visitasRealizadas), 0)`,
      documentacoes: sql<number>`COALESCE(SUM(documentacoesRecolhidas), 0)`,
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

  // Calcular VGV total
  const vgvResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${leads.valorImovel}), 0)` })
    .from(leads)
    .where(and(
      eq(leads.corretorId, corretorId),
      eq(leads.status, "Contrato Fechado")
    ));

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
    vgvTotal: Number(vgvResult[0]?.total || 0),
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
  const idsDesbloqueadas = new Set(conquistasDesbloqueadas.map(c => c.conquistaId));

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
        conquistaId: conquista.id,
        dataConquista: new Date(),
        pontos: conquista.pontos
      });

      novasConquistas.push(conquista);
    }
  }

  return { novasConquistas, progressos };
}

// Função para verificar conquistas de todos os corretores
export async function verificarConquistasTodosCorretores(): Promise<{
  corretorId: number;
  corretorNome: string;
  novasConquistas: Conquista[];
}[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }
  
  // Buscar todos os corretores ativos (role = 'corretor' ou 'user')
  const corretores = await db.select().from(users).where(
    sql`${users.role} IN ('corretor', 'user', 'gestor')`
  );

  const resultados: {
    corretorId: number;
    corretorNome: string;
    novasConquistas: Conquista[];
  }[] = [];

  for (const corretor of corretores) {
    const { novasConquistas } = await verificarConquistasCorretor(corretor.id);
    
    if (novasConquistas.length > 0) {
      resultados.push({
        corretorId: corretor.id,
        corretorNome: corretor.name || "Corretor",
        novasConquistas
      });

      // Notificar sobre novas conquistas
      const conquistasNomes = novasConquistas.map(c => c.nome).join(", ");
      console.log(`[Conquistas] ${corretor.name} desbloqueou: ${conquistasNomes}`);
    }
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

  // Executar a cada 5 minutos
  conquistasInterval = setInterval(() => {
    jobVerificacaoConquistas();
  }, 5 * 60 * 1000); // 5 minutos

  console.log("[Conquistas Job] Job de verificação automática iniciado (intervalo: 5 minutos)");
}

export function pararJobConquistas(): void {
  if (conquistasInterval) {
    clearInterval(conquistasInterval);
    conquistasInterval = null;
    console.log("[Conquistas Job] Job de verificação automática parado");
  }
}
