/**
 * Router da Carteira Ativa
 *
 * Regras de negócio:
 * - Proteção de 15 dias iniciais contra qualquer distribuição automática
 * - Renovações de 3 dias após vencimento (ilimitadas)
 * - Limite de 25% dos leads totais ativos do corretor
 * - Apenas o próprio corretor pode adicionar/remover leads
 * - Gestores e admins têm visão de leitura
 * - Ao encerrar (não renovar), o lead volta para a fila de redistribuição
 * - Registro no histórico do lead a cada ação
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, gestorProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  carteiraAtiva,
  carteiraTarefas,
  leads,
  users,
  leadHistory,
} from "../../drizzle/schema";
import { eq, and, inArray, sql, gt, lt, lte } from "drizzle-orm";
import { agora } from "../timezone";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Verifica se um lead está protegido pela Carteira Ativa */
export async function isLeadProtegidoCarteira(leadId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const agr = agora();
  const rows = await db
    .select({ id: carteiraAtiva.id })
    .from(carteiraAtiva)
    .where(
      and(
        eq(carteiraAtiva.leadId, leadId),
        eq(carteiraAtiva.ativo, true),
        gt(carteiraAtiva.protecaoAte, agr)
      )
    )
    .limit(1);
  return rows.length > 0;
}

/** Retorna os IDs de todos os leads protegidos pela Carteira Ativa */
export async function getLeadsProtegidosCarteira(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const agr = agora();
  const rows = await db
    .select({ leadId: carteiraAtiva.leadId })
    .from(carteiraAtiva)
    .where(
      and(
        eq(carteiraAtiva.ativo, true),
        gt(carteiraAtiva.protecaoAte, agr)
      )
    );
  return rows.map((r) => r.leadId);
}

/** Registra uma interação no histórico do lead */
async function registrarHistorico(
  leadId: number,
  corretorId: number,
  descricao: string
) {
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
    // Silencioso — histórico é melhor esforço
  }
}

// ─── Procedures ─────────────────────────────────────────────────────────────

