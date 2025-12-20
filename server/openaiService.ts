// Serviço de LLM usando OpenAI API diretamente
// Usa a API Key própria da Seu Metro Quadrado para reduzir custos

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface InvokeLLMOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

/**
 * Invoca a API da OpenAI diretamente usando a API Key própria
 * Modelo padrão: gpt-4o-mini (mais barato e eficiente)
 */
export async function invokeOpenAI(options: InvokeLLMOptions): Promise<OpenAIResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY não configurada. Configure nas variáveis de ambiente.');
  }

  const {
    messages,
    model = 'gpt-4o-mini', // Modelo mais econômico e eficiente
    temperature = 0.7,
    max_tokens = 4096
  } = options;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[OpenAI] Erro na API:', response.status, errorData);
      throw new Error(`Erro na API da OpenAI: ${response.status} - ${errorData.error?.message || 'Erro desconhecido'}`);
    }

    const data = await response.json() as OpenAIResponse;
    
    // Log de uso para monitoramento de custos
    if (data.usage) {
      console.log(`[OpenAI] Tokens usados: ${data.usage.total_tokens} (prompt: ${data.usage.prompt_tokens}, completion: ${data.usage.completion_tokens})`);
    }

    return data;
  } catch (error) {
    console.error('[OpenAI] Erro ao chamar API:', error);
    throw error;
  }
}

/**
 * Função simplificada para chat - retorna apenas o conteúdo da resposta
 */
export async function chatWithOpenAI(
  messages: ChatMessage[],
  options?: Partial<Omit<InvokeLLMOptions, 'messages'>>
): Promise<string> {
  const response = await invokeOpenAI({
    messages,
    ...options
  });

  const content = response.choices[0]?.message?.content;
  
  if (!content) {
    throw new Error('Resposta vazia da OpenAI');
  }

  return content;
}

/**
 * Função para streaming de respostas (para chat em tempo real)
 * Retorna um ReadableStream que pode ser consumido pelo frontend
 */
export async function streamChatWithOpenAI(
  messages: ChatMessage[],
  options?: Partial<Omit<InvokeLLMOptions, 'messages'>>
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY não configurada');
  }

  const {
    model = 'gpt-4o-mini',
    temperature = 0.7,
    max_tokens = 4096
  } = options || {};

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Erro na API da OpenAI: ${response.status} - ${errorData.error?.message || 'Erro desconhecido'}`);
  }

  if (!response.body) {
    throw new Error('Resposta sem body');
  }

  return response.body;
}
