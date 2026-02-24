import { describe, it, expect } from 'vitest';

/**
 * Testes para o sistema de escolha diária de follow-up.
 * Valida a lógica de decisão do corretor sobre follow-ups do dia.
 */

// Simular a lógica de decisão do getProgresso
function calcularEstadoBloqueio(params: {
  totalFollowUps: number;
  concluidos: number;
  escolhaHoje: { aceitouFollowUp: boolean } | null;
}) {
  const { totalFollowUps, concluidos, escolhaHoje } = params;
  const total = totalFollowUps;
  const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 100;
  
  const recusouFollowUp = escolhaHoje?.aceitouFollowUp === false;
  const desbloqueado = recusouFollowUp || total === 0 || percentual >= 100;
  const escolhaDiariaFeita = escolhaHoje !== null;
  const aceitouFollowUp = escolhaHoje?.aceitouFollowUp ?? null;
  
  return {
    total,
    concluidos,
    percentual,
    desbloqueado,
    escolhaDiariaFeita,
    aceitouFollowUp,
  };
}

// Simular a lógica de exibição do modal e overlay no DashboardLayout
function calcularExibicaoUI(params: {
  isCorretor: boolean;
  perfilIncompleto: boolean;
  total: number;
  desbloqueado: boolean;
  escolhaDiariaFeita: boolean;
  aceitouFollowUp: boolean | null;
  location: string;
}) {
  const { isCorretor, perfilIncompleto, total, desbloqueado, escolhaDiariaFeita, aceitouFollowUp, location } = params;
  
  const paginasLiberadas = ["/tarefas-do-dia", "/modo-blitz", "/configuracoes"];
  const emPaginaLiberada = paginasLiberadas.includes(location);
  
  // Modal de escolha diária: aparece quando corretor tem follow-ups e ainda não escolheu
  const mostrarModalEscolha = isCorretor && !perfilIncompleto && total > 0 && !escolhaDiariaFeita && !desbloqueado;
  
  // Overlay de bloqueio: aparece quando corretor ACEITOU follow-ups e ainda não completou
  const mostrarOverlayBloqueio = isCorretor && !desbloqueado && !perfilIncompleto && escolhaDiariaFeita && aceitouFollowUp === true && !emPaginaLiberada;
  
  return {
    mostrarModalEscolha,
    mostrarOverlayBloqueio,
  };
}

describe('Escolha Diária de Follow-up - Lógica de Backend', () => {
  
  it('deve mostrar modal quando corretor tem follow-ups e não fez escolha', () => {
    const estado = calcularEstadoBloqueio({
      totalFollowUps: 5,
      concluidos: 0,
      escolhaHoje: null, // Sem escolha
    });
    
    expect(estado.escolhaDiariaFeita).toBe(false);
    expect(estado.aceitouFollowUp).toBeNull();
    expect(estado.desbloqueado).toBe(false); // Bloqueado até fazer escolha
    expect(estado.total).toBe(5);
  });
  
  it('deve bloquear quando corretor aceita follow-ups (Sim) e não completou', () => {
    const estado = calcularEstadoBloqueio({
      totalFollowUps: 5,
      concluidos: 2,
      escolhaHoje: { aceitouFollowUp: true },
    });
    
    expect(estado.escolhaDiariaFeita).toBe(true);
    expect(estado.aceitouFollowUp).toBe(true);
    expect(estado.desbloqueado).toBe(false); // Bloqueado
    expect(estado.percentual).toBe(40);
  });
  
  it('deve desbloquear quando corretor aceita follow-ups (Sim) e completou 100%', () => {
    const estado = calcularEstadoBloqueio({
      totalFollowUps: 5,
      concluidos: 5,
      escolhaHoje: { aceitouFollowUp: true },
    });
    
    expect(estado.escolhaDiariaFeita).toBe(true);
    expect(estado.aceitouFollowUp).toBe(true);
    expect(estado.desbloqueado).toBe(true); // Desbloqueado por completar 100%
    expect(estado.percentual).toBe(100);
  });
  
  it('deve desbloquear IMEDIATAMENTE quando corretor recusa follow-ups (Não)', () => {
    const estado = calcularEstadoBloqueio({
      totalFollowUps: 10,
      concluidos: 0,
      escolhaHoje: { aceitouFollowUp: false },
    });
    
    expect(estado.escolhaDiariaFeita).toBe(true);
    expect(estado.aceitouFollowUp).toBe(false);
    expect(estado.desbloqueado).toBe(true); // Desbloqueado imediatamente!
    expect(estado.total).toBe(10); // Ainda tem follow-ups, mas sem bloqueio
  });
  
  it('deve desbloquear quando não há follow-ups (0/0)', () => {
    const estado = calcularEstadoBloqueio({
      totalFollowUps: 0,
      concluidos: 0,
      escolhaHoje: null,
    });
    
    expect(estado.desbloqueado).toBe(true);
    expect(estado.percentual).toBe(100);
  });
  
  it('deve calcular percentual corretamente', () => {
    const estado = calcularEstadoBloqueio({
      totalFollowUps: 8,
      concluidos: 6,
      escolhaHoje: { aceitouFollowUp: true },
    });
    
    expect(estado.percentual).toBe(75);
    expect(estado.desbloqueado).toBe(false);
  });
});

