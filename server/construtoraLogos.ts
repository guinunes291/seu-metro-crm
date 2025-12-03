/**
 * Mapeamento de construtoras para URLs das logos
 * As logos estão hospedadas no S3
 */

export const CONSTRUTORA_LOGOS: Record<string, string> = {
  // CURY
  "CURY": "https://d2xsxph8kpxj0f.cloudfront.net/310419663032188321/gjgL2sFxYNbZjhUM6i4tZH/construtoras/cury.png",
  
  // PLANO&PLANO (e variações)
  "PLANO&PLANO": "https://d2xsxph8kpxj0f.cloudfront.net/310419663032188321/gjgL2sFxYNbZjhUM6i4tZH/construtoras/plano-plano.png",
  "PLANO & PLANO": "https://d2xsxph8kpxj0f.cloudfront.net/310419663032188321/gjgL2sFxYNbZjhUM6i4tZH/construtoras/plano-plano.png",
  "PLANO E PLANO": "https://d2xsxph8kpxj0f.cloudfront.net/310419663032188321/gjgL2sFxYNbZjhUM6i4tZH/construtoras/plano-plano.png",
  "PLANO & PARCERIA": "https://d2xsxph8kpxj0f.cloudfront.net/310419663032188321/gjgL2sFxYNbZjhUM6i4tZH/construtoras/plano-plano.png",
  "PLANCK&PLANO": "https://d2xsxph8kpxj0f.cloudfront.net/310419663032188321/gjgL2sFxYNbZjhUM6i4tZH/construtoras/plano-plano.png",
  
  // METROCASA
  "METROCASA": "https://d2xsxph8kpxj0f.cloudfront.net/310419663032188321/gjgL2sFxYNbZjhUM6i4tZH/construtoras/metrocasa.png",
  
  // VIVAZ (e variações)
  "VIVAZ": "https://d2xsxph8kpxj0f.cloudfront.net/310419663032188321/gjgL2sFxYNbZjhUM6i4tZH/construtoras/vivaz.png",
  "VIVAZ RESIDENCIAL": "https://d2xsxph8kpxj0f.cloudfront.net/310419663032188321/gjgL2sFxYNbZjhUM6i4tZH/construtoras/vivaz.png",
};

/**
 * Busca a logo de uma construtora
 * Faz busca case-insensitive e remove espaços extras
 */
export function getLogoUrlByConstrutora(construtora: string | null | undefined): string | null {
  if (!construtora) return null;

  // Normalizar: uppercase e remover espaços extras
  const normalized = construtora.trim().toUpperCase();

  // Busca exata
  if (CONSTRUTORA_LOGOS[normalized]) {
    return CONSTRUTORA_LOGOS[normalized];
  }

  // Busca parcial (se o nome da construtora contém alguma chave)
  for (const [key, url] of Object.entries(CONSTRUTORA_LOGOS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return url;
    }
  }

  return null;
}
