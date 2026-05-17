import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Router } from "express";
import { randomBytes } from "crypto";
import { router, adminProcedure, gestorProcedure } from "../../_core/trpc.js";
import { getDb } from "../../_core/db.js";
import * as repo from "./repository.js";
import { processarWebhook } from "./service.js";

// Express router for raw HTTP webhook endpoints
export function makeWebhookRouter(): Router {
  const r = Router();

  // Facebook verification handshake
  r.get("/:token", (req, res) => {
    const mode = req.query["hub.mode"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && challenge) {
      res.send(challenge);
    } else {
      res.status(403).send("Forbidden");
    }
  });

  // Receive webhook payload
  r.post("/:token", async (req, res) => {
    try {
      const db = await getDb();
      if (!db) {
        res.status(503).json({ error: "Database unavailable" });
        return;
      }
      const result = await processarWebhook(db, req.params.token!, req.body);
      if (!result) {
        res.status(200).json({ ok: true, skipped: true });
        return;
      }
      res.status(200).json({ ok: true, leadId: result.leadId });
    } catch (err) {
      console.error("[Webhook]", err);
      res.status(200).json({ ok: true }); // Always 200 to Facebook
    }
  });

  return r;
}

// tRPC router for managing webhook configs
export const webhooksRouter = router({
  list: gestorProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return repo.getAllWebhooks(db);
  }),

  create: adminProcedure
    .input(
      z.object({
        nome: z.string().min(1),
        fonte: z.enum(["facebook", "instagram", "rdstation", "outro"]).default("facebook"),
        tipoFila: z.enum(["geral", "foco"]).default("geral"),
        projectIdPadrao: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const token = randomBytes(24).toString("hex");
      return repo.createWebhook(db, { ...input, token });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        nome: z.string().optional(),
        tipoFila: z.enum(["geral", "foco"]).optional(),
        projectIdPadrao: z.number().nullable().optional(),
        ativo: z.boolean().optional(),
        formIdMapping: z.record(z.string(), z.number()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await repo.updateWebhook(db, id, data);
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await repo.deleteWebhook(db, input.id);
    }),
});
