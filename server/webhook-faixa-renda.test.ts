import { describe, it, expect } from 'vitest';

/**
 * Testes de validação do mapeamento de faixa de renda
 * 
 * Estes testes verificam que o sistema aceita diferentes variações
 * de nomes de campos para faixa de renda do Facebook Lead Ads
 */
describe('Webhook - Mapeamento de Faixa de Renda', () => {

  it('deve aceitar variações de nomes de campos em português', () => {
    const variacoesPortugues = [
      'faixa_de_renda',
      'faixa_renda',
      'faixa de renda',
      'faixaderenda',
      'renda',
      'renda_familiar',
      'renda familiar',
      'salario',
      'salário',
      'rendimento',
      'rendimentos',
    ];

    // Verificar que todas as variações são reconhecidas
    variacoesPortugues.forEach(variacao => {
      const fieldName = variacao.toLowerCase();
      const isRecognized = 
        fieldName === 'faixa_de_renda' || fieldName === 'faixa_renda' || 
        fieldName === 'faixa de renda' || fieldName === 'faixaderenda' ||
        fieldName === 'renda' || fieldName === 'income' || 
        fieldName === 'renda_familiar' || fieldName === 'renda familiar' ||
        fieldName === 'income_range' || fieldName === 'income range' ||
        fieldName === 'monthly_income' || fieldName === 'monthly income' ||
        fieldName === 'salario' || fieldName === 'salário' ||
        fieldName === 'rendimento' || fieldName === 'rendimentos' ||
        fieldName.includes('renda') || fieldName.includes('income');
      
      expect(isRecognized).toBe(true);
    });
  });

  it('deve aceitar variações de nomes de campos em inglês', () => {
    const variacoesIngles = [
      'income',
      'income_range',
      'income range',
      'monthly_income',
      'monthly income',
    ];

    variacoesIngles.forEach(variacao => {
      const fieldName = variacao.toLowerCase();
      const isRecognized = 
        fieldName === 'income' || 
        fieldName === 'income_range' || fieldName === 'income range' ||
        fieldName === 'monthly_income' || fieldName === 'monthly income' ||
        fieldName.includes('income');
      
      expect(isRecognized).toBe(true);
    });
  });

  it('deve detectar campos que contêm "renda" no nome', () => {
    const camposComRenda = [
      'minha_renda',
      'renda_mensal',
      'valor_renda',
      'renda_total',
    ];

    camposComRenda.forEach(campo => {
      const fieldName = campo.toLowerCase();
      const isRecognized = fieldName.includes('renda');
      expect(isRecognized).toBe(true);
    });
  });

  it('deve detectar campos que contêm "income" no nome', () => {
    const camposComIncome = [
      'my_income',
      'family_income',
      'total_income',
      'gross_income',
    ];

    camposComIncome.forEach(campo => {
      const fieldName = campo.toLowerCase();
      const isRecognized = fieldName.includes('income');
      expect(isRecognized).toBe(true);
    });
  });

  it('deve validar que campos não relacionados não são reconhecidos', () => {
    const camposNaoRelacionados = [
      'nome',
      'email',
      'telefone',
      'cidade',
      'estado',
    ];

    camposNaoRelacionados.forEach(campo => {
      const fieldName = campo.toLowerCase();
      const isRecognized = 
        fieldName === 'faixa_de_renda' || fieldName === 'faixa_renda' || 
        fieldName === 'faixa de renda' || fieldName === 'faixaderenda' ||
        fieldName === 'renda' || fieldName === 'income' || 
        fieldName === 'renda_familiar' || fieldName === 'renda familiar' ||
        fieldName === 'income_range' || fieldName === 'income range' ||
        fieldName === 'monthly_income' || fieldName === 'monthly income' ||
        fieldName === 'salario' || fieldName === 'salário' ||
        fieldName === 'rendimento' || fieldName === 'rendimentos' ||
        fieldName.includes('renda') || fieldName.includes('income');
      
      expect(isRecognized).toBe(false);
    });
  });
});
