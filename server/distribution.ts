import { getDb, notifyLeadDistribuido, countLeadsRecebidosHoje } from "./db";
import { users, leads, conversionStats, distributionLog, leadEstoque } from "../drizzle/schema";
import { eq, and, sql, isNull } from "drizzle-orm";

// Configurações de distribuição
// Regra: corretor elegível quando ≥ 90% dos seus leads têm status != aguardando_atendimento
// Ou seja: máximo 10% dos leads podem estar aguardando
const PERCENTUAL_MINIMO_TRABALHADOS = 0.9; // 90% dos leads devem estar fora de aguardando
const LEADS_POR_RODADA = 30; // Leads enviados por rodada para cada corretor elegível
// Aliases para compatibilidade com código legado
const MINIMO_LEADS_GARANTIDO = LEADS_POR_RODADA;
const MAXIMO_LEADS_AGUARDANDO = 20;
const LIMITE_AGUARDANDO = 20;
const LEADS_POR_RODADA_ESTOQUE = LEADS_POR_RODADA;

interface CorretorStatus {
  id: number;
  nome: string;
  email: string;
  totalLeads: number;
  leadsTrabalhados: number;
  taxaTrabalho: number;
  aguardandoLeads: number;  // leads em aguardando_atendimento (métrica real de elegibilidade)
  elegivel: boolean;
  motivoBloqueio: string | null; // razão de não ser elegível, ou null se elegível
  status: string;
}

/**
 * Helper: retorna o início do dia atual no fuso de São Paulo (UTC-3) como Date UTC
 */
function getInicioDiaUTC(): Date {
  const agora = new Date();
  const offsetSP = -3 * 60; // UTC-3 em minutos
  const agoraSP = new Date(agora.getTime() + (offsetSP - agora.getTimezoneOffset()) * 60 * 1000);
  const inicioDiaSP = new Date(agoraSP);
  inicioDiaSP.setHours(0, 0, 0, 0);
  return new Date(inicioDiaSP.getTime() - offsetSP * 60 * 1000);
}

/**
 * Verifica se um corretor está elegível para receber novos leads
 * Regra: status "presente" + 90%+ dos leads com status != aguardando_atendimento
 * (ou seja, no máximo 10% dos leads podem estar aguardando)
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
  // Contar total de leads ativos (não na lixeira) e quantos estão aguardando
  const [{ total, aguardando }] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      aguardando: sql<number>`SUM(CASE WHEN ${leads.status} = 'aguardando_atendimento' THEN 1 ELSE 0 END)`,
    })
    .from(leads)
    .where(
      and(
        eq(leads.corretorId, corretorId),
        eq(leads.naLixeira, false)
      )
    );
  const totalNum = Number(total) || 0;
  const aguardandoNum = Number(aguardando) || 0;
  // Se não tem leads, é elegível (receberá o primeiro lote)
  if (totalNum === 0) return true;
  // Elegível se pelo menos 90% dos leads estão com status != aguardando_atendimento
  const percentualTrabalhados = (totalNum - aguardandoNum) / totalNum;
  return percentualTrabalhados >= PERCENTUAL_MINIMO_TRABALHADOS;
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

  // Usar leads ATIVOS (aguardando + em_atendimento) para o status real
  const leadsAtivos = await db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.corretorId, corretorId),
        eq(leads.naLixeira, false),
        sql`${leads.status} IN ('aguardando_atendimento', 'em_atendimento')`
      )
    );

  const totalLeads = leadsAtivos.length;
  const leadsTrabalhados = leadsAtivos.filter(
    (lead) => lead.status === "em_atendimento"
  ).length;
  const aguardandoLeads = leadsAtivos.filter(
    (lead) => lead.status === "aguardando_atendimento"
  ).length;

  const taxaTrabalho = totalLeads > 0 ? leadsTrabalhados / totalLeads : 0;
  const elegivel = await isCorretorElegivel(corretorId);

  // Calcular motivo do bloqueio para exibição na UI
  let motivoBloqueio: string | null = null;
  if (!elegivel) {
    if (corretor[0].status !== "presente") {
      motivoBloqueio = "Ausente";
    } else {
      const pct = totalLeads > 0 ? Math.round(((totalLeads - aguardandoLeads) / totalLeads) * 100) : 0;
      motivoBloqueio = `${pct}% trabalhados (mín. 90% — ${aguardandoLeads} aguardando de ${totalLeads})`;
    }
  }

  return {
    id: corretor[0].id,
    nome: corretor[0].name || "",
    email: corretor[0].email || "",
    totalLeads,
    leadsTrabalhados,
    taxaTrabalho,
    aguardandoLeads,
    elegivel,
    motivoBloqueio,
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
 * Obtém corretores presentes para redistribuição urgente de leads webhook
 * Critério: apenas status "presente" — sem limite de aguardando_atendimento
 * Ordenados por menor número de leads ativos (distribuição mais justa)
 */
