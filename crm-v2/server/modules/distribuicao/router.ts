import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, gestorProcedure, adminProcedure } from "../../_core/trpc.js";
import { getDb } from "../../_core/db.js";
import * as repo from "./repository.js";
import { distribuirLeadParaCorretor } from "../leads/service.js";

export const distribuicaoRouter = router({
  fila: gestorProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return repo.getFilaAtiva(db);
  }),

  upsertFila: adminProcedure
    .input(
      z.object({
        corretorId: z.number(),
        ativo: z.boolean().optional(),
        maxLeadsDia: z.number().min(1).max(200).optional(),
        posicao: z.number().min(0).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { corretorId, ...data } = input;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await repo.upsertFila(db, corretorId, data);
    }),

  stats: gestorProcedure
    .input(z.object({ diasAtras: z.number().min(1).max(90).default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return repo.getDistributionStats(db, input.diasAtras);
    }),

  distribuirManual: gestorProcedure
    .input(z.object({ leadId: z.number(), corretorId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return distribuirLeadParaCorretor(
        db,
        input.leadId,
        input.corretorId,
        "manual",
        ctx.user.id
      );
    }),

  configFoco: gestorProcedure
    .input(z.object({ projetoId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return repo.getConfigFoco(db, input.projetoId);
    }),

  estoque: gestorProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return repo.getEstoqueAguardando(db);
  }),
});