describe('Escolha Diária de Follow-up - Lógica de UI', () => {
  
  it('deve mostrar modal de escolha para corretor com follow-ups pendentes sem escolha', () => {
    const ui = calcularExibicaoUI({
      isCorretor: true,
      perfilIncompleto: false,
      total: 5,
      desbloqueado: false,
      escolhaDiariaFeita: false,
      aceitouFollowUp: null,
      location: "/dashboard",
    });
    
    expect(ui.mostrarModalEscolha).toBe(true);
    expect(ui.mostrarOverlayBloqueio).toBe(false); // Não mostra overlay enquanto modal está aberto
  });
  
  it('deve mostrar overlay de bloqueio quando corretor aceitou e não completou', () => {
    const ui = calcularExibicaoUI({
      isCorretor: true,
      perfilIncompleto: false,
      total: 5,
      desbloqueado: false,
      escolhaDiariaFeita: true,
      aceitouFollowUp: true,
      location: "/dashboard",
    });
    
    expect(ui.mostrarModalEscolha).toBe(false);
    expect(ui.mostrarOverlayBloqueio).toBe(true);
  });
  
  it('NÃO deve mostrar overlay quando corretor recusou follow-ups', () => {
    const ui = calcularExibicaoUI({
      isCorretor: true,
      perfilIncompleto: false,
      total: 5,
      desbloqueado: true, // Desbloqueado por recusa
      escolhaDiariaFeita: true,
      aceitouFollowUp: false,
      location: "/dashboard",
    });
    
    expect(ui.mostrarModalEscolha).toBe(false);
    expect(ui.mostrarOverlayBloqueio).toBe(false);
  });
  
  it('NÃO deve mostrar modal para gestor/admin', () => {
    const ui = calcularExibicaoUI({
      isCorretor: false,
      perfilIncompleto: false,
      total: 5,
      desbloqueado: true,
      escolhaDiariaFeita: true,
      aceitouFollowUp: null,
      location: "/dashboard",
    });
    
    expect(ui.mostrarModalEscolha).toBe(false);
    expect(ui.mostrarOverlayBloqueio).toBe(false);
  });
  
  it('NÃO deve mostrar modal quando perfil está incompleto (prioridade onboarding)', () => {
    const ui = calcularExibicaoUI({
      isCorretor: true,
      perfilIncompleto: true,
      total: 5,
      desbloqueado: false,
      escolhaDiariaFeita: false,
      aceitouFollowUp: null,
      location: "/dashboard",
    });
    
    expect(ui.mostrarModalEscolha).toBe(false);
    expect(ui.mostrarOverlayBloqueio).toBe(false);
  });
  
  it('NÃO deve mostrar overlay na página de tarefas do dia', () => {
    const ui = calcularExibicaoUI({
      isCorretor: true,
      perfilIncompleto: false,
      total: 5,
      desbloqueado: false,
      escolhaDiariaFeita: true,
      aceitouFollowUp: true,
      location: "/tarefas-do-dia",
    });
    
    expect(ui.mostrarOverlayBloqueio).toBe(false);
  });
  
  it('NÃO deve mostrar overlay na página de configurações', () => {
    const ui = calcularExibicaoUI({
      isCorretor: true,
      perfilIncompleto: false,
      total: 5,
      desbloqueado: false,
      escolhaDiariaFeita: true,
      aceitouFollowUp: true,
      location: "/configuracoes",
    });
    
    expect(ui.mostrarOverlayBloqueio).toBe(false);
  });
  
  it('NÃO deve mostrar modal quando não há follow-ups', () => {
    const ui = calcularExibicaoUI({
      isCorretor: true,
      perfilIncompleto: false,
      total: 0,
      desbloqueado: true,
      escolhaDiariaFeita: false,
      aceitouFollowUp: null,
      location: "/dashboard",
    });
    
    expect(ui.mostrarModalEscolha).toBe(false);
  });
});
