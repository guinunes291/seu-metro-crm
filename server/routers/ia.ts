import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { invokeLLM, type InvokeResult } from '../_core/llm';
import { getDb } from '../db';
import { leads, leadHistory, users, projects } from '../../drizzle/schema';
import { eq, desc } from 'drizzle-orm';

function extractTextContent(response: InvokeResult): string {
  const content = response.choices[0]?.message?.content;
  if (!content) return '';
  if (typeof content === 'string') return content;
  return (content as Array<{ type: string; text?: string }>)
    .filter(p => p.type === 'text')
    .map(p => p.text || '')
    .join('');
}

function parseJsonFromLLM(raw: string): unknown {
  let jsonStr = raw.trim();
  if (jsonStr.includes('```json')) jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
  else if (jsonStr.includes('```')) jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
  return JSON.parse(jsonStr);
}

const SYSTEM_PROMPT_WHATSAPP = `Você é um especialista em vendas imobiliárias MCMV e lançamentos. Gere mensagens de WhatsApp seguindo rigorosamente:

FÓRMULA G.P.V.A. obrigatória:
- G: Gancho — primeira frase específica, NUNCA "Oi tudo bem?"
- P: Personalização — nome e contexto da pessoa
- V: Valor — o que ela GANHA ao responder
- A: Ação — CTA binário, nunca pergunta aberta

REGRAS:
- Máximo 4 linhas no primeiro contato
- Tom: próximo, direto, humano — sem pressão
- Nunca inventar dados (subsídio, parcela) — usar [VALOR] como placeholder
- Nunca usar "aproveite", "últimas unidades", "oportunidade única"
- Urgência só quando real

Responda SEMPRE em JSON puro, sem markdown, sem explicações fora do JSON:
{
  "principal": "mensagem principal pronta",
  "variacao": "variação alternativa",
  "orientacao": "orientação de uso em 2-3 linhas",
  "proximo_passo_sim": "o que fazer se responder",
  "proximo_passo_nao": "o que fazer se não responder em 48h"
}`;

const STAGES_LABELS: Record<string, string> = {
  novo_portal: 'Lead novo — portal',
  novo_indicacao: 'Lead novo — indicação',
  nao_respondeu: 'Não respondeu',
  confirmacao_visita: 'Confirmar visita',
  visitou_esfriou: 'Visitou e esfriou',
  base_fria: 'Base fria (30+ dias)',
  vou_pensar: "Disse 'vou pensar'",
  ultima_tentativa: 'Última tentativa',
};

const HOOKS_LABELS: Record<string, string> = {
  nova_tabela: 'Nova tabela / condições',
  nova_faixa: 'Nova faixa MCMV / subsídio',
  novo_empreendimento: 'Novo empreendimento',
  prova_social: 'Prova social (família que fechou)',
  sem_novidade: 'Sem novidade específica',
};

const STATUS_LABELS: Record<string, string> = {
  novo: 'Novo', aguardando_atendimento: 'Aguardando atendimento',
  em_atendimento: 'Em atendimento', qualificado: 'Qualificado',
  agendado: 'Agendado', visita_realizada: 'Visita realizada',
  proposta_enviada: 'Proposta enviada', analise_credito: 'Análise de crédito',
  contrato_fechado: 'Contrato fechado', pos_venda: 'Pós-venda', perdido: 'Perdido',
};

const INTERACTION_LABELS: Record<string, string> = {
  ligacao: 'ligação', whatsapp: 'WhatsApp', email: 'e-mail',
  sms: 'SMS', visita: 'visita', outro: 'outro',
};

const RESULTADO_LABELS: Record<string, string> = {
  contato_realizado: 'contato realizado', nao_atendeu: 'não atendeu',
  agendamento: 'agendamento marcado', visita_realizada: 'visita realizada',
  proposta_enviada: 'proposta enviada', recusou: 'recusou', outro: 'outro',
};

