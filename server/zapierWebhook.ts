/**
 * Módulo de integração com Zapier via Webhook
 * Envia eventos do CRM para o Zapier, que pode então disparar ações como envio de WhatsApp
 */

// Tipos de eventos suportados
export type WebhookEventType = 
  | 'agendamento_criado'
  | 'agendamento_confirmado'
  | 'agendamento_cancelado'
  | 'lead_criado'
  | 'lead_atualizado'
  | 'proposta_criada'
  | 'proposta_aceita';

// Interface para dados do cliente
interface ClienteData {
  nome: string;
  telefone: string;
  email?: string;
  cpf?: string;
}

// Interface para dados do agendamento
interface AgendamentoData {
  id: number;
  data: string;        // formato: YYYY-MM-DD
  hora: string;        // formato: HH:MM
  projeto?: string;
  construtora?: string;
  endereco?: string;
  observacoes?: string;
}

// Interface para dados do corretor
interface CorretorData {
  id: number;
  nome: string;
  telefone?: string;
  email?: string;
}

// Interface para dados do lead
interface LeadData {
  id: number;
  nome: string;
  telefone: string;
  email?: string;
  status?: string;
  origem?: string;
  projeto?: string;
}

// Interface para dados da proposta
interface PropostaData {
  id: number;
  valorImovel: number;
  valorEntrada: number;
  valorFinanciamento: number;
  projeto?: string;
}

// Payload completo do webhook
export interface WebhookPayload {
  evento: WebhookEventType;
  timestamp: string;
  cliente?: ClienteData;
  agendamento?: AgendamentoData;
  corretor?: CorretorData;
  lead?: LeadData;
  proposta?: PropostaData;
  metadata?: Record<string, any>;
}

/**
 * Envia um webhook para o Zapier
 * @param webhookUrl URL do webhook do Zapier
 * @param payload Dados a serem enviados
 * @returns Resultado do envio
 */
export async function enviarWebhookZapier(
  webhookUrl: string,
  payload: WebhookPayload
): Promise<{ success: boolean; error?: string }> {
  if (!webhookUrl) {
    console.log('[Zapier Webhook] URL não configurada, ignorando envio');
    return { success: false, error: 'URL do webhook não configurada' };
  }

  try {
    console.log(`[Zapier Webhook] Enviando evento: ${payload.evento}`);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Zapier Webhook] Erro HTTP ${response.status}: ${errorText}`);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    console.log(`[Zapier Webhook] Evento ${payload.evento} enviado com sucesso`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[Zapier Webhook] Erro ao enviar: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

/**
 * Cria payload para evento de agendamento criado
 */
export function criarPayloadAgendamento(params: {
  cliente: ClienteData;
  agendamento: AgendamentoData;
  corretor: CorretorData;
}): WebhookPayload {
  return {
    evento: 'agendamento_criado',
    timestamp: new Date().toISOString(),
    cliente: params.cliente,
    agendamento: params.agendamento,
    corretor: params.corretor,
  };
}

/**
 * Cria payload para evento de lead criado
 */
export function criarPayloadLeadCriado(params: {
  lead: LeadData;
  corretor?: CorretorData;
}): WebhookPayload {
  return {
    evento: 'lead_criado',
    timestamp: new Date().toISOString(),
    lead: params.lead,
    corretor: params.corretor,
  };
}

/**
 * Cria payload para evento de proposta criada
 */
export function criarPayloadPropostaCriada(params: {
  cliente: ClienteData;
  proposta: PropostaData;
  corretor: CorretorData;
}): WebhookPayload {
  return {
    evento: 'proposta_criada',
    timestamp: new Date().toISOString(),
    cliente: params.cliente,
    proposta: params.proposta,
    corretor: params.corretor,
  };
}

/**
 * Formata número de telefone para WhatsApp (formato brasileiro)
 * Remove caracteres especiais e adiciona código do país se necessário
 */
export function formatarTelefoneWhatsApp(telefone: string): string {
  // Remove tudo que não é número
  let numero = telefone.replace(/\D/g, '');
  
  // Se começar com 0, remove
  if (numero.startsWith('0')) {
    numero = numero.substring(1);
  }
  
  // Se não tiver código do país (55), adiciona
  if (!numero.startsWith('55') && numero.length <= 11) {
    numero = '55' + numero;
  }
  
  return numero;
}

/**
 * Formata data para exibição (DD/MM/YYYY)
 */
export function formatarData(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

/**
 * Gera mensagem de confirmação de agendamento formatada
 */
export function gerarMensagemConfirmacao(params: {
  nomeCliente: string;
  data: string;
  hora: string;
  projeto?: string;
  endereco?: string;
  nomeCorretor: string;
}): string {
  const dataFormatada = formatarData(params.data);
  
  let mensagem = `Olá ${params.nomeCliente}! 👋\n\n`;
  mensagem += `Seu agendamento foi confirmado com sucesso! ✅\n\n`;
  mensagem += `📅 *Data:* ${dataFormatada}\n`;
  mensagem += `🕐 *Horário:* ${params.hora}\n`;
  
  if (params.projeto) {
    mensagem += `🏠 *Empreendimento:* ${params.projeto}\n`;
  }
  
  if (params.endereco) {
    mensagem += `📍 *Endereço:* ${params.endereco}\n`;
  }
  
  mensagem += `\n👤 *Corretor:* ${params.nomeCorretor}\n`;
  mensagem += `\nAguardamos você! Qualquer dúvida, estamos à disposição.\n`;
  mensagem += `\n_Seu Metro Quadrado - Realizando Sonhos_ 🏡`;
  
  return mensagem;
}
