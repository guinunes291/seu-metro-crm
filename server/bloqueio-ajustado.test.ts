import { describe, it, expect } from 'vitest';

describe('Lógica de Bloqueio Ajustada', () => {
  it('deve bloquear quando total > 0 e concluidos = 0 (0%)', () => {
    const total = 80;
    const concluidos = 0;
    const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 100;
    const desbloqueado = total === 0 ? true : percentual >= 60;
    
    expect(percentual).toBe(0);
    expect(desbloqueado).toBe(false); // BLOQUEADO
  });

  it('deve bloquear quando percentual < 60%', () => {
    const total = 80;
    const concluidos = 47; // 58.75%
    const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 100;
    const desbloqueado = total === 0 ? true : percentual >= 60;
    
    expect(percentual).toBe(59);
    expect(desbloqueado).toBe(false); // BLOQUEADO
  });

  it('deve desbloquear quando percentual >= 60%', () => {
    const total = 80;
    const concluidos = 48; // 60%
    const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 100;
    const desbloqueado = total === 0 ? true : percentual >= 60;
    
    expect(percentual).toBe(60);
    expect(desbloqueado).toBe(true); // DESBLOQUEADO
  });

  it('deve desbloquear quando total = 0 (sem follow-ups)', () => {
    const total = 0;
    const concluidos = 0;
    const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 100;
    const desbloqueado = total === 0 ? true : percentual >= 60;
    
    expect(percentual).toBe(100);
    expect(desbloqueado).toBe(true); // DESBLOQUEADO (sem follow-ups)
  });

  it('deve desbloquear quando concluiu todos (100%)', () => {
    const total = 80;
    const concluidos = 80;
    const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 100;
    const desbloqueado = total === 0 ? true : percentual >= 60;
    
    expect(percentual).toBe(100);
    expect(desbloqueado).toBe(true); // DESBLOQUEADO
  });
});
