import { z } from 'zod';
import { router, protectedProcedure, gestorProcedure } from '../_core/trpc';
import * as db from '../db';
import {
  linksUteis as linksUteisTable,
  acessosLinksUteis as acessosLinksUteisTable,
  users,
} from '../../drizzle/schema';
import { and, eq, desc, asc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

function isAdminLevel(role: string) {
  return role === 'admin' || role === 'superintendente';
}

function isGestorLevel(role: string) {
  return role === 'gestor' || role === 'admin' || role === 'superintendente';
}

export const linksUteisRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const hasPermission = (ctx.user as any).acessaLinksUteis === true || isGestorLevel(ctx.user.role);
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para acessar Links Úteis' });
      }

      const drizzleDb = await db.getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });

      return drizzleDb
        .select()
        .from(linksUteisTable)
        .where(eq(linksUteisTable.status, 'ativo'))
        .orderBy(asc(linksUteisTable.categoria), asc(linksUteisTable.titulo));
    }),

  registrarAcesso: protectedProcedure
    .input(z.object({ linkId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const drizzleDb = await db.getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });

      await drizzleDb.insert(acessosLinksUteisTable).values({
        linkId: input.linkId,
        corretorId: ctx.user.id,
      });

      return { success: true };
    }),

  adminList: gestorProcedure
    .query(async () => {
      const drizzleDb = await db.getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });

      return drizzleDb
        .select()
        .from(linksUteisTable)
        .orderBy(asc(linksUteisTable.categoria), asc(linksUteisTable.titulo));
    }),

  create: gestorProcedure
    .input(z.object({
      titulo: z.string().min(1, 'Título obrigatório'),
      descricao: z.string().max(500).optional(),
      url: z.string().url('URL inválida'),
      categoria: z.string().min(1, 'Categoria obrigatória'),
      status: z.enum(['ativo', 'inativo']).default('ativo'),
    }))
    .mutation(async ({ ctx, input }) => {
      const drizzleDb = await db.getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });

      const [result] = await drizzleDb.insert(linksUteisTable).values({
        titulo: input.titulo,
        descricao: input.descricao,
        url: input.url,
        categoria: input.categoria,
        status: input.status,
        criadoPorId: ctx.user.id,
      });

      return { id: (result as any).insertId };
    }),

  update: gestorProcedure
    .input(z.object({
      id: z.number(),
      titulo: z.string().min(1).optional(),
      descricao: z.string().max(500).nullable().optional(),
      url: z.string().url().optional(),
      categoria: z.string().min(1).optional(),
      status: z.enum(['ativo', 'inativo']).optional(),
    }))
    .mutation(async ({ input }) => {
      const drizzleDb = await db.getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });

      const { id, ...data } = input;
      await drizzleDb
        .update(linksUteisTable)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(linksUteisTable.id, id));

      return { success: true };
    }),

  delete: gestorProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const drizzleDb = await db.getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });

      await drizzleDb
        .delete(linksUteisTable)
        .where(eq(linksUteisTable.id, input.id));

      return { success: true };
    }),

  relatorioAcessos: gestorProcedure
    .query(async () => {
      const drizzleDb = await db.getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });

      const rows = await drizzleDb
        .select({
          id: acessosLinksUteisTable.id,
          createdAt: acessosLinksUteisTable.createdAt,
          corretorNome: users.name,
          linkTitulo: linksUteisTable.titulo,
          linkCategoria: linksUteisTable.categoria,
          linkUrl: linksUteisTable.url,
        })
        .from(acessosLinksUteisTable)
        .leftJoin(users, eq(acessosLinksUteisTable.corretorId, users.id))
        .leftJoin(linksUteisTable, eq(acessosLinksUteisTable.linkId, linksUteisTable.id))
        .orderBy(desc(acessosLinksUteisTable.createdAt))
        .limit(200);

      return rows;
    }),
});
