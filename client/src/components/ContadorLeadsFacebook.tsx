/**
 * ContadorLeadsFacebook
 * Widget flutuante visível apenas para corretores.
 * Exibe dois contadores diários:
 *  - Leads Facebook recebidos hoje
 *  - Leads perdidos hoje por timeout de 15 minutos
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Facebook, TrendingDown, TrendingUp, X, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ContadorLeadsFacebookProps {
  /** Apenas renderiza para corretores */
  isCorretor: boolean;
}

export function ContadorLeadsFacebook({ isCorretor }: ContadorLeadsFacebookProps) {
  const [minimizado, setMinimizado] = useState(false);
  const [fechado, setFechado] = useState(false);

  const { data, isLoading, refetch, isFetching } = trpc.leads.metricasDiarias.useQuery(undefined, {
    enabled: isCorretor,
    // Atualiza a cada 2 minutos
    refetchInterval: 2 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  // Não renderiza se não for corretor ou se o widget foi fechado
  if (!isCorretor || fechado) return null;

  const recebidos = data?.recebidosHoje ?? 0;
  const perdidos = data?.perdidosPorTimeout ?? 0;

  if (minimizado) {
    return (
      <TooltipProvider>
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-1.5 bg-background border border-border rounded-full shadow-lg px-3 py-2 cursor-pointer hover:shadow-xl transition-all"
          onClick={() => setMinimizado(false)}
        >
          <Facebook className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-bold text-green-600">+{recebidos}</span>
          {perdidos > 0 && (
            <>
              <span className="text-muted-foreground text-xs">/</span>
              <span className="text-xs font-bold text-red-500">-{perdidos}</span>
            </>
          )}
          <ChevronUp className="h-3 w-3 text-muted-foreground" />
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="fixed bottom-6 right-6 z-50 w-56 bg-background border border-border rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-blue-500/10 border-b border-blue-500/20">
          <div className="flex items-center gap-1.5">
            <Facebook className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
              Leads Facebook
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="p-0.5 rounded hover:bg-blue-500/20 transition-colors"
                >
                  <RefreshCw className={cn("h-3 w-3 text-muted-foreground", isFetching && "animate-spin")} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Atualizar</TooltipContent>
            </Tooltip>
            <button
              onClick={() => setMinimizado(true)}
              className="p-0.5 rounded hover:bg-blue-500/20 transition-colors"
            >
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
            <button
              onClick={() => setFechado(true)}
              className="p-0.5 rounded hover:bg-red-500/20 transition-colors"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Contadores */}
        <div className="p-3 space-y-2">
          {/* Recebidos hoje */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-between p-2 rounded-lg bg-green-500/10 border border-green-500/20 cursor-default">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-muted-foreground">Recebidos hoje</span>
                </div>
                {isLoading ? (
                  <div className="h-5 w-8 bg-muted animate-pulse rounded" />
                ) : (
                  <span className="text-base font-bold text-green-600">{recebidos}</span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs max-w-[180px]">
              Leads Facebook (via webhook) distribuídos para você hoje
            </TooltipContent>
          </Tooltip>

          {/* Perdidos por timeout */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(
                "flex items-center justify-between p-2 rounded-lg border cursor-default transition-colors",
                perdidos > 0
                  ? "bg-red-500/10 border-red-500/20"
                  : "bg-muted/30 border-border"
              )}>
                <div className="flex items-center gap-2">
                  <TrendingDown className={cn("h-4 w-4", perdidos > 0 ? "text-red-500" : "text-muted-foreground")} />
                  <span className="text-xs text-muted-foreground">Perdidos (15 min)</span>
                </div>
                {isLoading ? (
                  <div className="h-5 w-8 bg-muted animate-pulse rounded" />
                ) : (
                  <span className={cn(
                    "text-base font-bold",
                    perdidos > 0 ? "text-red-500" : "text-muted-foreground"
                  )}>
                    {perdidos}
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs max-w-[180px]">
              Leads Facebook redistribuídos automaticamente por falta de atendimento em 15 minutos
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Footer com data */}
        <div className="px-3 pb-2">
          <p className="text-[10px] text-muted-foreground text-center">
            Hoje · Atualiza a cada 2 min
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
}
