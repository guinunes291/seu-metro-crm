import { describe, it, expect } from 'vitest';
import { getDb } from './db';
import { getComissoes, marcarComissaoComoPaga, aplicarDescontoComissao, getComissoesImobiliaria, atualizarStatusRecebimentoImobiliaria, gerarComissoesEmLote } from './db-comissoes';

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

  it('deve listar comissões da imobiliária com campos corretos', async () => {
    const comissoesImob = await getComissoesImobiliaria();
    
    expect(Array.isArray(comissoesImob)).toBe(true);
    
    if (comissoesImob.length > 0) {
      const item = comissoesImob[0];
      expect(item).toHaveProperty('contratoId');
      expect(item).toHaveProperty('clienteNome');
      expect(item).toHaveProperty('valorVenda');
      expect(item).toHaveProperty('percentualImobiliaria');
      expect(item).toHaveProperty('valorComissao');
      expect(item).toHaveProperty('statusRecebimento');
      expect(['pendente', 'recebido', 'em_disputa']).toContain(item.statusRecebimento);
      // Verificar que o cálculo da comissão está correto
      const valorEsperado = (item.valorVenda * item.percentualImobiliaria) / 100;
      expect(item.valorComissao).toBeCloseTo(valorEsperado, 2);
    }
  });

  it('deve atualizar status de recebimento da imobiliária', async () => {
    const comissoesImob = await getComissoesImobiliaria();
    
    if (comissoesImob.length > 0) {
      const item = comissoesImob[0];
      
      // Atualizar para 'recebido'
      const resultado = await atualizarStatusRecebimentoImobiliaria(item.contratoId, 'recebido');
      expect(resultado.success).toBe(true);
      
      // Verificar que foi salvo
      const comissoesAtualizadas = await getComissoesImobiliaria();
      const itemAtualizado = comissoesAtualizadas.find(c => c.contratoId === item.contratoId);
      expect(itemAtualizado?.statusRecebimento).toBe('recebido');
      
      // Reverter para 'pendente'
      await atualizarStatusRecebimentoImobiliaria(item.contratoId, 'pendente');
    }
  });

  it('deve retornar resultado correto ao gerar comissões em lote', async () => {
    const resultado = await gerarComissoesEmLote();
    
    expect(resultado).toHaveProperty('gerados');
    expect(typeof resultado.gerados).toBe('number');
    expect(resultado.gerados).toBeGreaterThanOrEqual(0);
    
    // Se não gerou nada, deve ter mensagem informativa
    if (resultado.gerados === 0) {
      expect(resultado).toHaveProperty('mensagem');
    }
  }, 30000);
});

describe('Sistema de Distratos', () => {
  it('deve retornar lista de distratos (pode estar vazia)', async () => {
    const { getDistratos } = await import('./db');
    const distratos = await getDistratos();
    
    expect(Array.isArray(distratos)).toBe(true);
    
    if (distratos.length > 0) {
      const d = distratos[0];
      expect(d).toHaveProperty('id');
      expect(d).toHaveProperty('cliente');
      expect(d).toHaveProperty('corretor');
      expect(d).toHaveProperty('projeto');
      expect(d).toHaveProperty('vgv');
      expect(d).toHaveProperty('dataVenda');
      expect(d).toHaveProperty('dataDistrato');
      expect(d).toHaveProperty('motivoDistrato');
    }
  });

  it('deve retornar métricas de distratos com estrutura correta', async () => {
    const { getMetricasDistratos } = await import('./db');
    const metricas = await getMetricasDistratos();
    
    expect(metricas).toHaveProperty('totalDistratos');
    expect(metricas).toHaveProperty('vgvDistratado');
    expect(typeof metricas.totalDistratos).toBe('number');
    expect(typeof metricas.vgvDistratado).toBe('number');
    expect(metricas.totalDistratos).toBeGreaterThanOrEqual(0);
    expect(metricas.vgvDistratado).toBeGreaterThanOrEqual(0);
  });

  it('deve registrar e desfazer distrato em um contrato', async () => {
    const { registrarDistrato, desfazerDistrato, getDistratos } = await import('./db');
    const { getComissoesImobiliaria } = await import('./db-comissoes');
    
    // Buscar um contrato ativo (não distratado)
    const comissoesImob = await getComissoesImobiliaria();
    
    if (comissoesImob.length === 0) {
      // Sem contratos para testar — pular
      console.log('Nenhum contrato disponível para teste de distrato');
      return;
    }
    
    const contratoId = comissoesImob[0].contratoId;
    const adminId = 1; // ID fictício para teste
    
    // Registrar distrato
    const resultado = await registrarDistrato(contratoId, {
      motivoDistrato: 'Teste automatizado - cliente desistiu',
      distratadoPorId: adminId,
    });
    
    expect(resultado.success).toBe(true);
    expect(resultado.contratoId).toBe(contratoId);
    
    // Verificar que aparece na lista de distratos
    const distratosApos = await getDistratos();
    const distrato = distratosApos.find(d => d.id === contratoId);
    expect(distrato).toBeDefined();
    expect(distrato?.motivoDistrato).toBe('Teste automatizado - cliente desistiu');
    
    // Desfazer distrato
    const resultadoDesfazer = await desfazerDistrato(contratoId);
    expect(resultadoDesfazer.success).toBe(true);
    
    // Verificar que foi removido da lista de distratos
    const distratosDepois = await getDistratos();
    const distratoCancelado = distratosDepois.find(d => d.id === contratoId);
    expect(distratoCancelado).toBeUndefined();
  }, 30000);

  it('deve rejeitar distrato duplicado', async () => {
    const { registrarDistrato, desfazerDistrato } = await import('./db');
    const { getComissoesImobiliaria } = await import('./db-comissoes');
    
    const comissoesImob = await getComissoesImobiliaria();
    if (comissoesImob.length === 0) return;
    
    const contratoId = comissoesImob[0].contratoId;
    
    // Registrar distrato
    await registrarDistrato(contratoId, {
      motivoDistrato: 'Teste duplicado',
      distratadoPorId: 1,
    });
    
    // Tentar registrar novamente — deve lançar erro
    await expect(
      registrarDistrato(contratoId, { motivoDistrato: 'Duplicado', distratadoPorId: 1 })
    ).rejects.toThrow('já foi distratado');
    
    // Limpar
    await desfazerDistrato(contratoId);
  }, 30000);
});
