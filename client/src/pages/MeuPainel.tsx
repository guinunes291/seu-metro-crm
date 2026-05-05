import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import SmartMentorBanner, { useEvolucaoAlerts } from "@/components/SmartMentorBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, Target, Trophy, Users, Clock, CheckCircle2, Edit3,
  Camera, Flame, Award, BarChart3, Zap, Phone, MessageSquare,
  Calendar, Eye, FileText, DollarSign, RefreshCw, ClipboardList,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

// ============================================================================
// HELPERS
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyMeta(value: number): string {
  // Metas de VGV são armazenadas em centavos
  return formatCurrency(value / 100);
}

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function calcTaxa(num: number, den: number) {
  if (den === 0) return 0;
  return Math.round((num / den) * 100);
}

function getProgressColor(pct: number) {
  if (pct >= 100) return "text-green-600 dark:text-green-400";
  if (pct >= 70) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-500 dark:text-red-400";
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

type PeriodoOption = "hoje" | "ontem" | "semana" | "mes" | "personalizado";

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
        fim: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 0),
      };
    case "ontem": {
      const ontem = new Date(hoje);
      ontem.setDate(ontem.getDate() - 1);
      return {
        inicio: ontem,
        fim: new Date(ontem.getFullYear(), ontem.getMonth(), ontem.getDate(), 23, 59, 59, 0),
      };
    }
    case "semana": {
      const inicioSemana = new Date(hoje);
      inicioSemana.setDate(hoje.getDate() - hoje.getDay());
      return {
        inicio: inicioSemana,
        fim: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 0),
      };
    }
    case "mes": {
      return {
        inicio: new Date(agora.getFullYear(), agora.getMonth(), 1),
        fim: new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 0),
      };
    }
    case "personalizado":
      if (customInicio && customFim) {
        return {
          inicio: customInicio,
          fim: new Date(customFim.getFullYear(), customFim.getMonth(), customFim.getDate(), 23, 59, 59, 0),
        };
      }
      return getPeriodo("hoje");
    default:
      return getPeriodo("hoje");
  }
}

// ============================================================================
// COMPONENTES REUTILIZÁVEIS
// ============================================================================

