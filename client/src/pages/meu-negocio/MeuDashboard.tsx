import { toast } from "sonner";
import { useState, useMemo } from "react";
import SmartMentorBanner, { useDashboardAlerts } from "@/components/SmartMentorBanner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";

import {
  Target, TrendingUp, AlertCircle, CheckCircle2, Edit3, Save,
  Users, Calendar, Home, FileText, DollarSign, Zap, Clock,
  ChevronRight, ArrowUp, ArrowDown, Minus, ArrowRight
} from "lucide-react";
import { Link } from "wouter";

// ============================================================================
// HELPERS
// ============================================================================

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtPct(v: number) {
  return (v * 100).toFixed(0) + "%";
}

function ceil(v: number) {
  return Math.ceil(v);
}

// ============================================================================
// BLOCO 2 — CÁLCULO REVERSO
// ============================================================================

interface CalcReverso {
  comissaoPorVenda: number;
  vendasNecessarias: number;
  propostasNecessarias: number;
  visitasNecessarias: number;
  agendamentosNecessarios: number;
  leadsNecessariosMes: number;
  leadsNecessariosDia: number;
}

function calcularReverso(params: {
  ticketMedio: number;
  comissaoPct: number;
  metaReceitaMes: number;
  taxaLeadAgendamento: number;
  taxaAgendamentoVisita: number;
  taxaVisitaProposta: number;
  taxaPropostaVenda: number;
}): CalcReverso {
  const comissaoPorVenda = params.ticketMedio * params.comissaoPct;
  const vendasNecessarias = ceil(params.metaReceitaMes / comissaoPorVenda);
  const propostasNecessarias = ceil(vendasNecessarias / params.taxaPropostaVenda);
  const visitasNecessarias = ceil(propostasNecessarias / params.taxaVisitaProposta);
  const agendamentosNecessarios = ceil(visitasNecessarias / params.taxaAgendamentoVisita);
  const leadsNecessariosMes = ceil(agendamentosNecessarios / params.taxaLeadAgendamento);
  const leadsNecessariosDia = ceil(leadsNecessariosMes / 22);
  return {
    comissaoPorVenda,
    vendasNecessarias,
    propostasNecessarias,
    visitasNecessarias,
    agendamentosNecessarios,
    leadsNecessariosMes,
    leadsNecessariosDia,
  };
}

// ============================================================================
// CARD MODO FOCO
// ============================================================================

