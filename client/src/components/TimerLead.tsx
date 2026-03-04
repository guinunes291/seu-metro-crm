import { useEffect, useRef, useState } from "react";
import { Clock, AlertTriangle, Zap } from "lucide-react";
import { enviarNotificacaoLead } from "@/hooks/useNotificacaoLead";
import {
  initAudio,
  playAlertaUrgencia,
  playLembrete,
  playAlertaExpiracao,
} from "@/lib/timerSound";

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
}

/** Tempo total do timer em milissegundos (15 minutos) */
const TIMER_TOTAL_MS = 15 * 60 * 1000;
/** Limite de urgência para notificação e alerta sonoro (3 minutos) */
const LIMITE_URGENCIA_MS = 3 * 60 * 1000;
/** Intervalo de lembrete sonoro periódico nos últimos 3 minutos (30 segundos) */
const INTERVALO_LEMBRETE_MS = 30 * 1000;

/** Verifica se a origem é de um lead Facebook ADS (webhook) */
function isLeadFacebookADS(origem?: string | null): boolean {
  if (!origem) return false;
  const o = origem.toLowerCase();
  return o.includes("webhook") || o.includes("facebook") || o.includes("fb") || o.includes("ads");
}

/**
 * Componente que exibe um cronômetro regressivo para leads Facebook ADS com prazo de 15 minutos.
 * Dispara notificação nativa do navegador e alerta sonoro quando entrar nos últimos 3 minutos.
 *
 * Alertas sonoros (Web Audio API — sem arquivos externos):
 *  - Ao entrar nos últimos 3 min: 3 beeps ascendentes (alerta de atenção)
 *  - A cada 30s nos últimos 3 min: 1 beep de lembrete
 *  - Ao expirar: 5 beeps descendentes urgentes
 */
export function TimerLead({
  timestampRecebimento,
  timerAtivo,
  origem,
  nomeCliente,
  leadId,
  showProgress = false,
  size = "sm",
}: TimerLeadProps) {
  const [tempoRestante, setTempoRestante] = useState<number>(TIMER_TOTAL_MS);
  const [expirado, setExpirado] = useState(false);

  // Flags para evitar disparos duplicados
  const notificacaoEnviada = useRef(false);
  const alertaSonoroUrgenciaEnviado = useRef(false);
  const alertaSonoroExpiracaoEnviado = useRef(false);
  // Timestamp do último lembrete periódico
  const ultimoLembreteMs = useRef<number>(0);

  // Inicializar AudioContext na primeira interação do usuário com a página
  useEffect(() => {
    const handler = () => initAudio();
    window.addEventListener("click", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("keydown", handler);
    };
  }, []);

  // Resetar flags quando o lead/timer mudar
  useEffect(() => {
    notificacaoEnviada.current = false;
    alertaSonoroUrgenciaEnviado.current = false;
    alertaSonoroExpiracaoEnviado.current = false;
    ultimoLembreteMs.current = 0;
  }, [leadId, timerAtivo, timestampRecebimento]);

  useEffect(() => {
    if (!timerAtivo || !timestampRecebimento) return;

    const calcularTempoRestante = () => {
      const agora = new Date().getTime();
      const inicio = new Date(timestampRecebimento).getTime();
      const tempoDecorrido = agora - inicio;
      const restante = TIMER_TOTAL_MS - tempoDecorrido;

      if (restante <= 0) {
        setExpirado(true);
        setTempoRestante(0);

        // Alerta sonoro de expiração (apenas uma vez)
        if (!alertaSonoroExpiracaoEnviado.current && isLeadFacebookADS(origem)) {
          alertaSonoroExpiracaoEnviado.current = true;
          playAlertaExpiracao();
        }
        return;
      }

      setTempoRestante(restante);
      setExpirado(false);

      const isUrgente = restante <= LIMITE_URGENCIA_MS;

      if (isUrgente && isLeadFacebookADS(origem)) {
        // ── Notificação do navegador (apenas uma vez) ──────────────────────
        if (!notificacaoEnviada.current) {
          notificacaoEnviada.current = true;
          enviarNotificacaoLead({
            nomeCliente: nomeCliente || "Cliente",
            tempoRestanteMs: restante,
            leadId: leadId ?? 0,
          });
        }

        // ── Alerta sonoro de entrada nos últimos 3 min (apenas uma vez) ───
        if (!alertaSonoroUrgenciaEnviado.current) {
          alertaSonoroUrgenciaEnviado.current = true;
          playAlertaUrgencia();
          ultimoLembreteMs.current = agora;
        }

        // ── Lembrete periódico a cada 30s ──────────────────────────────────
        if (
          ultimoLembreteMs.current > 0 &&
          agora - ultimoLembreteMs.current >= INTERVALO_LEMBRETE_MS
        ) {
          ultimoLembreteMs.current = agora;
          playLembrete();
        }
      }
    };

    // Calcular imediatamente
    calcularTempoRestante();

    // Atualizar a cada segundo
    const interval = setInterval(calcularTempoRestante, 1000);
    return () => clearInterval(interval);
  }, [timestampRecebimento, timerAtivo, origem, nomeCliente, leadId]);

  // Exibir somente para leads Facebook ADS (webhook)
  if (!timerAtivo || !timestampRecebimento || !isLeadFacebookADS(origem)) {
    return null;
  }

  const minutos = Math.floor(tempoRestante / 60000);
  const segundos = Math.floor((tempoRestante % 60000) / 1000);
  const percentualRestante = Math.max(0, (tempoRestante / TIMER_TOTAL_MS) * 100);

  // Urgência baseada no tempo restante
  const isUrgente = tempoRestante < LIMITE_URGENCIA_MS; // < 3 min
  const isAtencao = tempoRestante < 7 * 60 * 1000;      // < 7 min

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
