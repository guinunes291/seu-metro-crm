import { describe, it, expect } from "vitest";
import { getLogoUrlByConstrutora, CONSTRUTORA_LOGOS } from "./construtoraLogos";

describe("Construtora Logos", () => {
  it("deve retornar a logo correta para CURY", () => {
    const logoUrl = getLogoUrlByConstrutora("CURY");
    expect(logoUrl).toBe(CONSTRUTORA_LOGOS["CURY"]);
    expect(logoUrl).toContain("cury.png");
  });

  it("deve retornar a logo correta para PLANO&PLANO", () => {
    const logoUrl = getLogoUrlByConstrutora("PLANO&PLANO");
    expect(logoUrl).toBe(CONSTRUTORA_LOGOS["PLANO&PLANO"]);
    expect(logoUrl).toContain("plano-plano.png");
  });

  it("deve retornar a logo correta para METROCASA", () => {
    const logoUrl = getLogoUrlByConstrutora("METROCASA");
    expect(logoUrl).toBe(CONSTRUTORA_LOGOS["METROCASA"]);
    expect(logoUrl).toContain("metrocasa.png");
  });

  it("deve retornar a logo correta para VIVAZ", () => {
    const logoUrl = getLogoUrlByConstrutora("VIVAZ");
    expect(logoUrl).toBe(CONSTRUTORA_LOGOS["VIVAZ"]);
    expect(logoUrl).toContain("vivaz.png");
  });

  it("deve ser case-insensitive", () => {
    expect(getLogoUrlByConstrutora("cury")).toBe(CONSTRUTORA_LOGOS["CURY"]);
    expect(getLogoUrlByConstrutora("Cury")).toBe(CONSTRUTORA_LOGOS["CURY"]);
    expect(getLogoUrlByConstrutora("metrocasa")).toBe(CONSTRUTORA_LOGOS["METROCASA"]);
  });

  it("deve remover espaços extras", () => {
    expect(getLogoUrlByConstrutora("  CURY  ")).toBe(CONSTRUTORA_LOGOS["CURY"]);
    expect(getLogoUrlByConstrutora(" METROCASA ")).toBe(CONSTRUTORA_LOGOS["METROCASA"]);
  });

  it("deve fazer busca parcial", () => {
    expect(getLogoUrlByConstrutora("VIVAZ RESIDENCIAL")).toBe(CONSTRUTORA_LOGOS["VIVAZ"]);
    expect(getLogoUrlByConstrutora("Construtora CURY")).toBe(CONSTRUTORA_LOGOS["CURY"]);
  });

  it("deve retornar null para construtora não mapeada", () => {
    expect(getLogoUrlByConstrutora("CONSTRUTORA DESCONHECIDA")).toBeNull();
    expect(getLogoUrlByConstrutora("XYZ")).toBeNull();
  });

  it("deve retornar null para valores vazios ou undefined", () => {
    expect(getLogoUrlByConstrutora("")).toBeNull();
    expect(getLogoUrlByConstrutora(null)).toBeNull();
    expect(getLogoUrlByConstrutora(undefined)).toBeNull();
  });
});
