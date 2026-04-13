/**
 * server/db/projetos.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Projetos imobiliários, sugestões e unidades (properties).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export {
  createProject,
  getAllProjects,
  getProjectsForMap,
  getProjectById,
  updateProject,
  deleteProject,
  updateProjectBook,
  createProjectSuggestion,
  getPendingProjectSuggestions,
  getProjectSuggestionById,
  getProjectSuggestionsByCorretor,
  approveProjectSuggestion,
  rejectProjectSuggestion,
  deleteProjectSuggestion,
  createProperty,
  getPropertiesByProject,
  getConfiguracaoProjetoFoco,
  setConfiguracaoProjetoFoco,
  toggleProjetoFoco,
  getProximoCorretorFilaFoco,
} from "../db";