async function fetchLeadContext(leadId: number) {
  const db = await getDb();
  if (!db) throw new Error('Banco de dados indisponível');

  const [leadRow] = await db
    .select({
      id: leads.id, nome: leads.nome, telefone: leads.telefone,
      status: leads.status, temperatura: leads.temperatura,
      origem: leads.origem, projetoCustom: leads.projetoCustom,
      observacoes: leads.observacoes, motivoPerdido: leads.motivoPerdido,
      motivoPerdaCategoria: leads.motivoPerdaCategoria,
      createdAt: leads.createdAt, ultimaInteracao: leads.ultimaInteracao,
      primeiroContatoEm: leads.primeiroContatoEm, proximoFollowup: leads.proximoFollowup,
      faixaRenda: leads.faixaRenda, usaFgts: leads.usaFgts, entradaDisponivel: leads.entradaDisponivel,
      finalidadeImovel: leads.finalidadeImovel, prefereContatoPor: leads.prefereContatoPor,
      corretorNome: users.name, projetoNome: projects.nome,
    })
    .from(leads)
    .leftJoin(users, eq(leads.corretorId, users.id))
    .leftJoin(projects, eq(leads.projectId, projects.id))
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!leadRow) throw new Error('Lead não encontrado');

  const historico = await db
    .select({
      tipo: leadHistory.tipo, resultado: leadHistory.resultado,
      observacoes: leadHistory.observacoes, statusAnterior: leadHistory.statusAnterior,
      statusNovo: leadHistory.statusNovo, createdAt: leadHistory.createdAt,
    })
    .from(leadHistory)
    .where(eq(leadHistory.leadId, leadId))
    .orderBy(desc(leadHistory.createdAt))
    .limit(10);

  return { lead: leadRow, historico };
}

function buildLeadSummaryText(lead: Awaited<ReturnType<typeof fetchLeadContext>>['lead'], historico: Awaited<ReturnType<typeof fetchLeadContext>>['historico']): string {
  const diasDesdeEntrada = Math.floor((Date.now() - lead.createdAt.getTime()) / 86_400_000);
  const diasSemInteracao = lead.ultimaInteracao
    ? Math.floor((Date.now() - lead.ultimaInteracao.getTime()) / 86_400_000)
    : diasDesdeEntrada;

  let texto = `Lead: ${lead.nome}\n`;
  texto += `Status atual: ${STATUS_LABELS[lead.status] || lead.status}\n`;
  if (lead.temperatura) texto += `Temperatura: ${lead.temperatura}\n`;
  texto += `Empreendimento: ${lead.projetoNome || lead.projetoCustom || 'não informado'}\n`;
  texto += `Origem: ${lead.origem || 'não informada'}\n`;
  texto += `Corretor: ${lead.corretorNome || 'não atribuído'}\n`;
  texto += `Dias na base: ${diasDesdeEntrada}\n`;
  texto += `Dias sem interação: ${diasSemInteracao}\n`;
  if (lead.faixaRenda) texto += `Renda informada: ${lead.faixaRenda}\n`;
  if (lead.usaFgts) texto += `Usa FGTS: sim\n`;
  if (lead.entradaDisponivel) texto += `Entrada disponível: ${lead.entradaDisponivel}\n`;
  if (lead.finalidadeImovel) texto += `Finalidade: ${lead.finalidadeImovel}\n`;
  if (lead.prefereContatoPor) texto += `Prefere contato por: ${lead.prefereContatoPor}\n`;
  if (lead.observacoes) texto += `Observações: ${lead.observacoes}\n`;

  if (historico.length > 0) {
    texto += `\nÚltimas interações (mais recentes primeiro):\n`;
    for (const h of historico) {
      const data = h.createdAt.toLocaleDateString('pt-BR');
      const tipo = INTERACTION_LABELS[h.tipo] || h.tipo;
      const resultado = RESULTADO_LABELS[h.resultado] || h.resultado;
      texto += `- ${data} | ${tipo} | ${resultado}`;
      if (h.observacoes) texto += ` | "${h.observacoes}"`;
      if (h.statusNovo) texto += ` | → ${STATUS_LABELS[h.statusNovo] || h.statusNovo}`;
      texto += '\n';
    }
  } else {
    texto += '\nSem interações registradas.\n';
  }

  return texto;
}

