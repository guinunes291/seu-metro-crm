/**
 * Meta Conversions API Helper
 * Envia eventos de CRM ao Gerenciador de Anúncios do Facebook
 * Documentação: https://developers.facebook.com/docs/marketing-api/conversions-api
 */

import * as crypto from 'crypto';
import * as https from 'https';

const META_API_VERSION = 'v25.0';

// Mapeamento de status do CRM para event_name da Meta
const STATUS_TO_META_EVENT: Record<string, string> = {
  novo: 'Lead',
  aguardando_atendimento: 'Lead',
  em_atendimento: 'Contact',
  qualificado: 'CustomizeProduct',
  agendado: 'Schedule',
  visita_realizada: 'ViewContent',
  proposta_enviada: 'InitiateCheckout',
  analise_credito: 'AddPaymentInfo',
  contrato_fechado: 'Purchase',
  pos_venda: 'Purchase',
  perdido: 'CustomizeProduct',
};

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function normalizeTelefone(telefone: string): string {
  // Remover tudo que não é dígito
  const digits = telefone.replace(/\D/g, '');
  // Adicionar código do país se não tiver (Brasil = 55)
  if (digits.length === 11 || digits.length === 10) {
    return `55${digits}`;
  }
  return digits;
}

interface MetaEventParams {
  eventName: string;
  leadId?: string | number;       // ID do lead no Facebook (lead_id)
  email?: string | null;
  telefone?: string | null;
  nome?: string | null;
  statusAnterior?: string | null;
  statusNovo?: string | null;
  crmLeadId?: number;
  testEventCode?: string;         // Para testes: 'TEST12345'
}

interface MetaEventResult {
  success: boolean;
  eventsReceived?: number;
  error?: string;
}

async function sendMetaEvent(params: MetaEventParams): Promise<MetaEventResult> {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    console.warn('[Meta Conversions] META_PIXEL_ID ou META_ACCESS_TOKEN não configurados');
    return { success: false, error: 'Credenciais não configuradas' };
  }

  // Construir user_data com hash SHA256
  const userData: Record<string, any> = {};
  if (params.email) {
    userData.em = [sha256(params.email)];
  }
  if (params.telefone) {
    userData.ph = [sha256(normalizeTelefone(params.telefone))];
  }
  if (params.leadId) {
    // lead_id deve ser número inteiro (não string) conforme spec da Meta
    const leadIdNum = typeof params.leadId === 'string' ? parseInt(params.leadId, 10) : params.leadId;
    if (!isNaN(Number(leadIdNum))) {
      userData.lead_id = leadIdNum;
    }
  }

  // custom_data com campos obrigatórios da spec CRM da Meta
  const customData: Record<string, any> = {
    lead_event_source: 'Seu Metro Quadrado CRM',
    event_source: 'crm',
  };

  const eventData: Record<string, any> = {
    event_name: params.eventName,
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'system_generated',
    user_data: userData,
    custom_data: customData,
  };

  const payload: Record<string, any> = {
    data: [eventData],
  };

  if (params.testEventCode) {
    payload.test_event_code = params.testEventCode;
  }

  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const url = new URL(
      `https://graph.facebook.com/${META_API_VERSION}/${pixelId}/events?access_token=${accessToken}`
    );

    const options: https.RequestOptions = {
      method: 'POST',
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 200) {
            console.log(`[Meta Conversions] ✅ Evento "${params.eventName}" enviado. Recebidos: ${parsed.events_received}`);
            resolve({ success: true, eventsReceived: parsed.events_received });
          } else {
            console.error(`[Meta Conversions] ❌ Erro HTTP ${res.statusCode}:`, parsed);
            resolve({ success: false, error: JSON.stringify(parsed) });
          }
        } catch (e) {
          resolve({ success: false, error: 'Erro ao parsear resposta' });
        }
      });
    });

    req.on('error', (e) => {
      console.error('[Meta Conversions] Erro de rede:', e.message);
      resolve({ success: false, error: e.message });
    });

    req.write(body);
    req.end();
  });
}

/**
 * Dispara evento "Lead" quando um novo lead é criado via webhook do Facebook
 */
export async function sendLeadCreatedEvent(params: {
  email?: string | null;
  telefone?: string | null;
  nome?: string | null;
  facebookLeadId?: string | null;
  crmLeadId?: number;
}): Promise<void> {
  sendMetaEvent({
    eventName: 'Lead',
    email: params.email,
    telefone: params.telefone,
    nome: params.nome,
    leadId: params.facebookLeadId || undefined,
    crmLeadId: params.crmLeadId,
  }).catch((err) => console.error('[Meta Conversions] Erro assíncrono:', err));
}

/**
 * Dispara evento correspondente quando o status de um lead muda
 */
export async function sendLeadStatusChangedEvent(params: {
  statusAnterior: string;
  statusNovo: string;
  email?: string | null;
  telefone?: string | null;
  crmLeadId?: number;
}): Promise<void> {
  const eventName = STATUS_TO_META_EVENT[params.statusNovo];
  if (!eventName) return;

  // Não reenviar "Lead" se o status anterior também era "Lead" (evitar duplicatas)
  const eventoAnterior = STATUS_TO_META_EVENT[params.statusAnterior];
  if (eventName === eventoAnterior && eventName === 'Lead') return;

  sendMetaEvent({
    eventName,
    email: params.email,
    telefone: params.telefone,
    statusAnterior: params.statusAnterior,
    statusNovo: params.statusNovo,
    crmLeadId: params.crmLeadId,
  }).catch((err) => console.error('[Meta Conversions] Erro assíncrono:', err));
}

/**
 * Envia evento de teste para verificar a integração
 */
export async function sendTestEvent(testEventCode: string): Promise<MetaEventResult> {
  return sendMetaEvent({
    eventName: 'Lead',
    email: 'teste@seumetroquadrado.com',
    telefone: '11999999999',
    testEventCode,
  });
}

/**
 * Envia evento Lead com lead_id específico (para verificação no Events Manager)
 */
export async function sendLeadEventWithId(params: {
  leadId: string | number;
  email?: string | null;
  telefone?: string | null;
  eventName?: string;
  testEventCode?: string;
}): Promise<MetaEventResult> {
  return sendMetaEvent({
    eventName: params.eventName || 'Lead',
    leadId: params.leadId,
    email: params.email,
    telefone: params.telefone,
    testEventCode: params.testEventCode,
  });
}
