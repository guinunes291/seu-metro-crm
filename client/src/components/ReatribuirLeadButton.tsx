import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserCog, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ReatribuirLeadButtonProps {
  leadId: number;
  leadNome: string;
  leadStatus: string;
  corretores: Array<{ id: number; name: string; email: string }>;
  onSuccess?: () => void;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
}

export default function ReatribuirLeadButton({
  leadId,
  leadNome,
  leadStatus,
  corretores,
  onSuccess,
  variant = "ghost",
  size = "sm",
}: ReatribuirLeadButtonProps) {
  const [open, setOpen] = useState(false);
  const [novoCorretorId, setNovoCorretorId] = useState<string>("");

  const reatribuirMutation = trpc.leads.reatribuir.useMutation({
    onSuccess: (data) => {
      toast.success(`Lead reatribuído para ${data.novoCorretor} (status mantido: ${data.statusMantido})`);
      setOpen(false);
      setNovoCorretorId("");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`Erro ao reatribuir lead: ${error.message}`);
    },
  });

  const handleReatribuir = () => {
    if (!novoCorretorId) {
      toast.error("Selecione um corretor");
      return;
    }

    reatribuirMutation.mutate({
      leadId,
      novoCorretorId: parseInt(novoCorretorId),
    });
  };

  const statusLabels: Record<string, string> = {
    novo: "Novo",
    aguardando_atendimento: "Aguardando Atendimento",
    em_atendimento: "Em Atendimento",
    agendado: "Agendado",
    visita_realizada: "Visita Realizada",
    analise_credito: "Análise de Crédito",
    contrato_fechado: "Contrato Fechado",
    perdido: "Perdido",
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} title="Reatribuir lead (mantém status)">
          <UserCog className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reatribuir Lead</DialogTitle>
          <DialogDescription>
            Reatribuir <strong>{leadNome}</strong> para outro corretor mantendo o status atual: <strong>{statusLabels[leadStatus] || leadStatus}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Novo Corretor</label>
            <Select value={novoCorretorId} onValueChange={setNovoCorretorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um corretor" />
              </SelectTrigger>
              <SelectContent>
                {corretores.map((corretor) => (
                  <SelectItem key={corretor.id} value={corretor.id.toString()}>
                    {corretor.name} ({corretor.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md bg-blue-50 dark:bg-blue-950 p-3 text-sm text-blue-800 dark:text-blue-200">
            <strong>Nota:</strong> O lead será transferido mantendo o status atual. Use "Transferir Lead" se quiser voltar para "Aguardando Atendimento".
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleReatribuir}
            disabled={reatribuirMutation.isPending || !novoCorretorId}
          >
            {reatribuirMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Reatribuir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
