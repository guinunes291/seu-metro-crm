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
  // Rastrear IDs já notificados para evitar re-disparos ao refetch/remount
  const notifiedIdsRef = useRef<Set<number>>(new Set());
  // Flag para indicar que a primeira carga já foi feita (não notificar alertas pré-existentes)
  const initialLoadDoneRef = useRef(false);
  
  // Query de alertas não lidos — sem refetchOnWindowFocus para não disparar ao trocar de aba/página
  const { data: alertas, refetch } = trpc.alertas.meus.useQuery(
    { apenasNaoLidos: true },
    {
      refetchInterval: 45 * 1000, // Reduzido de 10s para 45s — economiza ~4x requests
      refetchOnWindowFocus: false, // IMPORTANTE: desabilitar para evitar disparos ao navegar
    }
  );
  
  const marcarLidoMutation = trpc.alertas.marcarLido.useMutation({
    onSuccess: () => {
      refetch();
    },
  });
  
  // Detectar novos alertas e tocar som — rastreando por ID, não por contagem
  useEffect(() => {
    if (!alertas) return;
    
    if (!initialLoadDoneRef.current) {
      // Primeira carga: registrar todos os IDs existentes como "já vistos"
      // sem disparar notificações (são alertas pré-existentes)
      alertas.forEach(a => notifiedIdsRef.current.add(a.id));
      initialLoadDoneRef.current = true;
      return;
    }
    
    // Nas cargas subsequentes, notificar apenas alertas com IDs novos
    const novosAlertas = alertas.filter(a => !notifiedIdsRef.current.has(a.id));
    
    if (novosAlertas.length > 0) {
      // Mostrar toast para cada novo alerta
      novosAlertas.forEach(alerta => {
        notifiedIdsRef.current.add(alerta.id);
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
      
      // Adicionar aos alertas visíveis (apenas os novos)
      setAlertasVisiveis(prev => [...novosAlertas, ...prev]);
    }
    
    // Sincronizar IDs conhecidos com os alertas atuais
    // (remover IDs de alertas que foram marcados como lidos no backend)
    const currentIds = new Set(alertas.map(a => a.id));
    notifiedIdsRef.current.forEach(id => {
      if (!currentIds.has(id)) {
        notifiedIdsRef.current.delete(id);
      }
    });
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
