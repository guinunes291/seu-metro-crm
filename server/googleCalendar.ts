/**
 * Integração com Google Calendar
 * 
 * Este módulo permite sincronizar agendamentos com o Google Calendar
 * tanto do corretor quanto do gestor.
 */

import { google } from 'googleapis';

// Configuração do cliente OAuth2
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Tentar usar Service Account se disponível
let serviceAccountAuth: any = null;
if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    serviceAccountAuth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/calendar']
    });
  } catch (e) {
    console.log('[GoogleCalendar] Service Account não configurado');
  }
}

interface CalendarEvent {
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees?: Array<{ email: string }>;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{ method: string; minutes: number }>;
  };
}

/**
 * Criar evento no Google Calendar
 */
export async function createCalendarEvent(
  calendarId: string,
  event: CalendarEvent,
  accessToken?: string
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    let auth;
    
    if (accessToken) {
      oauth2Client.setCredentials({ access_token: accessToken });
      auth = oauth2Client;
    } else if (serviceAccountAuth) {
      auth = await serviceAccountAuth.getClient();
    } else {
      return { success: false, error: 'Nenhuma autenticação disponível' };
    }
    
    const calendar = google.calendar({ version: 'v3', auth });
    
    const response = await calendar.events.insert({
      calendarId,
      requestBody: event
    });
    
    return { success: true, eventId: response.data.id || undefined };
  } catch (error: any) {
    console.error('[GoogleCalendar] Erro ao criar evento:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Atualizar evento no Google Calendar
 */
export async function updateCalendarEvent(
  calendarId: string,
  eventId: string,
  event: Partial<CalendarEvent>,
  accessToken?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    let auth;
    
    if (accessToken) {
      oauth2Client.setCredentials({ access_token: accessToken });
      auth = oauth2Client;
    } else if (serviceAccountAuth) {
      auth = await serviceAccountAuth.getClient();
    } else {
      return { success: false, error: 'Nenhuma autenticação disponível' };
    }
    
    const calendar = google.calendar({ version: 'v3', auth });
    
    await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: event
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('[GoogleCalendar] Erro ao atualizar evento:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Deletar evento do Google Calendar
 */
export async function deleteCalendarEvent(
  calendarId: string,
  eventId: string,
  accessToken?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    let auth;
    
    if (accessToken) {
      oauth2Client.setCredentials({ access_token: accessToken });
      auth = oauth2Client;
    } else if (serviceAccountAuth) {
      auth = await serviceAccountAuth.getClient();
    } else {
      return { success: false, error: 'Nenhuma autenticação disponível' };
    }
    
    const calendar = google.calendar({ version: 'v3', auth });
    
    await calendar.events.delete({
      calendarId,
      eventId
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('[GoogleCalendar] Erro ao deletar evento:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Buscar eventos do Google Calendar
 */
export async function listCalendarEvents(
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
  accessToken?: string
): Promise<{ success: boolean; events?: any[]; error?: string }> {
  try {
    let auth;
    
    if (accessToken) {
      oauth2Client.setCredentials({ access_token: accessToken });
      auth = oauth2Client;
    } else if (serviceAccountAuth) {
      auth = await serviceAccountAuth.getClient();
    } else {
      return { success: false, error: 'Nenhuma autenticação disponível' };
    }
    
    const calendar = google.calendar({ version: 'v3', auth });
    
    const response = await calendar.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });
    
    return { success: true, events: response.data.items || [] };
  } catch (error: any) {
    console.error('[GoogleCalendar] Erro ao listar eventos:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Criar evento de agendamento no Google Calendar
 */
export async function createAgendamentoCalendarEvent(
  agendamento: {
    id: number;
    leadNome: string;
    leadTelefone: string;
    corretorNome: string;
    projetoNome?: string;
    dataAgendamento: Date;
    horaAgendamento: string;
    observacoes?: string;
  },
  calendarId: string,
  accessToken?: string
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const [hora, minuto] = agendamento.horaAgendamento.split(':').map(Number);
  const startDate = new Date(agendamento.dataAgendamento);
  startDate.setHours(hora, minuto, 0, 0);
  
  const endDate = new Date(startDate);
  endDate.setHours(endDate.getHours() + 1); // Duração padrão de 1 hora
  
  const event: CalendarEvent = {
    summary: `📍 Visita: ${agendamento.leadNome}`,
    description: `
Cliente: ${agendamento.leadNome}
Telefone: ${agendamento.leadTelefone}
Corretor: ${agendamento.corretorNome}
${agendamento.projetoNome ? `Projeto: ${agendamento.projetoNome}` : ''}
${agendamento.observacoes ? `\nObservações: ${agendamento.observacoes}` : ''}

---
Agendamento #${agendamento.id} - Seu Metro Quadrado CRM
    `.trim(),
    location: agendamento.projetoNome || 'A definir',
    start: {
      dateTime: startDate.toISOString(),
      timeZone: 'America/Sao_Paulo'
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: 'America/Sao_Paulo'
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },    // 1 hora antes
        { method: 'popup', minutes: 1440 }   // 24 horas antes
      ]
    }
  };
  
  return createCalendarEvent(calendarId, event, accessToken);
}

/**
 * Gerar URL de autorização do Google Calendar
 */
export function getGoogleCalendarAuthUrl(state: string): string {
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state,
    prompt: 'consent'
  });
}

/**
 * Trocar código de autorização por tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}> {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    return {
      success: true,
      accessToken: tokens.access_token || undefined,
      refreshToken: tokens.refresh_token || undefined
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Renovar access token usando refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  success: boolean;
  accessToken?: string;
  error?: string;
}> {
  try {
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();
    return {
      success: true,
      accessToken: credentials.access_token || undefined
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