function MetaProgressCard({
  label, icon: Icon, realizado, meta, progresso, formatFn,
}: {
  label: string; icon: any; realizado: number; meta: number | null;
  progresso: number; formatFn?: (v: number) => string;
}) {
  const fmt = formatFn ?? ((v: number) => v.toString());
  const hasMeta = meta !== null && meta > 0;
  const pct = hasMeta ? Math.min(progresso, 100) : 0;

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">{label}</span>
          </div>
          {hasMeta && pct >= 100 && (
            <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30 text-xs">
              ✓ Meta!
            </Badge>
          )}
        </div>
        <div className="mb-3">
          <span className="text-3xl font-bold">{fmt(realizado)}</span>
          {hasMeta && (
            <span className="text-sm text-muted-foreground ml-2">/ {fmt(meta!)}</span>
          )}
        </div>
        {hasMeta ? (
          <>
            <Progress value={pct} className="h-2 mb-1" />
            <div className="flex justify-between items-center">
              <span className={`text-xs font-semibold ${getProgressColor(progresso)}`}>{progresso}%</span>
              <span className="text-xs text-muted-foreground">
                Faltam: {fmt(Math.max(0, meta! - realizado))}
              </span>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground italic">Meta não definida</p>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityCard({
  icon: Icon, label, value, meta, color, sub,
}: {
  icon: React.ElementType; label: string; value: number | string;
  meta?: number; color?: string; sub?: string;
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

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-28 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold w-8 text-right">{value}</span>
    </div>
  );
}

// ============================================================================
// MODAL DEFINIR METAS
// ============================================================================

function ModalDefinirMeta({ mes, ano, metaAtual, onSaved }: {
  mes: number; ano: number; metaAtual: any; onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    metaLeads: metaAtual?.metaLeads?.toString() ?? "",
    metaAgendamentos: metaAtual?.metaAgendamentos?.toString() ?? "",
    metaVisitas: metaAtual?.metaVisitas?.toString() ?? "",
    metaContratos: metaAtual?.metaContratos?.toString() ?? "",
    metaVGV: metaAtual?.metaVGV?.toString() ?? "",
  });

  const definirMeta = trpc.metas.definirMinhaMeta.useMutation({
    onSuccess: () => { toast.success("Meta salva com sucesso!"); setOpen(false); onSaved(); },
    onError: (err) => toast.error(err.message || "Erro ao salvar meta"),
  });

  const campos = [
    { key: "metaLeads", label: "Meta de Leads", icon: Users, placeholder: "Ex: 30" },
    { key: "metaAgendamentos", label: "Meta de Agendamentos", icon: Clock, placeholder: "Ex: 15" },
    { key: "metaVisitas", label: "Meta de Visitas", icon: CheckCircle2, placeholder: "Ex: 10" },
    { key: "metaContratos", label: "Meta de Contratos", icon: Trophy, placeholder: "Ex: 3" },
    { key: "metaVGV", label: "Meta de VGV (R$)", icon: TrendingUp, placeholder: "Ex: 500000" },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Edit3 className="h-4 w-4" />
          {metaAtual ? "Editar Metas" : "Definir Metas"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Minhas Metas — {new Date(ano, mes - 1).toLocaleString("pt-BR", { month: "long", year: "numeric" })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {campos.map(({ key, label, icon: Icon, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                {label}
              </Label>
              <Input
                type="number" min={0} placeholder={placeholder}
                value={(form as any)[key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => definirMeta.mutate({
              mes, ano,
              metaLeads: form.metaLeads ? parseInt(form.metaLeads) : undefined,
              metaAgendamentos: form.metaAgendamentos ? parseInt(form.metaAgendamentos) : undefined,
              metaVisitas: form.metaVisitas ? parseInt(form.metaVisitas) : undefined,
              metaContratos: form.metaContratos ? parseInt(form.metaContratos) : undefined,
              metaVGV: form.metaVGV ? parseInt(form.metaVGV) : undefined,
            })}
            disabled={definirMeta.isPending}
          >
            {definirMeta.isPending ? "Salvando..." : "Salvar Metas"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// ABA: HOJE (Relatório Diário)
// ============================================================================

function AbaHoje({ isGestor }: { isGestor: boolean }) {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState<PeriodoOption>("hoje");
  const [customInicio, setCustomInicio] = useState<string>("");
  const [customFim, setCustomFim] = useState<string>("");
  const [corretorFiltro, setCorretorFiltro] = useState<string>("__self__");

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
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  const d = data;
  const nomeCorretor = d?.corretor?.name || user?.name || "Corretor";

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isGestor && corretorFiltro !== "__self__"
            ? `Visualizando: ${nomeCorretor}`
            : `Olá, ${nomeCorretor}! Acompanhe sua performance.`}
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          {isGestor && corretores && corretores.length > 0 && (
            <Select value={corretorFiltro} onValueChange={setCorretorFiltro}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Corretor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__self__">Meu relatório</SelectItem>
                {corretores.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name || `Corretor #${c.id}`}</SelectItem>
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
              <input type="date" value={customInicio} onChange={(e) => setCustomInicio(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
              <input type="date" value={customFim} onChange={(e) => setCustomFim(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Score */}
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
                  <Badge variant="outline" className={`mt-1 ${getScoreColor(d.scoreProdutividade)} border-current`}>
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

      {d && (
        <>
          {/* Atividades de Prospecção */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Phone className="h-4 w-4" /> Atividades de Prospecção
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ActivityCard icon={Phone} label="Ligações Realizadas" value={d.atividades.ligacoesRealizadas}
                meta={d.metas.ligacoes * d.periodo.totalDias} color="bg-blue-500" />
              <ActivityCard icon={Phone} label="Ligações Atendidas" value={d.atividades.ligacoesAtendidas}
                sub={`${d.atividades.ligacoesRealizadas > 0 ? Math.round((d.atividades.ligacoesAtendidas / d.atividades.ligacoesRealizadas) * 100) : 0}% de atendimento`}
                color="bg-sky-500" />
              <ActivityCard icon={MessageSquare} label="WhatsApp Enviados" value={d.atividades.whatsappEnviados}
                meta={d.metas.whatsapp * d.periodo.totalDias} color="bg-green-500" />
              <ActivityCard icon={MessageSquare} label="WhatsApp Respondidos" value={d.atividades.whatsappRespondidos}
                sub={`${d.atividades.whatsappEnviados > 0 ? Math.round((d.atividades.whatsappRespondidos / d.atividades.whatsappEnviados) * 100) : 0}% de resposta`}
                color="bg-emerald-500" />
            </div>
          </div>

          {/* Agendamentos e Visitas */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Agendamentos e Visitas
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ActivityCard icon={Calendar} label="Agendamentos" value={d.agendamentos.total}
                meta={d.metas.agendamentos * d.periodo.totalDias} color="bg-violet-500" />
              <ActivityCard icon={Calendar} label="Confirmados" value={d.agendamentos.confirmados}
                sub={`${d.agendamentos.cancelados} cancelados`} color="bg-purple-500" />
              <ActivityCard icon={Eye} label="Visitas Realizadas" value={d.visitas.total}
                meta={d.metas.visitas * d.periodo.totalDias} color="bg-orange-500" />
              <ActivityCard icon={TrendingUp} label="Alto Interesse" value={d.visitas.interesseAlto}
                sub={`${d.visitas.encaminhadoAnalise} enc. análise`} color="bg-amber-500" />
            </div>
          </div>

          {/* Conversão e Vendas */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Conversão e Vendas
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ActivityCard icon={FileText} label="Propostas Enviadas" value={d.propostas.total}
                sub={`${d.propostas.aceitas} aceitas`} color="bg-indigo-500" />
              <ActivityCard icon={Users} label="Leads Recebidos" value={d.leadsRecebidos} color="bg-teal-500" />
              <ActivityCard icon={CheckCircle2} label="Contratos Fechados" value={d.contratos.total}
                meta={d.metas.vendas * d.periodo.totalDias} color="bg-emerald-600" />
              <ActivityCard icon={DollarSign} label="VGV do Período" value={formatCurrency(d.contratos.vgvTotal)}
                sub={`${d.contratos.total} contrato(s)`} color="bg-yellow-600" />
            </div>
          </div>

          {/* Funil + Checklist */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <FunnelBar label="→ Agendado" value={d.avancos.paraAgendado} max={d.avancos.total} color="bg-violet-500" />
                    <FunnelBar label="→ Visita" value={d.avancos.paraVisita} max={d.avancos.total} color="bg-orange-500" />
                    <FunnelBar label="→ Análise Crédito" value={d.avancos.paraAnalise} max={d.avancos.total} color="bg-amber-500" />
                    <FunnelBar label="→ Contrato" value={d.avancos.paraContrato} max={d.avancos.total} color="bg-emerald-500" />
                    <p className="text-xs text-muted-foreground text-right pt-1">
                      Total de movimentações: {d.avancos.total}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

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
                  <span>{d.checklist.filter((c) => c.ok).length} de {d.checklist.length} concluídos</span>
                  <span className={d.checklist.every((c) => c.ok) ? "text-emerald-400 font-semibold" : ""}>
                    {d.checklist.every((c) => c.ok) ? "🎯 Meta batida!" : "Continue assim!"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Carteira */}
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
                    <p className="text-2xl font-bold">{(d.carteira as any)[key] || 0}</p>
                    <p className="text-xs mt-0.5 opacity-80">{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-right">
                Total na carteira: <strong>{Object.values(d.carteira).reduce((a, b) => a + b, 0)} leads</strong>
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
  );
}

// ============================================================================
// ABA: METAS DO MÊS
// ============================================================================

function AbaMetasDoMes({ user, refetchUser }: { user: any; refetchUser?: () => void }) {
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const { data: minhaPerformance, isLoading: loadingPerf } = trpc.ranking.minhaPerformance.useQuery(
    { mes, ano }, { refetchOnWindowFocus: false }
  );
  const { data: minhaMeta, refetch: refetchMeta } = trpc.metas.minhaMeta.useQuery(
    { mes, ano }, { refetchOnWindowFocus: false }
  );
  const { data: meuProgresso, refetch: refetchProgresso } = trpc.metas.meuProgresso.useQuery(
    { mes, ano }, { enabled: !!minhaMeta, refetchOnWindowFocus: false }
  );

  const uploadFoto = trpc.foto.upload.useMutation({
    onSuccess: () => { toast.success("Foto atualizada!"); refetchUser?.(); },
    onError: (error) => toast.error(error.message || "Erro ao fazer upload"),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
      toast.error("Use JPEG, PNG, GIF ou WebP."); return;
    }
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB."); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await uploadFoto.mutateAsync({ fileData: reader.result as string, fileName: file.name, contentType: file.type });
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.onerror = () => { toast.error("Erro ao ler o arquivo"); setUploading(false); };
    reader.readAsDataURL(file);
  };

  const meses = [
    { value: 1, label: "Janeiro" }, { value: 2, label: "Fevereiro" },
    { value: 3, label: "Março" }, { value: 4, label: "Abril" },
    { value: 5, label: "Maio" }, { value: 6, label: "Junho" },
    { value: 7, label: "Julho" }, { value: 8, label: "Agosto" },
    { value: 9, label: "Setembro" }, { value: 10, label: "Outubro" },
    { value: 11, label: "Novembro" }, { value: 12, label: "Dezembro" },
  ];
  const anos = [2024, 2025, 2026];
  const metricas = minhaPerformance?.metricas;
  const progressoGeral = meuProgresso?.progressoGeral ?? 0;
  const onMetaSaved = () => { refetchMeta(); refetchProgresso(); };

  return (
    <div className="space-y-6">
      {/* Header com avatar e seletor */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-6 text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative group">
              <Avatar className="w-20 h-20 ring-4 ring-white/30 ring-offset-2 ring-offset-transparent shadow-2xl">
                <AvatarImage src={user?.fotoUrl || undefined} alt={user?.name || "Corretor"} className="object-cover" />
                <AvatarFallback className="text-xl font-bold bg-white/20 text-white">
                  {user?.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "C"}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                title="Alterar foto"
              >
                {uploading ? (
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-gray-300 border-t-primary" />
                ) : (
                  <Camera className="h-3.5 w-3.5 text-gray-700" />
                )}
              </button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileUpload} className="hidden" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">
                Olá, {user?.name?.split(" ")[0] || "Corretor"}! 👋
              </h2>
              <p className="text-white/80">Acompanhe suas metas mensais</p>
              {progressoGeral > 0 && (
                <Badge className="bg-white/20 text-white border-white/30 text-sm px-3 py-1 mt-2">
                  <Flame className="h-4 w-4 mr-1" />
                  {progressoGeral}% da meta geral
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 bg-white/10 rounded-xl p-2.5 backdrop-blur-sm">
              <Select value={mes.toString()} onValueChange={(v) => setMes(parseInt(v))}>
                <SelectTrigger className="w-[130px] bg-white/20 border-white/30 text-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((m) => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={ano.toString()} onValueChange={(v) => setAno(parseInt(v))}>
                <SelectTrigger className="w-[90px] bg-white/20 border-white/30 text-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anos.map((a) => <SelectItem key={a} value={a.toString()}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <ModalDefinirMeta mes={mes} ano={ano} metaAtual={minhaMeta} onSaved={onMetaSaved} />
          </div>
        </div>
      </div>

      {/* Progresso geral */}
      {meuProgresso && (
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-primary" />
              Progresso Geral do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Progress value={progressoGeral} className="h-4" />
              </div>
              <span className={`text-2xl font-bold ${getProgressColor(progressoGeral)}`}>
                {progressoGeral}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Calculado com base nas 5 metas do funil (cada uma vale até 20%)
            </p>
          </CardContent>
        </Card>
      )}

      {/* Cards de metas */}
      {loadingPerf ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Card key={i} className="animate-pulse"><CardContent className="p-5 h-32" /></Card>)}
        </div>
      ) : metricas ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MetaProgressCard label="Leads" icon={Users} realizado={metricas.totalLeads ?? 0}
            meta={minhaMeta?.metaLeads ?? null} progresso={meuProgresso?.progresso?.leads ?? 0} />
          <MetaProgressCard label="Agendamentos" icon={Clock} realizado={metricas.agendamentos ?? 0}
            meta={minhaMeta?.metaAgendamentos ?? null} progresso={meuProgresso?.progresso?.agendamentos ?? 0} />
          <MetaProgressCard label="Visitas" icon={CheckCircle2} realizado={metricas.visitas ?? 0}
            meta={minhaMeta?.metaVisitas ?? null} progresso={meuProgresso?.progresso?.visitas ?? 0} />
          <MetaProgressCard label="Contratos" icon={Trophy} realizado={metricas.contratos ?? 0}
            meta={minhaMeta?.metaContratos ?? null} progresso={meuProgresso?.progresso?.contratos ?? 0} />
          <MetaProgressCard label="VGV" icon={TrendingUp} realizado={metricas.vgv ?? 0}
            meta={minhaMeta?.metaVGV ?? null} progresso={meuProgresso?.progresso?.vgv ?? 0}
            formatFn={formatCurrencyMeta} />
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma atividade registrada neste período.</p>
          </CardContent>
        </Card>
      )}

      {/* Pontuação + Funil */}
      {metricas && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-5 w-5 text-yellow-500" />
                Minha Pontuação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="text-5xl font-black text-yellow-500">{metricas.pontuacao ?? 0}</div>
                <div className="text-sm text-muted-foreground">
                  <p>pontos acumulados</p>
                  <p className="text-xs mt-1">no período selecionado</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="h-5 w-5 text-purple-500" />
                Taxas de Conversão
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { label: "Leads → Agendamentos", a: metricas.totalLeads, b: metricas.agendamentos },
                  { label: "Agendamentos → Visitas", a: metricas.agendamentos, b: metricas.visitas },
                  { label: "Visitas → Contratos", a: metricas.visitas, b: metricas.contratos },
                ].map(({ label, a, b }) => {
                  const taxa = a > 0 ? Math.round((b / a) * 100) : 0;
                  return (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <Badge variant="outline" className={taxa >= 30 ? "border-green-500 text-green-600" : "border-muted"}>
                        {taxa}%
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!minhaMeta && !loadingPerf && (
        <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
          <CardContent className="p-8 text-center">
            <Target className="h-12 w-12 mx-auto text-primary/50 mb-3" />
            <h3 className="font-semibold text-lg mb-2">Defina suas metas para este mês!</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Estabeleça metas de leads, agendamentos, visitas, contratos e VGV para acompanhar seu progresso.
            </p>
            <ModalDefinirMeta mes={mes} ano={ano} metaAtual={null} onSaved={onMetaSaved} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// ABA: EVOLUÇÃO (Histórico 6 meses)
// ============================================================================

function AbaEvolucao() {
  const { data: meses, isLoading } = trpc.meuNegocio.getEvolucaoMensal.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-64 bg-muted rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const dados = meses ?? [];
  const ultimo = dados[dados.length - 1];
  const penultimo = dados[dados.length - 2];

  function delta(atual: number, anterior: number) { return atual - anterior; }

  const kpis = ultimo ? [
    { icon: Users, label: "Leads recebidos", value: ultimo.leadsRecebidos, deltaVal: delta(ultimo.leadsRecebidos, penultimo?.leadsRecebidos ?? 0), color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950", isMoney: false },
    { icon: Calendar, label: "Agendamentos", value: ultimo.agendamentos, deltaVal: delta(ultimo.agendamentos, penultimo?.agendamentos ?? 0), color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950", isMoney: false },
    { icon: Eye, label: "Visitas realizadas", value: ultimo.visitas, deltaVal: delta(ultimo.visitas, penultimo?.visitas ?? 0), color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950", isMoney: false },
    { icon: Award, label: "Vendas fechadas", value: ultimo.vendas, deltaVal: delta(ultimo.vendas, penultimo?.vendas ?? 0), color: "text-green-500", bg: "bg-green-50 dark:bg-green-950", isMoney: false },
    { icon: DollarSign, label: "Receita estimada", value: formatBRL(ultimo.receita), deltaVal: delta(ultimo.receita, penultimo?.receita ?? 0), color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950", isMoney: true },
  ] : [];

  const tendencia = ultimo && penultimo ? {
    leadsUltimo: ultimo.leadsRecebidos, leadsAnterior: penultimo.leadsRecebidos,
    vendasUltimo: ultimo.vendas, vendasAnterior: penultimo.vendas,
  } : null;
  const evolucaoAlerts = useEvolucaoAlerts(tendencia);

  const dadosTaxa = dados.map((m) => ({
    mes: m.mes,
    "Lead → Agend.": calcTaxa(m.agendamentos, m.leadsRecebidos),
    "Agend. → Visita": calcTaxa(m.visitas, m.agendamentos),
    "Visita → Venda": calcTaxa(m.vendas, m.visitas),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <TrendingUp className="h-4 w-4" />
        Histórico dos últimos 6 meses · {ultimo ? `${ultimo.mes}/${ultimo.ano}` : ""}
      </div>

      <SmartMentorBanner alerts={evolucaoAlerts} />

      {/* KPIs do mês atual */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {kpis.map((k) => (
            <Card key={k.label} className="border-0 shadow-sm">
              <CardContent className="pt-4 pb-3 px-4">
                <div className={`inline-flex p-2 rounded-lg ${k.bg} mb-2`}>
                  <k.icon className={`h-4 w-4 ${k.color}`} />
                </div>
                <div className="text-xl font-bold text-foreground">{k.value}</div>
                <div className="text-xs text-muted-foreground leading-tight">{k.label}</div>
                <div className={`text-xs font-medium mt-1 ${k.deltaVal > 0 ? "text-green-600" : k.deltaVal < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                  {k.deltaVal > 0 ? "+" : ""}
                  {k.isMoney ? formatBRL(k.deltaVal) : k.deltaVal} vs mês anterior
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Gráfico funil mensal */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Funil de Conversão — últimos 6 meses</CardTitle>
          <p className="text-xs text-muted-foreground">Leads recebidos, agendamentos, visitas e vendas por mês</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dados} barCategoryGap="20%" barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar dataKey="leadsRecebidos" name="Leads" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="agendamentos" name="Agendamentos" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="visitas" name="Visitas" fill="#f97316" radius={[3, 3, 0, 0]} />
              <Bar dataKey="vendas" name="Vendas" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico taxas de conversão */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Taxas de Conversão (%)</CardTitle>
          <p className="text-xs text-muted-foreground">Percentual de conversão entre cada etapa do funil</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dadosTaxa}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} unit="%" domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }}
                formatter={(v: number) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line type="monotone" dataKey="Lead → Agend." stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Agend. → Visita" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Visita → Venda" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico receita */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Receita Estimada (R$)</CardTitle>
          <p className="text-xs text-muted-foreground">Comissão estimada com base no ticket médio e % configurados</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dados}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }}
                formatter={(v: number) => formatBRL(v)} />
              <Line type="monotone" dataKey="receita" name="Receita" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela resumo */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Resumo Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Mês</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Leads</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Agend.</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Visitas</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Vendas</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Conv. L→V</th>
                  <th className="text-right py-2 pl-3 text-muted-foreground font-medium">Receita</th>
                </tr>
              </thead>
              <tbody>
                {dados.map((m, idx) => {
                  const isAtual = idx === dados.length - 1;
                  return (
                    <tr key={`${m.mes}-${m.ano}`}
                      className={`border-b border-border/50 ${isAtual ? "bg-indigo-50/50 dark:bg-indigo-950/30" : ""}`}>
                      <td className="py-2 pr-4 font-medium text-foreground">
                        {m.mes}/{m.ano}
                        {isAtual && (
                          <span className="ml-2 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                            atual
                          </span>
                        )}
                      </td>
                      <td className="text-right py-2 px-3 text-foreground">{m.leadsRecebidos}</td>
                      <td className="text-right py-2 px-3 text-foreground">{m.agendamentos}</td>
                      <td className="text-right py-2 px-3 text-foreground">{m.visitas}</td>
                      <td className="text-right py-2 px-3 font-semibold text-green-600">{m.vendas}</td>
                      <td className="text-right py-2 px-3 text-foreground">{calcTaxa(m.vendas, m.leadsRecebidos)}%</td>
                      <td className="text-right py-2 pl-3 font-semibold text-emerald-600">{formatBRL(m.receita)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function MeuPainel() {
  const { user, refresh: refetchUser } = useAuth();

  const isGestor =
    user?.role === "gestor" ||
    user?.role === "admin" ||
    user?.role === "superintendente";

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Meu Painel</h1>
            <p className="text-sm text-muted-foreground">
              Performance, metas e evolução em um só lugar
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="hoje" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="hoje" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Hoje</span>
              <span className="sm:hidden">Hoje</span>
            </TabsTrigger>
            <TabsTrigger value="metas" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Metas do Mês</span>
              <span className="sm:hidden">Metas</span>
            </TabsTrigger>
            <TabsTrigger value="evolucao" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Evolução</span>
              <span className="sm:hidden">Evolução</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hoje">
            <AbaHoje isGestor={isGestor} />
          </TabsContent>

          <TabsContent value="metas">
            <AbaMetasDoMes user={user} refetchUser={refetchUser} />
          </TabsContent>

          <TabsContent value="evolucao">
            <AbaEvolucao />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
