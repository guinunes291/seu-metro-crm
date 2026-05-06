import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3, TrendingUp, TrendingDown, Users, Target, AlertTriangle,
  CalendarX, ArrowRight, ChevronDown, ChevronUp, Filter,
  Building2, Layers, PieChart, Activity, Zap, CheckCircle2, XCircle, CalendarCheck
} from "lucide-react";

// ============================================================================
// HELPERS
// ============================================================================

function formatCurrency(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);
}

function formatCurrencyCompact(centavos: number): string {
  const reais = centavos / 100;
  if (reais >= 1_000_000) return `R$ ${(reais / 1_000_000).toFixed(1)}M`;
  if (reais >= 1_000) return `R$ ${(reais / 1_000).toFixed(0)}k`;
  return formatCurrency(centavos);
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function getStatusColor(percentual: number): string {
  if (percentual >= 80) return "text-emerald-600";
  if (percentual >= 50) return "text-amber-600";
  return "text-red-600";
}

function getStatusBg(percentual: number): string {
  if (percentual >= 80) return "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800";
  if (percentual >= 50) return "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800";
  return "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800";
}

function getSemaforoBg(status: string): string {
  if (status === "verde") return "bg-emerald-500";
  if (status === "amarelo") return "bg-amber-500";
  return "bg-red-500";
}

function getProgressColor(percentual: number): string {
  if (percentual >= 80) return "bg-emerald-500";
  if (percentual >= 50) return "bg-amber-500";
  return "bg-red-500";
}

// ============================================================================
// FILTROS
// ============================================================================

type PeriodoPreset = "mes_atual" | "mes_anterior" | "trimestre" | "semestre" | "ano";

function getPeriodoDatas(preset: PeriodoPreset): { dataInicio: Date; dataFim: Date; mes: number; ano: number } {
  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  switch (preset) {
    case "mes_atual":
      return {
        dataInicio: new Date(anoAtual, mesAtual, 1),
        dataFim: new Date(anoAtual, mesAtual + 1, 0, 23, 59, 59, 999),
        mes: mesAtual + 1,
        ano: anoAtual,
      };
    case "mes_anterior": {
      const mesAnterior = mesAtual === 0 ? 11 : mesAtual - 1;
      const anoMesAnterior = mesAtual === 0 ? anoAtual - 1 : anoAtual;
      return {
        dataInicio: new Date(anoMesAnterior, mesAnterior, 1),
        dataFim: new Date(anoMesAnterior, mesAnterior + 1, 0, 23, 59, 59, 999),
        mes: mesAnterior + 1,
        ano: anoMesAnterior,
      };
    }
    case "trimestre":
      return {
        dataInicio: new Date(anoAtual, mesAtual - 2, 1),
        dataFim: new Date(anoAtual, mesAtual + 1, 0, 23, 59, 59, 999),
        mes: mesAtual + 1,
        ano: anoAtual,
      };
    case "semestre":
      return {
        dataInicio: new Date(anoAtual, mesAtual - 5, 1),
        dataFim: new Date(anoAtual, mesAtual + 1, 0, 23, 59, 59, 999),
        mes: mesAtual + 1,
        ano: anoAtual,
      };
    case "ano":
      return {
        dataInicio: new Date(anoAtual, 0, 1),
        dataFim: new Date(anoAtual, 11, 31, 23, 59, 59, 999),
        mes: mesAtual + 1,
        ano: anoAtual,
      };
    default:
      return {
        dataInicio: new Date(anoAtual, mesAtual, 1),
        dataFim: new Date(anoAtual, mesAtual + 1, 0, 23, 59, 59, 999),
        mes: mesAtual + 1,
        ano: anoAtual,
      };
  }
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function Relatorios() {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState<PeriodoPreset>("mes_atual");
  const [abaAtiva, setAbaAtiva] = useState("producao");

  const datas = useMemo(() => getPeriodoDatas(periodo), [periodo]);
  const inputDatas = useMemo(() => ({
    dataInicio: datas.dataInicio.toISOString(),
    dataFim: datas.dataFim.toISOString(),
  }), [datas]);

  // Queries
  const visaoGeral = trpc.centralAnalises.visaoGeral.useQuery({
    ...inputDatas,
    mes: datas.mes,
    ano: datas.ano,
  });

  const producao = trpc.relatorios.producaoPorCorretor.useQuery({
    dataInicio: inputDatas.dataInicio,
    dataFim: inputDatas.dataFim,
  });

  const comparativoEquipes = trpc.centralAnalises.comparativoEquipes.useQuery(inputDatas);
  const funilGargalos = trpc.centralAnalises.funilGargalos.useQuery(inputDatas);
  const metasProgresso = trpc.centralAnalises.metasProgresso.useQuery({ mes: datas.mes, ano: datas.ano });
  const evolucao = trpc.centralAnalises.evolucaoTemporal.useQuery({
    ...inputDatas,
    agrupamento: periodo === "ano" || periodo === "semestre" ? "mes" : periodo === "trimestre" ? "semana" : "dia",
  });
  const origens = trpc.centralAnalises.origensConversao.useQuery(inputDatas);
  const facebookTimer = trpc.relatorios.leadsTimerPorCorretor.useQuery({
    dataInicio: inputDatas.dataInicio,
    dataFim: inputDatas.dataFim,
  });

  const showRate = trpc.relatoriosGestor.showRate.useQuery({
    dataInicio: inputDatas.dataInicio,
    dataFim: inputDatas.dataFim,
  }, { enabled: abaAtiva === 'show_rate' });

  const isLoading = visaoGeral.isLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-7 w-7 text-primary" />
              Central de Análises
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Visão estratégica completa da operação</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
              <Filter className="h-4 w-4 text-muted-foreground ml-2" />
              <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoPreset)}>
                <SelectTrigger className="w-[180px] border-0 bg-transparent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mes_atual">Mês Atual</SelectItem>
                  <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
                  <SelectItem value="trimestre">Último Trimestre</SelectItem>
                  <SelectItem value="semestre">Último Semestre</SelectItem>
                  <SelectItem value="ano">Ano Inteiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Painel Executivo — KPIs */}
        <PainelExecutivo data={visaoGeral.data} isLoading={isLoading} />

        {/* Alertas */}
        {visaoGeral.data?.alertas && visaoGeral.data.alertas.length > 0 && (
          <PainelAlertas alertas={visaoGeral.data.alertas} />
        )}

        {/* Abas */}
        <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="producao" className="gap-1.5 text-xs sm:text-sm">
              <Activity className="h-3.5 w-3.5" /> Produtividade
            </TabsTrigger>
            <TabsTrigger value="equipes" className="gap-1.5 text-xs sm:text-sm">
              <Users className="h-3.5 w-3.5" /> Equipes
            </TabsTrigger>
            <TabsTrigger value="funil" className="gap-1.5 text-xs sm:text-sm">
              <Layers className="h-3.5 w-3.5" /> Funil
            </TabsTrigger>
            <TabsTrigger value="metas" className="gap-1.5 text-xs sm:text-sm">
              <Target className="h-3.5 w-3.5" /> Metas
            </TabsTrigger>
            <TabsTrigger value="evolucao" className="gap-1.5 text-xs sm:text-sm">
              <TrendingUp className="h-3.5 w-3.5" /> Evolução
            </TabsTrigger>
            <TabsTrigger value="origens" className="gap-1.5 text-xs sm:text-sm">
              <PieChart className="h-3.5 w-3.5" /> Origens
            </TabsTrigger>
            <TabsTrigger value="facebook" className="gap-1.5 text-xs sm:text-sm">
              <Zap className="h-3.5 w-3.5" /> Facebook ADS
            </TabsTrigger>
            <TabsTrigger value="show_rate" className="gap-1.5 text-xs sm:text-sm">
              <CalendarCheck className="h-3.5 w-3.5" /> Show Rate
            </TabsTrigger>
          </TabsList>

          <TabsContent value="producao" className="mt-4">
            <AbaProducao data={producao.data} isLoading={producao.isLoading} />
          </TabsContent>

          <TabsContent value="equipes" className="mt-4">
            <AbaEquipes data={comparativoEquipes.data} isLoading={comparativoEquipes.isLoading} />
          </TabsContent>

          <TabsContent value="funil" className="mt-4">
            <AbaFunil data={funilGargalos.data} isLoading={funilGargalos.isLoading} />
          </TabsContent>

          <TabsContent value="metas" className="mt-4">
            <AbaMetas data={metasProgresso.data} isLoading={metasProgresso.isLoading} />
          </TabsContent>

          <TabsContent value="evolucao" className="mt-4">
            <AbaEvolucao data={evolucao.data} isLoading={evolucao.isLoading} periodo={periodo} />
          </TabsContent>

          <TabsContent value="origens" className="mt-4">
            <AbaOrigens data={origens.data} isLoading={origens.isLoading} />
          </TabsContent>

          <TabsContent value="facebook" className="mt-4">
            <AbaFacebook data={facebookTimer.data} isLoading={facebookTimer.isLoading} />
          </TabsContent>

          <TabsContent value="show_rate" className="mt-4">
            <AbaShowRate data={showRate.data} isLoading={showRate.isLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ============================================================================
// PAINEL EXECUTIVO
// ============================================================================

function PainelExecutivo({ data, isLoading }: { data: any; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border">
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const kpis = data?.kpis;
  if (!kpis) return null;

  const cards = [
    { label: "Leads", valor: kpis.leads.valor, meta: kpis.leads.meta, pct: kpis.leads.percentual, icon: Users, format: "number" as const },
    { label: "Agendamentos", valor: kpis.agendamentos.valor, meta: kpis.agendamentos.meta, pct: kpis.agendamentos.percentual, icon: CalendarX, format: "number" as const },
    { label: "Visitas", valor: kpis.visitas.valor, meta: kpis.visitas.meta, pct: kpis.visitas.percentual, icon: Building2, format: "number" as const },
    { label: "Contratos", valor: kpis.contratos_val.valor, meta: kpis.contratos_val.meta, pct: kpis.contratos_val.percentual, icon: Target, format: "number" as const },
    { label: "VGV", valor: kpis.vgv.valor, meta: kpis.vgv.meta, pct: kpis.vgv.percentual, icon: TrendingUp, format: "currency" as const },
    { label: "Tx. Conversão", valor: kpis.taxaConversao, meta: 0, pct: 0, icon: BarChart3, format: "percent" as const },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        const hasMeta = card.meta > 0;
        return (
          <Card key={card.label} className={`border transition-all hover:shadow-md ${hasMeta ? getStatusBg(card.pct) : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{card.label}</span>
                <Icon className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <div className={`text-xl font-bold ${hasMeta ? getStatusColor(card.pct) : "text-foreground"}`}>
                {card.format === "currency" ? formatCurrencyCompact(card.valor) :
                 card.format === "percent" ? `${card.valor}%` :
                 formatNumber(card.valor)}
              </div>
              {hasMeta ? (
                <div className="mt-1.5">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Meta: {card.format === "currency" ? formatCurrencyCompact(card.meta) : formatNumber(card.meta)}</span>
                    <span className={`font-semibold ${getStatusColor(card.pct)}`}>{card.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${getProgressColor(card.pct)}`} style={{ width: `${Math.min(card.pct, 100)}%` }} />
                  </div>
                </div>
              ) : card.format === "percent" ? (
                <p className="text-[10px] text-muted-foreground mt-1">Leads &rarr; Contratos</p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================================
// PAINEL DE ALERTAS
// ============================================================================

function PainelAlertas({ alertas }: { alertas: Array<{ tipo: string; titulo: string; descricao: string; icone: string }> }) {
  const [expandido, setExpandido] = useState(false);
  const visiveis = expandido ? alertas : alertas.slice(0, 2);

  return (
    <div className="space-y-2">
      {visiveis.map((alerta, i) => (
        <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${
          alerta.tipo === "perigo" ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800" :
          alerta.tipo === "atencao" ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800" :
          "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800"
        }`}>
          <AlertTriangle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
            alerta.tipo === "perigo" ? "text-red-600" :
            alerta.tipo === "atencao" ? "text-amber-600" :
            "text-blue-600"
          }`} />
          <div className="min-w-0">
            <p className={`text-sm font-medium ${
              alerta.tipo === "perigo" ? "text-red-800 dark:text-red-200" :
              alerta.tipo === "atencao" ? "text-amber-800 dark:text-amber-200" :
              "text-blue-800 dark:text-blue-200"
            }`}>{alerta.titulo}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{alerta.descricao}</p>
          </div>
        </div>
      ))}
      {alertas.length > 2 && (
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => setExpandido(!expandido)}>
          {expandido ? "Mostrar menos" : `Ver mais ${alertas.length - 2} alertas`}
          {expandido ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// ABA: PRODUTIVIDADE
// ============================================================================

function AbaProducao({ data, isLoading }: { data: any; isLoading: boolean }) {
  const [ordenacao, setOrdenacao] = useState<string>("leads");
  const [direcao, setDirecao] = useState<"asc" | "desc">("desc");

  if (isLoading) return <TableSkeleton rows={8} cols={10} />;
  if (!data || data.length === 0) return <EmptyState message="Nenhum dado de produção encontrado para o período selecionado." />;

  const sorted = [...data].sort((a: any, b: any) => {
    const va = a[ordenacao] ?? 0;
    const vb = b[ordenacao] ?? 0;
    return direcao === "desc" ? vb - va : va - vb;
  });

  const handleSort = (col: string) => {
    if (ordenacao === col) {
      setDirecao(d => d === "desc" ? "asc" : "desc");
    } else {
      setOrdenacao(col);
      setDirecao("desc");
    }
  };

  const totais = {
    leads: data.reduce((s: number, c: any) => s + c.leads, 0),
    agendamentos: data.reduce((s: number, c: any) => s + c.agendamentos, 0),
    visitas: data.reduce((s: number, c: any) => s + c.visitas, 0),
    analises: data.reduce((s: number, c: any) => s + c.analises, 0),
    contratos: data.reduce((s: number, c: any) => s + c.contratos, 0),
    vgv: data.reduce((s: number, c: any) => s + c.vgv, 0),
  };

  const zerados = data.filter((r: any) => r.agendamentos === 0 && r.leads > 0).length;
  const topPerformers = data.filter((r: any) => r.contratos > 0).length;

  const SortHeader = ({ col, label, className = "" }: { col: string; label: string; className?: string }) => (
    <th
      className={`px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors ${className}`}
      onClick={() => handleSort(col)}
    >
      <div className="flex items-center gap-1">
        {label}
        {ordenacao === col && (direcao === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)}
      </div>
    </th>
  );

  return (
    <div className="space-y-4">
      {/* Alertas rápidos */}
      <div className="flex flex-wrap gap-3">
        {zerados > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-1.5 dark:bg-red-950/20 dark:border-red-800 dark:text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span><strong>{zerados}</strong> corretor{zerados > 1 ? "es" : ""} sem agendamentos no período</span>
          </div>
        )}
        {topPerformers > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 border border-green-200 rounded-md px-3 py-1.5 dark:bg-green-950/20 dark:border-green-800 dark:text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span><strong>{topPerformers}</strong> corretor{topPerformers > 1 ? "es" : ""} com contrato fechado</span>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Produção por Corretor — Funil Completo
          </CardTitle>
          <CardDescription>
            Leads &rarr; Agendamentos &rarr; Visitas &rarr; Análises &rarr; Contratos, com taxas de conversão entre etapas.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-y">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground w-8">#</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Corretor</th>
                  <SortHeader col="leads" label="Leads" />
                  <SortHeader col="agendamentos" label="Agend." />
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">Tx%</th>
                  <SortHeader col="visitas" label="Visitas" />
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">Tx%</th>
                  <SortHeader col="analises" label="Análises" />
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">Tx%</th>
                  <SortHeader col="contratos" label="Contratos" />
                  <SortHeader col="vgv" label="VGV" />
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((c: any, i: number) => {
                  const isTop = c.contratos > 0;
                  const isZero = c.agendamentos === 0 && c.leads > 0;
                  return (
                    <tr key={c.id} className={`transition-colors ${
                      isTop ? "bg-green-50/30 hover:bg-green-50/60 dark:bg-green-950/10 dark:hover:bg-green-950/20" :
                      isZero ? "bg-red-50/20 hover:bg-red-50/40 dark:bg-red-950/10 dark:hover:bg-red-950/20" :
                      "hover:bg-muted/30"
                    }`}>
                      <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">{i + 1}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          {c.fotoUrl ? (
                            <img src={c.fotoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                          ) : (
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {(c.nome || "?")[0]}
                            </div>
                          )}
                          <span className="font-medium text-sm truncate max-w-[120px]">{c.nome}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-semibold">{c.leads}</td>
                      <td className="px-3 py-2.5">
                        <span className={c.agendamentos === 0 && c.leads > 0 ? "text-red-500 font-semibold" : ""}>{c.agendamentos}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <TaxaBadge valor={c.txAgend} limites={[30, 15]} show={c.leads > 0} />
                      </td>
                      <td className="px-3 py-2.5">{c.visitas}</td>
                      <td className="px-3 py-2.5 text-center">
                        <TaxaBadge valor={c.txVisita} limites={[50, 25]} show={c.agendamentos > 0} />
                      </td>
                      <td className="px-3 py-2.5">{c.analises}</td>
                      <td className="px-3 py-2.5 text-center">
                        <TaxaBadge valor={c.txAnalise} limites={[50, 25]} show={c.visitas > 0} />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={c.contratos > 0 ? "font-bold text-green-700 dark:text-green-400" : ""}>{c.contratos}</span>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-emerald-700 dark:text-emerald-400 text-right">
                        {c.vgv > 0 ? formatCurrencyCompact(c.vgv) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {c.contratos > 0 ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">Top</Badge>
                        ) : c.agendamentos === 0 && c.leads > 0 ? (
                          <Badge className="bg-red-100 text-red-700 border-red-200 text-xs dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">Atenção</Badge>
                        ) : c.leads === 0 ? (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Sem leads</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Em andamento</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/70 border-t-2">
                <tr className="font-bold">
                  <td className="px-3 py-2.5" colSpan={2}>Total</td>
                  <td className="px-3 py-2.5">{totais.leads}</td>
                  <td className="px-3 py-2.5">{totais.agendamentos}</td>
                  <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">
                    {totais.leads > 0 ? `${Math.round(totais.agendamentos / totais.leads * 100)}%` : "—"}
                  </td>
                  <td className="px-3 py-2.5">{totais.visitas}</td>
                  <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">
                    {totais.agendamentos > 0 ? `${Math.round(totais.visitas / totais.agendamentos * 100)}%` : "—"}
                  </td>
                  <td className="px-3 py-2.5">{totais.analises}</td>
                  <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">
                    {totais.visitas > 0 ? `${Math.round(totais.analises / totais.visitas * 100)}%` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-green-700 dark:text-green-400">{totais.contratos}</td>
                  <td className="px-3 py-2.5 text-right text-emerald-700 dark:text-emerald-400">{totais.vgv > 0 ? formatCurrencyCompact(totais.vgv) : "—"}</td>
                  <td className="px-3 py-2.5" />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// ABA: EQUIPES
// ============================================================================

function AbaEquipes({ data, isLoading }: { data: any; isLoading: boolean }) {
  if (isLoading) return <CardsSkeleton count={4} />;
  if (!data || data.length === 0) return <EmptyState message="Nenhuma equipe encontrada." />;

  return (
    <div className="space-y-4">
      {/* Cards de equipes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((equipe: any) => (
          <Card key={equipe.equipeId} className="border hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: equipe.cor }} />
                  <h3 className="font-semibold text-sm">{equipe.equipeNome}</h3>
                </div>
                <Badge variant="outline" className="text-[10px]">{equipe.corretoresCount} corretores</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Gestor: {equipe.gestorNome}</p>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center">
                  <p className="text-lg font-bold">{equipe.totalLeads}</p>
                  <p className="text-[10px] text-muted-foreground">Leads</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">{equipe.contratosCount}</p>
                  <p className="text-[10px] text-muted-foreground">Contratos</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrencyCompact(equipe.vgv)}</p>
                  <p className="text-[10px] text-muted-foreground">VGV</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Meta VGV</span>
                  <span className={`font-semibold ${getStatusColor(equipe.percentualMeta)}`}>{equipe.percentualMeta}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${getProgressColor(equipe.percentualMeta)}`} style={{ width: `${Math.min(equipe.percentualMeta, 100)}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Tx. Conversão: {equipe.taxaConversao}%</span>
                  <span>Agend: {equipe.agendamentos} | Vis: {equipe.visitas}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela comparativa */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Comparativo entre Equipes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-y">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Equipe</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Gestor</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Leads</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Agend.</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Visitas</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Contratos</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">VGV</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Tx Conv.</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">% Meta</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.map((e: any) => (
                  <tr key={e.equipeId} className="hover:bg-muted/30">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: e.cor }} />
                        <span className="font-medium">{e.equipeNome}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{e.gestorNome}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{e.totalLeads}</td>
                    <td className="px-3 py-2.5 text-right">{e.agendamentos}</td>
                    <td className="px-3 py-2.5 text-right">{e.visitas}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{e.contratosCount}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrencyCompact(e.vgv)}</td>
                    <td className="px-3 py-2.5 text-right">{e.taxaConversao}%</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`font-semibold ${getStatusColor(e.percentualMeta)}`}>{e.percentualMeta}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// ABA: FUNIL & GARGALOS
// ============================================================================

function AbaFunil({ data, isLoading }: { data: any; isLoading: boolean }) {
  if (isLoading) return <CardsSkeleton count={1} />;
  if (!data || data.length === 0) return <EmptyState message="Sem dados de funil para o período." />;

  const etapasFunil = data.filter((e: any) => e.etapa !== "perdido");
  const perdidos = data.find((e: any) => e.etapa === "perdido");
  const maxQuantidade = Math.max(...etapasFunil.map((e: any) => e.quantidade), 1);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Funil de Conversão com Gargalos
          </CardTitle>
          <CardDescription>Identifica automaticamente o ponto de maior perda no funil</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {etapasFunil.map((etapa: any, i: number) => {
              const largura = Math.max((etapa.quantidade / maxQuantidade) * 100, 8);
              const isGargalo = etapa.isGargalo;
              return (
                <div key={etapa.etapa}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{etapa.etapaLabel}</span>
                      {isGargalo && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Gargalo
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{formatNumber(etapa.quantidade)}</span>
                      <span>({etapa.percentualDoTotal}%)</span>
                    </div>
                  </div>
                  <div className="h-8 bg-muted/30 rounded-lg overflow-hidden relative">
                    <div
                      className={`h-full rounded-lg transition-all ${
                        isGargalo ? "bg-red-500/80" : "bg-primary/70"
                      }`}
                      style={{ width: `${largura}%` }}
                    />
                  </div>
                  {i < etapasFunil.length - 1 && (
                    <div className="flex items-center justify-center my-1">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <ArrowRight className="h-3 w-3" />
                        <span>Taxa: <strong className={etapa.taxaConversaoProxima < 30 ? "text-red-600 dark:text-red-400" : etapa.taxaConversaoProxima < 60 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
                          {etapa.taxaConversaoProxima}%
                        </strong></span>
                        {etapa.perda > 0 && <span className="text-red-500 ml-2">(-{formatNumber(etapa.perda)} perdas)</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {perdidos && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-red-800 dark:text-red-200">Leads Perdidos</span>
                <span className="text-lg font-bold text-red-600 dark:text-red-400">{formatNumber(perdidos.quantidade)} ({perdidos.percentualDoTotal}%)</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// ABA: METAS
// ============================================================================

function AbaMetas({ data, isLoading }: { data: any; isLoading: boolean }) {
  if (isLoading) return <TableSkeleton rows={8} cols={8} />;
  if (!data || data.length === 0) return <EmptyState message="Nenhuma meta definida para o período." />;

  const comMeta = data.filter((c: any) => c.metaVGV > 0 || c.metaContratos > 0);
  const semMeta = data.filter((c: any) => c.metaVGV === 0 && c.metaContratos === 0);

  return (
    <div className="space-y-4">
      {/* Resumo semáforo */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{comMeta.filter((c: any) => c.status === "verde").length}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">No ritmo</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{comMeta.filter((c: any) => c.status === "amarelo").length}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400">Atenção</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-700 dark:text-red-400">{comMeta.filter((c: any) => c.status === "vermelho").length}</p>
            <p className="text-xs text-red-600 dark:text-red-400">Em risco</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de metas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Progresso Individual com Projeção</CardTitle>
          <CardDescription>Semáforo baseado no ritmo esperado vs. realizado. Projeção linear e ritmo diário necessário.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-y">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground w-8"></th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Corretor</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Equipe</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">Contratos</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">VGV</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">% VGV</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">Projeção</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">Ritmo/dia</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {comMeta.map((c: any) => (
                  <tr key={c.corretorId} className="hover:bg-muted/30">
                    <td className="px-3 py-2.5">
                      <div className={`h-3 w-3 rounded-full ${getSemaforoBg(c.status)}`} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {c.fotoUrl ? (
                          <img src={c.fotoUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                            {(c.corretorNome || "?")[0]}
                          </div>
                        )}
                        <span className="font-medium text-sm truncate max-w-[120px]">{c.corretorNome}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{c.equipeNome || "—"}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="font-semibold">{c.realizadoContratos}</span>
                      <span className="text-muted-foreground">/{c.metaContratos}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="font-semibold">{formatCurrencyCompact(c.realizadoVGV)}</span>
                      <span className="text-[10px] text-muted-foreground block">de {formatCurrencyCompact(c.metaVGV)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`font-bold ${getStatusColor(c.percentualVGV)}`}>{c.percentualVGV}%</span>
                        <div className="w-16 h-1.5 bg-muted rounded-full mt-1">
                          <div className={`h-full rounded-full ${getProgressColor(c.percentualVGV)}`} style={{ width: `${Math.min(c.percentualVGV, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs">
                      {c.projecaoVGV > 0 ? formatCurrencyCompact(c.projecaoVGV) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs">
                      {c.ritmoNecessario > 0 ? formatCurrencyCompact(c.ritmoNecessario) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {semMeta.length > 0 && (
        <div className="p-3 bg-muted/30 rounded-lg border border-dashed">
          <p className="text-xs text-muted-foreground">
            <strong>{semMeta.length}</strong> corretor(es) sem meta definida: {semMeta.slice(0, 5).map((c: any) => c.corretorNome).join(", ")}
            {semMeta.length > 5 && ` e mais ${semMeta.length - 5}`}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ABA: EVOLUÇÃO
// ============================================================================

function AbaEvolucao({ data, isLoading, periodo }: { data: any; isLoading: boolean; periodo: string }) {
  if (isLoading) return <CardsSkeleton count={1} />;
  if (!data || data.length === 0) return <EmptyState message="Sem dados de evolução para o período." />;

  const maxLeads = Math.max(...data.map((d: any) => d.leads), 1);

  return (
    <div className="space-y-4">
      {/* Gráfico de barras para leads */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Evolução de Leads no Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {data.slice(-20).map((d: any) => {
              const largura = (d.leads / maxLeads) * 100;
              return (
                <div key={d.periodo} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-16 text-right font-mono">{d.periodo.slice(-5)}</span>
                  <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden">
                    <div className="h-full bg-blue-500/70 rounded" style={{ width: `${largura}%` }} />
                  </div>
                  <span className="text-xs font-mono w-8 text-right">{d.leads}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabela de evolução */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detalhamento por Período</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-y">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Período</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Leads</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Agend.</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Visitas</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Contratos</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">VGV</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.map((d: any) => (
                  <tr key={d.periodo} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{d.periodo}</td>
                    <td className="px-3 py-2 text-right font-semibold">{d.leads}</td>
                    <td className="px-3 py-2 text-right">{d.agendamentos}</td>
                    <td className="px-3 py-2 text-right">{d.visitas}</td>
                    <td className="px-3 py-2 text-right font-semibold">{d.contratos_val}</td>
                    <td className="px-3 py-2 text-right text-emerald-700 dark:text-emerald-400">{formatCurrency(d.vgv)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 border-t-2">
                <tr className="font-bold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">{data.reduce((s: number, d: any) => s + d.leads, 0)}</td>
                  <td className="px-3 py-2 text-right">{data.reduce((s: number, d: any) => s + d.agendamentos, 0)}</td>
                  <td className="px-3 py-2 text-right">{data.reduce((s: number, d: any) => s + d.visitas, 0)}</td>
                  <td className="px-3 py-2 text-right">{data.reduce((s: number, d: any) => s + d.contratos_val, 0)}</td>
                  <td className="px-3 py-2 text-right text-emerald-700 dark:text-emerald-400">{formatCurrency(data.reduce((s: number, d: any) => s + d.vgv, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// ABA: ORIGENS
// ============================================================================

function AbaOrigens({ data, isLoading }: { data: any; isLoading: boolean }) {
  if (isLoading) return <TableSkeleton rows={6} cols={7} />;
  if (!data || data.length === 0) return <EmptyState message="Sem dados de origem para o período." />;

  const totalLeads = data.reduce((s: number, o: any) => s + o.totalLeads, 0);

  const origemLabels: Record<string, string> = {
    facebook: "Facebook ADS",
    instagram: "Instagram",
    google: "Google ADS",
    indicacao: "Indicação",
    site: "Site",
    captacao_corretor: "Captação Própria",
    rdstation: "RD Station",
    outro: "Outro",
    webhook: "Webhook",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <PieChart className="h-4 w-4" />
          Análise por Origem — Volume, Conversão e VGV
        </CardTitle>
        <CardDescription>Qual canal traz mais leads e qual converte melhor?</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-y">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Origem</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Leads</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">% Total</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Atend.</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Agend.</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Contratos</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Tx Conv.</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">VGV</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Perdidos</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((o: any) => {
                const pctTotal = totalLeads > 0 ? Math.round((o.totalLeads / totalLeads) * 100) : 0;
                return (
                  <tr key={o.origem} className="hover:bg-muted/30">
                    <td className="px-3 py-2.5 font-medium">{origemLabels[o.origem] || o.origem}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{o.totalLeads}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <div className="w-12 h-1.5 bg-muted rounded-full">
                          <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pctTotal}%` }} />
                        </div>
                        <span className="text-xs">{pctTotal}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">{o.emAtendimento}</td>
                    <td className="px-3 py-2.5 text-right">{o.agendados}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{o.contratosFechados}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`font-semibold ${o.taxaConversao >= 2 ? "text-emerald-600 dark:text-emerald-400" : o.taxaConversao >= 0.5 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                        {o.taxaConversao}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-emerald-700 dark:text-emerald-400">{formatCurrencyCompact(o.vgv)}</td>
                    <td className="px-3 py-2.5 text-right text-red-600 dark:text-red-400">{o.perdidos}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// ABA: FACEBOOK ADS
// ============================================================================

function AbaFacebook({ data, isLoading }: { data: any; isLoading: boolean }) {
  if (isLoading) return <TableSkeleton rows={6} cols={5} />;
  if (!data || data.length === 0) return <EmptyState message="Sem dados de Facebook ADS para o período." />;

  const totalRecebidos = data.reduce((s: number, c: any) => s + c.recebidos, 0);
  const totalPerdidos = data.reduce((s: number, c: any) => s + c.perdidosPorTimer, 0);
  const taxaGeralPerda = totalRecebidos > 0 ? Math.round((totalPerdidos / totalRecebidos) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{totalRecebidos}</p>
            <p className="text-xs text-muted-foreground">Leads Recebidos</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{totalPerdidos}</p>
            <p className="text-xs text-red-600 dark:text-red-400">Perdidos por Timer</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${taxaGeralPerda > 20 ? "text-red-600 dark:text-red-400" : taxaGeralPerda > 10 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>{taxaGeralPerda}%</p>
            <p className="text-xs text-muted-foreground">Taxa de Perda</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela por corretor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Leads Facebook por Corretor — Perdidos por Timer
          </CardTitle>
          <CardDescription>Leads redistribuídos automaticamente por não atendimento em 15 minutos.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-y">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Corretor</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Recebidos</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Perdidos Timer</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Taxa Perda</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Atendidos</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.filter((c: any) => c.recebidos > 0).sort((a: any, b: any) => b.recebidos - a.recebidos).map((c: any) => (
                  <tr key={c.corretorId} className="hover:bg-muted/30">
                    <td className="px-3 py-2.5 font-medium">{c.corretorNome}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{c.recebidos}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={c.perdidosPorTimer > 0 ? "font-semibold text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>{c.perdidosPorTimer}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium ${
                        c.taxaPerda >= 50 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                        c.taxaPerda >= 25 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                        c.taxaPerda > 0 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      }`}>{c.taxaPerda}%</span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-emerald-600 dark:text-emerald-400 font-semibold">{c.recebidos - c.perdidosPorTimer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================

function TaxaBadge({ valor, limites, show }: { valor: number; limites: [number, number]; show: boolean }) {
  if (!show) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${
      valor >= limites[0] ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
      valor >= limites[1] ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    }`}>{valor}%</span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <BarChart3 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

function TableSkeleton({ rows, cols }: { rows: number; cols: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-3">
              {Array.from({ length: cols }).map((_, j) => (
                <Skeleton key={j} className="h-5 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CardsSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// ABA SHOW RATE
// ============================================================================

function AbaShowRate({ data, isLoading }: { data: any[] | undefined; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-8 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <CalendarCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Nenhum agendamento no período selecionado.</p>
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((acc: number, r: any) => acc + r.total, 0);
  const totalRealizados = data.reduce((acc: number, r: any) => acc + r.realizados, 0);
  const taxaMedia = total > 0 ? Math.round((totalRealizados / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Resumo geral */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total de Agendamentos', value: total, color: 'text-foreground' },
          { label: 'Realizados', value: totalRealizados, color: 'text-green-600 dark:text-green-400' },
          { label: 'Não Compareceram', value: data.reduce((a: number, r: any) => a + r.naoCompareceram, 0), color: 'text-red-600 dark:text-red-400' },
          { label: 'Taxa de Show Média', value: `${taxaMedia}%`, color: taxaMedia >= 70 ? 'text-green-600 dark:text-green-400' : taxaMedia >= 50 ? 'text-yellow-600' : 'text-red-600 dark:text-red-400' },
        ].map(item => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela por corretor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Show Rate por Corretor</CardTitle>
          <CardDescription>Agendamentos realizados vs. total de agendamentos no período</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="px-4 py-3 text-muted-foreground font-medium">Corretor</th>
                  <th className="px-4 py-3 text-muted-foreground font-medium text-right">Total</th>
                  <th className="px-4 py-3 text-muted-foreground font-medium text-right">Realizados</th>
                  <th className="px-4 py-3 text-muted-foreground font-medium text-right">Não Comp.</th>
                  <th className="px-4 py-3 text-muted-foreground font-medium text-right">Pendentes</th>
                  <th className="px-4 py-3 text-muted-foreground font-medium text-right">Show Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row: any) => (
                  <tr key={row.corretorId} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{row.corretorNome}</td>
                    <td className="px-4 py-3 text-right">{row.total}</td>
                    <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">{row.realizados}</td>
                    <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">{row.naoCompareceram}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{row.pendentes}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${
                        row.taxaShow >= 70 ? 'text-green-600 dark:text-green-400' :
                        row.taxaShow >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {row.taxaShow}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
