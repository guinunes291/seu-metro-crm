import { Router, Request, Response } from 'express';
import * as db from './db';
import { notifyOwner } from './_core/notification';
import { ENV } from './_core/env';
import { sendLeadCreatedEvent } from './metaConversions';

const router = Router();

/** Mascara dados pessoais para logs — exibe só primeiros 3 chars + *** */
function maskPII(value: string | undefined | null): string {
  if (!value) return '(vazio)';
  if (value.length <= 3) return '***';
  return `${value.substring(0, 3)}***`;
}

/**
 * Busca os dados completos do lead via Graph API do Facebook
 */
async function fetchLeadDataFromFacebook(leadgenId: string): Promise<{
  nome: string;
  email: string;
  telefone: string;
  faixaRenda?: string;
  prefereContatoPor?: string;
  finalidadeImovel?: string;
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
    
    // Log detalhado de todos os nomes de campos para debug
    if (data.field_data) {
      console.log('[Webhook Facebook] Nomes de campos recebidos:');
      data.field_data.forEach((field: any) => {
        console.log(`  - ${field.name} = ${field.values?.[0] || '(vazio)'}`);
      });
    }
    
    // Extrair dados do field_data
    let nome = '';
    let email = '';
    let telefone = '';
    let faixaRenda = '';
    let prefereContatoPor = '';
    let finalidadeImovel = '';
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
        } else if (field.name === 'Faixa De Renda' || fieldName === 'faixa_de_renda' || fieldName === 'faixa_renda' || 
                   fieldName === 'faixa de renda' || fieldName === 'faixaderenda' ||
                   fieldName === 'renda' || fieldName === 'income' || 
                   fieldName === 'renda_familiar' || fieldName === 'renda familiar' ||
                   fieldName === 'income_range' || fieldName === 'income range' ||
                   fieldName === 'monthly_income' || fieldName === 'monthly income' ||
                   fieldName === 'salario' || fieldName === 'salário' ||
                   fieldName === 'rendimento' || fieldName === 'rendimentos' ||
                   fieldName.includes('renda') || fieldName.includes('income')) {
          faixaRenda = value;
          console.log(`[Webhook Facebook] ✅ Faixa de renda capturada do campo "${field.name}": ${value}`);
        } else if (fieldName === 'prefere falar por' || fieldName === 'prefere contato por' ||
                   fieldName === 'prefere_falar_por' || fieldName === 'prefere_contato_por' ||
                   fieldName === 'preferencia_contato' || fieldName === 'preferência de contato' ||
                   fieldName === 'contato_preferencial' || fieldName === 'meio_contato' ||
                   fieldName.includes('prefere') || fieldName.includes('contato')) {
          prefereContatoPor = value;
          console.log(`[Webhook Facebook] ✅ Preferência de contato capturada do campo "${field.name}": ${value}`);
        } else if (fieldName === 'você pretende utilizar o imóvel para' ||
                   fieldName === 'finalidade' || fieldName === 'finalidade_imovel' ||
                   fieldName === 'finalidade do imóvel' || fieldName === 'objetivo' ||
                   fieldName === 'uso_imovel' || fieldName === 'uso do imóvel' ||
                   fieldName.includes('finalidade') || fieldName.includes('utilizar')) {
          finalidadeImovel = value;
          console.log(`[Webhook Facebook] ✅ Finalidade do imóvel capturada do campo "${field.name}": ${value}`);
        }
      }
    }
    
    // Log final dos dados extraídos
    console.log('[Webhook Facebook] Dados extraídos:', { nome, email, telefone, faixaRenda, prefereContatoPor, finalidadeImovel, formId });
    if (!faixaRenda) {
      console.warn('[Webhook Facebook] ⚠️ ATENÇÃO: Faixa de renda NÃO foi capturada!');
    }
    if (!prefereContatoPor) {
      console.warn('[Webhook Facebook] ⚠️ ATENÇÃO: Preferência de contato NÃO foi capturada!');
    }
    if (!finalidadeImovel) {
      console.warn('[Webhook Facebook] ⚠️ ATENÇÃO: Finalidade do imóvel NÃO foi capturada!');
    }
    
    // Capturar form_id se disponível
    if (data.form_id) {
      formId = data.form_id;
    }
    
    return { nome, email, telefone, faixaRenda, prefereContatoPor, finalidadeImovel, formId };
    
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

    // Validar token antes de qualquer processamento
    const webhookConfig = await db.getWebhookConfigByToken(token);
    if (!webhookConfig) {
      return res.status(401).json({ success: false, error: 'Token inválido' });
    }

    const body = req.body;

    console.log('[Webhook Facebook] Recebido — entry count:', body?.entry?.length ?? 0);
    
    let nome = '';
    let email = '';
    let telefone = '';
    let faixaRenda = '';
    let prefereContatoPor = '';
    let finalidadeImovel = '';
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
          prefereContatoPor = leadData.prefereContatoPor || '';
          finalidadeImovel = leadData.finalidadeImovel || '';
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
          } else if (field.name === 'Faixa De Renda' || fieldName === 'faixa_de_renda' || fieldName === 'faixa_renda' || 
                     fieldName === 'faixa de renda' || fieldName === 'faixaderenda' ||
                     fieldName === 'renda' || fieldName === 'income' || 
                     fieldName === 'renda_familiar' || fieldName === 'renda familiar' ||
                     fieldName === 'income_range' || fieldName === 'income range' ||
                     fieldName === 'monthly_income' || fieldName === 'monthly income' ||
                     fieldName === 'salario' || fieldName === 'salário' ||
                     fieldName === 'rendimento' || fieldName === 'rendimentos' ||
                     fieldName.includes('renda') || fieldName.includes('income')) {
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
      nome: maskPII(nome),
      email: maskPII(email),
      telefone: maskPII(telefone),
      faixaRenda,
      formId,
      projectId,
    });
    
    // Processar lead via roleta
    const resultado = await db.processarLeadWebhook(token, {
      nome,
      email,
      telefone,
      origem: 'facebook',
      faixaRenda: faixaRenda || undefined,
      prefereContatoPor: prefereContatoPor || undefined,
      finalidadeImovel: finalidadeImovel || undefined,
      projectId: projectId,
    });
    
    console.log('[Webhook Facebook] Lead processado:', resultado);
    
    // Disparar evento Lead na Meta Conversions API (assíncrono)
    sendLeadCreatedEvent({
      email: email || null,
      telefone: telefone || null,
      nome: nome || null,
      facebookLeadId: body.entry?.[0]?.changes?.[0]?.value?.leadgen_id || null,
      crmLeadId: resultado.lead.id,
    }).catch(() => {});
    
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

    // Validar token antes de qualquer processamento
    const webhookFocoConfig = await db.getWebhookConfigByToken(token);
    if (!webhookFocoConfig) {
      return res.status(401).json({ success: false, error: 'Token inválido' });
    }

    const body = req.body;

    console.log('[Webhook Foco] Recebido — entry count:', body?.entry?.length ?? 0);
    
    let nome = '';
    let email = '';
    let telefone = '';
    let faixaRenda = '';
    let prefereContatoPor = '';
    let finalidadeImovel = '';
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
          prefereContatoPor = leadData.prefereContatoPor || '';
          finalidadeImovel = leadData.finalidadeImovel || '';
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
          } else if (field.name === 'Faixa De Renda' || fieldName === 'faixa_de_renda' || fieldName === 'faixa_renda' || 
                     fieldName === 'faixa de renda' || fieldName === 'faixaderenda' ||
                     fieldName === 'renda' || fieldName === 'income' || 
                     fieldName === 'renda_familiar' || fieldName === 'renda familiar' ||
                     fieldName === 'income_range' || fieldName === 'income range' ||
                     fieldName === 'monthly_income' || fieldName === 'monthly income' ||
                     fieldName === 'salario' || fieldName === 'salário' ||
                     fieldName === 'rendimento' || fieldName === 'rendimentos' ||
                     fieldName.includes('renda') || fieldName.includes('income')) {
            faixaRenda = value;
          }
        }
      }
    } 
    // Formato simplificado (para testes e Zapier)
    else if (body.nome || body.name || body.full_name) {
      nome = body.nome || body.name || body.full_name || '';
      email = body.email || '';
      telefone = body.telefone || body.phone || body.phone_number || '';
      faixaRenda = body['faixa de renda'] || body.faixaRenda || body.faixa_renda || '';
      prefereContatoPor = body.prefereContatoPor || body.prefere_contato_por || '';
      finalidadeImovel = body.finalidadeImovel || body.finalidade_imovel || body.finalidade || '';
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
      prefereContatoPor: prefereContatoPor || undefined,
      finalidadeImovel: finalidadeImovel || undefined,
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

    // Validar token antes de qualquer processamento
    const webhookLeadConfig = await db.getWebhookConfigByToken(token);
    if (!webhookLeadConfig) {
      return res.status(401).json({ success: false, error: 'Token inválido' });
    }

    const body = req.body;

    console.log('[Webhook Lead] Recebido — campos:', Object.keys(body).join(', '));
    
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
                       body['Faixa de Renda'] || body['faixa de renda'] || 
                       body.renda || body.renda_familiar || body['renda familiar'] ||
                       body.income || body.income_range || body['income range'] ||
                       body.monthly_income || body['monthly income'] ||
                       body.salario || body.salário || body.rendimento || body.rendimentos || '';
    const prefereContatoPor = body.prefere_falar_por || body.prefereContatoPor || 
                              body.preferencia_contato || body['Prefere contato por'] || '';
    const dataHoraCriacao = body.created_time || body.dataHoraCriacao || 
                            body.data_criacao || body.createdAt || '';
    
    console.log('[Webhook Lead] Dados extraídos:', { 
      leadNome, leadTelefone, leadEmail, 
      campanha, faixaRenda, prefereContatoPor, dataHoraCriacao 
    });
    
    // Log de todos os campos do body para debug
    console.log('[Webhook Lead] Todos os campos recebidos no body:');
    Object.keys(body).forEach(key => {
      console.log(`  - ${key} = ${body[key]}`);
    });
    
    if (!faixaRenda) {
      console.warn('[Webhook Lead] ⚠️ ATENÇÃO: Faixa de renda NÃO foi capturada!');
    } else {
      console.log(`[Webhook Lead] ✅ Faixa de renda capturada: ${faixaRenda}`);
    }
    
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

/**
 * Webhook de Documentação — chamado pelo Google Apps Script após envio do formulário
 *
 * Endpoint: POST /api/webhook/documentacao
 *
 * Headers obrigatórios:
 *   x-docs-token: <DOCS_WEBHOOK_TOKEN configurado nas secrets>
 *
 * Body: { "telefone": "11999999999", "nomeCliente": "João", "tipoRegime": "autonomo"|"clt", "nomeCorretor": "..." }
 */
router.post('/documentacao', async (req: Request, res: Response) => {
  try {
    const token = req.headers['x-docs-token'] as string;
    const tokenEsperado = process.env.DOCS_WEBHOOK_TOKEN;

    if (!tokenEsperado) {
      console.error('[Webhook Docs] DOCS_WEBHOOK_TOKEN não configurado');
      return res.status(500).json({ success: false, error: 'Webhook não configurado no servidor' });
    }

    if (!token || token !== tokenEsperado) {
      console.warn('[Webhook Docs] Token inválido');
      return res.status(401).json({ success: false, error: 'Token inválido' });
    }

    const { telefone, nomeCliente, tipoRegime, nomeCorretor, emailCliente, empreendimento } = req.body;

    if (!telefone) {
      return res.status(400).json({ success: false, error: 'Campo "telefone" é obrigatório' });
    }

    if (!tipoRegime || !['autonomo', 'clt'].includes(tipoRegime)) {
      return res.status(400).json({ success: false, error: 'Campo "tipoRegime" deve ser "autonomo" ou "clt"' });
    }

    const regimeLabel = tipoRegime === 'autonomo' ? 'Autônomo' : 'CLT';
    console.log(`[Webhook Docs] Recebido — cliente: ${maskPII(nomeCliente)}, telefone: ${maskPII(telefone)}, regime: ${tipoRegime}`);

    // Resolver corretorId e projectId pelo nome informado no formulário
    let corretorResolvido: { id: number; name: string } | null = null;
    let projetoResolvido: { id: number; nome: string } | null = null;
    if (nomeCorretor) {
      corretorResolvido = await db.buscarCorretorPorNome(nomeCorretor);
      if (corretorResolvido) {
        console.log(`[Webhook Docs] Corretor resolvido: ${corretorResolvido.name} (id=${corretorResolvido.id})`);
      } else {
        console.warn(`[Webhook Docs] Corretor não encontrado pelo nome: "${nomeCorretor}"`);
      }
    }
    if (empreendimento) {
      projetoResolvido = await db.buscarProjetoPorNome(empreendimento);
      if (projetoResolvido) {
        console.log(`[Webhook Docs] Projeto resolvido: ${projetoResolvido.nome} (id=${projetoResolvido.id})`);
      } else {
        console.warn(`[Webhook Docs] Projeto não encontrado pelo nome: "${empreendimento}"`);
      }
    }

    // Buscar lead pelo telefone com normalização inteligente
    let lead = await db.buscarLeadPorTelefone(telefone);
    let leadCriado = false;

    if (!lead) {
      // Tentar buscar por email se fornecido
      if (emailCliente) {
        const db2 = await import('./db');
        // Busca por email não existe como função separada, usar checkLeadDuplicado
        const check = await db.checkLeadDuplicado(undefined, emailCliente);
        if (check.isDuplicate && check.leadId) {
          const leadPorEmail = await db.getLeadById(check.leadId);
          if (leadPorEmail) {
            lead = {
              id: leadPorEmail.id,
              nome: leadPorEmail.nome,
              telefone: leadPorEmail.telefone,
              email: leadPorEmail.email,
              status: leadPorEmail.status,
              corretorId: leadPorEmail.corretorId,
              projectId: leadPorEmail.projectId,
              projetoCustom: leadPorEmail.projetoCustom,
            };
            console.log(`[Webhook Docs] Lead encontrado por email: id=${lead.id}`);
          }
        }
      }
    }

    if (!lead) {
      // Lead não encontrado — criar automaticamente
      console.log(`[Webhook Docs] Lead não encontrado. Criando automaticamente para: ${maskPII(nomeCliente || 'N/A')}`);

      const novoLead = await db.criarLeadDocumentacao({
        nome: nomeCliente || 'Cliente (via Formulário)',
        telefone,
        email: emailCliente || undefined,
        tipoRegime: tipoRegime as 'autonomo' | 'clt',
        nomeCorretor,
        empreendimento,
        corretorId: corretorResolvido?.id,
        projectId: projetoResolvido?.id,
      });

      leadCriado = true;

      // Notificar gestor sobre novo lead criado via formulário
      try {
        await notifyOwner({
          title: `📄 Novo Lead via Formulário de Documentação (${regimeLabel})`,
          content: [
            `Um novo lead foi criado automaticamente após envio de documentação via Google Forms.`,
            ``,
            `👤 **Cliente:** ${nomeCliente || 'Não informado'}`,
            `📞 **Telefone:** ${telefone}`,
            emailCliente ? `📧 **E-mail:** ${emailCliente}` : '',
            empreendimento ? `🏢 **Empreendimento:** ${empreendimento}` : '',
            `💼 **Regime:** ${regimeLabel}`,
            nomeCorretor ? `🧑‍💼 **Corretor:** ${nomeCorretor}` : '',
            ``,
            `✅ Status: Análise de Crédito`,
            `⚠️ Lead criado automaticamente (não existia no sistema).`,
          ].filter(Boolean).join('\n'),
        });
      } catch (notifErr) {
        console.warn('[Webhook Docs] Falha ao notificar gestor (lead criado):', notifErr);
      }

      return res.status(201).json({
        success: true,
        leadId: novoLead.id,
        leadNome: novoLead.nome,
        statusAnterior: null,
        statusNovo: 'analise_credito',
        leadCriado: true,
        message: 'Lead criado e já em Análise de Crédito',
      });
    }

    console.log(`[Webhook Docs] Lead encontrado: id=${lead.id}, status=${lead.status}`);
    const statusAnterior = lead.status;

    // Atualizar corretorId e projectId no lead existente se resolvidos e não preenchidos
    if (corretorResolvido?.id || projetoResolvido?.id) {
      const updates: Record<string, unknown> = {};
      if (corretorResolvido?.id && !lead.corretorId) updates.corretorId = corretorResolvido.id;
      if (projetoResolvido?.id && !lead.projectId) updates.projectId = projetoResolvido.id;
      if (Object.keys(updates).length > 0) {
        await db.updateLead(lead.id, updates as any);
        console.log(`[Webhook Docs] Lead ${lead.id} atualizado com:`, updates);
      }
    }

    await db.atualizarLeadParaAnaliseCredito(lead.id, tipoRegime as 'autonomo' | 'clt', nomeCorretor);

    // Notificar gestor sobre documentação enviada
    try {
      const statusLabel: Record<string, string> = {
        novo: 'Novo',
        aguardando_atendimento: 'Aguardando Atendimento',
        em_atendimento: 'Em Atendimento',
        qualificado: 'Qualificado',
        agendado: 'Agendado',
        visita_realizada: 'Visita Realizada',
        proposta_enviada: 'Proposta Enviada',
        analise_credito: 'Análise de Crédito',
        contrato_fechado: 'Contrato Fechado',
        pos_venda: 'Pós-Venda',
        perdido: 'Perdido',
      };

      const statusAnteriorLabel = statusLabel[statusAnterior] || statusAnterior;
      const jaEstaEmAnalise = statusAnterior === 'analise_credito';

      await notifyOwner({
        title: `📄 Documentação Enviada — ${lead.nome} (${regimeLabel})`,
        content: [
          `Documentação enviada via Google Forms para análise de crédito.`,
          ``,
          `👤 **Cliente:** ${lead.nome}`,
          `📞 **Telefone:** ${lead.telefone}`,
          lead.email ? `📧 **E-mail:** ${lead.email}` : '',
          lead.projetoCustom ? `🏢 **Empreendimento:** ${lead.projetoCustom}` : '',
          `💼 **Regime:** ${regimeLabel}`,
          nomeCorretor ? `🧑‍💼 **Corretor:** ${nomeCorretor}` : '',
          ``,
          jaEstaEmAnalise
            ? `ℹ️ Lead já estava em Análise de Crédito.`
            : `🔄 Status: ${statusAnteriorLabel} → Análise de Crédito`,
        ].filter(Boolean).join('\n'),
      });
    } catch (notifErr) {
      console.warn('[Webhook Docs] Falha ao notificar gestor:', notifErr);
    }

    return res.status(200).json({
      success: true,
      leadId: lead.id,
      leadNome: lead.nome,
      statusAnterior,
      statusNovo: 'analise_credito',
      leadCriado: false,
      message: 'Lead atualizado para Análise de Crédito com sucesso',
    });

  } catch (error: any) {
    console.error('[Webhook Docs] Erro:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar documentação',
      message: error.message,
    });
  }
});

export default router;

