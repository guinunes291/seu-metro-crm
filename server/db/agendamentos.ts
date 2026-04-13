/**
 * server/db/agendamentos.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Agendamentos, visitas, disponibilidade do corretor e links de agendamento.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export {
  // Agendamentos
  checkAgendamentoDuplicado,
  createAgendamento,
  getAgendamentoById,
  getAgendamentosCorretor,
  getAgendamentosLead,
  updateAgendamentoStatus,
  updateAgendamento,
  deleteAgendamento,
  getAgendamentosDoDia,
  getAllAgendamentos,
  // Visitas
  createVisita,
  getVisitaById,
  getVisitasCorretor,
  getVisitasLead,
  getAllVisitas,
  updateVisita,
  deleteVisita,
  // Disponibilidade do corretor
  getDisponibilidadeCorretor,
  upsertDisponibilidadeCorretor,
  deleteDisponibilidadeCorretor,
  // Bloqueios de agenda
  getBloqueiosAgenda,
  createBloqueioAgenda,
  deleteBloqueioAgenda,
  // Links de agendamento self-service
  createLinkAgendamento,
  getLinkAgendamentoByToken,
  getLinksAgendamentoCorretor,
  incrementarAgendamentosLink,
  getSlotsDisponiveis,
  deleteLinkAgendamento,
  desativarLinkAgendamento,
  // Interações, documentações, análises de crédito
  createInteracao,
  createDocumentacao,
  createAnaliseCredito,
} from "../db";
