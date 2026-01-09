import { Router, Request, Response } from 'express';
import * as db from './db';

const router = Router();

/**
 * Busca os dados completos do lead via Graph API do Facebook
 */
async function fetchLeadDataFromFacebook(leadgenId: string): Promise<{
  nome: string;
  email: string;
  telefone: string;
  faixaRenda?: string;
  formId?: string;
} | null> {
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
  
  if (!accessToken) {
    console.error('[Webhook Facebook] FACEBOOK_ACCESS_TOKEN não configurado');
    return null;
  }
  
  try {
    const url = `https://graph.facebook.com/v18.0/${leadgenId}?access_token=${accessToken}`;
    console.log('[Webhook Facebook] Buscando lead:', leadgenId);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      console.error('[Webhook Facebook] Erro ao buscar lead:', data.error);
      return null;
    }
    
    console.log('[Webhook Facebook] Dados do lead recebidos:', JSON.stringify(data, null, 2));
    console.log('[Webhook Facebook] form_id:', data.form_id);
    console.log('[Webhook Facebook] field_data:', JSON.stringify(data.field_data, null, 2));
    
    // Extrair dados do field_data
    let nome = '';
    let email = '';
    let telefone = '';
    let faixaRenda = '';
    let formId = '';
    let formName = '';
    
    if (data.field_data) {
      for (const field of data.field_data) {
        const fieldName = field.name?.toLowerCase();
        const value = field.values?.[0] || '';
        
        // Mapear diferentes nomes de campos possíveis
        if (fieldName === 'full_name' || fieldName === 'nome' || fieldName === 'name' || 
            fieldName === 'nome_completo' || fieldName === 'primeiro_nome') {
          nome = value;
        } else if (fieldName === 'email' || fieldName === 'e-mail') {
          email = value;
        } else if (fieldName === 'phone_number' || fieldName === 'telefone' || 
                   fieldName === 'phone' || fieldName === 'celular' || fieldName === 'whatsapp') {
          telefone = value;
        } else if (fieldName === 'faixa_de_renda' || fieldName === 'faixa_renda' || 
                   fieldName === 'renda' || fieldName === 'income') {
          faixaRenda = value;
        }
      }
    }
    
    // Capturar form_id se disponível
    if (data.form_id) {
      formId = data.form_id;
    }
    
    return { nome, email, telefone, faixaRenda, formId };
    
  } catch (error) {
    console.error('[Webhook Facebook] Erro na requisição:', error);
    return null;
  }
}

/**
 * Webhook para receber leads do Facebook Ads
 * 
 * Endpoint: POST /api/webhook/facebook/:token
 * 
 * O Facebook envia uma notificação com o leadgen_id:
 * {
 *   "object": "page",
 *   "entry": [{
 *     "id": "PAGE_ID",
 *     "time": 1234567890,
 *     "changes": [{
 *       "field": "leadgen",
 *       "value": {
 *         "leadgen_id": "LEAD_ID",
 *         "page_id": "PAGE_ID",
 *         "form_id": "FORM_ID"
 *       }
 *     }]
 *   }]
 * }
 * 
 * Após receber, buscamos os dados completos via Graph API
 */
