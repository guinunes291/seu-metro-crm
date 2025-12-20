import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Clock, Calendar, Users, TrendingUp, TrendingDown, 
  AlertTriangle, CheckCircle, XCircle, Timer, BarChart3,
  Download, RefreshCw, User, Activity
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";

export default function HistoricoPresenca() {
  const [periodo, setPeriodo] = useState<"7" | "15" | "30" | "90">("30");
  const [corretorSelecionado, setCorretorSelecionado] = useState<string>("todos");
  
  // Calcular datas baseado no período
  const { dataInicio, dataFim } = useMemo(() => {
    const fim = new Date();
    const inicio = new Date();
    inicio.setDate(fim.getDate() - parseInt(periodo));
    return {
      dataInicio: inicio.toISOString(),
      dataFim: fim.toISOString(),
    };
  }, [periodo]);
  
  // Queries
  const { data: corretores } = trpc.corretores.list.useQuery();
  const { data: graficoTime, isLoading: loadingGrafico } = trpc.presenca.graficoTime.useQuery({
    dataInicio,
    dataFim,
  });
  const { data: resumoDiario, isLoading: loadingResumo } = trpc.presenca.resumoDiario.useQuery({
    corretorId: corretorSelecionado !== "todos" ? parseInt(corretorSelecionado) : undefined,
    dataInicio,
    dataFim,
  });
  const { data: semConfirmacao } = trpc.presenca.semConfirmacao.useQuery();
  const { data: relatorioSemanal } = trpc.presenca.relatorioSemanal.useQuery();
  
  // Estatísticas do corretor selecionado
  const { data: estatisticasCorretor } = trpc.presenca.estatisticas.useQuery({
    corretorId: corretorSelecionado !== "todos" ? parseInt(corretorSelecionado) : 0,
    dataInicio,
    dataFim,
  }, {
    enabled: corretorSelecionado !== "todos",
  });
  
  // Formatar dados para o gráfico de barras empilhadas
  const dadosGraficoBarras = useMemo(() => {
    if (!graficoTime) return [];
    
    return graficoTime.labels.map((label, index) => ({
      data: label,
      presente: graficoTime.datasets[0].data[index],
      parcial: graficoTime.datasets[1].data[index],
      ausente: graficoTime.datasets[2].data[index],
    }));
  }, [graficoTime]);
  
  // Formatar dados para timeline
  const dadosTimeline = useMemo(() => {
    if (!resumoDiario) return [];
    
    return resumoDiario.map((r: any) => ({
      data: new Date(r.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      horasTrabalhadas: Math.round(r.totalMinutosPresente / 60 * 10) / 10,
      entrada: r.primeiraEntrada ? new Date(r.primeiraEntrada).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "-",
      saida: r.ultimaSaida ? new Date(r.ultimaSaida).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "-",
      status: r.statusDia,
    })).reverse();
  }, [resumoDiario]);
  
  // Calcular estatísticas gerais
  const estatisticasGerais = useMemo(() => {
    if (!resumoDiario || resumoDiario.length === 0) {
      return {
        totalDias: 0,
        diasPresente: 0,
        diasAusente: 0,
        diasParcial: 0,
        mediaHoras: 0,
        percentualPresenca: 0,
      };
    }
    
    const totalDias = resumoDiario.length;
    const diasPresente = resumoDiario.filter((r: any) => r.statusDia === "presente").length;
    const diasAusente = resumoDiario.filter((r: any) => r.statusDia === "ausente").length;
    const diasParcial = resumoDiario.filter((r: any) => r.statusDia === "parcial").length;
    const totalMinutos = resumoDiario.reduce((acc: number, r: any) => acc + r.totalMinutosPresente, 0);
    const mediaHoras = totalDias > 0 ? Math.round(totalMinutos / totalDias / 60 * 10) / 10 : 0;
    const percentualPresenca = totalDias > 0 ? Math.round((diasPresente + diasParcial * 0.5) / totalDias * 100) : 0;
    
    return {
      totalDias,
      diasPresente,
      diasAusente,
      diasParcial,
      mediaHoras,
      percentualPresenca,
    };
  }, [resumoDiario]);
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "presente":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Presente</Badge>;
      case "ausente":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/50">Ausente</Badge>;
      case "parcial":
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/50">Parcial</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Clock className="h-6 w-6 text-amber-400" />
              Histórico de Presença
            </h1>
            <p className="text-slate-400 mt-1">
              Acompanhe a presença e ausência da equipe
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as any)}>
              <SelectTrigger className="w-[140px] bg-slate-800 border-slate-700">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="15">Últimos 15 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={corretorSelecionado} onValueChange={setCorretorSelecionado}>
              <SelectTrigger className="w-[180px] bg-slate-800 border-slate-700">
                <User className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Todos os corretores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os corretores</SelectItem>
                {corretores?.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name || c.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Alertas de corretores sem confirmação */}
        {semConfirmacao && semConfirmacao.length > 0 && (
          <Card className="bg-amber-500/10 border-amber-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-amber-400 flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5" />
                Corretores sem confirmação há mais de 3 horas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {semConfirmacao.map((c: any) => (
                  <Badge key={c.id} className="bg-amber-500/20 text-amber-300 border-amber-500/50">
                    {c.name || c.email} - {c.horasPresente}h presente
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Cards de estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                <Calendar className="h-4 w-4" />
                Total de Dias
              </div>
              <p className="text-2xl font-bold text-white">{estatisticasGerais.totalDias}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-green-400 text-sm mb-1">
                <CheckCircle className="h-4 w-4" />
                Dias Presente
              </div>
              <p className="text-2xl font-bold text-green-400">{estatisticasGerais.diasPresente}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-red-400 text-sm mb-1">
                <XCircle className="h-4 w-4" />
                Dias Ausente
              </div>
              <p className="text-2xl font-bold text-red-400">{estatisticasGerais.diasAusente}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-amber-400 text-sm mb-1">
                <Timer className="h-4 w-4" />
                Dias Parcial
              </div>
              <p className="text-2xl font-bold text-amber-400">{estatisticasGerais.diasParcial}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-cyan-400 text-sm mb-1">
                <Clock className="h-4 w-4" />
                Média Horas/Dia
              </div>
              <p className="text-2xl font-bold text-cyan-400">{estatisticasGerais.mediaHoras}h</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-purple-400 text-sm mb-1">
                <TrendingUp className="h-4 w-4" />
                % Presença
              </div>
              <p className="text-2xl font-bold text-purple-400">{estatisticasGerais.percentualPresenca}%</p>
            </CardContent>
          </Card>
        </div>
        
        {/* Tabs com gráficos */}
        <Tabs defaultValue="barras" className="space-y-4">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="barras" className="data-[state=active]:bg-amber-500">
              <BarChart3 className="h-4 w-4 mr-2" />
              Barras Empilhadas
            </TabsTrigger>
            <TabsTrigger value="timeline" className="data-[state=active]:bg-amber-500">
              <Activity className="h-4 w-4 mr-2" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="area" className="data-[state=active]:bg-amber-500">
              <TrendingUp className="h-4 w-4 mr-2" />
              Área
            </TabsTrigger>
          </TabsList>
          
          {/* Gráfico de Barras Empilhadas */}
          <TabsContent value="barras">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Presença do Time por Dia</CardTitle>
                <CardDescription>Distribuição de presença, ausência e parcial</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingGrafico ? (
                  <div className="h-[400px] flex items-center justify-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                ) : dadosGraficoBarras.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={dadosGraficoBarras}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="data" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          border: "1px solid #334155",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "#f8fafc" }}
                      />
                      <Legend />
                      <Bar dataKey="presente" name="Presente" stackId="a" fill="#22c55e" />
                      <Bar dataKey="parcial" name="Parcial" stackId="a" fill="#f59e0b" />
                      <Bar dataKey="ausente" name="Ausente" stackId="a" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-slate-400">
                    Nenhum dado disponível para o período selecionado
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Timeline */}
          <TabsContent value="timeline">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Horas Trabalhadas por Dia</CardTitle>
                <CardDescription>Evolução das horas trabalhadas ao longo do período</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingResumo ? (
                  <div className="h-[400px] flex items-center justify-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                ) : dadosTimeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={dadosTimeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="data" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          border: "1px solid #334155",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "#f8fafc" }}
                        formatter={(value: any) => [`${value}h`, "Horas"]}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="horasTrabalhadas"
                        name="Horas Trabalhadas"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={{ fill: "#f59e0b", strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-slate-400">
                    Nenhum dado disponível para o período selecionado
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Gráfico de Área */}
          <TabsContent value="area">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Evolução da Presença</CardTitle>
                <CardDescription>Visualização em área das horas trabalhadas</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingResumo ? (
                  <div className="h-[400px] flex items-center justify-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                ) : dadosTimeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={dadosTimeline}>
                      <defs>
                        <linearGradient id="colorHoras" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="data" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          border: "1px solid #334155",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "#f8fafc" }}
                        formatter={(value: any) => [`${value}h`, "Horas"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="horasTrabalhadas"
                        name="Horas Trabalhadas"
                        stroke="#f59e0b"
                        fillOpacity={1}
                        fill="url(#colorHoras)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-slate-400">
                    Nenhum dado disponível para o período selecionado
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* Tabela de histórico detalhado */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-amber-400" />
              Histórico Detalhado
            </CardTitle>
            <CardDescription>Registro diário de presença e ausência</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingResumo ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : dadosTimeline.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Data</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Entrada</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Saída</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Horas</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dadosTimeline.slice().reverse().map((item: any, index: number) => (
                      <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                        <td className="py-3 px-4 text-white">{item.data}</td>
                        <td className="py-3 px-4 text-slate-300">{item.entrada}</td>
                        <td className="py-3 px-4 text-slate-300">{item.saida}</td>
                        <td className="py-3 px-4 text-amber-400 font-medium">{item.horasTrabalhadas}h</td>
                        <td className="py-3 px-4">{getStatusBadge(item.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                Nenhum registro de presença encontrado para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Relatório Semanal */}
        {relatorioSemanal && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-amber-400" />
                Relatório Semanal
              </CardTitle>
              <CardDescription>
                Período: {relatorioSemanal.periodo}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <p className="text-slate-400 text-sm">Total de Corretores</p>
                  <p className="text-2xl font-bold text-white">{relatorioSemanal.resumo.totalCorretores}</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <p className="text-slate-400 text-sm">Média de Presença</p>
                  <p className="text-2xl font-bold text-amber-400">{relatorioSemanal.resumo.mediaPresenca}%</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <p className="text-slate-400 text-sm">Mais Presente</p>
                  <p className="text-lg font-bold text-green-400 truncate">{relatorioSemanal.resumo.corretorMaisPresente}</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <p className="text-slate-400 text-sm">Menos Presente</p>
                  <p className="text-lg font-bold text-red-400 truncate">{relatorioSemanal.resumo.corretorMenosPresente}</p>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Corretor</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Horas</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Presença</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Dias Ausente</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatorioSemanal.corretores.map((c: any, index: number) => (
                      <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                        <td className="py-3 px-4 text-white">{c.nome}</td>
                        <td className="py-3 px-4 text-slate-300">{c.totalHoras}h</td>
                        <td className="py-3 px-4 text-amber-400">{c.percentualPresenca}%</td>
                        <td className="py-3 px-4 text-slate-300">{c.diasAusente}</td>
                        <td className="py-3 px-4">
                          {c.status === "bom" && (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Bom</Badge>
                          )}
                          {c.status === "regular" && (
                            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/50">Regular</Badge>
                          )}
                          {c.status === "ruim" && (
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/50">Atenção</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
