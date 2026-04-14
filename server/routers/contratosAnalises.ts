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
// ROUTER DE CONTRATOS E ANÁLISES DE CRÉDITO
// ============================================================================
export const contratosAnalisesRouter = router({

  // ============================================================================
  // CONTRATOS (FECHAMENTO DE VENDAS)
  // ============================================================================
  contratos: router({
    // Criar novo contrato (fechar venda)
    create: corretorProcedure
      .input(z.object({
        leadId: z.number(),
        projectId: z.number().optional(),
        valorVenda: z.number().positive(),
        dataAssinatura: z.string(), // ISO date string
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
        
        // Criar registro de contrato
        const { getDb } = await import("../db");
        const database = await getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { contratos, leads } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        
        const [contrato] = await database.insert(contratos).values({
          leadId: input.leadId,
          corretorId: lead.corretorId || ctx.user.id,
          valorVenda: input.valorVenda.toString(),
          observacoes: input.observacoes,
          createdAt: new Date(input.dataAssinatura),
        }).$returningId();
        
        // Atualizar status do lead para "contrato_fechado" e desativar timer
        await database
          .update(leads)
          .set({ 
            status: "contrato_fechado",
            ultimaInteracao: new Date(),
            timerAtivo: false,
          })
          .where(eq(leads.id, input.leadId));
        
        // Registrar pontos para o corretor (fechamento de contrato = 150 pontos)
        try {
          const { adicionarVgvDia, calcularPontuacaoDiaria } = await import("../db");
          const corretorIdVenda = lead.corretorId || ctx.user.id;
          await adicionarVgvDia(corretorIdVenda, input.valorVenda);
          await calcularPontuacaoDiaria(corretorIdVenda);
          console.log(`[Contrato] Pontuação registrada para corretor ${corretorIdVenda}: +1000 pts (venda R$ ${input.valorVenda.toLocaleString('pt-BR')})`);
        } catch (error) {
          console.error("Erro ao registrar pontos de venda:", error);
        }
        
        // Criar tarefa no Notion (não bloquear se falhar)
        import("../notionService").then(({ tarefaContratoFechado }) => {
          tarefaContratoFechado({
            leadNome: (lead as any).nome || (lead as any).name || `Lead #${input.leadId}`,
            corretorNome: ctx.user.name || ctx.user.email || "Corretor",
            gestorNome: "Gestor",
            projeto: (lead as any).projetoCustom || undefined,
            valorVenda: input.valorVenda,
            leadId: input.leadId,
          }).catch((err: unknown) => console.error('[Notion] Erro ao criar tarefa de contrato fechado:', err));
        }).catch((err: unknown) => console.error('[Notion] Erro ao importar notionService:', err));

        return { success: true, contratoId: contrato.id };
      }),
    
    // Listar contratos do corretor
    list: corretorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const database = await getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { contratos, leads, projects } = await import("../../drizzle/schema");
        const { eq, and, gte, lte } = await import("drizzle-orm");
        
        const conditions = [eq(contratos.corretorId, ctx.user.id)];
        if (input?.dataInicio) {
          conditions.push(gte(contratos.createdAt, new Date(input.dataInicio)));
        }
        if (input?.dataFim) {
          conditions.push(lte(contratos.createdAt, new Date(input.dataFim)));
        }
        
        return await database
          .select({
            id: contratos.id,
            leadId: contratos.leadId,
            leadNome: leads.nome,
            leadTelefone: leads.telefone,
            valorVenda: contratos.valorVenda,
            observacoes: contratos.observacoes,
            dataAssinatura: contratos.createdAt,
          })
          .from(contratos)
          .leftJoin(leads, eq(contratos.leadId, leads.id))
          .where(and(...conditions));
      }),
    
    // Listar todos os contratos (gestor/admin - filtrado por equipe)
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
        
        const { getDb } = await import("../db");
        const database = await getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { contratos, leads, users } = await import("../../drizzle/schema");
        const { eq, and, gte, lte, inArray } = await import("drizzle-orm");
        
        const conditions: any[] = [];
        // Filtro por equipe (corretoresIds)
        if (corretoresIds && corretoresIds.length > 0) {
          conditions.push(inArray(contratos.corretorId, corretoresIds));
        }
        if (input?.corretorId) {
          conditions.push(eq(contratos.corretorId, input.corretorId));
        }
        if (input?.dataInicio) {
          conditions.push(gte(contratos.createdAt, new Date(input.dataInicio)));
        }
        if (input?.dataFim) {
          conditions.push(lte(contratos.createdAt, new Date(input.dataFim)));
        }
        
        return await database
          .select({
            id: contratos.id,
            leadId: contratos.leadId,
            leadNome: leads.nome,
            leadTelefone: leads.telefone,
            corretorId: contratos.corretorId,
            corretorNome: users.name,
            valorVenda: contratos.valorVenda,
            observacoes: contratos.observacoes,
            dataAssinatura: contratos.createdAt,
          })
          .from(contratos)
          .leftJoin(leads, eq(contratos.leadId, leads.id))
          .leftJoin(users, eq(contratos.corretorId, users.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined);
      }),
  }),

  // ============================================================================
  // ANÁLISES DE CRÉDITO
  // ============================================================================
  analises: router({
    // Criar nova análise de crédito
    create: corretorProcedure
      .input(z.object({
        leadId: z.number(),
        status: z.enum(["enviada", "aprovada", "reprovada", "pendente"]).default("enviada"),
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
        
        // Criar registro de análise de crédito
        const { getDb } = await import("../db");
        const database = await getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { analises_credito, leads } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        
        const [analise] = await database.insert(analises_credito).values({
          leadId: input.leadId,
          corretorId: lead.corretorId || ctx.user.id,
          status: input.status || "enviada",
          observacoes: input.observacoes,
        }).$returningId();
        
        // Atualizar status do lead para "analise_credito" e desativar timer
        await database
          .update(leads)
          .set({ 
            status: "analise_credito",
            ultimaInteracao: new Date(),
            timerAtivo: false,
          })
          .where(eq(leads.id, input.leadId));
        
        // Registrar pontos para o corretor (análise de crédito = 60 pontos)
        try {
          const { incrementarAtividade, calcularPontuacaoDiaria } = await import("../db");
          const corretorIdAnalise = lead.corretorId || ctx.user.id;
          await incrementarAtividade(corretorIdAnalise, 'analiseCreditoEnviadas');
          await calcularPontuacaoDiaria(corretorIdAnalise);
          console.log(`[Análise Crédito] Pontuação registrada para corretor ${corretorIdAnalise}: +60 pts`);
        } catch (error) {
          console.error("Erro ao registrar pontos de análise de crédito:", error);
        }
        
        // Criar tarefa no Notion (não bloquear se falhar)
        import("../notionService").then(({ tarefaAnaliseCredito }) => {
          tarefaAnaliseCredito({
            leadNome: (lead as any).nome || (lead as any).name || `Lead #${input.leadId}`,
            corretorNome: ctx.user.name || ctx.user.email || "Corretor",
            leadId: input.leadId,
            projeto: (lead as any).projetoCustom || undefined,
          }).catch((err: unknown) => console.error('[Notion] Erro ao criar tarefa de análise de crédito:', err));
        }).catch((err: unknown) => console.error('[Notion] Erro ao importar notionService:', err));

        return { success: true, analiseId: analise.id };
      }),
    
    // Listar análises do corretor
    list: corretorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const database = await getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { analises_credito, leads } = await import("../../drizzle/schema");
        const { eq, and, gte, lte } = await import("drizzle-orm");
        
        const conditions = [eq(analises_credito.corretorId, ctx.user.id)];
        if (input?.dataInicio) {
          conditions.push(gte(analises_credito.createdAt, new Date(input.dataInicio)));
        }
        if (input?.dataFim) {
          conditions.push(lte(analises_credito.createdAt, new Date(input.dataFim)));
        }
        
        return await database
          .select({
            id: analises_credito.id,
            leadId: analises_credito.leadId,
            leadNome: leads.nome,
            leadTelefone: leads.telefone,
            status: analises_credito.status,
            observacoes: analises_credito.observacoes,
            dataEnvio: analises_credito.createdAt,
          })
          .from(analises_credito)
          .leftJoin(leads, eq(analises_credito.leadId, leads.id))
          .where(and(...conditions));
      }),
  }),
});

// Exports individuais para montagem direta no appRouter (mantendo os paths originais)
export const contratosRouter = contratosAnalisesRouter._def.record.contratos;
export const analisesRouter = contratosAnalisesRouter._def.record.analises;
