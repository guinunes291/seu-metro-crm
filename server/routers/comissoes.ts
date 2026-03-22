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
        usuarioId: (ctx.user.role === 'admin' || ctx.user.role === 'superintendente') ? undefined : ctx.user.id,
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
  
  // Listar contratos para select de importação
  listarContratos: protectedProcedure.query(async () => {
    return await db.listarContratosParaComissao();
  }),

  // Listar usuários para select de importação
  listarUsuarios: protectedProcedure.query(async () => {
    return await db.listarUsuariosParaComissao();
  }),

  // Listar comissões da imobiliária por contrato (admin only)
  listarImobiliaria: adminProcedure.query(async () => {
    return await db.getComissoesImobiliaria();
  }),

  // Importar comissão manual
  importarManual: adminProcedure
    .input(z.object({
      contratoId: z.number(),
      usuarioId: z.number(),
      tipo: z.enum(['corretor', 'gerente', 'superintendente']),
      valorBase: z.number(),
      percentual: z.number(),
      valorComissao: z.number(),
      percentualDesconto: z.number(),
      valorLiquido: z.number(),
      status: z.enum(['pendente_assinatura', 'a_pagar', 'paga']),
    }))
    .mutation(async ({ input }) => {
      return await db.importarComissaoManual(input);
    }),

  // Atualizar status de recebimento da imobiliária (admin only)
  atualizarStatusImobiliaria: adminProcedure
    .input(z.object({
      contratoId: z.number(),
      status: z.enum(['pendente', 'recebido', 'em_disputa']),
      dataRecebimento: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      return await db.atualizarStatusRecebimentoImobiliaria(
        input.contratoId,
        input.status,
        input.dataRecebimento,
      );
    }),

  // Gerar comissões em lote para contratos sem comissões (admin only)
  gerarEmLote: adminProcedure
    .mutation(async () => {
      return await db.gerarComissoesEmLote();
    }),
});
