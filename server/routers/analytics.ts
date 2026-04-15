import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";

// ============================================================================
// HELPERS E MIDDLEWARES
// ============================================================================
function isGestorLevel(role: string): boolean {
  return role === 'gestor' || role === 'admin' || role === 'superintendente';
}
function isAdminLevel(role: string): boolean {
  return role === 'admin' || role === 'superintendente';
}
const gestorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isGestorLevel(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas gestores podem acessar' });
  }
  return next({ ctx });
});

// ============================================================================
// ROUTER DE ANALYTICS
// ============================================================================
export const analyticsRouter = router({
    // Funil de Conversão Geral
    funilConversao: gestorProcedure
      .input(z.object({
        dataInicio: z.date().optional(),
        dataFim: z.date().optional()
      }))
      .query(async ({ input }) => {
        return await db.getFunilConversaoGeral(input.dataInicio, input.dataFim);
      }),

    // Taxa de Conversão por Corretor
    taxaConversaoPorCorretor: gestorProcedure
      .input(z.object({
        dataInicio: z.date().optional(),
        dataFim: z.date().optional()
      }))
      .query(async ({ input }) => {
        return await db.getTaxaConversaoPorCorretor(input.dataInicio, input.dataFim);
      }),

    // Tempo Médio por Etapa
    tempoMedioPorEtapa: gestorProcedure
      .input(z.object({
        dataInicio: z.date().optional(),
        dataFim: z.date().optional()
      }))
      .query(async ({ input }) => {
        return await db.getTempoMedioPorEtapa(input.dataInicio, input.dataFim);
      }),

    // Evolução de Vendas (VGV)
    evolucaoVendas: gestorProcedure
      .input(z.object({
        dataInicio: z.date(),
        dataFim: z.date(),
        agrupamento: z.enum(['dia', 'semana', 'mes']).default('dia')
      }))
      .query(async ({ input }) => {
        return await db.getEvolucaoVendas(input.dataInicio, input.dataFim, input.agrupamento);
      }),

    // Distribuição de Vendas por Projeto
    distribuicaoVendasPorProjeto: gestorProcedure
      .input(z.object({
        dataInicio: z.date().optional(),
        dataFim: z.date().optional()
      }))
      .query(async ({ input }) => {
        return await db.getDistribuicaoVendasPorProjeto(input.dataInicio, input.dataFim);
      }),

    // Origem de Leads mais Efetiva
    origemLeadsMaisEfetiva: gestorProcedure
      .input(z.object({
        dataInicio: z.date().optional(),
        dataFim: z.date().optional()
      }))
      .query(async ({ input }) => {
        return await db.getOrigemLeadsMaisEfetiva(input.dataInicio, input.dataFim);
      }),

    // Leads por Horário de Entrada
    leadsPorHorarioEntrada: gestorProcedure
      .input(z.object({
        dataInicio: z.date().optional(),
        dataFim: z.date().optional()
      }))
      .query(async ({ input }) => {
        return await db.getLeadsPorHorarioEntrada(input.dataInicio, input.dataFim);
      }),

    // Ranking de Corretores
    rankingCorretores: gestorProcedure
      .input(z.object({
        dataInicio: z.date().optional(),
        dataFim: z.date().optional()
      }))
      .query(async ({ input }) => {
        return await db.getRankingCorretoresCompleto(input.dataInicio, input.dataFim);
      }),

    // Produtividade por Corretor
    produtividadePorCorretor: gestorProcedure
      .input(z.object({
        dataInicio: z.date().optional(),
        dataFim: z.date().optional()
      }))
      .query(async ({ input }) => {
        return await db.getProdutividadePorCorretor(input.dataInicio, input.dataFim);
      }),

    // Comparativo Mensal de Corretores
    comparativoMensalCorretores: gestorProcedure
      .input(z.object({
        anoInicio: z.number(),
        anoFim: z.number()
      }))
      .query(async ({ input }) => {
        return await db.getComparativoMensalCorretores(input.anoInicio, input.anoFim);
      }),

    // Carga de Trabalho
    cargaTrabalho: gestorProcedure
      .query(async () => {
        return await db.getCargaTrabalho();
      }),

    // Previsão de Vendas
    previsaoVendas: gestorProcedure
      .query(async () => {
        return await db.getPrevisaoVendas();
      }),
});
