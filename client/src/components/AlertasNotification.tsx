import { useEffect, useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useLocation } from "wouter";

export function AlertasNotification() {
  const [, setLocation] = useLocation();
  const [alertasVisiveis, setAlertasVisiveis] = useState<any[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousCountRef = useRef(0);
  
  // Query de alertas não lidos
  const { data: alertas, refetch } = trpc.alertas.meus.useQuery(
    { apenasNaoLidos: true },
    {
      refetchInterval: 5000, // Atualiza a cada 5 segundos
      refetchOnWindowFocus: true,
    }
  );
  
  const marcarLidoMutation = trpc.alertas.marcarLido.useMutation({
    onSuccess: () => {
      refetch();
    },
  });
  
  // Detectar novos alertas e tocar som
  useEffect(() => {
    if (!alertas) return;
    
    const currentCount = alertas.length;
    
    // Se há novos alertas (count aumentou)
    if (currentCount > previousCountRef.current) {
      // Tocar som de notificação
      if (audioRef.current) {
        audioRef.current.play().catch(err => {
          console.log("Não foi possível tocar o som:", err);
        });
      }
      
      // Mostrar toast
      const novosAlertas = alertas.slice(0, currentCount - previousCountRef.current);
      novosAlertas.forEach(alerta => {
        toast.error(`🔔 Novo alerta: ${alerta.mensagem}`, {
          duration: 10000,
          action: {
            label: "Ver Lead",
            onClick: () => {
              setLocation(`/leads?leadId=${alerta.leadId}`);
              marcarLidoMutation.mutate({ id: alerta.id });
            },
          },
        });
      });
      
      // Adicionar aos alertas visíveis
      setAlertasVisiveis(prev => [...novosAlertas, ...prev]);
    }
    
    previousCountRef.current = currentCount;
  }, [alertas]);
  
  // Remover alerta da lista visível
  const removerAlerta = (id: number) => {
    setAlertasVisiveis(prev => prev.filter(a => a.id !== id));
    marcarLidoMutation.mutate({ id });
  };
  
  // Ir para o lead
  const irParaLead = (leadId: number, alertaId: number) => {
    setLocation(`/leads?leadId=${leadId}`);
    removerAlerta(alertaId);
  };
  
  return (
    <>
      {/* Som de notificação */}
      <audio
        ref={audioRef}
        src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi78OScTgwOUKzn77RgGwU7k9v0yXkpBSh+zPLaizsKGGS56+mjUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKGGS56+mjUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKGGS56+mjUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKGGS56+mjUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKGGS56+mjUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKGGS56+mjUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKGGS56+mjUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKGGS56+mjUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKGGS56+mjUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKGGS56+mjUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKGGS56+mjUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKGGS56+mjUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKGGS56+mjUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKGGS56+mjUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKGGS56+mjUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKGGS56+mjUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKGGS56+mjUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKGGS56+mjUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKGGS56+mjUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKGGS56+mjUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKGGS56+mjUBELTKXh8bllHAU2jdXzzn0vBQ=="
      />
      
      {/* Alertas flutuantes */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
        {alertasVisiveis.map((alerta) => (
          <Card
            key={alerta.id}
            className="p-4 bg-red-50 border-red-200 shadow-lg animate-in slide-in-from-right"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <Bell className="h-5 w-5 text-red-600 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-900">
                  Alerta Urgente!
                </p>
                <p className="text-sm text-red-700 mt-1">
                  {alerta.mensagem}
                </p>
                {alerta.leadNome && (
                  <p className="text-xs text-red-600 mt-1">
                    Lead: {alerta.leadNome}
                  </p>
                )}
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => irParaLead(alerta.leadId, alerta.id)}
                  >
                    Ver Lead
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removerAlerta(alerta.id)}
                  >
                    Dispensar
                  </Button>
                </div>
              </div>
              <button
                onClick={() => removerAlerta(alerta.id)}
                className="flex-shrink-0 text-red-400 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </Card>
        ))}
      </div>
      
      {/* Badge de contador no header (opcional) */}
      {alertas && alertas.length > 0 && (
        <div className="fixed top-4 right-4 z-40">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setLocation("/leads?status=aguardando_atendimento")}
            className="relative"
          >
            <Bell className="h-4 w-4 mr-2" />
            Alertas
            <Badge className="ml-2 bg-white text-red-600">
              {alertas.length}
            </Badge>
          </Button>
        </div>
      )}
    </>
  );
}
