import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { FileCheck, Loader2 } from "lucide-react";

interface ModalRegistrarAnaliseCreditoProps {
  open: boolean;
  onClose: () => void;
  leadId: number;
  leadNome: string;
  onSuccess?: () => void;
}

export function ModalRegistrarAnaliseCredito({
  open,
  onClose,
  leadId,
  leadNome,
  onSuccess,
}: ModalRegistrarAnaliseCreditoProps) {
  const [status, setStatus] = useState<"enviada" | "aprovada" | "reprovada" | "pendente">("enviada");
  const [observacoes, setObservacoes] = useState("");

  const criarAnaliseMutation = trpc.analises.create.useMutation({
    onSuccess: () => {
      toast.success("Análise de crédito registrada com sucesso!");
      setStatus("enviada");
      setObservacoes("");
      onClose();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`Erro ao registrar análise: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    criarAnaliseMutation.mutate({
      leadId,
      status,
      observacoes: observacoes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-purple-600" />
            Registrar Análise de Crédito
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Lead */}
          <div>
            <Label className="text-sm font-medium text-muted-foreground">Cliente</Label>
            <p className="text-base font-semibold">{leadNome}</p>
          </div>

          {/* Status da Análise */}
          <div className="space-y-2">
            <Label htmlFor="status">Status da Análise *</Label>
            <Select value={status} onValueChange={(value: any) => setStatus(value)}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enviada">Enviada</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="aprovada">Aprovada</SelectItem>
                <SelectItem value="reprovada">Reprovada</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Status atual da análise de crédito
            </p>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Documentação completa enviada para banco XYZ. Aguardando retorno..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Detalhes sobre a análise, instituição financeira, documentos enviados, etc.
            </p>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={criarAnaliseMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={criarAnaliseMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {criarAnaliseMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <FileCheck className="mr-2 h-4 w-4" />
                  Registrar Análise
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
