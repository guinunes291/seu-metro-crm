import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Calendar, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ModalRegistroRapidoProps {
  open: boolean;
  onClose: () => void;
  leadId: number;
  leadNome: string;
  onSuccess?: () => void;
}

type Resultado = "atendeu" | "nao_atendeu" | "agendou" | "enviou_proposta";

const opcoes: { value: Resultado; label: string; descricao: string; icon: React.ReactNode; cor: string }[] = [
  {
    value: "atendeu",
    label: "Atendeu",
    descricao: "Lead atendeu e houve contato",
    icon: <CheckCircle2 className="h-5 w-5" />,
    cor: "border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 hover:border-green-400",
  },
  {
    value: "nao_atendeu",
    label: "Não Atendeu",
    descricao: "Tentativa sem resposta",
    icon: <XCircle className="h-5 w-5" />,
    cor: "border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 hover:border-red-400",
  },
  {
    value: "agendou",
    label: "Agendou Visita",
    descricao: "Lead confirmou visita",
    icon: <Calendar className="h-5 w-5" />,
    cor: "border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 hover:border-blue-400",
  },
  {
    value: "enviou_proposta",
    label: "Enviou Proposta",
    descricao: "Proposta comercial enviada",
    icon: <FileText className="h-5 w-5" />,
    cor: "border-purple-200 bg-purple-50 dark:bg-purple-950/30 dark:border-purple-800 hover:border-purple-400",
  },
];

type TipoInteracao = "ligacao" | "whatsapp" | "email" | "sms" | "visita" | "outro";
type ResultadoInteracao = "contato_realizado" | "nao_atendeu" | "agendamento" | "visita_realizada" | "proposta_enviada" | "recusou" | "outro";

const interacaoParaResultado: Record<Resultado, { tipo: TipoInteracao; resultado: ResultadoInteracao; novoStatus?: string }> = {
  atendeu:        { tipo: "ligacao", resultado: "contato_realizado" },
  nao_atendeu:    { tipo: "ligacao", resultado: "nao_atendeu" },
  agendou:        { tipo: "ligacao", resultado: "agendamento", novoStatus: "agendado" },
  enviou_proposta: { tipo: "outro",  resultado: "proposta_enviada", novoStatus: "analise_credito" },
};

export function ModalRegistroRapido({ open, onClose, leadId, leadNome, onSuccess }: ModalRegistroRapidoProps) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [observacao, setObservacao] = useState("");

  const utils = trpc.useUtils();

  const addInteraction = trpc.leads.addInteraction.useMutation();
  const atualizarLead = trpc.leads.update.useMutation();

  const handleSalvar = async () => {
    if (!resultado) {
      toast.error("Selecione um resultado");
      return;
    }

    try {
      const { tipo, resultado: resultadoInteracao, novoStatus } = interacaoParaResultado[resultado];

      await addInteraction.mutateAsync({
        leadId,
        tipo,
        resultado: resultadoInteracao,
        observacoes: observacao.trim() || undefined,
      });

      if (novoStatus) {
        await atualizarLead.mutateAsync({ id: leadId, data: { status: novoStatus as any } });
      }

      await utils.dashboard.leadsPrioritarios.invalidate();
      await utils.progressoFollowUps.getProgresso.invalidate();

      toast.success(`Registrado: ${opcoes.find((o) => o.value === resultado)?.label}`);
      onSuccess?.();
      handleClose();
    } catch {
      toast.error("Erro ao registrar contato");
    }
  };

  const handleClose = () => {
    setResultado(null);
    setObservacao("");
    onClose();
  };

  const isPending = addInteraction.isPending || atualizarLead.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Registrar contato — {leadNome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {opcoes.map((op) => (
            <button
              key={op.value}
              onClick={() => setResultado(op.value)}
              className={`w-full rounded-lg border-2 p-3 text-left transition-all ${op.cor} ${
                resultado === op.value ? "ring-2 ring-offset-1 ring-primary" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={resultado === op.value ? "text-primary" : "text-muted-foreground"}>
                  {op.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold">{op.label}</p>
                  <p className="text-xs text-muted-foreground">{op.descricao}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <Textarea
          placeholder="Observação opcional..."
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={2}
          className="resize-none text-sm"
        />

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleSalvar} disabled={isPending || !resultado}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
