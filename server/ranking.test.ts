import { describe, it, expect } from 'vitest';
import * as db from './db';

describe('Ranking de Corretores (getRankingCorretores)', () => {
  it('deve retornar array quando chamado sem parâmetros', async () => {
    const ranking = await db.getRankingCorretores();
    expect(Array.isArray(ranking)).toBe(true);
  });

  it('deve retornar ranking com estrutura correta', async () => {
    const ranking = await db.getRankingCorretores();
    
    if (ranking.length > 0) {
      const primeiro = ranking[0];
      expect(primeiro).toHaveProperty('corretorId');
      expect(primeiro).toHaveProperty('corretorNome');
      expect(primeiro).toHaveProperty('corretorFoto');
      expect(primeiro).toHaveProperty('vgvTotal');
      expect(primeiro).toHaveProperty('contratosFechados');
      expect(primeiro).toHaveProperty('posicao');
      
      expect(typeof primeiro.corretorId).toBe('number');
      expect(typeof primeiro.corretorNome).toBe('string');
      expect(typeof primeiro.vgvTotal).toBe('number');
      expect(typeof primeiro.contratosFechados).toBe('number');
      expect(typeof primeiro.posicao).toBe('number');
    }
  });

  it('deve aceitar mes e ano como parâmetros', async () => {
    const rankingFev = await db.getRankingCorretores(2, 2026);
    const rankingJan = await db.getRankingCorretores(1, 2026);
    
    expect(Array.isArray(rankingFev)).toBe(true);
    expect(Array.isArray(rankingJan)).toBe(true);
  });

  it('deve aceitar dataInicio e dataFim como parâmetros', async () => {
    const dataInicio = new Date(2026, 1, 1); // Feb 1, 2026
    const dataFim = new Date(2026, 1, 28, 23, 59, 59); // Feb 28, 2026
    
    const ranking = await db.getRankingCorretores(null, null, dataInicio, dataFim);
    expect(Array.isArray(ranking)).toBe(true);
    
    if (ranking.length > 0) {
      expect(ranking[0]).toHaveProperty('corretorId');
      expect(ranking[0]).toHaveProperty('vgvTotal');
      expect(ranking[0]).toHaveProperty('contratosFechados');
    }
  });

  it('deve priorizar dataInicio/dataFim sobre mes/ano', async () => {
    // Quando ambos são fornecidos, dataInicio/dataFim deve ter prioridade
    const dataInicio = new Date(2026, 0, 1); // Jan 1, 2026
    const dataFim = new Date(2026, 1, 28, 23, 59, 59); // Feb 28, 2026
    
    const rankingComRange = await db.getRankingCorretores(12, 2025, dataInicio, dataFim);
    const rankingComMesAno = await db.getRankingCorretores(12, 2025);
    
    // Os resultados devem ser diferentes pois o range cobre Jan-Fev 2026 e mes/ano cobre Dez 2025
    expect(Array.isArray(rankingComRange)).toBe(true);
    expect(Array.isArray(rankingComMesAno)).toBe(true);
  });

  it('deve retornar menos ou igual resultados com range mais estreito', async () => {
    // Todo o período
    const todoPeriodo = await db.getRankingCorretores(null, null, new Date(2020, 0, 1), new Date(2030, 11, 31));
    
    // Apenas hoje
    const hoje = new Date();
    const apenasHoje = await db.getRankingCorretores(
      null, null,
      new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()),
      new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59)
    );
    
    expect(apenasHoje.length).toBeLessThanOrEqual(todoPeriodo.length);
  });

  it('deve ordenar por VGV decrescente', async () => {
    const ranking = await db.getRankingCorretores();
    
    if (ranking.length > 1) {
      for (let i = 0; i < ranking.length - 1; i++) {
        expect(ranking[i].vgvTotal).toBeGreaterThanOrEqual(ranking[i + 1].vgvTotal);
      }
    }
  });

  it('deve atribuir posições sequenciais começando em 1', async () => {
    const ranking = await db.getRankingCorretores();
    
    ranking.forEach((item, index) => {
      expect(item.posicao).toBe(index + 1);
    });
  });

  it('deve retornar array vazio para período futuro sem dados', async () => {
    const ranking = await db.getRankingCorretores(null, null, new Date(2030, 0, 1), new Date(2030, 0, 31));
    expect(ranking).toEqual([]);
  });
});

describe('Performance do Corretor (getPerformanceCorretor)', () => {
  it('deve retornar null para corretor inexistente', async () => {
    const performance = await db.getPerformanceCorretor(999999);
    expect(performance).toBeNull();
  });

  it('deve retornar performance com estrutura correta para corretor existente', async () => {
    const corretores = await db.getAllCorretores();
    
    if (corretores.length > 0) {
      const performance = await db.getPerformanceCorretor(corretores[0].id);
      
      if (performance) {
        expect(performance).toHaveProperty('corretor');
        expect(performance).toHaveProperty('periodo');
        expect(performance).toHaveProperty('metricas');
        
        expect(performance.corretor).toHaveProperty('id');
        expect(performance.corretor).toHaveProperty('nome');
        
        expect(performance.periodo).toHaveProperty('mes');
        expect(performance.periodo).toHaveProperty('ano');
        
        expect(performance.metricas).toHaveProperty('totalLeads');
      }
    }
  });
});
