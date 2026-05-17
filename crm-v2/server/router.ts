import { router } from "./_core/trpc.js";
import { authRouter, usuariosRouter, equipesRouter } from "./modules/usuarios/router.js";
import { notificacoesRouter } from "./modules/notificacoes/router.js";
import { leadsRouter } from "./modules/leads/router.js";
import { distribuicaoRouter } from "./modules/distribuicao/router.js";
import { webhooksRouter } from "./modules/webhooks/router.js";
import { projetosRouter } from "./modules/projetos/router.js";

export const appRouter = router({
  auth: authRouter,
  usuarios: usuariosRouter,
  equipes: equipesRouter,
  notificacoes: notificacoesRouter,
  leads: leadsRouter,
  distribuicao: distribuicaoRouter,
  webhooks: webhooksRouter,
  projetos: projetosRouter,
});

export type AppRouter = typeof appRouter;
