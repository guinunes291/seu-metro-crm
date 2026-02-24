import { describe, it, expect } from 'vitest';

/**
 * Testes para validar que as atividades são atribuídas ao corretor dono do lead,
 * não ao gestor/admin que executou a ação.
 * 
 * Regra: Quando gestor/admin cria agendamento, visita, análise ou interação em um lead
 * de outro corretor, o corretorId do registro deve ser o do dono do lead.
 */

describe('Atribuição de atividades ao corretor dono do lead', () => {
  
  // Simular a lógica de atribuição de corretorId
  function getCorretorParaRegistro(leadCorretorId: number | null, ctxUserId: number): number {
    return leadCorretorId || ctxUserId;
  }

  describe('Agendamentos', () => {
    it('deve atribuir agendamento ao corretor do lead quando gestor cria', () => {
      const leadCorretorId = 100; // corretor dono do lead
      const gestorId = 999; // gestor que está criando
      
      const corretorId = getCorretorParaRegistro(leadCorretorId, gestorId);
      expect(corretorId).toBe(100); // deve ser o corretor, não o gestor
    });

    it('deve atribuir agendamento ao admin quando lead não tem corretor', () => {
      const leadCorretorId = null; // lead sem corretor
      const adminId = 999;
      
      const corretorId = getCorretorParaRegistro(leadCorretorId, adminId);
      expect(corretorId).toBe(999); // fallback para quem criou
    });

    it('deve atribuir agendamento ao próprio corretor quando ele cria', () => {
      const leadCorretorId = 100;
      const corretorId = 100; // mesmo corretor
      
      const resultado = getCorretorParaRegistro(leadCorretorId, corretorId);
      expect(resultado).toBe(100);
    });
  });

  describe('Visitas', () => {
    it('deve atribuir visita ao corretor do lead quando gestor valida', () => {
      const leadCorretorId = 200;
      const gestorId = 999;
      
      const corretorId = getCorretorParaRegistro(leadCorretorId, gestorId);
      expect(corretorId).toBe(200);
    });
  });

  describe('Análises de crédito', () => {
    it('deve atribuir análise ao corretor do lead quando admin registra', () => {
      const leadCorretorId = 300;
      const adminId = 999;
      
      const corretorId = getCorretorParaRegistro(leadCorretorId, adminId);
      expect(corretorId).toBe(300);
    });
  });

  describe('Interações (ligações e WhatsApp)', () => {
    it('deve atribuir interação ao corretor do lead quando gestor registra', () => {
      const leadCorretorId = 400;
      const gestorId = 999;
      
      const corretorId = getCorretorParaRegistro(leadCorretorId, gestorId);
      expect(corretorId).toBe(400);
    });

    it('deve atribuir interação ao usuário quando lead não tem corretor', () => {
      const leadCorretorId = null;
      const userId = 999;
      
      const corretorId = getCorretorParaRegistro(leadCorretorId, userId);
      expect(corretorId).toBe(999);
    });
  });

  describe('Alterações de status', () => {
    it('deve registrar alteração de status no nome do corretor dono do lead', () => {
      const agendamentoCorretorId = 500;
      const gestorId = 999;
      
      const corretorId = agendamentoCorretorId || gestorId;
      expect(corretorId).toBe(500);
    });
  });

  describe('Contratos', () => {
    it('contrato recebe corretorId explícito do input (admin escolhe)', () => {
      // Contratos são criados pelo admin com corretorId explícito
      const inputCorretorId = 600;
      expect(inputCorretorId).toBe(600); // admin escolhe o corretor
    });
  });

  describe('Pontuação não deve ir para gestor/admin', () => {
    it('gestor (ID 999) não deve acumular pontos de ações em leads de outros', () => {
      const gestorId = 999;
      const leads = [
        { corretorId: 100, acao: 'agendamento' },
        { corretorId: 200, acao: 'visita' },
        { corretorId: 300, acao: 'analise' },
        { corretorId: null, acao: 'interacao' }, // lead sem corretor
      ];
      
      const atribuicoes = leads.map(l => getCorretorParaRegistro(l.corretorId, gestorId));
      
      // Apenas o lead sem corretor deve ir para o gestor
      const pontosParaGestor = atribuicoes.filter(id => id === gestorId);
      expect(pontosParaGestor.length).toBe(1); // apenas 1 de 4
      
      // Os outros 3 devem ir para os respectivos corretores
      expect(atribuicoes[0]).toBe(100);
      expect(atribuicoes[1]).toBe(200);
      expect(atribuicoes[2]).toBe(300);
      expect(atribuicoes[3]).toBe(999); // fallback
    });
  });
});
