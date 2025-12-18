import { getDb } from "./db";
import { leads, leadHistory, users } from "../drizzle/schema";
import { eq, and, sql, lt, gte } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

interface FollowUpStatus {
  leadId: number;
  leadNome: string;
  leadTelefone: string;
  corretorId: number;
  corretorNome: string;
  corretorEmail: string;
  diasConsecutivos: number;
  ultimoContato: Date | null;
  diasSemContato: number;
  precisaFollowUp: boolean;
}

/**
 * Calcula quantos dias consecutivos um lead teve follow-up
 */
export async function calcularDiasConsecutivosFollowUp(leadId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // Buscar histórico de interações ordenado por data (mais recente primeiro)
  const historico = await db
    .select()
    .from(leadHistory)
    .where(eq(leadHistory.leadId, leadId))
    .orderBy(sql`${leadHistory.createdAt} DESC`);

  if (historico.length === 0) return 0;

  let diasConsecutivos = 0;
  let dataAnterior: Date | null = null;

  for (const interacao of historico) {
    const dataAtual = new Date(interacao.createdAt);
    
    if (!dataAnterior) {
      // Primeira interação
      diasConsecutivos = 1;
      dataAnterior = dataAtual;
      continue;
    }

    // Calcular diferença em dias
    const diffTime = dataAnterior.getTime() - dataAtual.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Dias consecutivos
      diasConsecutivos++;
      dataAnterior = dataAtual;
    } else {
      // Quebrou a sequência
      break;
    }
  }

  return diasConsecutivos;
}

/**
 * Calcula quantos dias se passaram desde o último contato
 */
