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
    .replace(/[\u0300-\u036f]/g, "")     // remove diacríticos (acentos, til, etc.)
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
