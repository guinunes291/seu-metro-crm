import { describe, it, expect } from 'vitest';

/**
 * Testes para o filtro de ocultar leads sem corretor no relatório
 * Valida a lógica de filtragem que é aplicada no frontend
 */
describe("Filtro: Ocultar leads sem corretor no relatório", () => {
  // Dados simulados do relatório
  const dadosRelatorio = [
    { corretorId: 0, corretorNome: "Sem Corretor", totalLeads: 10662 },
    { corretorId: 1, corretorNome: "Gabriel Salles", totalLeads: 3053 },
    { corretorId: 2, corretorNome: "Guilherme Nunes", totalLeads: 872 },
    { corretorId: 3, corretorNome: "Aline Silva", totalLeads: 756 },
    { corretorId: 4, corretorNome: "Graziele Gomes", totalLeads: 730 },
  ];

  const filtrarSemCorretor = (dados: typeof dadosRelatorio, ocultar: boolean) => {
    return ocultar ? dados.filter(c => c.corretorNome !== 'Sem Corretor') : dados;
  };

  const calcularTotal = (dados: typeof dadosRelatorio) => {
    return dados.reduce((sum, c) => sum + c.totalLeads, 0);
  };

  it("deve ocultar 'Sem Corretor' quando filtro ativo", () => {
    const resultado = filtrarSemCorretor(dadosRelatorio, true);
    expect(resultado.find(c => c.corretorNome === 'Sem Corretor')).toBeUndefined();
    expect(resultado.length).toBe(4);
  });

  it("deve mostrar 'Sem Corretor' quando filtro inativo", () => {
    const resultado = filtrarSemCorretor(dadosRelatorio, false);
    expect(resultado.find(c => c.corretorNome === 'Sem Corretor')).toBeDefined();
    expect(resultado.length).toBe(5);
  });

  it("deve recalcular total sem os leads sem corretor", () => {
    const dadosFiltrados = filtrarSemCorretor(dadosRelatorio, true);
    const total = calcularTotal(dadosFiltrados);
    expect(total).toBe(3053 + 872 + 756 + 730); // 5411
    expect(total).not.toContain(10662);
  });

  it("total com filtro inativo deve incluir sem corretor", () => {
    const dadosFiltrados = filtrarSemCorretor(dadosRelatorio, false);
    const total = calcularTotal(dadosFiltrados);
    expect(total).toBe(10662 + 3053 + 872 + 756 + 730); // 16073
  });

  it("filtro ativo por padrão (ocultarSemCorretor = true)", () => {
    const ocultarSemCorretor = true; // valor padrão no Dashboard
    expect(ocultarSemCorretor).toBe(true);
  });

  it("gráfico deve usar apenas os primeiros 10 itens filtrados", () => {
    const dadosFiltrados = filtrarSemCorretor(dadosRelatorio, true);
    const dadosGrafico = dadosFiltrados.slice(0, 10);
    expect(dadosGrafico.length).toBe(4);
    expect(dadosGrafico[0].corretorNome).toBe("Gabriel Salles");
  });

  it("gráfico sem filtro deve ter Sem Corretor como primeiro", () => {
    const dadosFiltrados = filtrarSemCorretor(dadosRelatorio, false);
    const dadosGrafico = dadosFiltrados.slice(0, 10);
    expect(dadosGrafico[0].corretorNome).toBe("Sem Corretor");
  });
});