export async function calcularDiasSemContato(leadId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // Buscar última interação
  const ultimaInteracao = await db
    .select()
    .from(leadHistory)
    .where(eq(leadHistory.leadId, leadId))
    .orderBy(sql`${leadHistory.createdAt} DESC`)
    .limit(1);

  if (ultimaInteracao.length === 0) {
    // Se não há interação, calcular desde a data de distribuição
    const lead = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (lead.length === 0 || !lead[0].dataDistribuicao) return 0;

    const diffTime = Date.now() - new Date(lead[0].dataDistribuicao).getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  const diffTime = Date.now() - new Date(ultimaInteracao[0].createdAt).getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Verifica se um lead precisa de follow-up
 * Regras:
 * - Lead em atendimento sem contato há mais de 3 dias
 * - Lead agendado sem contato há mais de 1 dia
 * - Lead com menos de 5 dias consecutivos de follow-up
 */
export async function verificarNecessidadeFollowUp(leadId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const lead = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (lead.length === 0) return false;

  const leadData = lead[0];
  const diasSemContato = await calcularDiasSemContato(leadId);
  const diasConsecutivos = await calcularDiasConsecutivosFollowUp(leadId);

  // Regra 1: Lead em atendimento sem contato há mais de 3 dias
  if (leadData.status === "em_atendimento" && diasSemContato >= 3) {
    return true;
  }

  // Regra 2: Lead agendado sem contato há mais de 1 dia
  if (leadData.status === "agendado" && diasSemContato >= 1) {
    return true;
  }

  // Regra 3: Lead com menos de 5 dias consecutivos de follow-up E sem contato há mais de 1 dia
  if (diasConsecutivos < 5 && diasSemContato >= 1 && leadData.status !== "contrato_fechado" && leadData.status !== "perdido") {
    return true;
  }

  return false;
}

/**
 * Obtém todos os leads que precisam de follow-up
 */
export async function getLeadsPendentesFollowUp(): Promise<FollowUpStatus[]> {
  const db = await getDb();
  if (!db) return [];

  // Buscar todos os leads distribuídos e não finalizados
  const leadsAtivos = await db
    .select({
      leadId: leads.id,
      leadNome: leads.nome,
      leadTelefone: leads.telefone,
      leadStatus: leads.status,
      corretorId: leads.corretorId,
      corretorNome: users.name,
      corretorEmail: users.email,
    })
    .from(leads)
    .leftJoin(users, eq(leads.corretorId, users.id))
    .where(
      and(
        sql`${leads.corretorId} IS NOT NULL`,
        sql`${leads.status} NOT IN ('contrato_fechado', 'perdido')`
      )
    );

  const resultado: FollowUpStatus[] = [];

  for (const lead of leadsAtivos) {
    if (!lead.corretorId) continue;

    const diasConsecutivos = await calcularDiasConsecutivosFollowUp(lead.leadId);
    const diasSemContato = await calcularDiasSemContato(lead.leadId);
    const precisaFollowUp = await verificarNecessidadeFollowUp(lead.leadId);

    // Buscar última interação
    const ultimaInteracao = await db
      .select()
      .from(leadHistory)
      .where(eq(leadHistory.leadId, lead.leadId))
      .orderBy(sql`${leadHistory.createdAt} DESC`)
      .limit(1);

    resultado.push({
      leadId: lead.leadId,
      leadNome: lead.leadNome,
      leadTelefone: lead.leadTelefone || "",
      corretorId: lead.corretorId,
      corretorNome: lead.corretorNome || "",
      corretorEmail: lead.corretorEmail || "",
      diasConsecutivos,
      ultimoContato: ultimaInteracao.length > 0 ? new Date(ultimaInteracao[0].createdAt) : null,
      diasSemContato,
      precisaFollowUp,
    });
  }

  return resultado.filter(l => l.precisaFollowUp);
}

/**
 * Envia notificações de follow-up para corretores
 */
export async function enviarNotificacoesFollowUp(): Promise<{
  success: number;
  failed: number;
}> {
  const leadsPendentes = await getLeadsPendentesFollowUp();

  // Agrupar por corretor
  const porCorretor = new Map<number, FollowUpStatus[]>();
  
  for (const lead of leadsPendentes) {
    if (!porCorretor.has(lead.corretorId)) {
      porCorretor.set(lead.corretorId, []);
    }
    porCorretor.get(lead.corretorId)?.push(lead);
  }

  let success = 0;
  let failed = 0;

  // Enviar notificação para cada corretor
  for (const [corretorId, leads] of Array.from(porCorretor.entries())) {
    try {
      const corretor = leads[0]; // Pegar dados do corretor do primeiro lead
      
      const mensagem = `
🔔 **Lembretes de Follow-up**

Olá ${corretor.corretorNome}!

Você tem **${leads.length} lead(s)** que precisam de follow-up:

${leads.map((l: FollowUpStatus) => `
• **${l.leadNome}** (${l.leadTelefone})
  - ${l.diasSemContato} dia(s) sem contato
  - ${l.diasConsecutivos} dia(s) consecutivos de follow-up
`).join('\n')}

Acesse o CRM para fazer o acompanhamento.
      `.trim();

      // Enviar notificação para o gestor (que pode repassar ao corretor)
      await notifyOwner({
        title: `Follow-up pendente: ${corretor.corretorNome}`,
        content: mensagem,
      });

      success++;
    } catch (error) {
      console.error(`Erro ao enviar notificação para corretor ${corretorId}:`, error);
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Job de follow-up automático
 * Executa diariamente para verificar leads pendentes
 */
export async function executarJobFollowUp() {
  console.log("[Job] Iniciando verificação de follow-up...");
  
  try {
    const leadsPendentes = await getLeadsPendentesFollowUp();
    
    console.log(`[Job] Encontrados ${leadsPendentes.length} leads pendentes de follow-up`);
    
    if (leadsPendentes.length > 0) {
      const resultado = await enviarNotificacoesFollowUp();
      console.log(`[Job] Notificações enviadas: ${resultado.success} sucesso, ${resultado.failed} falhas`);
    }
    
    return {
      success: true,
      leadsPendentes: leadsPendentes.length,
    };
  } catch (error) {
    console.error("[Job] Erro no job de follow-up:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Agenda o job de follow-up para executar diariamente
 */
export function agendarJobFollowUp() {
  // Executar imediatamente na inicialização (após 1 minuto)
  setTimeout(() => {
    console.log("[Job] Executando primeira verificação de follow-up...");
    executarJobFollowUp().catch(console.error);
  }, 60000);

  // Executar a cada 24 horas (86400000 ms)
  setInterval(() => {
    console.log("[Job] Executando verificação de follow-up agendada...");
    executarJobFollowUp().catch(console.error);
  }, 86400000);

  console.log("[Job] Follow-up automático agendado para executar diariamente");
}
