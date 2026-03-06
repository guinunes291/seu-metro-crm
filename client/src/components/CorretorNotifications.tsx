import { useAuth } from "@/_core/hooks/useAuth";
import { useWebhookLeadNotification } from "@/hooks/useWebhookLeadNotification";

/**
 * Componente que encapsula todas as notificações exclusivas de corretores.
 * Só é montado quando o usuário logado tem role === 'corretor'.
 * Isso garante que gestores, admins e superintendentes NUNCA recebam
 * sons ou popups de leads Facebook ADS.
 */
function CorretorNotificationsInner() {
  const { popup: webhookPopup } = useWebhookLeadNotification();
  return <>{webhookPopup}</>;
}

export function CorretorNotifications() {
  const { user } = useAuth();

  // Aguardar o carregamento do usuário antes de montar
  if (!user) return null;

  // Apenas corretores recebem notificações de leads Facebook ADS
  if (user.role !== "corretor") return null;

  return <CorretorNotificationsInner />;
}
