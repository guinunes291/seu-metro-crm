import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";

// ============================================================================
// HELPERS E MIDDLEWARES
// ============================================================================
function isAdminLevel(role: string): boolean {
  return role === 'admin' || role === 'superintendente';
}
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isAdminLevel(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem acessar' });
  }
  return next({ ctx });
});

// ============================================================================
// ROUTER DE CONSTRUTORAS
// ============================================================================
export const construtorasRouter = router({
    // Listar construtoras (público)
    list: publicProcedure
      .input(z.object({
        apenasAtivas: z.boolean().optional().default(true),
      }))
      .query(async ({ input }) => {
        const { construtoras } = await import('../../drizzle/schema');
        const { getDb } = await import('../../server/db');
        const { eq } = await import('drizzle-orm');

        const db = await getDb();
        if (!db) return [];

        if (input.apenasAtivas) {
          return db.select().from(construtoras).where(eq(construtoras.ativo, 1));
        }
        return db.select().from(construtoras);
      }),

    // Listar construtoras com projetos (para filtro)
    listWithProjects: publicProcedure
      .query(async () => {
        const { construtoras, projects } = await import('../../drizzle/schema');
        const { getDb } = await import('../../server/db');
        const { eq, isNotNull, sql } = await import('drizzle-orm');

        const db = await getDb();
        if (!db) return [];

        // Buscar construtoras que têm pelo menos 1 projeto associado
        const result = await db
          .select({
            id: construtoras.id,
            nome: construtoras.nome,
            logoUrl: construtoras.logoUrl,
            totalProjetos: sql<number>`COUNT(${projects.id})`,
          })
          .from(construtoras)
          .leftJoin(projects, eq(projects.construtoraId, construtoras.id))
          .where(isNotNull(projects.id))
          .groupBy(construtoras.id, construtoras.nome, construtoras.logoUrl)
          .orderBy(construtoras.nome);

        return result;
      }),

    // Criar construtora (apenas admin)
    create: adminProcedure
      .input(z.object({
        nome: z.string().min(1),
        logoUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { construtoras } = await import('../../drizzle/schema');
        const { getDb } = await import('../../server/db');

        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Banco de dados indisponível' });

        const [result] = await db.insert(construtoras).values({
          nome: input.nome,
          logoUrl: input.logoUrl,
          ativo: 1,
        }).$returningId();

        return { id: result.id };
      }),

    // Atualizar construtora (apenas admin)
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        nome: z.string().optional(),
        logoUrl: z.string().optional(),
        ativo: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { construtoras } = await import('../../drizzle/schema');
        const { getDb } = await import('../../server/db');
        const { eq } = await import('drizzle-orm');

        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Banco de dados indisponível' });

        const { id, ...data } = input;

        await db.update(construtoras)
          .set(data)
          .where(eq(construtoras.id, id));

        return { success: true };
      }),
});
