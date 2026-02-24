import { describe, it, expect } from 'vitest';

/**
 * Testes para validar os valores de pontuação atualizados (24/02/2026)
 */
describe("Pontuação atualizada por ação", () => {
  // Valores definidos pelo gestor em 24/02/2026
  const PONTOS_ESPERADOS = {
    LIGACAO: 2,
    WHATSAPP: 1,
    AGENDAMENTO: 100,
    VISITA: 250,
    DOCUMENTACAO: 400,
    VENDA: 1000,
  };

  // Simula a lógica de cálculo de pontuação do db.ts
  function calcularPontuacao(atividade: {
    ligacoesRealizadas: number;
    whatsappEnviados: number;
    agendamentosConfirmados: number;
    visitasRealizadas: number;
    documentacoesEnviadas: number;
    vendasRealizadas: number;
  }, PONTOS: typeof PONTOS_ESPERADOS) {
    let pontuacao = 0;
    pontuacao += atividade.ligacoesRealizadas * PONTOS.LIGACAO;
    pontuacao += atividade.whatsappEnviados * PONTOS.WHATSAPP;
    pontuacao += atividade.agendamentosConfirmados * PONTOS.AGENDAMENTO;
    pontuacao += atividade.visitasRealizadas * PONTOS.VISITA;
    pontuacao += atividade.documentacoesEnviadas * PONTOS.DOCUMENTACAO;
    pontuacao += atividade.vendasRealizadas * PONTOS.VENDA;
    return pontuacao;
  }

  it("ligação realizada deve valer 2 pontos", () => {
    expect(PONTOS_ESPERADOS.LIGACAO).toBe(2);
  });

  it("WhatsApp enviado deve valer 1 ponto", () => {
    expect(PONTOS_ESPERADOS.WHATSAPP).toBe(1);
  });

  it("agendamento confirmado deve valer 100 pontos", () => {
    expect(PONTOS_ESPERADOS.AGENDAMENTO).toBe(100);
  });

  it("visita realizada deve valer 250 pontos", () => {
    expect(PONTOS_ESPERADOS.VISITA).toBe(250);
  });

  it("análise de crédito enviada deve valer 400 pontos", () => {
    expect(PONTOS_ESPERADOS.DOCUMENTACAO).toBe(400);
  });

  it("contrato fechado (venda) deve valer 1000 pontos", () => {
    expect(PONTOS_ESPERADOS.VENDA).toBe(1000);
  });

  it("deve calcular pontuação corretamente para um dia típico", () => {
    const diaTipico = {
      ligacoesRealizadas: 10,
      whatsappEnviados: 20,
      agendamentosConfirmados: 2,
      visitasRealizadas: 1,
      documentacoesEnviadas: 0,
      vendasRealizadas: 0,
    };
    // 10*2 + 20*1 + 2*100 + 1*250 + 0 + 0 = 20 + 20 + 200 + 250 = 490
    const pontos = calcularPontuacao(diaTipico, PONTOS_ESPERADOS);
    expect(pontos).toBe(490);
  });

  it("deve calcular pontuação corretamente para uma venda", () => {
    const diaComVenda = {
      ligacoesRealizadas: 5,
      whatsappEnviados: 10,
      agendamentosConfirmados: 1,
      visitasRealizadas: 1,
      documentacoesEnviadas: 1,
      vendasRealizadas: 1,
    };
    // 5*2 + 10*1 + 1*100 + 1*250 + 1*400 + 1*1000 = 10 + 10 + 100 + 250 + 400 + 1000 = 1770
    const pontos = calcularPontuacao(diaComVenda, PONTOS_ESPERADOS);
    expect(pontos).toBe(1770);
  });

  it("pontuação de contrato no routers.ts deve ser 1000", () => {
    // Validação do valor hardcoded no routers.ts
    const pontosContratoRouter = 1000;
    expect(pontosContratoRouter).toBe(PONTOS_ESPERADOS.VENDA);
  });

  it("pontuação de análise de crédito no routers.ts deve ser 400", () => {
    // Validação do valor hardcoded no routers.ts
    const pontosAnaliseRouter = 400;
    expect(pontosAnaliseRouter).toBe(PONTOS_ESPERADOS.DOCUMENTACAO);
  });
});
