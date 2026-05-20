import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  router,
  protectedProcedure,
  gestorProcedure,
  adminProcedure,
  superAdminProcedure,
} from "../../_core/trpc.js";
import { getDb } from "../../_core/db.js";
import { notifySSEUser } from "../../_core/sse.js";
import * as repo from "./repository.js";
import { togglePresenca } from "./service.js";

export const authRouter = router({
  me: protectedProcedure.query(({ ctx }) => ctx.user),

  togglePresenca: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const novoStatus = await togglePresenca(db, ctx.user.id);
    notifySSEUser(ctx.user.id, "presenca_atualizada", { status: novoStatus });
    return { status: novoStatus };
  }),
});

export const usuariosRouter = router({
  list: gestorProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return repo.getAllUsersWithEquipes(db);
  }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        role: z.enum(["admin", "superintendente", "gestor", "corretor"]).optional(),
        equipeId: z.number().nullable().optional(),
        limiteDiarioLeads: z.number().min(1).max(200).optional(),
        status: z.enum(["presente", "ausente"]).optional(),
        telefone: z.string().optional(),
        cpf: z.string().optional(),
        creci: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await repo.updateUser(db, id, data);
    }),
});

export const equipesRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return repo.getAllEquipes(db);
  }),

  create: superAdminProcedure
    .input(
      z.object({
        nome: z.string().min(1),
        gestorId: z.number().optional(),
        superintendenteId: z.number().optional(),
        cor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        metaMensal: z.number().min(0).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await repo.createEquipe(db, input);
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        nome: z.string().min(1).optional(),
        gestorId: z.number().nullable().optional(),
        superintendenteId: z.number().nullable().optional(),
        cor: z.string().optional(),
        metaMensal: z.number().min(0).optional(),
        ativa: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await repo.updateEquipe(db, id, data);
    }),
});