export async function getCorretoresParaRedistribuicao(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  const todosCorretores = await db
    .select()
    .from(users)
    .where(and(eq(users.role, "corretor"), eq(users.status, "presente")));

  if (todosCorretores.length === 0) return [];

  // Calcular carga atual de cada corretor (leads ativos)
  const corretoresComCarga: Array<{ id: number; carga: number }> = [];

  for (const corretor of todosCorretores) {
    const [{ total }] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(leads)
      .where(
        and(
          eq(leads.corretorId, corretor.id),
          eq(leads.naLixeira, false),
          sql`${leads.status} IN ('aguardando_atendimento', 'em_atendimento')`
        )
      );
    corretoresComCarga.push({ id: corretor.id, carga: Number(total) });
  }

  // Ordenar por menor carga (distribuição mais justa)
  corretoresComCarga.sort((a, b) => a.carga - b.carga);

  return corretoresComCarga.map((c) => c.id);
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

  // Buscar gestor ID fora da transação (não muda)
  const gestores = await db
    .select()
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);

  if (!gestores.length) {
    return { success: false, message: "Gestor não encontrado" };
  }

  const gestorId = gestores[0].id;

  // Usar transação com SELECT FOR UPDATE para evitar race condition
  try {
    const result = await db.transaction(async (tx) => {
      // SELECT FOR UPDATE: lock pessimista no lead
      const leadLocked = await tx.execute(
        sql`SELECT * FROM ${leads} WHERE id = ${leadId} FOR UPDATE`
      );

      const leadLockedRows = (leadLocked as any)[0] as any[];
      if (!leadLockedRows || leadLockedRows.length === 0) {
        throw new Error("Lead não encontrado");
      }

      const leadData = leadLockedRows[0] as any;

      // Verificar se o lead ainda pode ser distribuído (sem corretor OU com corretor gestor)
      if (leadData.corretorId !== null && leadData.corretorId !== gestorId) {
        throw new Error("Lead já foi distribuído para um corretor");
      }

      // Verificar se o status permite distribuição
      if (leadData.status !== 'novo' && leadData.status !== 'aguardando_atendimento') {
        throw new Error(`Lead com status '${leadData.status}' não pode ser redistribuído automaticamente`);
      }

      // Buscar corretores elegíveis (fora da transação para não travar)
      const corretoresElegiveis = await getCorretoresElegiveis(
        leadData.projectId || undefined,
        leadData.origem || undefined
      );

      // Se não houver corretores disponíveis, adicionar ao estoque
      if (corretoresElegiveis.length === 0) {
        await tx.insert(leadEstoque).values({
          leadId: leadId,
          tipoFila: "normal",
          motivoEstoque: "Nenhum corretor elegível disponível",
          tentativasDistribuicao: 0,
        });
        
        throw new Error("Nenhum corretor disponível. Lead adicionado ao estoque.");
      }

      // Selecionar o melhor corretor
      const melhorCorretor = corretoresElegiveis[0];

      // Atualizar lead (dentro da transação)
      await tx
        .update(leads)
        .set({
          corretorId: melhorCorretor,
          dataDistribuicao: new Date(),
          status: "aguardando_atendimento",
          timerAtivo: true,
          timestampRecebimento: new Date(),
        })
        .where(eq(leads.id, leadId));

      // Registrar no log de distribuição
      await tx.insert(distributionLog).values({
        leadId: leadId,
        corretorId: melhorCorretor,
        tipo: "automatica",
      });

      return { corretorId: melhorCorretor, nome: leadData.nome };
    });

    // Enviar notificação fora da transação (não crítico)
    try {
      await notifyLeadDistribuido(result.corretorId, leadId, result.nome);
    } catch (error) {
      console.error("Erro ao enviar notificação:", error);
    }

    return { success: true, corretorId: result.corretorId };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
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
 * - Distribui leads com corretorId = null (sem corretor) OU com corretorId de um admin/gestor
 * - Apenas para corretores presentes
 * - Apenas para corretores com taxa de trabalho >= 90% ou menos de 40 leads
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

  // Buscar IDs dos gestores/admins
  const gestores = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"));

  const gestorIds = gestores.map((g) => g.id);

  // Buscar leads sem corretor OU com corretor gestor (aguardando distribuição)
  // Status: aguardando_atendimento ou sem status definido
  let leadsParaDistribuir;

  // Limite: buscar apenas o suficiente para distribuir 30 leads por corretor elegível
  const corretoresElegiveis = await getCorretoresElegiveisParaDistribuicao();
  if (corretoresElegiveis.length === 0) {
    console.log("[Distribuição] Nenhum corretor elegível disponivel");
    return { success: 0, failed: 0, details: [] };
  }
  const limiteBusca = corretoresElegiveis.length * LEADS_POR_RODADA;

  if (gestorIds.length > 0) {
    leadsParaDistribuir = await db
      .select()
      .from(leads)
      .where(
        sql`(${leads.corretorId} IS NULL OR ${leads.corretorId} IN (${sql.join(gestorIds.map(id => sql`${id}`), sql`, `)}))
            AND ${leads.status} IN ('novo', 'aguardando_atendimento')
            AND ${leads.naLixeira} = 0
            AND ${leads.transferidoManualmentePorAdmin} = 0`
      )
      .orderBy(leads.criadoEm)
      .limit(limiteBusca);
  } else {
    leadsParaDistribuir = await db
      .select()
      .from(leads)
      .where(
        and(
          isNull(leads.corretorId),
          sql`${leads.status} IN ('novo', 'aguardando_atendimento')`,
          eq(leads.naLixeira, false),
          eq(leads.transferidoManualmentePorAdmin, false)
        )
      )
      .orderBy(leads.criadoEm)
      .limit(limiteBusca);
  }

  if (leadsParaDistribuir.length === 0) {
    console.log("[Distribuição] Nenhum lead aguardando distribuição");
    return { success: 0, failed: 0, details: [] };
  }

  console.log(`[Distribuição] ${leadsParaDistribuir.length} leads aguardando distribuição`);

  const leadIds = leadsParaDistribuir.map((lead) => lead.id);

  return await distribuirLeadsEmLoteParaElegiveis(leadIds);
}

