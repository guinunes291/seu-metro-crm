import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, corretorProcedure, gestorProcedure } from "../../_core/trpc.js";
import { getDb } from "../../_core/db.js";
import { notifySSEUser } from "../../_core/sse.js";
import * as repo from "./repository.js";
import { atualizarStatus, registrarInteracao } from "./service.js";
import { LEAD_STATUSES, LEAD_ORIGENS } from "../../../shared/const.js";

const leadStatusEnum = z.enum(LEAD_STATUSES);
const leadOrigemEnum = z.enum(LEAD_ORIGENS);

export const leadsRouter = router({
  list: corretorProcedure
    .input(
      z.object({
        status: leadStatusEnum.optional(),
        naLixeira: z.boolean().default(false),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const offset = (input.page - 1) * input.limit;
      const isGestor = ["gestor", "superintendente", "admin"].includes(ctx.user.role);
      const corretorId = isGestor ? undefined : ctx.user.id;

      if (corretorId !== undefined) {
        const [items, total] = await Promise.all([
          repo.getLeadsByCorretor(db, corretorId, {
            status: input.status,
            naLixeira: input.naLixeira,
            limit: input.limit,
            offset,
          }),
          repo.countLeadsByCorretor(db, corretorId),
        ]);
        return { items, total, page: input.page, limit: input.limit };
      }

      // Gestor/admin: get all
      const items = await repo.getLeadsByCorretor(db, 0, {
        status: input.status,
        naLixeira: input.naLixeira,
        limit: input.limit,
        offset,
      });
      return { items, total: items.length, page: input.page, limit: input.limit };
    }),

  get: corretorProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const lead = await repo.getLeadById(db, input.id);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
      const history = await repo.getHistory(db, input.id);
      return { ...lead, history };
    }),

  create: gestorProcedure
    .input(
      z.object({
        nome: z.string().min(1),
        telefone: z.string().min(8),
        email: z.string().email().optional(),
        origem: leadOrigemEnum.default("outro"),
        projetoId: z.number().optional(),
        projetoCustom: z.string().optional(),
        campanha: z.string().optional(),
        faixaRenda: z.string().optional(),
        observacoes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return repo.createLead(db, input);
    }),

  update: corretorProcedure
    .input(
      z.object({
        id: z.number(),
        nome: z.string().optional(),
        email: z.string().email().optional(),
        telefone: z.string().optional(),
        temperatura: z.enum(["quente", "morno", "frio"]).optional(),
        faixaRenda: z.string().optional(),
        finalidadeImovel: z.string().optional(),
        projetoId: z.number().nullable().optional(),
        projetoCustom: z.string().optional(),
        observacoes: z.string().optional(),
        proximoFollowup: z.string().datetime().optional(),
        motivoPerdido: z.string().optional(),
        motivoPerdaCategoria: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      await repo.updateLead(db, id, {
        ...data,
        proximoFollowup: data.proximoFollowup ? new Date(data.proximoFollowup) : undefined,
      });
    }),

  updateStatus: corretorProcedure
    .input(
      z.object({
        id: z.number(),
        status: leadStatusEnum,
        observacao: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const lead = await atualizarStatus(db, input.id, ctx.user.id, input.status, input.observacao);
      notifySSEUser(ctx.user.id, "lead_status_updated", { leadId: input.id, status: input.status });
      return lead;
    }),

  registrarInteracao: corretorProcedure
    .input(
      z.object({
        leadId: z.number(),
        tipo: z.enum(["ligacao", "whatsapp", "email", "sms", "visita", "nota", "outro"]),
        resultado: z.string().min(1),
        duracaoSegundos: z.number().optional(),
        atendida: z.boolean().optional(),
        respondida: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await registrarInteracao(db, input.leadId, ctx.user.id, input.tipo, input.resultado, {
        duracaoSegundos: input.duracaoSegundos,
        atendida: input.atendida,
        respondida: input.respondida,
      });
    }),

  moveToLixeira: corretorProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await repo.moveToLixeira(db, input.id);
    }),

  search: corretorProcedure
    .input(z.object({ q: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const isGestor = ["gestor", "superintendente", "admin"].includes(ctx.user.role);
      return repo.searchLeads(db, input.q, isGestor ? undefined : ctx.user.id);
    }),

  stats: corretorProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const isGestor = ["gestor", "superintendente", "admin"].includes(ctx.user.role);
    return repo.countLeadsByStatus(db, isGestor ? undefined : ctx.user.id);
  }),
});
