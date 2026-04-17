/**
 * CONSTANTES MCMV — Valores vigentes a partir de 22/04/2026
 * Fonte: Governo Federal / CCFGTS
 *
 * Faixas de renda mensal bruta familiar:
 *   F1: até R$ 3.200
 *   F2: R$ 3.200,01 a R$ 5.000
 *   F3: R$ 5.000,01 a R$ 9.600
 *   Classe Média (F4): R$ 9.600,01 a R$ 13.000
 *
 * Teto do imóvel em São Paulo:
 *   F1 e F2: R$ 275.000
 *   F3: R$ 400.000
 *   Classe Média: R$ 600.000
 */

export interface FaixaMCMV {
  faixa: "F1" | "F2" | "F3" | "F4";
  label: string;
  renda_min: number;
  renda_max: number;
  teto_sp: number;
  taxa_mensal: number; // taxa de juros mensal de referência
  subsidio_max: number;
  subsidio_pct: number; // percentual máximo do VGV como subsídio
}

export const MCMV_FAIXAS: FaixaMCMV[] = [
  {
    faixa: "F1",
    label: "Faixa 1",
    renda_min: 0,
    renda_max: 3200,
    teto_sp: 275000,
    taxa_mensal: 0.0035, // 0,35% a.m. ≈ 4,28% a.a.
    subsidio_max: 55000,
    subsidio_pct: 0.25,
  },
  {
    faixa: "F2",
    label: "Faixa 2",
    renda_min: 3200.01,
    renda_max: 5000,
    teto_sp: 275000,
    taxa_mensal: 0.005, // 0,50% a.m. ≈ 6,17% a.a.
    subsidio_max: 35000,
    subsidio_pct: 0.15,
  },
  {
    faixa: "F3",
    label: "Faixa 3",
    renda_min: 5000.01,
    renda_max: 9600,
    teto_sp: 400000,
    taxa_mensal: 0.0063, // 0,63% a.m. ≈ 7,83% a.a.
    subsidio_max: 15000,
    subsidio_pct: 0.06,
  },
  {
    faixa: "F4",
    label: "Classe Média",
    renda_min: 9600.01,
    renda_max: 13000,
    teto_sp: 600000,
    taxa_mensal: 0.0085, // 0,85% a.m. ≈ 10,65% a.a.
    subsidio_max: 0,
    subsidio_pct: 0,
  },
];

/**
 * Retorna a faixa MCMV para uma dada renda familiar mensal bruta.
 * Retorna null se a renda estiver acima do teto (> R$ 13.000).
 */
export function getFaixaMCMV(renda: number): FaixaMCMV | null {
  return MCMV_FAIXAS.find((f) => renda >= f.renda_min && renda <= f.renda_max) ?? null;
}

/**
 * Calcula o subsídio estimado com base na faixa e no VGV.
 */
export function calcularSubsidio(faixa: FaixaMCMV, vgv: number): number {
  if (faixa.subsidio_max === 0) return 0;
  return Math.min(faixa.subsidio_max, vgv * faixa.subsidio_pct);
}

/**
 * Calcula a parcela estimada pelo sistema PRICE (1ª parcela = parcela constante).
 * valor_financiavel = VGV - subsidio - fgts
 * parcela = PV * i / (1 - (1+i)^-n)
 */
export function calcularParcelaPRICE(valorFinanciavel: number, prazoMeses: number, taxaMensal: number): number {
  if (valorFinanciavel <= 0 || prazoMeses <= 0) return 0;
  const i = taxaMensal;
  return (valorFinanciavel * i) / (1 - Math.pow(1 + i, -prazoMeses));
}

/**
 * Calcula a 1ª parcela pelo sistema SAC.
 * amortizacao = valorFinanciavel / prazoMeses
 * juros = valorFinanciavel * taxaMensal
 * parcela = amortizacao + juros
 */
export function calcularParcela1aSAC(valorFinanciavel: number, prazoMeses: number, taxaMensal: number): number {
  if (valorFinanciavel <= 0 || prazoMeses <= 0) return 0;
  const amortizacao = valorFinanciavel / prazoMeses;
  const juros = valorFinanciavel * taxaMensal;
  return amortizacao + juros;
}

// Labels para exibição nos dropdowns de faixa de renda
export const FAIXA_RENDA_OPTIONS = [
  { value: "ate_3200", label: "Até R$ 3.200 (Faixa 1)" },
  { value: "ate_5000", label: "R$ 3.200,01 a R$ 5.000 (Faixa 2)" },
  { value: "ate_9600", label: "R$ 5.000,01 a R$ 9.600 (Faixa 3)" },
  { value: "ate_13000", label: "R$ 9.600,01 a R$ 13.000 (Classe Média)" },
  { value: "acima_13000", label: "Acima de R$ 13.000 (Fora do MCMV)" },
] as const;
