import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FunilVendasVisualProps {
  data: {
    novos: number;
    aguardando: number;
    emAtendimento: number;
    agendados: number;
    visitaRealizada: number;
    analiseCredito: number;
    contratoFechado: number;
    perdidos: number;
  };
  className?: string;
}

const FUNNEL_STAGES = [
  { key: "novos", label: "Novos", color: "bg-blue-500", textColor: "text-blue-600" },
  { key: "aguardando", label: "Aguardando", color: "bg-slate-500", textColor: "text-slate-600" },
  { key: "emAtendimento", label: "Em Atendimento", color: "bg-yellow-500", textColor: "text-yellow-600" },
  { key: "agendados", label: "Agendados", color: "bg-cyan-500", textColor: "text-cyan-600" },
  { key: "visitaRealizada", label: "Visita Realizada", color: "bg-orange-500", textColor: "text-orange-600" },
  { key: "analiseCredito", label: "Análise de Crédito", color: "bg-purple-500", textColor: "text-purple-600" },
  { key: "contratoFechado", label: "Contrato Fechado", color: "bg-green-500", textColor: "text-green-600" },
];

export default function FunilVendasVisual({ data, className }: FunilVendasVisualProps) {
  const maxValue = useMemo(() => {
    const values = FUNNEL_STAGES.map(stage => data[stage.key as keyof typeof data] || 0);
    return Math.max(...values, 1);
  }, [data]);

  const total = useMemo(() => {
    return FUNNEL_STAGES.reduce((sum, stage) => sum + (data[stage.key as keyof typeof data] || 0), 0);
  }, [data]);

  const taxaConversao = useMemo(() => {
    const novos = data.novos + data.aguardando;
    if (novos === 0) return 0;
    return ((data.contratoFechado / novos) * 100).toFixed(1);
  }, [data]);

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Funil de Vendas
          </CardTitle>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
            <p className="text-lg font-bold text-green-600">{taxaConversao}%</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Funil Visual */}
          <div className="space-y-1">
            {FUNNEL_STAGES.map((stage, index) => {
              const value = data[stage.key as keyof typeof data] || 0;
              const widthPercent = Math.max(20, (value / maxValue) * 100);
              // Criar efeito de funil - cada nível é ligeiramente menor
              const funnelWidth = 100 - (index * 8);
              const actualWidth = Math.min(widthPercent, funnelWidth);
              
              return (
                <div key={stage.key} className="flex items-center gap-3">
                  {/* Barra do funil */}
                  <div 
                    className="relative h-10 flex items-center justify-center transition-all duration-500"
                    style={{ 
                      width: `${funnelWidth}%`,
                      marginLeft: `${(100 - funnelWidth) / 2}%`
                    }}
                  >
                    {/* Background da barra */}
                    <div 
                      className={cn(
                        "absolute inset-0 rounded-md opacity-20",
                        stage.color
                      )}
                    />
                    {/* Barra preenchida */}
                    <div 
                      className={cn(
                        "absolute left-0 top-0 bottom-0 rounded-md transition-all duration-700",
                        stage.color
                      )}
                      style={{ 
                        width: value > 0 ? `${(value / maxValue) * 100}%` : '0%',
                        maxWidth: '100%'
                      }}
                    />
                    {/* Texto */}
                    <div className="relative z-10 flex items-center justify-between w-full px-3">
                      <span className="text-sm font-medium text-white drop-shadow-md">
                        {stage.label}
                      </span>
                      <span className="text-sm font-bold text-white drop-shadow-md">
                        {value}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Perdidos (fora do funil) */}
          <div className="mt-4 pt-3 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm text-muted-foreground">Perdidos</span>
              </div>
              <span className="text-lg font-bold text-red-600">{data.perdidos}</span>
            </div>
          </div>

          {/* Resumo */}
          <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">Total no Funil</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{data.contratoFechado}</p>
              <p className="text-xs text-muted-foreground">Contratos Fechados</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
