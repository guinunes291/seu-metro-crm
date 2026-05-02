import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Phone, MessageSquare, Calendar, Eye, FileText, CheckCircle2,
  XCircle, TrendingUp, Users, DollarSign, Target, RefreshCw,
  ClipboardList, Award, BarChart3
} from "lucide-react";

// ============================================================================
// TIPOS
// ============================================================================
type PeriodoOption = "hoje" | "ontem" | "semana" | "mes" | "personalizado";

// ============================================================================
// HELPERS
// ============================================================================
function getPeriodo(
  opcao: PeriodoOption,
  customInicio?: Date,
  customFim?: Date
): { inicio: Date; fim: Date } {
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

  switch (opcao) {
    case "hoje":
      return {
        inicio: hoje,
        fim: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999),
      };
    case "ontem": {
      const ontem = new Date(hoje);
      ontem.setDate(ontem.getDate() - 1);
      return {
        inicio: ontem,
        fim: new Date(ontem.getFullYear(), ontem.getMonth(), ontem.getDate(), 23, 59, 59, 999),
      };
    }
    case "semana": {
      const inicioSemana = new Date(hoje);
      inicioSemana.setDate(hoje.getDate() - hoje.getDay());
      return {
        inicio: inicioSemana,
        fim: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999),
      };
    }
    case "mes": {
      return {
        inicio: new Date(agora.getFullYear(), agora.getMonth(), 1),
        fim: new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999),
      };
    }
    case "personalizado":
      if (customInicio && customFim) {
        return {
          inicio: customInicio,
          fim: new Date(customFim.getFullYear(), customFim.getMonth(), customFim.getDate(), 23, 59, 59, 999),
        };
      }
      return getPeriodo("hoje");
    default:
      return getPeriodo("hoje");
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

function getScoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-500/20 border-emerald-500/30";
  if (score >= 50) return "bg-amber-500/20 border-amber-500/30";
  return "bg-red-500/20 border-red-500/30";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excelente";
  if (score >= 60) return "Bom";
  if (score >= 40) return "Regular";
  return "Abaixo da meta";
}

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================
function MetricCard({
  icon: Icon,
  label,
  value,
  meta,
  color,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  meta?: number;
  color?: string;
  sub?: string;
}) {
  const numValue = typeof value === "number" ? value : 0;
  const pct = meta ? Math.min(100, Math.round((numValue / meta) * 100)) : null;

  return (
    <Card className="bg-card/60 border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${color || "bg-primary/10"}`}>
            <Icon className={`h-4 w-4 ${color ? "text-white" : "text-primary"}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-2xl font-bold leading-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            {pct !== null && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Meta: {meta}</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChecklistItem({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
      {checked ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
      ) : (
        <XCircle className="h-5 w-5 text-red-400 shrink-0" />
      )}
      <span className={`text-sm ${checked ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
    </div>
  );
}

function FunnelBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-28 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-semibold w-8 text-right">{value}</span>
    </div>
  );
}