router.post('/facebook/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const body = req.body;
    
    console.log('[Webhook Facebook] Recebido:', JSON.stringify(body, null, 2));
    
    let nome = '';
    let email = '';
    let telefone = '';
    let faixaRenda = '';
    let formId = '';
    let formName = '';
    
    // Verificar se é o formato de notificação do Facebook (com leadgen_id)
    if (body.entry && body.entry[0]?.changes) {
      const change = body.entry[0].changes[0];
      
      // Formato de notificação do Facebook Lead Ads
      if (change?.field === 'leadgen' && change?.value?.leadgen_id) {
        const leadgenId = change.value.leadgen_id;
        
        // Capturar form_id da notificação
        if (change.value.form_id) {
          formId = change.value.form_id;
        }
        console.log('[Webhook Facebook] Leadgen ID recebido:', leadgenId);
        
        // Buscar dados completos do lead via Graph API
        const leadData = await fetchLeadDataFromFacebook(leadgenId);
        
        if (leadData) {
          nome = leadData.nome;
          email = leadData.email;
          telefone = leadData.telefone;
          faixaRenda = leadData.faixaRenda || '';
          formId = leadData.formId || '';
        } else {
          console.log('[Webhook Facebook] Não foi possível buscar dados do lead');
          return res.status(200).json({
            success: false,
            message: 'Não foi possível buscar dados do lead via Graph API',
          });
        }
      }
      // Formato antigo com field_data direto (alguns formulários ainda enviam assim)
      else if (change?.value?.field_data) {
        const fieldData = change.value.field_data;
        
        for (const field of fieldData) {
          const fieldName = field.name?.toLowerCase();
          const value = field.values?.[0] || '';
          
          if (fieldName === 'full_name' || fieldName === 'nome' || fieldName === 'name') {
            nome = value;
          } else if (fieldName === 'email') {
            email = value;
          } else if (fieldName === 'phone_number' || fieldName === 'telefone' || fieldName === 'phone') {
            telefone = value;
          } else if (fieldName === 'faixa_de_renda' || fieldName === 'faixa_renda' || fieldName === 'renda') {
            faixaRenda = value;
          }
        }
      }
    } 
    // Formato simplificado (para testes e outras integrações como Zapier)
    else if (body.nome || body.name || body.full_name) {
      nome = body.nome || body.name || body.full_name || '';
      email = body.email || '';
      telefone = body.telefone || body.phone || body.phone_number || '';
    }
    
    // Validar dados mínimos
    if (!nome && !telefone) {
      console.log('[Webhook Facebook] Dados insuficientes:', { nome, telefone, body });
      // Retornar 200 para o Facebook não reenviar
      return res.status(200).json({ 
        success: false,
        error: 'Dados insuficientes',
        message: 'Nome ou telefone são obrigatórios',
        received: { nome, telefone }
      });
    }
    
    // Se não tiver nome, usar telefone como nome temporário
    if (!nome && telefone) {
      nome = `Lead ${telefone}`;
    }
    
    // Se não tiver telefone, usar placeholder
    if (!telefone && nome) {
      telefone = 'Não informado';
    }
    
    // Buscar webhook config para mapear form_id para projeto
    const webhook = await db.getWebhookConfigByToken(token);
    let projectId: number | undefined;
    
    if (webhook && formId && webhook.formIdMapping) {
      try {
        const mapping = JSON.parse(webhook.formIdMapping);
        projectId = mapping[formId];
        console.log('[Webhook Facebook] Form ID mapeado para projeto:', { formId, projectId });
      } catch (e) {
        console.error('[Webhook Facebook] Erro ao parsear formIdMapping:', e);
      }
    }
    
    // Se não encontrou mapeamento, usar projeto padrão
    if (!projectId && webhook?.projectIdPadrao) {
      projectId = webhook.projectIdPadrao;
      console.log('[Webhook Facebook] Usando projeto padrão:', projectId);
    }
    
    console.log('[Webhook Facebook] Dados finais antes de processar:', {
      nome,
      email,
      telefone,
      faixaRenda,
      formId,
      projectId,
      webhookToken: token
    });
    
    // Processar lead via roleta
    const resultado = await db.processarLeadWebhook(token, {
      nome,
      email,
      telefone,
      origem: 'facebook',
      faixaRenda: faixaRenda || undefined,
      projectId: projectId,
    });
    
    console.log('[Webhook Facebook] Lead processado:', resultado);
    
    return res.status(200).json({
      success: true,
      leadId: resultado.lead.id,
      corretorId: resultado.corretorId,
      distribuido: resultado.distribuido,
      message: resultado.distribuido 
        ? 'Lead criado e distribuído com sucesso' 
        : 'Lead criado, mas não havia corretor disponível para distribuição',
    });
    
  } catch (error: any) {
    console.error('[Webhook Facebook] Erro:', error);
    
    // Retornar 200 para o Facebook não reenviar em caso de erro
    return res.status(200).json({
      success: false,
      error: 'Erro ao processar webhook',
      message: error.message,
    });
  }
});

