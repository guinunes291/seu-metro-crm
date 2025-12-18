import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bell, BellOff, Check, CheckCheck, UserPlus, Clock, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function Notificacoes() {
  const [, setLocation] = useLocation();
  
  // Buscar notificações
  const { data: notificacoes, isLoading, refetch } = trpc.notifications.list.useQuery({ limit: 50 });
  
  // Contar não lidas
  const { data: unreadCount, refetch: refetchCount } = trpc.notifications.unreadCount.useQuery();
  
  // Marcar como lida
  const markAsRead = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      refetch();
      refetchCount();
    },
  });
  
  // Marcar todas como lidas
  const markAllAsRead = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      refetch();
      refetchCount();
    },
  });

  const getIconByType = (tipo: string) => {
    switch (tipo) {
      case "lead_recebido":
        return <UserPlus className="h-5 w-5 text-green-600" />;
      case "follow_up":
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case "alerta":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Bell className="h-5 w-5 text-blue-600" />;
    }
  };

  const handleNotificationClick = (notification: any) => {
    // Marcar como lida
    if (!notification.lida) {
      markAsRead.mutate({ notificationId: notification.id });
    }
    
    // Se tiver leadId, navegar para o lead
    if (notification.leadId) {
      setLocation(`/leads/${notification.leadId}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notificações</h1>
          <p className="text-muted-foreground">
            {unreadCount && unreadCount > 0 
              ? `Você tem ${unreadCount} notificação(ões) não lida(s)`
              : "Todas as notificações foram lidas"
            }
          </p>
        </div>
        {unreadCount && unreadCount > 0 && (
          <Button 
            variant="outline" 
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
          >
            {markAllAsRead.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="mr-2 h-4 w-4" />
            )}
            Marcar todas como lidas
          </Button>
        )}
      </div>

      {/* Lista de Notificações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Suas Notificações
          </CardTitle>
          <CardDescription>
            Clique em uma notificação para ver detalhes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notificacoes && notificacoes.length > 0 ? (
            <div className="space-y-3">
              {notificacoes.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors hover:bg-accent ${
                    !notification.lida ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200" : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex-shrink-0 mt-1">
                    {getIconByType(notification.tipo)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${!notification.lida ? "text-blue-900 dark:text-blue-100" : ""}`}>
                        {notification.titulo}
                      </p>
                      {!notification.lida && (
                        <Badge variant="default" className="text-xs">
                          Nova
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {notification.mensagem}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {notification.createdAt 
                        ? new Date(notification.createdAt).toLocaleString('pt-BR')
                        : '-'
                      }
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {notification.lida ? (
                      <Check className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead.mutate({ notificationId: notification.id });
                        }}
                        disabled={markAsRead.isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BellOff className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Nenhuma notificação</p>
              <p className="text-sm text-muted-foreground">
                Você será notificado quando receber novos leads ou tiver follow-ups pendentes
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
