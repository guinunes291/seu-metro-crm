import React, { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { FunilChart } from "@/components/charts/FunilChart";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, TrendingUp, TrendingDown, Minus, Users, Calendar,
  MapPin, FileText, Home, AlertTriangle, CheckCircle2, XCircle,
  ChevronRight, BarChart2, Target, Activity
} from "lucide-react";

// ============================================================================
// HELPERS
// ============================================================================
function fmtMoeda(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

function fmtPct(v: number) {
  return `${v}%`;
}

function statusColor(pct: number) {
  if (pct >= 80) return "text-green-600";
  if (pct >= 50) return "text-yellow-600";
  return "text-red-600";
}

function statusBg(pct: number) {
  if (pct >= 80) return "bg-green-50 border-green-200";
  if (pct >= 50) return "bg-yellow-50 border-yellow-200";
  return "bg-red-50 border-red-200";
}

// ============================================================================
// COMPONENTE: KPI Card
// ============================================================================
function KpiCard({
  title, value, sub, icon: Icon, color = "blue", trend
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color?: "blue" | "green" | "yellow" | "red" | "purple";
  trend?: "up" | "down" | "neutral";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    yellow: "bg-yellow-50 text-yellow-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
  };
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground";
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg ${colors[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-xs ${trendColor}`}>
            <TrendIcon className="h-3 w-3" />
            <span>{trend === "up" ? "Acima do esperado" : trend === "down" ? "Abaixo do esperado" : "Dentro do esperado"}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// COMPONENTE: Tabela de Produção por Corretor
// ============================================================================
function TabelaProducao({ dataInicio, dataFim }: { dataInicio?: Date; dataFim?: Date }) {
  const { data, isLoading } = trpc.relatorios.producaoPorCorretor.useQuery(
    {
      dataInicio: dataInicio?.toISOString(),
      dataFim: dataFim?.toISOString(),
    },
    { staleTime: 2 * 60 * 1000 }
  );

  const [sortBy, setSortBy] = useState<"leads" | "agendamentos" | "visitas" | "analises" | "contratos" | "vgv">("leads");

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => b[sortBy] - a[sortBy]);
  }, [data, sortBy]);

  const totais = useMemo(() => {
    if (!data) return null;
    return {
      leads: data.reduce((s, r) => s + r.leads, 0),
      agendamentos: data.reduce((s, r) => s + r.agendamentos, 0),
      visitas: data.reduce((s, r) => s + r.visitas, 0),
      analises: data.reduce((s, r) => s + r.analises, 0),
      contratos: data.reduce((s, r) => s + r.contratos, 0),
      vgv: data.reduce((s, r) => s + r.vgv, 0),
    };
  }, [data]);

  const zerados = useMemo(() => data?.filter(r => r.agendamentos === 0).length || 0, [data]);
  const topPerformers = useMemo(() => data?.filter(r => r.contratos > 0).length || 0, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando produção...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Nenhum dado encontrado para o período selecionado.
      </div>
    );
  }

  const SortBtn = ({ col, label }: { col: typeof sortBy; label: string }) => (
    <button
      onClick={() => setSortBy(col)}
      className={`text-xs font-medium uppercase tracking-wide hover:text-foreground transition-colors ${
        sortBy === col ? "text-primary font-bold" : "text-muted-foreground"
      }`}
    >
      {label} {sortBy === col && "↓"}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Alertas rápidos */}
      <div className="flex flex-wrap gap-3">
        {zerados > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span><strong>{zerados}</strong> corretor{zerados > 1 ? "es" : ""} sem agendamentos no período</span>
          </div>
        )}
        {topPerformers > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 border border-green-200 rounded-md px-3 py-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span><strong>{topPerformers}</strong> corretor{topPerformers > 1 ? "es" : ""} com contrato fechado</span>
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">#</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Corretor</th>
              <th className="text-center py-3 px-4"><SortBtn col="leads" label="Leads" /></th>
              <th className="text-center py-3 px-4"><SortBtn col="agendamentos" label="Agend." /></th>
              <th className="text-center py-3 px-3 text-xs text-muted-foreground font-medium">Tx Agend.</th>
              <th className="text-center py-3 px-4"><SortBtn col="visitas" label="Visitas" /></th>
              <th className="text-center py-3 px-3 text-xs text-muted-foreground font-medium">Tx Visita</th>
              <th className="text-center py-3 px-4"><SortBtn col="analises" label="Análises" /></th>
              <th className="text-center py-3 px-3 text-xs text-muted-foreground font-medium">Tx Análise</th>
              <th className="text-center py-3 px-4"><SortBtn col="contratos" label="Contratos" /></th>
              <th className="text-right py-3 px-4"><SortBtn col="vgv" label="VGV" /></th>
              <th className="text-center py-3 px-4 text-xs text-muted-foreground font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => {
              const isTop = row.contratos > 0;
              const isZero = row.agendamentos === 0 && row.leads > 0;
              return (
                <tr
                  key={row.id}
                  className={`border-t transition-colors ${
                    isTop ? "bg-green-50/30 hover:bg-green-50/60" :
                    isZero ? "bg-red-50/20 hover:bg-red-50/40" :
                    "hover:bg-muted/30"
                  }`}
                >
                  <td className="py-3 px-4 text-muted-foreground text-xs">{idx + 1}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        row.status === "presente" ? "bg-green-500" : "bg-gray-300"
                      }`} />
                      <span className="font-medium truncate max-w-[140px]" title={row.nome}>{row.nome}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center font-semibold">{row.leads}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={row.agendamentos === 0 && row.leads > 0 ? "text-red-500 font-semibold" : ""}>{row.agendamentos}</span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      row.txAgend >= 30 ? "bg-green-100 text-green-700" :
                      row.txAgend >= 15 ? "bg-yellow-100 text-yellow-700" :
                      row.leads > 0 ? "bg-red-100 text-red-700" : "text-muted-foreground"
                    }`}>{row.leads > 0 ? fmtPct(row.txAgend) : "—"}</span>
                  </td>
                  <td className="py-3 px-4 text-center">{row.visitas}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      row.txVisita >= 50 ? "bg-green-100 text-green-700" :
                      row.txVisita >= 25 ? "bg-yellow-100 text-yellow-700" :
                      row.agendamentos > 0 ? "bg-red-100 text-red-700" : "text-muted-foreground"
                    }`}>{row.agendamentos > 0 ? fmtPct(row.txVisita) : "—"}</span>
                  </td>
                  <td className="py-3 px-4 text-center">{row.analises}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      row.txAnalise >= 50 ? "bg-green-100 text-green-700" :
                      row.txAnalise >= 25 ? "bg-yellow-100 text-yellow-700" :
                      row.visitas > 0 ? "bg-red-100 text-red-700" : "text-muted-foreground"
                    }`}>{row.visitas > 0 ? fmtPct(row.txAnalise) : "—"}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={row.contratos > 0 ? "font-bold text-green-700" : ""}>{row.contratos}</span>
                  </td>
                  <td className="py-3 px-4 text-right text-xs font-medium">
                    {row.vgv > 0 ? fmtMoeda(row.vgv) : "—"}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {row.contratos > 0 ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Top</Badge>
                    ) : row.agendamentos === 0 && row.leads > 0 ? (
                      <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Atenção</Badge>
                    ) : row.leads === 0 ? (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Sem leads</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Em andamento</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {totais && (
            <tfoot className="bg-muted/70 border-t-2">
              <tr>
                <td className="py-3 px-4" colSpan={2}>
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Total</span>
                </td>
                <td className="py-3 px-4 text-center font-bold">{totais.leads}</td>
                <td className="py-3 px-4 text-center font-bold">{totais.agendamentos}</td>
                <td className="py-3 px-3 text-center text-xs text-muted-foreground">
                  {totais.leads > 0 ? fmtPct(Math.round(totais.agendamentos / totais.leads * 100)) : "—"}
                </td>
                <td className="py-3 px-4 text-center font-bold">{totais.visitas}</td>
                <td className="py-3 px-3 text-center text-xs text-muted-foreground">
                  {totais.agendamentos > 0 ? fmtPct(Math.round(totais.visitas / totais.agendamentos * 100)) : "—"}
                </td>
                <td className="py-3 px-4 text-center font-bold">{totais.analises}</td>
                <td className="py-3 px-3 text-center text-xs text-muted-foreground">
                  {totais.visitas > 0 ? fmtPct(Math.round(totais.analises / totais.visitas * 100)) : "—"}
                </td>
                <td className="py-3 px-4 text-center font-bold text-green-700">{totais.contratos}</td>
                <td className="py-3 px-4 text-right font-bold">{totais.vgv > 0 ? fmtMoeda(totais.vgv) : "—"}</td>
                <td className="py-3 px-4" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Clique nos cabeçalhos de coluna para ordenar. Verde = contrato fechado · Vermelho = sem agendamentos com leads ativos.
      </p>
    </div>
  );
}

// ============================================================================
// COMPONENTE: Relatório Facebook Timer
// ============================================================================
function FacebookTimerRelatorio({ dataInicio, dataFim }: { dataInicio?: Date; dataFim?: Date }) {
  const defaultInicio = useMemo(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); d.setHours(0,0,0,0); return d; }, []);
  const defaultFim = useMemo(() => { const d = new Date(); d.setHours(23,59,59,999); return d; }, []);
  const inicio = dataInicio || defaultInicio;
  const fim = dataFim || defaultFim;

  const { data, isLoading } = trpc.relatorios.leadsTimerPorCorretor.useQuery(
    { dataInicio: inicio.toISOString(), dataFim: fim.toISOString() },
    { refetchOnWindowFocus: false }
  );

  const totais = useMemo(() => {
    if (!data) return { recebidos: 0, perdidos: 0, taxaMedia: 0 };
    const recebidos = data.reduce((s, r) => s + r.recebidos, 0);
    const perdidos = data.reduce((s, r) => s + r.perdidosPorTimer, 0);
    return { recebidos, perdidos, taxaMedia: recebidos > 0 ? Math.round((perdidos / recebidos) * 100) : 0 };
  }, [data]);

  const ordenados = useMemo(() => data ? [...data].sort((a, b) => b.perdidosPorTimer - a.perdidosPorTimer) : [], [data]);

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Total Recebidos" value={totais.recebidos} sub="Leads Facebook ADS distribuídos" icon={Users} color="blue" />
        <KpiCard title="Perdidos por Timer" value={totais.perdidos} sub="Não atendidos em 15 min" icon={XCircle} color="red" />
        <KpiCard title="Taxa de Perda Média" value={fmtPct(totais.taxaMedia)} sub="Percentual perdido sobre recebidos" icon={Activity} color={totais.taxaMedia >= 50 ? "red" : totais.taxaMedia >= 25 ? "yellow" : "green"} />
      </div>

      {ordenados.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhum dado para o período.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">#</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Corretor</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Recebidos</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Perdidos</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Atendidos</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Taxa Perda</th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((row, idx) => (
                <tr key={row.corretorId} className="border-t hover:bg-muted/30">
                  <td className="py-3 px-4 text-muted-foreground text-xs">{idx + 1}</td>
                  <td className="py-3 px-4 font-medium">{row.corretorNome}</td>
                  <td className="py-3 px-4 text-center">{row.recebidos}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={row.perdidosPorTimer > 0 ? "font-semibold text-red-600" : "text-green-600"}>{row.perdidosPorTimer}</span>
                  </td>
                  <td className="py-3 px-4 text-center text-green-600">{row.recebidos - row.perdidosPorTimer}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium ${
                      row.taxaPerda >= 50 ? "bg-red-100 text-red-700" :
                      row.taxaPerda >= 25 ? "bg-yellow-100 text-yellow-700" :
                      row.taxaPerda > 0 ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"
                    }`}>{row.taxaPerda}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPONENTE: Funil Visual
