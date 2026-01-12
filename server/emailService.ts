import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Serviço de envio de emails usando Nodemailer
 * 
 * Configuração via variáveis de ambiente:
 * - EMAIL_HOST: Servidor SMTP (ex: smtp.gmail.com)
 * - EMAIL_PORT: Porta SMTP (ex: 587)
 * - EMAIL_USER: Usuário de autenticação
 * - EMAIL_PASS: Senha ou App Password
 * - EMAIL_FROM: Email remetente (ex: "CRM Seu Metro Quadrado <crm@seumetroquadrado.com.br>")
 */

let transporter: Transporter | null = null;

/**
 * Inicializa o transportador de email
 */
function getTransporter(): Transporter {
  if (transporter) {
    return transporter;
  }

  const host = process.env.EMAIL_HOST;
  const port = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : 587;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !user || !pass) {
    throw new Error('Configuração de email incompleta. Verifique as variáveis de ambiente EMAIL_HOST, EMAIL_USER e EMAIL_PASS.');
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true para porta 465, false para outras portas
    auth: {
      user,
      pass,
    },
  });

  return transporter;
}

/**
 * Envia email de notificação para corretor quando recebe lead via webhook
 */
export async function enviarNotificacaoLeadWebhook(dados: {
  corretorNome: string;
  corretorEmail: string;
  leadNome: string;
  leadTelefone: string;
  leadEmail?: string;
  leadOrigem: string;
  leadProjeto?: string;
  leadCampanha?: string;
  leadFaixaRenda?: string;
}) {
  try {
    const transport = getTransporter();
    const from = process.env.EMAIL_FROM || 'CRM Seu Metro Quadrado <noreply@seumetroquadrado.com.br>';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .alert { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px; }
    .lead-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .lead-info h2 { color: #1e3a8a; margin-top: 0; font-size: 20px; }
    .info-row { display: flex; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .info-row:last-child { border-bottom: none; }
    .info-label { font-weight: bold; width: 140px; color: #6b7280; }
    .info-value { flex: 1; color: #111827; }
    .cta-button { display: inline-block; background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
    .cta-button:hover { background: #059669; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 Novo Lead Recebido!</h1>
    </div>
    <div class="content">
      <div class="alert">
        <strong>⚡ ATENÇÃO:</strong> Um novo lead do <strong>${dados.leadOrigem}</strong> foi atribuído a você!
      </div>
      
      <p>Olá <strong>${dados.corretorNome}</strong>,</p>
      <p>Um novo lead chegou via <strong>${dados.leadOrigem}</strong> e foi distribuído automaticamente para você. Entre em contato o mais rápido possível!</p>
      
      <div class="lead-info">
        <h2>📋 Informações do Lead</h2>
        <div class="info-row">
          <span class="info-label">Nome:</span>
          <span class="info-value">${dados.leadNome}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Telefone:</span>
          <span class="info-value">${dados.leadTelefone}</span>
        </div>
        ${dados.leadEmail ? `
        <div class="info-row">
          <span class="info-label">Email:</span>
          <span class="info-value">${dados.leadEmail}</span>
        </div>
        ` : ''}
        ${dados.leadProjeto ? `
        <div class="info-row">
          <span class="info-label">Projeto:</span>
          <span class="info-value">${dados.leadProjeto}</span>
        </div>
        ` : ''}
        ${dados.leadFaixaRenda ? `
        <div class="info-row">
          <span class="info-label">Faixa de Renda:</span>
          <span class="info-value">${dados.leadFaixaRenda}</span>
        </div>
        ` : ''}
        ${dados.leadCampanha ? `
        <div class="info-row">
          <span class="info-label">Campanha:</span>
          <span class="info-value">${dados.leadCampanha}</span>
        </div>
        ` : ''}
      </div>
      
      <center>
        <a href="https://whatsapp.com/send?phone=${dados.leadTelefone.replace(/\D/g, '')}" class="cta-button">
          💬 Contatar via WhatsApp
        </a>
      </center>
      
      <p style="margin-top: 30px;">
        <strong>💡 Dica:</strong> Leads do Facebook têm alta taxa de conversão quando contatados nas primeiras 5 minutos!
      </p>
      
      <div class="footer">
        <p>Este é um email automático do CRM Seu Metro Quadrado</p>
        <p>Acesse o sistema para registrar suas interações e acompanhar o lead</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const info = await transport.sendMail({
      from,
      to: dados.corretorEmail,
      subject: `🔔 Novo Lead: ${dados.leadNome} - ${dados.leadOrigem}`,
      html,
    });

    console.log('[Email] Notificação enviada:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email] Erro ao enviar notificação:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

/**
 * Testa a configuração de email enviando um email de teste
 */
export async function testarConfiguracao(emailDestino: string) {
  try {
    const transport = getTransporter();
    const from = process.env.EMAIL_FROM || 'CRM Seu Metro Quadrado <noreply@seumetroquadrado.com.br>';

    const info = await transport.sendMail({
      from,
      to: emailDestino,
      subject: 'Teste de Configuração - CRM Seu Metro Quadrado',
      html: `
        <h1>✅ Configuração de Email Funcionando!</h1>
        <p>Se você recebeu este email, significa que o serviço de notificações está configurado corretamente.</p>
        <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
      `,
    });

    console.log('[Email] Email de teste enviado:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email] Erro ao enviar email de teste:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}
