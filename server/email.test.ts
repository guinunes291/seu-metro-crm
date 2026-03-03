/**
 * Testes unitários para o serviço de email
 * Verifica a estrutura dos templates e a lógica de envio
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCK DO NODEMAILER
// ============================================================================

const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-message-id-123' });
const mockCreateTransport = vi.fn().mockReturnValue({ sendMail: mockSendMail });

vi.mock('nodemailer', () => ({
  default: { createTransport: mockCreateTransport },
}));

// ============================================================================
// VARIÁVEIS DE AMBIENTE PARA TESTE
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EMAIL_HOST = 'smtp.test.com';
  process.env.EMAIL_PORT = '587';
  process.env.EMAIL_USER = 'test@test.com';
  process.env.EMAIL_PASS = 'testpass';
  process.env.EMAIL_FROM = 'CRM Teste <noreply@test.com>';
});

// ============================================================================
// TESTES: NOTIFICAÇÃO DE NOVO LEAD
// ============================================================================

describe('enviarNotificacaoLeadWebhook', () => {
  it('deve enviar email com assunto correto para novo lead', async () => {
    const { enviarNotificacaoLeadWebhook } = await import('./emailService');

    const resultado = await enviarNotificacaoLeadWebhook({
      corretorNome: 'João Silva',
      corretorEmail: 'joao@imobiliaria.com',
      leadNome: 'Maria Santos',
      leadTelefone: '11999887766',
      leadOrigem: 'Facebook ADS',
      leadProjeto: 'Residencial Primavera',
      leadFaixaRenda: 'R$ 2.000 - R$ 4.000',
    });

    expect(resultado.success).toBe(true);
    expect(resultado.messageId).toBe('test-message-id-123');
    expect(mockSendMail).toHaveBeenCalledOnce();

    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.to).toBe('joao@imobiliaria.com');
    expect(callArgs.subject).toContain('Maria Santos');
    expect(callArgs.subject).toContain('Facebook ADS');
    expect(callArgs.subject).toContain('🔔');
  });

  it('deve incluir nome do corretor no corpo do email', async () => {
    const { enviarNotificacaoLeadWebhook } = await import('./emailService');

    await enviarNotificacaoLeadWebhook({
      corretorNome: 'Ana Pereira',
      corretorEmail: 'ana@imobiliaria.com',
      leadNome: 'Carlos Oliveira',
      leadTelefone: '11988776655',
      leadOrigem: 'Facebook ADS',
    });

    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.html).toContain('Ana Pereira');
    expect(callArgs.html).toContain('Carlos Oliveira');
  });

  it('deve incluir link de WhatsApp com número do lead sem formatação', async () => {
    const { enviarNotificacaoLeadWebhook } = await import('./emailService');

    await enviarNotificacaoLeadWebhook({
      corretorNome: 'Pedro Costa',
      corretorEmail: 'pedro@imobiliaria.com',
      leadNome: 'Lucia Ferreira',
      leadTelefone: '(11) 97777-6666',
      leadOrigem: 'Facebook ADS',
    });

    const callArgs = mockSendMail.mock.calls[0][0];
    // Número formatado deve ser convertido para apenas dígitos
    expect(callArgs.html).toContain('11977776666');
  });

  it('deve incluir informações opcionais quando fornecidas', async () => {
    const { enviarNotificacaoLeadWebhook } = await import('./emailService');

    await enviarNotificacaoLeadWebhook({
      corretorNome: 'Corretor Teste',
      corretorEmail: 'corretor@test.com',
      leadNome: 'Lead Teste',
      leadTelefone: '11999999999',
      leadEmail: 'lead@email.com',
      leadOrigem: 'Facebook ADS',
      leadProjeto: 'Projeto Alpha',
      leadFaixaRenda: 'R$ 3.000 - R$ 5.000',
      leadCampanha: 'Campanha Verão 2026',
    });

    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.html).toContain('lead@email.com');
    expect(callArgs.html).toContain('Projeto Alpha');
    expect(callArgs.html).toContain('R$ 3.000 - R$ 5.000');
    expect(callArgs.html).toContain('Campanha Verão 2026');
  });

  it('deve usar header azul para novo lead', async () => {
    const { enviarNotificacaoLeadWebhook } = await import('./emailService');

    await enviarNotificacaoLeadWebhook({
      corretorNome: 'Corretor',
      corretorEmail: 'corretor@test.com',
      leadNome: 'Lead',
      leadTelefone: '11999999999',
      leadOrigem: 'Facebook ADS',
    });

    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.html).toContain('#1e3a8a');
    expect(callArgs.html).toContain('Novo Lead Recebido');
  });
});

// ============================================================================
// TESTES: NOTIFICAÇÃO DE LEAD REDISTRIBUÍDO
// ============================================================================

describe('enviarNotificacaoLeadRedistribuido', () => {
  it('deve enviar email com assunto de urgência para lead redistribuído', async () => {
    const { enviarNotificacaoLeadRedistribuido } = await import('./emailService');

    const resultado = await enviarNotificacaoLeadRedistribuido({
      corretorNome: 'Bruno Alves',
      corretorEmail: 'bruno@imobiliaria.com',
      leadNome: 'Fernanda Lima',
      leadTelefone: '11966554433',
      leadOrigem: 'Facebook ADS',
      tipoFila: 'geral',
      minutosEspera: 15,
    });

    expect(resultado.success).toBe(true);
    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.subject).toContain('🔁');
    expect(callArgs.subject).toContain('Fernanda Lima');
    expect(callArgs.to).toBe('bruno@imobiliaria.com');
  });

  it('deve incluir badge de fila geral no corpo do email', async () => {
    const { enviarNotificacaoLeadRedistribuido } = await import('./emailService');

    await enviarNotificacaoLeadRedistribuido({
      corretorNome: 'Corretor Geral',
      corretorEmail: 'geral@test.com',
      leadNome: 'Lead Geral',
      leadTelefone: '11955443322',
      leadOrigem: 'Facebook ADS',
      tipoFila: 'geral',
      minutosEspera: 15,
    });

    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.html).toContain('Fila Geral');
  });

  it('deve incluir badge de fila foco no corpo do email', async () => {
    const { enviarNotificacaoLeadRedistribuido } = await import('./emailService');

    await enviarNotificacaoLeadRedistribuido({
      corretorNome: 'Corretor Foco',
      corretorEmail: 'foco@test.com',
      leadNome: 'Lead Foco',
      leadTelefone: '11944332211',
      leadOrigem: 'Facebook ADS',
      tipoFila: 'foco',
      minutosEspera: 15,
    });

    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.html).toContain('Fila Foco');
  });

  it('deve incluir tempo de espera no alerta do email', async () => {
    const { enviarNotificacaoLeadRedistribuido } = await import('./emailService');

    await enviarNotificacaoLeadRedistribuido({
      corretorNome: 'Corretor',
      corretorEmail: 'corretor@test.com',
      leadNome: 'Lead',
      leadTelefone: '11933221100',
      leadOrigem: 'Facebook ADS',
      tipoFila: 'geral',
      minutosEspera: 15,
    });

    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.html).toContain('15');
    expect(callArgs.html).toContain('minutos');
  });

  it('deve usar header vermelho/laranja para lead redistribuído (urgência)', async () => {
    const { enviarNotificacaoLeadRedistribuido } = await import('./emailService');

    await enviarNotificacaoLeadRedistribuido({
      corretorNome: 'Corretor',
      corretorEmail: 'corretor@test.com',
      leadNome: 'Lead',
      leadTelefone: '11922110099',
      leadOrigem: 'Facebook ADS',
      tipoFila: 'geral',
      minutosEspera: 15,
    });

    const callArgs = mockSendMail.mock.calls[0][0];
    // Header vermelho indica urgência
    expect(callArgs.html).toContain('#dc2626');
    expect(callArgs.html).toContain('Lead Transferido para Você');
  });

  it('deve diferenciar visualmente fila foco (estrela) de fila geral (prancheta)', async () => {
    const { enviarNotificacaoLeadRedistribuido } = await import('./emailService');

    await enviarNotificacaoLeadRedistribuido({
      corretorNome: 'Corretor',
      corretorEmail: 'corretor@test.com',
      leadNome: 'Lead',
      leadTelefone: '11911009988',
      leadOrigem: 'Facebook ADS',
      tipoFila: 'foco',
      minutosEspera: 15,
    });

    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.html).toContain('⭐');
  });
});

// ============================================================================
// TESTES: TESTE DE CONFIGURAÇÃO
// ============================================================================

describe('testarConfiguracao', () => {
  it('deve enviar email de teste com assunto correto', async () => {
    const { testarConfiguracao } = await import('./emailService');

    const resultado = await testarConfiguracao('admin@test.com');

    expect(resultado.success).toBe(true);
    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.to).toBe('admin@test.com');
    expect(callArgs.subject).toContain('Teste de Configuração');
  });
});