/**
 * Webhook EXCLUSIVO para Fila Foco (SEM LIMITES DIÁRIOS)
 * 
 * Endpoint: POST /api/webhook/facebook-foco/:token
 * 
 * Este webhook distribui leads APENAS para corretores da Fila Foco configurada
 * em "Gestão → Projeto Foco do Mês". Não há limite diário de leads.
 */
router.post('/facebook-foco/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const body = req.body;
    
    console.log('[Webhook Foco] Recebido:', JSON.stringify(body, null, 2));
    
    let nome = '';
    let email = '';
    let telefone = '';
    let faixaRenda = '';
    let formId = '';
    
    // Verificar se é o formato de notificação do Facebook (com leadgen_id)
    if (body.entry && body.entry[0]?.changes) {
      const change = body.entry[0].changes[0];
      
      // Formato de notificação do Facebook Lead Ads
      if (change?.field === 'leadgen' && change?.value?.leadgen_id) {
        const leadgenId = change.value.leadgen_id;
        
        // Capturar form_id da notificação
        if (change.value.form_id) {
          formId = change.value.form_id;
        }
        console.log('[Webhook Foco] Leadgen ID recebido:', leadgenId);
        
        // Buscar dados completos do lead via Graph API
        const leadData = await fetchLeadDataFromFacebook(leadgenId);
        
        if (leadData) {
          nome = leadData.nome;
          email = leadData.email;
          telefone = leadData.telefone;
          faixaRenda = leadData.faixaRenda || '';
          formId = leadData.formId || '';
        } else {
          console.log('[Webhook Foco] Não foi possível buscar dados do lead');
          return res.status(200).json({
            success: false,
            message: 'Não foi possível buscar dados do lead via Graph API',
          });
        }
      }
      // Formato antigo com field_data direto
      else if (change?.value?.field_data) {
        const fieldData = change.value.field_data;
        
        for (const field of fieldData) {
          const fieldName = field.name?.toLowerCase();
          const value = field.values?.[0] || '';
          
          if (fieldName === 'full_name' || fieldName === 'nome' || fieldName === 'name') {
            nome = value;
          } else if (fieldName === 'email') {
            email = value;
          } else if (fieldName === 'phone_number' || fieldName === 'telefone' || fieldName === 'phone') {
            telefone = value;
          } else if (fieldName === 'faixa_de_renda' || fieldName === 'faixa_renda' || fieldName === 'renda') {
            faixaRenda = value;
          }
        }
      }
    } 
    // Formato simplificado (para testes)
    else if (body.nome || body.name || body.full_name) {
      nome = body.nome || body.name || body.full_name || '';
      email = body.email || '';
      telefone = body.telefone || body.phone || body.phone_number || '';
    }
    
    // Validar dados mínimos
    if (!nome && !telefone) {
      console.log('[Webhook Foco] Dados insuficientes:', { nome, telefone, body });
      return res.status(200).json({ 
        success: false,
        error: 'Dados insuficientes',
        message: 'Nome ou telefone são obrigatórios',
        received: { nome, telefone }
      });
    }
    
    // Se não tiver nome, usar telefone como nome temporário
    if (!nome && telefone) {
      nome = `Lead ${telefone}`;
    }
    
    // Se não tiver telefone, usar placeholder
    if (!telefone && nome) {
      telefone = 'Não informado';
    }
    
    // Buscar webhook config para mapear form_id para projeto
    const webhook = await db.getWebhookConfigByToken(token);
    let projectId: number | undefined;
    
    if (webhook && formId && webhook.formIdMapping) {
      try {
        const mapping = JSON.parse(webhook.formIdMapping);
        projectId = mapping[formId];
        console.log('[Webhook Foco] Form ID mapeado para projeto:', { formId, projectId });
      } catch (e) {
        console.error('[Webhook Foco] Erro ao parsear formIdMapping:', e);
      }
    }
    
    // Se não encontrou mapeamento, usar projeto padrão
    if (!projectId && webhook?.projectIdPadrao) {
      projectId = webhook.projectIdPadrao;
    }
    
    // Processar lead via Fila Foco (SEM LIMITES)
    const resultado = await db.processarLeadWebhookFoco(token, {
      nome,
      email,
      telefone,
      origem: 'facebook',
      faixaRenda: faixaRenda || undefined,
      projectId: projectId,
    });
    
    console.log('[Webhook Foco] Lead processado:', resultado);
    
    return res.status(200).json({
      success: true,
      leadId: resultado.lead.id,
      corretorId: resultado.corretorId,
      distribuido: resultado.distribuido,
      message: resultado.distribuido 
        ? 'Lead criado e distribuído para Fila Foco com sucesso' 
        : 'Lead criado, mas não havia corretor disponível na Fila Foco',
    });
    
  } catch (error: any) {
    console.error('[Webhook Foco] Erro:', error);
    
    return res.status(200).json({
      success: false,
      error: 'Erro ao processar webhook',
      message: error.message,
    });
  }
});

