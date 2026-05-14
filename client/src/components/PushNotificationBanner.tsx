import { useState, useEffect } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const DISMISSED_KEY = "pushBannerDismissed";

export function PushNotificationBanner() {
  const { user } = useAuth();
  const { isSupported, isSubscribed, subscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === "1"
  );
  const [loading, setLoading] = useState(false);
  const [browserDenied, setBrowserDenied] = useState(false);

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setBrowserDenied(Notification.permission === "denied");
    }
  }, []);

  // Só mostra para corretores com suporte a push que ainda não ativaram
  if (!user || user.role !== "corretor") return null;
  if (!isSupported) return null;
  if (isSubscribed) return null;
  if (dismissed) return null;

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  async function handleSubscribe() {
    setLoading(true);
    try {
      await subscribe();
    } finally {
      setLoading(false);
    }
  }

  if (browserDenied) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 text-sm">
        <BellOff className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-amber-800 dark:text-amber-300 flex-1">
          Notificações bloqueadas no navegador. Para receber alertas de novos leads, habilite em{" "}
          <strong>Configurações do navegador → Notificações → {window.location.hostname}</strong>.
        </p>
        <button onClick={handleDismiss} className="text-amber-600 hover:text-amber-800 dark:hover:text-amber-400 shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800 text-sm">
      <Bell className="h-4 w-4 text-blue-600 shrink-0" />
      <p className="text-blue-800 dark:text-blue-300 flex-1">
        Ative as notificações e receba alertas de novos leads <strong>mesmo com a aba fechada</strong>.
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleSubscribe}
          disabled={loading}
        >
          {loading ? "Ativando..." : "Ativar notificações"}
        </Button>
        <button
          onClick={handleDismiss}
          className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
          title="Dispensar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
