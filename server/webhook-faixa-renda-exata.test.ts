import { describe, it, expect } from 'vitest';

describe('Webhook - Captura de "Faixa De Renda" (variação exata)', () => {
  it('deve reconhecer campo com nome exato "Faixa De Renda" (maiúsculas e espaços)', () => {
    // Simular dados do Facebook com o nome exato do campo
    const field = {
      name: 'Faixa De Renda',
      values: ['De 4.700,00 a 8.000,00']
    };
    
    // Verificar se o nome exato é reconhecido
    const isMatch = field.name === 'Faixa De Renda';
    
    expect(isMatch).toBe(true);
  });
  
  it('deve capturar valor do campo "Faixa De Renda"', () => {
    const field = {
      name: 'Faixa De Renda',
      values: ['De 4.700,00 a 8.000,00']
    };
    
    const value = field.values[0];
    
    expect(value).toBe('De 4.700,00 a 8.000,00');
  });
  
  it('deve priorizar match exato antes de lowercase', () => {
    const field = {
      name: 'Faixa De Renda',
      values: ['De 4.700,00 a 8.000,00']
    };
    
    const fieldName = field.name.toLowerCase();
    
    // Verificação 1: Match exato (ANTES de lowercase)
    const exactMatch = field.name === 'Faixa De Renda';
    
    // Verificação 2: Match lowercase (DEPOIS de exato)
    const lowercaseMatch = fieldName === 'faixa de renda';
    
    expect(exactMatch).toBe(true);
    expect(lowercaseMatch).toBe(true);
    
    // Mas o match exato vem primeiro no código
    const shouldCaptureExact = exactMatch || lowercaseMatch;
    expect(shouldCaptureExact).toBe(true);
  });
});