function FocoCard() {
  const { data: foco } = trpc.meuNegocio.getFocoDoDia.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const urgentes = foco ? (
    (foco.leadsTimerAtivo?.length ?? 0) +
    (foco.leadsAguardando?.length ?? 0) +
    (foco.visitasHoje?.length ?? 0) +
    (foco.propostasAguardando?.length ?? 0)
  ) : 0;

  const itens = [
    { label: "Timer ativo", count: foco?.leadsTimerAtivo?.length ?? 0, color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20" },
    { label: "Aguardando", count: foco?.leadsAguardando?.length ?? 0, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20" },
    { label: "Visitas hoje", count: foco?.visitasHoje?.length ?? 0, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
    { label: "Propostas", count: foco?.propostasAguardando?.length ?? 0, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
  ];

  return (
    <Link href="/meu-negocio/foco">
      <div className="rounded-lg border-2 border-yellow-300 dark:border-yellow-700 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 p-4 cursor-pointer hover:border-yellow-400 hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-yellow-400 dark:bg-yellow-600 rounded-lg">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base">Modo Foco do Dia</h2>
              <p className="text-xs text-muted-foreground">Suas prioridades agora</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {urgentes > 0 && (
              <Badge className="bg-red-500 hover:bg-red-500 text-white font-bold text-sm px-2.5">
                {urgentes} urgente{urgentes !== 1 ? "s" : ""}
              </Badge>
            )}
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {itens.map((item) => (
            <div key={item.label} className={`rounded-lg ${item.bg} p-2 text-center`}>
              <div className={`text-xl font-black ${item.color}`}>{item.count}</div>
              <div className="text-xs text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function MeuDashboard() {
  
  const [editando, setEditando] = useState(false);

  // Parâmetros do corretor
  const { data: params, refetch: refetchParams } = trpc.meuNegocio.getParametros.useQuery();
  const salvarParams = trpc.meuNegocio.salvarParametros.useMutation({
    onSuccess: () => {
      toast.success("Parâmetros salvos!");
      setEditando(false);
      refetchParams();
    },
    onError: (e) => toast.error("Erro ao salvar", { description: e.message }),
  });

  // Resultados do mês atual
  const { data: resultadosMes } = trpc.meuNegocio.getResultadosMes.useQuery();

  // Alertas do dia
  const { data: alertasDia } = trpc.meuNegocio.getAlertasDia.useQuery();

  // Estado local para edição
  const [form, setForm] = useState({
    ticketMedio: "",
    comissaoPct: "",
    metaReceitaMes: "",
    taxaLeadAgendamento: "",
    taxaAgendamentoVisita: "",
    taxaVisitaProposta: "",
    taxaPropostaVenda: "",
  });

  function iniciarEdicao() {
    if (!params) return;
    setForm({
      ticketMedio: Number(params.ticketMedio).toLocaleString("pt-BR"),
      comissaoPct: (Number(params.comissaoPct) * 100).toFixed(2),
      metaReceitaMes: Number(params.metaReceitaMes).toLocaleString("pt-BR"),
      taxaLeadAgendamento: (Number(params.taxaLeadAgendamento) * 100).toFixed(0),
      taxaAgendamentoVisita: (Number(params.taxaAgendamentoVisita) * 100).toFixed(0),
      taxaVisitaProposta: (Number(params.taxaVisitaProposta) * 100).toFixed(0),
      taxaPropostaVenda: (Number(params.taxaPropostaVenda) * 100).toFixed(0),
    });
    setEditando(true);
  }

  function salvar() {
    const parse = (v: string) => parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
    salvarParams.mutate({
      ticketMedio: parse(form.ticketMedio),
      comissaoPct: parse(form.comissaoPct) / 100,
      metaReceitaMes: parse(form.metaReceitaMes),
      taxaLeadAgendamento: parse(form.taxaLeadAgendamento) / 100,
      taxaAgendamentoVisita: parse(form.taxaAgendamentoVisita) / 100,
      taxaVisitaProposta: parse(form.taxaVisitaProposta) / 100,
      taxaPropostaVenda: parse(form.taxaPropostaVenda) / 100,
    });
  }

  // Cálculo reverso com parâmetros atuais
  const calc = useMemo(() => {
    if (!params) return null;
    return calcularReverso({
      ticketMedio: Number(params.ticketMedio),
      comissaoPct: Number(params.comissaoPct),
      metaReceitaMes: Number(params.metaReceitaMes),
      taxaLeadAgendamento: Number(params.taxaLeadAgendamento),
      taxaAgendamentoVisita: Number(params.taxaAgendamentoVisita),
      taxaVisitaProposta: Number(params.taxaVisitaProposta),
      taxaPropostaVenda: Number(params.taxaPropostaVenda),
    });
  }, [params]);

  // Progresso do mês
  const progresso = useMemo(() => {
    if (!resultadosMes || !calc) return null;
    return {
      leads: { atual: resultadosMes.leadsRecebidos, meta: calc.leadsNecessariosMes },
      agendamentos: { atual: resultadosMes.agendamentos, meta: calc.agendamentosNecessarios },
      visitas: { atual: resultadosMes.visitas, meta: calc.visitasNecessarias },
      propostas: { atual: resultadosMes.propostas, meta: calc.propostasNecessarias },
      vendas: { atual: resultadosMes.vendas, meta: calc.vendasNecessarias },
      receita: { atual: resultadosMes.receita, meta: Number(params?.metaReceitaMes ?? 0) },
    };
  }, [resultadosMes, calc, params]);

  const diasRestantes = useMemo(() => {
    const hoje = new Date();
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    return ultimoDia.getDate() - hoje.getDate();
  }, []);

  const mentorAlerts = useDashboardAlerts(progresso);

  return (
    <DashboardLayout>
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Target className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Meu Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {diasRestantes} dias restantes no mês · {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
        {!editando && (
          <Button variant="outline" size="sm" onClick={iniciarEdicao}>
            <Edit3 className="h-4 w-4 mr-2" />
            Editar parâmetros
          </Button>
        )}
      </div>

      {/* Smart Mentor Banner */}
      <SmartMentorBanner alerts={mentorAlerts} />

      {/* Card Modo Foco */}
      <FocoCard />

      {/* BLOCO 1 — Parâmetros (modo edição) */}
      {editando && (
        <div className="rounded-lg border p-4 bg-muted/30 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Edit3 className="h-4 w-4" />
            Meus Parâmetros Pessoais
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "Ticket médio (R$)", key: "ticketMedio", suffix: "" },
              { label: "Minha comissão (%)", key: "comissaoPct", suffix: "%" },
              { label: "Meta de receita/mês (R$)", key: "metaReceitaMes", suffix: "" },
              { label: "Taxa lead → agendamento (%)", key: "taxaLeadAgendamento", suffix: "%" },
              { label: "Taxa agendamento → visita (%)", key: "taxaAgendamentoVisita", suffix: "%" },
              { label: "Taxa visita → proposta (%)", key: "taxaVisitaProposta", suffix: "%" },
              { label: "Taxa proposta → venda (%)", key: "taxaPropostaVenda", suffix: "%" },
            ].map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  value={form[f.key as keyof typeof form]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={salvar} disabled={salvarParams.isPending} size="sm">
              <Save className="h-4 w-4 mr-2" />
              {salvarParams.isPending ? "Salvando..." : "Salvar"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditando(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* BLOCO 2 — Cálculo Reverso */}
      {calc && !editando && (
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Cálculo Reverso da Meta
          </h2>
          <div className="flex items-center gap-1 flex-wrap text-sm">
            {[
              { label: "Meta", value: fmt(Number(params?.metaReceitaMes ?? 0)), icon: DollarSign, color: "text-green-600" },
              { label: "Vendas", value: calc.vendasNecessarias, icon: Home, color: "text-blue-600" },
              { label: "Propostas", value: calc.propostasNecessarias, icon: FileText, color: "text-purple-600" },
              { label: "Visitas", value: calc.visitasNecessarias, icon: Users, color: "text-orange-600" },
              { label: "Agend.", value: calc.agendamentosNecessarios, icon: Calendar, color: "text-pink-600" },
              { label: "Leads/mês", value: calc.leadsNecessariosMes, icon: TrendingUp, color: "text-indigo-600" },
            ].map((item, i) => (
              <div key={item.label} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <div className="rounded-lg border px-3 py-2 text-center min-w-[70px]">
                  <div className={`font-bold text-lg ${item.color}`}>{item.value}</div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 flex items-center gap-3">
            <Zap className="h-8 w-8 text-yellow-500 shrink-0" />
            <div>
              <div className="text-2xl font-black text-yellow-600">{calc.leadsNecessariosDia} leads/dia</div>
              <div className="text-xs text-muted-foreground">necessários para bater a meta de {fmt(Number(params?.metaReceitaMes ?? 0))}</div>
            </div>
          </div>
        </div>
      )}

      {/* BLOCO 3 — Resultados do Mês */}
      {progresso && (
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            Meus Resultados — {new Date().toLocaleDateString("pt-BR", { month: "long" })}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: "Leads recebidos", ...progresso.leads, icon: Users, color: "#6366f1" },
              { label: "Agendamentos", ...progresso.agendamentos, icon: Calendar, color: "#8b5cf6" },
              { label: "Visitas realizadas", ...progresso.visitas, icon: Home, color: "#f59e0b" },
              { label: "Propostas enviadas", ...progresso.propostas, icon: FileText, color: "#10b981" },
              { label: "Vendas fechadas", ...progresso.vendas, icon: CheckCircle2, color: "#3b82f6" },
              { label: "Receita gerada", atual: progresso.receita.atual, meta: progresso.receita.meta, icon: DollarSign, color: "#16a34a", isMoney: true },
            ].map((item) => {
              const pct = item.meta > 0 ? Math.min(100, (item.atual / item.meta) * 100) : 0;
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <Icon className="h-4 w-4" style={{ color: item.color }} />
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-2xl font-bold" style={{ color: item.color }}>
                      {(item as any).isMoney ? fmt(item.atual) : item.atual}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      / {(item as any).isMoney ? fmt(item.meta) : item.meta}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: item.color }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{pct.toFixed(0)}% da meta</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BLOCO 4 — Alertas do Dia */}
      <div className="rounded-lg border p-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-500" />
          Alertas do Dia
        </h2>
        {!alertasDia || alertasDia.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm">Tudo em dia! Nenhum alerta pendente.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alertasDia.map((alerta, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 rounded-lg p-3 border ${
                  alerta.tipo === "urgente"
                    ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                    : alerta.tipo === "atencao"
                    ? "border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20"
                    : "border-blue-300 bg-blue-50 dark:bg-blue-900/20"
                }`}
              >
                <div className={`mt-0.5 ${alerta.tipo === "urgente" ? "text-red-600" : alerta.tipo === "atencao" ? "text-yellow-600" : "text-blue-600"}`}>
                  {alerta.tipo === "urgente" ? <AlertCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{alerta.titulo}</div>
                  <div className="text-xs text-muted-foreground">{alerta.descricao}</div>
                </div>
                {alerta.badge && (
                  <Badge variant={alerta.tipo === "urgente" ? "destructive" : "secondary"} className="shrink-0">
                    {alerta.badge}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </DashboardLayout>
  );
}
