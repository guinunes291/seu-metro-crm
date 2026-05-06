import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import * as db from '../db';
import { TRPCError } from '@trpc/server';

function isAdminLevel(role: string) {
  return role === 'admin' || role === 'superintendente';
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isAdminLevel(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem gerenciar scripts' });
  }
  return next({ ctx });
});

const CATEGORIAS = [
  'primeiro_contato', 'agendamento', 'pos_visita',
  'objecao_preco', 'objecao_documentacao', 'objecao_credito',
  'nao_compareceu', 'reativacao', 'fechamento', 'outro',
] as const;

const TIPOS = ['whatsapp', 'telefone', 'email'] as const;

export const scriptsRouter = router({
  // Listar scripts (todos os usuários autenticados)
  list: protectedProcedure
    .input(z.object({
      categoria: z.enum(CATEGORIAS).optional(),
      tipo: z.enum(TIPOS).optional(),
      incluirInativos: z.boolean().optional().default(false),
    }).optional())
    .query(async ({ input }) => {
      return await db.getScriptsVendas({
        categoria: input?.categoria,
        tipo: input?.tipo,
        ativo: input?.incluirInativos ? undefined : true,
      });
    }),

  // Criar script (apenas admin/superintendente)
  create: adminProcedure
    .input(z.object({
      titulo: z.string().min(3).max(150),
      conteudo: z.string().min(10),
      categoria: z.enum(CATEGORIAS),
      tipo: z.enum(TIPOS).default('whatsapp'),
      ordem: z.number().default(0),
    }))
    .mutation(async ({ input, ctx }) => {
      return await db.createScriptVendas({ ...input, criadoPorId: ctx.user.id });
    }),

  // Atualizar script (apenas admin/superintendente)
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      titulo: z.string().min(3).max(150).optional(),
      conteudo: z.string().min(10).optional(),
      categoria: z.enum(CATEGORIAS).optional(),
      tipo: z.enum(TIPOS).optional(),
      ativo: z.boolean().optional(),
      ordem: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return await db.updateScriptVendas(id, data);
    }),

  // Deletar script (apenas admin)
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return await db.deleteScriptVendas(input.id);
    }),
});
