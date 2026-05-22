import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normaliza texto para busca: remove acentos, cedilha, hífens, espaços extras,
 * converte para minúsculas. Ex: "São-Paulo" → "saopaulo", "Biânca" → "bianca".
 */
export function normalizeSearch(text: string | null | undefined): string {
  return (text || "")
    .normalize("NFD")                    // decompõe caracteres acentuados
    .replace(/[̀-ͯ]/g, "")     // remove diacríticos (acentos, til, etc.)
    .replace(/ç/gi, "c")                 // cedilha residual
    .replace(/[^a-z0-9]/gi, "")          // remove tudo que não é letra ou dígito
    .toLowerCase();
}

/**
 * Verifica se o campo do lead corresponde ao termo de busca normalizado.
 * Funciona para nome, telefone, e-mail e qualquer campo de texto.
 */
export function matchesNormalizedSearch(
  field: string | null | undefined,
  searchNorm: string
): boolean {
  if (!searchNorm) return true;
  return normalizeSearch(field).includes(searchNorm);
}

export function formatTimeAgo(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min atrás`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h atrás`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}d atrás`;
  return d.toLocaleDateString("pt-BR");
}
