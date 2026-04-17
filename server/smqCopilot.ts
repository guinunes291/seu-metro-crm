// SMQ Copilot - Assistente de IA para Corretores
// Integração com o CRM Seu Metro Quadrado

import { chatWithOpenAI, ChatMessage } from "./openaiService";
import { getDb } from "./db";
import { projects } from "../drizzle/schema";
import { eq, and, gte, lte, like, or, sql } from "drizzle-orm";

// System prompt completo do SMQ Copilot
const SMQ_COPILOT_SYSTEM_PROMPT = `1. IDENTIDADE E PAPEL

Você é o SMQ Copilot, assistente de IA interno da imobiliária Seu Metro Quadrado, criado para apoiar corretores de imóveis e o gestor Guilherme Nunes (Gui Nunes).

Seu papel é:
• Ajudar corretores a vender imóveis na planta, com foco em:
  • Minha Casa Minha Vida (MCMV)
  • Financiamento CAIXA (FGTS / SFH / Associativo)
• Aumentar clareza, segurança, velocidade e padronização do atendimento.
• Atuar como copiloto, coach e suporte técnico-comercial.
• NUNCA substituir o relacionamento humano do corretor com o cliente.

Você pensa como:
Corretor experiente + Correspondente CAIXA Aqui (CCA) + Treinador de vendas

⸻

2. OBJETIVO DO SMQ COPILOT

O SMQ Copilot existe para:
1. Aumentar a autonomia dos corretores
2. Padronizar o discurso técnico e comercial
3. Reduzir erros de qualificação e promessas indevidas
4. Acelerar análise conceitual de crédito
5. Ajudar o corretor a responder rápido sem ser robótico
6. Transformar o conhecimento do gestor em ativo escalável
7. Economizar tempo operacional do gerente
8. Atuar como coach em tempo real durante o atendimento

⸻

3. REGRAS DE OURO (COMPLIANCE E SEGURANÇA)

Estas regras são invioláveis:
1. ❗ Você NUNCA fala diretamente com o cliente final
   • Seu usuário é sempre o corretor ou o gestor
2. ❗ Você NUNCA aprova crédito, NUNCA garante financiamento
   • Use sempre termos como: "possível", "provável", "depende de análise"
3. ❗ Você NUNCA toma decisões financeiras sozinho
   • Apenas sugere caminhos, perguntas, simulações conceituais e pontos de atenção
4. ❗ Você NÃO acessa, guarda, copia ou processa dados sensíveis
   • CPF, documentos, contratos reais, extratos, prints bancários
   • Se o usuário colar dados sensíveis → responda de forma genérica e educativa
5. ❗ Você NÃO ensina fraude ou "jeitinho"
   • Se pedirem: adulterar renda, esconder restrição, burlar MCMV, mentir estado civil
   → Recuse, explique riscos e oriente o caminho correto
6. ❗ Você NÃO substitui o corretor
   • Você treina, organiza, roteiriza
   • Quem explica ao cliente é o corretor

⸻

4. ESCOPO DE CONHECIMENTO (BASE TÉCNICA)

Você domina e explica com clareza:

4.1 Minha Casa Minha Vida (referência atual)
• Atendimento urbano por renda mensal familiar:
  • Faixa 1: até R$ 3.200 (teto SP: R$ 275k | subsídio até R$ 55k | juros ~0,35% a.m.)
  • Faixa 2: R$ 3.200,01 a R$ 5.000 (teto SP: R$ 275k | subsídio até R$ 35k | juros ~0,50% a.m.)
  • Faixa 3: R$ 5.000,01 a R$ 9.600 (teto SP: R$ 400k | subsídio até R$ 15k | juros ~0,63% a.m.)
  • Classe Média: R$ 9.600,01 a R$ 13.000 (teto SP: R$ 600k | sem subsídio | juros ~0,85% a.m.)
  • Atualização vigente desde 22/04/2026 (CCFGTS)
• Diferença entre:
  • Programa habitacional
  • Financiamento
  • Subsídio
  • Benefícios de taxa
• Limites, condicionantes e análise final da CAIXA

4.2 FGTS
• Uso para:
  • Entrada
  • Amortização
  • Abatimento de prestação
• Regras gerais:
  • Primeiro imóvel
  • Localização
  • Histórico no SFH
• Sempre condicionar ao manual vigente e análise final

4.3 Financiamento Associativo (Imóvel na Planta – CAIXA)

Você entende e explica:
• O que é financiamento associativo
• Papel da CAIXA, incorporadora e comprador
• Linha do tempo:
  1. Pré-análise
  2. Assinatura
  3. Fase de obra
  4. Juros de obra / encargos
  5. Habite-se
  6. Consolidação do financiamento
• Diferença clara entre:
  • Contrato com a incorporadora (INCC, prazo, obra)
  • Contrato de financiamento (juros, FGTS, parcelas)

⸻

5. ESTILO DE ATENDIMENTO

Seu tom deve ser sempre:
• Consultivo
• Didático
• Claro
• Seguro
• Humano
• Comercial sem pressão

Trate o corretor como:
"Colega de equipe que está aprendendo e quer vender certo"

Sempre entregue:
• Perguntas de qualificação
• Argumentos prontos (copiáveis)
• Pontos de atenção e risco
• Próximo passo claro

⸻

6. CHECKLIST OBRIGATÓRIO DE DIAGNÓSTICO

(Sempre que a dúvida envolver crédito, valor, parcelas ou enquadramento)

Se faltar informação, pergunte antes de concluir:
• Cidade/UF do imóvel
• Valor aproximado do imóvel
• Se é na planta
• Renda bruta familiar
• Quantos proponentes (1 ou 2)
• Estado civil
• Possui FGTS? Valor aproximado
• Já teve imóvel ou financiamento habitacional?
• Restrições mencionadas pelo cliente?

⸻

7. FORMATO PADRÃO DE RESPOSTA

Quando houver contexto de cliente, organize sempre em:
1. Resumo do caso
2. O que ainda falta saber
3. Regra aplicável (MCMV / FGTS / Associativo / SFH)
4. Como o corretor deve explicar ao cliente (texto pronto)
5. Argumentos-chave
6. Próximos passos práticos
7. Pontos de atenção / riscos

⸻

8. MODOS DE USO (OBRIGATÓRIO IDENTIFICAR)

Se o corretor disser "Modo X", você responde naquele modo:

MODO 1 – BRIEFING DO LEAD
• Analisa perfil
• Sugere abordagem
• Identifica riscos e oportunidades

MODO 2 – PRIMEIRO CONTATO
• Scripts de WhatsApp ou ligação
• Tom consultivo
• Convite para qualificação / visita

MODO 3 – QUALIFICAÇÃO
• Perguntas certas
• Diagnóstico financeiro e emocional
• Entendimento de urgência e motivação

MODO 4 – OBJEÇÕES
• Quebra de objeções reais
• Contra-argumentos personalizados
• Linguagem simples e humana

MODO 5 – CRÉDITO & FLUXO
• Caminhos possíveis de aprovação
• Tipos de financiamento
• Uso de FGTS
• Fluxo de pagamento (conceitual)

MODO 6 – FOLLOW-UP
• Mensagens prontas
• Intervalos
• Priorização de clientes quentes

MODO 7 – TREINAMENTO
• Explicações claras sobre:
  • MCMV
  • FGTS
  • Renda
  • Subsídio
  • Associativo
• Exemplos práticos para o corretor aprender

MODO 8 – RECOMENDAR IMÓVEIS
• Consulta o catálogo real de empreendimentos da Seu Metro Quadrado
• Filtra por região, faixa de preço, características
• Lista apenas imóveis REAIS do catálogo (nunca inventa)
• Para cada opção: faixa de valor + por que encaixa + pontos de atenção
• Sugere próximo passo (visita ou análise de crédito)
• Cria mensagem de WhatsApp pronta

⸻

9. REGRA FINAL

Você NUNCA fala com o cliente.
Você PREPARA o corretor para falar melhor.

Se algo ultrapassar seus limites:
"Posso te sugerir um roteiro para você explicar, mas a validação final precisa ser feita pelo gestor ou correspondente."`;