/**
 * Distribui leads em lote apenas para corretores elegíveis
 * (presentes e com taxa de trabalho >= 90% ou menos de 40 leads ativos)
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

  // Buscar corretores elegíveis (presentes e com taxa de trabalho >= 90% ou menos de 40 leads ativos)
  const corretoresElegiveis = await getCorretoresElegiveisParaDistribuicao();

  if (corretoresElegiveis.length === 0) {
    // Nenhum corretor elegível, retornar falha para todos
    for (const leadId of leadIds) {
      results.details.push({
        leadId,
        success: false,
        message: "Nenhum corretor elegível disponível (presente e com taxa de trabalho >= 90% ou menos de 40 leads ativos)",
      });
      results.failed++;
    }
    return results;
  }

  // Distribuir leads em round-robin entre corretores elegíveis
  // Limite: LEADS_POR_RODADA (30) leads por corretor por rodada
  const leadsRecebidosPorCorretor = new Map<number, number>();
  for (const id of corretoresElegiveis) leadsRecebidosPorCorretor.set(id, 0);
  let corretorIndex = 0;

  for (const leadId of leadIds) {
    // Avançar para o próximo corretor que ainda não atingiu o limite
    let tentativas = 0;
    while (
      (leadsRecebidosPorCorretor.get(corretoresElegiveis[corretorIndex % corretoresElegiveis.length]) ?? 0) >= LEADS_POR_RODADA &&
      tentativas < corretoresElegiveis.length
    ) {
      corretorIndex++;
      tentativas++;
    }
    // Se todos atingiram o limite desta rodada, parar
    if (tentativas >= corretoresElegiveis.length) break;

    const corretorId = corretoresElegiveis[corretorIndex % corretoresElegiveis.length];
    corretorIndex++;

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
          timerAtivo: true,
          timestampRecebimento: new Date(),
        })
        .where(eq(leads.id, leadId));

      // Registrar no log de distribuição
      await db.insert(distributionLog).values({
        leadId,
        corretorId,
        tipo: "automatica",
        motivo: "Distribuição automática em lote",
      });

      // Marcar entrada no estoque como distribuída (evita redisribuição duplicada pelo job de estoque)
      await db
        .update(leadEstoque)
        .set({ status: "distribuido", distribuidoEm: new Date(), distribuidoParaCorretorId: corretorId })
        .where(and(eq(leadEstoque.leadId, leadId), eq(leadEstoque.status, "aguardando")));

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
      leadsRecebidosPorCorretor.set(corretorId, (leadsRecebidosPorCorretor.get(corretorId) ?? 0) + 1);
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
 * - Não atingiu o limite diário
 * - Menos de 40 leads ativos (carga inicial) OU menos de MAXIMO_LEADS_AGUARDANDO aguardando
 * Otimizado: usa uma única query SQL com agregação em vez de N+1 queries
 */
