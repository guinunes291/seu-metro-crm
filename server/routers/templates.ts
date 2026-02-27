import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";

export const templatesRouter = router({
  // Listar todos os templates
  listar: protectedProcedure.query(async () => {
    return await db.listarTemplatesComissao();
  }),

  // Listar projetos para select
  listarProjetos: protectedProcedure.query(async () => {
    return await db.listarProjetosParaTemplate();
  }),

  // Criar novo template (admin only)
  criar: adminProcedure
    .input(z.object({
      nome: z.string().min(1, 'Nome é obrigatório'),
      projectId: z.number().nullable(),
      percentualImobiliaria: z.number().min(0).max(100),
      percentualCorretor: z.number().min(0).max(100),
      percentualGerente: z.number().min(0).max(100),
      percentualSuperintendente: z.number().min(0).max(100),
      isPadrao: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      return await db.criarTemplateComissao(input);
    }),

  // Atualizar template (admin only)
  atualizar: adminProcedure
    .input(z.object({
      id: z.number(),
      nome: z.string().min(1, 'Nome é obrigatório'),
      projectId: z.number().nullable(),
      percentualImobiliaria: z.number().min(0).max(100),
      percentualCorretor: z.number().min(0).max(100),
      percentualGerente: z.number().min(0).max(100),
      percentualSuperintendente: z.number().min(0).max(100),
      isPadrao: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return await db.atualizarTemplateComissao(id, data);
    }),

  // Excluir template (admin only)
  excluir: adminProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input }) => {
      return await db.excluirTemplateComissao(input.id);
    }),

  // Marcar como padrão (admin only)
  marcarPadrao: adminProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input }) => {
      return await db.marcarTemplatePadrao(input.id);
    }),
});