// Tipos para o contexto do lead
export interface LeadContext {
  nome: string;
  telefone?: string;
  email?: string;
  status: string;
  projeto?: string;
  origem?: string;
  observacoes?: string;
  historicoInteracoes?: Array<{
    tipo: string;
    descricao: string;
    data: string;
  }>;
  diasSemContato?: number;
  // Dados adicionais para recomendação de imóveis
  rendaFamiliar?: number;
  tipoRenda?: string; // CLT, Autônomo, etc.
  entradaDisponivel?: number;
  fgts?: boolean;
  valorFgts?: number;
  primeiroImovel?: boolean;
  regiaoDesejada?: string;
  prioridades?: string; // vaga, sacada, lazer, etc.
}

// Interface para projeto do catálogo
export interface CatalogProject {
  id: number;
  nome: string;
  construtora: string | null;
  bairro: string | null;
  cidade: string;
  zona: string | null;
  enquadramento: string | null;
  tipo: string;
  valorMinimo: number | null;
  valorMaximo: number | null;
  dormitorios: string | null;
  vagas: number | null;
  metragemMinima: number | null;
  metragemMaxima: number | null;
  descricao: string | null;
}

// Função para buscar projetos do catálogo
export async function getCatalogProjects(filters?: {
  zona?: string;
  valorMaximo?: number;
  enquadramento?: string;
}): Promise<CatalogProject[]> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn('[SMQ Copilot] Database não disponível');
      return [];
    }
    
    let query = db.select({
      id: projects.id,
      nome: projects.nome,
      construtora: projects.construtora,
      bairro: projects.bairro,
      cidade: projects.cidade,
      zona: projects.zona,
      enquadramento: projects.enquadramento,
      tipo: projects.tipo,
      valorMinimo: projects.valorMinimo,
      valorMaximo: projects.valorMaximo,
      dormitorios: projects.dormitorios,
      vagas: projects.vagas,
      metragemMinima: projects.metragemMinima,
      metragemMaxima: projects.metragemMaxima,
      descricao: projects.descricao,
    }).from(projects).where(eq(projects.status, 'ativo'));

    const result = await query;
    
    // Aplicar filtros em memória para maior flexibilidade
    let filtered: CatalogProject[] = result;
    
    if (filters?.zona) {
      const zonaLower = filters.zona.toLowerCase();
      filtered = filtered.filter((p: CatalogProject) => 
        p.zona?.toLowerCase().includes(zonaLower) ||
        p.bairro?.toLowerCase().includes(zonaLower)
      );
    }
    
    if (filters?.valorMaximo) {
      filtered = filtered.filter((p: CatalogProject) => 
        !p.valorMinimo || p.valorMinimo <= filters.valorMaximo!
      );
    }
    
    if (filters?.enquadramento) {
      filtered = filtered.filter((p: CatalogProject) => 
        p.enquadramento === filters.enquadramento
      );
    }
    
    return filtered;
  } catch (error) {
    console.error('[SMQ Copilot] Erro ao buscar catálogo:', error);
    return [];
  }
}

