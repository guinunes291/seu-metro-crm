import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";

// ============================================================================
// HELPERS E MIDDLEWARES (copiados do routers.ts principal)
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

// ============================================================================
// ROUTER DE AGENDAMENTOS, VISITAS E AGENDAMENTOS GESTOR
// ============================================================================
export const agendamentosVisitasRouter = router({

  // ============================================================================
  // AGENDAMENTOS
  // ============================================================================
  agendamentos: router({
    // Criar novo agendamento
    create: corretorProcedure
      .input(z.object({
        leadId: z.number(),
        projectId: z.number().optional(),
        projetoCustom: z.string().optional(),
        construtora: z.string().optional(),
        dataAgendamento: z.string(), // ISO date string
        horaAgendamento: z.string(), // HH:MM
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verificar se o lead pertence ao corretor (ou se é gestor)
        const lead = await db.getLeadById(input.leadId);
        if (!lead) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
        }
        if (ctx.user.role === 'corretor' && lead.corretorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Este lead não pertence a você' });
        }
        
        // Importar função de timezone
        const { parsearDataISO } = await import('../timezone');
        
        // Verificar duplicação: mesmo lead + mesma data + mesmo horário + status ativo
        const dataAgendamentoParsed = parsearDataISO(input.dataAgendamento);
        const existente = await db.checkAgendamentoDuplicado({
          leadId: input.leadId,
          dataAgendamento: dataAgendamentoParsed,
          horaAgendamento: input.horaAgendamento,
        });
        if (existente) {
          throw new TRPCError({ 
            code: 'CONFLICT', 
            message: 'Já existe um agendamento para este cliente nesta data e horário' 
          });
        }
        
        // Usar o corretorId do lead (dono) para que a pontuação vá para o corretor correto
        const corretorDonoId = lead.corretorId || ctx.user.id;
        const agendamento = await db.createAgendamento({
          leadId: input.leadId,
          corretorId: corretorDonoId,
          projectId: input.projectId,
          projetoCustom: input.projetoCustom,
          construtora: input.construtora,
          dataAgendamento: dataAgendamentoParsed,
          horaAgendamento: input.horaAgendamento,
          observacoes: input.observacoes,
          criadoPorId: ctx.user.id,
        });
        
        // Mudar status do lead para "agendado" automaticamente
        if (lead.status !== 'agendado') {
          await db.updateLead(input.leadId, { status: 'agendado' });
          await db.registrarAlteracaoStatus({
            leadId: input.leadId,
            corretorId: corretorDonoId,
            statusAnterior: lead.status,
            statusNovo: 'agendado',
            observacoes: `Status alterado automaticamente ao criar agendamento para ${input.dataAgendamento} às ${input.horaAgendamento}`
          });
        }
        
        // Sincronizar agendamentos do dia com atividades diárias (não bloquear criação se falhar)
        try {
          await db.sincronizarAgendamentosDoDia();
        } catch (error) {
          console.error('[Agendamento] Erro ao sincronizar métricas:', error);
          // Não propagar erro - agendamento foi criado com sucesso
        }

        // Criar tarefa no Notion (não bloquear se falhar)
        import("../notionService").then(({ tarefaVisitaAgendada }) => {
          tarefaVisitaAgendada({
            leadNome: (lead as any).nome || (lead as any).name || `Lead #${input.leadId}`,
            corretorNome: ctx.user.name || ctx.user.email || "Corretor",
            dataVisita: dataAgendamentoParsed,
            leadId: input.leadId,
          }).catch((err: unknown) => console.error('[Notion] Erro ao criar tarefa de visita agendada:', err));
        }).catch((err: unknown) => console.error('[Notion] Erro ao importar notionService:', err));
        
        return agendamento;
      }),
    
    // Listar agendamentos do corretor
    list: corretorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getAgendamentosCorretor(ctx.user.id, {
          dataInicio: input?.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input?.dataFim ? new Date(input.dataFim) : undefined,
          status: input?.status,
        });
      }),
    
    // Listar todos os agendamentos (gestor/admin - filtrado por equipe)
    listAll: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        corretorId: z.number().optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        // Obter IDs dos corretores para filtro baseado no role
        const { getCorretoresIdsParaFiltro } = await import('../equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        
        return await db.getAllAgendamentos({
          dataInicio: input?.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input?.dataFim ? new Date(input.dataFim) : undefined,
          corretorId: input?.corretorId,
          corretoresIds,
          status: input?.status,
        });
      }),
    
    // Agendamentos do dia
    hoje: corretorProcedure.query(async ({ ctx }) => {
      return await db.getAgendamentosDoDia(ctx.user.id);
    }),
    
    // Agendamentos de um lead
    byLead: corretorProcedure
      .input(z.object({ leadId: z.number() }))
      .query(async ({ input }) => {
        return await db.getAgendamentosLead(input.leadId);
      }),
    
    // Atualizar status do agendamento
    updateStatus: corretorProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['pendente', 'confirmado', 'realizado', 'cancelado', 'reagendado', 'nao_compareceu']), // Fase 2
      }))
      .mutation(async ({ ctx, input }) => {
        // Buscar agendamento para obter leadId
        const agendamento = await db.getAgendamentoById(input.id);
        if (!agendamento) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Agendamento não encontrado' });
        }
        
        // Atualizar status do agendamento
        const resultado = await db.updateAgendamentoStatus(input.id, input.status);
        
        // Se status mudou para "realizado", mudar lead para "visita_realizada" automaticamente
        if (input.status === 'realizado') {
          const lead = await db.getLeadById(agendamento.leadId);
          if (lead && lead.status !== 'visita_realizada') {
            await db.updateLead(agendamento.leadId, { status: 'visita_realizada', timerAtivo: false });
            // Usar corretorId do agendamento (dono do lead) para pontuação correta
            await db.registrarAlteracaoStatus({
              leadId: agendamento.leadId,
              corretorId: agendamento.corretorId || ctx.user.id,
              statusAnterior: lead.status,
              statusNovo: 'visita_realizada',
              observacoes: `Status alterado automaticamente ao marcar agendamento como realizado`
            });
          }
        }
        
        // Fase 2: Se não compareceu, registrar no campo naoCompareceu
        if (input.status === 'nao_compareceu') {
          await db.updateAgendamentoNaoCompareceu(input.id, true);
        }
        
        return resultado;
      }),
    
    // Atualizar agendamento
    update: corretorProcedure
      .input(z.object({
        id: z.number(),
        dataAgendamento: z.string().optional(),
        horaAgendamento: z.string().optional(),
        observacoes: z.string().optional(),
        status: z.enum(['pendente', 'confirmado', 'realizado', 'cancelado', 'reagendado']).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        
        // Buscar agendamento para obter leadId
        const agendamento = await db.getAgendamentoById(id);
        if (!agendamento) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Agendamento não encontrado' });
        }
        
        // Atualizar agendamento
        const resultado = await db.updateAgendamento(id, {
          ...data,
          dataAgendamento: data.dataAgendamento ? new Date(data.dataAgendamento) : undefined,
        });
        
        // Se status mudou para "realizado", mudar lead para "visita_realizada" automaticamente
        if (input.status === 'realizado') {
          const lead = await db.getLeadById(agendamento.leadId);
          if (lead && lead.status !== 'visita_realizada') {
            await db.updateLead(agendamento.leadId, { status: 'visita_realizada', timerAtivo: false });
            // Usar corretorId do agendamento (dono do lead) para pontuação correta
            await db.registrarAlteracaoStatus({
              leadId: agendamento.leadId,
              corretorId: agendamento.corretorId || ctx.user.id,
              statusAnterior: lead.status,
              statusNovo: 'visita_realizada',
              observacoes: `Status alterado automaticamente ao marcar agendamento como realizado`
            });
          }
        }
        
        return resultado;
      }),
    
    // Excluir agendamento
    delete: corretorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteAgendamento(input.id);
      }),
  }),

  // ============================================================================
  // VISITAS
  // ============================================================================
  visitas: router({
    // Criar nova visita
    create: corretorProcedure
      .input(z.object({
        leadId: z.number(),
        agendamentoId: z.number().optional(),
        projectId: z.number().optional(),
        projetoCustom: z.string().optional(),
        construtora: z.string().optional(),
        dataVisita: z.string(), // ISO date string
        horaVisita: z.string().optional(), // HH:MM
        resultado: z.enum(['interesse_alto', 'interesse_medio', 'interesse_baixo', 'sem_interesse', 'pendente_documentacao', 'encaminhado_analise']).optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verificar se o lead pertence ao corretor (ou se é gestor)
        const lead = await db.getLeadById(input.leadId);
        if (!lead) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
        }
        if (ctx.user.role === 'corretor' && lead.corretorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Este lead não pertence a você' });
        }
        
        // Criar registro de visita
        const visita = await db.createVisita({
          leadId: input.leadId,
          corretorId: lead.corretorId || ctx.user.id,
          agendamentoId: input.agendamentoId,
          projectId: input.projectId,
          projetoCustom: input.projetoCustom,
          construtora: input.construtora,
          dataVisita: new Date(input.dataVisita),
          horaVisita: input.horaVisita,
          resultado: input.resultado,
          observacoes: input.observacoes,
          registradoPorId: ctx.user.id,
        });
        
        // Atualizar status do lead para "visita_realizada" automaticamente
        if (lead.status !== 'visita_realizada') {
          await db.updateLead(input.leadId, {
            status: 'visita_realizada',
          });
        }
        
        return visita;
      }),
    
    // Listar visitas do corretor
    list: corretorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getVisitasCorretor(ctx.user.id, {
          dataInicio: input?.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input?.dataFim ? new Date(input.dataFim) : undefined,
        });
      }),
    
    // Listar todas as visitas (gestor/admin - filtrado por equipe)
    listAll: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        corretorId: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        // Obter IDs dos corretores para filtro baseado no role
        const { getCorretoresIdsParaFiltro } = await import('../equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        
        return await db.getAllVisitas({
          dataInicio: input?.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input?.dataFim ? new Date(input.dataFim) : undefined,
          corretorId: input?.corretorId,
          corretoresIds,
        });
      }),
    
    // Visitas de um lead
    byLead: corretorProcedure
      .input(z.object({ leadId: z.number() }))
      .query(async ({ input }) => {
        return await db.getVisitasLead(input.leadId);
      }),
    
    // Atualizar visita
    update: corretorProcedure
      .input(z.object({
        id: z.number(),
        resultado: z.enum(['interesse_alto', 'interesse_medio', 'interesse_baixo', 'sem_interesse', 'pendente_documentacao', 'encaminhado_analise']).optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateVisita(id, data);
      }),
    
    // Excluir visita
    delete: corretorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteVisita(input.id);
      }),
  }),

  // ============================================================================
  // VISÃO CONSOLIDADA DE AGENDAMENTOS (GESTOR)
  // ============================================================================
  agendamentosGestor: router({
    // Listar todos os agendamentos de todos os corretores (filtrado por equipe para gestores)
    listAll: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        corretorId: z.number().optional(),
        status: z.enum(['pendente', 'confirmado', 'realizado', 'cancelado', 'reagendado']).optional()
      }).optional())
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('../equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        
        return await db.getAllAgendamentos({
          ...input,
          corretoresIds
        });
      }),
    
    // Estatísticas de agendamentos
    getStats: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional()
      }).optional())
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('../equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        
        const agendamentos = await db.getAllAgendamentos({
          ...input,
          corretoresIds
        });
        
        const total = agendamentos.length;
        const porStatus = {
          pendente: agendamentos.filter(a => a.status === 'pendente').length,
          confirmado: agendamentos.filter(a => a.status === 'confirmado').length,
          realizado: agendamentos.filter(a => a.status === 'realizado').length,
          cancelado: agendamentos.filter(a => a.status === 'cancelado').length,
          reagendado: agendamentos.filter(a => a.status === 'reagendado').length
        };
        
        // Agrupar por corretor
        const porCorretor: Record<number, { nome: string; total: number; realizados: number }> = {};
        for (const a of agendamentos) {
          if (!a.corretorId) continue;
          if (!porCorretor[a.corretorId]) {
            porCorretor[a.corretorId] = { nome: a.corretorNome || 'Desconhecido', total: 0, realizados: 0 };
          }
          porCorretor[a.corretorId].total++;
          if (a.status === 'realizado') porCorretor[a.corretorId].realizados++;
        }
        
        return {
          total,
          porStatus,
          porCorretor: Object.values(porCorretor)
        };
      }),
    
    // Calendário consolidado (para o gestor ver agendamentos da sua equipe)
    getCalendario: gestorProcedure
      .input(z.object({
        mes: z.number().min(1).max(12),
        ano: z.number()
      }))
      .query(async ({ input, ctx }) => {
        const dataInicio = new Date(input.ano, input.mes - 1, 1);
        const dataFim = new Date(input.ano, input.mes, 0, 23, 59, 59);
        
        console.log('[getCalendario] User:', ctx.user.email, 'Role:', ctx.user.role, 'UserId:', ctx.user.id);
        
        // Filtrar por equipe: gestor vê sua equipe, superintendente vê suas equipes, admin vê tudo
        const { getCorretoresIdsParaFiltro: _getIds } = await import('../equipes');
        const corretoresIds = await _getIds(ctx.user.id, ctx.user.role);
        console.log('[getCalendario] User:', ctx.user.email, 'Role:', ctx.user.role, 'CorretoresIds:', corretoresIds);
        
        console.log('[getCalendario] Buscando agendamentos com filtro:', { dataInicio: dataInicio.toISOString(), dataFim: dataFim.toISOString(), corretoresIds });
        
        const agendamentos = await db.getAllAgendamentos({
          dataInicio: dataInicio.toISOString(),
          dataFim: dataFim.toISOString(),
          corretoresIds
        });
        
        console.log('[getCalendario] Agendamentos retornados:', agendamentos.length, 'agendamentos');
        if (agendamentos.length > 0) {
          console.log('[getCalendario] Primeiros 3 agendamentos:', agendamentos.slice(0, 3).map(a => ({ id: a.id, corretorId: a.corretorId, corretor: a.corretorNome })));
        }
        
        // Agrupar por dia
        const porDia: Record<string, typeof agendamentos> = {};
        for (const a of agendamentos) {
          const dia = new Date(a.dataAgendamento).toISOString().split('T')[0];
          if (!porDia[dia]) porDia[dia] = [];
          porDia[dia].push(a);
        }
        
        return porDia;
      }),
  }),
});

// Exports individuais para montagem direta no appRouter (mantendo os paths originais)
export const agendamentosRouter = agendamentosVisitasRouter._def.record.agendamentos;
export const visitasRouter = agendamentosVisitasRouter._def.record.visitas;
export const agendamentosGestorRouter = agendamentosVisitasRouter._def.record.agendamentosGestor;
