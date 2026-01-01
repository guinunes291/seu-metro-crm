/**
 * Integração com Evolution API para envio de mensagens WhatsApp
 * 
 * Configuração necessária (variáveis de ambiente):
 * - EVOLUTION_API_URL: URL da Evolution API (ex: https://evolution-api.onrender.com)
 * - EVOLUTION_API_KEY: Chave de autenticação da API
 * - EVOLUTION_INSTANCE_NAME: Nome da instância do WhatsApp (ex: seumetroquadrado)
 */

// Integração com Evolution API

// Tipos
interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface SendMediaResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Configuração da Evolution API
const getEvolutionConfig = () => {
  const url = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'seumetroquadrado';
  
  return { url, apiKey, instanceName };
};

/**
 * Formata número de telefone para o padrão internacional
 * Remove caracteres especiais e adiciona código do país se necessário
 */
export function formatPhoneNumber(phone: string): string {
  // Remove todos os caracteres não numéricos
  let cleaned = phone.replace(/\D/g, '');
  
  // Se começar com 0, remove
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Se não começar com 55 (Brasil), adiciona
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  
  return cleaned;
}

/**
 * Verifica se a Evolution API está configurada
 */
export function isEvolutionApiConfigured(): boolean {
  const { url, apiKey } = getEvolutionConfig();
  return !!(url && apiKey);
}

/**
 * Verifica o status da conexão da instância
 */