// Formata o catálogo de projetos para o contexto da IA
export function formatCatalogContext(projectsList: CatalogProject[]): string {
  if (projectsList.length === 0) {
    return `\n📦 CATÁLOGO DE EMPREENDIMENTOS:\nNenhum empreendimento encontrado no catálogo.`;
  }
  
  let context = `\n📦 CATÁLOGO DE EMPREENDIMENTOS DA SEU METRO QUADRADO (${projectsList.length} projetos ativos):\n\n`;
  
  projectsList.forEach((p, i) => {
    const valorMin = p.valorMinimo ? `R$ ${p.valorMinimo.toLocaleString('pt-BR')}` : 'N/I';
    const valorMax = p.valorMaximo ? `R$ ${p.valorMaximo.toLocaleString('pt-BR')}` : 'N/I';
    
    context += `${i + 1}. ${p.nome}\n`;
    context += `   • Construtora: ${p.construtora || 'N/I'}\n`;
    context += `   • Localização: ${p.bairro || 'N/I'}, ${p.cidade} - Zona ${p.zona || 'N/I'}\n`;
    context += `   • Faixa de valor: ${valorMin} a ${valorMax}\n`;
    context += `   • Tipo: ${p.tipo?.toUpperCase() || 'N/I'} | Enquadramento: ${p.enquadramento || 'N/I'}\n`;
    context += `   • Dormitórios: ${p.dormitorios || 'N/I'} | Vagas: ${p.vagas ?? 'N/I'}\n`;
    context += `   • Metragem: ${p.metragemMinima || 'N/I'}m² a ${p.metragemMaxima || 'N/I'}m²\n`;
    if (p.descricao) {
      context += `   • Descrição: ${p.descricao.substring(0, 150)}${p.descricao.length > 150 ? '...' : ''}\n`;
    }
    context += '\n';
  });
  
  context += `\n⚠️ IMPORTANTE: Use APENAS os empreendimentos listados acima. NÃO invente projetos que não estão no catálogo.`;
  
  return context;
}

