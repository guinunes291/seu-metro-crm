import { describe, it, expect } from 'vitest';
import { testarConfiguracao } from './emailService';

describe('Email Service', () => {
  it('deve validar configuração SMTP e enviar email de teste', async () => {
    // Usar email do próprio usuário configurado
    const emailTeste = process.env.EMAIL_USER || 'teste@exemplo.com';
    
    const resultado = await testarConfiguracao(emailTeste);
    
    expect(resultado.success).toBe(true);
    expect(resultado.messageId).toBeDefined();
    
    console.log('✅ Email de teste enviado com sucesso!');
    console.log('📧 Verifique sua caixa de entrada:', emailTeste);
    console.log('📨 Message ID:', resultado.messageId);
  }, 30000); // Timeout de 30 segundos para envio de email
});
