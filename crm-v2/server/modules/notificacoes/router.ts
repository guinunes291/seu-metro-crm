import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, corretorProcedure } from "../../_core/trpc.js";
import { getDb } from "../../_core/db.js";
import * as repo from "./repository.js";

export const notificacoesRouter = router({
  list: corretorProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return repo.getNotificacoesByUser(db, ctx.user.id, 50);
  }),

  unreadCount: corretorProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return { count: await repo.countUnread(db, ctx.user.id) };
  }),

  markRead: corretorProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await repo.markAsRead(db, input.id, ctx.user.id);
    }),

  markAllRead: corretorProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await repo.markAllAsRead(db, ctx.user.id);
  }),
});
