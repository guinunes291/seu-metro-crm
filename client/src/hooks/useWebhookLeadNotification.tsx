import { useEffect, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { UrgentLeadPopup } from '@/components/UrgentLeadPopup';
import { useAuth } from '@/_core/hooks/useAuth';

/**
 * Hook para notificar corretor sobre novos leads via webhook (Facebook Ads)
 * - Polling a cada 5 segundos
 * - Notificação push no navegador
 * - Som de alerta
 * - Toast visual
 * - Popup urgente com botão WhatsApp
 *
 * Correções aplicadas:
 * 1. `since` é agora um estado reativo (useState) — a query atualiza o parâmetro
 *    corretamente após detectar novos leads, evitando re-notificações dos mesmos leads.
 * 2. O timestamp inicial é limitado a no máximo 10 minutos atrás — evita popup
 *    de leads antigos ao recarregar a página.
 * 3. O hook só é montado para corretores (via CorretorNotifications no App.tsx).
 */
export function useWebhookLeadNotification() {
  const { user } = useAuth();

  // Apenas corretores devem receber notificações sonoras
  const shouldNotify = user?.role === 'corretor';

  // Inicializar since: máximo 10 minutos atrás para evitar popups de leads antigos
  const getInitialSince = (): string => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const stored = localStorage.getItem('lastWebhookLeadCheck');

    if (stored) {
      const storedDate = new Date(stored);
      // Usar o mais recente entre o armazenado e 10 minutos atrás
      return storedDate > tenMinutesAgo ? storedDate.toISOString() : tenMinutesAgo.toISOString();
    }

    const now = new Date();
    localStorage.setItem('lastWebhookLeadCheck', now.toISOString());
    return now.toISOString();
  };

  // `since` como estado reativo — a query atualiza quando avança o timestamp
  const [since, setSince] = useState<string>(getInitialSince);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const notifiedLeadsRef = useRef<Set<number>>(new Set());
  const [urgentLead, setUrgentLead] = useState<any>(null);

  // Query com polling — usa `since` reativo para sempre buscar leads após o último processado
  const { data: newLeads } = trpc.leads.getNewWebhookLeads.useQuery(
    { since },
    {
      enabled: shouldNotify,
      refetchInterval: shouldNotify ? 8000 : false, // 8s (reduzido de 5s para menor carga no servidor)
      refetchIntervalInBackground: false, // Não pollar em background para economizar recursos
      refetchOnWindowFocus: false,
    }
  );

  // Inicializar áudio de alerta urgente
  useEffect(() => {
    if (!shouldNotify) return;

    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2868/2868-preview.mp3');
    audioRef.current.volume = 1.0;
    audioRef.current.load();

    // Habilitar autoplay após primeira interação do usuário
    const enableAudio = () => {
      if (audioRef.current) {
        audioRef.current.play().then(() => {
          audioRef.current?.pause();
          audioRef.current!.currentTime = 0;
        }).catch(() => {});
      }
    };

    document.addEventListener('click', enableAudio, { once: true });
    document.addEventListener('keydown', enableAudio, { once: true });

    return () => {
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('keydown', enableAudio);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [shouldNotify]);

  // Solicitar permissão para notificações push
  useEffect(() => {
    if (!shouldNotify) return;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [shouldNotify]);

  // Processar novos leads
  useEffect(() => {
    if (!shouldNotify) return;
    if (!newLeads || newLeads.length === 0) return;

    let hasNewLeads = false;
    let latestCreatedAt: Date | null = null;

    newLeads.forEach((lead) => {
      // Evitar notificar o mesmo lead múltiplas vezes
      if (notifiedLeadsRef.current.has(lead.id)) return;
      notifiedLeadsRef.current.add(lead.id);
      hasNewLeads = true;

      // Rastrear o lead mais recente para avançar o `since`
      const leadDate = lead.createdAt ? new Date(lead.createdAt as string) : null;
      if (leadDate && (!latestCreatedAt || leadDate > latestCreatedAt)) {
        latestCreatedAt = leadDate;
      }

      // 1. Toast visual
      toast.error(`🔥 NOVO LEAD FACEBOOK ADS: ${lead.nome}`, {
        description: `Telefone: ${lead.telefone}${lead.projectNome ? ` | Projeto: ${lead.projectNome}` : ''}`,
        duration: 10000,
        action: {
          label: 'Ver Lead',
          onClick: () => {
            window.location.href = `/leads?leadId=${lead.id}`;
          },
        },
      });

      // 2. Som de alerta
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((e) => {
          console.error('[Webhook Notification] Erro ao tocar som:', e);
        });
      }

      // 3. Notificação push do navegador
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const notification = new Notification('🔥 Novo Lead Facebook Ads!', {
            body: `${lead.nome} - ${lead.telefone}${lead.projectNome ? ` | Projeto: ${lead.projectNome}` : ''}`,
            icon: '/favicon.ico',
            tag: `lead-${lead.id}`,
            requireInteraction: true,
            silent: false,
          });
          notification.onclick = () => {
            window.focus();
            window.location.href = `/leads?leadId=${lead.id}`;
            notification.close();
          };
        } catch (error) {
          console.error('[Webhook Notification] Erro ao criar notificação:', error);
        }
      }

      // 4. Popup urgente (mostra apenas o primeiro lead novo)
      setUrgentLead((prev: any) => prev ?? lead);
    });

    if (hasNewLeads) {
      // Avançar `since` para 1ms após o lead mais recente processado
      // Isso garante que a próxima query não retorne os mesmos leads
      const newSince = latestCreatedAt
        ? new Date((latestCreatedAt as Date).getTime() + 1).toISOString()
        : new Date().toISOString();

      setSince(newSince);
      localStorage.setItem('lastWebhookLeadCheck', newSince);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newLeads, shouldNotify]);

  return {
    newLeadsCount: newLeads?.length || 0,
    popup: urgentLead ? (
      <UrgentLeadPopup
        lead={urgentLead}
        onClose={() => setUrgentLead(null)}
      />
    ) : null,
  };
}
