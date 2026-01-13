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
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TransferirLeadButtonProps {
  leadId: number;
  leadNome: string;
  corretores: Array<{ id: number; name: string; email: string }>;
  onSuccess?: () => void;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
}

export default function TransferirLeadButton({
  leadId,
  leadNome,
  corretores,
  onSuccess,
  variant = "ghost",
  size = "sm",
}: TransferirLeadButtonProps) {
  const [open, setOpen] = useState(false);
  const [novoCorretorId, setNovoCorretorId] = useState<string>("");

  const transferirMutation = trpc.leads.transferir.useMutation({
    onSuccess: (data) => {
      toast.success(`Lead transferido para ${data.novoCorretor} com sucesso!`);
      setOpen(false);
      setNovoCorretorId("");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`Erro ao transferir lead: ${error.message}`);
    },
  });

  const handleTransferir = () => {
    if (!novoCorretorId) {
      toast.error("Selecione um corretor");
      return;
    }

    transferirMutation.mutate({
      leadId,
      novoCorretorId: parseInt(novoCorretorId),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} title="Transferir lead">
          <ArrowRightLeft className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir Lead</DialogTitle>
          <DialogDescription>
            Transferir <strong>{leadNome}</strong> para outro corretor
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleTransferir}
            disabled={transferirMutation.isPending || !novoCorretorId}
          >
            {transferirMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
