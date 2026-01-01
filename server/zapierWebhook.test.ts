import { describe, it, expect, vi } from 'vitest';
import { 
  enviarWebhookZapier, 
  criarPayloadAgendamento, 
  gerarMensagemConfirmacao,
  formatarTelefoneWhatsApp,
  formatarData,
  WebhookPayload
} from './zapierWebhook';

describe('Zapier Webhook', () => {
  describe('formatarTelefoneWhatsApp', () => {
    it('deve adicionar código do país 55 se não existir', () => {
      expect(formatarTelefoneWhatsApp('11999998888')).toBe('5511999998888');
    });

    it('deve remover caracteres especiais', () => {
      expect(formatarTelefoneWhatsApp('(11) 99999-8888')).toBe('5511999998888');
    });

    it('deve manter código do país se já existir', () => {
      expect(formatarTelefoneWhatsApp('5511999998888')).toBe('5511999998888');
    });

    it('deve remover zero inicial', () => {
      expect(formatarTelefoneWhatsApp('011999998888')).toBe('5511999998888');
    });
  });

  describe('formatarData', () => {
    it('deve formatar data de YYYY-MM-DD para DD/MM/YYYY', () => {
      expect(formatarData('2026-01-15')).toBe('15/01/2026');
    });
  });

  describe('gerarMensagemConfirmacao', () => {
    it('deve gerar mensagem formatada com todos os dados', () => {
      const mensagem = gerarMensagemConfirmacao({
        nomeCliente: 'João Silva',
        data: '2026-01-15',
        hora: '14:00',
        projeto: 'Residencial XYZ',
        endereco: 'Rua das Flores, 123',
        nomeCorretor: 'Maria Santos'
      });

      expect(mensagem).toContain('João Silva');
      expect(mensagem).toContain('15/01/2026');
      expect(mensagem).toContain('14:00');
      expect(mensagem).toContain('Residencial XYZ');
      expect(mensagem).toContain('Rua das Flores, 123');
      expect(mensagem).toContain('Maria Santos');
      expect(mensagem).toContain('Seu Metro Quadrado');
    });

    it('deve funcionar sem projeto e endereço', () => {
      const mensagem = gerarMensagemConfirmacao({
        nomeCliente: 'João Silva',
        data: '2026-01-15',
        hora: '14:00',
        nomeCorretor: 'Maria Santos'
      });

      expect(mensagem).toContain('João Silva');
      expect(mensagem).not.toContain('Empreendimento');
      expect(mensagem).not.toContain('Endereço');
    });
  });

  describe('criarPayloadAgendamento', () => {
    it('deve criar payload com estrutura correta', () => {
      const payload = criarPayloadAgendamento({
        cliente: {
          nome: 'João Silva',
          telefone: '11999998888',
          email: 'joao@email.com'
        },
        agendamento: {
          id: 1,
          data: '2026-01-15',
          hora: '14:00',
          projeto: 'Residencial XYZ'
        },
        corretor: {
          id: 1,
          nome: 'Maria Santos'
        }
      });

      expect(payload.evento).toBe('agendamento_criado');
      expect(payload.timestamp).toBeDefined();
      expect(payload.cliente?.nome).toBe('João Silva');
      expect(payload.agendamento?.data).toBe('2026-01-15');
      expect(payload.corretor?.nome).toBe('Maria Santos');
    });
  });

  describe('enviarWebhookZapier', () => {
    it('deve retornar erro se URL não estiver configurada', async () => {
      const payload: WebhookPayload = {
        evento: 'agendamento_criado',
        timestamp: new Date().toISOString()
      };

      const resultado = await enviarWebhookZapier('', payload);
      
      expect(resultado.success).toBe(false);
      expect(resultado.error).toContain('não configurada');
    });

    it('deve enviar webhook para URL válida do Zapier', async () => {
      const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
      
      // Se não tiver URL configurada, pular teste
      if (!webhookUrl) {
        console.log('ZAPIER_WEBHOOK_URL não configurada, pulando teste de envio');
        return;
      }

      const payload = criarPayloadAgendamento({
        cliente: {
          nome: '_TESTE_Zapier_Webhook',
          telefone: '11999999999',
          email: 'teste@teste.com'
        },
        agendamento: {
          id: 999999,
          data: '2026-01-01',
          hora: '10:00',
          projeto: 'TESTE - Ignorar'
        },
        corretor: {
          id: 1,
          nome: 'Corretor Teste'
        }
      });

      const resultado = await enviarWebhookZapier(webhookUrl, payload);
      
      // O Zapier aceita qualquer payload, então deve retornar sucesso
      expect(resultado.success).toBe(true);
    });
  });
});
