import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import * as db from '../db';
import {
  leads,
  ofertaAtiva as ofertaAtivaTable,
  itemOfertaAtiva as itemOfertaAtivaTable,
  sessaoOferta as sessaoOfertaTable,
  atribuicaoSessao as atribuicaoSessaoTable,
  type FiltrosOferta,
} from '../../drizzle/schema';
import { and, eq, lte, inArray, sql, desc, count } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

function isGestorLevel(role: string) {
  return role === 'gestor' || role === 'admin' || role === 'superintendente';
}

const corretorProcedure = protectedProcedure.use(({ ctx, next }) => {
  return next({ ctx });
});

const gestorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isGestorLevel(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas gestores podem acessar' });
  }
  return next({ ctx });
});

const FiltrosOfertaSchema = z.object({
  status: z.array(z.string()).optional(),
  temperatura: z.array(z.string()).optional(),
  projetoId: z.array(z.number()).optional(),
  faixaRenda: z.array(z.string()).optional(),
  origem: z.array(z.string()).optional(),
  diasSemContatoMin: z.number().optional(),
  diasSemContatoMax: z.number().optional(),
  semInteracaoHaDias: z.number().optional(),
});

async function buildLeadsFromFiltros(
  drizzleDb: NonNullable<Awaited<ReturnType<typeof db.getDb>>>,
  filtros: FiltrosOferta,
  corretorId?: number,
): Promise<number[]> {
  const conditions = [
    eq(leads.naLixeira, false),
  ];

  if (corretorId) {
    conditions.push(eq(leads.corretorId, corretorId));
  }

  if (filtros.status && filtros.status.length > 0) {
    conditions.push(inArray(leads.status, filtros.status as any[]));
  }

  if (filtros.temperatura && filtros.temperatura.length > 0) {
    conditions.push(inArray(leads.temperatura, filtros.temperatura as any[]));
  }

  if (filtros.projetoId && filtros.projetoId.length > 0) {
    conditions.push(inArray(leads.projectId, filtros.projetoId));
  }

  if (filtros.faixaRenda && filtros.faixaRenda.length > 0) {
    conditions.push(inArray(leads.faixaRenda, filtros.faixaRenda));
  }

  if (filtros.origem && filtros.origem.length > 0) {
    conditions.push(inArray(leads.origem, filtros.origem as any[]));
  }

  if (filtros.semInteracaoHaDias != null && filtros.semInteracaoHaDias > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filtros.semInteracaoHaDias);
    conditions.push(lte(leads.ultimaInteracao, cutoff));
  }

  if (filtros.diasSemContatoMin != null && filtros.diasSemContatoMin > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filtros.diasSemContatoMin);
    conditions.push(lte(leads.ultimaInteracao, cutoff));
  }

  const result = await drizzleDb
    .select({ id: leads.id })
    .from(leads)
    .where(and(...conditions))
    .limit(500);

  return result.map((r) => r.id);
}

async function recalcularStats(
  drizzleDb: NonNullable<Awaited<ReturnType<typeof db.getDb>>>,
  ofertaId: number,
) {
  const [stats] = await drizzleDb
    .select({
      total: count(itemOfertaAtivaTable.id),
      contatados: sql<number>`SUM(CASE WHEN ${itemOfertaAtivaTable.contatadoEm} IS NOT NULL THEN 1 ELSE 0 END)`,
      avancados: sql<number>`SUM(CASE WHEN ${itemOfertaAtivaTable.statusKanban} = 'agendou' THEN 1 ELSE 0 END)`,
    })
    .from(itemOfertaAtivaTable)
    .where(eq(itemOfertaAtivaTable.ofertaId, ofertaId));

  if (stats) {
    await drizzleDb
      .update(ofertaAtivaTable)
      .set({
        totalLeads: stats.total,
        totalContatados: Number(stats.contatados) || 0,
        totalAvancados: Number(stats.avancados) || 0,
        updatedAt: new Date(),
      })
      .where(eq(ofertaAtivaTable.id, ofertaId));
  }
}

