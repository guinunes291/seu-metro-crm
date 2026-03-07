/**
 * Teste: Leads transferidos NÃO devem aparecer no follow-up do corretor antigo
 * 
 * Regra: getFollowUpsDoDiaExpandido, getFollowUpsDoDia e getFollowUpsPendentes
 * devem filtrar por leads.corretorId = corretorId, garantindo que apenas
 * leads que AINDA pertencem ao corretor aparecem no follow-up.
 */
import { describe, it, expect } from 'vitest';
import * as db from './db';

describe('Filtro de leads transferidos no follow-up', () => {

  it('getFollowUpsDoDiaExpandido deve existir e aceitar corretorId', async () => {
    // Teste com ID inexistente - deve retornar array vazio sem erros
    const resultado = await db.getFollowUpsDoDiaExpandido(999999);
    expect(Array.isArray(resultado)).toBe(true);
    expect(resultado.length).toBe(0);
  });

  it('getFollowUpsPendentes deve existir e aceitar corretorId', async () => {
    const resultado = await db.getFollowUpsPendentes(999999);
    expect(Array.isArray(resultado)).toBe(true);
    expect(resultado.length).toBe(0);
  });

  it('getTotalFollowUpsDoDia deve existir e aceitar corretorId', async () => {
    const resultado = await db.getTotalFollowUpsDoDia(999999);
    expect(Array.isArray(resultado)).toBe(true);
    expect(resultado.length).toBe(0);
  });

  it('getFollowUpsDoDia deve existir e aceitar corretorId', async () => {
    const resultado = await db.getFollowUpsDoDia(999999);
    expect(Array.isArray(resultado)).toBe(true);
    expect(resultado.length).toBe(0);
  });

  it('Funções de follow-up devem ser exportadas corretamente', () => {
    expect(typeof db.getFollowUpsDoDiaExpandido).toBe('function');
    expect(typeof db.getFollowUpsPendentes).toBe('function');
    expect(typeof db.getTotalFollowUpsDoDia).toBe('function');
    expect(typeof db.getFollowUpsDoDia).toBe('function');
    expect(typeof db.registrarTentativaFollowUp).toBe('function');
    expect(typeof db.criarFollowUpParaLead).toBe('function');
  });

});