// ============================================================================
// PÁGINA PRINCIPAL
// ============================================================================
export default function RelatorioDiarioCorretor() {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState<PeriodoOption>("hoje");
  const [customInicio, setCustomInicio] = useState<string>("");
  const [customFim, setCustomFim] = useState<string>("");
  const [corretorFiltro, setCorretorFiltro] = useState<string>("__self__");

  const isGestor =
    user?.role === "gestor" ||
    user?.role === "admin" ||
    user?.role === "superintendente";

  const { inicio, fim } = useMemo(() => {
    if (periodo === "personalizado" && customInicio && customFim) {
      return getPeriodo("personalizado", new Date(customInicio), new Date(customFim));
    }
    return getPeriodo(periodo);
  }, [periodo, customInicio, customFim]);

  const corretorIdParam = useMemo(() => {
    if (!isGestor) return undefined;
    if (corretorFiltro === "__self__") return undefined;
    const n = parseInt(corretorFiltro);
    return isNaN(n) ? undefined : n;
  }, [isGestor, corretorFiltro]);

  const { data, isLoading, refetch } = trpc.relatorioDiario.getDiario.useQuery(
    { inicio, fim, corretorId: corretorIdParam },
    { refetchOnWindowFocus: false }
  );

  const { data: corretores } = trpc.relatorioDiario.listarCorretores.useQuery(undefined, {
    enabled: isGestor,
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const d = data;
  const nomeCorretor = d?.corretor?.name || user?.name || "Corretor";

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* CABEÇALHO */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-primary" />
              Relatório Diário
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isGestor && corretorFiltro !== "__self__"
                ? `Visualizando: ${nomeCorretor}`
                : `Olá, ${nomeCorretor}! Acompanhe sua performance.`}
            </p>
          </div>

          {/* FILTROS */}
          <div className="flex flex-wrap gap-2 items-center">
            {isGestor && corretores && corretores.length > 0 && (
              <Select value={corretorFiltro} onValueChange={setCorretorFiltro}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Corretor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__self__">Meu relatório</SelectItem>
                  {corretores.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name || `Corretor #${c.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoOption)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="ontem">Ontem</SelectItem>
                <SelectItem value="semana">Esta semana</SelectItem>
                <SelectItem value="mes">Este mês</SelectItem>
                <SelectItem value="personalizado">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {periodo === "personalizado" && (
              <>
                <input
                  type="date"
                  value={customInicio}
                  onChange={(e) => setCustomInicio(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                />
                <input
                  type="date"
                  value={customFim}
                  onChange={(e) => setCustomFim(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                />
              </>
            )}

            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* SCORE DE PRODUTIVIDADE */}
        {d && (
          <Card className={`border ${getScoreBg(d.scoreProdutividade)}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className={`text-5xl font-black ${getScoreColor(d.scoreProdutividade)}`}>
                      {d.scoreProdutividade}
                    </p>
                    <p className="text-xs text-muted-foreground">pontos</p>
                  </div>
                  <div>
                    <p className="font-semibold text-lg">Score de Produtividade</p>
                    <Badge
                      variant="outline"
                      className={`mt-1 ${getScoreColor(d.scoreProdutividade)} border-current`}
                    >
                      {getScoreLabel(d.scoreProdutividade)}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      Baseado em ligações, WhatsApp, agendamentos, visitas e vendas
                    </p>
                  </div>
                </div>
                <Award className={`h-12 w-12 opacity-30 ${getScoreColor(d.scoreProdutividade)}`} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* MÉTRICAS DE ATIVIDADE */}
        {d && (
          <>
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Phone className="h-4 w-4" /> Atividades de Prospecção
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard
                  icon={Phone}
                  label="Ligações Realizadas"
                  value={d.atividades.ligacoesRealizadas}
                  meta={d.metas.ligacoes * d.periodo.totalDias}
                  color="bg-blue-500"
                />
                <MetricCard
                  icon={Phone}
                  label="Ligações Atendidas"
                  value={d.atividades.ligacoesAtendidas}
                  sub={`${d.atividades.ligacoesRealizadas > 0 ? Math.round((d.atividades.ligacoesAtendidas / d.atividades.ligacoesRealizadas) * 100) : 0}% de atendimento`}
                  color="bg-sky-500"
                />
                <MetricCard
                  icon={MessageSquare}
                  label="WhatsApp Enviados"
                  value={d.atividades.whatsappEnviados}
                  meta={d.metas.whatsapp * d.periodo.totalDias}
                  color="bg-green-500"
                />
                <MetricCard
                  icon={MessageSquare}
                  label="WhatsApp Respondidos"
                  value={d.atividades.whatsappRespondidos}
                  sub={`${d.atividades.whatsappEnviados > 0 ? Math.round((d.atividades.whatsappRespondidos / d.atividades.whatsappEnviados) * 100) : 0}% de resposta`}
                  color="bg-emerald-500"
                />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Agendamentos e Visitas
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard
                  icon={Calendar}
                  label="Agendamentos"
                  value={d.agendamentos.total}
                  meta={d.metas.agendamentos * d.periodo.totalDias}
                  color="bg-violet-500"
                />
                <MetricCard
                  icon={Calendar}
                  label="Confirmados"
                  value={d.agendamentos.confirmados}
                  sub={`${d.agendamentos.cancelados} cancelados`}
                  color="bg-purple-500"
                />
                <MetricCard
                  icon={Eye}
                  label="Visitas Realizadas"
                  value={d.visitas.total}
                  meta={d.metas.visitas * d.periodo.totalDias}
                  color="bg-orange-500"
                />
                <MetricCard
                  icon={TrendingUp}
                  label="Alto Interesse"
                  value={d.visitas.interesseAlto}
                  sub={`${d.visitas.encaminhadoAnalise} enc. análise`}
                  color="bg-amber-500"
                />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Conversão e Vendas
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard
                  icon={FileText}
                  label="Propostas Enviadas"
                  value={d.propostas.total}
                  sub={`${d.propostas.aceitas} aceitas`}
                  color="bg-indigo-500"
                />
                <MetricCard
                  icon={Users}
                  label="Leads Recebidos"
                  value={d.leadsRecebidos}
                  color="bg-teal-500"
                />
                <MetricCard
                  icon={CheckCircle2}
                  label="Contratos Fechados"
                  value={d.contratos.total}
                  meta={d.metas.vendas * d.periodo.totalDias}
                  color="bg-emerald-600"
                />
                <MetricCard
                  icon={DollarSign}
                  label="VGV do Período"
                  value={formatCurrency(d.contratos.vgvTotal)}
                  sub={`${d.contratos.total} contrato(s)`}
                  color="bg-yellow-600"
                />
              </div>
            </div>

            {/* FUNIL + CHECKLIST */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* FUNIL DE AVANÇOS */}
              <Card className="bg-card/60 border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Funil de Avanços no Período
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {d.avancos.total === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum avanço de status registrado neste período.
                    </p>
                  ) : (
                    <>
                      <FunnelBar
                        label="→ Agendado"
                        value={d.avancos.paraAgendado}
                        max={d.avancos.total}
                        color="bg-violet-500"
                      />
                      <FunnelBar
                        label="→ Visita"
                        value={d.avancos.paraVisita}
                        max={d.avancos.total}
                        color="bg-orange-500"
                      />
                      <FunnelBar
                        label="→ Análise Crédito"
                        value={d.avancos.paraAnalise}
                        max={d.avancos.total}
                        color="bg-amber-500"
                      />
                      <FunnelBar
                        label="→ Contrato"
                        value={d.avancos.paraContrato}
                        max={d.avancos.total}
                        color="bg-emerald-500"
                      />
                      <p className="text-xs text-muted-foreground text-right pt-1">
                        Total de movimentações: {d.avancos.total}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* CHECKLIST DO DIA */}
              <Card className="bg-card/60 border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Checklist do Dia
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {d.checklist.map((item, i) => (
                    <ChecklistItem key={i} checked={item.ok} label={item.label} />
                  ))}
                  <div className="mt-3 pt-2 border-t border-border/30 flex justify-between text-xs text-muted-foreground">
                    <span>
                      {d.checklist.filter((c) => c.ok).length} de {d.checklist.length} concluídos
                    </span>
                    <span className={d.checklist.every((c) => c.ok) ? "text-emerald-400 font-semibold" : ""}>
                      {d.checklist.every((c) => c.ok) ? "🎯 Meta batida!" : "Continue assim!"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* CARTEIRA ATUAL */}
            <Card className="bg-card/60 border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Carteira de Leads Atual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { key: "novo", label: "Novos", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
                    { key: "aguardando_atendimento", label: "Aguardando", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
                    { key: "em_atendimento", label: "Em Atendimento", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
                    { key: "agendado", label: "Agendados", color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
                    { key: "visita_realizada", label: "Visita Realizada", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
                    { key: "analise_credito", label: "Análise Crédito", color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
                    { key: "contrato_fechado", label: "Contratos", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
                    { key: "perdido", label: "Perdidos", color: "bg-red-500/20 text-red-400 border-red-500/30" },
                  ].map(({ key, label, color }) => (
                    <div key={key} className={`rounded-lg border p-3 text-center ${color}`}>
                      <p className="text-2xl font-bold">{d.carteira[key] || 0}</p>
                      <p className="text-xs mt-0.5 opacity-80">{label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3 text-right">
                  Total na carteira:{" "}
                  <strong>
                    {Object.values(d.carteira).reduce((a, b) => a + b, 0)} leads
                  </strong>
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {!d && !isLoading && (
          <div className="text-center py-16 text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum dado encontrado para o período selecionado.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
