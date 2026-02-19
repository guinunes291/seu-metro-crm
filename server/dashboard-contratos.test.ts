import { describe, it, expect } from 'vitest';
import * as db from './db';

describe('Tabela de Contratos Fechados (getContratosFechados)', () => {
  it('deve retornar array quando chamado sem filtros', async () => {
    const contratos = await db.getContratosFechados();
    expect(Array.isArray(contratos)).toBe(true);
  });

  it('deve retornar contratos com estrutura correta', async () => {
    const contratos = await db.getContratosFechados();
    
    if (contratos.length > 0) {
      const primeiro = contratos[0];
      expect(primeiro).toHaveProperty('id');
      expect(primeiro).toHaveProperty('corretor');
      expect(primeiro).toHaveProperty('cliente');
      expect(primeiro).toHaveProperty('projeto');
      expect(primeiro).toHaveProperty('vgv');
      expect(primeiro).toHaveProperty('dataVenda');
      expect(primeiro).toHaveProperty('corretorFoto');
      expect(primeiro).toHaveProperty('clienteTelefone');
      expect(primeiro).toHaveProperty('clienteEmail');
      
      expect(typeof primeiro.id).toBe('number');
      expect(typeof primeiro.corretor).toBe('string');
      expect(typeof primeiro.cliente).toBe('string');
      expect(typeof primeiro.projeto).toBe('string');
      expect(typeof primeiro.vgv).toBe('number');
    }
  });

  it('deve retornar contratos ordenados por data decrescente', async () => {
    const contratos = await db.getContratosFechados();
    
    if (contratos.length > 1) {
      for (let i = 0; i < contratos.length - 1; i++) {
        const dataAtual = new Date(contratos[i].dataVenda).getTime();
        const dataProximo = new Date(contratos[i + 1].dataVenda).getTime();
        expect(dataAtual).toBeGreaterThanOrEqual(dataProximo);
      }
    }
  });

  it('deve aceitar filtros de data', async () => {
    const dataInicio = new Date(2026, 0, 1); // Jan 1, 2026
    const dataFim = new Date(2026, 0, 31, 23, 59, 59); // Jan 31, 2026
    
    const contratosJan = await db.getContratosFechados({
      dataInicio,
      dataFim,
    });
    
    expect(Array.isArray(contratosJan)).toBe(true);
    
    // Todos os contratos devem estar dentro do período
    for (const contrato of contratosJan) {
      const dataVenda = new Date(contrato.dataVenda).getTime();
      expect(dataVenda).toBeGreaterThanOrEqual(dataInicio.getTime());
      expect(dataVenda).toBeLessThanOrEqual(dataFim.getTime());
    }
  });

  it('deve retornar menos ou igual resultados com range mais estreito', async () => {
    // Todo o período
    const todos = await db.getContratosFechados();
    
    // Apenas janeiro 2026
    const jan = await db.getContratosFechados({
      dataInicio: new Date(2026, 0, 1),
      dataFim: new Date(2026, 0, 31, 23, 59, 59),
    });
    
    expect(jan.length).toBeLessThanOrEqual(todos.length);
  });

  it('deve retornar array vazio para período futuro sem dados', async () => {
    const contratos = await db.getContratosFechados({
      dataInicio: new Date(2030, 0, 1),
      dataFim: new Date(2030, 0, 31),
    });
    expect(contratos).toEqual([]);
  });

  it('deve ter VGV sempre >= 0', async () => {
    const contratos = await db.getContratosFechados();
    
    for (const contrato of contratos) {
      expect(contrato.vgv).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('VGV por Equipe (getVGVPorEquipeProjeto)', () => {
  it('deve retornar array quando chamado sem filtros', async () => {
    const resultado = await db.getVGVPorEquipeProjeto();
    expect(Array.isArray(resultado)).toBe(true);
  });

  it('deve retornar itens com estrutura correta', async () => {
    const resultado = await db.getVGVPorEquipeProjeto();
    
    if (resultado.length > 0) {
      const primeiro = resultado[0];
      expect(primeiro).toHaveProperty('equipe');
      expect(primeiro).toHaveProperty('vgv');
      expect(primeiro).toHaveProperty('contratos');
      
      expect(typeof primeiro.equipe).toBe('string');
      expect(typeof primeiro.vgv).toBe('number');
      expect(typeof primeiro.contratos).toBe('number');
      // Não deve ter campo 'projeto' (agrupamento apenas por equipe)
      expect(primeiro).not.toHaveProperty('projeto');
    }
  });

  it('deve retornar resultados ordenados por VGV decrescente', async () => {
    const resultado = await db.getVGVPorEquipeProjeto();
    
    if (resultado.length > 1) {
      for (let i = 0; i < resultado.length - 1; i++) {
        expect(resultado[i].vgv).toBeGreaterThanOrEqual(resultado[i + 1].vgv);
      }
    }
  });

  it('deve aceitar filtros de data', async () => {
    const resultado = await db.getVGVPorEquipeProjeto({
      dataInicio: new Date(2026, 0, 1),
      dataFim: new Date(2026, 0, 31, 23, 59, 59),
    });
    
    expect(Array.isArray(resultado)).toBe(true);
  });

  it('deve ter VGV e contratos sempre > 0', async () => {
    const resultado = await db.getVGVPorEquipeProjeto();
    
    for (const item of resultado) {
      expect(item.vgv).toBeGreaterThan(0);
      expect(item.contratos).toBeGreaterThan(0);
    }
  });

  it('VGV total deve ser consistente com contratos fechados', async () => {
    const contratosLista = await db.getContratosFechados();
    const porEquipe = await db.getVGVPorEquipeProjeto();
    
    const vgvContratos = contratosLista.reduce((sum, c) => sum + c.vgv, 0);
    const vgvEquipes = porEquipe.reduce((sum, e) => sum + e.vgv, 0);
    
    // Os totais devem ser iguais (mesmos dados, apenas agrupados diferente)
    expect(Math.round(vgvEquipes)).toBe(Math.round(vgvContratos));
  });

  it('total de contratos deve ser consistente', async () => {
    const contratosLista = await db.getContratosFechados();
    const porEquipe = await db.getVGVPorEquipeProjeto();
    
    const totalContratosEquipes = porEquipe.reduce((sum, e) => sum + e.contratos, 0);
    
    expect(totalContratosEquipes).toBe(contratosLista.length);
  });

  it('deve retornar array vazio para período futuro sem dados', async () => {
    const resultado = await db.getVGVPorEquipeProjeto({
      dataInicio: new Date(2030, 0, 1),
      dataFim: new Date(2030, 0, 31),
    });
    expect(resultado).toEqual([]);
  });
});
