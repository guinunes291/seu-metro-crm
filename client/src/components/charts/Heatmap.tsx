import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface HeatmapData {
  diaSemana: number;
  hora: number;
  quantidade: number;
}

interface HeatmapProps {
  data: HeatmapData[];
  title?: string;
  description?: string;
}

const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function Heatmap({ data, title = "Mapa de Calor", description }: HeatmapProps) {
  // Criar matriz 7x24 (dias x horas)
  const matrix: number[][] = Array(7).fill(0).map(() => Array(24).fill(0));
  
  // Preencher matriz com dados
  data.forEach(d => {
    if (d.diaSemana >= 1 && d.diaSemana <= 7 && d.hora >= 0 && d.hora < 24) {
      matrix[d.diaSemana - 1][d.hora] = d.quantidade;
    }
  });

  // Encontrar máximo para normalização de cores
  const maxValue = Math.max(...data.map(d => d.quantidade), 1);

  const getColor = (value: number) => {
    if (value === 0) return 'hsl(var(--muted))';
    const intensity = value / maxValue;
    return `hsl(var(--primary) / ${0.2 + intensity * 0.8})`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Header com horas */}
            <div className="flex">
              <div className="w-12"></div>
              {Array.from({ length: 24 }, (_, i) => (
                <div key={i} className="w-8 text-center text-xs text-muted-foreground">
                  {i}h
                </div>
              ))}
            </div>
            
            {/* Linhas de dias */}
            {matrix.map((row, dayIndex) => (
              <div key={dayIndex} className="flex items-center">
                <div className="w-12 text-xs font-medium text-muted-foreground">
                  {diasSemana[dayIndex]}
                </div>
                {row.map((value, hourIndex) => (
                  <div
                    key={hourIndex}
                    className="w-8 h-8 m-0.5 rounded flex items-center justify-center text-xs font-medium transition-colors"
                    style={{ backgroundColor: getColor(value) }}
                    title={`${diasSemana[dayIndex]} ${hourIndex}h: ${value} leads`}
                  >
                    {value > 0 && value}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        
        {/* Legenda */}
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <span>Menos</span>
          <div className="flex gap-1">
            {[0, 0.25, 0.5, 0.75, 1].map((intensity, i) => (
              <div
                key={i}
                className="w-4 h-4 rounded"
                style={{ 
                  backgroundColor: intensity === 0 
                    ? 'hsl(var(--muted))' 
                    : `hsl(var(--primary) / ${0.2 + intensity * 0.8})` 
                }}
              />
            ))}
          </div>
          <span>Mais</span>
        </div>
      </CardContent>
    </Card>
  );
}