/**
 * Verificação do webhook Foco (GET)
 */
router.get('/facebook-foco/:token', async (req: Request, res: Response) => {
  const { token } = req.params;
  const mode = req.query['hub.mode'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = req.query['hub.verify_token'];
  
  console.log('[Webhook Foco] Verificação:', { mode, challenge, verifyToken, token });
  
  // Verificar se o token do webhook é válido
  const webhook = await db.getWebhookConfigByToken(token);
  
  if (!webhook) {
    return res.status(404).json({ error: 'Webhook não encontrado' });
  }
  
  // Se for uma verificação do Facebook
  if (mode === 'subscribe') {
    if (verifyToken === token) {
      console.log('[Webhook Foco] Verificação bem-sucedida');
      return res.status(200).send(challenge);
    } else {
      console.log('[Webhook Foco] Token de verificação inválido');
      return res.status(403).json({ error: 'Token de verificação inválido' });
    }
  }
  
  // Se não for verificação, retorna info do webhook
  return res.status(200).json({
    status: 'active',
    nome: webhook.nome + ' (Fila Foco)',
    fonte: webhook.fonte,
    leadsRecebidos: webhook.leadsRecebidos,
  });
});

/**
 * Verificação do webhook (GET) - necessário para validação do Facebook
 * 
 * O Facebook envia uma requisição GET com:
 * - hub.mode: "subscribe"
 * - hub.challenge: código a ser retornado
 * - hub.verify_token: token de verificação configurado
 */
router.get('/facebook/:token', async (req: Request, res: Response) => {
  const { token } = req.params;
  const mode = req.query['hub.mode'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = req.query['hub.verify_token'];
  
  console.log('[Webhook Facebook] Verificação:', { mode, challenge, verifyToken, token });
  
  // Verificar se o token do webhook é válido
  const webhook = await db.getWebhookConfigByToken(token);
  
  if (!webhook) {
    return res.status(404).json({ error: 'Webhook não encontrado' });
  }
  
  // Se for uma verificação do Facebook
  if (mode === 'subscribe') {
    // O verify_token deve ser igual ao token do webhook
    if (verifyToken === token) {
      console.log('[Webhook Facebook] Verificação bem-sucedida');
      return res.status(200).send(challenge);
    } else {
      console.log('[Webhook Facebook] Token de verificação inválido');
      return res.status(403).json({ error: 'Token de verificação inválido' });
    }
  }
  
  // Se não for verificação, retorna info do webhook
  return res.status(200).json({
    status: 'active',
    nome: webhook.nome,
    fonte: webhook.fonte,
    leadsRecebidos: webhook.leadsRecebidos,
  });
});

/**
 * Webhook genérico para outras integrações (Zapier, Make, etc)
 * 
 * Endpoint: POST /api/webhook/lead/:token
 * 
 * Aceita múltiplos formatos de campos:
 * - nome, name, full_name
 * - telefone, phone, phone_number, celular, whatsapp
 * - email, e-mail
 * 
 * Exemplo:
 * {
 *   "full_name": "João Silva",
 *   "email": "joao@email.com",
 *   "phone_number": "+5511999999999"
 * }
 */
router.post('/lead/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const body = req.body;
    
    console.log('[Webhook Lead] Recebido:', JSON.stringify(body, null, 2));
    
    // Extrair nome de várias possíveis chaves
    const leadNome = body.nome || body.name || body.full_name || 
                     body.Nome || body.Name || body.Full_Name || 
                     body['full name'] || body['Full Name'] || '';
    
    // Extrair telefone de várias possíveis chaves
    const leadTelefone = body.telefone || body.phone || body.phone_number || 
                         body.celular || body.whatsapp || body.Telefone || 
                         body.Phone || body.Phone_Number || body.Celular ||
                         body['phone number'] || body['Phone Number'] || '';
    
    // Extrair email
    const leadEmail = body.email || body['e-mail'] || body.Email || 
                      body['E-mail'] || body.EMAIL || '';
    
    // Extrair campos do Facebook Lead Ads
    const campanha = body.campaign_name || body.campanha || body.Campanha || '';
    const faixaRenda = body.faixa_de_renda || body.faixaRenda || body.faixa_renda || 
                       body['Faixa de Renda'] || body.renda || '';
    const prefereContatoPor = body.prefere_falar_por || body.prefereContatoPor || 
                              body.preferencia_contato || body['Prefere contato por'] || '';
    const dataHoraCriacao = body.created_time || body.dataHoraCriacao || 
                            body.data_criacao || body.createdAt || '';
    
    console.log('[Webhook Lead] Dados extraídos:', { 
      leadNome, leadTelefone, leadEmail, 
      campanha, faixaRenda, prefereContatoPor, dataHoraCriacao 
    });
    
    // Validar - precisa ter pelo menos nome OU telefone
    if (!leadNome && !leadTelefone) {
      console.log('[Webhook Lead] Dados insuficientes');
      return res.status(400).json({ 
        error: 'Dados insuficientes',
        message: 'Nome e telefone são obrigatórios',
        received: body,
      });
    }
    
    // Se não tiver nome, usar telefone como nome temporário
    const nomeParaSalvar = leadNome || `Lead ${leadTelefone}`;
    
    // Se não tiver telefone, usar placeholder
    const telefoneParaSalvar = leadTelefone || 'Não informado';
    
    const resultado = await db.processarLeadWebhook(token, {
      nome: nomeParaSalvar,
      email: leadEmail,
      telefone: telefoneParaSalvar,
      // Campos do Facebook Lead Ads
      campanha: campanha || undefined,
      faixaRenda: faixaRenda || undefined,
      prefereContatoPor: prefereContatoPor || undefined,
      dataHoraCriacao: dataHoraCriacao || undefined,
    });
    
    console.log('[Webhook Lead] Lead processado:', resultado);
    
    return res.status(200).json({
      success: true,
      leadId: resultado.lead.id,
      corretorId: resultado.corretorId,
      distribuido: resultado.distribuido,
      message: resultado.distribuido 
        ? 'Lead criado e distribuído com sucesso' 
        : 'Lead criado, mas não havia corretor disponível para distribuição',
    });
    
  } catch (error: any) {
    console.error('[Webhook Lead] Erro:', error);
    return res.status(400).json({
      error: 'Erro ao processar webhook',
      message: error.message,
    });
  }
});

export default router;
