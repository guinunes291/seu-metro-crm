import { Router, Request, Response } from 'express';
import * as db from './db';

const router = Router();

/**
 * Webhook para receber leads do Facebook Ads
 * 
 * Endpoint: POST /api/webhook/facebook/:token
 * 
 * O Facebook envia os dados no formato:
 * {
 *   "entry": [{
 *     "changes": [{
 *       "value": {
 *         "leadgen_id": "123456789",
 *         "page_id": "987654321",
 *         "form_id": "111222333",
 *         "field_data": [
 *           { "name": "full_name", "values": ["João Silva"] },
 *           { "name": "email", "values": ["joao@email.com"] },
 *           { "name": "phone_number", "values": ["+5511999999999"] }
 *         ]
 *       }
 *     }]
 *   }]
 * }
 */
router.post('/facebook/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const body = req.body;
    
    console.log('[Webhook Facebook] Recebido:', JSON.stringify(body, null, 2));
    
    // Extrair dados do lead do formato do Facebook
    let nome = '';
    let email = '';
    let telefone = '';
    
    // Verificar se é o formato do Facebook Lead Ads
    if (body.entry && body.entry[0]?.changes) {
      const fieldData = body.entry[0].changes[0]?.value?.field_data || [];
      
      for (const field of fieldData) {
        const fieldName = field.name?.toLowerCase();
        const value = field.values?.[0] || '';
        
        if (fieldName === 'full_name' || fieldName === 'nome' || fieldName === 'name') {
          nome = value;
        } else if (fieldName === 'email') {
          email = value;
        } else if (fieldName === 'phone_number' || fieldName === 'telefone' || fieldName === 'phone') {
          telefone = value;
        }
      }
    } 
    // Formato simplificado (para testes e outras integrações)
    else if (body.nome || body.name) {
      nome = body.nome || body.name || '';
      email = body.email || '';
      telefone = body.telefone || body.phone || body.phone_number || '';
    }
    
    // Validar dados mínimos
    if (!nome || !telefone) {
      console.log('[Webhook Facebook] Dados insuficientes:', { nome, telefone });
      return res.status(400).json({ 
        error: 'Dados insuficientes',
        message: 'Nome e telefone são obrigatórios',
        received: { nome, telefone }
      });
    }
    
    // Processar lead via roleta
    const resultado = await db.processarLeadWebhook(token, {
      nome,
      email,
      telefone,
      origem: 'facebook',
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
    
    return res.status(400).json({
      error: 'Erro ao processar webhook',
      message: error.message,
    });
  }
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
 * Webhook genérico para outras integrações
 * 
 * Endpoint: POST /api/webhook/lead/:token
 * 
 * Aceita formato simplificado:
 * {
 *   "nome": "João Silva",
 *   "email": "joao@email.com",
 *   "telefone": "11999999999"
 * }
 */
router.post('/lead/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { nome, email, telefone, name, phone } = req.body;
    
    const leadNome = nome || name || '';
    const leadTelefone = telefone || phone || '';
    
    if (!leadNome || !leadTelefone) {
      return res.status(400).json({ 
        error: 'Dados insuficientes',
        message: 'Nome e telefone são obrigatórios',
      });
    }
    
    const resultado = await db.processarLeadWebhook(token, {
      nome: leadNome,
      email: email || '',
      telefone: leadTelefone,
    });
    
    return res.status(200).json({
      success: true,
      leadId: resultado.lead.id,
      corretorId: resultado.corretorId,
      distribuido: resultado.distribuido,
    });
    
  } catch (error: any) {
    return res.status(400).json({
      error: 'Erro ao processar webhook',
      message: error.message,
    });
  }
});

export default router;
