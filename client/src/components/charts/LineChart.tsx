import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface LineChartProps {
  data: any[];
  dataKeys: { key: string; name: string; color?: string }[];
  xAxisKey: string;
  title?: string;
  description?: string;
  height?: number;
}

export function LineChart({ 
  data, 
  dataKeys, 
  xAxisKey, 
  title, 
  description, 
  height = 300 
}: LineChartProps) {
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
          <RechartsLineChart 
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            {dataKeys.map((dk, index) => (
              <Line 
                key={dk.key} 
                type="monotone"
                dataKey={dk.key} 
                name={dk.name}
                stroke={dk.color || colors[index % colors.length]}
                strokeWidth={2}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
