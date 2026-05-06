/**
 * Job de Lembretes WhatsApp — D-1 para agendamentos
 *
 * Estratégia: setInterval a cada 60 segundos verificando se chegou o horário.
 * Executa diariamente às 18h (fuso Brasília) para enviar lembretes
 * dos agendamentos do dia seguinte ainda pendentes/confirmados.
 *
 * Também envia boas-vindas para leads recém-distribuídos (criados nos últimos 10min,
 * status aguardando_atendimento, sem contato prévio).
 *
 * ATIVADO apenas quando EVOLUTION_API_URL estiver configurado.
 */

import { getDb } from "./db";
import { agendamentos, leads, users, projects } from "../drizzle/schema";
import { and, eq, gte, lt, inArray } from "drizzle-orm";
import {
  isEvolutionApiConfigured,
  enviarLembreteAgendamento,
  enviarBoasVindasLead,
  formatPhoneNumber,
} from "./evolutionApi";
import { getSystemConfig, setSystemConfig } from "./systemConfigDb";

const LEMBRETE_KEY = "whatsapp_lembretes_ultima_execucao";
const BOAS_VINDAS_KEY = "whatsapp_boasvindas_ultimo_lead_id";

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

async function enviarLembretesDia1() {
  if (!isEvolutionApiConfigured()) return;

  const db = await getDb();
  if (!db) return;

  // Verifica se já executou hoje
  const ultimaExecucao = await getSystemConfig(LEMBRETE_KEY);
  const hoje = hojeStrSP();
  if (ultimaExecucao === hoje) return;

  console.log("[WhatsApp Lembretes] Iniciando envio de lembretes D-1...");

  try {
    // Buscar agendamentos de AMANHÃ ainda pendentes ou confirmados
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const inicioAmanha = new Date(amanha.getFullYear(), amanha.getMonth(), amanha.getDate());
    const fimAmanha = new Date(amanha.getFullYear(), amanha.getMonth(), amanha.getDate(), 23, 59, 59);

    const agendamentosAmanha = await db
      .select({
        id: agendamentos.id,
        leadId: agendamentos.leadId,
        corretorId: agendamentos.corretorId,
        dataAgendamento: agendamentos.dataAgendamento,
        horaAgendamento: agendamentos.horaAgendamento,
        projetoCustom: agendamentos.projetoCustom,
        leadNome: leads.nome,
        leadTelefone: leads.telefone,
        corretorNome: users.name,
        projetoNome: projects.nome,
      })
      .from(agendamentos)
      .innerJoin(leads, eq(agendamentos.leadId, leads.id))
      .leftJoin(users, eq(agendamentos.corretorId, users.id))
      .leftJoin(projects, eq(agendamentos.projectId, projects.id))
      .where(
        and(
          gte(agendamentos.dataAgendamento, inicioAmanha),
          lt(agendamentos.dataAgendamento, fimAmanha),
          inArray(agendamentos.status, ["pendente", "confirmado"]),
        ),
      );

    let enviados = 0;
    let erros = 0;

    for (const ag of agendamentosAmanha) {
      if (!ag.leadTelefone) continue;
      try {
        const dataFormatada = ag.dataAgendamento.toLocaleDateString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          weekday: "long",
          day: "2-digit",
          month: "long",
        });
        const projeto = ag.projetoNome || ag.projetoCustom || undefined;
        await enviarLembreteAgendamento({
          telefoneCliente: ag.leadTelefone,
          nomeCliente: ag.leadNome,
          nomeCorretor: ag.corretorNome || "Corretor",
          data: dataFormatada,
          hora: ag.horaAgendamento,
          projeto,
        });
        enviados++;
        // Pequena pausa entre envios para não sobrecarregar a API
        await new Promise((r) => setTimeout(r, 500));
      } catch {
        erros++;
      }
    }

    await setSystemConfig(LEMBRETE_KEY, hoje);
    console.log(`[WhatsApp Lembretes] Concluído: ${enviados} enviados, ${erros} erros (de ${agendamentosAmanha.length} agendamentos)`);
  } catch (err) {
    console.error("[WhatsApp Lembretes] Erro ao enviar lembretes:", err);
  }
}

async function enviarBoasVindasNovosLeads() {
  if (!isEvolutionApiConfigured()) return;

  const db = await getDb();
  if (!db) return;

  try {
    // Verificar leads criados nos últimos 10 minutos sem contato e com corretor atribuído
    const dez_min_atras = new Date(Date.now() - 10 * 60 * 1000);
    const ultimoIdEnviado = parseInt(await getSystemConfig(BOAS_VINDAS_KEY) || "0");

    const novosLeads = await db
      .select({
        id: leads.id,
        nome: leads.nome,
        telefone: leads.telefone,
        corretorId: leads.corretorId,
        corretorNome: users.name,
        projectId: leads.projectId,
        projetoNome: projects.nome,
        projetoCustom: leads.projetoCustom,
      })
      .from(leads)
      .leftJoin(users, eq(leads.corretorId, users.id))
      .leftJoin(projects, eq(leads.projectId, projects.id))
      .where(
        and(
          gte(leads.createdAt, dez_min_atras),
          eq(leads.status, "aguardando_atendimento"),
          eq(leads.naLixeira, false),
        ),
      );

    // Filtra apenas IDs maiores que o último enviado para não reenviar
    const paraEnviar = novosLeads.filter((l) => l.id > ultimoIdEnviado && l.corretorId !== null);

    if (!paraEnviar.length) return;

    let maxId = ultimoIdEnviado;
    for (const lead of paraEnviar) {
      if (!lead.telefone) continue;
      try {
        const projeto = lead.projetoNome || lead.projetoCustom || undefined;
        await enviarBoasVindasLead({
          telefoneCliente: lead.telefone,
          nomeCliente: lead.nome,
          nomeCorretor: lead.corretorNome || "Corretor",
          projeto,
        });
        if (lead.id > maxId) maxId = lead.id;
        await new Promise((r) => setTimeout(r, 500));
      } catch {
        // silent — não bloqueia o fluxo
      }
    }

    if (maxId > ultimoIdEnviado) {
      await setSystemConfig(BOAS_VINDAS_KEY, String(maxId));
    }
  } catch (err) {
    console.error("[WhatsApp Boas-vindas] Erro:", err);
  }
}

export function startWhatsAppRemindersJob() {
  if (!isEvolutionApiConfigured()) {
    console.log("[WhatsApp Lembretes] EVOLUTION_API_URL não configurado — job desativado");
    return;
  }

  console.log("[WhatsApp Lembretes] Job iniciado — lembretes D-1 às 18h SP, boas-vindas a cada 10min");

  // Lembretes D-1: verifica a cada 60s se já é 18h e ainda não executou hoje
  setInterval(async () => {
    if (horaAtualSP() === 18) {
      await enviarLembretesDia1();
    }
  }, 60_000);

  // Boas-vindas para novos leads: a cada 10 minutos
  setInterval(async () => {
    await enviarBoasVindasNovosLeads();
  }, 10 * 60_000);

  // Execução imediata do boas-vindas ao iniciar (captura leads recentes caso servidor reiniciou)
  enviarBoasVindasNovosLeads().catch(() => {});
}