export const carteiraAtivaRouter = router({
  /**
   * Lista todos os leads na Carteira Ativa do corretor autenticado.
   * Inclui dados do lead, prazo de proteção, renovações e tarefas pendentes.
   */
  listar: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const agr = agora();

    const itens = await db
      .select({
        id: carteiraAtiva.id,
        leadId: carteiraAtiva.leadId,
        protecaoAte: carteiraAtiva.protecaoAte,
        renovacoes: carteiraAtiva.renovacoes,
        observacao: carteiraAtiva.observacao,
        ativo: carteiraAtiva.ativo,
        createdAt: carteiraAtiva.createdAt,
        // Dados do lead
        leadNome: leads.nome,
        leadTelefone: leads.telefone,
        leadEmail: leads.email,
        leadStatus: leads.status,
        leadProjeto: leads.projeto,
        leadOrigem: leads.origem,
      })
      .from(carteiraAtiva)
      .leftJoin(leads, eq(carteiraAtiva.leadId, leads.id))
      .where(
        and(
          eq(carteiraAtiva.corretorId, ctx.user.id),
          eq(carteiraAtiva.ativo, true)
        )
      );

    // Para cada item, buscar tarefas pendentes + contadores
    const result = await Promise.all(
      itens.map(async (item) => {
        const tarefasPendentes = await db
          .select()
          .from(carteiraTarefas)
          .where(
            and(
              eq(carteiraTarefas.carteiraId, item.id),
              eq(carteiraTarefas.concluida, false)
            )
          );

        // Tarefas para hoje (lembrete no dia atual)
        const hoje = new Date(agr);
        hoje.setHours(0, 0, 0, 0);
        const amanha = new Date(hoje);
        amanha.setDate(amanha.getDate() + 1);

        const tarefasHoje = tarefasPendentes.filter(
          (t) =>
            t.dataLembrete >= hoje && t.dataLembrete < amanha
        );

        const expirado = item.protecaoAte <= agr;
        const diasRestantes = Math.max(
          0,
          Math.ceil(
            (item.protecaoAte.getTime() - agr.getTime()) / (1000 * 60 * 60 * 24)
          )
        );

        // Contador 1: dias sem interação no lead (desde a última entrada em lead_history)
        const [ultimaInteracao] = await db
          .select({ createdAt: leadHistory.createdAt })
          .from(leadHistory)
          .where(eq(leadHistory.leadId, item.leadId))
          .orderBy(sql`${leadHistory.createdAt} DESC`)
          .limit(1);

        const diasSemInteracao = ultimaInteracao
          ? Math.floor(
              (agr.getTime() - ultimaInteracao.createdAt.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : Math.floor(
              (agr.getTime() - item.createdAt.getTime()) /
                (1000 * 60 * 60 * 24)
            );

        // Contador 2: dias totais na Carteira Ativa (desde adicionadoEm)
        const diasNaCarteira = Math.floor(
          (agr.getTime() - item.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          ...item,
          tarefasPendentes,
          tarefasHoje,
          expirado,
          diasRestantes,
          diasSemInteracao: Math.max(0, diasSemInteracao),
          diasNaCarteira: Math.max(0, diasNaCarteira),
        };
      })
    );

    return result;
  }),

  /**
   * Adiciona um lead à Carteira Ativa do corretor.
   * Valida limite de 25% e se o lead já não está protegido.
   */
  adicionar: protectedProcedure
    .input(
      z.object({
        leadId: z.number().int().positive(),
        observacao: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verificar se o lead pertence ao corretor
      const [lead] = await db
        .select()
        .from(leads)
        .where(eq(leads.id, input.leadId))
        .limit(1);

      if (!lead) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });
      }

      if (lead.corretorId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você só pode adicionar seus próprios leads à Carteira Ativa",
        });
      }

      // Verificar se já está na carteira ativa
      const agr = agora();
      const [jaExiste] = await db
        .select({ id: carteiraAtiva.id })
        .from(carteiraAtiva)
        .where(
          and(
            eq(carteiraAtiva.leadId, input.leadId),
            eq(carteiraAtiva.corretorId, ctx.user.id),
            eq(carteiraAtiva.ativo, true)
          )
        )
        .limit(1);

      if (jaExiste) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este lead já está na sua Carteira Ativa",
        });
      }

      // Verificar limite de 25% dos leads ativos do corretor
      const [totalLeadsAtivos] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(leads)
        .where(
          and(
            eq(leads.corretorId, ctx.user.id),
            eq(leads.naLixeira, false),
            inArray(leads.status, [
              "aguardando_atendimento",
              "em_atendimento",
              "agendado",
              "visita_realizada",
              "analise_credito",
            ] as any[])
          )
        );

      const [totalCarteira] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(carteiraAtiva)
        .where(
          and(
            eq(carteiraAtiva.corretorId, ctx.user.id),
            eq(carteiraAtiva.ativo, true)
          )
        );

      const limiteCarteira = Math.floor(
        (Number(totalLeadsAtivos?.count) || 0) * 0.25
      );
      const totalAtualCarteira = Number(totalCarteira?.count) || 0;

      if (totalAtualCarteira >= limiteCarteira && limiteCarteira > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Limite atingido: você pode ter no máximo 25% dos seus leads na Carteira Ativa (${limiteCarteira} leads). Você já tem ${totalAtualCarteira}.`,
        });
      }

      // Calcular prazo de proteção: 15 dias a partir de agora
      const protecaoAte = new Date(agr.getTime() + 15 * 24 * 60 * 60 * 1000);

      // Inserir na carteira ativa
      await db.insert(carteiraAtiva).values({
        leadId: input.leadId,
        corretorId: ctx.user.id,
        protecaoAte,
        renovacoes: 0,
        observacao: input.observacao ?? null,
        notificadoExpiracao: false,
        ativo: true,
        createdAt: agr,
        updatedAt: agr,
      });

      // Registrar no histórico do lead
      await registrarHistorico(
        input.leadId,
        ctx.user.id,
        `Lead adicionado à Carteira Ativa. Proteção contra redistribuição até ${protecaoAte.toLocaleDateString("pt-BR")}.`
      );

      return { sucesso: true, protecaoAte };
    }),

  /**
   * Renova a proteção por mais 3 dias após o vencimento.
   * Pode ser chamado mesmo antes do vencimento (renovação antecipada não permitida).
   */
  renovar: protectedProcedure
    .input(z.object({ carteiraId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [item] = await db
        .select()
        .from(carteiraAtiva)
        .where(
          and(
            eq(carteiraAtiva.id, input.carteiraId),
            eq(carteiraAtiva.corretorId, ctx.user.id),
            eq(carteiraAtiva.ativo, true)
          )
        )
        .limit(1);

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item não encontrado na sua Carteira Ativa",
        });
      }

      const agr = agora();

      // Calcular nova data: 3 dias a partir de agora (ou da expiração atual, o que for maior)
      const base = item.protecaoAte > agr ? item.protecaoAte : agr;
      const novaProtecaoAte = new Date(base.getTime() + 3 * 24 * 60 * 60 * 1000);

      await db
        .update(carteiraAtiva)
        .set({
          protecaoAte: novaProtecaoAte,
          renovacoes: item.renovacoes + 1,
          notificadoExpiracao: false,
          updatedAt: agr,
        })
        .where(eq(carteiraAtiva.id, input.carteiraId));

      await registrarHistorico(
        item.leadId,
        ctx.user.id,
        `Carteira Ativa renovada por +3 dias (renovação #${item.renovacoes + 1}). Nova proteção até ${novaProtecaoAte.toLocaleDateString("pt-BR")}.`
      );

      return { sucesso: true, novaProtecaoAte, renovacoes: item.renovacoes + 1 };
    }),

  /**
   * Encerra a proteção do lead na Carteira Ativa.
   * O lead volta para a fila de redistribuição automática.
   */
  encerrar: protectedProcedure
    .input(z.object({ carteiraId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [item] = await db
        .select()
        .from(carteiraAtiva)
        .where(
          and(
            eq(carteiraAtiva.id, input.carteiraId),
            eq(carteiraAtiva.corretorId, ctx.user.id),
            eq(carteiraAtiva.ativo, true)
          )
        )
        .limit(1);

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item não encontrado na sua Carteira Ativa",
        });
      }

      const agr = agora();

      await db
        .update(carteiraAtiva)
        .set({ ativo: false, updatedAt: agr })
        .where(eq(carteiraAtiva.id, input.carteiraId));

      await registrarHistorico(
        item.leadId,
        ctx.user.id,
        "Lead removido da Carteira Ativa. Disponível para redistribuição automática."
      );

      return { sucesso: true };
    }),

  /**
   * Atualiza a observação de um item da Carteira Ativa.
   */
  atualizarObservacao: protectedProcedure
    .input(
      z.object({
        carteiraId: z.number().int().positive(),
        observacao: z.string().max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(carteiraAtiva)
        .set({ observacao: input.observacao, updatedAt: agora() })
        .where(
          and(
            eq(carteiraAtiva.id, input.carteiraId),
            eq(carteiraAtiva.corretorId, ctx.user.id),
            eq(carteiraAtiva.ativo, true)
          )
        );

      return { sucesso: true };
    }),

  // ── Tarefas ────────────────────────────────────────────────────────────────

  /**
   * Cria uma tarefa futura com lembrete para um lead da Carteira Ativa.
   */
  criarTarefa: protectedProcedure
    .input(
      z.object({
        carteiraId: z.number().int().positive(),
        descricao: z.string().min(1).max(500),
        dataLembrete: z.string(), // ISO string
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verificar que o item pertence ao corretor
      const [item] = await db
        .select()
        .from(carteiraAtiva)
        .where(
          and(
            eq(carteiraAtiva.id, input.carteiraId),
            eq(carteiraAtiva.corretorId, ctx.user.id),
            eq(carteiraAtiva.ativo, true)
          )
        )
        .limit(1);

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item não encontrado na sua Carteira Ativa" });
      }

      const dataLembrete = new Date(input.dataLembrete);
      const agr = agora();

      await db.insert(carteiraTarefas).values({
        carteiraId: input.carteiraId,
        leadId: item.leadId,
        corretorId: ctx.user.id,
        descricao: input.descricao,
        dataLembrete,
        concluida: false,
        notificacaoEnviada: false,
        createdAt: agr,
        updatedAt: agr,
      });

      return { sucesso: true };
    }),

  /**
   * Lista as tarefas de um item da Carteira Ativa.
   */
  listarTarefas: protectedProcedure
    .input(z.object({ carteiraId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      return db
        .select()
        .from(carteiraTarefas)
        .where(
          and(
            eq(carteiraTarefas.carteiraId, input.carteiraId),
            eq(carteiraTarefas.corretorId, ctx.user.id)
          )
        );
    }),

  /**
   * Marca uma tarefa como concluída.
   */
  concluirTarefa: protectedProcedure
    .input(z.object({ tarefaId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const agr = agora();
      await db
        .update(carteiraTarefas)
        .set({ concluida: true, dataConclusao: agr, updatedAt: agr })
        .where(
          and(
            eq(carteiraTarefas.id, input.tarefaId),
            eq(carteiraTarefas.corretorId, ctx.user.id)
          )
        );

      return { sucesso: true };
    }),

  /**
   * Exclui uma tarefa pendente.
   */
  excluirTarefa: protectedProcedure
    .input(z.object({ tarefaId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .delete(carteiraTarefas)
        .where(
          and(
            eq(carteiraTarefas.id, input.tarefaId),
            eq(carteiraTarefas.corretorId, ctx.user.id),
            eq(carteiraTarefas.concluida, false)
          )
        );

      return { sucesso: true };
    }),

  /**
   * Retorna as tarefas do dia atual do corretor (para exibir no painel de alertas).
   */
  tarefasHoje: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const agr = agora();
    const hoje = new Date(agr);
    hoje.setHours(0, 0, 0, 0);
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);

    const tarefas = await db
      .select({
        id: carteiraTarefas.id,
        descricao: carteiraTarefas.descricao,
        dataLembrete: carteiraTarefas.dataLembrete,
        concluida: carteiraTarefas.concluida,
        leadId: carteiraTarefas.leadId,
        carteiraId: carteiraTarefas.carteiraId,
        leadNome: leads.nome,
        leadTelefone: leads.telefone,
      })
      .from(carteiraTarefas)
      .leftJoin(leads, eq(carteiraTarefas.leadId, leads.id))
      .where(
        and(
          eq(carteiraTarefas.corretorId, ctx.user.id),
          eq(carteiraTarefas.concluida, false),
          sql`${carteiraTarefas.dataLembrete} >= ${hoje}`,
          sql`${carteiraTarefas.dataLembrete} < ${amanha}`
        )
      );

    return tarefas;
  }),

  // ── Visão do Gestor/Admin ──────────────────────────────────────────────────

  /**
   * Lista a Carteira Ativa de todos os corretores (gestor/admin).
   */
  listarTodos: gestorProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const agr = agora();

    const itens = await db
      .select({
        id: carteiraAtiva.id,
        leadId: carteiraAtiva.leadId,
        corretorId: carteiraAtiva.corretorId,
        protecaoAte: carteiraAtiva.protecaoAte,
        renovacoes: carteiraAtiva.renovacoes,
        observacao: carteiraAtiva.observacao,
        ativo: carteiraAtiva.ativo,
        createdAt: carteiraAtiva.createdAt,
        leadNome: leads.nome,
        leadTelefone: leads.telefone,
        leadStatus: leads.status,
        corretorNome: users.name,
      })
      .from(carteiraAtiva)
      .leftJoin(leads, eq(carteiraAtiva.leadId, leads.id))
      .leftJoin(users, eq(carteiraAtiva.corretorId, users.id))
      .where(eq(carteiraAtiva.ativo, true));

    return itens.map((item) => ({
      ...item,
      expirado: item.protecaoAte <= agr,
      diasRestantes: Math.max(
        0,
        Math.ceil(
          (item.protecaoAte.getTime() - agr.getTime()) / (1000 * 60 * 60 * 24)
        )
      ),
    }));
  }),

  /**
   * Resumo por corretor para o painel do gestor.
   */
  resumoGestor: gestorProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const agr = agora();

    const rows = await db
      .select({
        corretorId: carteiraAtiva.corretorId,
        corretorNome: users.name,
        total: sql<number>`COUNT(*)`,
        expirados: sql<number>`SUM(CASE WHEN ${carteiraAtiva.protecaoAte} <= ${agr} THEN 1 ELSE 0 END)`,
      })
      .from(carteiraAtiva)
      .leftJoin(users, eq(carteiraAtiva.corretorId, users.id))
      .where(eq(carteiraAtiva.ativo, true))
      .groupBy(carteiraAtiva.corretorId, users.name);

    return rows;
  }),
});
