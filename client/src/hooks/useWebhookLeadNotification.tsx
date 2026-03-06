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
 */
export function useWebhookLeadNotification() {
  const { user } = useAuth();
  
  // Apenas corretores devem receber notificações sonoras
  // Gestores e admins não recebem sons
  const shouldNotify = user?.role === 'corretor';
  
  // Inicializar lastCheck do localStorage ou usar timestamp atual
  const getInitialLastCheck = () => {
    const stored = localStorage.getItem('lastWebhookLeadCheck');
    if (stored) {
      return new Date(stored);
    }
    // Se não houver timestamp salvo, usar timestamp atual para evitar notificações de leads antigos
    const now = new Date();
    localStorage.setItem('lastWebhookLeadCheck', now.toISOString());
    return now;
  };
  
  const lastCheckRef = useRef(getInitialLastCheck());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const notifiedLeadsRef = useRef<Set<number>>(new Set());
  const [urgentLead, setUrgentLead] = useState<any>(null);

  // Query para buscar novos leads webhook
  // Apenas habilitar polling para corretores
  const { data: newLeads } = trpc.leads.getNewWebhookLeads.useQuery(
    { 
      since: lastCheckRef.current.toISOString(),
    },
    {
      enabled: shouldNotify, // Desabilitar para gestores/admins
      refetchInterval: shouldNotify ? 5000 : false, // Polling apenas para corretores
      refetchIntervalInBackground: shouldNotify,
    }
  );

  // Inicializar áudio de alerta urgente
  useEffect(() => {
    // Apenas corretores devem carregar o áudio
    if (!shouldNotify) return;
    
    // Som de alarme urgente para leads de Facebook Ads/Webhook
    // Usando som de emergência mais chamativo
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2868/2868-preview.mp3');
    audioRef.current.volume = 1.0; // Volume máximo (100%) para urgência
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
  }, [shouldNotify]);

  // Solicitar permissão para notificações push
  useEffect(() => {
    // Apenas corretores devem solicitar permissão de notificação
    if (!shouldNotify) return;
    
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [shouldNotify]);

  // Processar novos leads — urgentLead removido das dependências para evitar re-disparos
  useEffect(() => {
    // Não processar se não deve notificar (gestor/admin)
    if (!shouldNotify) return;
    if (!newLeads || newLeads.length === 0) return;

    let hasNewLeads = false;
    newLeads.forEach((lead) => {
      // Evitar notificar o mesmo lead múltiplas vezes
      if (notifiedLeadsRef.current.has(lead.id)) return;
      notifiedLeadsRef.current.add(lead.id);
      hasNewLeads = true;

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
        audioRef.current.play()
          .then(() => {
            console.log('[Webhook Notification] Som tocado com sucesso!');
          })
          .catch((e) => {
            console.error('[Webhook Notification] Erro ao tocar som:', e);
          });
      }

      // 3. Notificação push do navegador (funciona mesmo com aba em segundo plano)
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
      // Atualizar timestamp da última verificação e salvar no localStorage
      const now = new Date();
      lastCheckRef.current = now;
      localStorage.setItem('lastWebhookLeadCheck', now.toISOString());
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
