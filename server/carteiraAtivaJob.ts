/**
 * Job da Carteira Ativa
 *
 * Responsabilidades:
 * 1. Notificar corretores sobre leads que expiram em 24h (lembrete de renovação)
 * 2. Notificar corretores sobre tarefas do dia (às 8h SP)
 * 3. Processar leads expirados: se o corretor não renovou, o lead volta para redistribuição
 */
import { getDb } from "./db";
import { carteiraAtiva, carteiraTarefas, leads, users, leadHistory } from "../drizzle/schema";
import { eq, and, lt, lte, gt, sql } from "drizzle-orm";
import { agora, hojeSpInicio, hojeSpFim } from "./timezone";
import { notifyOwner } from "./_core/notification";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function registrarHistorico(leadId: number, corretorId: number, descricao: string) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(leadHistory).values({
      leadId,
      corretorId,
      tipo: "outro",
      resultado: "outro",
      observacoes: descricao,
      createdAt: agora(),
    });
  } catch (_) {
    // Silencioso
  }
}

// ─── Tarefa 1: Notificar expiração iminente (24h antes) ──────────────────────

async function notificarExpiracaoIminente() {
  const db = await getDb();
  if (!db) return;

  const agr = agora();
  // Leads que expiram nas próximas 24h e ainda não foram notificados
  const em24h = new Date(agr.getTime() + 24 * 60 * 60 * 1000);

  try {
    const itens = await db
      .select({
        id: carteiraAtiva.id,
        leadId: carteiraAtiva.leadId,
        corretorId: carteiraAtiva.corretorId,
        protecaoAte: carteiraAtiva.protecaoAte,
        leadNome: leads.nome,
        corretorNome: users.name,
      })
      .from(carteiraAtiva)
      .leftJoin(leads, eq(carteiraAtiva.leadId, leads.id))
      .leftJoin(users, eq(carteiraAtiva.corretorId, users.id))
      .where(
        and(
          eq(carteiraAtiva.ativo, true),
          eq(carteiraAtiva.notificadoExpiracao, false),
          lte(carteiraAtiva.protecaoAte, em24h),
          gt(carteiraAtiva.protecaoAte, agr)
        )
      );

    for (const item of itens) {
      // Marcar como notificado
      await db
        .update(carteiraAtiva)
        .set({ notificadoExpiracao: true, updatedAt: agr })
        .where(eq(carteiraAtiva.id, item.id));

      console.log(
        `[CarteiraAtiva] Expiração iminente: lead "${item.leadNome}" (ID ${item.leadId}) do corretor ${item.corretorNome} expira em menos de 24h`
      );
    }

    if (itens.length > 0) {
      console.log(`[CarteiraAtiva] ${itens.length} leads com expiração iminente notificados`);
    }
  } catch (err) {
    console.error("[CarteiraAtiva] Erro ao notificar expiração iminente:", err);
  }
}

// ─── Tarefa 2: Processar leads expirados → volta para redistribuição ─────────

async function processarLeadsExpirados() {
  const db = await getDb();
  if (!db) return;

  const agr = agora();

  try {
    // Buscar leads expirados (protecaoAte < agora)
    const expirados = await db
      .select({
        id: carteiraAtiva.id,
        leadId: carteiraAtiva.leadId,
        corretorId: carteiraAtiva.corretorId,
        leadNome: leads.nome,
        corretorNome: users.name,
      })
      .from(carteiraAtiva)
      .leftJoin(leads, eq(carteiraAtiva.leadId, leads.id))
      .leftJoin(users, eq(carteiraAtiva.corretorId, users.id))
      .where(
        and(
          eq(carteiraAtiva.ativo, true),
          lt(carteiraAtiva.protecaoAte, agr)
        )
      );

    for (const item of expirados) {
      // Desativar na carteira ativa
      await db
        .update(carteiraAtiva)
        .set({ ativo: false, updatedAt: agr })
        .where(eq(carteiraAtiva.id, item.id));

      // Registrar no histórico do lead
      await registrarHistorico(
        item.leadId,
        item.corretorId,
        `Proteção da Carteira Ativa expirou. Lead elegível para redistribuição automática.`
      );

      console.log(
        `[CarteiraAtiva] Lead "${item.leadNome}" (ID ${item.leadId}) removido da carteira de ${item.corretorNome} — proteção expirada`
      );
    }

    if (expirados.length > 0) {
      console.log(`[CarteiraAtiva] ${expirados.length} leads removidos da carteira por expiração`);
    }
  } catch (err) {
    console.error("[CarteiraAtiva] Erro ao processar leads expirados:", err);
  }
}

// ─── Tarefa 3: Lembrete de tarefas do dia (às 8h SP) ─────────────────────────

async function lembretesTarefasDoDia() {
  const db = await getDb();
  if (!db) return;

  const agr = agora();
  const hoje = new Date(agr);
  hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);

  try {
    // Buscar tarefas de hoje ainda não concluídas
    const tarefas = await db
      .select({
        id: carteiraTarefas.id,
        descricao: carteiraTarefas.descricao,
        corretorId: carteiraTarefas.corretorId,
        leadId: carteiraTarefas.leadId,
        leadNome: leads.nome,
        corretorNome: users.name,
      })
      .from(carteiraTarefas)
      .leftJoin(leads, eq(carteiraTarefas.leadId, leads.id))
      .leftJoin(users, eq(carteiraTarefas.corretorId, users.id))
      .where(
        and(
          eq(carteiraTarefas.concluida, false),
          sql`${carteiraTarefas.dataLembrete} >= ${hoje}`,
          sql`${carteiraTarefas.dataLembrete} < ${amanha}`
        )
      );

    if (tarefas.length > 0) {
      // Agrupar por corretor para log
      const porCorretor: Record<number, { nome: string; tarefas: string[] }> = {};
      for (const t of tarefas) {
        if (!porCorretor[t.corretorId]) {
          porCorretor[t.corretorId] = { nome: t.corretorNome ?? `Corretor #${t.corretorId}`, tarefas: [] };
        }
        porCorretor[t.corretorId].tarefas.push(`"${t.descricao}" (lead: ${t.leadNome ?? t.leadId})`);
      }

      console.log(`[CarteiraAtiva] ${tarefas.length} tarefas para hoje em ${Object.keys(porCorretor).length} corretores`);
    }
  } catch (err) {
    console.error("[CarteiraAtiva] Erro ao processar lembretes de tarefas:", err);
  }
}

// ─── Inicialização do Job ─────────────────────────────────────────────────────

export function iniciarCarteiraAtivaJob() {
  console.log("[CarteiraAtiva] Job automático DESATIVADO por decisão do usuário para reduzir custos de Cloud.");
  console.log("[CarteiraAtiva] Expiração e lembretes de tarefas foram removidos. Funcionalidades manuais continuam disponíveis.");
}