// ============================================================================
function FunilVisual({ dataInicio, dataFim }: { dataInicio?: Date; dataFim?: Date }) {
  const { data, isLoading } = trpc.analytics.funilConversao.useQuery(
    { dataInicio, dataFim },
    { staleTime: 2 * 60 * 1000 }
  );

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!data || data.length === 0) return (
    <div className="text-center py-12 text-muted-foreground text-sm">Sem dados de funil para o período.</div>
  );

  return <FunilChart data={data} title="Funil de Conversão" description="Taxa de conversão entre etapas" />;
}

// ============================================================================
// PÁGINA PRINCIPAL
// ============================================================================
export default function Relatorios() {
  const [periodo, setPeriodo] = useState<string>("this_month");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();

  const getDateRange = (): { dataInicio: Date | undefined; dataFim: Date | undefined } => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    switch (periodo) {
      case "all": return { dataInicio: undefined, dataFim: undefined };
      case "today": return { dataInicio: today, dataFim: endOfToday };
      case "yesterday": {
        const y = new Date(today); y.setDate(today.getDate() - 1);
        const ey = new Date(y); ey.setHours(23,59,59,999);
        return { dataInicio: y, dataFim: ey };
      }
      case "this_week": {
        const sw = new Date(today); sw.setDate(today.getDate() - today.getDay());
        return { dataInicio: sw, dataFim: endOfToday };
      }
      case "last_week": {
        const slw = new Date(today); slw.setDate(today.getDate() - today.getDay() - 7);
        const elw = new Date(slw); elw.setDate(slw.getDate() + 6); elw.setHours(23,59,59,999);
        return { dataInicio: slw, dataFim: elw };
      }
      case "this_month": {
        const sm = new Date(today.getFullYear(), today.getMonth(), 1);
        return { dataInicio: sm, dataFim: endOfToday };
      }
      case "last_month": {
        const slm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const elm = new Date(today.getFullYear(), today.getMonth(), 0); elm.setHours(23,59,59,999);
        return { dataInicio: slm, dataFim: elm };
      }
      case "this_year": {
        const sy = new Date(today.getFullYear(), 0, 1);
        return { dataInicio: sy, dataFim: endOfToday };
      }
      case "custom":
        return customStart && customEnd ? { dataInicio: customStart, dataFim: customEnd } : { dataInicio: undefined, dataFim: undefined };
      default: return { dataInicio: undefined, dataFim: undefined };
    }
  };

  const { dataInicio, dataFim } = getDateRange();

  // KPIs gerais
  const metricsQuery = trpc.dashboard.metrics.useQuery(
    { dataInicio: dataInicio?.toISOString(), dataFim: dataFim?.toISOString() },
    { staleTime: 2 * 60 * 1000 }
  );

  const m = metricsQuery.data;

  // Normalizar campos do metrics
  const kpis = m ? {
    totalLeads: (m as any).total ?? (m as any).totalLeads ?? 0,
    totalAgendamentos: (m as any).agendado ?? (m as any).totalAgendamentos ?? 0,
    totalVisitas: (m as any).visitaRealizada ?? (m as any).totalVisitas ?? 0,
    totalAnalisesCredito: (m as any).analiseCredito ?? (m as any).totalAnalisesCredito ?? 0,
    totalContratos: (m as any).contratoFechado ?? (m as any).totalContratos ?? 0,
    vgvTotal: (m as any).vgv ?? (m as any).vgvTotal ?? 0,
  } : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Central de Relatórios</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Visão gerencial completa da operação — produtividade, funil e performance por corretor
            </p>
          </div>
          <DateRangeFilter
            value={periodo}
            onChange={(value, start, end) => {
              setPeriodo(value);
              setCustomStart(start);
              setCustomEnd(end);
            }}
          />
        </div>

        {/* ── BLOCO 1: KPIs rápidos ── */}
        {metricsQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-5 pb-4"><div className="h-16 bg-muted/40 rounded animate-pulse" /></CardContent></Card>
            ))}
          </div>
        ) : kpis ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard title="Leads" value={kpis!.totalLeads} sub="no período" icon={Users} color="blue" />
            <KpiCard title="Agendamentos" value={kpis!.totalAgendamentos} sub="no período" icon={Calendar} color="purple" />
            <KpiCard title="Visitas" value={kpis!.totalVisitas} sub="realizadas" icon={MapPin} color="yellow" />
            <KpiCard title="Análises" value={kpis!.totalAnalisesCredito} sub="de crédito" icon={FileText} color="blue" />
            <KpiCard title="Contratos" value={kpis!.totalContratos} sub="fechados" icon={Home} color="green" />
            <KpiCard title="VGV" value={fmtMoeda(kpis!.vgvTotal)} sub="total no período" icon={BarChart2} color="green" />
          </div>
        ) : null}

        {/* ── BLOCO 2: Tabs principais ── */}
        <Tabs defaultValue="producao" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5">
            <TabsTrigger value="producao" className="flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5" /> Produção por Corretor
            </TabsTrigger>
            <TabsTrigger value="funil" className="flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5" /> Funil
            </TabsTrigger>
            <TabsTrigger value="facebook-timer" className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Facebook Timer
            </TabsTrigger>
            <TabsTrigger value="evolucao" className="flex items-center gap-1.5 hidden lg:flex">
              <TrendingUp className="h-3.5 w-3.5" /> Evolução
            </TabsTrigger>
            <TabsTrigger value="origem" className="flex items-center gap-1.5 hidden lg:flex">
              <Activity className="h-3.5 w-3.5" /> Origem
            </TabsTrigger>
          </TabsList>

          {/* ABA: PRODUÇÃO POR CORRETOR */}
          <TabsContent value="producao" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Produção por Corretor — Funil Completo</CardTitle>
                <CardDescription>
                  Leads → Agendamentos → Visitas → Análises de Crédito → Contratos, com taxas de conversão entre etapas.
                  Clique nos cabeçalhos para ordenar.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TabelaProducao dataInicio={dataInicio} dataFim={dataFim} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA: FUNIL */}
          <TabsContent value="funil" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Funil de Conversão</CardTitle>
                <CardDescription>Visualização das etapas do funil e taxas de conversão entre elas.</CardDescription>
              </CardHeader>
              <CardContent>
                <FunilVisual dataInicio={dataInicio} dataFim={dataFim} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA: FACEBOOK TIMER */}
          <TabsContent value="facebook-timer" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Leads Facebook ADS — Perdidos por Timer</CardTitle>
                <CardDescription>
                  Leads recebidos via Facebook ADS que foram redistribuídos automaticamente por não atendimento em 15 minutos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FacebookTimerRelatorio dataInicio={dataInicio} dataFim={dataFim} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA: EVOLUÇÃO */}
          <TabsContent value="evolucao" className="space-y-4">
            <EvolucaoTab dataInicio={dataInicio} dataFim={dataFim} />
          </TabsContent>

          {/* ABA: ORIGEM */}
          <TabsContent value="origem" className="space-y-4">
            <OrigemTab dataInicio={dataInicio} dataFim={dataFim} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ============================================================================
