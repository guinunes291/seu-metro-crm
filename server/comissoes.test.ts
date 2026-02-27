import { describe, it, expect } from 'vitest';
import { getDb } from './db';
import { getComissoes, marcarComissaoComoPaga, aplicarDescontoComissao } from './db-comissoes';

describe('Sistema de Comissões', () => {
  it('deve listar comissões', async () => {
    const comissoes = await getComissoes({});
    
    expect(Array.isArray(comissoes)).toBe(true);
    
    // Se houver comissões, verificar estrutura
    if (comissoes.length > 0) {
      const comissao = comissoes[0];
      expect(comissao).toHaveProperty('id');
      expect(comissao).toHaveProperty('contratoId');
      expect(comissao).toHaveProperty('usuarioId');
      expect(comissao).toHaveProperty('tipo');
      expect(comissao).toHaveProperty('valorBase');
      expect(comissao).toHaveProperty('percentual');
      expect(comissao).toHaveProperty('valorComissao');
      expect(comissao).toHaveProperty('valorLiquido');
      expect(comissao).toHaveProperty('status');
      expect(['corretor', 'gerente', 'superintendente']).toContain(comissao.tipo);
      expect(['pendente_assinatura', 'a_pagar', 'paga']).toContain(comissao.status);
    }
  });

  it('deve filtrar comissões por status', async () => {
    const comissoesPendentes = await getComissoes({ status: 'pendente_assinatura' });
    const comissoesPagas = await getComissoes({ status: 'paga' });

    expect(Array.isArray(comissoesPendentes)).toBe(true);
    expect(Array.isArray(comissoesPagas)).toBe(true);
    
    if (comissoesPendentes.length > 0) {
      expect(comissoesPendentes.every(c => c.status === 'pendente_assinatura')).toBe(true);
    }
    
    if (comissoesPagas.length > 0) {
      expect(comissoesPagas.every(c => c.status === 'paga')).toBe(true);
    }
  });

  it('deve filtrar comissões por tipo', async () => {
    const comissoesCorretor = await getComissoes({ tipo: 'corretor' });
    const comissoesGerente = await getComissoes({ tipo: 'gerente' });

    expect(Array.isArray(comissoesCorretor)).toBe(true);
    expect(Array.isArray(comissoesGerente)).toBe(true);
    
    if (comissoesCorretor.length > 0) {
      expect(comissoesCorretor.every(c => c.tipo === 'corretor')).toBe(true);
    }
    
    if (comissoesGerente.length > 0) {
      expect(comissoesGerente.every(c => c.tipo === 'gerente')).toBe(true);
    }
  });

  it('deve aplicar desconto de NF corretamente', async () => {
    const comissoes = await getComissoes({ status: 'pendente_assinatura' });
    
    if (comissoes.length > 0) {
      const comissao = comissoes[0];
      const valorOriginal = Number(comissao.valorComissao);
      const percentualDesconto = 6;

      const resultado = await aplicarDescontoComissao(comissao.id, percentualDesconto);

      const valorEsperado = valorOriginal * (1 - percentualDesconto / 100);
      expect(resultado.valorLiquido).toBeCloseTo(valorEsperado, 2);

      // Verificar no banco
      const comissoesAtualizadas = await getComissoes({});
      const comissaoAtualizada = comissoesAtualizadas.find(c => c.id === comissao.id);
      
      expect(Number(comissaoAtualizada?.percentualDesconto)).toBe(percentualDesconto);
      expect(Number(comissaoAtualizada?.valorLiquido)).toBeCloseTo(valorEsperado, 2);
    }
  });

  it('deve calcular percentuais corretos', async () => {
    const comissoes = await getComissoes({});
    
    if (comissoes.length > 0) {
      for (const comissao of comissoes) {
        const valorBase = Number(comissao.valorBase);
        const percentual = Number(comissao.percentual);
        const valorComissao = Number(comissao.valorComissao);
        
        // Verificar se o cálculo está correto
        const valorEsperado = valorBase * (percentual / 100);
        expect(valorComissao).toBeCloseTo(valorEsperado, 2);
      }
    }
  });
});
