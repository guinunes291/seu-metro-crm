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
});
