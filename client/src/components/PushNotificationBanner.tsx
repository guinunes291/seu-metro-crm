import { useState, useEffect } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Banner que solicita permissão para push notifications.
 * Exibido apenas para corretores que ainda não ativaram as notificações.
 * Aparece no topo do dashboard e pode ser dispensado.
 */
export function PushNotificationBanner() {
  const { user } = useAuth();
  const { isSupported, isSubscribed, subscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Verificar se já foi dispensado nesta sessão
  useEffect(() => {
    const wasDismissed = sessionStorage.getItem("push-banner-dismissed");
    if (wasDismissed) setDismissed(true);
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem("push-banner-dismissed", "true");
    setDismissed(true);
  };

  const handleEnable = async () => {
    setLoading(true);
    try {
      await subscribe();
    } finally {
      setLoading(false);
    }
  };

  // Só mostrar para corretores que suportam push e ainda não ativaram
  if (!user || user.role !== "corretor") return null;
  if (!isSupported || isSubscribed || dismissed) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 flex items-center gap-3 mb-4">
      <Bell className="h-5 w-5 text-amber-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-amber-200 font-medium">
          Ative as notificações para receber alertas de novos leads em tempo real
        </p>
        <p className="text-xs text-amber-300/70 mt-0.5">
          Você será notificado mesmo com a aba fechada ou o celular bloqueado
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          size="sm"
          onClick={handleEnable}
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-600 text-white text-xs h-8"
        >
          <Bell className="h-3.5 w-3.5 mr-1.5" />
          {loading ? "Ativando..." : "Ativar"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDismiss}
          className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Toggle de push notifications para a página de Perfil.
 * Permite ativar/desativar com feedback visual.
 */
export function PushNotificationToggle() {
  const { isSupported, isSubscribed, subscribe, unsubscribe } = usePushNotifications();
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (isSubscribed) {
        await unsubscribe();
      } else {
        await subscribe();
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="flex items-center gap-3 p-4 bg-slate-800 rounded-lg border border-slate-700">
        <BellOff className="h-5 w-5 text-slate-500" />
        <div>
          <p className="text-sm text-slate-300 font-medium">Notificações push</p>
          <p className="text-xs text-slate-500">Não suportado neste navegador</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg border border-slate-700">
      <div className="flex items-center gap-3">
        {isSubscribed ? (
          <Bell className="h-5 w-5 text-green-400" />
        ) : (
          <BellOff className="h-5 w-5 text-slate-400" />
        )}
        <div>
          <p className="text-sm text-slate-200 font-medium">Notificações push</p>
          <p className="text-xs text-slate-400">
            {isSubscribed
              ? "Ativo — você receberá alertas de novos leads"
              : "Inativo — ative para receber alertas mesmo com a aba fechada"}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant={isSubscribed ? "outline" : "default"}
        onClick={handleToggle}
        disabled={loading}
        className={
          isSubscribed
            ? "border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs"
            : "bg-green-600 hover:bg-green-700 text-white text-xs"
        }
      >
        {loading ? "..." : isSubscribed ? "Desativar" : "Ativar"}
      </Button>
    </div>
  );
}
