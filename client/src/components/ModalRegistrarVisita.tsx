import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Calendar, Clock, Building2, FileText, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface ModalRegistrarVisitaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: number;
  leadNome: string;
  agendamentoId?: number;
  onSuccess?: () => void;
}

export function ModalRegistrarVisita({
  open,
  onOpenChange,
  leadId,
  leadNome,
  agendamentoId,
  onSuccess
}: ModalRegistrarVisitaProps) {
  // Toast já importado do sonner
  const utils = trpc.useUtils();
  
  // Estado do formulário
  const [dataVisita, setDataVisita] = useState(format(new Date(), "yyyy-MM-dd"));
  const [horaVisita, setHoraVisita] = useState(format(new Date(), "HH:mm"));
  const [projetoCustom, setProjetoCustom] = useState("");
  const [construtora, setConstrutora] = useState("");
  const [resultado, setResultado] = useState<"interesse_alto" | "interesse_medio" | "interesse_baixo" | "sem_interesse" | "pendente_documentacao" | "encaminhado_analise">("interesse_medio");
  const [observacoes, setObservacoes] = useState("");
  
  // Mutation para criar visita
  const createVisita = trpc.visitas.create.useMutation({
    onSuccess: () => {
      toast.success("Visita registrada com sucesso!", {
        description: "O histórico foi atualizado e o dashboard refletirá esta visita.",
      });
      
      // Invalidar queries relevantes
      utils.visitas.list.invalidate();
      utils.leads.getById.invalidate({ id: leadId });
      utils.dashboard.metrics.invalidate();
      
      // Resetar formulário
      setDataVisita(format(new Date(), "yyyy-MM-dd"));
      setHoraVisita(format(new Date(), "HH:mm"));
      setProjetoCustom("");
      setConstrutora("");
      setResultado("interesse_medio");
      setObservacoes("");
      
      // Fechar modal
      onOpenChange(false);
      
      // Callback de sucesso
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      toast.error("Erro ao registrar visita", {
        description: error.message,
      });
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    createVisita.mutate({
      leadId,
      agendamentoId,
      dataVisita,
      horaVisita,
      projetoCustom: projetoCustom || undefined,
      construtora: construtora || undefined,
      resultado,
      observacoes: observacoes || undefined,
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Registrar Visita Realizada
          </DialogTitle>
          <DialogDescription>
            Registre os detalhes da visita realizada com <strong>{leadNome}</strong>
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Data e Hora */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dataVisita" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data da Visita
              </Label>
              <Input
                id="dataVisita"
                type="date"
                value={dataVisita}
                onChange={(e) => setDataVisita(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="horaVisita" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Horário
              </Label>
              <Input
                id="horaVisita"
                type="time"
                value={horaVisita}
                onChange={(e) => setHoraVisita(e.target.value)}
              />
            </div>
          </div>
          
          {/* Projeto e Construtora */}
          <div className="space-y-2">
            <Label htmlFor="projetoCustom" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Projeto Visitado
            </Label>
            <Input
              id="projetoCustom"
              placeholder="Ex: Edifício Solar Park, Residencial Vista Verde..."
              value={projetoCustom}
              onChange={(e) => setProjetoCustom(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="construtora">Construtora</Label>
            <Input
              id="construtora"
              placeholder="Ex: Tenda, MRV, Cyrela..."
              value={construtora}
              onChange={(e) => setConstrutora(e.target.value)}
            />
          </div>
          
          {/* Resultado da Visita */}
          <div className="space-y-2">
            <Label htmlFor="resultado">Resultado da Visita</Label>
            <Select value={resultado} onValueChange={(value: any) => setResultado(value)}>
              <SelectTrigger id="resultado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="interesse_alto">🔥 Interesse Alto</SelectItem>
                <SelectItem value="interesse_medio">👍 Interesse Médio</SelectItem>
                <SelectItem value="interesse_baixo">😐 Interesse Baixo</SelectItem>
                <SelectItem value="sem_interesse">❌ Sem Interesse</SelectItem>
                <SelectItem value="pendente_documentacao">📄 Pendente Documentação</SelectItem>
                <SelectItem value="encaminhado_analise">📊 Encaminhado para Análise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Observações
            </Label>
            <Textarea
              id="observacoes"
              placeholder="Detalhes da visita, impressões do cliente, próximos passos..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={4}
            />
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createVisita.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createVisita.isPending}>
              {createVisita.isPending ? "Registrando..." : "Registrar Visita"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
