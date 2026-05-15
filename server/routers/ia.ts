import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { invokeLLM, type InvokeResult } from '../_core/llm';
import { getDb } from '../db';
import { leads, leadHistory, users, projects, notifications } from '../../drizzle/schema';
import { eq, desc, and, like, lte, inArray } from 'drizzle-orm';
import { tabeloes } from '../../drizzle/schema';
import { type FileContent } from '../_core/llm';
import { executarPriorizacaoDiaria } from '../agentePriorizacaoJob';

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


  // ── DICAS RAPIDAS PARA O CARD DO LEAD ──────────────────────────────────────
  // Gera 2-3 dicas objetivas para o corretor sem expor nomes de antigos proprietarios
  dicasRapidas: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponivel");

      const [leadRow] = await db
        .select({
          id: leads.id, nome: leads.nome, status: leads.status,
          temperatura: leads.temperatura, origem: leads.origem,
          projetoCustom: leads.projetoCustom, observacoes: leads.observacoes,
          createdAt: leads.createdAt, ultimaInteracao: leads.ultimaInteracao,
          faixaRenda: leads.faixaRenda, usaFgts: leads.usaFgts,
          entradaDisponivel: leads.entradaDisponivel,
          finalidadeImovel: leads.finalidadeImovel,
          prefereContatoPor: leads.prefereContatoPor,
          corretorId: leads.corretorId,
          projetoNome: projects.nome,
        })
        .from(leads)
        .leftJoin(projects, eq(leads.projectId, projects.id))
        .where(eq(leads.id, input.leadId))
        .limit(1);

      if (!leadRow) throw new Error("Lead nao encontrado");

      if (ctx.user.role === "corretor" && leadRow.corretorId !== ctx.user.id) {
        throw new Error("Acesso negado");
      }

      const historico = await db
        .select({
          tipo: leadHistory.tipo, resultado: leadHistory.resultado,
          observacoes: leadHistory.observacoes,
          statusAnterior: leadHistory.statusAnterior,
          statusNovo: leadHistory.statusNovo,
          createdAt: leadHistory.createdAt,
        })
        .from(leadHistory)
        .where(eq(leadHistory.leadId, input.leadId))
        .orderBy(desc(leadHistory.createdAt))
        .limit(8);

      const diasDesdeEntrada = Math.floor((Date.now() - leadRow.createdAt.getTime()) / 86_400_000);
      const diasSemInteracao = leadRow.ultimaInteracao
        ? Math.floor((Date.now() - leadRow.ultimaInteracao.getTime()) / 86_400_000)
        : diasDesdeEntrada;

      const parts: string[] = [];
      parts.push("Lead: " + leadRow.nome);
      parts.push("Status: " + (STATUS_LABELS[leadRow.status] || leadRow.status));
      if (leadRow.temperatura) parts.push("Temperatura: " + leadRow.temperatura);
      parts.push("Empreendimento: " + (leadRow.projetoNome || leadRow.projetoCustom || "nao informado"));
      parts.push("Origem: " + (leadRow.origem || "nao informada"));
      parts.push("Dias na base: " + diasDesdeEntrada);
      parts.push("Dias sem interacao: " + diasSemInteracao);
      if (leadRow.faixaRenda) parts.push("Faixa de renda: " + leadRow.faixaRenda);
      if (leadRow.usaFgts) parts.push("Usa FGTS: sim");
      if (leadRow.entradaDisponivel) parts.push("Entrada disponivel: " + leadRow.entradaDisponivel);
      if (leadRow.finalidadeImovel) parts.push("Finalidade: " + leadRow.finalidadeImovel);
      if (leadRow.prefereContatoPor) parts.push("Prefere contato por: " + leadRow.prefereContatoPor);
      if (leadRow.observacoes) parts.push("Observacoes: " + leadRow.observacoes);

      if (historico.length > 0) {
        parts.push("");
        parts.push("Historico de interacoes (" + historico.length + " registros, mais recentes primeiro):");
        for (const h of historico) {
          const data = h.createdAt.toLocaleDateString("pt-BR");
          const tipo = INTERACTION_LABELS[h.tipo] || h.tipo;
          const resultado = RESULTADO_LABELS[h.resultado] || h.resultado;
          let linha = "- " + data + " | " + tipo + " | " + resultado;
          if (h.observacoes) linha += " | [" + h.observacoes + "]";
          if (h.statusNovo) linha += " | -> " + (STATUS_LABELS[h.statusNovo] || h.statusNovo);
          parts.push(linha);
        }
      } else {
        parts.push("");
        parts.push("Sem interacoes registradas ainda.");
      }

      const contexto = parts.join("\n");

      const systemPrompt = [
        "Voce e um coach de vendas imobiliarias especializado em MCMV.",
        "Analise os dados do lead e gere dicas rapidas e objetivas para o corretor agir agora.",
        "",
        "REGRAS:",
        "- Maximo 3 dicas, cada uma com no maximo 2 linhas",
        "- Foco em acao imediata: o que fazer AGORA com esse lead",
        "- Identifique riscos (lead esfriando, sem resposta, objecao provavel)",
        "- Identifique oportunidades (perfil qualificado, momento certo, canal preferido)",
        "- NAO mencione nomes de corretores anteriores",
        "- NAO invente dados que nao estao no contexto",
        "- Tom direto, pratico, como um gerente experiente falando com o corretor",
        "",
        "Responda em JSON puro sem markdown:",
        "{",
        '  "dicas": [',
        '    {"tipo": "alerta|oportunidade|acao", "emoji": "emoji aqui", "texto": "dica objetiva em 1-2 linhas"},',
        "    ...",
        "  ],",
        '  "prioridade": "alta|media|baixa",',
        '  "resumo_curto": "frase de 5-8 palavras descrevendo o momento do lead"',
        "}",
      ].join("\n");

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: contexto },
        ],
      });

      try {
        const parsed = parseJsonFromLLM(extractTextContent(response)) as any;
        return {
          dicas: (parsed.dicas || []) as Array<{ tipo: string; emoji: string; texto: string }>,
          prioridade: (parsed.prioridade || "media") as string,
          resumo_curto: (parsed.resumo_curto || "") as string,
        };
      } catch {
        throw new Error("Erro ao processar dicas da IA.");
      }
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

  // ─── Agente 3: Priorização Diária ────────────────────────────────────────

  priorizacaoHoje: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { prioridades: [], geradoEm: null };

      const hoje = new Date().toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).split('/').reverse().join('-');

      const [notif] = await db
        .select({ mensagem: notifications.mensagem, createdAt: notifications.createdAt })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, ctx.user.id),
            like(notifications.titulo, '[IA] Leads prioritários de hoje%'),
          ),
        )
        .orderBy(desc(notifications.createdAt))
        .limit(1);

      if (!notif) return { prioridades: [], geradoEm: null };

      // Verificar se a notificação é de hoje
      const notifDate = notif.createdAt.toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
      }).split('/').reverse().join('-');

      if (notifDate !== hoje) return { prioridades: [], geradoEm: null };

      try {
        const prioridades = JSON.parse(notif.mensagem);
        return { prioridades, geradoEm: notif.createdAt };
      } catch {
        return { prioridades: [], geradoEm: null };
      }
    }),

  gerarPriorizacaoAgora: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Permite que o corretor gere manualmente (ignora o cache diário)
      const db = await getDb();
      if (!db) throw new Error('Banco indisponível');

      const { leads: leadsTable, projects: projetosTable } = await import('../../drizzle/schema');
      const { ne } = await import('drizzle-orm');

      const leadsDoCorretor = await db
        .select({
          id: leadsTable.id,
          nome: leadsTable.nome,
          status: leadsTable.status,
          temperatura: leadsTable.temperatura,
          faixaRenda: leadsTable.faixaRenda,
          ultimaInteracao: leadsTable.ultimaInteracao,
          createdAt: leadsTable.createdAt,
          proximoFollowup: leadsTable.proximoFollowup,
          projetoNome: projetosTable.nome,
          projetoCustom: leadsTable.projetoCustom,
          observacoes: leadsTable.observacoes,
        })
        .from(leadsTable)
        .leftJoin(projetosTable, eq(leadsTable.projectId, projetosTable.id))
        .where(
          and(
            eq(leadsTable.corretorId, ctx.user.id),
            ne(leadsTable.status, 'perdido'),
            ne(leadsTable.status, 'contrato_fechado'),
            eq(leadsTable.naLixeira, false),
          ),
        )
        .limit(40);

      if (leadsDoCorretor.length === 0) return { prioridades: [], geradoEm: new Date() };

      const STATUS_LABELS: Record<string, string> = {
        novo: 'Novo', aguardando_atendimento: 'Aguardando', em_atendimento: 'Em Atendimento',
        qualificado: 'Qualificado', agendado: 'Agendado', visita_realizada: 'Visita Realizada',
        proposta_enviada: 'Proposta Enviada', analise_credito: 'Análise Crédito', pos_venda: 'Pós-Venda',
      };

      const contexto = leadsDoCorretor.map((lead) => {
        const diasDesdeEntrada = Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / 86_400_000);
        const diasSemInteracao = lead.ultimaInteracao
          ? Math.floor((Date.now() - new Date(lead.ultimaInteracao).getTime()) / 86_400_000)
          : diasDesdeEntrada;
        let linha = `ID:${lead.id} | ${lead.nome} | Status:${STATUS_LABELS[lead.status] || lead.status}`;
        if (lead.temperatura) linha += ` | Temp:${lead.temperatura}`;
        if (lead.faixaRenda) linha += ` | Renda:${lead.faixaRenda}`;
        if (lead.projetoNome || lead.projetoCustom) linha += ` | Projeto:${lead.projetoNome || lead.projetoCustom}`;
        linha += ` | DiasBase:${diasDesdeEntrada} | DiasSemContato:${diasSemInteracao}`;
        return linha;
      }).join('\n');

      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `Você é um coach de vendas imobiliárias. Analise a carteira e escolha os 5 leads mais urgentes para contato HOJE. Responda SOMENTE em JSON puro sem markdown:\n{"prioridades":[{"leadId":N,"leadNome":"...","motivo":"motivo em 1 frase","acao":"ação concreta a fazer hoje"}]}`,
          },
          { role: 'user', content: contexto },
        ],
      });

      const parsed = parseJsonFromLLM(extractTextContent(response)) as any;
      const prioridades = (parsed.prioridades || []).slice(0, 5);
      const agora = new Date();

      // Salvar/atualizar na tabela notifications
      await db.insert(notifications).values({
        userId: ctx.user.id,
        titulo: `[IA] Leads prioritários de hoje — ${agora.toLocaleDateString('pt-BR')}`,
        mensagem: JSON.stringify(prioridades),
        tipo: 'sistema',
        lida: false,
      });

      return { prioridades, geradoEm: agora };
    }),

  // ─── Agente 1: Análise Pós-Interação ─────────────────────────────────────

  analisarLeadPosInteracao: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .mutation(async ({ input }) => {
      const { lead, historico } = await fetchLeadContext(input.leadId);
      const contexto = buildLeadSummaryText(lead, historico);

      const [tempResponse, acaoResponse] = await Promise.all([
        invokeLLM({
          messages: [
            {
              role: 'system',
              content: `Você é especialista em qualificação de leads imobiliários. Classifique a temperatura do lead. QUENTE: respondeu recentemente, interesse claro, capacidade financeira. MORNO: algum contato mas sem comprometimento. FRIO: sem resposta, negativa implícita, sem perfil confirmado.\nResponda em JSON puro sem markdown:\n{"temperatura":"quente|morno|frio","confianca":"alta|media|baixa","motivo":"justificativa em 1 frase"}`,
            },
            { role: 'user', content: contexto },
          ],
        }),
        invokeLLM({
          messages: [
            {
              role: 'system',
              content: `Você é um coach de vendas imobiliárias MCMV. Sugira a próxima ação mais eficaz com base no histórico do lead. Responda em JSON puro sem markdown:\n{"acao":"descrição clara","canal":"whatsapp|ligacao|email|visita","urgencia":"imediata|hoje|essa_semana","script":"mensagem sugerida (máx 5 linhas)","justificativa":"por que essa ação agora (1 frase)"}`,
            },
            { role: 'user', content: contexto },
          ],
        }),
      ]);

      const tempParsed = parseJsonFromLLM(extractTextContent(tempResponse)) as any;
      const acaoParsed = parseJsonFromLLM(extractTextContent(acaoResponse)) as any;

      // Salvar temperatura automaticamente se válida
      if (['quente', 'morno', 'frio'].includes(tempParsed.temperatura)) {
        const db = await getDb();
        if (db) {
          await db.update(leads)
            .set({ temperatura: tempParsed.temperatura as 'quente' | 'morno' | 'frio' })
            .where(eq(leads.id, input.leadId));
        }
      }

      return {
        temperatura: tempParsed.temperatura as string,
        motivoTemperatura: tempParsed.motivo as string,
        proximaAcao: acaoParsed.acao as string,
        canal: acaoParsed.canal as string,
        urgencia: acaoParsed.urgencia as string,
        script: acaoParsed.script as string,
        justificativa: acaoParsed.justificativa as string,
      };
    }),

  // ─── Buscador de Projetos IA ─────────────────────────────────────────────

  buscarProjetosPorDescricao: protectedProcedure
    .input(z.object({
      descricao: z.string().min(10).max(1000),
      leadId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Banco indisponível');

      // Etapa 1: Extrair filtros estruturados da linguagem natural
      const filtrosResponse = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `Extraia filtros estruturados de uma descrição de busca imobiliária em São Paulo. Responda SOMENTE em JSON puro sem markdown:
{"zona":"norte|sul|leste|oeste|centro|null","dormitoriosMin":N_ou_null,"dormitoriosMax":N_ou_null,"vagasMax":N_ou_null,"precoMaximo":N_em_reais_sem_centavos_ou_null,"tipo":"mcmv|sfh|outro|null","enquadramento":"HIS1|HIS2|HMP|R2V|null","precisaLerPDF":true_se_busca_menciona_entrega_disponibilidade_ou_tipologia_especifica_de_planta,"palavrasChave":["termo1","termo2"]}
Regras: precoMaximo sempre em reais inteiros (ex: 300000). vagasMax=0 significa "sem vaga". null para campos não mencionados.`,
          },
          { role: 'user', content: input.descricao },
        ],
      });

      let filtros: {
        zona?: string; dormitoriosMin?: number; dormitoriosMax?: number;
        vagasMax?: number; precoMaximo?: number; tipo?: string;
        enquadramento?: string; precisaLerPDF?: boolean; palavrasChave?: string[];
      } = {};
      try {
        filtros = parseJsonFromLLM(extractTextContent(filtrosResponse)) as typeof filtros;
      } catch {
        filtros = {};
      }
      console.log('[Buscador IA] Filtros extraídos:', filtros);

      // Etapa 2: Query ao banco com filtros estruturados
      const conditions: Parameters<typeof and>[0][] = [eq(projects.status, 'ativo')];
      if (filtros.zona && ['norte', 'sul', 'leste', 'oeste', 'centro'].includes(filtros.zona)) {
        conditions.push(eq(projects.zona, filtros.zona as 'norte' | 'sul' | 'leste' | 'oeste' | 'centro'));
      }
      if (filtros.precoMaximo && typeof filtros.precoMaximo === 'number') {
        conditions.push(lte(projects.valorMinimo, filtros.precoMaximo * 100));
      }
      if (filtros.vagasMax === 0) {
        conditions.push(eq(projects.vagas, 0));
      }
      if (filtros.tipo && ['mcmv', 'sfh', 'outro'].includes(filtros.tipo)) {
        conditions.push(eq(projects.tipo, filtros.tipo as 'mcmv' | 'sfh' | 'outro'));
      }
      if (filtros.enquadramento && ['HIS1', 'HIS2', 'HMP', 'R2V'].includes(filtros.enquadramento)) {
        conditions.push(eq(projects.enquadramento, filtros.enquadramento as 'HIS1' | 'HIS2' | 'HMP' | 'R2V'));
      }

      const projetosBanco = await db
        .select({
          id: projects.id, nome: projects.nome, construtora: projects.construtora,
          construtoraId: projects.construtoraId, bairro: projects.bairro,
          zona: projects.zona, tipo: projects.tipo, enquadramento: projects.enquadramento,
          dormitorios: projects.dormitorios, vagas: projects.vagas,
          valorMinimo: projects.valorMinimo, valorMaximo: projects.valorMaximo,
          metragemMinima: projects.metragemMinima, metragemMaxima: projects.metragemMaxima,
          descricao: projects.descricao, bookPdfUrl: projects.bookPdfUrl,
        })
        .from(projects)
        .where(and(...conditions))
        .limit(30);

      // Filtrar dormitórios em memória (campo é string como "1, 2")
      let projetosValidos = projetosBanco;
      if (filtros.dormitoriosMax != null) {
        projetosValidos = projetosValidos.filter(p => {
          if (!p.dormitorios) return true;
          const nums = p.dormitorios.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
          return nums.length === 0 || nums.some(n => n <= filtros.dormitoriosMax!);
        });
      }
      if (filtros.dormitoriosMin != null) {
        projetosValidos = projetosValidos.filter(p => {
          if (!p.dormitorios) return true;
          const nums = p.dormitorios.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
          return nums.length === 0 || nums.some(n => n >= filtros.dormitoriosMin!);
        });
      }
      console.log(`[Buscador IA] ${projetosValidos.length} projetos filtrados do banco`);

      // Etapa 3: Enriquecer com PDFs das tabelões quando necessário
      const fileContents: FileContent[] = [];
      if (filtros.precisaLerPDF && projetosValidos.length > 0) {
        const construtoraIds = [...new Set(projetosValidos.map(p => p.construtoraId).filter(Boolean))] as number[];
        if (construtoraIds.length > 0) {
          const tabsRecentes = await db
            .select({ s3PdfUrl: tabeloes.s3PdfUrl })
            .from(tabeloes)
            .where(
              and(
                inArray(tabeloes.construtoraId, construtoraIds),
                eq(tabeloes.statusProcessamento, 'concluido'),
              ),
            )
            .orderBy(desc(tabeloes.ano), desc(tabeloes.mes))
            .limit(3);

          for (const tab of tabsRecentes) {
            if (tab.s3PdfUrl) {
              fileContents.push({ type: 'file_url', file_url: { url: tab.s3PdfUrl, mime_type: 'application/pdf' } });
            }
          }
        }

        // Incluir books dos top projetos como fonte adicional
        for (const p of projetosValidos.slice(0, 2)) {
          if (p.bookPdfUrl && fileContents.length < 5) {
            fileContents.push({ type: 'file_url', file_url: { url: p.bookPdfUrl, mime_type: 'application/pdf' } });
          }
        }
        console.log(`[Buscador IA] Anexando ${fileContents.length} PDFs para análise`);
      }

      // Etapa 4: Ranquear e explicar com LLM
      const catalogoTexto = projetosValidos.length > 0
        ? projetosValidos.map(p => {
            const precoMin = p.valorMinimo ? `R$${(p.valorMinimo / 100).toLocaleString('pt-BR')}` : 'N/I';
            const precoMax = p.valorMaximo ? `-${(p.valorMaximo / 100).toLocaleString('pt-BR')}` : '';
            const metragem = p.metragemMinima
              ? `${p.metragemMinima}${p.metragemMaxima ? `-${p.metragemMaxima}` : ''}m²`
              : 'N/I';
            return `ID:${p.id} | ${p.nome} | ${p.construtora || 'N/I'} | Zona:${p.zona || 'N/I'} | ${p.tipo?.toUpperCase() || ''} | Dorms:${p.dormitorios || 'N/I'} | Vagas:${p.vagas ?? 'N/I'} | ${precoMin}${precoMax} | ${metragem} | Bairro:${p.bairro || 'N/I'}`;
          }).join('\n')
        : 'Nenhum projeto encontrado com os filtros aplicados.';

      const userContent: (FileContent | { type: 'text'; text: string })[] = [
        { type: 'text', text: `Busca do corretor: "${input.descricao}"\n\nProjetos disponíveis no catálogo:\n${catalogoTexto}` },
        ...fileContents,
      ];

      const rankingResponse = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em produtos imobiliários MCMV e lançamentos de São Paulo. Analise os projetos disponíveis e a busca do corretor para identificar os melhores matches.

