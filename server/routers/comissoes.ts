import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../_core/trpc';
import * as db from '../db';

export const comissoesRouter = router({
  // Listar comissões (corretor vê apenas as suas, admin vê todas)
  listar: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      tipo: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return await db.getComissoes({
        usuarioId: ctx.user.role === 'admin' ? undefined : ctx.user.id,
        status: input?.status,
        tipo: input?.tipo,
      });
    }),
  
  // Marcar comissão como paga (admin only)
  marcarComoPaga: adminProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input }) => {
      return await db.marcarComissaoComoPaga(input.id);
    }),
  
  // Aplicar desconto de NF (admin only)
  aplicarDescontoNF: adminProcedure
    .input(z.object({
      id: z.number(),
      percentualDesconto: z.number().min(0).max(100),
    }))
    .mutation(async ({ input }) => {
      return await db.aplicarDescontoComissao(input.id, input.percentualDesconto);
    }),
});
