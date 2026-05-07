import { useLocation } from "wouter";
import {
  AlertTriangle, Users, Clock, Calendar, UserX, CheckCircle2, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AlertasGestor {
  followUpsVencidos: { id: number; leadNome: string; corretorNome: string | null; dataFollowUp: Date }[];
  agendamentosSemConfirmacao: { id: number; leadNome: string; corretorNome: string | null; dataAgendamento: Date; horaAgendamento: string | null }[];
  analisesSemRetorno: { id: number; leadNome: string; corretorNome: string | null; createdAt: Date }[];
  corretoresSemAtividade: { id: number; nome: string | null; status: string }[];
  leadsSemPrimeiroContato: { id: number; nome: string; corretorNome: string | null; createdAt: Date }[];
}

interface ModalAgendaGestorProps {
  alertas: AlertasGestor;
  onDismiss: () => void;
}

const diasSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export function ModalAgendaGestor({ alertas, onDismiss }: ModalAgendaGestorProps) {
  const [, setLocation] = useLocation();
  const hoje = new Date();

  const totalCriticos = alertas.corretoresSemAtividade.length + alertas.leadsSemPrimeiroContato.length;
  const totalAtenção = alertas.followUpsVencidos.length + alertas.agendamentosSemConfirmacao.length;

  const handleVerAlertas = () => {
    onDismiss();
    setLocation("/central-alertas");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="mx-4 max-w-lg w-full rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-white/20 p-2">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Situação da Equipe</h2>
              <p className="text-sm text-slate-300">
                {diasSemana[hoje.getDay()]}, {hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
              </p>
            </div>
          </div>
        </div>

        {/* Alertas críticos */}
        {totalCriticos > 0 && (
          <div className="px-6 pt-5 pb-2">
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">
              Requer ação imediata
            </p>
            <div className="space-y-2">
              {alertas.corretoresSemAtividade.length > 0 && (
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                  <UserX className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-red-700 dark:text-red-300">
                      <strong>{alertas.corretoresSemAtividade.length}</strong> corretor{alertas.corretoresSemAtividade.length !== 1 ? 'es' : ''} presente{alertas.corretoresSemAtividade.length !== 1 ? 's' : ''} sem atividade hoje
                    </span>
                    {alertas.corretoresSemAtividade.slice(0, 2).map((c) => (
                      <p key={c.id} className="text-xs text-red-600/70 dark:text-red-400/70 mt-0.5">{c.nome}</p>
                    ))}
                    {alertas.corretoresSemAtividade.length > 2 && (
                      <p className="text-xs text-red-600/70 dark:text-red-400/70">+{alertas.corretoresSemAtividade.length - 2} mais</p>
                    )}
                  </div>
                </div>
              )}
              {alertas.leadsSemPrimeiroContato.length > 0 && (
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                  <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0" />
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                    <strong>{alertas.leadsSemPrimeiroContato.length}</strong> lead{alertas.leadsSemPrimeiroContato.length !== 1 ? 's' : ''} aguardando atendimento há mais de 30 min
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Alertas de atenção */}
        {totalAtenção > 0 && (
          <div className="px-6 pt-3 pb-2">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">
              Requer acompanhamento
            </p>
            <div className="space-y-2">
              {alertas.followUpsVencidos.length > 0 && (
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <Users className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    <strong>{alertas.followUpsVencidos.length}</strong> follow-up{alertas.followUpsVencidos.length !== 1 ? 's' : ''} vencido{alertas.followUpsVencidos.length !== 1 ? 's' : ''} na equipe
                  </span>
                </div>
              )}
              {alertas.agendamentosSemConfirmacao.length > 0 && (
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    <strong>{alertas.agendamentosSemConfirmacao.length}</strong> agendamento{alertas.agendamentosSemConfirmacao.length !== 1 ? 's' : ''} de amanhã sem confirmação
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="px-6 pb-5 pt-4">
          <Button
            onClick={handleVerAlertas}
            className="w-full mb-2 bg-slate-800 hover:bg-slate-700 text-white"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Ver Central de Alertas
            <ArrowRight className="h-4 w-4 ml-auto" />
          </Button>
          <button
            onClick={onDismiss}
            className="w-full rounded-xl border-2 border-muted bg-muted/30 p-2.5 text-sm text-muted-foreground hover:bg-muted/50 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            Visto — fechar por hoje
          </button>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-muted/30 px-6 py-3">
          <p className="text-xs text-center text-muted-foreground">
            Este resumo aparece uma vez por dia. Atualiza em tempo real na Central de Alertas.
          </p>
        </div>
      </div>
    </div>
  );
}
