import { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Calendar, Shield, Clock, Users, CalendarCheck, Phone } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface ModalAgendaDiaProps {
  totalFollowUps: number;
  leadsAguardando: number;
  agendamentosHoje: number;
  onEscolhaFeita: () => void;
  onDismiss: () => void;
}

const diasSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export function ModalAgendaDia({
  totalFollowUps,
  leadsAguardando,
  agendamentosHoje,
  onEscolhaFeita,
  onDismiss,
}: ModalAgendaDiaProps) {
  const [escolhendo, setEscolhendo] = useState<'sim' | 'nao' | null>(null);
  const hoje = new Date();
  const totalTarefas = totalFollowUps + leadsAguardando + agendamentosHoje;

  const registrarEscolha = trpc.progressoFollowUps.registrarEscolhaDiaria.useMutation({
    onSuccess: () => onEscolhaFeita(),
  });

  const handleSim = () => {
    setEscolhendo('sim');
    if (totalFollowUps > 0) {
      registrarEscolha.mutate({ aceitouFollowUp: true });
    } else {
      onDismiss();
    }
  };

  const handleNao = () => {
    setEscolhendo('nao');
    if (totalFollowUps > 0) {
      registrarEscolha.mutate({ aceitouFollowUp: false });
    } else {
      onDismiss();
    }
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
              <h2 className="text-xl font-bold">Sua Agenda de Hoje</h2>
              <p className="text-sm text-blue-100">
                {diasSemana[hoje.getDay()]}, {hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
              </p>
            </div>
          </div>
        </div>

        {/* Resumo do dia */}
        <div className="px-6 pt-5 pb-3">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Você tem {totalTarefas} {totalTarefas === 1 ? 'tarefa' : 'tarefas'} hoje
          </p>
          <div className="space-y-2">
            {leadsAguardando > 0 && (
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                <Users className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                <span className="text-sm font-medium text-red-700 dark:text-red-300">
                  <strong>{leadsAguardando}</strong> lead{leadsAguardando !== 1 ? 's' : ''} aguardando primeiro contato
                </span>
              </div>
            )}
            {totalFollowUps > 0 && (
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <Phone className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  <strong>{totalFollowUps}</strong> follow-up{totalFollowUps !== 1 ? 's' : ''} pendente{totalFollowUps !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {agendamentosHoje > 0 && (
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <CalendarCheck className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  <strong>{agendamentosHoje}</strong> agendamento{agendamentosHoje !== 1 ? 's' : ''} hoje
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Pergunta */}
        <div className="px-6 pb-5">
          <p className="text-center text-base font-semibold text-foreground mb-4 mt-2">
            Pronto para dar o seu melhor hoje?
          </p>

          {/* Opção SIM */}
          <button
            onClick={handleSim}
            disabled={registrarEscolha.isPending}
            className="w-full mb-3 rounded-xl border-2 border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 p-4 text-left transition-all hover:border-green-400 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-green-100 dark:bg-green-900 p-1.5 shrink-0">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-green-700 dark:text-green-400 text-base">Vou fazer tudo!</span>
                  {escolhendo === 'sim' && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {totalFollowUps > 0 ? (
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      Bloqueio ativo até completar todos os follow-ups
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      Tela inicial mostrará suas prioridades
                    </span>
                  )}
                </p>
              </div>
            </div>
          </button>

          {/* Opção VER DEPOIS */}
          <button
            onClick={handleNao}
            disabled={registrarEscolha.isPending}
            className="w-full rounded-xl border-2 border-muted bg-muted/30 p-3 text-left transition-all hover:border-border hover:bg-muted/50 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-muted p-1.5 shrink-0">
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-muted-foreground text-sm">Ver depois</span>
                  {escolhendo === 'nao' && (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                  )}
                </div>
                {totalFollowUps > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <Clock className="h-3 w-3 inline mr-1" />
                    Leads transferidos após 2 dias sem interação
                  </p>
                )}
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
