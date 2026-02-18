import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  ComposedChart,
} from "recharts";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Calendar,
  Target,
  Phone,
  Eye,
  FileCheck,
  CheckCircle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Cores para cada corretor nos gráficos
const CORES_CORRETORES = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#f97316", "#14b8a6", "#6366f1",
  "#84cc16", "#a855f7", "#0ea5e9", "#e11d48", "#10b981",
];

// Cores para métricas
const CORES_METRICAS = {
  leadsRecebidos: "#3b82f6",
  leadsContatados: "#22c55e",
  agendamentos: "#06b6d4",
  visitas: "#f59e0b",
  analisesCredito: "#8b5cf6",
  contratosFechados: "#ef4444",
};

interface TrendIndicatorProps {
  current: number;
  previous: number;
  suffix?: string;
}

function TrendIndicator({ current, previous, suffix = "" }: TrendIndicatorProps) {
  if (previous === 0 && current === 0) return <Minus className="h-3 w-3 text-muted-foreground" />;
  if (previous === 0) return <ArrowUpRight className="h-3 w-3 text-green-500" />;
  
  const diff = ((current - previous) / previous) * 100;
  
  if (diff > 0) {
    return (
      <span className="flex items-center text-xs text-green-600 font-medium">
        <ArrowUpRight className="h-3 w-3" />
        +{diff.toFixed(0)}%{suffix}
      </span>
    );
  } else if (diff < 0) {
    return (
      <span className="flex items-center text-xs text-red-600 font-medium">
        <ArrowDownRight className="h-3 w-3" />
        {diff.toFixed(0)}%{suffix}
      </span>
    );
  }
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

export default function PerformanceSemanal() {
  const [numSemanas, setNumSemanas] = useState(8);
  const [metricaSelecionada, setMetricaSelecionada] = useState<string>("leadsRecebidos");
  const [tabAtiva, setTabAtiva] = useState("evolucao");

  const { data: performanceData, isLoading } = trpc.graficos.performanceSemanal.useQuery(
    { numSemanas },
    { 
      staleTime: 5 * 60 * 1000, // 5 minutos
      refetchOnWindowFocus: false,
    }
  );

  // Preparar dados para gráfico de evolução geral (totais)
  const dadosEvolucaoGeral = useMemo(() => {
    if (!performanceData?.totaisPorSemana) return [];
    return performanceData.totaisPorSemana.map(s => ({
      semana: s.semana,
      "Leads Recebidos": s.leadsRecebidos,
      "Contatados": s.leadsContatados,
      "Agendamentos": s.agendamentos,
      "Visitas": s.visitas,
      "Análise Crédito": s.analisesCredito,
      "Contratos": s.contratosFechados,
      "Taxa Conversão (%)": s.taxaConversao,
    }));
  }, [performanceData]);

  // Preparar dados para gráfico comparativo por corretor
  const dadosComparativoCorretores = useMemo(() => {
    if (!performanceData?.corretores || !performanceData?.semanas) return [];
    
    return performanceData.semanas.map((semana, idx) => {
      const ponto: any = { semana };
      for (const corretor of performanceData.corretores) {
        const s = corretor.semanas[idx];
        if (s) {
          const key = metricaSelecionada as keyof typeof s;
          ponto[corretor.corretorNome] = s[key] || 0;
        }
      }
      return ponto;
    });
  }, [performanceData, metricaSelecionada]);

  // Calcular resumo da última semana vs semana anterior
  const resumoComparativo = useMemo(() => {
    if (!performanceData?.totaisPorSemana || performanceData.totaisPorSemana.length < 2) return null;
    
    const ultimaSemana = performanceData.totaisPorSemana[performanceData.totaisPorSemana.length - 1];
    const semanaAnterior = performanceData.totaisPorSemana[performanceData.totaisPorSemana.length - 2];
    
    return {
      atual: ultimaSemana,
      anterior: semanaAnterior,
    };
  }, [performanceData]);

  // Preparar dados para tabela de performance detalhada
  const tabelaPerformance = useMemo(() => {
    if (!performanceData?.corretores) return [];
    
    return performanceData.corretores.map(corretor => {
      const totalLeads = corretor.semanas.reduce((sum, s) => sum + s.leadsRecebidos, 0);
      const totalContatados = corretor.semanas.reduce((sum, s) => sum + s.leadsContatados, 0);
      const totalAgendamentos = corretor.semanas.reduce((sum, s) => sum + s.agendamentos, 0);
      const totalVisitas = corretor.semanas.reduce((sum, s) => sum + s.visitas, 0);
      const totalContratos = corretor.semanas.reduce((sum, s) => sum + s.contratosFechados, 0);
      
      // Tendência: comparar últimas 2 semanas
      const ultimaSemana = corretor.semanas[corretor.semanas.length - 1];
      const semanaAnterior = corretor.semanas.length >= 2 
        ? corretor.semanas[corretor.semanas.length - 2] 
        : null;
      
      return {
        ...corretor,
        totalLeads,
        totalContatados,
        totalAgendamentos,
        totalVisitas,
        totalContratos,
        taxaConversaoGeral: totalLeads > 0 ? Math.round((totalContratos / totalLeads) * 10000) / 100 : 0,
        taxaContatoGeral: totalLeads > 0 ? Math.round((totalContatados / totalLeads) * 10000) / 100 : 0,
        ultimaSemana,
        semanaAnterior,
      };
    }).sort((a, b) => b.totalContratos - a.totalContratos || b.totalLeads - a.totalLeads);
  }, [performanceData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Relatório de Performance Semanal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse text-muted-foreground">Carregando dados de performance...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!performanceData || performanceData.corretores.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Relatório de Performance Semanal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Sem dados de performance para exibir</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const metricasOpcoes = [
    { value: "leadsRecebidos", label: "Leads Recebidos", icon: Users },
    { value: "leadsContatados", label: "Leads Contatados", icon: Phone },
    { value: "agendamentos", label: "Agendamentos", icon: Calendar },
    { value: "visitas", label: "Visitas", icon: Eye },
    { value: "analisesCredito", label: "Análise de Crédito", icon: FileCheck },
    { value: "contratosFechados", label: "Contratos Fechados", icon: CheckCircle },
    { value: "taxaConversao", label: "Taxa de Conversão (%)", icon: Target },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Relatório de Performance Semanal
            </CardTitle>
            <CardDescription>
              Evolução de conversão e métricas por corretor nas últimas {numSemanas} semanas
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(numSemanas)} onValueChange={(v) => setNumSemanas(Number(v))}>
              <SelectTrigger className="w-[160px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">4 semanas</SelectItem>
                <SelectItem value="8">8 semanas</SelectItem>
                <SelectItem value="12">12 semanas</SelectItem>
                <SelectItem value="16">16 semanas</SelectItem>
                <SelectItem value="24">24 semanas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Cards de resumo comparativo */}
        {resumoComparativo && (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mb-6">
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Leads</span>
                <TrendIndicator 
                  current={resumoComparativo.atual.leadsRecebidos} 
                  previous={resumoComparativo.anterior.leadsRecebidos} 
                />
              </div>
              <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                {resumoComparativo.atual.leadsRecebidos}
              </div>
              <div className="text-xs text-muted-foreground">
                sem. anterior: {resumoComparativo.anterior.leadsRecebidos}
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">Contatados</span>
                <TrendIndicator 
                  current={resumoComparativo.atual.leadsContatados} 
                  previous={resumoComparativo.anterior.leadsContatados} 
                />
              </div>
              <div className="text-xl font-bold text-green-700 dark:text-green-300">
                {resumoComparativo.atual.leadsContatados}
              </div>
              <div className="text-xs text-muted-foreground">
                sem. anterior: {resumoComparativo.anterior.leadsContatados}
              </div>
            </div>

            <div className="bg-cyan-50 dark:bg-cyan-950/30 rounded-lg p-3 border border-cyan-200 dark:border-cyan-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-cyan-600 dark:text-cyan-400 font-medium">Agendamentos</span>
                <TrendIndicator 
                  current={resumoComparativo.atual.agendamentos} 
                  previous={resumoComparativo.anterior.agendamentos} 
                />
              </div>
              <div className="text-xl font-bold text-cyan-700 dark:text-cyan-300">
                {resumoComparativo.atual.agendamentos}
              </div>
              <div className="text-xs text-muted-foreground">
                sem. anterior: {resumoComparativo.anterior.agendamentos}
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Visitas</span>
                <TrendIndicator 
                  current={resumoComparativo.atual.visitas} 
                  previous={resumoComparativo.anterior.visitas} 
                />
              </div>
              <div className="text-xl font-bold text-amber-700 dark:text-amber-300">
                {resumoComparativo.atual.visitas}
              </div>
              <div className="text-xs text-muted-foreground">
                sem. anterior: {resumoComparativo.anterior.visitas}
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">Análise Créd.</span>
                <TrendIndicator 
                  current={resumoComparativo.atual.analisesCredito} 
                  previous={resumoComparativo.anterior.analisesCredito} 
                />
              </div>
              <div className="text-xl font-bold text-purple-700 dark:text-purple-300">
                {resumoComparativo.atual.analisesCredito}
              </div>
              <div className="text-xs text-muted-foreground">
                sem. anterior: {resumoComparativo.anterior.analisesCredito}
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 border border-red-200 dark:border-red-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-red-600 dark:text-red-400 font-medium">Contratos</span>
                <TrendIndicator 
                  current={resumoComparativo.atual.contratosFechados} 
                  previous={resumoComparativo.anterior.contratosFechados} 
                />
              </div>
              <div className="text-xl font-bold text-red-700 dark:text-red-300">
                {resumoComparativo.atual.contratosFechados}
              </div>
              <div className="text-xs text-muted-foreground">
                sem. anterior: {resumoComparativo.anterior.contratosFechados}
              </div>
            </div>
          </div>
        )}

        <Tabs value={tabAtiva} onValueChange={setTabAtiva} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="evolucao">Evolução Geral</TabsTrigger>
            <TabsTrigger value="comparativo">Comparativo Corretores</TabsTrigger>
            <TabsTrigger value="tabela">Tabela Detalhada</TabsTrigger>
          </TabsList>

          {/* Tab 1: Evolução Geral */}
          <TabsContent value="evolucao">
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dadosEvolucaoGeral} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="semana" fontSize={12} />
                  <YAxis yAxisId="left" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" fontSize={12} domain={[0, 100]} unit="%" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--popover)', 
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar yAxisId="left" dataKey="Leads Recebidos" fill={CORES_METRICAS.leadsRecebidos} radius={[4, 4, 0, 0]} opacity={0.8} />
                  <Bar yAxisId="left" dataKey="Contatados" fill={CORES_METRICAS.leadsContatados} radius={[4, 4, 0, 0]} opacity={0.8} />
                  <Bar yAxisId="left" dataKey="Agendamentos" fill={CORES_METRICAS.agendamentos} radius={[4, 4, 0, 0]} opacity={0.8} />
                  <Bar yAxisId="left" dataKey="Visitas" fill={CORES_METRICAS.visitas} radius={[4, 4, 0, 0]} opacity={0.8} />
                  <Bar yAxisId="left" dataKey="Contratos" fill={CORES_METRICAS.contratosFechados} radius={[4, 4, 0, 0]} opacity={0.8} />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="Taxa Conversão (%)" 
                    stroke="#ef4444" 
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#ef4444' }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {/* Tab 2: Comparativo por Corretor */}
          <TabsContent value="comparativo">
            <div className="mb-4">
              <Select value={metricaSelecionada} onValueChange={setMetricaSelecionada}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Selecione a métrica" />
                </SelectTrigger>
                <SelectContent>
                  {metricasOpcoes.map(m => (
                    <SelectItem key={m.value} value={m.value}>
                      <span className="flex items-center gap-2">
                        <m.icon className="h-3 w-3" />
                        {m.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dadosComparativoCorretores} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="semana" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--popover)', 
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  {performanceData.corretores.map((corretor, idx) => (
                    <Line
                      key={corretor.corretorId}
                      type="monotone"
                      dataKey={corretor.corretorNome}
                      stroke={CORES_CORRETORES[idx % CORES_CORRETORES.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {/* Tab 3: Tabela Detalhada */}
          <TabsContent value="tabela">
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold min-w-[150px]">Corretor</TableHead>
                    <TableHead className="text-center font-semibold">Leads</TableHead>
                    <TableHead className="text-center font-semibold">Contatados</TableHead>
                    <TableHead className="text-center font-semibold">Agend.</TableHead>
                    <TableHead className="text-center font-semibold">Visitas</TableHead>
                    <TableHead className="text-center font-semibold">Contratos</TableHead>
                    <TableHead className="text-center font-semibold">Tx. Contato</TableHead>
                    <TableHead className="text-center font-semibold">Tx. Conversão</TableHead>
                    <TableHead className="text-center font-semibold">Tendência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tabelaPerformance.map((corretor, index) => (
                    <TableRow key={corretor.corretorId} className={index % 2 === 0 ? 'bg-muted/20' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {corretor.corretorFoto ? (
                            <img 
                              src={corretor.corretorFoto} 
                              alt={corretor.corretorNome}
                              className="w-7 h-7 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                              <Users className="h-3.5 w-3.5 text-primary" />
                            </div>
                          )}
                          <span className="font-medium text-sm">{corretor.corretorNome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{corretor.totalLeads}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{corretor.totalContatados}</TableCell>
                      <TableCell className="text-center">{corretor.totalAgendamentos}</TableCell>
                      <TableCell className="text-center">{corretor.totalVisitas}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={corretor.totalContratos > 0 ? "default" : "secondary"}>
                          {corretor.totalContratos}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`text-sm font-medium ${
                          corretor.taxaContatoGeral >= 70 ? 'text-green-600' :
                          corretor.taxaContatoGeral >= 40 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {corretor.taxaContatoGeral}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`text-sm font-medium ${
                          corretor.taxaConversaoGeral >= 5 ? 'text-green-600' :
                          corretor.taxaConversaoGeral >= 2 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {corretor.taxaConversaoGeral}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {corretor.semanaAnterior && corretor.ultimaSemana ? (
                          <TrendIndicator 
                            current={corretor.ultimaSemana.leadsContatados}
                            previous={corretor.semanaAnterior.leadsContatados}
                          />
                        ) : (
                          <Minus className="h-3 w-3 text-muted-foreground mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
