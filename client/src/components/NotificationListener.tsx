import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Bell } from "lucide-react";

// Função para solicitar permissão de notificação do navegador
async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  return false;
}

// Função para enviar notificação do navegador (sem som)
function sendBrowserNotification(title: string, body: string, leadId?: number) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const notification = new Notification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: leadId ? `lead-${leadId}` : undefined,
      requireInteraction: true,
    });

    notification.onclick = () => {
      window.focus();
      if (leadId) window.location.href = `/leads?leadId=${leadId}`;
      notification.close();
    };
  } catch (error) {
    console.error('[Notificações] Erro ao criar notificação:', error);
  }
}

export default function NotificationListener() {
  const { user } = useAuth();
  const [lastCheck, setLastCheck] = useState(() => Date.now());
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(false);

  // Solicitar permissão de notificação do navegador ao carregar
  useEffect(() => {
    if (user) {
      requestNotificationPermission().then(granted => {
        setBrowserNotificationsEnabled(granted);
      });
    }
  }, [user]);

  // Query para buscar novas notificações (polling a cada 15 segundos)
  const { data: newNotifications } = trpc.notifications.getNewSince.useQuery(
    { since: lastCheck },
    {
      enabled: !!user,
      refetchInterval: 15000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: false,
    }
  );

  const utils = trpc.useUtils();

  // Processar novas notificações (apenas visual — sem som)
  useEffect(() => {
    if (newNotifications && newNotifications.length > 0) {
      newNotifications.forEach((notification) => {
        // Toast interno do app
        toast(notification.titulo, {
          description: notification.mensagem,
          duration: 10000,
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

      const latestTimestamp = Math.max(
        ...newNotifications.map(n => new Date(n.createdAt).getTime())
      );
      setLastCheck(latestTimestamp + 1);

      utils.notifications.unreadCount.invalidate();
      utils.notifications.list.invalidate();
    }
  }, [newNotifications]);

  // Componente invisível — apenas lógica de polling
  return null;
}
