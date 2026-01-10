import { useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

/**
 * Hook para notificar corretor sobre novos leads via webhook (Facebook Ads)
 * - Polling a cada 5 segundos
 * - Notificação push no navegador
 * - Som de alerta
 * - Toast visual
 */
export function useWebhookLeadNotification() {
  const lastCheckRef = useRef(new Date());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const notifiedLeadsRef = useRef<Set<number>>(new Set());

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

  // Inicializar áudio de alerta
  useEffect(() => {
    // Som de notificação urgente (beep triplo)
    const audioContext = typeof window !== 'undefined' && 'AudioContext' in window 
      ? new AudioContext() 
      : null;
    
    if (audioContext) {
      // Criar som de alerta programaticamente
      const playAlert = () => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800; // Frequência alta para urgência
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
      };
      
      audioRef.current = {
        play: () => {
          // Tocar 3 vezes
          playAlert();
          setTimeout(playAlert, 150);
          setTimeout(playAlert, 300);
          return Promise.resolve();
        },
      } as any;
    }
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
        audioRef.current.play().catch((e) => {
          console.log('Erro ao tocar som:', e);
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
    });

    // Atualizar timestamp da última verificação
    lastCheckRef.current = new Date();
  }, [newLeads]);

  return {
    newLeadsCount: newLeads?.length || 0,
  };
}