export const ofertaAtivaRouter = router({
  list: corretorProcedure
    .query(async ({ ctx }) => {
      const drizzleDb = await db.getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });

      const isGestor = isGestorLevel(ctx.user.role);
      const conditions = [
        inArray(ofertaAtivaTable.status, ['rascunho', 'ativa', 'concluida']),
      ];

      if (!isGestor) {
        conditions.push(eq(ofertaAtivaTable.corretorId, ctx.user.id));
      }

      const lista = await drizzleDb
        .select()
        .from(ofertaAtivaTable)
        .where(and(...conditions))
        .orderBy(desc(ofertaAtivaTable.createdAt))
        .limit(100);

      return lista;
    }),

  get: corretorProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const drizzleDb = await db.getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });

      const [oferta] = await drizzleDb
        .select()
        .from(ofertaAtivaTable)
        .where(eq(ofertaAtivaTable.id, input.id))
        .limit(1);

      if (!oferta) throw new TRPCError({ code: 'NOT_FOUND', message: 'Oferta não encontrada' });

      const isGestor = isGestorLevel(ctx.user.role);
      if (!isGestor && oferta.corretorId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
      }

      const itens = await drizzleDb
        .select({
          item: itemOfertaAtivaTable,
          leadNome: leads.nome,
          leadTelefone: leads.telefone,
          leadTemperatura: leads.temperatura,
          leadStatus: leads.status,
          leadUltimaInteracao: leads.ultimaInteracao,
          leadProjectId: leads.projectId,
        })
        .from(itemOfertaAtivaTable)
        .leftJoin(leads, eq(itemOfertaAtivaTable.leadId, leads.id))
        .where(eq(itemOfertaAtivaTable.ofertaId, input.id))
        .orderBy(itemOfertaAtivaTable.ordem);

      return {
        ...oferta,
        itens: itens.map((r) => ({
          ...r.item,
          lead: {
            nome: r.leadNome,
            telefone: r.leadTelefone,
            temperatura: r.leadTemperatura,
            status: r.leadStatus,
            ultimaInteracao: r.leadUltimaInteracao,
            projectId: r.leadProjectId,
          },
        })),
      };
    }),

  previewFiltros: corretorProcedure
    .input(z.object({
      filtros: FiltrosOfertaSchema,
      corretorId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const drizzleDb = await db.getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });

      const isGestor = isGestorLevel(ctx.user.role);
      const targetCorretorId = isGestor ? input.corretorId : ctx.user.id;

      const leadIds = await buildLeadsFromFiltros(drizzleDb, input.filtros, targetCorretorId);

      const sample = leadIds.length > 0
        ? await drizzleDb
            .select({ id: leads.id, nome: leads.nome, telefone: leads.telefone, temperatura: leads.temperatura })
            .from(leads)
            .where(inArray(leads.id, leadIds.slice(0, 5)))
        : [];

      return { count: leadIds.length, sample };
    }),

  create: corretorProcedure
    .input(z.object({
      nome: z.string().min(1),
      filtros: FiltrosOfertaSchema,
      corretorId: z.number().optional(),
      descricao: z.string().optional(),
      sessaoId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const drizzleDb = await db.getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });

      const isGestor = isGestorLevel(ctx.user.role);
      const targetCorretorId = isGestor ? (input.corretorId ?? ctx.user.id) : ctx.user.id;

      const filtros: FiltrosOferta = input.filtros;
      const leadIds = await buildLeadsFromFiltros(drizzleDb, filtros, targetCorretorId);

      const [result] = await drizzleDb
        .insert(ofertaAtivaTable)
        .values({
          nome: input.nome,
          descricao: input.descricao,
          corretorId: targetCorretorId,
          criadoPorId: ctx.user.id,
          sessaoId: input.sessaoId,
          filtros,
          totalLeads: leadIds.length,
        });

      const ofertaId = (result as any).insertId as number;

      if (leadIds.length > 0) {
        const BATCH = 100;
        for (let i = 0; i < leadIds.length; i += BATCH) {
          const batch = leadIds.slice(i, i + BATCH);
          await drizzleDb.insert(itemOfertaAtivaTable).values(
            batch.map((leadId, idx) => ({
              ofertaId,
              leadId,
              ordem: i + idx,
            })),
          );
        }
      }

      return { id: ofertaId, totalLeads: leadIds.length };
    }),

  updateItem: corretorProcedure
    .input(z.object({
      itemId: z.number(),
      statusKanban: z.enum(['ofertar', 'tratando', 'agendou', 'sem_retorno', 'perdido']),
      observacao: z.string().optional(),
      agendamentoData: z.string().optional(),
      agendamentoHora: z.string().optional(),
      agendamentoProjectId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const drizzleDb = await db.getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });

      const [item] = await drizzleDb
        .select()
        .from(itemOfertaAtivaTable)
        .where(eq(itemOfertaAtivaTable.id, input.itemId))
        .limit(1);

      if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Item não encontrado' });

      const [oferta] = await drizzleDb
        .select()
        .from(ofertaAtivaTable)
        .where(eq(ofertaAtivaTable.id, item.ofertaId))
        .limit(1);

      if (!oferta) throw new TRPCError({ code: 'NOT_FOUND', message: 'Oferta não encontrada' });

      const isGestor = isGestorLevel(ctx.user.role);
      if (!isGestor && oferta.corretorId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
      }

      let agendamentoId: number | undefined;

      if (input.statusKanban === 'agendou') {
        if (!input.agendamentoData || !input.agendamentoHora) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Data e hora são obrigatórios para agendamento' });
        }

        const { parsearDataISO } = await import('../timezone');
        const dataAgendamentoParsed = parsearDataISO(input.agendamentoData);
        const corretorDonoId = oferta.corretorId || ctx.user.id;

        const agendamento = await db.createAgendamento({
          leadId: item.leadId,
          corretorId: corretorDonoId,
          projectId: input.agendamentoProjectId,
          dataAgendamento: dataAgendamentoParsed,
          horaAgendamento: input.agendamentoHora,
          observacoes: input.observacao,
          criadoPorId: ctx.user.id,
        });

        agendamentoId = (agendamento as any)?.id;

        await db.updateLead(item.leadId, { status: 'agendado' }).catch(() => null);
      }

      const contatadoEm = item.contatadoEm ?? (input.statusKanban !== 'ofertar' ? new Date() : undefined);

      const updateData: Partial<typeof itemOfertaAtivaTable.$inferInsert> = {
        statusKanban: input.statusKanban,
        observacao: input.observacao ?? item.observacao,
        contatadoEm: contatadoEm ?? undefined,
      };

      if (agendamentoId) {
        updateData.agendamentoId = agendamentoId;
      }

      await drizzleDb
        .update(itemOfertaAtivaTable)
        .set(updateData)
        .where(eq(itemOfertaAtivaTable.id, input.itemId));

      await recalcularStats(drizzleDb, item.ofertaId);

      return { success: true };
    }),

  archive: corretorProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const drizzleDb = await db.getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });

      const [oferta] = await drizzleDb
        .select()
        .from(ofertaAtivaTable)
        .where(eq(ofertaAtivaTable.id, input.id))
        .limit(1);

      if (!oferta) throw new TRPCError({ code: 'NOT_FOUND', message: 'Oferta não encontrada' });

      const isGestor = isGestorLevel(ctx.user.role);
      if (!isGestor && oferta.criadoPorId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
      }

      await drizzleDb
        .update(ofertaAtivaTable)
        .set({ status: 'arquivada', updatedAt: new Date() })
        .where(eq(ofertaAtivaTable.id, input.id));

      return { success: true };
    }),

  sessoes: router({
    list: gestorProcedure
      .query(async () => {
        const drizzleDb = await db.getDb();
        if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });

        return drizzleDb
          .select()
          .from(sessaoOfertaTable)
          .orderBy(desc(sessaoOfertaTable.createdAt))
          .limit(50);
      }),

    create: gestorProcedure
      .input(z.object({
        nome: z.string().min(1),
        tipo: z.enum(['terca', 'quinta', 'avulsa']).default('avulsa'),
        dataHora: z.string(),
        descricao: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const drizzleDb = await db.getDb();
        if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });

        const [result] = await drizzleDb.insert(sessaoOfertaTable).values({
          nome: input.nome,
          tipo: input.tipo,
          dataHora: new Date(input.dataHora),
          criadoPorId: ctx.user.id,
          descricao: input.descricao,
        });

        return { id: (result as any).insertId };
      }),

    get: gestorProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const drizzleDb = await db.getDb();
        if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });

        const [sessao] = await drizzleDb
          .select()
          .from(sessaoOfertaTable)
          .where(eq(sessaoOfertaTable.id, input.id))
          .limit(1);

        if (!sessao) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sessão não encontrada' });

        const atribuicoes = await drizzleDb
          .select()
          .from(atribuicaoSessaoTable)
          .where(eq(atribuicaoSessaoTable.sessaoId, input.id));

        return { ...sessao, atribuicoes };
      }),

    atribuir: gestorProcedure
      .input(z.object({
        sessaoId: z.number(),
        corretorId: z.number(),
        filtros: FiltrosOfertaSchema,
        nome: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const drizzleDb = await db.getDb();
        if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });

        const filtros: FiltrosOferta = input.filtros;
        const leadIds = await buildLeadsFromFiltros(drizzleDb, filtros, input.corretorId);

        const [ofertaResult] = await drizzleDb.insert(ofertaAtivaTable).values({
          nome: input.nome,
          corretorId: input.corretorId,
          criadoPorId: ctx.user.id,
          sessaoId: input.sessaoId,
          filtros,
          totalLeads: leadIds.length,
        });

        const ofertaId = (ofertaResult as any).insertId as number;

        if (leadIds.length > 0) {
          const BATCH = 100;
          for (let i = 0; i < leadIds.length; i += BATCH) {
            const batch = leadIds.slice(i, i + BATCH);
            await drizzleDb.insert(itemOfertaAtivaTable).values(
              batch.map((leadId, idx) => ({ ofertaId, leadId, ordem: i + idx })),
            );
          }
        }

        const [atribResult] = await drizzleDb.insert(atribuicaoSessaoTable).values({
          sessaoId: input.sessaoId,
          corretorId: input.corretorId,
          ofertaId,
        });

        return { atribuicaoId: (atribResult as any).insertId, ofertaId };
      }),

    updateStatus: gestorProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['agendada', 'em_andamento', 'concluida']),
      }))
      .mutation(async ({ input }) => {
        const drizzleDb = await db.getDb();
        if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });

        await drizzleDb
          .update(sessaoOfertaTable)
          .set({ status: input.status })
          .where(eq(sessaoOfertaTable.id, input.id));

        return { success: true };
      }),
  }),
});
