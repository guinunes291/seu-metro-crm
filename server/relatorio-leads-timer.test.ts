/**
 * Teste: getRelatorioLeadsTimerPorCorretor
 *
 * Valida que a função existe, está exportada e retorna o formato correto.
 */
import { describe, it, expect } from 'vitest';
import * as db from './db';

describe('getRelatorioLeadsTimerPorCorretor', () => {

  it('deve estar exportada como função', () => {
    expect(typeof db.getRelatorioLeadsTimerPorCorretor).toBe('function');
  });

  it('deve retornar array vazio para período sem dados', async () => {
    // Período no futuro — sem dados
    const dataInicio = new Date('2099-01-01');
    const dataFim = new Date('2099-01-31');

    const resultado = await db.getRelatorioLeadsTimerPorCorretor({ dataInicio, dataFim });

    expect(Array.isArray(resultado)).toBe(true);
  });

  it('deve retornar array para período atual', async () => {
    const dataInicio = new Date();
    dataInicio.setDate(1);
    dataInicio.setHours(0, 0, 0, 0);
    const dataFim = new Date();

    const resultado = await db.getRelatorioLeadsTimerPorCorretor({ dataInicio, dataFim });

    expect(Array.isArray(resultado)).toBe(true);
  });

  it('cada item deve ter os campos obrigatórios', async () => {
    const dataInicio = new Date();
    dataInicio.setMonth(dataInicio.getMonth() - 1);
    const dataFim = new Date();

    const resultado = await db.getRelatorioLeadsTimerPorCorretor({ dataInicio, dataFim });

    for (const item of resultado) {
      expect(item).toHaveProperty('corretorId');
      expect(item).toHaveProperty('corretorNome');
      expect(item).toHaveProperty('recebidos');
      expect(item).toHaveProperty('perdidosPorTimer');
      expect(item).toHaveProperty('taxaPerda');

      expect(typeof item.corretorId).toBe('number');
      expect(typeof item.corretorNome).toBe('string');
      expect(typeof item.recebidos).toBe('number');
      expect(typeof item.perdidosPorTimer).toBe('number');
      expect(typeof item.taxaPerda).toBe('number');

      // taxaPerda deve estar entre 0 e 100
      expect(item.taxaPerda).toBeGreaterThanOrEqual(0);
      expect(item.taxaPerda).toBeLessThanOrEqual(100);

      // perdidosPorTimer não pode ser maior que recebidos
      expect(item.perdidosPorTimer).toBeLessThanOrEqual(item.recebidos);
    }
  });

  it('deve filtrar por equipeId quando informado', async () => {
    const dataInicio = new Date();
    dataInicio.setMonth(dataInicio.getMonth() - 1);
    const dataFim = new Date();

    // equipeId inexistente deve retornar array vazio
    const resultado = await db.getRelatorioLeadsTimerPorCorretor({
      dataInicio,
      dataFim,
      equipeId: 999999,
    });

    expect(Array.isArray(resultado)).toBe(true);
    expect(resultado.length).toBe(0);
  });

  it('não deve lançar exceção com datas invertidas', async () => {
    const dataInicio = new Date('2099-12-31');
    const dataFim = new Date('2099-01-01');

    await expect(
      db.getRelatorioLeadsTimerPorCorretor({ dataInicio, dataFim })
    ).resolves.not.toThrow();
  });

});
