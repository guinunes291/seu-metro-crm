import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import * as db from '../db';
import { TRPCError } from '@trpc/server';
import { objecoesPlaybook } from '../../drizzle/schema';
import { eq, and, like, or } from 'drizzle-orm';

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
  // ── OBJEÇÕES DO PLAYBOOK ──
  listObjecoes: protectedProcedure
    .input(z.object({
      faseSlug: z.string().optional(),
      busca: z.string().optional(),
      tipoObjecao: z.string().optional(),
      temperatura: z.enum(['quente', 'morno', 'frio']).optional(),
    }).optional())
    .query(async ({ input }) => {
      const drizzleDb = await db.getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });
      
      const conditions: ReturnType<typeof eq>[] = [eq(objecoesPlaybook.ativo, true)];
      
      if (input?.faseSlug) {
        conditions.push(eq(objecoesPlaybook.faseSlug, input.faseSlug));
      }
      if (input?.tipoObjecao) {
        conditions.push(eq(objecoesPlaybook.tipoObjecao, input.tipoObjecao) as any);
      }
      if (input?.temperatura) {
        conditions.push(eq(objecoesPlaybook.temperatura, input.temperatura) as any);
      }
      if (input?.busca && input.busca.trim()) {
        const termo = `%${input.busca.trim()}%`;
        conditions.push(
          or(
            like(objecoesPlaybook.frase, termo),
            like(objecoesPlaybook.situacao, termo),
            like(objecoesPlaybook.msgWhatsapp, termo),
            like(objecoesPlaybook.objetivo, termo),
          ) as any
        );
      }
      
      return await drizzleDb
        .select()
        .from(objecoesPlaybook)
        .where(and(...conditions))
        .orderBy(objecoesPlaybook.ordem);
    }),

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
