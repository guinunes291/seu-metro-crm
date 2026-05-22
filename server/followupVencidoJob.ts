/**
 * Job de Follow-up Vencido — WhatsApp
 *
 * Executa diariamente às 09h (fuso Brasília).
 * Busca follow-ups com dataFollowUp < hoje e status = 'pendente'.
 * Envia para o corretor: "⚠️ Follow-up vencido: [lead.nome] — previsto para [data]"
 * Máximo 3 lembretes por corretor por dia (evitar spam).
 * Só envia se users.telefone estiver preenchido.
 * Só envia entre 08h e 20h (horário de Brasília).
 * Registra envios em whatsapp_logs.
 */

import { getDb } from "./db";
import { followUps, leads, users, whatsappLogs } from "../drizzle/schema";
import { and, eq, lt } from "drizzle-orm";
import {
  isEvolutionApiConfigured,
  sendWhatsAppMessage,
  formatPhoneNumber,
} from "./evolutionApi";
import { getSystemConfig, setSystemConfig } from "./systemConfigDb";

const FOLLOWUP_KEY = "whatsapp_followup_ultima_execucao";
const MAX_POR_CORRETOR = 3;

function hojeStrSP(): string {
  return new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).split("/").reverse().join("-");
}

function horaAtualSP(): number {
  return parseInt(
    new Date().toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false,
    }),
    10,
  );
}

function formatarDataBR(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

async function logWhatsapp(params: {
  leadId: number | null;
  corretorId: number | null;
  mensagem: string;
  telefone: string | null;
  status: "enviado" | "erro" | "ignorado";
  erroDetalhe?: string;
}) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(whatsappLogs).values({
      leadId: params.leadId ?? undefined,
      corretorId: params.corretorId ?? undefined,
      tipo: "followup_vencido",
      mensagem: params.mensagem,
      telefone: params.telefone ?? undefined,
      status: params.status,
      erroDetalhe: params.erroDetalhe ?? undefined,
    });
  } catch {
    // silent — log não deve bloquear fluxo
  }
}

async function enviarAvisosFollowupVencido() {
  if (!isEvolutionApiConfigured()) return;

  const hora = horaAtualSP();
  if (hora < 8 || hora >= 20) return;

  const db = await getDb();
  if (!db) return;

  // Verifica se já executou hoje
  const ultimaExecucao = await getSystemConfig(FOLLOWUP_KEY);
  const hoje = hojeStrSP();
  if (ultimaExecucao === hoje) return;

  console.log("[WhatsApp Follow-up] Iniciando envio de avisos de follow-up vencido...");

  try {
    const agora = new Date();

    // Buscar follow-ups pendentes com data vencida
    const followupsVencidos = await db
      .select({
        id: followUps.id,
        leadId: followUps.leadId,
        corretorId: followUps.corretorId,
        dataFollowUp: followUps.dataFollowUp,
        leadNome: leads.nome,
        corretorTelefone: users.telefone,
        corretorNome: users.name,
      })
      .from(followUps)
      .innerJoin(leads, eq(followUps.leadId, leads.id))
      .innerJoin(users, eq(followUps.corretorId, users.id))
      .where(
        and(
          eq(followUps.status, "pendente"),
          lt(followUps.dataFollowUp, agora),
          eq(leads.naLixeira, false),
        ),
      )
      .limit(200);

    if (!followupsVencidos.length) {
      await setSystemConfig(FOLLOWUP_KEY, hoje);
      return;
    }

    // Agrupar por corretor (máximo MAX_POR_CORRETOR por corretor)
    const porCorretor = new Map<number, typeof followupsVencidos>();
    for (const fu of followupsVencidos) {
      if (!fu.corretorId) continue;
      const lista = porCorretor.get(fu.corretorId) ?? [];
      if (lista.length < MAX_POR_CORRETOR) {
        lista.push(fu);
        porCorretor.set(fu.corretorId, lista);
      }
    }

    let enviados = 0;
    for (const [corretorId, fus] of porCorretor) {
      const primeiroFu = fus[0];
      if (!primeiroFu.corretorTelefone) continue;

      const telefone = formatPhoneNumber(primeiroFu.corretorTelefone);

      // Montar mensagem consolidada se houver mais de 1
      let mensagem: string;
      if (fus.length === 1) {
        mensagem = `⚠️ Follow-up vencido: ${fus[0].leadNome} — previsto para ${formatarDataBR(new Date(fus[0].dataFollowUp))}`;
      } else {
        const lista = fus
          .map((fu) => `• ${fu.leadNome} (${formatarDataBR(new Date(fu.dataFollowUp))})`)
          .join("\n");
        mensagem = `⚠️ Você tem ${fus.length} follow-ups vencidos:\n${lista}\n\nAcesse o CRM para registrá-los.`;
      }

      try {
        await sendWhatsAppMessage(telefone, mensagem);
        await logWhatsapp({
          leadId: fus[0].leadId,
          corretorId,
          mensagem,
          telefone,
          status: "enviado",
        });
        enviados++;
        await new Promise((r) => setTimeout(r, 500));
      } catch (err: unknown) {
        const erroMsg = err instanceof Error ? err.message : String(err);
        await logWhatsapp({
          leadId: fus[0].leadId,
          corretorId,
          mensagem,
          telefone,
          status: "erro",
          erroDetalhe: erroMsg,
        });
      }
    }

    console.log(`[WhatsApp Follow-up] ${enviados} corretores notificados sobre follow-ups vencidos`);
    await setSystemConfig(FOLLOWUP_KEY, hoje);
  } catch (err) {
    console.error("[WhatsApp Follow-up] Erro:", err);
  }
}

export function startFollowupVencidoJob() {
  if (!isEvolutionApiConfigured()) {
    console.log("[WhatsApp Follow-up] EVOLUTION_API_URL não configurado — job desativado");
    return;
  }

  console.log("[WhatsApp Follow-up] Job iniciado — avisos de follow-up vencido às 09h SP");

  // Verifica a cada 5 minutos se já é 09h e ainda não executou hoje (reduzido de 60s — economia de Cloud)
  setInterval(async () => {
    if (horaAtualSP() === 9) {
      await enviarAvisosFollowupVencido();
    }
  }, 5 * 60_000);

  // Execução imediata ao iniciar (caso servidor reiniciou após 09h)
  enviarAvisosFollowupVencido().catch(() => {});
}