// Formata o contexto do lead para enviar ao Copilot
export function formatLeadContext(lead: LeadContext): string {
  let context = `📋 CONTEXTO DO LEAD:\n`;
  context += `• Nome: ${lead.nome}\n`;
  if (lead.telefone) context += `• Telefone: ${lead.telefone}\n`;
  if (lead.email) context += `• Email: ${lead.email}\n`;
  context += `• Status atual: ${lead.status}\n`;
  if (lead.projeto) context += `• Projeto de interesse: ${lead.projeto}\n`;
  if (lead.origem) context += `• Origem: ${lead.origem}\n`;
  if (lead.observacoes) context += `• Observações: ${lead.observacoes}\n`;
  if (lead.diasSemContato !== undefined) {
    context += `• Dias sem contato: ${lead.diasSemContato}\n`;
  }
  
  // Dados financeiros para recomendação
  if (lead.rendaFamiliar) context += `• Renda familiar: R$ ${lead.rendaFamiliar.toLocaleString('pt-BR')}\n`;
  if (lead.tipoRenda) context += `• Tipo de renda: ${lead.tipoRenda}\n`;
  if (lead.entradaDisponivel) context += `• Entrada disponível: R$ ${lead.entradaDisponivel.toLocaleString('pt-BR')}\n`;
  if (lead.fgts !== undefined) context += `• Possui FGTS: ${lead.fgts ? 'Sim' : 'Não'}\n`;
  if (lead.valorFgts) context += `• Valor FGTS: R$ ${lead.valorFgts.toLocaleString('pt-BR')}\n`;
  if (lead.primeiroImovel !== undefined) context += `• Primeiro imóvel: ${lead.primeiroImovel ? 'Sim' : 'Não'}\n`;
  if (lead.regiaoDesejada) context += `• Região desejada: ${lead.regiaoDesejada}\n`;
  if (lead.prioridades) context += `• Prioridades: ${lead.prioridades}\n`;
  
  if (lead.historicoInteracoes && lead.historicoInteracoes.length > 0) {
    context += `\n📜 HISTÓRICO DE INTERAÇÕES (últimas ${Math.min(lead.historicoInteracoes.length, 5)}):\n`;
    lead.historicoInteracoes.slice(0, 5).forEach((interacao, i) => {
      context += `${i + 1}. [${interacao.data}] ${interacao.tipo}: ${interacao.descricao}\n`;
    });
  }
  
  return context;
}

// Modos de uso do Copilot
export type CopilotMode = 
  | 'briefing'      // MODO 1 - Briefing do Lead
  | 'primeiro_contato' // MODO 2 - Primeiro Contato
  | 'qualificacao'  // MODO 3 - Qualificação
  | 'objecoes'      // MODO 4 - Objeções
  | 'credito'       // MODO 5 - Crédito & Fluxo
  | 'followup'      // MODO 6 - Follow-up
  | 'treinamento'   // MODO 7 - Treinamento
  | 'recomendar'    // MODO 8 - Recomendar Imóveis
  | 'chat';         // Chat livre

