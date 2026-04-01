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

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const host = process.env.EMAIL_HOST;
  const port = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : 587;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      'Configuração de email incompleta. Verifique EMAIL_HOST, EMAIL_USER e EMAIL_PASS.'
    );
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

// ============================================================================
// TEMPLATE BASE
// ============================================================================

function buildEmailHtml({
  headerColor,
  headerEmoji,
  headerTitle,
  headerSubtitle,
  alertColor,
  alertBorderColor,
  alertEmoji,
  alertText,
  corretorNome,
  introText,
  infoRows,
  ctaHref,
  ctaText,
  ctaColor,
  footerNote,
}: {
  headerColor: string;
  headerEmoji: string;
  headerTitle: string;
  headerSubtitle: string;
  alertColor: string;
  alertBorderColor: string;
  alertEmoji: string;
  alertText: string;
  corretorNome: string;
  introText: string;
  infoRows: { label: string; value: string }[];
  ctaHref: string;
  ctaText: string;
  ctaColor: string;
  footerNote: string;
}): string {
  const rows = infoRows
    .map(
      (r) => `
      <tr>
        <td style="padding:10px 12px;font-weight:600;color:#6b7280;font-size:13px;width:140px;vertical-align:top;border-bottom:1px solid #f3f4f6;">${r.label}</td>
        <td style="padding:10px 12px;color:#111827;font-size:14px;border-bottom:1px solid #f3f4f6;">${r.value}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${headerTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="background:${headerColor};border-radius:12px 12px 0 0;padding:36px 40px;text-align:center;">
              <div style="font-size:48px;line-height:1;margin-bottom:12px;">${headerEmoji}</div>
              <h1 style="margin:0 0 6px;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">${headerTitle}</h1>
              <p style="margin:0;color:rgba(255,255,255,0.85);font-size:14px;">${headerSubtitle}</p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background:#ffffff;padding:32px 40px;">

              <!-- ALERTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:${alertColor};border-left:4px solid ${alertBorderColor};border-radius:6px;margin-bottom:24px;">
                <tr>
                  <td style="padding:14px 16px;font-size:14px;color:#1f2937;">
                    <strong>${alertEmoji} ATENÇÃO:</strong> ${alertText}
                  </td>
                </tr>
              </table>

              <!-- SAUDAÇÃO -->
              <p style="margin:0 0 6px;font-size:16px;color:#374151;">Olá, <strong>${corretorNome}</strong>!</p>
              <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">${introText}</p>

              <!-- CARD DE INFORMAÇÕES -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:28px;overflow:hidden;">
                <tr>
                  <td style="background:#1e3a8a;padding:14px 16px;">
                    <span style="color:#ffffff;font-weight:700;font-size:14px;">📋 Informações do Lead</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${rows}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <a href="${ctaHref}" style="display:inline-block;background:${ctaColor};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;letter-spacing:0.3px;">${ctaText}</a>
                  </td>
                </tr>
              </table>

              <!-- DICA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border-radius:8px;margin-bottom:8px;">
                <tr>
                  <td style="padding:14px 16px;font-size:13px;color:#1e40af;line-height:1.5;">
                    💡 <strong>Dica:</strong> Leads do Facebook têm alta taxa de conversão quando contatados nos primeiros <strong>5 minutos</strong>. Não deixe esfriar!
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f8fafc;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">Este é um email automático do <strong>CRM Seu Metro Quadrado</strong></p>
              <p style="margin:0;font-size:12px;color:#9ca3af;">${footerNote}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ============================================================================
// NOTIFICAÇÃO: NOVO LEAD (distribuição inicial)
// ============================================================================


// ============================================================================
// RETRY HELPER — até 3 tentativas com backoff exponencial (1s, 2s, 4s)
// ============================================================================
async function sendWithRetry(
  transport: import('nodemailer').Transporter,
  mailOptions: Parameters<import('nodemailer').Transporter['sendMail']>[0],
  maxAttempts = 3
): Promise<{ messageId: string }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const info = await transport.sendMail(mailOptions);
      if (attempt > 1) {
        console.log(`[Email] Enviado na tentativa ${attempt}/${maxAttempts}`);
      }
      return info as { messageId: string };
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        console.warn(`[Email] Tentativa ${attempt}/${maxAttempts} falhou. Retentando em ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

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
    const from =
      process.env.EMAIL_FROM ||
      'CRM Seu Metro Quadrado <noreply@seumetroquadrado.com.br>';

    const infoRows: { label: string; value: string }[] = [
      { label: 'Nome', value: dados.leadNome },
      {
        label: 'Telefone',
        value: `<a href="https://wa.me/${dados.leadTelefone.replace(/\D/g, '')}" style="color:#1e3a8a;">${dados.leadTelefone}</a>`,
      },
    ];
    if (dados.leadEmail) infoRows.push({ label: 'E-mail', value: dados.leadEmail });
    if (dados.leadProjeto) infoRows.push({ label: 'Projeto', value: dados.leadProjeto });
    if (dados.leadFaixaRenda) infoRows.push({ label: 'Faixa de Renda', value: dados.leadFaixaRenda });
    if (dados.leadCampanha) infoRows.push({ label: 'Campanha', value: dados.leadCampanha });
    infoRows.push({ label: 'Origem', value: dados.leadOrigem });

    const telefoneNumerico = dados.leadTelefone.replace(/\D/g, '');

    const html = buildEmailHtml({
      headerColor: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
      headerEmoji: '🔔',
      headerTitle: 'Novo Lead Recebido!',
      headerSubtitle: `Lead distribuído automaticamente via ${dados.leadOrigem}`,
      alertColor: '#fef9c3',
      alertBorderColor: '#f59e0b',
      alertEmoji: '⚡',
      alertText: `Um novo lead do <strong>${dados.leadOrigem}</strong> foi atribuído a você. Entre em contato <strong>imediatamente</strong>!`,
      corretorNome: dados.corretorNome,
      introText:
        'Um novo lead chegou e foi distribuído automaticamente para você pela roleta do CRM. Acesse o sistema ou clique no botão abaixo para iniciar o atendimento.',
      infoRows,
      ctaHref: (() => {
        const msg = dados.leadProjeto
          ? `Olá, ${dados.leadNome}! Tudo bem? 😊 Vi que você demonstrou interesse no empreendimento ${dados.leadProjeto}. Sou corretor(a) da Seu Metro Quadrado e estou aqui para te ajudar. Posso te passar mais informações?`
          : `Olá, ${dados.leadNome}! Tudo bem? 😊 Vi que você demonstrou interesse em nossos empreendimentos. Sou corretor(a) da Seu Metro Quadrado e estou aqui para te ajudar. Posso te passar mais informações?`;
        return `https://wa.me/${telefoneNumerico}?text=${encodeURIComponent(msg)}`;
      })(),
      ctaText: '💬 Contatar via WhatsApp',
      ctaColor: '#16a34a',
      footerNote: 'Acesse o sistema para registrar suas interações e acompanhar o lead.',
    });

    const info = await sendWithRetry(transport, {
      from,
      to: dados.corretorEmail,
      subject: `🔔 Novo Lead: ${dados.leadNome} — ${dados.leadOrigem}`,
      html,
    });

    console.log('[Email] Notificação de novo lead enviada:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email] Erro ao enviar notificação de novo lead:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

// ============================================================================
// NOTIFICAÇÃO: LEAD REDISTRIBUÍDO (timer de 15 min)
// ============================================================================

export async function enviarNotificacaoLeadRedistribuido(dados: {
  corretorNome: string;
  corretorEmail: string;
  leadNome: string;
  leadTelefone: string;
  leadEmail?: string;
  leadOrigem: string;
  leadProjeto?: string;
  leadFaixaRenda?: string;
  tipoFila: 'geral' | 'foco';
  minutosEspera: number;
}) {
  try {
    const transport = getTransporter();
    const from =
      process.env.EMAIL_FROM ||
      'CRM Seu Metro Quadrado <noreply@seumetroquadrado.com.br>';

    const infoRows: { label: string; value: string }[] = [
      { label: 'Nome', value: dados.leadNome },
      {
        label: 'Telefone',
        value: `<a href="https://wa.me/${dados.leadTelefone.replace(/\D/g, '')}" style="color:#1e3a8a;">${dados.leadTelefone}</a>`,
      },
    ];
    if (dados.leadEmail) infoRows.push({ label: 'E-mail', value: dados.leadEmail });
    if (dados.leadProjeto) infoRows.push({ label: 'Projeto', value: dados.leadProjeto });
    if (dados.leadFaixaRenda) infoRows.push({ label: 'Faixa de Renda', value: dados.leadFaixaRenda });
    infoRows.push({ label: 'Origem', value: dados.leadOrigem });
    infoRows.push({
      label: 'Fila',
      value: dados.tipoFila === 'foco'
        ? '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">⭐ Fila Foco</span>'
        : '<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">📋 Fila Geral</span>',
    });

    const telefoneNumerico = dados.leadTelefone.replace(/\D/g, '');

    const html = buildEmailHtml({
      headerColor: 'linear-gradient(135deg, #dc2626 0%, #f97316 100%)',
      headerEmoji: '🔁',
      headerTitle: 'Lead Transferido para Você!',
      headerSubtitle: `Redistribuído após ${dados.minutosEspera} min sem atendimento`,
      alertColor: '#fee2e2',
      alertBorderColor: '#ef4444',
      alertEmoji: '🚨',
      alertText: `Este lead ficou <strong>${dados.minutosEspera} minutos</strong> sem atendimento e foi transferido para você. <strong>Contate agora!</strong>`,
      corretorNome: dados.corretorNome,
      introText:
        'Este lead foi redistribuído automaticamente pelo sistema após o tempo limite de espera. O cliente está aguardando contato — cada minuto conta!',
      infoRows,
      ctaHref: (() => {
        const msg = dados.leadProjeto
          ? `Olá, ${dados.leadNome}! Tudo bem? 😊 Vi que você demonstrou interesse no empreendimento ${dados.leadProjeto}. Sou corretor(a) da Seu Metro Quadrado e estou aqui para te ajudar. Posso te passar mais informações?`
          : `Olá, ${dados.leadNome}! Tudo bem? 😊 Vi que você demonstrou interesse em nossos empreendimentos. Sou corretor(a) da Seu Metro Quadrado e estou aqui para te ajudar. Posso te passar mais informações?`;
        return `https://wa.me/${telefoneNumerico}?text=${encodeURIComponent(msg)}`;
      })(),
      ctaText: '🚀 Atender Agora via WhatsApp',
      ctaColor: '#dc2626',
      footerNote: 'Acesse o sistema para registrar suas interações e acompanhar o lead.',
    });

    const info = await sendWithRetry(transport, {
      from,
      to: dados.corretorEmail,
      subject: `🔁 Lead Transferido: ${dados.leadNome} — Atenda agora!`,
      html,
    });

    console.log('[Email] Notificação de redistribuição enviada:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email] Erro ao enviar notificação de redistribuição:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

// ============================================================================
// TESTE DE CONFIGURAÇÃO
// ============================================================================

export async function testarConfiguracao(emailDestino: string) {
  try {
    const transport = getTransporter();
    const from =
      process.env.EMAIL_FROM ||
      'CRM Seu Metro Quadrado <noreply@seumetroquadrado.com.br>';

    const info = await sendWithRetry(transport, {
      from,
      to: emailDestino,
      subject: 'Teste de Configuração — CRM Seu Metro Quadrado',
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%);padding:28px;text-align:center;">
            <div style="font-size:40px;">✅</div>
            <h1 style="margin:8px 0 0;color:#fff;font-size:20px;">Configuração Funcionando!</h1>
          </div>
          <div style="padding:28px;color:#374151;">
            <p>Se você recebeu este email, o serviço de notificações está configurado corretamente.</p>
            <p style="color:#6b7280;font-size:13px;"><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
          </div>
        </div>
      `,
    });

    console.log('[Email] Email de teste enviado:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email] Erro ao enviar email de teste:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}