export async function checkConnectionStatus(): Promise<{ connected: boolean; state?: string; error?: string }> {
  const { url, apiKey, instanceName } = getEvolutionConfig();
  
  if (!url || !apiKey) {
    return { connected: false, error: 'Evolution API não configurada' };
  }
  
  try {
    const response = await fetch(`${url}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return { connected: false, error: `Erro na API: ${response.status} - ${errorText}` };
    }
    
    const data = await response.json();
    return { 
      connected: data.instance?.state === 'open',
      state: data.instance?.state
    };
  } catch (error) {
    console.error('[EvolutionAPI] Erro ao verificar conexão:', error);
    return { connected: false, error: String(error) };
  }
}

/**
 * Envia mensagem de texto via WhatsApp
 */
export async function sendWhatsAppMessage(
  phone: string, 
  message: string
): Promise<SendMessageResponse> {
  const { url, apiKey, instanceName } = getEvolutionConfig();
  
  if (!url || !apiKey) {
    console.warn('[EvolutionAPI] API não configurada');
    return { success: false, error: 'Evolution API não configurada' };
  }
  
  const formattedPhone = formatPhoneNumber(phone);
  
  try {
    const response = await fetch(`${url}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[EvolutionAPI] Erro ao enviar mensagem:', response.status, errorText);
      return { success: false, error: `Erro ${response.status}: ${errorText}` };
    }
    
    const data = await response.json();
    console.log('[EvolutionAPI] Mensagem enviada com sucesso para:', formattedPhone);
    return { success: true, messageId: data.key?.id };
  } catch (error) {
    console.error('[EvolutionAPI] Erro ao enviar mensagem:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Envia mensagem com mídia (imagem, documento, etc.)
 */
export async function sendWhatsAppMedia(
  phone: string,
  mediaUrl: string,
  caption?: string,
  mediaType: 'image' | 'document' | 'video' | 'audio' = 'image',
  fileName?: string
): Promise<SendMediaResponse> {
  const { url, apiKey, instanceName } = getEvolutionConfig();
  
  if (!url || !apiKey) {
    console.warn('[EvolutionAPI] API não configurada');
    return { success: false, error: 'Evolution API não configurada' };
  }
  
  const formattedPhone = formatPhoneNumber(phone);
  
  try {
    const endpoint = mediaType === 'image' ? 'sendMedia' : 
                     mediaType === 'document' ? 'sendMedia' : 
                     mediaType === 'video' ? 'sendMedia' : 'sendWhatsAppAudio';
    
    const body: any = {
      number: formattedPhone,
      media: mediaUrl,
      mediatype: mediaType,
      caption: caption || ''
    };
    
    if (fileName) {
      body.fileName = fileName;
    }
    
    const response = await fetch(`${url}/message/${endpoint}/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[EvolutionAPI] Erro ao enviar mídia:', response.status, errorText);
      return { success: false, error: `Erro ${response.status}: ${errorText}` };
    }
    
    const data = await response.json();
    console.log('[EvolutionAPI] Mídia enviada com sucesso para:', formattedPhone);
    return { success: true, messageId: data.key?.id };
  } catch (error) {
    console.error('[EvolutionAPI] Erro ao enviar mídia:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Gera mensagem de confirmação de agendamento
 */
export function gerarMensagemConfirmacaoAgendamento(dados: {
  nomeCliente: string;
  nomeCorretor: string;
  data: string;
  hora: string;
  projeto?: string;
  endereco?: string;
}): string {
  const { nomeCliente, nomeCorretor, data, hora, projeto, endereco } = dados;
  
  let mensagem = `✅ *Agendamento Confirmado!*\n\n`;
  mensagem += `Olá *${nomeCliente}*,\n\n`;
  mensagem += `Sua visita foi agendada com sucesso!\n\n`;
  mensagem += `📅 *Data:* ${data}\n`;
  mensagem += `🕐 *Horário:* ${hora}\n`;
  mensagem += `👤 *Corretor:* ${nomeCorretor}\n`;
  
  if (projeto) {
    mensagem += `🏠 *Empreendimento:* ${projeto}\n`;
  }
  
  if (endereco) {
    mensagem += `📍 *Local:* ${endereco}\n`;
  }
  
  mensagem += `\n_Seu Metro Quadrado_ 🏡`;
  
  return mensagem;
}

/**
 * Gera mensagem de lembrete de agendamento
 */
export function gerarMensagemLembreteAgendamento(dados: {
  nomeCliente: string;
  nomeCorretor: string;
  data: string;
  hora: string;
  projeto?: string;
  endereco?: string;
}): string {
  const { nomeCliente, nomeCorretor, data, hora, projeto, endereco } = dados;
  
  let mensagem = `⏰ *Lembrete de Visita*\n\n`;
  mensagem += `Olá *${nomeCliente}*,\n\n`;
  mensagem += `Lembrando que você tem uma visita agendada:\n\n`;
  mensagem += `📅 *Data:* ${data}\n`;
  mensagem += `🕐 *Horário:* ${hora}\n`;
  mensagem += `👤 *Corretor:* ${nomeCorretor}\n`;
  
  if (projeto) {
    mensagem += `🏠 *Empreendimento:* ${projeto}\n`;
  }
  
  if (endereco) {
    mensagem += `📍 *Local:* ${endereco}\n`;
  }
  
  mensagem += `\nNos vemos em breve! 👋\n`;
  mensagem += `\n_Seu Metro Quadrado_ 🏡`;
  
  return mensagem;
}

/**
 * Envia confirmação de agendamento via WhatsApp
 */
export async function enviarConfirmacaoAgendamento(dados: {
  telefoneCliente: string;
  nomeCliente: string;
  nomeCorretor: string;
  data: string;
  hora: string;
  projeto?: string;
  endereco?: string;
}): Promise<SendMessageResponse> {
  const mensagem = gerarMensagemConfirmacaoAgendamento(dados);
  return sendWhatsAppMessage(dados.telefoneCliente, mensagem);
}

/**
 * Envia lembrete de agendamento via WhatsApp
 */
export async function enviarLembreteAgendamento(dados: {
  telefoneCliente: string;
  nomeCliente: string;
  nomeCorretor: string;
  data: string;
  hora: string;
  projeto?: string;
  endereco?: string;
}): Promise<SendMessageResponse> {
  const mensagem = gerarMensagemLembreteAgendamento(dados);
  return sendWhatsAppMessage(dados.telefoneCliente, mensagem);
}
