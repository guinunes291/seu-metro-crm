import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, protectedProcedure, gestorProcedure, router } from "./trpc";
import { verificarTransferenciasAutomaticas } from "../transferenciaAutomaticaJob";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  // Endpoint de teste para executar transferência automática manualmente
  executarTransferenciaAutomatica: gestorProcedure
    .mutation(async () => {
      const resultado = await verificarTransferenciasAutomaticas();
      return resultado;
    }),

  // Redistribuir leads em aguardando_atendimento há mais de X dias
  redistribuirLeadsParados: gestorProcedure
    .input(
      z.object({
        diasParado: z.number().min(1).max(30).default(2),
        simular: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { db } = await import("../db");
      const { leads, users } = await import("../../drizzle/schema");
      const { eq, and, lt, sql, ne } = await import("drizzle-orm");
      
      // 1. Buscar leads elegíveis para redistribuição
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - input.diasParado);
      
      const leadsElegiveis = await db
        .select({
          id: leads.id,
          nome: leads.nome,
          corretorId: leads.corretorId,
          dataDistribuicao: leads.dataDistribuicao,
        })
        .from(leads)
        .where(
          and(
            eq(leads.status, "aguardando_atendimento"),
            lt(leads.dataDistribuicao, dataLimite),
            ne(leads.origem, "captacao_corretor") // Não redistribuir leads de captação própria
          )
        );
      
      if (input.simular) {
        // Modo simulação: apenas retornar estatísticas
        const corretoresAfetados = new Set(leadsElegiveis.map(l => l.corretorId)).size;
        return {
          sucesso: true,
          simulacao: true,
          totalLeads: leadsElegiveis.length,
          corretoresAfetados,
          redistribuidos: 0,
          erros: 0,
        };
      }
      
      // 2. Buscar corretores disponíveis para receber leads
      const corretoresDisponiveis = await db
        .select({
          id: users.id,
          name: users.name,
        })
        .from(users)
        .where(eq(users.role, "corretor"));
      
      if (corretoresDisponiveis.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Nenhum corretor disponível para redistribuição",
        });
      }
      
      // 3. Redistribuir leads usando algoritmo round-robin
      let redistribuidos = 0;
      let erros = 0;
      let corretorIndex = 0;
      
      for (const lead of leadsElegiveis) {
        try {
          const novoCorretor = corretoresDisponiveis[corretorIndex];
          
          // Evitar redistribuir para o mesmo corretor
          if (novoCorretor.id === lead.corretorId) {
            corretorIndex = (corretorIndex + 1) % corretoresDisponiveis.length;
            continue;
          }
          
          // Atualizar lead
          await db
            .update(leads)
            .set({
              corretorId: novoCorretor.id,
              dataDistribuicao: new Date(),
            })
            .where(eq(leads.id, lead.id));
          
          redistribuidos++;
          corretorIndex = (corretorIndex + 1) % corretoresDisponiveis.length;
        } catch (error) {
          console.error(`Erro ao redistribuir lead ${lead.id}:`, error);
          erros++;
        }
      }
      
      return {
        sucesso: true,
        simulacao: false,
        totalLeads: leadsElegiveis.length,
        corretoresAfetados: new Set(leadsElegiveis.map(l => l.corretorId)).size,
        redistribuidos,
        erros,
      };
    }),
});
