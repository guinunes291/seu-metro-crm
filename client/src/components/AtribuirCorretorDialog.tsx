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
import { Loader2 } from "lucide-react";

interface AtribuirCorretorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: {
    id: number;
    nome: string;
  } | null;
  onSuccess?: () => void;
}

export function AtribuirCorretorDialog({ open, onOpenChange, lead, onSuccess }: AtribuirCorretorDialogProps) {
  const [corretorId, setCorretorId] = useState<string>("");
  
  const { data: corretores, isLoading: loadingCorretores } = trpc.users.listCorretores.useQuery();
  const atribuirMutation = trpc.leads.atribuirCorretor.useMutation({
    onSuccess: (data) => {
      toast.success(`Lead atribuído para ${data.corretor} com sucesso!`);
      onOpenChange(false);
      setCorretorId("");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`Erro ao atribuir lead: ${error.message}`);
    },
  });

  const handleAtribuir = () => {
    if (!lead || !corretorId) {
      toast.error("Selecione um corretor");
      return;
    }

    atribuirMutation.mutate({
      leadId: lead.id,
      corretorId: parseInt(corretorId),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atribuir Lead a Corretor</DialogTitle>
          <DialogDescription>
            Selecione um corretor para atribuir o lead <strong>{lead?.nome}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="corretor">Corretor</Label>
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
            onClick={handleAtribuir} 
            disabled={!corretorId || atribuirMutation.isPending}
          >
            {atribuirMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Atribuir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
