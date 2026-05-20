import type { DrizzleDB } from "../../_core/db.js";
import {
  getLeadById,
  updateLead,
  addHistory,
  addStatusTransition,
} from "./repository.js";
import { distributionLog } from "../../../drizzle/schema/index.js";
import type { LeadStatus } from "../../../shared/const.js";
import { TIMER_MINUTOS } from "../../../shared/const.js";

export async function distribuirLeadParaCorretor(
  db: DrizzleDB,
  leadId: number,
  corretorId: number,
  tipo: "automatica" | "manual" | "redistribuicao" | "timeout" | "foco",
  distribuidoPorId?: number
) {
  const lead = await getLeadById(db, leadId);
  if (!lead) throw new Error("Lead não encontrado");

  const timerExpiraEm = new Date(Date.now() + TIMER_MINUTOS * 60 * 1000);

  await updateLead(db, leadId, {
    corretorId,
    status: "aguardando_atendimento",
    dataDistribuicao: new Date(),
    timerAtivo: true,
    timerExpiraEm,
  });

  await db.insert(distributionLog).values({
    leadId,
    corretorId,
    tipo,
    motivo: tipo === "manual" ? "Distribuição manual" : undefined,
    distribuidoPorId,
  });

  await addHistory(db, {
    leadId,
    corretorId,
    tipo: "distribuicao",
    resultado: `Lead distribuído para corretor #${corretorId} (${tipo})`,
  });

  return await getLeadById(db, leadId);
}

export async function registrarInteracao(
  db: DrizzleDB,
  leadId: number,
  corretorId: number,
  tipo: "ligacao" | "whatsapp" | "email" | "sms" | "visita" | "nota" | "outro",
  resultado: string,
  extras?: {
    duracaoSegundos?: number;
    atendida?: boolean;
    respondida?: boolean;
  }
) {
  const lead = await getLeadById(db, leadId);
  if (!lead) throw new Error("Lead não encontrado");

  const agora = new Date();
  const updates: Partial<typeof lead> = { ultimaInteracao: agora };

  if (tipo === "ligacao" || tipo === "whatsapp") {
    updates.ultimoContato = agora;
  }

  if (!lead.primeiroContatoEm) {
    updates.primeiroContatoEm = agora;
    if (lead.createdAt) {
      updates.tempoAtePrimeiroContato = Math.floor(
        (agora.getTime() - new Date(lead.createdAt).getTime()) / 1000
      );
    }
  }

  // Cancel timer on any interaction
  updates.timerAtivo = false;

  await updateLead(db, leadId, updates);

  await addHistory(db, {
    leadId,
    corretorId,
    tipo,
    resultado,
    duracaoSegundos: extras?.duracaoSegundos,
    atendida: extras?.atendida,
    respondida: extras?.respondida,
  });
}

export async function atualizarStatus(
  db: DrizzleDB,
  leadId: number,
  corretorId: number | null,
  novoStatus: LeadStatus,
  observacao?: string
) {
  const lead = await getLeadById(db, leadId);
  if (!lead) throw new Error("Lead não encontrado");

  const statusAnterior = lead.status;
  await updateLead(db, leadId, { status: novoStatus });
  await addStatusTransition(db, leadId, corretorId, statusAnterior, novoStatus, observacao);

  if (novoStatus === "em_atendimento" && lead.timerAtivo) {
    await updateLead(db, leadId, { timerAtivo: false });
  }

  return await getLeadById(db, leadId);
}
