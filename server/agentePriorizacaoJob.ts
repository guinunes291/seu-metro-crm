/**
 * Agente de Priorização Diária de Leads
 *
 * Executa às 7h (fuso SP): analisa a carteira de cada corretor e gera uma lista
 * priorizada dos leads mais urgentes para contato naquele dia.
 *
 * Resultado salvo em `notifications` (tipo='sistema') e enviado via SSE ao corretor.
 */

import { getDb } from "./db";
import { leads, users, projects, notifications } from "../drizzle/schema";
import { and, eq, ne, isNotNull } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { getSystemConfig, setSystemConfig } from "./systemConfigDb";

const PRIORIZACAO_LAST_RUN_KEY = "agente_priorizacao_ultima_execucao";

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

function extractTextContent(response: any): string {
  const content = response.choices[0]?.message?.content;
  if (!content) return '';
  if (typeof content === 'string') return content;
  return (content as Array<{ type: string; text?: string }>)
    .filter((p: any) => p.type === 'text')
    .map((p: any) => p.text || '')
    .join('');
}

function parseJsonFromLLM(raw: string): any {
  let jsonStr = raw.trim();
  if (jsonStr.includes('```json')) jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
  else if (jsonStr.includes('```')) jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
  return JSON.parse(jsonStr);
}

function buildResumoLead(lead: any): string {
  const diasDesdeEntrada = Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / 86_400_000);
  const diasSemInteracao = lead.ultimaInteracao
    ? Math.floor((Date.now() - new Date(lead.ultimaInteracao).getTime()) / 86_400_000)
    : diasDesdeEntrada;

  let linha = `ID:${lead.id} | ${lead.nome} | Status:${lead.status}`;
  if (lead.temperatura) linha += ` | Temp:${lead.temperatura}`;
  if (lead.faixaRenda) linha += ` | Renda:${lead.faixaRenda}`;
  if (lead.projetoNome || lead.projetoCustom) linha += ` | Projeto:${lead.projetoNome || lead.projetoCustom}`;
  linha += ` | DiasBase:${diasDesdeEntrada} | DiasSemContato:${diasSemInteracao}`;
  if (lead.proximoFollowup) {
    const followupDate = new Date(lead.proximoFollowup).toLocaleDateString('pt-BR');
    linha += ` | Followup:${followupDate}`;
  }
  if (lead.observacoes) linha += ` | Obs:"${lead.obs?.slice(0, 60)}"`;
  return linha;
}

export type PrioridadeLead = {
  leadId: number;
  leadNome: string;
  motivo: string;
  acao: string;
};

export async function executarPriorizacaoDiaria(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Executar apenas uma vez por dia
  const hoje = hojeStrSP();
  const ultimaExecucao = await getSystemConfig(PRIORIZACAO_LAST_RUN_KEY);
  if (ultimaExecucao === hoje) {
    console.log("[Agente Priorização] Já executado hoje, pulando...");
    return;
  }

  console.log("[Agente Priorização] Iniciando priorização diária de leads...");

  const corretores = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.role, "corretor"), eq(users.status, "presente")));

  if (corretores.length === 0) {
    console.log("[Agente Priorização] Nenhum corretor presente, pulando...");
    return;
  }

  for (const corretor of corretores) {
    try {
      const leadsDoCorretor = await db
        .select({
          id: leads.id,
          nome: leads.nome,
          status: leads.status,
          temperatura: leads.temperatura,
          faixaRenda: leads.faixaRenda,
          ultimaInteracao: leads.ultimaInteracao,
          createdAt: leads.createdAt,
          proximoFollowup: leads.proximoFollowup,
          projetoNome: projects.nome,
          projetoCustom: leads.projetoCustom,
          observacoes: leads.observacoes,
        })
        .from(leads)
        .leftJoin(projects, eq(leads.projectId, projects.id))
        .where(
          and(
            eq(leads.corretorId, corretor.id),
            ne(leads.status, "perdido"),
            ne(leads.status, "contrato_fechado"),
            eq(leads.naLixeira, false),
          ),
        )
        .limit(40);

      if (leadsDoCorretor.length === 0) continue;

      const contexto = leadsDoCorretor.map(buildResumoLead).join("\n");

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Você é um coach de vendas imobiliárias. Analise a carteira de leads do corretor e escolha os 5 mais urgentes para contato HOJE. Critérios: leads quentes parados, agendamentos próximos sem confirmação, leads novos sem primeiro contato, leads em atendimento sem interação há dias. Responda SOMENTE em JSON puro sem markdown:\n{"prioridades":[{"leadId":N,"leadNome":"...","motivo":"motivo em 1 frase","acao":"ação concreta a fazer hoje"}]}`,
          },
          {
            role: "user",
            content: `Carteira do corretor ${corretor.name}:\n${contexto}`,
          },
        ],
      });

      let prioridades: PrioridadeLead[] = [];
      try {
        const parsed = parseJsonFromLLM(extractTextContent(response)) as any;
        prioridades = (parsed.prioridades || []).slice(0, 5) as PrioridadeLead[];
      } catch (parseErr) {
        console.error(`[Agente Priorização] Erro ao parsear resposta para corretor ${corretor.id}:`, parseErr);
        continue;
      }

      if (prioridades.length === 0) continue;

      // Salvar na tabela notifications
      await db.insert(notifications).values({
        userId: corretor.id,
        titulo: `[IA] Leads prioritários de hoje — ${new Date().toLocaleDateString('pt-BR')}`,
        mensagem: JSON.stringify(prioridades),
        tipo: "sistema",
        lida: false,
      });

      // Push SSE se corretor estiver conectado
      try {
        const { notifySSEUser } = await import("./sseManager");
        notifySSEUser(corretor.id, "ia_priorizacao_diaria", { prioridades });
      } catch {
        // SSE não crítico
      }

      console.log(`[Agente Priorização] ${prioridades.length} leads priorizados para ${corretor.name}`);
    } catch (err) {
      console.error(`[Agente Priorização] Erro para corretor ${corretor.id}:`, err);
    }

    // Pausa entre corretores para não estourar quota da API em rajada
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  await setSystemConfig(PRIORIZACAO_LAST_RUN_KEY, hoje);
  console.log("[Agente Priorização] Priorização diária concluída.");
}

/**
 * Inicia o scheduler da priorização diária.
 * Verifica a cada hora se é 7h (fuso SP) para disparar o agente.
 */
export function agendarPriorizacaoDiaria(): void {
  const verificar = () => {
    const hora = horaAtualSP();
    if (hora === 7) {
      executarPriorizacaoDiaria().catch(console.error);
    }
  };

  // Verificar a cada hora
  setInterval(verificar, 60 * 60 * 1000);

  // Verificar imediatamente ao iniciar (para ambientes que reiniciam às 7h)
  setTimeout(verificar, 5000);

  console.log("[Agente Priorização] Scheduler iniciado — executa diariamente às 7h SP");
}
