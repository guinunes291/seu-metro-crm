import { useEffect, useRef, useState } from "react";
import { Clock, AlertTriangle, Zap } from "lucide-react";
import { enviarNotificacaoLead } from "@/hooks/useNotificacaoLead";

interface TimerLeadProps {
  timestampRecebimento: Date | string | null;
  timerAtivo: boolean;
  /** Origem do lead — timer só é exibido para leads de webhook (Facebook ADS) */
  origem?: string | null;
  /** Nome do cliente para exibir na notificação do navegador */
  nomeCliente?: string;
  /** ID do lead para evitar notificações duplicadas */
  leadId?: number;
  /** Mostrar barra de progresso (padrão: false) */
  showProgress?: boolean;
  /** Tamanho do componente: 'sm' | 'md' (padrão: 'sm') */
  size?: "sm" | "md";
  /**
   * Se true, habilita notificações do navegador para este lead.
   * DEVE ser true apenas quando o usuário logado for role=corretor.
   */
  isCorretor?: boolean;
  /** @deprecated Não utilizado. Timer conta apenas desde timestampRecebimento. */
  ultimaInteracao?: Date | string | null;
}

/** Tempo total do timer em milissegundos (30 minutos) */
const TIMER_TOTAL_MS = 30 * 60 * 1000;
/** Limite de urgência para notificação do navegador (3 minutos) */
const LIMITE_URGENCIA_MS = 3 * 60 * 1000;

/** Verifica se a origem é de um lead Facebook ADS (webhook) */
function isLeadFacebookADS(origem?: string | null): boolean {
  if (!origem) return false;
  const o = origem.toLowerCase();
  return o.includes("webhook") || o.includes("facebook") || o.includes("fb") || o.includes("ads");
}

/**
 * Componente que exibe um cronômetro regressivo para leads Facebook ADS.
 * Regra: lead ADS chegou → 30 min a partir de timestampRecebimento → se não entrou em
 * "em_atendimento", o job de backend transfere automaticamente.
 * O timer visual reflete esse prazo contando desde timestampRecebimento.
 */
export function TimerLead({
  timestampRecebimento,
  timerAtivo,
  origem,
  nomeCliente,
  leadId,
  showProgress = false,
  size = "sm",
  isCorretor = false,
}: TimerLeadProps) {
  const [tempoRestante, setTempoRestante] = useState<number>(TIMER_TOTAL_MS);
  const [expirado, setExpirado] = useState(false);

  // Flag para evitar notificação duplicada
  const notificacaoEnviada = useRef(false);

  // Resetar flag quando o lead/timer mudar
  useEffect(() => {
    notificacaoEnviada.current = false;
  }, [leadId, timerAtivo, timestampRecebimento]);

  useEffect(() => {
    if (!timerAtivo || !timestampRecebimento) return;

    const calcularTempoRestante = () => {
      const agora = new Date().getTime();
      // Timer conta SEMPRE desde timestampRecebimento — sem considerar interações
      const recebidoEm = new Date(timestampRecebimento).getTime();
      const tempoDecorrido = agora - recebidoEm;
      const restante = TIMER_TOTAL_MS - tempoDecorrido;

      if (restante <= 0) {
        setExpirado(true);
        setTempoRestante(0);
        return;
      }

      setTempoRestante(restante);
      setExpirado(false);

      const isUrgente = restante <= LIMITE_URGENCIA_MS;

      // Notificação do navegador apenas para corretor (sem som)
      if (isUrgente && isLeadFacebookADS(origem) && !notificacaoEnviada.current && isCorretor) {
        notificacaoEnviada.current = true;
        enviarNotificacaoLead({
          nomeCliente: nomeCliente || "Cliente",
          tempoRestanteMs: restante,
          leadId: leadId ?? 0,
        });
      }
    };

    calcularTempoRestante();
    const interval = setInterval(calcularTempoRestante, 1000);
    return () => clearInterval(interval);
  }, [timestampRecebimento, timerAtivo, origem, nomeCliente, leadId, isCorretor]);

  // Exibir somente para leads Facebook ADS (webhook)
  if (!timerAtivo || !timestampRecebimento || !isLeadFacebookADS(origem)) {
    return null;
  }

  const minutos = Math.floor(tempoRestante / 60000);
  const segundos = Math.floor((tempoRestante % 60000) / 1000);
  const percentualRestante = Math.max(0, (tempoRestante / TIMER_TOTAL_MS) * 100);

  const isUrgente = tempoRestante < LIMITE_URGENCIA_MS;
  const isAtencao = tempoRestante < 7 * 60 * 1000;

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
            ? "Timer expirado — lead será redistribuído em breve"
            : `Tempo restante: ${minutos}m ${segundos}s — Lead transferido automaticamente ao expirar sem atendimento`
        }
      >
        {getIcone()}
        <span className="font-mono tracking-tight">
          {expirado
            ? "Transferindo..."
            : `${minutos.toString().padStart(2, "0")}:${segundos.toString().padStart(2, "0")}`}
        </span>
        {!expirado && (
          <span className="opacity-60 font-normal">/ 30:00</span>
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
