import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as db from './db';

describe('Ranking de Corretores', () => {
  describe('getRankingCorretores', () => {
    it('deve retornar array vazio ou lista de corretores', async () => {
      const ranking = await db.getRankingCorretores();
      expect(Array.isArray(ranking)).toBe(true);
    });

    it('deve retornar ranking com estrutura correta', async () => {
      const ranking = await db.getRankingCorretores(12, 2025);
      expect(Array.isArray(ranking)).toBe(true);
      
      if (ranking.length > 0) {
        const primeiro = ranking[0];
        expect(primeiro).toHaveProperty('corretor');
        expect(primeiro).toHaveProperty('metricas');
        expect(primeiro).toHaveProperty('pontuacao');
        expect(primeiro).toHaveProperty('posicao');
        
        expect(primeiro.corretor).toHaveProperty('id');
        expect(primeiro.corretor).toHaveProperty('nome');
        expect(primeiro.corretor).toHaveProperty('fotoUrl');
        
        expect(primeiro.metricas).toHaveProperty('totalLeads');
        expect(primeiro.metricas).toHaveProperty('agendamentos');
        expect(primeiro.metricas).toHaveProperty('visitas');
        expect(primeiro.metricas).toHaveProperty('contratos');
        expect(primeiro.metricas).toHaveProperty('vgv');
      }
    });

    it('deve ordenar por pontuação decrescente', async () => {
      const ranking = await db.getRankingCorretores(12, 2025);
      
      if (ranking.length > 1) {
        for (let i = 0; i < ranking.length - 1; i++) {
          expect(ranking[i].pontuacao).toBeGreaterThanOrEqual(ranking[i + 1].pontuacao);
        }
      }
    });

    it('deve atribuir posições sequenciais', async () => {
      const ranking = await db.getRankingCorretores(12, 2025);
      
      ranking.forEach((item, index) => {
        expect(item.posicao).toBe(index + 1);
      });
    });

    it('deve aceitar mês e ano como parâmetros', async () => {
      const rankingDezembro = await db.getRankingCorretores(12, 2025);
      const rankingJaneiro = await db.getRankingCorretores(1, 2025);
      
      expect(Array.isArray(rankingDezembro)).toBe(true);
      expect(Array.isArray(rankingJaneiro)).toBe(true);
    });
  });

  describe('getPerformanceCorretor', () => {
    it('deve retornar null para corretor inexistente', async () => {
      const performance = await db.getPerformanceCorretor(999999);
      expect(performance).toBeNull();
    });

    it('deve retornar performance com estrutura correta para corretor existente', async () => {
      // Buscar um corretor existente
      const corretores = await db.getAllCorretores();
      
      if (corretores.length > 0) {
        const performance = await db.getPerformanceCorretor(corretores[0].id);
        
        if (performance) {
          expect(performance).toHaveProperty('corretor');
          expect(performance).toHaveProperty('periodo');
          expect(performance).toHaveProperty('metricas');
          
          expect(performance.corretor).toHaveProperty('id');
          expect(performance.corretor).toHaveProperty('nome');
          expect(performance.corretor).toHaveProperty('fotoUrl');
          
          expect(performance.periodo).toHaveProperty('mes');
          expect(performance.periodo).toHaveProperty('ano');
          
          expect(performance.metricas).toHaveProperty('totalLeads');
          expect(performance.metricas).toHaveProperty('agendamentos');
          expect(performance.metricas).toHaveProperty('visitas');
          expect(performance.metricas).toHaveProperty('contratos');
          expect(performance.metricas).toHaveProperty('vgv');
          expect(performance.metricas).toHaveProperty('taxaConversao');
        }
      }
    });

    it('deve aceitar mês e ano como parâmetros', async () => {
      const corretores = await db.getAllCorretores();
      
      if (corretores.length > 0) {
        const performanceDezembro = await db.getPerformanceCorretor(corretores[0].id, 12, 2025);
        const performanceJaneiro = await db.getPerformanceCorretor(corretores[0].id, 1, 2025);
        
        if (performanceDezembro) {
          expect(performanceDezembro.periodo.mes).toBe(12);
          expect(performanceDezembro.periodo.ano).toBe(2025);
        }
        
        if (performanceJaneiro) {
          expect(performanceJaneiro.periodo.mes).toBe(1);
          expect(performanceJaneiro.periodo.ano).toBe(2025);
        }
      }
    });
  });

  describe('updateCorretorFoto', () => {
    it('deve atualizar foto do corretor', async () => {
      const corretores = await db.getAllCorretores();
      
      if (corretores.length > 0) {
        const corretor = corretores[0];
        const novaFotoUrl = `https://exemplo.com/foto-teste-${Date.now()}.jpg`;
        
        await db.updateCorretorFoto(corretor.id, novaFotoUrl);
        
        const corretorAtualizado = await db.getUserById(corretor.id);
        expect(corretorAtualizado?.fotoUrl).toBe(novaFotoUrl);
      }
    });
  });
});

describe('Cálculo de Pontuação', () => {
  it('deve calcular pontuação baseada nas métricas', async () => {
    const ranking = await db.getRankingCorretores(12, 2025);
    
    ranking.forEach((item) => {
      // Fórmula: (leads * 1) + (agendamentos * 5) + (visitas * 10) + (contratos * 50) + (vgv / 10000)
      const pontuacaoEsperada = Math.round(
        (item.metricas.totalLeads * 1) +
        (item.metricas.agendamentos * 5) +
        (item.metricas.visitas * 10) +
        (item.metricas.contratos * 50) +
        (item.metricas.vgv / 10000)
      );
      
      expect(item.pontuacao).toBe(pontuacaoEsperada);
    });
  });
});