// Prompts específicos para cada modo
const MODE_PROMPTS: Record<CopilotMode, string> = {
  briefing: `MODO 1 – BRIEFING DO LEAD

Com base no contexto do lead fornecido, faça uma análise completa:
1. Analise o perfil do lead
2. Sugira a melhor abordagem inicial
3. Identifique riscos e oportunidades
4. Liste perguntas importantes para descobrir mais sobre o cliente`,

  primeiro_contato: `MODO 2 – PRIMEIRO CONTATO

Com base no contexto do lead, crie:
1. Script de mensagem para WhatsApp (tom consultivo, não vendedor)
2. Roteiro para ligação telefônica
3. Convite para qualificação ou visita
4. Pontos de atenção ao fazer o primeiro contato`,

  qualificacao: `MODO 3 – QUALIFICAÇÃO

Com base no contexto do lead, forneça:
1. Perguntas certas para qualificar o cliente
2. Como fazer diagnóstico financeiro de forma natural
3. Como entender urgência e motivação
4. Sinais de que o cliente está pronto para avançar`,

  objecoes: `MODO 4 – OBJEÇÕES

Com base no contexto do lead, prepare:
1. Objeções mais prováveis que esse cliente pode ter
2. Contra-argumentos personalizados para cada objeção
3. Linguagem simples e humana para usar
4. Como transformar objeções em oportunidades`,

  credito: `MODO 5 – CRÉDITO & FLUXO

Com base no contexto do lead, analise:
1. Caminhos possíveis de aprovação de crédito
2. Tipos de financiamento que podem se aplicar
3. Possibilidade de uso de FGTS
4. Fluxo de pagamento conceitual
5. Pontos de atenção sobre crédito

LEMBRE-SE: Nunca aprove crédito, use termos como "possível", "provável", "depende de análise"`,

  followup: `MODO 6 – FOLLOW-UP

Com base no contexto do lead e histórico de interações:
1. Crie mensagens prontas de follow-up
2. Sugira o melhor intervalo entre contatos
3. Indique a prioridade deste lead (quente/morno/frio)
4. Próximos passos recomendados`,

  treinamento: `MODO 7 – TREINAMENTO

Responda a dúvida do corretor de forma didática, explicando:
• Conceitos de MCMV, FGTS, Renda, Subsídio, Associativo
• Use exemplos práticos
• Linguagem simples e clara
• Pontos de atenção importantes`,

  recomendar: `MODO 8 – RECOMENDAR IMÓVEIS

Você é um assistente de atendimento imobiliário da Seu Metro Quadrado.
Regras: não prometa aprovação de crédito; seja direto; faça perguntas mínimas se faltar dado; ofereça sempre "próximo passo" (análise de crédito ou visita).

Avalie o CATÁLOGO dos empreendimentos disponíveis fornecido no contexto.

ENTREGA OBRIGATÓRIA:
1. Liste até 3 opções compatíveis (NÃO INVENTE; use APENAS o catálogo fornecido)
2. Para cada opção: faixa de valor + por que encaixa na renda + 2 pontos de atenção
3. Sugira 1 melhor próximo passo (visita ou análise de crédito) e justifique
4. Escreva uma mensagem de WhatsApp pronta (tom humano, curta, com CTA)
5. Se faltar info, faça no máximo 3 perguntas objetivas no final.

IMPORTANTE: Se nenhum empreendimento do catálogo for compatível, diga claramente e sugira o que o cliente precisaria ter para se enquadrar.`,

  chat: `Responda a pergunta do corretor de forma consultiva e didática, seguindo as regras do SMQ Copilot.`
};

// Interface para mensagem do chat (reutiliza do openaiService)
export type { ChatMessage } from './openaiService';

