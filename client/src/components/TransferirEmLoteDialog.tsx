import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TransferirEmLoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadIds: number[];
  onSuccess?: () => void;
}

export function TransferirEmLoteDialog({ open, onOpenChange, leadIds, onSuccess }: TransferirEmLoteDialogProps) {
  const [corretorId, setCorretorId] = useState<string>("");
  
  const { data: corretores, isLoading: loadingCorretores } = trpc.corretores.list.useQuery();
  const transferirMutation = trpc.leads.transferirEmLote.useMutation({
    onSuccess: (data) => {
      if (data.erros > 0) {
        toast.warning(`${data.transferidos} leads transferidos para ${data.novoCorretor}. ${data.erros} erros.`);
      } else {
        toast.success(`${data.transferidos} leads transferidos para ${data.novoCorretor} com sucesso!`);
      }
      onOpenChange(false);
      setCorretorId("");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`Erro ao transferir leads: ${error.message}`);
    },
  });

  const handleTransferir = () => {
    if (!corretorId) {
      toast.error("Selecione um corretor");
      return;
    }

    if (leadIds.length === 0) {
      toast.error("Nenhum lead selecionado");
      return;
    }

    transferirMutation.mutate({
      leadIds,
      novoCorretorId: parseInt(corretorId),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir Leads em Lote</DialogTitle>
          <DialogDescription>
            Você está prestes a transferir <strong>{leadIds.length}</strong> {leadIds.length === 1 ? 'lead' : 'leads'} para outro corretor.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Esta ação irá transferir todos os leads selecionados para o corretor escolhido. 
            Um registro será criado no histórico de cada lead.
          </AlertDescription>
        </Alert>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="corretor">Corretor de Destino</Label>
            {loadingCorretores ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando corretores...
              </div>
            ) : (
              <Select value={corretorId} onValueChange={setCorretorId}>
                <SelectTrigger id="corretor">
                  <SelectValue placeholder="Selecione um corretor" />
                </SelectTrigger>
                <SelectContent>
                  {corretores?.map((corretor) => (
                    <SelectItem key={corretor.id} value={corretor.id.toString()}>
                      {corretor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleTransferir} 
            disabled={!corretorId || transferirMutation.isPending}
          >
            {transferirMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Transferir {leadIds.length} {leadIds.length === 1 ? 'Lead' : 'Leads'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
