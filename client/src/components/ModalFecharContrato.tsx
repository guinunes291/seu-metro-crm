import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { FileCheck, DollarSign } from "lucide-react";

interface ModalFecharContratoProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: number;
  leadNome: string;
  onSuccess?: () => void;
}

export function ModalFecharContrato({
  isOpen,
  onClose,
  leadId,
  leadNome,
  onSuccess,
}: ModalFecharContratoProps) {
  const [projectId, setProjectId] = useState<string>("");
  const [valorVenda, setValorVenda] = useState("");
  const [dataAssinatura, setDataAssinatura] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [observacoes, setObservacoes] = useState("");

  const utils = trpc.useUtils();
  const { data: projects } = trpc.projects.list.useQuery();

  const createContrato = trpc.contratos.create.useMutation({
    onSuccess: () => {
      toast.success("Contrato fechado com sucesso! 🎉", {
        description: `Parabéns! Você fechou a venda com ${leadNome}.`,
      });
      
      // Invalidar queries relevantes
      utils.leads.invalidate();
      utils.contratos.invalidate();
      utils.dashboard.invalidate();
      
      onClose();
      if (onSuccess) onSuccess();
      
      // Resetar formulário
      setProjectId("");
      setValorVenda("");
      setDataAssinatura(new Date().toISOString().split("T")[0]);
      setObservacoes("");
    },
    onError: (error) => {
      toast.error("Erro ao fechar contrato", {
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (!valorVenda || parseFloat(valorVenda.replace(/\D/g, "")) <= 0) {
      toast.error("Valor da venda inválido");
      return;
    }

    if (!dataAssinatura) {
      toast.error("Data de assinatura é obrigatória");
      return;
    }

    createContrato.mutate({
      leadId,
      projectId: projectId ? parseInt(projectId) : undefined,
      valorVenda: parseFloat(valorVenda.replace(/\D/g, "")) / 100, // Converter centavos para reais
      dataAssinatura,
      observacoes: observacoes || undefined,
    });
  };

  const formatCurrency = (value: string) => {
    // Remove tudo que não é dígito
    const numbers = value.replace(/\D/g, "");
    
    // Converte para número e formata
    const amount = parseFloat(numbers) / 100;
    return amount.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    setValorVenda(formatted);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-green-600" />
            Fechar Contrato - {leadNome}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Projeto */}
          <div className="space-y-2">
            <Label htmlFor="project">Projeto/Empreendimento</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o projeto (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {projects?.map((project) => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Valor da Venda */}
          <div className="space-y-2">
            <Label htmlFor="valor">
              Valor da Venda (VGV) <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="valor"
                type="text"
                value={valorVenda}
                onChange={handleValorChange}
                placeholder="0,00"
                className="pl-9"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Digite o valor da venda em reais
            </p>
          </div>

          {/* Data de Assinatura */}
          <div className="space-y-2">
            <Label htmlFor="data">
              Data de Assinatura <span className="text-red-500">*</span>
            </Label>
            <Input
              id="data"
              type="date"
              value={dataAssinatura}
              onChange={(e) => setDataAssinatura(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              required
            />
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="obs">Observações</Label>
            <Textarea
              id="obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Informações adicionais sobre o contrato..."
              rows={3}
            />
          </div>

          {/* Botões */}
          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={createContrato.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createContrato.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {createContrato.isPending ? "Salvando..." : "Fechar Contrato"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
