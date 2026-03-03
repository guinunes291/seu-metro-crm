import { useEffect, useState } from "react";
import { Clock, AlertTriangle, Zap } from "lucide-react";

interface TimerLeadProps {
  timestampRecebimento: Date | string | null;
  timerAtivo: boolean;
  /** Mostrar barra de progresso (padrão: false) */
  showProgress?: boolean;
  /** Tamanho do componente: 'sm' | 'md' (padrão: 'sm') */
  size?: "sm" | "md";
}

/** Tempo total do timer em milissegundos (15 minutos) */
const TIMER_TOTAL_MS = 15 * 60 * 1000;

/**
 * Componente que exibe um cronômetro regressivo para leads com prazo de 15 minutos.
 * Mostra tempo restante, barra de progresso e alerta visual quando está próximo de expirar.
 */
export function TimerLead({
  timestampRecebimento,
  timerAtivo,
  showProgress = false,
  size = "sm",
}: TimerLeadProps) {
  const [tempoRestante, setTempoRestante] = useState<number>(TIMER_TOTAL_MS);
  const [expirado, setExpirado] = useState(false);

  useEffect(() => {
    if (!timerAtivo || !timestampRecebimento) {
      return;
    }

    const calcularTempoRestante = () => {
      const agora = new Date().getTime();
      const inicio = new Date(timestampRecebimento).getTime();
      const tempoDecorrido = agora - inicio;
      const restante = TIMER_TOTAL_MS - tempoDecorrido;

      if (restante <= 0) {
        setExpirado(true);
        setTempoRestante(0);
        return;
      }

      setTempoRestante(restante);
      setExpirado(false);
    };

    // Calcular imediatamente
    calcularTempoRestante();

    // Atualizar a cada segundo
    const interval = setInterval(calcularTempoRestante, 1000);

    return () => clearInterval(interval);
  }, [timestampRecebimento, timerAtivo]);

  if (!timerAtivo || !timestampRecebimento) {
    return null;
  }

  const minutos = Math.floor(tempoRestante / 60000);
  const segundos = Math.floor((tempoRestante % 60000) / 1000);
  const percentualRestante = Math.max(0, (tempoRestante / TIMER_TOTAL_MS) * 100);

  // Urgência baseada no tempo restante
  const isUrgente = tempoRestante < 3 * 60 * 1000; // < 3 min
  const isAtencao = tempoRestante < 7 * 60 * 1000; // < 7 min

  // Cores baseadas no tempo restante
  const getCorTimer = () => {
    if (expirado) return "text-red-700 bg-red-100 border-red-300";
    if (isUrgente) return "text-red-600 bg-red-50 border-red-200";
    if (isAtencao) return "text-orange-600 bg-orange-50 border-orange-200";
    return "text-blue-600 bg-blue-50 border-blue-200";
  };

  const getCorBarra = () => {
    if (expirado || isUrgente) return "bg-red-500";
    if (isAtencao) return "bg-orange-500";
    return "bg-blue-500";
  };

  const getIcone = () => {
    if (expirado) return <AlertTriangle className={size === "md" ? "w-4 h-4" : "w-3.5 h-3.5"} />;
    if (isUrgente) return <Zap className={size === "md" ? "w-4 h-4" : "w-3.5 h-3.5"} />;
    return <Clock className={size === "md" ? "w-4 h-4" : "w-3.5 h-3.5"} />;
  };

  const textSize = size === "md" ? "text-sm" : "text-xs";
  const padding = size === "md" ? "px-3 py-1.5" : "px-2 py-1";

  return (
    <div className="flex flex-col gap-1 w-full">
      <div
        className={`inline-flex items-center gap-1.5 ${padding} rounded-md border ${textSize} font-medium ${getCorTimer()} ${
          isUrgente && !expirado ? "animate-pulse" : ""
        }`}
        title={
          expirado
            ? "Timer expirado! Lead será redistribuído em breve"
            : `Tempo restante: ${minutos}m ${segundos}s — Lead será transferido automaticamente ao expirar`
        }
      >
        {getIcone()}
        <span className="font-mono tracking-tight">
          {expirado
            ? "Transferindo..."
            : `${minutos.toString().padStart(2, "0")}:${segundos.toString().padStart(2, "0")}`}
        </span>
        {!expirado && (
          <span className="opacity-60 font-normal">/ 15:00</span>
        )}
      </div>

      {showProgress && (
        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${getCorBarra()}`}
            style={{ width: `${percentualRestante}%` }}
          />
        </div>
      )}
    </div>
  );
}
