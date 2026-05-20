import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function diasDesde(date: Date | string | null | undefined): number {
  if (!date) return 0;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}

export const LEAD_STATUS_LABELS: Record<string, string> = {
  novo: "Novo",
  aguardando_atendimento: "Aguardando",
  em_atendimento: "Em Atendimento",
  qualificado: "Qualificado",
  agendado: "Agendado",
  visita_realizada: "Visita Realizada",
  proposta_enviada: "Proposta Enviada",
  analise_credito: "Análise de Crédito",
  contrato_fechado: "Contrato Fechado",
  pos_venda: "Pós-Venda",
  perdido: "Perdido",
};

export const LEAD_STATUS_COLORS: Record<string, string> = {
  novo: "bg-blue-100 text-blue-800",
  aguardando_atendimento: "bg-yellow-100 text-yellow-800",
  em_atendimento: "bg-orange-100 text-orange-800",
  qualificado: "bg-purple-100 text-purple-800",
  agendado: "bg-indigo-100 text-indigo-800",
  visita_realizada: "bg-teal-100 text-teal-800",
  proposta_enviada: "bg-cyan-100 text-cyan-800",
  analise_credito: "bg-pink-100 text-pink-800",
  contrato_fechado: "bg-green-100 text-green-800",
  pos_venda: "bg-emerald-100 text-emerald-800",
  perdido: "bg-red-100 text-red-800",
};

export const TEMPERATURA_COLORS: Record<string, string> = {
  quente: "text-red-500",
  morno: "text-yellow-500",
  frio: "text-blue-500",
};
