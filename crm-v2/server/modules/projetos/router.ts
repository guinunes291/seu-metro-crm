import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, asc } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "../../_core/trpc.js";
import { getDb } from "../../_core/db.js";
import { projects, tipologias } from "../../../drizzle/schema/index.js";

export const projetosRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["ativo", "inativo", "esgotado"]).optional(),
      }).default({})
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = input.status ? [eq(projects.status, input.status)] : [];
      return db
        .select()
        .from(projects)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(asc(projects.nome));
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select().from(projects).where(eq(projects.id, input.id)).limit(1);
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
      const tipes = await db
        .select()
        .from(tipologias)
        .where(eq(tipologias.projetoId, input.id))
        .orderBy(asc(tipologias.nome));
      return { ...rows[0], tipologias: tipes };
    }),

  create: adminProcedure
    .input(
      z.object({
        nome: z.string().min(1),
        construtora: z.string().optional(),
        endereco: z.string().optional(),
        bairro: z.string().optional(),
        cidade: z.string().default("São Paulo"),
        estado: z.string().length(2).default("SP"),
        tipo: z.enum(["mcmv", "sfh", "outro"]).default("mcmv"),
        valorMinimo: z.number().min(0).optional(),
        valorMaximo: z.number().min(0).optional(),
        descricao: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.insert(projects).values(input);
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        nome: z.string().optional(),
        status: z.enum(["ativo", "inativo", "esgotado"]).optional(),
        construtora: z.string().optional(),
        descricao: z.string().optional(),
        valorMinimo: z.number().optional(),
        valorMaximo: z.number().optional(),
        linkTabela: z.string().optional(),
        linkBook: z.string().optional(),
        linkDrive: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(projects).set(data).where(eq(projects.id, id));
    }),
});
