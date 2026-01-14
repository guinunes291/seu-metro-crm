import { useEffect, useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";

interface TimerLeadProps {
  timestampRecebimento: Date | string | null;
  timerAtivo: boolean;
}

/**
 * Componente que exibe um timer regressivo para leads com prazo de 5 minutos
 * Mostra tempo restante e alerta visual quando está próximo de expirar
 */
export function TimerLead({ timestampRecebimento, timerAtivo }: TimerLeadProps) {
  const [tempoRestante, setTempoRestante] = useState<number>(0);
  const [expirado, setExpirado] = useState(false);

  useEffect(() => {
    if (!timerAtivo || !timestampRecebimento) {
      return;
    }

    const calcularTempoRestante = () => {
      const agora = new Date().getTime();
      const inicio = new Date(timestampRecebimento).getTime();
      const cincoMinutos = 5 * 60 * 1000; // 5 minutos em ms
      const tempoDecorrido = agora - inicio;
      const restante = cincoMinutos - tempoDecorrido;

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

  // Cores baseadas no tempo restante
  const getCorTimer = () => {
    if (expirado) return "text-red-600 bg-red-50 border-red-200";
    if (tempoRestante < 60000) return "text-orange-600 bg-orange-50 border-orange-200"; // < 1min
    if (tempoRestante < 120000) return "text-yellow-600 bg-yellow-50 border-yellow-200"; // < 2min
    return "text-blue-600 bg-blue-50 border-blue-200";
  };

  const getIcone = () => {
    if (expirado || tempoRestante < 60000) {
      return <AlertTriangle className="w-3.5 h-3.5" />;
    }
    return <Clock className="w-3.5 h-3.5" />;
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium ${getCorTimer()}`}
      title={expirado ? "Timer expirado! Lead será redistribuído" : `Tempo restante para trabalhar este lead`}
    >
      {getIcone()}
      <span className="font-mono">
        {expirado ? "EXPIRADO" : `${minutos}:${segundos.toString().padStart(2, "0")}`}
      </span>
    </div>
  );
}