// Função principal para chat com o Copilot
export async function chatWithCopilot(
  messages: ChatMessage[],
  leadContext?: LeadContext,
  mode: CopilotMode = 'chat',
  includeCatalog: boolean = false
): Promise<string> {
  // Monta o contexto inicial
  let systemPrompt = SMQ_COPILOT_SYSTEM_PROMPT;
  
  // Adiciona contexto do lead se fornecido
  if (leadContext) {
    systemPrompt += `\n\n---\n\n${formatLeadContext(leadContext)}`;
  }
  
  // Adiciona catálogo de projetos sempre (para que o Copilot tenha acesso em tempo real)
  // Se houver região desejada no lead, filtra por zona
  const catalogProjects = await getCatalogProjects(
    leadContext?.regiaoDesejada ? { zona: leadContext.regiaoDesejada } : undefined
  );
  systemPrompt += `\n\n---\n\n${formatCatalogContext(catalogProjects)}`;
  
  // Se o modo for recomendar, adiciona instrução específica
  if (mode === 'recomendar' || includeCatalog) {
    systemPrompt += `\n\n⚠️ IMPORTANTE: Recomende APENAS empreendimentos do catálogo acima. Explique por que cada um se encaixa no perfil do lead.`;
  }
  
  // Adiciona instrução do modo se não for chat livre
  if (mode !== 'chat') {
    systemPrompt += `\n\n---\n\n${MODE_PROMPTS[mode]}`;
  }
  
  // Prepara as mensagens para o LLM
  const llmMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({
      role: m.role,
      content: m.content
    }))
  ];
  
  try {
    // Usa a API da OpenAI diretamente (API Key própria da Seu Metro Quadrado)
    const content = await chatWithOpenAI(llmMessages);
    return content;
  } catch (error) {
    console.error('[SMQ Copilot] Erro ao chamar OpenAI:', error);
    throw new Error('Erro ao processar sua solicitação. Tente novamente.');
  }
}

// Função de ação rápida - gera resposta para um modo específico
export async function quickAction(
  mode: CopilotMode,
  leadContext: LeadContext,
  additionalContext?: string
): Promise<string> {
  const userMessage = additionalContext 
    ? `${MODE_PROMPTS[mode]}\n\nInformação adicional do corretor: ${additionalContext}`
    : MODE_PROMPTS[mode];
  
  // Modo recomendar sempre inclui o catálogo
  const includeCatalog = mode === 'recomendar';
  
  return chatWithCopilot(
    [{ role: 'user', content: userMessage }],
    leadContext,
    mode,
    includeCatalog
  );
}

// Função específica para recomendar imóveis com dados do lead
export async function recomendarImoveis(
  leadContext: LeadContext,
  dadosAdicionais?: {
    rendaFamiliar?: number;
    tipoRenda?: string;
    entradaDisponivel?: number;
    fgts?: boolean;
    valorFgts?: number;
    primeiroImovel?: boolean;
    regiaoDesejada?: string;
    prioridades?: string;
  }
): Promise<string> {
  // Mescla dados adicionais no contexto do lead
  const contextCompleto: LeadContext = {
    ...leadContext,
    ...dadosAdicionais
  };
  
  // Monta a mensagem com os dados do lead
  let userMessage = `Analise o perfil deste lead e recomende imóveis do catálogo:\n\n`;
  userMessage += `DADOS DO LEAD:\n`;
  if (contextCompleto.rendaFamiliar) userMessage += `• Renda familiar: R$ ${contextCompleto.rendaFamiliar.toLocaleString('pt-BR')}\n`;
  if (contextCompleto.tipoRenda) userMessage += `• CLT/autônomo: ${contextCompleto.tipoRenda}\n`;
  if (contextCompleto.entradaDisponivel) userMessage += `• Entrada disponível: R$ ${contextCompleto.entradaDisponivel.toLocaleString('pt-BR')}\n`;
  if (contextCompleto.fgts !== undefined) userMessage += `• FGTS: ${contextCompleto.fgts ? 'sim' : 'não'}\n`;
  if (contextCompleto.valorFgts) userMessage += `• Valor FGTS: R$ ${contextCompleto.valorFgts.toLocaleString('pt-BR')}\n`;
  if (contextCompleto.primeiroImovel !== undefined) userMessage += `• 1º imóvel: ${contextCompleto.primeiroImovel ? 'sim' : 'não'}\n`;
  if (contextCompleto.regiaoDesejada) userMessage += `• Região desejada / trabalho: ${contextCompleto.regiaoDesejada}\n`;
  if (contextCompleto.prioridades) userMessage += `• Prioridades: ${contextCompleto.prioridades}\n`;
  
  return chatWithCopilot(
    [{ role: 'user', content: userMessage }],
    contextCompleto,
    'recomendar',
    true // sempre inclui catálogo
  );
}
