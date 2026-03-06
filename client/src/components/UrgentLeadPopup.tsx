import { useState, useEffect } from "react";
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
 */
export function UrgentLeadPopup({ lead, onClose }: UrgentLeadPopupProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [leadTransferido, setLeadTransferido] = useState(false);
  const { user } = useAuth();
  
  const utils = trpc.useUtils();

  // Verificar se o lead ainda pertence ao corretor logado
  const { data: leadAtual, isError: leadError } = trpc.leads.getById.useQuery(
    { id: lead.id },
    {
      refetchInterval: 5000, // Verificar a cada 5s se o lead ainda é do corretor
      retry: false,
    }
  );

  // Detectar se o lead foi transferido para outro corretor
  useEffect(() => {
    // Se der erro FORBIDDEN, o lead foi transferido
    if (leadError) {
      setLeadTransferido(true);
      return;
    }
    // Se o lead carregou mas pertence a outro corretor
    if (leadAtual && user && leadAtual.corretorId !== user.id) {
      setLeadTransferido(true);
    }
  }, [leadAtual, leadError, user]);
  
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
      // Após atualizar status, registrar interação
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
    
    // 1. Atualizar status para "Em Atendimento"
    updateStatusMutation.mutate({
      id: lead.id,
      data: { status: "em_atendimento" },
    });
    
    // 2. Abrir WhatsApp com mensagem personalizada
    window.open(gerarLinkWhatsApp(lead.telefone, lead.nome, lead.projectNome), "_blank");
  };
  
  // Se o lead foi transferido, mostrar aviso e fechar
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
          <DialogFooter>
            <Button onClick={onClose}>Fechar</Button>
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
