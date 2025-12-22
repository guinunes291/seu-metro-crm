import { useEffect, useState } from "react";
import { Clock, AlertTriangle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface LeadTimerProps {
  createdAt: Date | string;
  status: string;
  className?: string;
  showIcon?: boolean;
  compact?: boolean;
}

// Configurações de tempo (em minutos)
const TEMPO_ALERTA_AMARELO_MIN = 5; // 5 minutos
const TEMPO_ALERTA_VERMELHO_MIN = 30; // 30 minutos
const TEMPO_CRITICO_MIN = 120; // 2 horas (120 minutos)

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return "Agora";
}

function getTimerStatus(minutesWaiting: number): {
  level: "normal" | "warning" | "danger" | "critical";
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof Clock;
  message: string;
} {
  if (minutesWaiting >= TEMPO_CRITICO_MIN) {
    return {
      level: "critical",
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-100 dark:bg-red-900/30",
      borderColor: "border-red-500",
      icon: AlertCircle,
      message: "URGENTE! Lead aguardando há mais de 2h",
    };
  }
  if (minutesWaiting >= TEMPO_ALERTA_VERMELHO_MIN) {
    return {
      level: "danger",
      color: "text-red-500 dark:text-red-400",
      bgColor: "bg-red-50 dark:bg-red-900/20",
      borderColor: "border-red-400",
      icon: AlertTriangle,
      message: "Lead aguardando há mais de 30min - Prioridade alta",
    };
  }
  if (minutesWaiting >= TEMPO_ALERTA_AMARELO_MIN) {
    return {
      level: "warning",
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-900/20",
      borderColor: "border-amber-400",
      icon: AlertTriangle,
      message: "Lead aguardando há mais de 5min - Atenção",
    };
  }
  return {
    level: "normal",
    color: "text-muted-foreground",
    bgColor: "",
    borderColor: "",
    icon: Clock,
    message: "Tempo de espera normal",
  };
}

export default function LeadTimer({
  createdAt,
  status,
  className,
  showIcon = true,
  compact = false,
}: LeadTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const created = new Date(createdAt).getTime();
    
    const updateElapsed = () => {
      setElapsed(Date.now() - created);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 60000); // Atualiza a cada minuto

    return () => clearInterval(interval);
  }, [createdAt]);

  // Não mostrar timer para leads já atendidos ou finalizados
  const statusFinalizados = ["em_atendimento", "contrato_fechado", "perdido", "cancelado"];
  if (statusFinalizados.includes(status)) {
    return null;
  }

  const minutesWaiting = elapsed / (1000 * 60);
  const timerStatus = getTimerStatus(minutesWaiting);
  const Icon = timerStatus.icon;
  const duration = formatDuration(elapsed);

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded",
                timerStatus.bgColor,
                timerStatus.color,
                className
              )}
            >
              {showIcon && <Icon className="h-3 w-3" />}
              {duration}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{timerStatus.message}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 text-sm font-medium px-2 py-1 rounded-md",
              timerStatus.bgColor,
              timerStatus.color,
              timerStatus.level !== "normal" && "animate-pulse",
              className
            )}
          >
            {showIcon && <Icon className="h-4 w-4" />}
            <span>Aguardando: {duration}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{timerStatus.message}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Componente para badge de urgência (para usar em cards/listas)
export function LeadUrgencyBadge({
  createdAt,
  status,
}: {
  createdAt: Date | string;
  status: string;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const created = new Date(createdAt).getTime();
    setElapsed(Date.now() - created);
    
    const interval = setInterval(() => {
      setElapsed(Date.now() - created);
    }, 60000);

    return () => clearInterval(interval);
  }, [createdAt]);

  // Não mostrar para leads já atendidos
  const statusFinalizados = ["em_atendimento", "contrato_fechado", "perdido", "cancelado"];
  if (statusFinalizados.includes(status)) {
    return null;
  }

  const minutesWaiting = elapsed / (1000 * 60);
  
  if (minutesWaiting < TEMPO_ALERTA_AMARELO_MIN) {
    return null;
  }

  const timerStatus = getTimerStatus(minutesWaiting);
  const Icon = timerStatus.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "absolute -top-1 -right-1 p-1 rounded-full",
              timerStatus.bgColor,
              timerStatus.level === "critical" && "animate-bounce"
            )}
          >
            <Icon className={cn("h-4 w-4", timerStatus.color)} />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{timerStatus.message}</p>
          <p className="text-xs text-muted-foreground">
            Aguardando há {formatDuration(elapsed)}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Hook para obter status de urgência
export function useLeadUrgency(createdAt: Date | string, status: string) {
  const [urgency, setUrgency] = useState<ReturnType<typeof getTimerStatus> | null>(null);

  useEffect(() => {
    const statusFinalizados = ["em_atendimento", "contrato_fechado", "perdido", "cancelado"];
    if (statusFinalizados.includes(status)) {
      setUrgency(null);
      return;
    }

    const created = new Date(createdAt).getTime();
    
    const updateUrgency = () => {
      const elapsed = Date.now() - created;
      const minutesWaiting = elapsed / (1000 * 60);
      setUrgency(getTimerStatus(minutesWaiting));
    };

    updateUrgency();
    const interval = setInterval(updateUrgency, 60000);

    return () => clearInterval(interval);
  }, [createdAt, status]);

  return urgency;
}
