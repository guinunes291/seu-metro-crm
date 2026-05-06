import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import * as db from '../db';
import { blitzSessoes } from '../../drizzle/schema';
import { desc, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

// ============================================================================
// HELPERS DE ROLE (replicados do routers.ts para independência)
// ============================================================================

function isGestorLevel(role: string): boolean {
  return role === 'gestor' || role === 'admin' || role === 'superintendente';
}

function isAdminLevel(role: string): boolean {
  return role === 'admin' || role === 'superintendente';
}

const corretorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'corretor' && !isGestorLevel(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
  }
  return next({ ctx });
});

const gestorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isGestorLevel(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas gestores podem acessar' });
  }
  return next({ ctx });
});

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isAdminLevel(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem acessar' });
  }
  return next({ ctx });
});

const adminExportProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas o administrador principal pode exportar dados' });
  }
  return next({ ctx });
});

// ============================================================================
// LEADS ROUTER
// ============================================================================

export const leadsRouter = router({
  list: protectedProcedure
    .input(z.object({
      page: z.number().optional().default(1),
      limit: z.number().optional().default(50),
      searchTerm: z.string().optional(),
      status: z.string().optional(),
      projectId: z.number().optional(),
      origem: z.string().optional(),
      corretorId: z.number().optional(),
      temperatura: z.enum(["quente", "morno", "frio"]).optional(), // Fase 2
      dataInicio: z.string().optional(),
      dataFim: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const page = input?.page || 1;
      const limit = input?.limit || 50;
      const searchTerm = input?.searchTerm;
      const status = input?.status;
      const projectId = input?.projectId;
      const origem = input?.origem;
      const corretorId = input?.corretorId;
      const temperatura = input?.temperatura; // Fase 2
      const dataInicio = input?.dataInicio;
      const dataFim = input?.dataFim;

      const { getCorretoresIdsParaFiltro } = await import('../equipes');
      const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);

      return await db.getAllLeads({
        page,
        limit,
        searchTerm,
        status,
        projectId,
        origem,
        corretorId: corretorId || (corretoresIds?.length === 1 ? corretoresIds[0] : undefined),
        corretoresIds,
        temperatura, // Fase 2
        dataInicio,
        dataFim
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const lead = await db.getLeadById(input.id);

      if (!lead) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
      }

      if (ctx.user.role === 'corretor' && lead.corretorId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
      }

      return lead;
    }),

  getNewWebhookLeads: protectedProcedure
    .input(z.object({ since: z.string() }))
    .query(async ({ input, ctx }) => {
      const corretorId = ctx.user.role === 'corretor' ? ctx.user.id : undefined;
      if (!corretorId) return [];
      return await db.getNewWebhookLeadsSince(corretorId, new Date(input.since));
    }),

  metricasDiarias: corretorProcedure
    .query(async ({ ctx }) => {
      const corretorId = ctx.user.role === 'corretor' ? ctx.user.id : null;
      if (!corretorId) return { recebidosHoje: 0, perdidosPorTimeout: 0 };
      return await db.getMetricasDiariasCorretor(corretorId);
    }),

  create: gestorProcedure
    .input(z.object({
      idPrincipal: z.string().optional(),
      nome: z.string(),
      email: z.string().email().optional(),
      telefone: z.string(),
      origem: z.string().optional(),
      projectId: z.number().optional(),
      corretorId: z.number().optional(),
      status: z.enum([
        "novo", "aguardando_atendimento", "em_atendimento", "agendado",
        "visita_realizada", "analise_credito", "contrato_fechado", "perdido"
      ]).default("novo"),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return await db.createLead(input);
    }),

  createByCorretor: corretorProcedure
    .input(z.object({
      nome: z.string(),
      email: z.string().email().optional(),
      telefone: z.string(),
      origem: z.enum([
        "facebook", "google_sheets", "site", "indicacao", "captacao_corretor",
        "whatsapp", "telefone", "plantao", "agendamento_self_service", "chatbot", "outro"
      ]).default("captacao_corretor"),
      projectId: z.number().optional(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return await db.createLead({
        ...input,
        corretorId: ctx.user.id,
        status: "em_atendimento",
      });
    }),

  update: corretorProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        nome: z.string().optional(),
        email: z.string().email().optional(),
        telefone: z.string().optional(),
        origem: z.string().optional(),
        projectId: z.number().optional(),
        status: z.enum([
          "novo", "aguardando_atendimento", "em_atendimento",
          "qualificado", "agendado", "visita_realizada",
          "proposta_enviada", "analise_credito", "contrato_fechado",
          "pos_venda", "perdido",
        ]).optional(),
        observacoes: z.string().optional(),
        motivoPerdido: z.string().optional(),
        motivoPerdaCategoria: z.string().max(50).optional(),
        proximoFollowup: z.date().optional(),
        ultimoContato: z.date().optional(),
        // Fase 2 — Temperatura e qualificação financeira
        temperatura: z.enum(["quente", "morno", "frio"]).nullable().optional(),
        rendaInformada: z.string().nullable().optional(),
        usaFgts: z.boolean().nullable().optional(),
        entradaDisponivel: z.string().nullable().optional(),
        dataNascimento: z.date().nullable().optional(),
        cpf: z.string().nullable().optional(),
      })
    }))
    .mutation(async ({ input, ctx }) => {
      const lead = await db.getLeadById(input.id);

      if (!lead) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
      }

      if (ctx.user.role === 'corretor' && lead.corretorId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
      }

      if (input.data.status && input.data.status !== lead.status && lead.corretorId) {
        await db.registrarAtividadePorStatus(
          lead.id,
          lead.corretorId,
          lead.status,
          input.data.status,
          undefined
        );
      }

      if (input.data.status === 'em_atendimento' && lead.status !== 'em_atendimento') {
        await db.criarFollowUpParaLead(input.id, lead.corretorId || ctx.user.id);
      }

      if (input.data.status && input.data.status !== 'aguardando_atendimento' && lead.timerAtivo) {
        input.data = { ...input.data, timerAtivo: false } as typeof input.data;
      }

      if (input.data.status && input.data.status !== 'em_atendimento' && lead.status === 'em_atendimento') {
        await db.cancelarFollowUpsPendentes(input.id);
      }

      if (input.data.status === 'perdido') {
        console.log(`[updateLead] Lead ${input.id} marcado como perdido. Status anterior: ${lead.status}, Corretor: ${lead.corretorId}`);

        const corretoresQueTentaram = lead.corretoresQueTentaram ? JSON.parse(lead.corretoresQueTentaram) : [];
        if (lead.corretorId && !corretoresQueTentaram.includes(lead.corretorId)) {
          corretoresQueTentaram.push(lead.corretorId);
        }
        console.log(`[updateLead] Corretores que já tentaram: ${JSON.stringify(corretoresQueTentaram)}`);

        const proximoCorretor = await db.getProximoCorretorDisponivel(corretoresQueTentaram);
        console.log(`[updateLead] Próximo corretor encontrado: ${proximoCorretor ? proximoCorretor.name : 'nenhum'}`);

        if (proximoCorretor) {
          if (lead.corretorId) {
            await db.cancelarFollowUpsPorTransferencia(input.id, lead.corretorId);
          }

          await db.updateLead(input.id, {
            ...input.data,
            status: 'aguardando_atendimento',
            corretorId: proximoCorretor.id,
            corretoresQueTentaram: JSON.stringify(corretoresQueTentaram),
          });

          await db.createLeadHistory({
            leadId: input.id,
            corretorId: lead.corretorId || ctx.user.id,
            tipo: 'outro',
            resultado: 'outro',
            observacoes: `Lead transferido automaticamente para ${proximoCorretor.name} após ser marcado como perdido`,
          });

          return { success: true, transferred: true, newCorretor: proximoCorretor.name };
        } else {
          await db.updateLead(input.id, {
            ...input.data,
            naLixeira: true,
            dataMovidoLixeira: new Date(),
            corretorAnteriorId: lead.corretorId,
            corretorId: null,
            corretoresQueTentaram: JSON.stringify(corretoresQueTentaram),
          });
          return { success: true, movedToTrash: true };
        }
      }

      await db.updateLead(input.id, input.data);
      return { success: true };
    }),

  getHistory: corretorProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input, ctx }) => {
      const lead = await db.getLeadById(input.leadId);

      if (!lead) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
      }

      if (ctx.user.role === 'corretor' && lead.corretorId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
      }

      return await db.getLeadHistory(input.leadId);
    }),

  addInteraction: corretorProcedure
    .input(z.object({
      leadId: z.number(),
      tipo: z.enum(["ligacao", "whatsapp", "email", "sms", "visita", "outro"]),
      resultado: z.enum([
        "contato_realizado", "nao_atendeu", "agendamento", "visita_realizada",
        "proposta_enviada", "recusou", "outro"
      ]),
      observacoes: z.string().optional(),
      statusAnterior: z.string().optional(),
      statusNovo: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const lead = await db.getLeadById(input.leadId);

      if (!lead) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
      }

      if (ctx.user.role === 'corretor') {
        if (!lead.corretorId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Este lead ainda não foi atribuído. Aguarde a distribuição automática ou solicite ao gestor.' });
        }
        if (lead.corretorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Este lead pertence a outro corretor. Você não pode interagir com ele.' });
        }
      }

      const corretorParaInteracao = lead.corretorId || ctx.user.id;

      await db.createLeadHistory({
        leadId: input.leadId,
        corretorId: corretorParaInteracao,
        tipo: input.tipo,
        resultado: input.resultado,
        observacoes: input.observacoes,
        statusAnterior: input.statusAnterior,
        statusNovo: input.statusNovo,
      });

      if (input.tipo === 'ligacao' || input.tipo === 'whatsapp') {
        try {
          await db.createInteracao({
            leadId: input.leadId,
            corretorId: corretorParaInteracao,
            tipo: input.tipo as 'ligacao' | 'whatsapp',
            observacoes: input.observacoes || '',
          });
        } catch (e) {
          console.warn('[addInteraction] Erro ao salvar em interacoes:', e);
        }
      }

      await db.updateLead(input.leadId, {
        ultimoContato: new Date(),
        ultimaInteracao: new Date(),
      });

      return { success: true };
    }),

  transferir: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      novoCorretorId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const lead = await db.getLeadById(input.leadId);

      if (!lead) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
      }

      const novoCorretor = await db.getUserById(input.novoCorretorId);
      if (!novoCorretor || (novoCorretor.role !== 'corretor' && novoCorretor.role !== 'gestor')) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Corretor/Gestor não encontrado' });
      }

      const corretorAnteriorId = lead.corretorId;
      const agora = new Date();

      if (corretorAnteriorId) {
        await db.cancelarFollowUpsPorTransferencia(input.leadId, corretorAnteriorId);
      }

      await db.updateLead(input.leadId, {
        corretorId: input.novoCorretorId,
        status: 'aguardando_atendimento',
        timerAtivo: true,
        timestampRecebimento: agora,
        corretorAnteriorId: corretorAnteriorId ?? undefined,
      });

      await db.criarFollowUpsAutomaticos();

      await db.createLeadHistory({
        leadId: input.leadId,
        corretorId: ctx.user.id,
        tipo: 'outro',
        resultado: 'outro',
        observacoes: `Lead transferido para ${novoCorretor.name}${corretorAnteriorId ? ` (anterior: corretor ID ${corretorAnteriorId})` : ''}`,
      });

      return { success: true, novoCorretor: novoCorretor.name };
    }),

  reatribuir: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      novoCorretorId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const lead = await db.getLeadById(input.leadId);

      if (!lead) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
      }

      const novoCorretor = await db.getUserById(input.novoCorretorId);
      if (!novoCorretor || (novoCorretor.role !== 'corretor' && novoCorretor.role !== 'gestor')) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Corretor/Gestor não encontrado' });
      }

      const corretorAnteriorId = lead.corretorId;
      const statusAtual = lead.status;

      if (corretorAnteriorId) {
        await db.cancelarFollowUpsPorTransferencia(input.leadId, corretorAnteriorId);
      }

      await db.updateLead(input.leadId, {
        corretorId: input.novoCorretorId,
      });

      await db.createLeadHistory({
        leadId: input.leadId,
        corretorId: ctx.user.id,
        tipo: 'outro',
        resultado: 'outro',
        observacoes: `Lead reatribuído para ${novoCorretor.name} (status mantido: ${statusAtual})${corretorAnteriorId ? ` (anterior: corretor ID ${corretorAnteriorId})` : ''}`,
      });

      return { success: true, novoCorretor: novoCorretor.name, statusMantido: statusAtual };
    }),

  transferirEmLote: gestorProcedure
    .input(z.object({
      leadIds: z.array(z.number()),
      novoCorretorId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (input.leadIds.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Nenhum lead selecionado' });
      }

      const novoCorretor = await db.getUserById(input.novoCorretorId);
      if (!novoCorretor || (novoCorretor.role !== 'corretor' && novoCorretor.role !== 'gestor')) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Corretor/Gestor não encontrado' });
      }

      let transferidos = 0;
      let erros = 0;

      for (const leadId of input.leadIds) {
        try {
          const lead = await db.getLeadById(leadId);
          if (!lead) { erros++; continue; }

          const corretorAnteriorId = lead.corretorId;

          if (corretorAnteriorId) {
            await db.cancelarFollowUpsPorTransferencia(leadId, corretorAnteriorId);
          }

          await db.updateLead(leadId, {
            corretorId: input.novoCorretorId,
            status: 'aguardando_atendimento',
            timerAtivo: true,
            timestampRecebimento: new Date(),
            corretorAnteriorId: corretorAnteriorId ?? undefined,
          });

          await db.createLeadHistory({
            leadId,
            corretorId: ctx.user.id,
            tipo: 'outro',
            resultado: 'outro',
            observacoes: `Lead transferido em lote para ${novoCorretor.name}${corretorAnteriorId ? ` (anterior: corretor ID ${corretorAnteriorId})` : ''}`,
          });

          transferidos++;
        } catch (error) {
          console.error(`Erro ao transferir lead ${leadId}:`, error);
          erros++;
        }
      }

      await db.criarFollowUpsAutomaticos();

      return { success: true, transferidos, erros, novoCorretor: novoCorretor.name };
    }),

  atribuirCorretor: gestorProcedure
    .input(z.object({
      leadId: z.number(),
      corretorId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const lead = await db.getLeadById(input.leadId);

      if (!lead) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
      }

      const corretor = await db.getUserById(input.corretorId);
      if (!corretor || (corretor.role !== 'corretor' && corretor.role !== 'gestor')) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Corretor/Gestor não encontrado' });
      }

      const novoStatus = lead.status === 'novo' ? 'aguardando_atendimento' : lead.status;
      const deveAtivarTimer = novoStatus === 'aguardando_atendimento';

      await db.updateLead(input.leadId, {
        corretorId: input.corretorId,
        status: novoStatus,
        ...(deveAtivarTimer ? { timerAtivo: true, timestampRecebimento: new Date() } : {}),
      });

      await db.criarFollowUpsAutomaticos();

      await db.createLeadHistory({
        leadId: input.leadId,
        corretorId: input.corretorId,
        tipo: 'outro',
        resultado: 'outro',
        observacoes: `Lead atribuído manualmente pelo gestor`,
      });

      return { success: true, corretor: corretor.name };
    }),

  delete: gestorProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const lead = await db.getLeadById(input.id);

      if (!lead) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
      }

      await db.deleteLead(input.id);
      return { success: true };
    }),

  deleteMany: gestorProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      let deleted = 0;
      for (const id of input.ids) {
        try {
          await db.deleteLead(id);
          deleted++;
        } catch (e) {
          console.warn('[deleteMany] Erro ao deletar lead:', e);
        }
      }
      return { success: true, deleted };
    }),

  // Altera status de múltiplos leads de uma vez (apenas gestores)
  bulkUpdateStatus: gestorProcedure
    .input(z.object({
      ids: z.array(z.number()).min(1, 'Selecione pelo menos 1 lead'),
      novoStatus: z.enum([
        'aguardando_atendimento', 'em_atendimento',
        'qualificado', 'agendado', 'visita_realizada',
        'proposta_enviada', 'analise_credito', 'contrato_fechado',
        'pos_venda', 'perdido',
      ]),
    }))
    .mutation(async ({ input, ctx }) => {
      return await db.bulkUpdateLeadStatus(input.ids, input.novoStatus, ctx.user.id);
    }),

  getLixeira: gestorProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      return await db.getLeadsNaLixeira(input?.page || 1, input?.limit || 50);
    }),

  countLixeira: gestorProcedure
    .query(async () => {
      return await db.countLeadsNaLixeira();
    }),

  exportCSV: adminExportProcedure
    .input(z.object({
      status: z.string().optional(),
      corretorId: z.number().optional(),
      projectId: z.number().optional(),
      naLixeira: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      return await db.getLeadsParaExportar(input);
    }),

  // ============================================================================
  // MODO BLITZ — FOCO EM LIGAÇÕES
  // ============================================================================
  getLeadsParaBlitz: corretorProcedure
    .input(z.object({
      filtro: z.enum(['todos', 'aguardando', 'em_atendimento', 'agendado', 'follow_up_hoje']).default('todos'),
      projectId: z.number().optional(),
      limit: z.number().min(1).max(200).default(100),
    }).optional())
    .query(async ({ ctx, input }) => {
      return await db.getLeadsParaBlitz(ctx.user.id, input || {});
    }),

  registrarInteracaoBlitz: corretorProcedure
    .input(z.object({
      leadId: z.number(),
      tipo: z.enum(['ligacao', 'whatsapp', 'email', 'sms', 'outro']),
      resultado: z.enum(['contato_realizado', 'nao_atendeu', 'agendamento', 'visita_realizada', 'proposta_enviada', 'recusou', 'outro']),
      observacoes: z.string().optional(),
      novoStatus: z.enum([
        'novo', 'aguardando_atendimento', 'em_atendimento',
        'qualificado', 'agendado', 'visita_realizada',
        'proposta_enviada', 'analise_credito', 'contrato_fechado',
        'pos_venda', 'perdido',
      ]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const lead = await db.getLeadById(input.leadId);
      if (!lead) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
      if (ctx.user.role === 'corretor' && lead.corretorId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
      }
      await db.createLeadHistory({
        leadId: input.leadId,
        corretorId: ctx.user.id,
        tipo: input.tipo,
        resultado: input.resultado,
        observacoes: input.observacoes,
        statusAnterior: lead.status,
        statusNovo: input.novoStatus || lead.status,
      });
      if (input.novoStatus && input.novoStatus !== lead.status) {
        await db.updateLead(input.leadId, { status: input.novoStatus });
        if (input.novoStatus === 'em_atendimento' && lead.status !== 'em_atendimento') {
          await db.criarFollowUpParaLead(input.leadId, ctx.user.id);
        }
      }
      return { success: true };
    }),

  salvarSessaoBlitz: protectedProcedure
    .input(z.object({
      tipoBloco: z.enum(['ligacoes', 'follow_up']),
      iniciadaEm: z.date(),
      encerradaEm: z.date(),
      duracaoMinutos: z.number().int().min(0),
      totalLeads: z.number().int().min(0),
      totalAtendimentos: z.number().int().min(0),
      totalNaoAtendimentos: z.number().int().min(0),
      totalAgendamentos: z.number().int().min(0),
      taxaAtendimentoPct: z.number().min(0).max(100),
      mediaMinPorLead: z.number().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const drizzleDb = await db.getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });
      await drizzleDb.insert(blitzSessoes).values({
        corretorId: ctx.user.id,
        tipoBloco: input.tipoBloco,
        iniciadaEm: input.iniciadaEm,
        encerradaEm: input.encerradaEm,
        duracaoMinutos: input.duracaoMinutos,
        totalLeads: input.totalLeads,
        totalAtendimentos: input.totalAtendimentos,
        totalNaoAtendimentos: input.totalNaoAtendimentos,
        totalAgendamentos: input.totalAgendamentos,
        taxaAtendimentoPct: String(input.taxaAtendimentoPct.toFixed(2)),
        mediaMinPorLead: String(input.mediaMinPorLead.toFixed(2)),
      });
      return { success: true };
    }),

  listarSessoesBlitz: protectedProcedure
    .input(z.object({
      corretorId: z.number().optional(),
      limite: z.number().int().min(1).max(100).default(30),
    }).optional())
    .query(async ({ ctx, input }) => {
      const drizzleDb = await db.getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });
      const targetId = (input?.corretorId && ctx.user.role !== 'corretor')
        ? input.corretorId
        : ctx.user.id;
      const rows = await drizzleDb
        .select()
        .from(blitzSessoes)
        .where(eq(blitzSessoes.corretorId, targetId))
        .orderBy(desc(blitzSessoes.iniciadaEm))
        .limit(input?.limite ?? 30);
      return rows;
    }),
});
