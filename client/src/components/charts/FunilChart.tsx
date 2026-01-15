import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface FunilData {
  status: string;
  count: number;
  taxaConversao: number;
}

interface FunilChartProps {
  data: FunilData[];
  title?: string;
  description?: string;
}

const statusLabels: Record<string, string> = {
  'novo': 'Novo',
  'aguardando_atendimento': 'Aguardando',
  'em_atendimento': 'Em Atendimento',
  'agendado': 'Agendado',
  'visita_realizada': 'Visita Realizada',
  'analise_credito': 'Análise de Crédito',
  'contrato_fechado': 'Contrato Fechado',
  'perdido': 'Perdido'
};

export function FunilChart({ data, title = "Funil de Conversão", description }: FunilChartProps) {
  const maxCount = Math.max(...data.map(d => d.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((etapa, index) => {
            const widthPercent = maxCount > 0 ? (etapa.count / maxCount) * 100 : 0;
            const isLost = etapa.status === 'perdido';

            return (
              <div key={etapa.status} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{statusLabels[etapa.status] || etapa.status}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">{etapa.count} leads</span>
                    {index > 0 && !isLost && (
                      <span className="text-xs text-muted-foreground">
                        {etapa.taxaConversao.toFixed(1)}% do anterior
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative h-12 bg-muted rounded-lg overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 flex items-center justify-center transition-all ${
                      isLost 
                        ? 'bg-destructive/80' 
                        : 'bg-gradient-to-r from-primary/80 to-primary'
                    }`}
                    style={{ width: `${widthPercent}%` }}
                  >
                    {widthPercent > 15 && (
                      <span className="text-sm font-semibold text-primary-foreground">
                        {etapa.count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