IMPORTANTE — leitura de tabelões: tabelões têm múltiplas linhas por tipologia onde cada bloco de linhas representa UMA tipologia diferente. Identifique: nome do empreendimento, tipologia (ex: "Apto 2 dorms Tipo B"), metragem, preço por tipologia, vagas e disponibilidade. Se houver PDFs anexados, use-os para enriquecer com dados de entrega, disponibilidade e preços por tipologia.

Responda SOMENTE em JSON puro sem markdown:
{"projetos":[{"id":N,"nome":"...","construtora":"...","tipologiaRecomendada":"tipologia específica se souber, senão melhor opção estimada","precoEstimado":N_em_reais_inteiro_ou_null,"motivo":"por que este projeto atende a busca (1-2 frases)","pontuacao":N_de_1_a_10}],"resumo":"resumo dos resultados encontrados (2-3 frases)","filtrosUsados":{"zona":"...","dormitorios":"...","precoMaximo":"..."}}`,
          },
          { role: 'user', content: userContent as Parameters<typeof invokeLLM>[0]['messages'][0]['content'] },
        ],
      });

      const parsed = parseJsonFromLLM(extractTextContent(rankingResponse)) as {
        projetos: Array<{ id: number; nome: string; construtora: string; tipologiaRecomendada: string; precoEstimado: number | null; motivo: string; pontuacao: number }>;
        resumo: string;
        filtrosUsados: Record<string, string>;
      };

      return {
        projetos: parsed.projetos || [],
        resumo: parsed.resumo || '',
        filtrosUsados: parsed.filtrosUsados || {},
        totalFiltrados: projetosValidos.length,
      };
    }),

  // ─── Agente 2: Follow-up com Mensagem IA ─────────────────────────────────

  gerarMensagemFollowup: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .mutation(async ({ input }) => {
      const { lead, historico } = await fetchLeadContext(input.leadId);
      const contexto = buildLeadSummaryText(lead, historico);

      const diasSemContato = lead.ultimaInteracao
        ? Math.floor((Date.now() - new Date(lead.ultimaInteracao).getTime()) / 86_400_000)
        : Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / 86_400_000);

      const response = await invokeLLM({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_WHATSAPP },
          {
            role: 'user',
            content: `${contexto}\n\nSituação atual: ${diasSemContato} dia(s) sem contato. Gere uma mensagem de follow-up WhatsApp personalizada para reengajar este lead usando a fórmula G.P.V.A.`,
          },
        ],
      });

      const parsed = parseJsonFromLLM(extractTextContent(response)) as any;
      return {
        principal: parsed.principal as string,
        variacao: parsed.variacao as string,
        orientacao: parsed.orientacao as string,
        proximo_passo_sim: parsed.proximo_passo_sim as string,
        proximo_passo_nao: parsed.proximo_passo_nao as string,
        diasSemContato,
      };
    }),
});
