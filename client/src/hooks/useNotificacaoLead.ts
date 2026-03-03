/**
 * Hook para gerenciar permissões e envio de notificações nativas do navegador
 * para alertar o corretor sobre leads Facebook ADS com timer próximo de expirar.
 */

import { useEffect, useRef } from "react";

/** Solicita permissão de notificação ao usuário (chamado uma vez ao entrar no sistema) */
export function useSolicitarPermissaoNotificacao() {
  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      // Solicita permissão de forma não bloqueante
      Notification.requestPermission();
    }
  }, []);
}

interface NotificacaoLeadOptions {
  nomeCliente: string;
  tempoRestanteMs: number;
  leadId: number;
}

/**
 * Envia uma notificação nativa do navegador alertando sobre o prazo do lead.
 * Retorna false se a permissão não foi concedida.
 */
export function enviarNotificacaoLead({
  nomeCliente,
  tempoRestanteMs,
  leadId,
}: NotificacaoLeadOptions): boolean {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return false;
  }

  const minutos = Math.floor(tempoRestanteMs / 60000);
  const segundos = Math.floor((tempoRestanteMs % 60000) / 1000);
  const tempoTexto =
    minutos > 0
      ? `${minutos} min ${segundos}s`
      : `${segundos} segundos`;

  const notificacao = new Notification("⚠️ Lead Facebook ADS — Prazo Urgente!", {
    body: `${nomeCliente} será transferido em ${tempoTexto}. Atenda agora!`,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: `lead-timer-${leadId}`, // Evita duplicar notificações para o mesmo lead
    requireInteraction: true,   // Mantém a notificação visível até o usuário interagir
  });

  // Ao clicar na notificação, foca a janela do sistema
  notificacao.onclick = () => {
    window.focus();
    notificacao.close();
  };

  return true;
}

/**
 * Hook que dispara notificação do navegador quando o timer entra nos últimos 3 minutos.
 * Garante que a notificação seja enviada apenas uma vez por lead.
 */
export function useNotificacaoTimerLead({
  leadId,
  nomeCliente,
  tempoRestanteMs,
  timerAtivo,
  origem,
}: {
  leadId?: number;
  nomeCliente?: string;
  tempoRestanteMs: number;
  timerAtivo: boolean;
  origem?: string | null;
}) {
  const notificacaoEnviada = useRef(false);
  const LIMITE_URGENCIA_MS = 3 * 60 * 1000; // 3 minutos

  useEffect(() => {
    // Resetar flag quando o timer é reativado (novo lead ou redistribuição)
    notificacaoEnviada.current = false;
  }, [leadId, timerAtivo]);

  useEffect(() => {
    if (!timerAtivo) return;
    if (!origem) return;

    // Verificar se é lead Facebook ADS
    const o = origem.toLowerCase();
    const isFacebookADS =
      o.includes("webhook") ||
      o.includes("facebook") ||
      o.includes("fb") ||
      o.includes("ads");
    if (!isFacebookADS) return;

    // Disparar notificação apenas uma vez quando entrar nos últimos 3 minutos
    if (
      tempoRestanteMs > 0 &&
      tempoRestanteMs <= LIMITE_URGENCIA_MS &&
      !notificacaoEnviada.current
    ) {
      notificacaoEnviada.current = true;
      enviarNotificacaoLead({
        nomeCliente: nomeCliente || "Cliente",
        tempoRestanteMs,
        leadId: leadId ?? 0,
      });
    }
  }, [tempoRestanteMs, timerAtivo, origem, nomeCliente, leadId, LIMITE_URGENCIA_MS]);
}
