import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScatterChart as RechartsScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ZAxis } from 'recharts';

interface ScatterChartProps {
  data: any[];
  xKey: string;
  yKey: string;
  zKey?: string;
  nameKey?: string;
  title?: string;
  description?: string;
  xLabel?: string;
  yLabel?: string;
  height?: number;
}

export function ScatterChart({ 
  data, 
  xKey, 
  yKey, 
  zKey,
  nameKey,
  title, 
  description,
  xLabel,
  yLabel,
  height = 300 
}: ScatterChartProps) {
  return (
    <Card>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <RechartsScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid />
            <XAxis 
              type="number" 
              dataKey={xKey} 
              name={xLabel || xKey}
              label={{ value: xLabel || xKey, position: 'insideBottom', offset: -10 }}
            />
            <YAxis 
              type="number" 
              dataKey={yKey} 
              name={yLabel || yKey}
              label={{ value: yLabel || yKey, angle: -90, position: 'insideLeft' }}
            />
            {zKey && <ZAxis type="number" dataKey={zKey} range={[60, 400]} />}
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Legend />
            <Scatter 
              name={title || "Dados"} 
              data={data} 
              fill="hsl(var(--primary))"
            />
          </RechartsScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
