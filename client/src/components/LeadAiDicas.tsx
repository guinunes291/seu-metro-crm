import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Sparkles, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, Lightbulb, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadAiDicasProps {
  leadId: number;
  className?: string;
}

const TIPO_CONFIG = {
  alerta: {
    icon: AlertTriangle,
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-800 dark:text-amber-300",
    iconColor: "text-amber-500",
  },
  oportunidade: {
    icon: Lightbulb,
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-800 dark:text-blue-300",
    iconColor: "text-blue-500",
  },
  acao: {
    icon: Target,
    bg: "bg-green-50 dark:bg-green-950/30",
    border: "border-green-200 dark:border-green-800",
    text: "text-green-800 dark:text-green-300",
    iconColor: "text-green-500",
  },
};

const PRIORIDADE_CONFIG = {
  alta: { label: "Alta prioridade", color: "text-red-600 dark:text-red-400" },
  media: { label: "Prioridade média", color: "text-amber-600 dark:text-amber-400" },
  baixa: { label: "Baixa prioridade", color: "text-green-600 dark:text-green-400" },
};

export function LeadAiDicas({ leadId, className }: LeadAiDicasProps) {
  const [expanded, setExpanded] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const { data, isLoading, refetch, isRefetching } = trpc.ia.dicasRapidas.useQuery(
    { leadId },
    {
      enabled,
      staleTime: 5 * 60 * 1000, // Cache por 5 minutos
      retry: 1,
    }
  );

  const handleToggle = () => {
    if (!enabled) {
      setEnabled(true);
      setExpanded(true);
    } else {
      setExpanded((prev) => !prev);
    }
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    refetch();
  };

  const loading = isLoading || isRefetching;

  return (
    <div className={cn("mt-3 pt-3 border-t border-dashed", className)}>
      {/* Botão de toggle */}
      <button
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
      >
        <Sparkles className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
        <span className="font-medium text-purple-600 dark:text-purple-400">
          {!enabled ? "Ver dicas da IA" : data?.resumo_curto || "Dicas da IA"}
        </span>
        {enabled && data && (
          <span className={cn("text-xs ml-1", PRIORIDADE_CONFIG[data.prioridade as keyof typeof PRIORIDADE_CONFIG]?.color)}>
            · {PRIORIDADE_CONFIG[data.prioridade as keyof typeof PRIORIDADE_CONFIG]?.label}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {enabled && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 p-0 hover:bg-transparent"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={cn("h-3 w-3 text-muted-foreground", loading && "animate-spin")} />
            </Button>
          )}
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </span>
      </button>

      {/* Conteúdo expandido */}
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {loading ? (
            <div className="flex items-center gap-2 py-2 px-3 rounded-md bg-muted/50">
              <Sparkles className="h-3.5 w-3.5 text-purple-400 animate-pulse" />
              <span className="text-xs text-muted-foreground">Analisando lead...</span>
            </div>
          ) : data?.dicas && data.dicas.length > 0 ? (
            data.dicas.map((dica, idx) => {
              const config = TIPO_CONFIG[dica.tipo as keyof typeof TIPO_CONFIG] || TIPO_CONFIG.acao;
              const Icon = config.icon;
              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start gap-2 px-2.5 py-2 rounded-md border text-xs",
                    config.bg,
                    config.border
                  )}
                >
                  <span className="text-sm leading-none mt-0.5 flex-shrink-0">{dica.emoji}</span>
                  <span className={cn("leading-relaxed", config.text)}>{dica.texto}</span>
                </div>
              );
            })
          ) : (
            <div className="text-xs text-muted-foreground px-2 py-1">
              Nenhuma dica disponível no momento.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