export const iaRouter = router({
  resumoLead: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      const { lead, historico } = await fetchLeadContext(input.leadId);
      const contexto = buildLeadSummaryText(lead, historico);

      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `Você é um assistente de CRM imobiliário. Analise os dados do lead e gere um resumo executivo conciso para o corretor. Responda em JSON puro sem markdown:\n{"resumo": "2-3 frases descrevendo o perfil e situação do lead", "pontosCriticos": ["ponto1", "ponto2"], "proximoFollowup": "sugestão de quando e como fazer próximo contato"}`,
          },
          { role: 'user', content: contexto },
        ],
      });

      try {
        const parsed = parseJsonFromLLM(extractTextContent(response)) as any;
        return {
          resumo: parsed.resumo as string,
          pontosCriticos: (parsed.pontosCriticos || []) as string[],
          proximoFollowup: parsed.proximoFollowup as string,
        };
      } catch {
        throw new Error('Erro ao processar resumo da IA. Tente novamente.');
      }
    }),

  sugestaoProximaAcao: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      const { lead, historico } = await fetchLeadContext(input.leadId);
      const contexto = buildLeadSummaryText(lead, historico);

      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `Você é um coach de vendas imobiliárias experiente em MCMV e lançamentos. Com base nos dados do lead, sugira a próxima ação mais eficaz para avançar no funil. Considere o status atual, histórico de interações e tempo sem contato. Responda em JSON puro sem markdown:\n{"acao": "descrição clara da próxima ação", "canal": "whatsapp|ligacao|email|visita", "urgencia": "imediata|hoje|essa_semana", "script": "mensagem ou roteiro sugerido para a ação (máximo 5 linhas)", "justificativa": "por que essa ação agora (1 frase)"}`,
          },
          { role: 'user', content: contexto },
        ],
      });

      try {
        const parsed = parseJsonFromLLM(extractTextContent(response)) as any;
        return {
          acao: parsed.acao as string,
          canal: parsed.canal as string,
          urgencia: parsed.urgencia as string,
          script: parsed.script as string,
          justificativa: parsed.justificativa as string,
        };
      } catch {
        throw new Error('Erro ao processar sugestão da IA. Tente novamente.');
      }
    }),

  classificarTemperatura: protectedProcedure
    .input(z.object({ leadId: z.number(), salvar: z.boolean().default(false) }))
    .mutation(async ({ input }) => {
      const { lead, historico } = await fetchLeadContext(input.leadId);
      const contexto = buildLeadSummaryText(lead, historico);

      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `Você é especialista em qualificação de leads imobiliários. Classifique a temperatura do lead com base no histórico e perfil. Critérios:\n- QUENTE: respondeu recentemente, demonstrou interesse claro, tem capacidade financeira, perguntou sobre condições\n- MORNO: algum contato mas sem comprometimento, interesse moderado, precisa de nutrição\n- FRIO: sem resposta há dias, negativa implícita, sem perfil financeiro confirmado, muito no início\nResponda em JSON puro sem markdown:\n{"temperatura": "quente|morno|frio", "confianca": "alta|media|baixa", "motivo": "justificativa em 1-2 frases"}`,
          },
          { role: 'user', content: contexto },
        ],
      });

      let parsed: { temperatura: string; confianca: string; motivo: string };
      try {
        parsed = parseJsonFromLLM(extractTextContent(response)) as { temperatura: string; confianca: string; motivo: string };
      } catch {
        throw new Error('Erro ao processar classificação da IA. Tente novamente.');
      }

      if (input.salvar && ['quente', 'morno', 'frio'].includes(parsed.temperatura)) {
        const db = await getDb();
        if (db) {
          await db.update(leads)
            .set({ temperatura: parsed.temperatura as 'quente' | 'morno' | 'frio' })
            .where(eq(leads.id, input.leadId));
        }
      }

      return {
        temperatura: parsed.temperatura as string,
        confianca: parsed.confianca as string,
        motivo: parsed.motivo as string,
      };
    }),

  gerarScriptWhatsApp: protectedProcedure
    .input(z.object({
      nomeCliente: z.string().min(1, 'Nome do cliente é obrigatório'),
      estagio: z.enum([
        'novo_portal', 'novo_indicacao', 'nao_respondeu', 'confirmacao_visita',
        'visitou_esfriou', 'base_fria', 'vou_pensar', 'ultima_tentativa',
      ]),
      gancho: z.string().optional(),
      empreendimento: z.string().optional(),
      regiao: z.string().optional(),
      indicador: z.string().optional(),
      nomeCorretor: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const estagioLabel = STAGES_LABELS[input.estagio] || input.estagio;
      const ganchoLabel = input.gancho ? HOOKS_LABELS[input.gancho] || input.gancho : 'Sem novidade específica';

      const context = `Gere mensagens para este lead:
- Nome do cliente: ${input.nomeCliente}
- Estágio: ${estagioLabel}
- Empreendimento: ${input.empreendimento || 'não informado'}
- Região: ${input.regiao || 'não informada'}
- Gancho disponível: ${ganchoLabel}
- Indicador (se aplicável): ${input.indicador || 'N/A'}
- Nome do corretor: ${input.nomeCorretor || '[Seu Nome]'}`;

      const response = await invokeLLM({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_WHATSAPP },
          { role: 'user', content: context },
        ],
      });

      try {
        const parsed = parseJsonFromLLM(extractTextContent(response)) as any;
        return {
          principal: parsed.principal as string,
          variacao: parsed.variacao as string,
          orientacao: parsed.orientacao as string,
          proximo_passo_sim: parsed.proximo_passo_sim as string,
          proximo_passo_nao: parsed.proximo_passo_nao as string,
        };
      } catch {
        throw new Error('Erro ao processar resposta da IA. Tente novamente.');
      }
    }),
});
