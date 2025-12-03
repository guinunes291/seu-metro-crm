import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";

// ============================================================================
// HELPERS E MIDDLEWARES
// ============================================================================

const corretorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'corretor' && ctx.user.role !== 'gestor' && ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
  }
  return next({ ctx });
});

const gestorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'gestor' && ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas gestores podem acessar' });
  }
  return next({ ctx });
});

// ============================================================================
// ROUTER PRINCIPAL
// ============================================================================

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============================================================================
  // PROJETOS (EMPREENDIMENTOS)
  // ============================================================================
  
  projects: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllProjects();
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getProjectById(input.id);
      }),
    
    create: gestorProcedure
      .input(z.object({
        nome: z.string(),
        construtora: z.string().optional(),
        endereco: z.string().optional(),
        bairro: z.string().optional(),
        cidade: z.string().default("São Paulo"),
        estado: z.string().default("SP"),
        zona: z.string().optional(),
        descricao: z.string().optional(),
        tipo: z.enum(["mcmv", "sfh", "outro"]).default("mcmv"),
        status: z.enum(["ativo", "inativo", "esgotado"]).default("ativo"),
        valorMinimo: z.number().optional(),
        valorMaximo: z.number().optional(),
        metragemMinima: z.number().optional(),
        metragemMaxima: z.number().optional(),
        dormitorios: z.string().optional(),
        vagas: z.boolean().default(false),
        imagemPrincipal: z.string().optional(),
        imagensAdicionais: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createProject(input);
      }),
    
    update: gestorProcedure
      .input(z.object({
        id: z.number(),
        data: z.object({
          nome: z.string().optional(),
          construtora: z.string().optional(),
          endereco: z.string().optional(),
          bairro: z.string().optional(),
          cidade: z.string().optional(),
          estado: z.string().optional(),
          zona: z.string().optional(),
          descricao: z.string().optional(),
          tipo: z.enum(["mcmv", "sfh", "outro"]).optional(),
          status: z.enum(["ativo", "inativo", "esgotado"]).optional(),
          valorMinimo: z.number().optional(),
          valorMaximo: z.number().optional(),
          metragemMinima: z.number().optional(),
          metragemMaxima: z.number().optional(),
          dormitorios: z.string().optional(),
          vagas: z.boolean().optional(),
          imagemPrincipal: z.string().optional(),
          imagensAdicionais: z.string().optional(),
        })
      }))
      .mutation(async ({ input }) => {
        await db.updateProject(input.id, input.data);
        return { success: true };
      }),
    
    delete: gestorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProject(input.id);
        return { success: true };
      }),
  }),

  // ============================================================================
  // LEADS
  // ============================================================================
  
  leads: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      // Gestor vê todos os leads
      if (ctx.user.role === 'gestor' || ctx.user.role === 'admin') {
        return await db.getAllLeads();
      }
      // Corretor vê apenas seus leads
      return await db.getLeadsByCorretor(ctx.user.id);
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const lead = await db.getLeadById(input.id);
        
        if (!lead) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
        }
        
        // Corretor só pode ver seus próprios leads
        if (ctx.user.role === 'corretor' && lead.corretorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
        }
        
        return lead;
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
          "novo",
          "aguardando_atendimento",
          "em_atendimento",
          "agendado",
          "visita_realizada",
          "analise_credito",
          "contrato_fechado",
          "perdido"
        ]).default("novo"),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createLead(input);
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
            "novo",
            "aguardando_atendimento",
            "em_atendimento",
            "agendado",
            "visita_realizada",
            "analise_credito",
            "contrato_fechado",
            "perdido"
          ]).optional(),
          observacoes: z.string().optional(),
          motivoPerdido: z.string().optional(),
          proximoFollowup: z.date().optional(),
          ultimoContato: z.date().optional(),
        })
      }))
      .mutation(async ({ input, ctx }) => {
        const lead = await db.getLeadById(input.id);
        
        if (!lead) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
        }
        
        // Corretor só pode atualizar seus próprios leads
        if (ctx.user.role === 'corretor' && lead.corretorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
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
        
        // Corretor só pode ver histórico dos seus leads
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
          "contato_realizado",
          "nao_atendeu",
          "agendamento",
          "visita_realizada",
          "proposta_enviada",
          "recusou",
          "outro"
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
        
        // Corretor só pode adicionar interação aos seus leads
        if (ctx.user.role === 'corretor' && lead.corretorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
        }
        
        // Registrar interação
        await db.createLeadHistory({
          ...input,
          corretorId: ctx.user.id,
        });
        
        // Atualizar último contato do lead
        await db.updateLead(input.leadId, {
          ultimoContato: new Date(),
        });
        
        return { success: true };
      }),
  }),

  // ============================================================================
  // CORRETORES
  // ============================================================================
  
  corretores: router({
    list: gestorProcedure.query(async () => {
      return await db.getAllCorretores();
    }),
    
    updateStatus: corretorProcedure
      .input(z.object({
        status: z.enum(["presente", "ausente"])
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateUserStatus(ctx.user.id, input.status);
        return { success: true };
      }),
    
    getStats: corretorProcedure
      .input(z.object({
        corretorId: z.number().optional(),
        projectId: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const corretorId = input.corretorId ?? ctx.user.id;
        
        // Corretor só pode ver suas próprias stats
        if (ctx.user.role === 'corretor' && corretorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
        }
        
        return await db.getConversionStats(corretorId, input.projectId);
      }),
  }),

  // ============================================================================
  // DISTRIBUIÇÃO
  // ============================================================================
  
  distribution: router({
    getNaoDistribuidos: gestorProcedure.query(async () => {
      return await db.getLeadsNaoDistribuidos();
    }),
    
    distribuirManual: gestorProcedure
      .input(z.object({
        leadId: z.number(),
        corretorId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Atualizar lead
        await db.updateLead(input.leadId, {
          corretorId: input.corretorId,
          dataDistribuicao: new Date(),
          status: "aguardando_atendimento",
        });
        
        // Registrar log
        await db.createDistributionLog({
          leadId: input.leadId,
          corretorId: input.corretorId,
          tipo: "manual",
          motivo: "Distribuição manual pelo gestor",
          distribuidoPorId: ctx.user.id,
        });
        
        return { success: true };
      }),
    
    getHistory: gestorProcedure
      .input(z.object({
        corretorId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getDistributionHistory(input.corretorId);
      }),
  }),

  // ============================================================================
  // MENSAGENS PRONTAS
  // ============================================================================
  
  quickMessages: router({
    list: corretorProcedure.query(async ({ ctx }) => {
      return await db.getQuickMessages(ctx.user.id);
    }),
    
    create: corretorProcedure
      .input(z.object({
        titulo: z.string(),
        mensagem: z.string(),
        tipo: z.enum(["whatsapp", "email", "sms"]),
        ordem: z.number().default(0),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.createQuickMessage({
          ...input,
          corretorId: ctx.user.id,
        });
      }),
  }),
});

export type AppRouter = typeof appRouter;
