/**
 * server/db/comissoes.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Comissões e templates de comissão.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export {
  buscarTemplateComissaoPorProjeto,
  listarTemplatesComissao,
  listarProjetosParaTemplate,
  criarTemplateComissao,
  atualizarTemplateComissao,
  excluirTemplateComissao,
  marcarTemplatePadrao,
} from "../db";
