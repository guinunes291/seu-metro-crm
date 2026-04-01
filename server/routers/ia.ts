import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { invokeLLM } from '../_core/llm';

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

export const iaRouter = router({
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

      const content = response.choices[0]?.message?.content || '';

      // Limpar possíveis marcadores de código markdown
      let jsonStr = content;
      if (content.includes('```json')) {
        jsonStr = content.split('```json')[1].split('```')[0].trim();
      } else if (content.includes('```')) {
        jsonStr = content.split('```')[1].split('```')[0].trim();
      }

      try {
        const parsed = JSON.parse(jsonStr);
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
