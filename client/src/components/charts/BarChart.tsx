import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface BarChartProps {
  data: any[];
  dataKeys: { key: string; name: string; color?: string }[];
  xAxisKey: string;
  title?: string;
  description?: string;
  layout?: 'horizontal' | 'vertical';
  height?: number;
}

export function BarChart({ 
  data, 
  dataKeys, 
  xAxisKey, 
  title, 
  description, 
  layout = 'horizontal',
  height = 300 
}: BarChartProps) {
  const colors = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

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
          <RechartsBarChart 
            data={data} 
            layout={layout}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            {layout === 'horizontal' ? (
              <>
                <XAxis dataKey={xAxisKey} />
                <YAxis />
              </>
            ) : (
              <>
                <XAxis type="number" />
                <YAxis dataKey={xAxisKey} type="category" width={150} />
              </>
            )}
            <Tooltip />
            <Legend />
            {dataKeys.map((dk, index) => (
              <Bar 
                key={dk.key} 
                dataKey={dk.key} 
                name={dk.name}
                fill={dk.color || colors[index % colors.length]} 
              />
            ))}
          </RechartsBarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
