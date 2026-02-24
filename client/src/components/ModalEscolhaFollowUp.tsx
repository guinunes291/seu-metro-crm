import { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Calendar, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

interface ModalEscolhaFollowUpProps {
  totalFollowUps: number;
  onEscolhaFeita: () => void;
}

/**
 * Modal diário que aparece ACIMA do bloqueio de follow-up.
 * Pergunta ao corretor se ele deseja realizar os follow-ups do dia.
 * 
 * - SIM: Bloqueio mantido, corretor deve completar todos os follow-ups
 * - NÃO: Sistema desbloqueado imediatamente, leads ficam na base mas
 *         serão transferidos após 2 dias sem interação/alteração de status
 */
export function ModalEscolhaFollowUp({ totalFollowUps, onEscolhaFeita }: ModalEscolhaFollowUpProps) {
  const [escolhendo, setEscolhendo] = useState<'sim' | 'nao' | null>(null);
  
  const registrarEscolha = trpc.progressoFollowUps.registrarEscolhaDiaria.useMutation({
    onSuccess: () => {
      onEscolhaFeita();
    },
  });

  const handleEscolha = (aceitou: boolean) => {
    setEscolhendo(aceitou ? 'sim' : 'nao');
    registrarEscolha.mutate({ aceitouFollowUp: aceitou });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="mx-4 max-w-lg w-full rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-white/20 p-2">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Tarefas do Dia</h2>
              <p className="text-sm text-blue-100">
                Você tem <span className="font-semibold text-white">{totalFollowUps} follow-up{totalFollowUps !== 1 ? 's' : ''}</span> pendente{totalFollowUps !== 1 ? 's' : ''} hoje
              </p>
            </div>
          </div>
        </div>

        {/* Pergunta */}
        <div className="px-6 py-5">
          <p className="text-center text-lg font-semibold text-foreground mb-5">
            Deseja realizar os follow-ups de hoje?
          </p>

          {/* Opção SIM */}
          <button
            onClick={() => handleEscolha(true)}
            disabled={registrarEscolha.isPending}
            className="w-full mb-3 rounded-xl border-2 border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 p-4 text-left transition-all hover:border-green-400 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-green-100 dark:bg-green-900 p-1.5 shrink-0">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-green-700 dark:text-green-400 text-base">Sim, vou fazer!</span>
                  {escolhendo === 'sim' && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <span className="flex items-center gap-1.5 mb-1">
                    <Shield className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
                    Você seguirá os follow-ups do dia
                  </span>
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    O bloqueio ficará ativo até finalizar todos os follow-ups
                  </span>
                </p>
              </div>
            </div>
          </button>

          {/* Opção NÃO */}
          <button
            onClick={() => handleEscolha(false)}
            disabled={registrarEscolha.isPending}
            className="w-full rounded-xl border-2 border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-4 text-left transition-all hover:border-red-400 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-red-100 dark:bg-red-900 p-1.5 shrink-0">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-red-700 dark:text-red-400 text-base">Não, pular hoje</span>
                  {escolhendo === 'nao' && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <span className="flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    O sistema será desbloqueado <strong>IMEDIATAMENTE</strong>
                  </span>
                  <span className="flex items-center gap-1.5 mb-1">
                    <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    Todos os leads voltarão para a sua base
                  </span>
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    Caso não haja interação ou alteração de status durante <strong>2 dias</strong>, eles serão transferidos a outro corretor
                  </span>
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-muted/30 px-6 py-3">
          <p className="text-xs text-center text-muted-foreground">
            Esta escolha é válida apenas para hoje. Amanhã você poderá escolher novamente.
          </p>
        </div>
      </div>
    </div>
  );
}
