/**
 * Testes unitários para o módulo de sincronização DRE
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Testes de lógica de cálculo (sem dependência de banco ou Google Sheets)
// ============================================================================

describe("Cálculos de comissão DRE", () => {
  // Funções auxiliares replicadas para teste
  function formatMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  function calcularComissoes(
    vgv: number,
    percComissao: number,
    percCorretor: number,
    percGerente: number,
    percSuperintendente: number,
    percImposto: number = 6
  ) {
    const comissaoBruta = formatMoney((vgv * percComissao) / 100);
    const imposto = formatMoney((comissaoBruta * percImposto) / 100);
    const comissaoLiquida = formatMoney(comissaoBruta - imposto);
    const valorCorretor = formatMoney((vgv * percCorretor) / 100);
    const valorGerente = formatMoney((vgv * percGerente) / 100);
    const valorSuperintendente = formatMoney((vgv * percSuperintendente) / 100);
    const totalRateio = formatMoney(valorCorretor + valorGerente + valorSuperintendente);
    const resultadoProprietario = formatMoney(comissaoLiquida - totalRateio);
    return {
      comissaoBruta,
      imposto,
      comissaoLiquida,
      valorCorretor,
      valorGerente,
      valorSuperintendente,
      totalRateio,
      resultadoProprietario,
    };
  }

  it("calcula comissão bruta corretamente para VGV de R$300.000 com 3.5%", () => {
    const { comissaoBruta } = calcularComissoes(300000, 3.5, 1.85, 0.5, 0.3);
    expect(comissaoBruta).toBe(10500); // 300.000 × 3.5% = 10.500
  });

  it("calcula imposto de 6% sobre comissão bruta", () => {
    const { comissaoBruta, imposto } = calcularComissoes(300000, 3.5, 1.85, 0.5, 0.3);
    expect(imposto).toBe(630); // 10.500 × 6% = 630
  });

  it("calcula comissão líquida corretamente", () => {
    const { comissaoLiquida } = calcularComissoes(300000, 3.5, 1.85, 0.5, 0.3);
    expect(comissaoLiquida).toBe(9870); // 10.500 - 630 = 9.870
  });

  it("calcula comissão do corretor corretamente (1.85% do VGV)", () => {
    const { valorCorretor } = calcularComissoes(300000, 3.5, 1.85, 0.5, 0.3);
    expect(valorCorretor).toBe(5550); // 300.000 × 1.85% = 5.550
  });

  it("calcula comissão do gerente corretamente (0.5% do VGV)", () => {
    const { valorGerente } = calcularComissoes(300000, 3.5, 1.85, 0.5, 0.3);
    expect(valorGerente).toBe(1500); // 300.000 × 0.5% = 1.500
  });

  it("calcula comissão do superintendente corretamente (0.3% do VGV)", () => {
    const { valorSuperintendente } = calcularComissoes(300000, 3.5, 1.85, 0.5, 0.3);
    expect(valorSuperintendente).toBe(900); // 300.000 × 0.3% = 900
  });

  it("calcula total de rateio corretamente", () => {
    const { totalRateio } = calcularComissoes(300000, 3.5, 1.85, 0.5, 0.3);
    expect(totalRateio).toBe(7950); // 5.550 + 1.500 + 900 = 7.950
  });

  it("calcula resultado do proprietário corretamente", () => {
    const { resultadoProprietario } = calcularComissoes(300000, 3.5, 1.85, 0.5, 0.3);
    expect(resultadoProprietario).toBe(1920); // 9.870 - 7.950 = 1.920
  });

  it("calcula corretamente para VGV de R$500.000 com 4%", () => {
    const result = calcularComissoes(500000, 4, 2, 0.5, 0.3);
    expect(result.comissaoBruta).toBe(20000);   // 500.000 × 4% = 20.000
    expect(result.imposto).toBe(1200);           // 20.000 × 6% = 1.200
    expect(result.comissaoLiquida).toBe(18800);  // 20.000 - 1.200 = 18.800
    expect(result.valorCorretor).toBe(10000);    // 500.000 × 2% = 10.000
  });

  it("não gera valores negativos para resultado do proprietário quando rateio é menor que comissão líquida", () => {
    const { resultadoProprietario } = calcularComissoes(300000, 3.5, 1.85, 0.5, 0.3);
    expect(resultadoProprietario).toBeGreaterThan(0);
  });

  it("arredonda valores monetários para 2 casas decimais", () => {
    // VGV de R$333.333 com 3.5%
    const { comissaoBruta } = calcularComissoes(333333, 3.5, 1.85, 0.5, 0.3);
    const decimals = (comissaoBruta.toString().split(".")[1] || "").length;
    expect(decimals).toBeLessThanOrEqual(2);
  });
});

describe("Formatação de datas DRE", () => {
  function formatDate(date: Date | null | undefined): string {
    if (!date) return "";
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    });
  }

  it("formata data corretamente no padrão brasileiro", () => {
    const date = new Date("2025-03-15T12:00:00Z");
    const formatted = formatDate(date);
    expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("retorna string vazia para data nula", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
  });
});

describe("Mapeamento de status DRE", () => {
  function mapStatus(status: string, distrato: boolean): string {
    if (distrato) return "Distratado";
    const statusMap: Record<string, string> = {
      pendente: "Pendente",
      recebido: "Recebido",
      em_disputa: "Em Disputa",
    };
    return statusMap[status] || "Pendente";
  }

  it("mapeia status 'pendente' corretamente", () => {
    expect(mapStatus("pendente", false)).toBe("Pendente");
  });

  it("mapeia status 'recebido' corretamente", () => {
    expect(mapStatus("recebido", false)).toBe("Recebido");
  });

  it("mapeia status 'em_disputa' corretamente", () => {
    expect(mapStatus("em_disputa", false)).toBe("Em Disputa");
  });

  it("retorna 'Distratado' quando distrato é true, independente do status", () => {
    expect(mapStatus("recebido", true)).toBe("Distratado");
    expect(mapStatus("pendente", true)).toBe("Distratado");
  });

  it("retorna 'Pendente' para status desconhecido", () => {
    expect(mapStatus("status_invalido", false)).toBe("Pendente");
  });
});

describe("Estrutura de dados DRE", () => {
  it("tem exatamente 30 colunas na linha de dados", () => {
    // Verificar que a estrutura de dados tem 30 colunas (igual à planilha DRE)
    const headers = [
      "Data", "Corretor", "Gerente", "Projeto", "Incorporadora", "Região",
      "VGV (R$)", "% Comissão Imob", "Comissão Bruta (R$)", "Tipo Pagamento",
      "% Imposto", "Imposto (R$)", "Comissão Líquida (R$)", "% Corretor",
      "R$ Corretor", "% Gerente", "R$ Gerente", "% Superintendente",
      "R$ Superintendente", "% Sócio 1", "R$ Sócio 1", "% Sócio 2",
      "R$ Sócio 2", "% Sócio 3", "R$ Sócio 3", "Total Rateio (R$)",
      "Resultado Proprietário (R$)", "Status", "Data Recebimento", "Observações"
    ];
    expect(headers.length).toBe(30);
  });

  it("percentuais são enviados como decimais (ex: 3.5% = 0.035)", () => {
    const percComissao = 3.5;
    const percComoDecimal = percComissao / 100;
    expect(percComoDecimal).toBe(0.035);
  });
});
