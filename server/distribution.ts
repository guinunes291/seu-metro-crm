import { getDb, notifyLeadDistribuido, countLeadsRecebidosHoje } from "./db";
import { users, leads, conversionStats, distributionLog, leadEstoque } from "../drizzle/schema";
import { eq, and, sql, isNull } from "drizzle-orm";

// Configurações de distribuição (baseado no AppScript)
const MINIMO_LEADS_GARANTIDO = 40; // Carga inicial mínima por corretor (primeiro recebimento)
const PERCENTUAL_CONCLUSAO_MINIMO = 0.6; // 60% dos leads ATIVOS trabalhados para receber mais (AppScript)
const LOTE_SIZE = 200; // Total de leads por rodada
const LEADS_POR_RODADA = 4; // Leads distribuídos por vez para cada corretor
const MAX_LEADS_ATIVOS = 99999; // Sem limite máximo de leads ativos por corretor

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
 * Regras:
 * 1. Status deve ser "presente"
 * 2. Deve ter menos de MAX_LEADS_ATIVOS leads ativos (aguardando_atendimento + em_atendimento)
 *    OU ter trabalhado pelo menos 90% dos seus leads ativos
 * 
 * IMPORTANTE: Usa leads ATIVOS (não histórico total) para não bloquear corretores
 * que acumularam leads antigos sem nunca os ter trabalhado.
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

  // Buscar apenas leads ATIVOS do corretor (não na lixeira)
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

  const totalAtivos = leadsAtivos.length;

  // Primeiro recebimento: se tem menos de 40 leads ativos, é elegível
  if (totalAtivos < MINIMO_LEADS_GARANTIDO) {
    return true;
  }

  // Já tem 40+ leads ativos: verificar se trabalhou 90% deles (em_atendimento)
  // Sem limite máximo — pode receber mais desde que esteja trabalhando
  const emAtendimento = leadsAtivos.filter(
    (lead) => lead.status === "em_atendimento"
  ).length;

  const taxaTrabalho = emAtendimento / totalAtivos;

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
 * - Apenas para corretores com taxa de trabalho >= 60% ou menos de 40 leads
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

  if (gestorIds.length > 0) {
    leadsParaDistribuir = await db
      .select()
      .from(leads)
      .where(
        sql`(${leads.corretorId} IS NULL OR ${leads.corretorId} IN (${sql.join(gestorIds.map(id => sql`${id}`), sql`, `)}))
            AND ${leads.status} IN ('novo', 'aguardando_atendimento')`
      )
      .limit(LOTE_SIZE);
  } else {
    leadsParaDistribuir = await db
      .select()
      .from(leads)
      .where(
        and(
          isNull(leads.corretorId),
          sql`${leads.status} IN ('novo', 'aguardando_atendimento')`
        )
      )
      .limit(LOTE_SIZE);
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
 * (presentes e com taxa de trabalho > 40%)
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

  // Buscar corretores elegíveis (presentes e com taxa de trabalho > 40%)
  const corretoresElegiveis = await getCorretoresElegiveisParaDistribuicao();

  if (corretoresElegiveis.length === 0) {
    // Nenhum corretor elegível, retornar falha para todos
    for (const leadId of leadIds) {
      results.details.push({
        leadId,
        success: false,
        message: "Nenhum corretor elegível disponível (presente e com taxa de trabalho > 40%)",
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
 * - Menos de 40 leads (carga inicial mínima) OU taxa de trabalho >= 60%
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

  // Query otimizada: usa leads ATIVOS (aguardando_atendimento + em_atendimento, naLixeira=0)
  // para não bloquear corretores com histórico acumulado de leads antigos
  const resultado = await db.execute(sql`
    SELECT 
      u.id,
      u.limiteDiarioLeads,
      COALESCE(ativos_agg.total_ativos, 0) as total_ativos,
      COALESCE(ativos_agg.em_atendimento, 0) as em_atendimento,
      COALESCE(dist_agg.leads_recebidos_hoje, 0) as leads_recebidos_hoje
    FROM users u
    LEFT JOIN (
      SELECT corretorId,
        COUNT(*) as total_ativos,
        SUM(CASE WHEN status = 'em_atendimento' THEN 1 ELSE 0 END) as em_atendimento
      FROM leads
      WHERE status IN ('aguardando_atendimento', 'em_atendimento') AND naLixeira = 0
      GROUP BY corretorId
    ) ativos_agg ON ativos_agg.corretorId = u.id
    LEFT JOIN (
      SELECT corretorId, COUNT(*) as leads_recebidos_hoje
      FROM distribution_log
      WHERE createdAt >= ${inicioDiaUTC} AND createdAt <= ${fimDiaUTC}
      GROUP BY corretorId
    ) dist_agg ON dist_agg.corretorId = u.id
    WHERE u.role = 'corretor' AND u.status = 'presente'
  `);

  const corretoresElegiveis: number[] = [];
  const rows = (resultado as any)[0] as any[];
  if (!rows || !Array.isArray(rows)) return [];

  for (const row of rows) {
    const corretorId = Number(row.id);
    const limiteDiario = Number(row.limiteDiarioLeads) || 50;
    const leadsRecebidosHoje = Number(row.leads_recebidos_hoje) || 0;
    const totalAtivos = Number(row.total_ativos) || 0;
    const emAtendimento = Number(row.em_atendimento) || 0;

    // Verificar limite diário
    if (leadsRecebidosHoje >= limiteDiario) {
      continue;
    }

    // Primeiro recebimento: menos de 40 leads ativos → elegível
    if (totalAtivos < MINIMO_LEADS_GARANTIDO) {
      corretoresElegiveis.push(corretorId);
      continue;
    }

    // Já tem 40+ leads ativos: verificar se trabalhou 90% deles
    // Sem limite máximo — pode receber mais desde que esteja trabalhando
    const taxaTrabalho = totalAtivos > 0 ? emAtendimento / totalAtivos : 0;
    if (taxaTrabalho >= PERCENTUAL_CONCLUSAO_MINIMO) {
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

  // Buscar leads aguardando no estoque (ordenar por mais antigo primeiro)
  const leadsEmEstoque = await db
    .select()
    .from(leadEstoque)
    .where(eq(leadEstoque.status, "aguardando"))
    .orderBy(leadEstoque.criadoEm)
    .limit(50); // Processar no máximo 50 por vez

  if (leadsEmEstoque.length === 0) {
    return { distribuidos: 0, erros: 0, mensagens: ["Nenhum lead em estoque"] };
  }

  mensagens.push(`Processando ${leadsEmEstoque.length} leads do estoque...`);

  for (const estoqueItem of leadsEmEstoque) {
    try {
      // Buscar informações do lead
      const lead = await db
        .select()
        .from(leads)
        .where(eq(leads.id, estoqueItem.leadId))
        .limit(1);

      if (!lead.length) {
        mensagens.push(`Lead ${estoqueItem.leadId} não encontrado`);
        
        // Marcar como cancelado
        await db
          .update(leadEstoque)
          .set({ status: "cancelado" })
          .where(eq(leadEstoque.id, estoqueItem.id));
        
        erros++;
        continue;
      }

      const leadData = lead[0];

      // Buscar corretores elegíveis
      const corretoresElegiveis = await getCorretoresElegiveis(
        leadData.projectId || undefined,
        leadData.origem || undefined
      );

      if (corretoresElegiveis.length === 0) {
        // Ainda não há corretores disponíveis, incrementar tentativas
        await db
          .update(leadEstoque)
          .set({
            tentativasDistribuicao: estoqueItem.tentativasDistribuicao + 1,
            ultimaTentativa: new Date(),
          })
          .where(eq(leadEstoque.id, estoqueItem.id));

        mensagens.push(`Lead ${estoqueItem.leadId}: Nenhum corretor disponível (tentativa ${estoqueItem.tentativasDistribuicao + 1})`);
        continue;
      }

      // Selecionar o melhor corretor
      const melhorCorretor = corretoresElegiveis[0];

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

      mensagens.push(`Lead ${estoqueItem.leadId} distribuído para corretor ${melhorCorretor}`);
      distribuidos++;

    } catch (error) {
      console.error(`Erro ao distribuir lead ${estoqueItem.leadId} do estoque:`, error);
      mensagens.push(`Erro ao distribuir lead ${estoqueItem.leadId}: ${error}`);
      erros++;
    }
  }

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
