import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { 
  Building2, Users, CheckCircle, TrendingUp, Clock, AlertCircle, 
  Calendar, DollarSign, Eye, FileCheck, XCircle, Hourglass,
  CalendarDays, CalendarRange
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subMonths, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  }).format(value / 100); // Valores estão em centavos
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
  
  // Queries para corretor (mantém o comportamento original)
  const { data: leads, isLoading: leadsLoading } = trpc.leads.list.useQuery(undefined, {
    enabled: !isGestor
  });
  const { data: projects } = trpc.projects.list.useQuery();

  // Dashboard do Corretor (mantém o original)
  if (!isGestor) {
    const totalLeads = leads?.length || 0;
    const leadsNovos = leads?.filter(l => l.status === "novo").length || 0;
    const leadsEmAtendimento = leads?.filter(l => l.status === "em_atendimento" || l.status === "aguardando_atendimento").length || 0;
    const leadsAgendados = leads?.filter(l => l.status === "agendado").length || 0;
    const leadsFechados = leads?.filter(l => l.status === "contrato_fechado").length || 0;
    const taxaConversao = totalLeads > 0 ? ((leadsFechados / totalLeads) * 100).toFixed(1) : "0";

    return (
      <DashboardLayout>
        <div className="container py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Bem-vindo de volta, {user?.name || "Corretor"}!
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalLeads}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {leadsNovos} novos leads
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Em Atendimento</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{leadsEmAtendimento}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {leadsAgendados} agendados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Contratos Fechados</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{leadsFechados}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Taxa de conversão: {taxaConversao}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Projetos Ativos</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{projects?.length || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Empreendimentos disponíveis
                </p>
              </CardContent>
            </Card>
          </div>

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
        </div>
      </DashboardLayout>
    );
  }

  // Dashboard do Gestor (novo)
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
                  <div className="text-2xl font-bold">{metrics?.total || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Aguardando</CardTitle>
                  <Hourglass className="h-4 w-4 text-slate-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.aguardando || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Em Atendimento</CardTitle>
                  <Clock className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.emAtendimento || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Agendado</CardTitle>
                  <Calendar className="h-4 w-4 text-cyan-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.agendado || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Visita Realizada</CardTitle>
                  <Eye className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.visitaRealizada || 0}</div>
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
                  <div className="text-2xl font-bold">{metrics?.analiseCredito || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Contrato Fechado</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.contratoFechado || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Perdidos</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.perdido || 0}</div>
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

            {/* Tabelas por corretor */}
            <div className="grid gap-6 md:grid-cols-2 mb-8">
              {/* Leads por Corretor */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Leads por Corretor
                  </CardTitle>
                  <CardDescription>Quantidade de leads atribuídos a cada corretor ativo</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Corretor</TableHead>
                        <TableHead className="text-right">Qtd. Leads</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leadsPorCorretor && leadsPorCorretor.length > 0 ? (
                        leadsPorCorretor.map((corretor) => (
                          <TableRow key={corretor.id}>
                            <TableCell className="font-medium">{corretor.nome}</TableCell>
                            <TableCell className="text-right">{corretor.totalLeads}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-muted-foreground">
                            Nenhum corretor ativo
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Agendamentos por Corretor */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Agendamentos por Corretor
                  </CardTitle>
                  <CardDescription>Leads em status "Agendado" por corretor</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Corretor</TableHead>
                        <TableHead className="text-right">Agendados</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agendamentosPorCorretor && agendamentosPorCorretor.length > 0 ? (
                        agendamentosPorCorretor.map((corretor) => (
                          <TableRow key={corretor.id}>
                            <TableCell className="font-medium">{corretor.nome}</TableCell>
                            <TableCell className="text-right">{corretor.agendados}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-muted-foreground">
                            Nenhum corretor ativo
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Visitas por Corretor */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Visitas por Corretor
                  </CardTitle>
                  <CardDescription>Leads em status "Visita Realizada" por corretor</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Corretor</TableHead>
                        <TableHead className="text-right">Visitas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visitasPorCorretor && visitasPorCorretor.length > 0 ? (
                        visitasPorCorretor.map((corretor) => (
                          <TableRow key={corretor.id}>
                            <TableCell className="font-medium">{corretor.nome}</TableCell>
                            <TableCell className="text-right">{corretor.visitas}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-muted-foreground">
                            Nenhum corretor ativo
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Vendas por Corretor */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Vendas por Corretor
                  </CardTitle>
                  <CardDescription>VGV e quantidade de contratos fechados por corretor</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Corretor</TableHead>
                        <TableHead className="text-right">VGV</TableHead>
                        <TableHead className="text-right">Vendas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendasPorCorretor && vendasPorCorretor.length > 0 ? (
                        vendasPorCorretor.map((corretor) => (
                          <TableRow key={corretor.id}>
                            <TableCell className="font-medium">{corretor.nome}</TableCell>
                            <TableCell className="text-right">{formatCurrency(corretor.vgv)}</TableCell>
                            <TableCell className="text-right">{corretor.vendas}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            Nenhum corretor ativo
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