// ABA: EVOLUÇÃO
// ============================================================================
function EvolucaoTab({ dataInicio, dataFim }: { dataInicio?: Date; dataFim?: Date }) {
  const evolucaoInicio = dataInicio ?? new Date(new Date().setMonth(new Date().getMonth() - 3));
  const evolucaoFim = dataFim ?? new Date();

  const { data, isLoading } = trpc.analytics.evolucaoVendas.useQuery(
    { dataInicio: evolucaoInicio, dataFim: evolucaoFim, agrupamento: "mes" },
    { staleTime: 2 * 60 * 1000 }
  );

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!data || data.length === 0) return (
    <Card><CardContent className="pt-6"><p className="text-center text-muted-foreground py-8 text-sm">Sem dados de evolução para o período.</p></CardContent></Card>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Evolução de Vendas (VGV)</CardTitle>
        <CardDescription>Valor total de vendas por período</CardDescription>
      </CardHeader>
      <CardContent>
        <LineChart
          data={data}
          dataKeys={[
            { key: "vgv", name: "VGV (R$)", color: "hsl(var(--primary))" },
            { key: "quantidade", name: "Quantidade", color: "hsl(var(--chart-2))" }
          ]}
          xAxisKey="periodo"
          title=""
          description=""
          height={350}
        />
      </CardContent>
    </Card>
  );
}

// ============================================================================
// ABA: ORIGEM
// ============================================================================
function OrigemTab({ dataInicio, dataFim }: { dataInicio?: Date; dataFim?: Date }) {
  const { data, isLoading } = trpc.analytics.origemLeadsMaisEfetiva.useQuery(
    { dataInicio, dataFim },
    { staleTime: 2 * 60 * 1000 }
  );

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!data || data.length === 0) return (
    <Card><CardContent className="pt-6"><p className="text-center text-muted-foreground py-8 text-sm">Sem dados de origem para o período.</p></CardContent></Card>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Origem de Leads mais Efetiva</CardTitle>
        <CardDescription>Volume e conversão por canal de origem</CardDescription>
      </CardHeader>
      <CardContent>
        <BarChart
          data={data}
          dataKeys={[
            { key: "totalLeads", name: "Total de Leads", color: "hsl(var(--chart-1))" },
            { key: "leadsFechados", name: "Leads Fechados", color: "hsl(var(--chart-2))" }
          ]}
          xAxisKey="origem"
          title=""
          description=""
          height={350}
        />
      </CardContent>
    </Card>
  );
}
