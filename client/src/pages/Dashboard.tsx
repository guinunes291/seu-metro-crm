import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { 
  Building2, Users, CheckCircle, TrendingUp, Clock, AlertCircle, 
  Calendar, DollarSign, Eye, FileCheck, XCircle, Hourglass,
  CalendarDays, CalendarRange, BarChart3, TrendingDown, Download
} from "lucide-react";
import { ExportCSVButton } from "@/components/ExportCSVButton";
import { Button } from "@/components/ui/button";
import LeadsUrgentesCard from "@/components/LeadsUrgentesCard";
import FunilVendasVisual from "@/components/FunilVendasVisual";
import PerformanceSemanal from "@/components/PerformanceSemanal";
import DistribuirSemCorretorButton from "@/components/DistribuirSemCorretorButton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subMonths, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
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
  Cell,
} from "recharts";

// Tipos de filtros predefinidos
const FILTER_PRESETS = [
  { value: "all", label: "Todo o período" },
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "this_week", label: "Esta semana" },
  { value: "last_week", label: "Semana passada" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "this_year", label: "Este ano" },
  { value: "custom", label: "Personalizado" },
];

function getDateRange(preset: string): { dataInicio?: string; dataFim?: string } {
  const now = new Date();
  
  switch (preset) {
    case "today":
      return {
        dataInicio: startOfDay(now).toISOString(),
        dataFim: endOfDay(now).toISOString(),
      };
    case "yesterday":
      const yesterday = subDays(now, 1);
      return {
        dataInicio: startOfDay(yesterday).toISOString(),
        dataFim: endOfDay(yesterday).toISOString(),
      };
    case "this_week":
      return {
        dataInicio: startOfWeek(now, { weekStartsOn: 0 }).toISOString(),
        dataFim: endOfWeek(now, { weekStartsOn: 0 }).toISOString(),
      };
    case "last_week":
      const lastWeek = subDays(now, 7);
      return {
        dataInicio: startOfWeek(lastWeek, { weekStartsOn: 0 }).toISOString(),
        dataFim: endOfWeek(lastWeek, { weekStartsOn: 0 }).toISOString(),
      };
    case "this_month":
      return {
        dataInicio: startOfMonth(now).toISOString(),
        dataFim: endOfMonth(now).toISOString(),
      };
    case "last_month":
      const lastMonth = subMonths(now, 1);
      return {
        dataInicio: startOfMonth(lastMonth).toISOString(),
        dataFim: endOfMonth(lastMonth).toISOString(),
      };
    case "this_year":
      return {
        dataInicio: startOfYear(now).toISOString(),
        dataFim: endOfDay(now).toISOString(),
      };
    case "all":
    default:
      return {};
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value); // Valores em reais
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return format(date, "dd/MM", { locale: ptBR });
}

