import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Lead {
  id: number;
  createdAt: Date | string;
  status: string;
}

interface LeadsUrgentesCardProps {
  leads: Lead[];
  className?: string;
}

// Configurações de tempo (em minutos) - mesmo do LeadTimer
const TEMPO_ALERTA_AMARELO_MIN = 5;
const TEMPO_ALERTA_VERMELHO_MIN = 30;
const TEMPO_CRITICO_MIN = 120;

function getUrgencyLevel(createdAt: Date | string, status: string): "normal" | "warning" | "danger" | "critical" | null {
  // Não contar leads já atendidos ou finalizados
  const statusFinalizados = ["em_atendimento", "contrato_fechado", "perdido", "cancelado"];
  if (statusFinalizados.includes(status)) {
    return null;
  }

  const created = new Date(createdAt).getTime();
  const elapsed = Date.now() - created;
  const minutesWaiting = elapsed / (1000 * 60);

  if (minutesWaiting >= TEMPO_CRITICO_MIN) return "critical";
  if (minutesWaiting >= TEMPO_ALERTA_VERMELHO_MIN) return "danger";
  if (minutesWaiting >= TEMPO_ALERTA_AMARELO_MIN) return "warning";
  return "normal";
}

export default function LeadsUrgentesCard({ leads, className }: LeadsUrgentesCardProps) {
  const urgencyStats = useMemo(() => {
    const stats = {
      critical: 0,
      danger: 0,
      warning: 0,
      normal: 0,
    };

    leads.forEach((lead) => {
      const level = getUrgencyLevel(lead.createdAt, lead.status);
      if (level) {
        stats[level]++;
      }
    });

    return stats;
  }, [leads]);

  const totalAguardando = urgencyStats.critical + urgencyStats.danger + urgencyStats.warning + urgencyStats.normal;

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Leads Aguardando Atendimento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {/* Crítico */}
          <div className={cn(
            "flex items-center gap-3 p-3 rounded-lg",
            urgencyStats.critical > 0 ? "bg-red-100 dark:bg-red-900/30 animate-pulse" : "bg-muted/50"
          )}>
            <div className={cn(
              "p-2 rounded-full",
              urgencyStats.critical > 0 ? "bg-red-500 text-white" : "bg-muted"
            )}>
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <p className={cn(
                "text-2xl font-bold",
                urgencyStats.critical > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
              )}>
                {urgencyStats.critical}
              </p>
              <p className="text-xs text-muted-foreground">Crítico (+2h)</p>
            </div>
          </div>

          {/* Prioridade Alta */}
          <div className={cn(
            "flex items-center gap-3 p-3 rounded-lg",
            urgencyStats.danger > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-muted/50"
          )}>
            <div className={cn(
              "p-2 rounded-full",
              urgencyStats.danger > 0 ? "bg-red-400 text-white" : "bg-muted"
            )}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className={cn(
                "text-2xl font-bold",
                urgencyStats.danger > 0 ? "text-red-500 dark:text-red-400" : "text-muted-foreground"
              )}>
                {urgencyStats.danger}
              </p>
              <p className="text-xs text-muted-foreground">Prioridade (+30min)</p>
            </div>
          </div>

          {/* Atenção */}
          <div className={cn(
            "flex items-center gap-3 p-3 rounded-lg",
            urgencyStats.warning > 0 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-muted/50"
          )}>
            <div className={cn(
              "p-2 rounded-full",
              urgencyStats.warning > 0 ? "bg-amber-500 text-white" : "bg-muted"
            )}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className={cn(
                "text-2xl font-bold",
                urgencyStats.warning > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
              )}>
                {urgencyStats.warning}
              </p>
              <p className="text-xs text-muted-foreground">Atenção (+5min)</p>
            </div>
          </div>

          {/* Normal */}
          <div className={cn(
            "flex items-center gap-3 p-3 rounded-lg",
            urgencyStats.normal > 0 ? "bg-green-50 dark:bg-green-900/20" : "bg-muted/50"
          )}>
            <div className={cn(
              "p-2 rounded-full",
              urgencyStats.normal > 0 ? "bg-green-500 text-white" : "bg-muted"
            )}>
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className={cn(
                "text-2xl font-bold",
                urgencyStats.normal > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
              )}>
                {urgencyStats.normal}
              </p>
              <p className="text-xs text-muted-foreground">Normal (&lt;5min)</p>
            </div>
          </div>
        </div>

        {/* Total */}
        <div className="mt-4 pt-3 border-t flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total aguardando</span>
          <span className="text-lg font-bold">{totalAguardando}</span>
        </div>
      </CardContent>
    </Card>
  );
}
