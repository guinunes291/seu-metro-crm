import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { trpc } from '../lib/trpc';

interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  url?: string;
  requireInteraction?: boolean;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  
  const subscribeMutation = trpc.push.subscribe.useMutation();
  const unsubscribeMutation = trpc.push.unsubscribe.useMutation();
  const { data: vapidData } = trpc.push.getPublicKey.useQuery();

  useEffect(() => {
    // Verificar se notificações push são suportadas
    if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
      setIsSupported(true);
      
      // Registrar Service Worker
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('[Push] Service Worker registrado:', reg);
          setRegistration(reg);
          
          // Verificar se já está inscrito
          return reg.pushManager.getSubscription();
        })
        .then((subscription) => {
          setIsSubscribed(!!subscription);
        })
        .catch((error) => {
          console.error('[Push] Erro ao registrar Service Worker:', error);
        });
    }
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error('Notificações push não são suportadas neste navegador');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        toast.success('Notificações ativadas!');
        return true;
      } else if (permission === 'denied') {
        toast.error('Permissão para notificações negada');
        return false;
      } else {
        toast.info('Permissão para notificações não concedida');
        return false;
      }
    } catch (error) {
      console.error('[Push] Erro ao solicitar permissão:', error);
      toast.error('Erro ao solicitar permissão para notificações');
      return false;
    }
  };

  const subscribe = async (): Promise<PushSubscription | null> => {
    if (!registration) {
      toast.error('Service Worker não está registrado');
      return null;
    }

    try {
      // Solicitar permissão primeiro
      const hasPermission = await requestPermission();
      if (!hasPermission) return null;

      // Obter VAPID public key do backend
      if (!vapidData?.publicKey) {
        toast.error('Erro ao obter chave de notificações');
        return null;
      }
      
      // Criar inscrição
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
      });

      // Salvar subscription no backend
      await subscribeMutation.mutateAsync({
        subscription: subscription.toJSON() as any,
        userAgent: navigator.userAgent,
      });
      
      setIsSubscribed(true);
      toast.success('Notificações ativadas com sucesso!');
      console.log('[Push] Subscription salva no backend');
      
      return subscription;
    } catch (error) {
      console.error('[Push] Erro ao se inscrever:', error);
      toast.error('Erro ao ativar notificações push');
      return null;
    }
  };

  const unsubscribe = async (): Promise<boolean> => {
    if (!registration) return false;

    try {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        // Remover do backend primeiro
        await unsubscribeMutation.mutateAsync({
          endpoint: subscription.endpoint,
        });
        
        await subscription.unsubscribe();
        setIsSubscribed(false);
        toast.success('Notificações desativadas');
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Push] Erro ao cancelar inscrição:', error);
      toast.error('Erro ao desativar notificações');
      return false;
    }
  };

  const showNotification = async (options: PushNotificationOptions): Promise<void> => {
    if (!registration) {
      console.warn('[Push] Service Worker não registrado');
      return;
    }

    // Verificar se notificações são suportadas e permitidas
    if (!('Notification' in window)) {
      console.warn('[Push] Notificações não suportadas');
      return;
    }

    if (Notification.permission !== 'granted') {
      console.warn('[Push] Permissão de notificação não concedida');
      return;
    }

    try {
      await registration.showNotification(options.title, {
        body: options.body,
        icon: options.icon || '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        vibrate: [200, 100, 200],
        tag: options.tag || 'default',
        requireInteraction: options.requireInteraction || false,
        data: {
          url: options.url || '/',
        },
      });
    } catch (error) {
      console.error('[Push] Erro ao mostrar notificação:', error);
    }
  };

  return {
    isSupported,
    isSubscribed,
    requestPermission,
    subscribe,
    unsubscribe,
    showNotification,
  };
}

// Função auxiliar para converter VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
