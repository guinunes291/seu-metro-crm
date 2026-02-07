import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Bell, Volume2, VolumeX, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";

// URL do som de notificação discreto para notificações gerais (não urgentes)
const NOTIFICATION_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3";

// Função para solicitar permissão de notificação do navegador
async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.log("Este navegador não suporta notificações");
    return false;
  }
  
  if (Notification.permission === "granted") {
    return true;
  }
  
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  
  return false;
}

// Função para enviar notificação do navegador
function sendBrowserNotification(title: string, body: string, leadId?: number) {
  // Verificar se notificações são suportadas
  if (!('Notification' in window)) {
    console.warn('[Notificações] Não suportadas neste navegador');
    return;
  }

  if (Notification.permission === "granted") {
    try {
      const notification = new Notification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: leadId ? `lead-${leadId}` : undefined,
        requireInteraction: true, // Mantém a notificação até o usuário interagir
      });
      
      notification.onclick = () => {
        window.focus();
        if (leadId) {
          window.location.href = `/leads?leadId=${leadId}`;
        }
        notification.close();
      };
    } catch (error) {
      console.error('[Notificações] Erro ao criar notificação:', error);
    }
  }
}

export default function NotificationListener() {
  const { user } = useAuth();
  const [lastCheck, setLastCheck] = useState(() => Date.now());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Solicitar permissão de notificação do navegador ao carregar
  useEffect(() => {
    if (user) {
      requestNotificationPermission().then(granted => {
        setBrowserNotificationsEnabled(granted);
        if (granted) {
          console.log("Notificações do navegador ativadas");
        }
      });
    }
  }, [user]);
  
  // Criar elemento de áudio
  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
    audioRef.current.volume = 0.3; // Volume discreto para notificações gerais
    
    // Pré-carregar o áudio
    audioRef.current.load();
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);
  
  // Carregar preferência de som do localStorage
  useEffect(() => {
    const saved = localStorage.getItem("notification_sound_enabled");
    if (saved !== null) {
      setSoundEnabled(saved === "true");
    }
  }, []);
  
  // Salvar preferência de som
  const toggleSound = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    localStorage.setItem("notification_sound_enabled", String(newValue));
    
    if (newValue) {
      // Tocar som de teste
      playNotificationSound();
      toast.success("Som de notificação ativado");
    } else {
      toast.info("Som de notificação desativado");
    }
  };
  
  // Função para tocar o som
  const playNotificationSound = () => {
    if (audioRef.current && soundEnabled) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.warn("Não foi possível tocar o som:", err);
      });
    }
  };
  
  // Query para buscar novas notificações (polling a cada 5 segundos)
  const { data: newNotifications } = trpc.notifications.getNewSince.useQuery(
    { since: lastCheck },
    {
      enabled: !!user,
      refetchInterval: 5000, // Polling a cada 5 segundos
      refetchIntervalInBackground: true,
    }
  );
  
  // Utils para invalidar queries
  const utils = trpc.useUtils();
  
  // Processar novas notificações
  useEffect(() => {
    if (newNotifications && newNotifications.length > 0) {
      // Tocar som
      playNotificationSound();
      
      // Mostrar toast para cada notificação
      newNotifications.forEach((notification) => {
        // Toast interno do app
        toast(notification.titulo, {
          description: notification.mensagem,
          duration: 10000, // 10 segundos
          icon: <Bell className="h-5 w-5 text-primary" />,
          action: notification.leadId ? {
            label: "Ver Lead",
            onClick: () => {
              window.location.href = `/leads?leadId=${notification.leadId}`;
            },
          } : undefined,
        });
        
        // Notificação do navegador (funciona mesmo com aba em segundo plano)
        if (browserNotificationsEnabled && document.hidden) {
          sendBrowserNotification(
            notification.titulo,
            notification.mensagem,
            notification.leadId || undefined
          );
        }
      });
      
      // Atualizar timestamp para próxima verificação
      const latestTimestamp = Math.max(
        ...newNotifications.map(n => new Date(n.createdAt).getTime())
      );
      setLastCheck(latestTimestamp + 1);
      
      // Invalidar contagem de notificações não lidas
      utils.notifications.unreadCount.invalidate();
      utils.notifications.list.invalidate();
    }
  }, [newNotifications]);
  
  // Não renderizar nada se não estiver logado
  if (!user) return null;
  
  // Botão de toggle do som (pode ser colocado em um menu)
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleSound}
      className="relative"
      title={soundEnabled ? "Desativar som de notificação" : "Ativar som de notificação"}
    >
      {soundEnabled ? (
        <Volume2 className="h-5 w-5" />
      ) : (
        <VolumeX className="h-5 w-5 text-muted-foreground" />
      )}
    </Button>
  );
}