export default function Dashboard() {
  const { user } = useAuth();
  const isGestor = user?.role === "gestor" || user?.role === "admin";
  
  // Estado do filtro
  const [filterPreset, setFilterPreset] = useState("all");
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  
  // Calcular range de datas baseado no filtro
  const dateFilter = useMemo(() => {
    if (filterPreset === "custom" && customDateRange.from && customDateRange.to) {
      return {
        dataInicio: startOfDay(customDateRange.from).toISOString(),
        dataFim: endOfDay(customDateRange.to).toISOString(),
      };
    }
    return getDateRange(filterPreset);
  }, [filterPreset, customDateRange]);
  
  // Queries para o dashboard do gestor
  const { data: metrics, isLoading: metricsLoading } = trpc.dashboard.metrics.useQuery(
    dateFilter,
    { enabled: isGestor }
  );
  const { data: leadsPorCorretor } = trpc.dashboard.leadsPorCorretor.useQuery(
    dateFilter,
    { enabled: isGestor }
  );
  const { data: agendamentosPorCorretor } = trpc.dashboard.agendamentosPorCorretor.useQuery(
    dateFilter,
    { enabled: isGestor }
  );
  const { data: visitasPorCorretor } = trpc.dashboard.visitasPorCorretor.useQuery(
    dateFilter,
    { enabled: isGestor }
  );
  const { data: vendasPorCorretor } = trpc.dashboard.vendasPorCorretor.useQuery(
    dateFilter,
    { enabled: isGestor }
  );
  
  // Queries para gráficos do gestor
  const { data: metricasHistoricas } = trpc.graficos.historico.useQuery(
    { dias: 30 },
    { enabled: isGestor }
  );
  const { data: dadosFunil } = trpc.graficos.funil.useQuery(
    { dias: 30 },
    { enabled: isGestor }
  );
  
  // Query de leads para o gestor (para o card de urgência)
  const { data: allLeads } = trpc.leads.list.useQuery(undefined, {
    enabled: isGestor
  });
  
  // Query para o relatório de leads criados por corretor
  const { data: relatorioLeadsCriados } = trpc.dashboard.relatorioLeadsCriados.useQuery(
    dateFilter,
    { enabled: isGestor }
  );
  
  // ============================================================================
  // QUERIES PARA O DASHBOARD DO CORRETOR
  // ============================================================================
  const { data: corretorMetrics, isLoading: corretorMetricsLoading } = trpc.dashboardCorretor.metrics.useQuery(
    dateFilter,
    { enabled: !isGestor }
  );
  const { data: corretorHistorico } = trpc.dashboardCorretor.historico.useQuery(
    { dias: 30 },
    { enabled: !isGestor }
  );
  const { data: corretorFunil } = trpc.dashboardCorretor.funil.useQuery(
    { dias: 30 },
    { enabled: !isGestor }
  );
  
  // Queries adicionais para corretor
  const { data: leads, isLoading: leadsLoading } = trpc.leads.list.useQuery(undefined, {
    enabled: !isGestor
  });
  const { data: projects } = trpc.projects.list.useQuery();

  // ============================================================================
  // DASHBOARD DO CORRETOR (NOVO - ESTILO DO GESTOR)
  // ============================================================================
  if (!isGestor) {
    return (
      <DashboardLayout>
        <div className="container py-8">
          {/* Header com filtro */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Meu Dashboard</h1>
              <p className="text-muted-foreground mt-2">
                Bem-vindo de volta, {user?.name || "Corretor"}! Acompanhe seu desempenho.
              </p>
            </div>
            
            {/* Filtro de data */}
            <div className="flex items-center gap-2">
              <Select value={filterPreset} onValueChange={setFilterPreset}>
                <SelectTrigger className="w-[180px]">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {filterPreset === "custom" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                      <CalendarRange className="mr-2 h-4 w-4" />
                      {customDateRange.from ? (
                        customDateRange.to ? (
                          <>
                            {format(customDateRange.from, "dd/MM/yy", { locale: ptBR })} -{" "}
                            {format(customDateRange.to, "dd/MM/yy", { locale: ptBR })}
                          </>
                        ) : (
                          format(customDateRange.from, "dd/MM/yyyy", { locale: ptBR })
                        )
                      ) : (
                        <span>Selecione as datas</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      initialFocus
                      mode="range"
                      defaultMonth={customDateRange.from}
                      selected={customDateRange}
                      onSelect={(range) => setCustomDateRange({ from: range?.from, to: range?.to })}
                      numberOfMonths={2}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          {corretorMetricsLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando métricas...
            </div>
          ) : (
            <>
              {/* Cards de métricas por status - Primeira linha */}
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5 mb-8">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
                    <Users className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{corretorMetrics?.total || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Aguardando</CardTitle>
                    <Hourglass className="h-4 w-4 text-slate-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{corretorMetrics?.aguardando || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Em Atendimento</CardTitle>
                    <Clock className="h-4 w-4 text-yellow-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{corretorMetrics?.emAtendimento || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Agendado</CardTitle>
                    <Calendar className="h-4 w-4 text-cyan-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{corretorMetrics?.agendado || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Visita Realizada</CardTitle>
                    <Eye className="h-4 w-4 text-orange-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{corretorMetrics?.visitaRealizada || 0}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Cards de métricas - Segunda linha */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Análise de Crédito</CardTitle>
                    <FileCheck className="h-4 w-4 text-purple-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{corretorMetrics?.analiseCredito || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Contrato Fechado</CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{corretorMetrics?.contratoFechado || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Perdidos</CardTitle>
                    <XCircle className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{corretorMetrics?.perdido || 0}</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">Meu VGV</CardTitle>
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                      {formatCurrency(corretorMetrics?.vgv || 0)}
                    </div>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Taxa de conversão: {corretorMetrics?.taxaConversao || 0}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Gráficos */}
              <div className="grid gap-4 md:grid-cols-2 mb-8">
                {/* Gráfico de Evolução de Leads */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Evolução de Leads (30 dias)
                    </CardTitle>
                    <CardDescription>Quantidade de leads recebidos por dia</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {corretorHistorico && corretorHistorico.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={corretorHistorico}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="data" 
                            tickFormatter={formatDateShort}
                            fontSize={12}
                          />
                          <YAxis fontSize={12} />
                          <Tooltip 
                            labelFormatter={(label) => format(new Date(label), "dd/MM/yyyy", { locale: ptBR })}
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="total" 
                            stroke="#3b82f6" 
                            name="Total"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Sem dados para exibir</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Gráfico de Funil de Vendas */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5" />
                      Funil de Vendas (30 dias)
                    </CardTitle>
                    <CardDescription>Distribuição de leads por etapa do funil</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {corretorFunil && corretorFunil.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={corretorFunil} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" fontSize={12} />
                          <YAxis 
                            dataKey="etapa" 
                            type="category" 
                            width={120}
                            fontSize={11}
                          />
                          <Tooltip />
                          <Bar dataKey="valor" name="Quantidade">
                            {corretorFunil.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.cor} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Sem dados para exibir</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Leads Recentes e Projetos */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Leads Recentes</CardTitle>
                    <CardDescription>Últimos leads atribuídos a você</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {leadsLoading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Carregando...
                      </div>
                    ) : leads && leads.length > 0 ? (
                      <div className="space-y-4">
                        {leads.slice(0, 5).map((lead) => (
                          <div key={lead.id} className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium">{lead.nome}</p>
                              <p className="text-sm text-muted-foreground">{lead.telefone}</p>
                            </div>
                            <Badge variant={
                              lead.status === "contrato_fechado" ? "default" :
                              lead.status === "perdido" ? "destructive" :
                              lead.status === "novo" ? "secondary" : "outline"
                            }>
                              {lead.status.replace(/_/g, " ")}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Nenhum lead encontrado</p>
                      </div>
                    )}
                    <Link href="/leads">
                      <Button variant="outline" className="w-full mt-4">
                        Ver todos os leads
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Projetos Disponíveis</CardTitle>
                    <CardDescription>Empreendimentos para oferecer aos clientes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {projects && projects.length > 0 ? (
                      <div className="space-y-4">
                        {projects.slice(0, 5).map((project) => (
                          <div key={project.id} className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium">{project.nome}</p>
                              <p className="text-sm text-muted-foreground">
                                {project.bairro}, {project.cidade}
                              </p>
                            </div>
                            <Badge variant={
                              project.status === "ativo" ? "default" :
                              project.status === "esgotado" ? "destructive" : "secondary"
                            }>
                              {project.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Nenhum projeto cadastrado</p>
                      </div>
                    )}
                    <Link href="/projetos">
                      <Button variant="outline" className="w-full mt-4">
                        Ver todos os projetos
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ============================================================================
  // DASHBOARD DO GESTOR (ORIGINAL)
  // ============================================================================
  return (
    <DashboardLayout>
      <div className="container py-8">
        {/* Header com filtro */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard do Gestor</h1>
            <p className="text-muted-foreground mt-2">
              Visão geral do desempenho da equipe
            </p>
          </div>
          
          {/* Filtro de data */}
          <div className="flex items-center gap-2">
            <Select value={filterPreset} onValueChange={setFilterPreset}>
              <SelectTrigger className="w-[180px]">
                <CalendarDays className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                {FILTER_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {filterPreset === "custom" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                    <CalendarRange className="mr-2 h-4 w-4" />
                    {customDateRange.from ? (
                      customDateRange.to ? (
                        <>
                          {format(customDateRange.from, "dd/MM/yy", { locale: ptBR })} -{" "}
                          {format(customDateRange.to, "dd/MM/yy", { locale: ptBR })}
                        </>
                      ) : (
                        format(customDateRange.from, "dd/MM/yyyy", { locale: ptBR })
                      )
                    ) : (
                      <span>Selecione as datas</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    initialFocus
                    mode="range"
                    defaultMonth={customDateRange.from}
                    selected={customDateRange}
                    onSelect={(range) => setCustomDateRange({ from: range?.from, to: range?.to })}
                    numberOfMonths={2}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {metricsLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando métricas...
          </div>
        ) : (
          <>
            {/* Cards de métricas por status */}
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
                  <Users className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">{metrics?.total || 0}</div>
                    {(metrics?.total || 0) > 0 && (
                      <ExportCSVButton size="icon" variant="ghost" label="" />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Aguardando</CardTitle>
                  <Hourglass className="h-4 w-4 text-slate-500" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">{metrics?.aguardando || 0}</div>
                    {(metrics?.aguardando || 0) > 0 && (
                      <ExportCSVButton status="aguardando_atendimento" size="icon" variant="ghost" label="" />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Em Atendimento</CardTitle>
                  <Clock className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">{metrics?.emAtendimento || 0}</div>
                    {(metrics?.emAtendimento || 0) > 0 && (
                      <ExportCSVButton status="em_atendimento" size="icon" variant="ghost" label="" />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Agendado</CardTitle>
                  <Calendar className="h-4 w-4 text-cyan-500" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">{metrics?.agendado || 0}</div>
                    {(metrics?.agendado || 0) > 0 && (
                      <ExportCSVButton status="agendado" size="icon" variant="ghost" label="" />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Visita Realizada</CardTitle>
                  <Eye className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">{metrics?.visitaRealizada || 0}</div>
                    {(metrics?.visitaRealizada || 0) > 0 && (
                      <ExportCSVButton status="visita_realizada" size="icon" variant="ghost" label="" />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Análise de Crédito</CardTitle>
                  <FileCheck className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">{metrics?.analiseCredito || 0}</div>
                    {(metrics?.analiseCredito || 0) > 0 && (
                      <ExportCSVButton status="analise_credito" size="icon" variant="ghost" label="" />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Contrato Fechado</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">{metrics?.contratoFechado || 0}</div>
                    {(metrics?.contratoFechado || 0) > 0 && (
                      <ExportCSVButton status="contrato_fechado" size="icon" variant="ghost" label="" />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Perdidos</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">{metrics?.perdido || 0}</div>
                    {(metrics?.perdido || 0) > 0 && (
                      <ExportCSVButton status="perdido" size="icon" variant="ghost" label="" />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">VGV (Valor Geral de Venda)</CardTitle>
                  <DollarSign className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {formatCurrency(metrics?.vgv || 0)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Gráficos */}
            <div className="grid gap-4 md:grid-cols-2 mb-8">
              {/* Gráfico de Evolução de Leads */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Evolução de Leads (30 dias)
                  </CardTitle>
                  <CardDescription>Quantidade de leads criados por dia</CardDescription>
                </CardHeader>
                <CardContent>
                  {metricasHistoricas && metricasHistoricas.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={metricasHistoricas}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="data" 
                          tickFormatter={formatDateShort}
                          fontSize={12}
                        />
                        <YAxis fontSize={12} />
                        <Tooltip 
                          labelFormatter={(label) => format(parseISO(label), "dd/MM/yyyy", { locale: ptBR })}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="total" 
                          stroke="#3b82f6" 
                          name="Total"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Sem dados para exibir</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Funil de Vendas Visual */}
              <FunilVendasVisual
                data={{
                  novos: metrics?.novos || 0,
                  aguardando: metrics?.aguardando || 0,
                  emAtendimento: metrics?.emAtendimento || 0,
                  agendados: metrics?.agendado || 0,
                  visitaRealizada: metrics?.visitaRealizada || 0,
                  analiseCredito: metrics?.analiseCredito || 0,
                  contratoFechado: metrics?.contratoFechado || 0,
                  perdidos: metrics?.perdido || 0,
                }}
              />
            </div>

            {/* Card de Leads Urgentes */}
            {allLeads && allLeads.length > 0 && (
              <div className="mb-8">
                <LeadsUrgentesCard leads={allLeads} />
              </div>
            )}

            {/* Relatório de Performance Semanal */}
            <div className="mb-8">
              <PerformanceSemanal />
            </div>

            {/* Tabelas de ranking */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Leads por Corretor */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Leads por Corretor</CardTitle>
                </CardHeader>
                <CardContent>
                  {leadsPorCorretor && leadsPorCorretor.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Corretor</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leadsPorCorretor.slice(0, 5).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.nome}</TableCell>
                            <TableCell className="text-right">{item.totalLeads}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">Sem dados</p>
                  )}
                </CardContent>
              </Card>

              {/* Agendamentos por Corretor */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Agendamentos</CardTitle>
                </CardHeader>
                <CardContent>
                  {agendamentosPorCorretor && agendamentosPorCorretor.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Corretor</TableHead>
                          <TableHead className="text-right">Agend.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {agendamentosPorCorretor.slice(0, 5).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.nome}</TableCell>
                            <TableCell className="text-right">{item.agendados}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">Sem dados</p>
                  )}
                </CardContent>
              </Card>

              {/* Visitas por Corretor */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Visitas Realizadas</CardTitle>
                </CardHeader>
                <CardContent>
                  {visitasPorCorretor && visitasPorCorretor.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Corretor</TableHead>
                          <TableHead className="text-right">Visitas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visitasPorCorretor.slice(0, 5).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.nome}</TableCell>
                            <TableCell className="text-right">{item.visitas}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">Sem dados</p>
                  )}
                </CardContent>
              </Card>

              {/* Vendas por Corretor */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Vendas / VGV</CardTitle>
                </CardHeader>
                <CardContent>
                  {vendasPorCorretor && vendasPorCorretor.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Corretor</TableHead>
                          <TableHead className="text-right">Vendas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vendasPorCorretor.slice(0, 5).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.nome}</TableCell>
                            <TableCell className="text-right">
                              {item.vendas}
                              <span className="text-xs text-muted-foreground ml-1">
                                ({formatCurrency(item.vgv)})
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">Sem dados</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Relatório de Leads Criados por Corretor */}
            <div className="mt-8">
              <Card>
                <CardHeader>
                   <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Relatório de Leads Criados por Corretor
                      </CardTitle>
                      <CardDescription>Distribuição de leads por corretor, origem e projeto</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-sm">
                        Total: {relatorioLeadsCriados?.totalGeral || 0} leads
                      </Badge>
                      <DistribuirSemCorretorButton />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {relatorioLeadsCriados && relatorioLeadsCriados.porCorretor.length > 0 ? (
                    <div className="space-y-6">
                      {/* Gráfico de Barras Horizontal */}
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={relatorioLeadsCriados.porCorretor.slice(0, 10)}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis 
                              type="category" 
                              dataKey="corretorNome" 
                              width={90}
                              fontSize={12}
                            />
                            <Tooltip 
                              formatter={(value: number) => [`${value} leads`, 'Total']}
                            />
                            <Bar 
                              dataKey="totalLeads" 
                              fill="#3b82f6" 
                              radius={[0, 4, 4, 0]}
                            >
                              {relatorioLeadsCriados.porCorretor.slice(0, 10).map((_, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={index === 0 ? '#22c55e' : index === 1 ? '#3b82f6' : index === 2 ? '#f59e0b' : '#6b7280'}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Tabela Detalhada */}
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="font-semibold">Corretor</TableHead>
                              <TableHead className="text-center font-semibold">Total Leads</TableHead>
                              <TableHead className="font-semibold">Principais Origens</TableHead>
                              <TableHead className="font-semibold">Principais Projetos</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {relatorioLeadsCriados.porCorretor.map((corretor, index) => (
                              <TableRow key={corretor.corretorId} className={index % 2 === 0 ? 'bg-muted/20' : ''}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {corretor.corretorFoto ? (
                                      <img 
                                        src={corretor.corretorFoto} 
                                        alt={corretor.corretorNome}
                                        className="w-8 h-8 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Users className="h-4 w-4 text-primary" />
                                      </div>
                                    )}
                                    <span className="font-medium">{corretor.corretorNome}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="secondary" className="text-lg px-3">
                                    {corretor.totalLeads}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries(corretor.porOrigem)
                                      .sort(([,a], [,b]) => b - a)
                                      .slice(0, 3)
                                      .map(([origem, qtd]) => (
                                        <Badge key={origem} variant="outline" className="text-xs">
                                          {origem.replace('_', ' ')}: {qtd}
                                        </Badge>
                                      ))}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {corretor.porProjeto
                                      .slice(0, 2)
                                      .map((proj) => (
                                        <Badge key={proj.projetoId || 'sem'} variant="outline" className="text-xs">
                                          {proj.projetoNome.substring(0, 20)}{proj.projetoNome.length > 20 ? '...' : ''}: {proj.quantidade}
                                        </Badge>
                                      ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Resumo por Origem */}
                      <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Distribuição por Origem</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {relatorioLeadsCriados.porOrigem.slice(0, 5).map((item) => (
                                <div key={item.origem} className="flex items-center justify-between">
                                  <span className="text-sm capitalize">{item.origem.replace('_', ' ')}</span>
                                  <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-primary rounded-full" 
                                        style={{ width: `${(item.quantidade / relatorioLeadsCriados.totalGeral) * 100}%` }}
                                      />
                                    </div>
                                    <span className="text-sm font-medium w-12 text-right">{item.quantidade}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Distribuição por Projeto</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {relatorioLeadsCriados.porProjeto.slice(0, 5).map((item) => (
                                <div key={item.projetoId || 'sem'} className="flex items-center justify-between">
                                  <span className="text-sm truncate max-w-[150px]" title={item.projetoNome}>
                                    {item.projetoNome}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-green-500 rounded-full" 
                                        style={{ width: `${(item.quantidade / relatorioLeadsCriados.totalGeral) * 100}%` }}
                                      />
                                    </div>
                                    <span className="text-sm font-medium w-12 text-right">{item.quantidade}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum lead encontrado no período selecionado</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