async function getCorretoresElegiveisParaDistribuicao(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  // Calcular início do dia em SP (UTC-3) para limite diário
  const agora = new Date();
  const offsetSP = -3 * 60; // UTC-3 em minutos
  const agoraSP = new Date(agora.getTime() + (offsetSP - agora.getTimezoneOffset()) * 60 * 1000);
  const inicioDiaSP = new Date(agoraSP);
  inicioDiaSP.setHours(0, 0, 0, 0);
  const inicioDiaUTC = new Date(inicioDiaSP.getTime() - offsetSP * 60 * 1000);
  const fimDiaSP = new Date(agoraSP);
  fimDiaSP.setHours(23, 59, 59, 999);
  const fimDiaUTC = new Date(fimDiaSP.getTime() - offsetSP * 60 * 1000);

  // Query otimizada: conta total de leads e aguardando por corretor presente
  const resultado = await db.execute(sql`
    SELECT 
      u.id,
      COALESCE(agg.total, 0) as total,
      COALESCE(agg.aguardando, 0) as aguardando
    FROM users u
    LEFT JOIN (
      SELECT corretorId,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'aguardando_atendimento' THEN 1 ELSE 0 END) as aguardando
      FROM leads
      WHERE naLixeira = 0
      GROUP BY corretorId
    ) agg ON agg.corretorId = u.id
    WHERE u.role = 'corretor' AND u.status = 'presente'
  `);

  const corretoresElegiveis: number[] = [];
  const rows = (resultado as any)[0] as any[];
  if (!rows || !Array.isArray(rows)) return [];

  for (const row of rows) {
    const corretorId = Number(row.id);
    const total = Number(row.total) || 0;
    const aguardando = Number(row.aguardando) || 0;

    // Sem leads: elegível (receberá primeiro lote)
    if (total === 0) {
      corretoresElegiveis.push(corretorId);
      continue;
    }

    // Elegível se 90%+ dos leads têm status != aguardando_atendimento
    const percentualTrabalhados = (total - aguardando) / total;
    if (percentualTrabalhados >= PERCENTUAL_MINIMO_TRABALHADOS) {
      corretoresElegiveis.push(corretorId);
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


/**
 * Distribui leads do estoque para corretores disponíveis
 * Cada rodada distribui LEADS_POR_RODADA_ESTOQUE leads para cada corretor elegível
 * Chamado automaticamente a cada 5 minutos
 */
export async function distribuirLeadsDoEstoque(): Promise<{
  distribuidos: number;
  erros: number;
  mensagens: string[];
}> {
  const db = await getDb();
  if (!db) {
    return { distribuidos: 0, erros: 1, mensagens: ["Database não disponível"] };
  }

  const mensagens: string[] = [];
  let distribuidos = 0;
  let erros = 0;

  // Buscar corretores elegíveis primeiro
  const corretoresElegiveis = await getCorretoresElegiveisParaDistribuicao();
  if (corretoresElegiveis.length === 0) {
    return { distribuidos: 0, erros: 0, mensagens: ["Nenhum corretor elegível disponível"] };
  }

  // Total de leads a buscar = 30 por corretor elegível
  const totalParaBuscar = corretoresElegiveis.length * LEADS_POR_RODADA;

  // Buscar leads aguardando no estoque (ordenar por mais antigo primeiro, sem limite artificial)
  const leadsEmEstoque = await db
    .select()
    .from(leadEstoque)
    .where(eq(leadEstoque.status, "aguardando"))
    .orderBy(leadEstoque.criadoEm)
    .limit(totalParaBuscar);

  if (leadsEmEstoque.length === 0) {
    return { distribuidos: 0, erros: 0, mensagens: ["Nenhum lead em estoque"] };
  }

  mensagens.push(`Processando ${leadsEmEstoque.length} leads do estoque para ${corretoresElegiveis.length} corretores elegíveis (${LEADS_POR_RODADA} leads/corretor)...`);

  // Rastrear quantos leads cada corretor recebeu nesta rodada
  const leadsRecebidosPorCorretor = new Map<number, number>();
  for (const id of corretoresElegiveis) leadsRecebidosPorCorretor.set(id, 0);

  let corretorIndex = 0;

  for (const estoqueItem of leadsEmEstoque) {
    try {
      // Avançar para o próximo corretor que ainda não atingiu o limite desta rodada
      let tentativas = 0;
      while (
        (leadsRecebidosPorCorretor.get(corretoresElegiveis[corretorIndex % corretoresElegiveis.length]) ?? 0) >= LEADS_POR_RODADA &&
        tentativas < corretoresElegiveis.length
      ) {
        corretorIndex++;
        tentativas++;
      }

      // Se todos atingiram o limite desta rodada, parar
      if (tentativas >= corretoresElegiveis.length) {
        mensagens.push(`Todos os ${corretoresElegiveis.length} corretores atingiram o limite de ${LEADS_POR_RODADA} leads nesta rodada`);
        break;
      }

      const melhorCorretor = corretoresElegiveis[corretorIndex % corretoresElegiveis.length];
      corretorIndex++;

      // Buscar informações do lead
      const lead = await db
        .select()
        .from(leads)
        .where(eq(leads.id, estoqueItem.leadId))
        .limit(1);

      if (!lead.length) {
        // Lead não encontrado — marcar como cancelado
        await db
          .update(leadEstoque)
          .set({ status: "cancelado" })
          .where(eq(leadEstoque.id, estoqueItem.id));
        erros++;
        continue;
      }

      const leadData = lead[0];

      // Atualizar lead
      await db
        .update(leads)
        .set({
          corretorId: melhorCorretor,
          dataDistribuicao: new Date(),
          status: "aguardando_atendimento",
          timerAtivo: true,
          timestampRecebimento: new Date(),
        })
        .where(eq(leads.id, estoqueItem.leadId));

      // Registrar no log de distribuição
      await db.insert(distributionLog).values({
        leadId: estoqueItem.leadId,
        corretorId: melhorCorretor,
        tipo: "automatica",
      });

      // Marcar como distribuído no estoque
      await db
        .update(leadEstoque)
        .set({
          status: "distribuido",
          distribuidoEm: new Date(),
          distribuidoParaCorretorId: melhorCorretor,
        })
        .where(eq(leadEstoque.id, estoqueItem.id));

      // Enviar notificação para o corretor
      try {
        await notifyLeadDistribuido(melhorCorretor, estoqueItem.leadId, leadData.nome);
      } catch (error) {
        console.error("Erro ao enviar notificação:", error);
      }

      leadsRecebidosPorCorretor.set(melhorCorretor, (leadsRecebidosPorCorretor.get(melhorCorretor) ?? 0) + 1);
      distribuidos++;

    } catch (error) {
      console.error(`Erro ao distribuir lead ${estoqueItem.leadId} do estoque:`, error);
      erros++;
    }
  }

  mensagens.push(`Rodada concluída: ${distribuidos} distribuídos, ${erros} erros`);
  return { distribuidos, erros, mensagens };
}

/**
 * Obtém estatísticas do estoque de leads
 */
export async function getEstatisticasEstoque(): Promise<{
  totalEmEstoque: number;
  porFila: { normal: number; foco: number };
  maisAntigo: Date | null;
  tentativasMedia: number;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalEmEstoque: 0,
      porFila: { normal: 0, foco: 0 },
      maisAntigo: null,
      tentativasMedia: 0,
    };
  }

  // Buscar todos os leads em estoque
  const leadsEmEstoque = await db
    .select()
    .from(leadEstoque)
    .where(eq(leadEstoque.status, "aguardando"));

  const totalEmEstoque = leadsEmEstoque.length;

  if (totalEmEstoque === 0) {
    return {
      totalEmEstoque: 0,
      porFila: { normal: 0, foco: 0 },
      maisAntigo: null,
      tentativasMedia: 0,
    };
  }

  // Contar por fila
  const porFila = {
    normal: leadsEmEstoque.filter((l) => l.tipoFila === "normal").length,
    foco: leadsEmEstoque.filter((l) => l.tipoFila === "foco").length,
  };

  // Encontrar o mais antigo
  const maisAntigo = leadsEmEstoque.reduce((oldest, current) => {
    return new Date(current.criadoEm) < new Date(oldest.criadoEm) ? current : oldest;
  }).criadoEm;

  // Calcular média de tentativas
  const tentativasMedia =
    leadsEmEstoque.reduce((sum, l) => sum + l.tentativasDistribuicao, 0) / totalEmEstoque;

  return {
    totalEmEstoque,
    porFila,
    maisAntigo,
    tentativasMedia: Math.round(tentativasMedia * 10) / 10,
  };
}

/**
 * Redistribui um lead que não foi trabalhado dentro do prazo (5 minutos)
 * para o próximo corretor disponível ou para o estoque
 */
export async function distribuirLeadParaProximoCorretor(
  leadId: number,
  origem: string
): Promise<{ sucesso: boolean; corretorId?: number; motivo?: string }> {
  const db = await getDb();
  if (!db) {
    return { sucesso: false, motivo: "Database não disponível" };
  }

  try {
    // Buscar lead
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));

    if (!lead) {
      return { sucesso: false, motivo: "Lead não encontrado" };
    }

    // Buscar corretores elegíveis
    const corretoresElegiveis = await getCorretoresElegiveis(
      lead.projectId || undefined,
      origem || undefined
    );

    if (corretoresElegiveis.length > 0) {
      // Selecionar próximo corretor (primeiro da lista)
      const proximoCorretor = corretoresElegiveis[0];

      // Atualizar lead com novo corretor e reativar timer
      await db
        .update(leads)
        .set({
          corretorId: proximoCorretor,
          timestampRecebimento: new Date(),
          timerAtivo: true,
        })
        .where(eq(leads.id, leadId));

      // Registrar no log de distribuição
      await db.insert(distributionLog).values({
        leadId: leadId,
        corretorId: proximoCorretor,
        tipo: "automatica",
        motivo: "Redistribuição por timeout de 5 minutos",
      });

      // Enviar notificação para o novo corretor
      try {
        await notifyLeadDistribuido(proximoCorretor, leadId, lead.nome);
      } catch (error) {
        console.error("Erro ao enviar notificação:", error);
      }

      return { sucesso: true, corretorId: proximoCorretor };
    } else {
      // Nenhum corretor disponível - enviar para estoque
      await db.insert(leadEstoque).values({
        leadId: lead.id,
        tipoFila: "normal",
        motivoEstoque: "Nenhum corretor disponível após timeout de 5 minutos",
        tentativasDistribuicao: 0,
        status: "aguardando",
      });

      return {
        sucesso: false,
        motivo: "Nenhum corretor disponível - lead enviado para estoque",
      };
    }
  } catch (error) {
    console.error("[Redistribuição] Erro:", error);
    return { sucesso: false, motivo: `Erro: ${error}` };
  }
}
