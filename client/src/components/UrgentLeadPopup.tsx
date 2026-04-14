import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, MessageCircle, Mail, X, Flame, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { gerarLinkWhatsApp } from "@/lib/whatsapp";
import { useAuth } from "@/_core/hooks/useAuth";

interface UrgentLeadPopupProps {
  lead: {
    id: number;
    nome: string;
    telefone?: string | null;
    email?: string | null;
    projectNome?: string | null;
  };
  onClose: () => void;
}

/**
 * Popup urgente para leads Facebook Ads
 * Mostra dados do lead e botão para contatar via WhatsApp
 * Marca automaticamente primeira interação e muda status para "Em Atendimento"
 * Fecha automaticamente com countdown se o lead for transferido para outro corretor
 */
export function UrgentLeadPopup({ lead, onClose }: UrgentLeadPopupProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [leadTransferido, setLeadTransferido] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { user } = useAuth();
  
  const utils = trpc.useUtils();

  // Verificar se o lead ainda pertence ao corretor logado (polling a cada 30s)
  // Reduzido de 5s para 30s — o transferenciaJob roda a cada 2min, 30s é suficiente para detectar transferência
  const { data: leadAtual, isError: leadError } = trpc.leads.getById.useQuery(
    { id: lead.id },
    {
      refetchInterval: 2 * 60 * 1000, // 2 minutos (reduzido de 30s — popup urgente pode verificar com menor frequência)
      retry: false,
      refetchOnWindowFocus: true,
    }
  );

  // Detectar se o lead foi transferido para outro corretor
  useEffect(() => {
    const foiTransferido =
      leadError ||
      (leadAtual != null && user != null && leadAtual.corretorId !== user.id);

    if (foiTransferido && !leadTransferido) {
      setLeadTransferido(true);
      toast.warning(`Lead "${lead.nome}" foi transferido para outro corretor.`);
    }
  }, [leadAtual, leadError, user, leadTransferido, lead.nome]);

  // Iniciar countdown automático de 5s quando lead for transferido
  useEffect(() => {
    if (!leadTransferido) return;

    setCountdown(5);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [leadTransferido, onClose]);
  
  const addInteractionMutation = trpc.leads.addInteraction.useMutation({
    onSuccess: () => {
      toast.success("Primeira interação registrada!");
      utils.leads.list.invalidate();
      onClose();
    },
    onError: (error) => {
      toast.error(`Erro ao registrar interação: ${error.message}`);
      setIsProcessing(false);
    },
  });
  
  const updateStatusMutation = trpc.leads.update.useMutation({
    onSuccess: () => {
      addInteractionMutation.mutate({
        leadId: lead.id,
        tipo: "whatsapp",
        resultado: "contato_realizado",
        observacoes: "Primeiro contato via WhatsApp - Lead Facebook Ads urgente",
      });
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar status: ${error.message}`);
      setIsProcessing(false);
    },
  });
  
  const handleContatarAgora = () => {
    if (!lead.telefone) {
      toast.error("Lead não possui telefone cadastrado");
      return;
    }
    setIsProcessing(true);
    updateStatusMutation.mutate({
      id: lead.id,
      data: { status: "em_atendimento" },
    });
    window.open(gerarLinkWhatsApp(lead.telefone, lead.nome, lead.projectNome), "_blank");
  };
  
  // Tela de aviso quando lead foi transferido — fecha automaticamente com countdown
  if (leadTransferido) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md border-2 border-yellow-500">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
              <DialogTitle className="text-xl">Lead Transferido</DialogTitle>
            </div>
            <DialogDescription>
              Este lead foi transferido para outro corretor e não está mais disponível para você.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-center">
            <p className="text-sm text-muted-foreground">
              Esta janela fechará automaticamente em{" "}
              <span className="font-bold text-yellow-600">{countdown}s</span>
            </p>
            {/* Barra de progresso do countdown */}
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-yellow-500 transition-all duration-1000"
                style={{ width: `${(countdown / 5) * 100}%` }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Fechar agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md border-2 border-red-500">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-6 w-6 text-red-600" />
              <DialogTitle className="text-xl">Lead Urgente!</DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={isProcessing}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            Novo lead do Facebook Ads chegou agora
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Badge Facebook Ads */}
          <div className="flex justify-center">
            <Badge variant="destructive" className="text-sm px-3 py-1">
              🔥 FACEBOOK ADS - URGENTE
            </Badge>
          </div>
          
          {/* Dados do lead */}
          <div className="space-y-3 rounded-lg bg-muted p-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nome</p>
              <p className="text-lg font-semibold">{lead.nome}</p>
            </div>
            
            {lead.telefone && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Telefone</p>
                <p className="flex items-center gap-2 text-lg font-semibold">
                  <Phone className="h-4 w-4" />
                  {lead.telefone}
                </p>
              </div>
            )}
            
            {lead.email && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">E-mail</p>
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {lead.email}
                </p>
              </div>
            )}
            
            {lead.projectNome && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Projeto</p>
                <p className="font-semibold">{lead.projectNome}</p>
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
          >
            Depois
          </Button>
          <Button
            onClick={handleContatarAgora}
            disabled={isProcessing || !lead.telefone}
            className="gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            {isProcessing ? "Processando..." : "Contatar Agora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
