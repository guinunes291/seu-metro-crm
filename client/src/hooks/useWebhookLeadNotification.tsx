import { useEffect, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { UrgentLeadPopup } from '@/components/UrgentLeadPopup';

/**
 * Hook para notificar corretor sobre novos leads via webhook (Facebook Ads)
 * - Polling a cada 5 segundos
 * - Notificação push no navegador
 * - Som de alerta
 * - Toast visual
 * - Popup urgente com botão WhatsApp
 */
export function useWebhookLeadNotification() {
  const lastCheckRef = useRef(new Date());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const notifiedLeadsRef = useRef<Set<number>>(new Set());
  const [urgentLead, setUrgentLead] = useState<any>(null);

  // Query para buscar novos leads webhook
  const { data: newLeads } = trpc.leads.getNewWebhookLeads.useQuery(
    { 
      since: lastCheckRef.current.toISOString(),
    },
    {
      refetchInterval: 5000, // Polling a cada 5 segundos
      refetchIntervalInBackground: true,
    }
  );

  // Inicializar áudio de alerta urgente
  useEffect(() => {
    // Som de alarme urgente para leads de Facebook Ads/Webhook
    // Usando som de emergência mais chamativo
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2868/2868-preview.mp3');
    audioRef.current.volume = 0.8; // Volume alto para urgência
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
    
    // Escutar primeira interação (click ou keydown)
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
  }, []);

  // Solicitar permissão para notificações push
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Processar novos leads
  useEffect(() => {
    if (!newLeads || newLeads.length === 0) return;

    newLeads.forEach((lead) => {
      // Evitar notificar o mesmo lead múltiplas vezes
      if (notifiedLeadsRef.current.has(lead.id)) return;
      notifiedLeadsRef.current.add(lead.id);

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
        console.log('[Webhook Notification] Tentando tocar som de alerta...');
        audioRef.current.play()
          .then(() => {
            console.log('[Webhook Notification] Som tocado com sucesso!');
          })
          .catch((e) => {
            console.error('[Webhook Notification] Erro ao tocar som:', e);
            console.log('[Webhook Notification] Dica: Interaja com a página (clique ou pressione uma tecla) para habilitar o som.');
          });
      }

      // 3. Notificação push do navegador
      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification('🔥 Novo Lead Facebook Ads!', {
          body: `${lead.nome} - ${lead.telefone}`,
          icon: '/favicon.ico',
          tag: `lead-${lead.id}`,
          requireInteraction: true, // Não desaparece automaticamente
        });

        notification.onclick = () => {
          window.focus();
          window.location.href = `/leads?leadId=${lead.id}`;
          notification.close();
        };
      }
      
      // 4. Popup urgente (mostra apenas o primeiro lead se houver múltiplos)
      if (!urgentLead) {
        setUrgentLead(lead);
      }
    });

    // Atualizar timestamp da última verificação
    lastCheckRef.current = new Date();
  }, [newLeads, urgentLead]);

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
