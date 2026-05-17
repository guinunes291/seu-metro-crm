import type { DrizzleDB } from "../../_core/db.js";
import {
  getFilaAtiva,
  getConfigFoco,
  incrementLeadsRecebidos,
  moverParaFinalDaFila,
  markEstoqueDistribuido,
  atualizarPosicaoFoco,
  addToEstoque,
} from "./repository.js";
import { getLeadById, updateLead } from "../leads/repository.js";
import { distribuirLeadParaCorretor } from "../leads/service.js";

export async function encontrarProximoCorretor(
  db: DrizzleDB,
  tipoFila: "geral" | "foco",
  projetoId?: number
): Promise<number | null> {
  if (tipoFila === "foco" && projetoId) {
    const configs = await getConfigFoco(db, projetoId);
    const config = configs[0];
    if (!config || config.corretoresIds.length === 0) return null;

    const corretoresIds = config.corretoresIds;
    const posicaoAtual = config.posicaoAtual % corretoresIds.length;
    const corretorId = corretoresIds[posicaoAtual];

    await atualizarPosicaoFoco(db, config.id, (posicaoAtual + 1) % corretoresIds.length);
    return corretorId ?? null;
  }

  // Fila geral: round-robin por posicao, respeitando limite diário
  const fila = await getFilaAtiva(db);
  for (const entrada of fila) {
    if (entrada.leadsRecebidosHoje < entrada.maxLeadsDia) {
      return entrada.corretorId;
    }
  }
  return null;
}

export async function processarLeadEstoque(
  db: DrizzleDB,
  leadId: number,
  tipoFila: "geral" | "foco" = "geral"
): Promise<boolean> {
  const lead = await getLeadById(db, leadId);
  if (!lead) return false;

  const projetoId = lead.projetoId ?? undefined;
  const corretorId = await encontrarProximoCorretor(db, tipoFila, projetoId);
  if (!corretorId) return false;

  await distribuirLeadParaCorretor(db, leadId, corretorId, "automatica");
  await incrementLeadsRecebidos(db, corretorId);
  await moverParaFinalDaFila(db, corretorId);
  await markEstoqueDistribuido(db, leadId);
  return true;
}

export async function redistribuirLeadTimedOut(
  db: DrizzleDB,
  leadId: number
): Promise<"redistributed" | "estoque" | "no_corretor"> {
  const lead = await getLeadById(db, leadId);
  if (!lead) return "no_corretor";

  const tentativas = (lead.tentativasRedistribuicao ?? 0) + 1;
  await updateLead(db, leadId, {
    tentativasRedistribuicao: tentativas,
    timerAtivo: false,
    timerExpiraEm: undefined,
  });

  if (tentativas >= 3) {
    await addToEstoque(db, leadId, "geral", `Timeout após ${tentativas} tentativas`);
    await updateLead(db, leadId, { corretorId: undefined, status: "novo" });
    return "estoque";
  }

  const corretorId = await encontrarProximoCorretor(db, "geral");
  if (!corretorId) {
    await addToEstoque(db, leadId, "geral", "Sem corretores disponíveis");
    return "no_corretor";
  }

  await distribuirLeadParaCorretor(db, leadId, corretorId, "timeout");
  await incrementLeadsRecebidos(db, corretorId);
  await moverParaFinalDaFila(db, corretorId);
  return "redistributed";
}
