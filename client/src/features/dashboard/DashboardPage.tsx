import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  Zap, Users2, CheckSquare, Calendar, AlertTriangle,
  Phone, MessageCircle, TrendingUp, Trophy, BarChart2, GitBranch,
} from "lucide-react";
import { formatTimeAgo } from "@/lib/utils";

function DashboardCorretor() {
  const [, setLocation] = useLocation();
  const { data: prioridades, isLoading } = trpc.dashboard.leadsPrioritarios.useQuery(undefined, {
    refetchInterval: 30_000,
    staleTime: 0,
  });

  const urgentes = [
    ...(prioridades?.semPrimeiroContato ?? []),
    ...(prioridades?.followUpsVencidos ?? []),
  ].slice(0, 5);

  const agendamentosHoje = prioridades?.agendamentosHoje ?? [];
  const leadsQuentes = prioridades?.leadsQuentes ?? [];

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-3xl">
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setLocation("/modo-blitz")}
          className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold transition-colors shadow-sm"
        >
          <Zap className="h-5 w-5" />
          <span className="text-xs">Modo Blitz</span>
        </button>
        <button
          onClick={() => setLocation("/kanban")}
          className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border bg-card hover:bg-muted transition-colors"
        >
          <Users2 className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Kanban</span>
        </button>
        <button
          onClick={() => setLocation("/tarefas-do-dia")}
          className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border bg-card hover:bg-muted transition-colors"
        >
          <CheckSquare className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Tarefas</span>
        </button>
      </div>

      <Card className={urgentes.length > 0 ? "border-red-200" : undefined}>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className={`h-4 w-4 ${urgentes.length > 0 ? "text-red-500" : "text-muted-foreground"}`} />
            Ações Urgentes
            {urgentes.length > 0 && (
              <Badge variant="destructive" className="ml-auto text-[10px] h-5 px-1.5">{urgentes.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : urgentes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-1">✅ Nenhuma ação urgente — bom trabalho!</p>
          ) : (
            urgentes.map((lead: any) => (
              <div
                key={lead.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-red-50 border border-red-100 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{lead.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {lead.updatedAt ? formatTimeAgo(lead.updatedAt) : "—"}
                      {lead.status && <> · {lead.status}</>}
                    </p>
                  </div>
                </div>
                {lead.telefone && (
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <a href={`tel:${lead.telefone}`} className="p-1.5 rounded-md bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                    <a
                      href={`https://wa.me/55${lead.telefone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {agendamentosHoje.length > 0 && (
        <Card>
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              Agendamentos Hoje
              <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">{agendamentosHoje.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {agendamentosHoje.slice(0, 3).map((ag: any) => (
              <div key={ag.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                <Calendar className="h-4 w-4 text-blue-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{ag.nome ?? ag.lead?.nome ?? "Agendamento"}</p>
                  <p className="text-xs text-muted-foreground">{ag.dataHora ? formatTimeAgo(ag.dataHora) : "Hoje"}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {leadsQuentes.length > 0 && (
        <Card>
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-500" />
              Leads Quentes
              <Badge className="ml-auto text-[10px] h-5 px-1.5 bg-amber-100 text-amber-700 hover:bg-amber-200">{leadsQuentes.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {leadsQuentes.slice(0, 4).map((lead: any) => (
              <div key={lead.id} className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 border border-amber-100 group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{lead.nome}</p>
                    <p className="text-xs text-muted-foreground">{lead.origem ?? "—"}</p>
                  </div>
                </div>
                {lead.telefone && (
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <a href={`tel:${lead.telefone}`} className="p-1.5 rounded-md bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                    <a href={`https://wa.me/55${lead.telefone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
                      <MessageCircle className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DashboardGestor() {
  const [, setLocation] = useLocation();
  const { data: alertas, isLoading } = trpc.alertasGestor.lista.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const followUpsVencidos = alertas?.followUpsVencidos?.length ?? 0;
  const corretoresSemAtividade = alertas?.corretoresSemAtividade?.length ?? 0;
  const leadsSemContato = alertas?.leadsSemPrimeiroContato?.length ?? 0;
  const agendamentosSemConfirmacao = alertas?.agendamentosSemConfirmacao?.length ?? 0;

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-4xl">
      <div className="grid grid-cols-4 gap-3">
        <button onClick={() => setLocation("/leads")} className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border bg-card hover:bg-muted transition-colors">
          <Users2 className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Leads</span>
        </button>
        <button onClick={() => setLocation("/monitoramento-followups")} className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border bg-card hover:bg-muted transition-colors">
          <GitBranch className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Monitoramento</span>
        </button>
        <button onClick={() => setLocation("/relatorios")} className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border bg-card hover:bg-muted transition-colors">
          <BarChart2 className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Relatórios</span>
        </button>
        <button onClick={() => setLocation("/ranking-tv")} className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border bg-card hover:bg-muted transition-colors">
          <Trophy className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Ranking</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className={followUpsVencidos > 0 ? "border-red-200" : undefined}>
          <CardContent className="p-4">
            <div className={`text-2xl font-bold ${followUpsVencidos > 0 ? "text-red-600" : "text-foreground"}`}>
              {isLoading ? "—" : followUpsVencidos}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Follow-ups vencidos</div>
          </CardContent>
        </Card>
        <Card className={leadsSemContato > 0 ? "border-orange-200" : undefined}>
          <CardContent className="p-4">
            <div className={`text-2xl font-bold ${leadsSemContato > 0 ? "text-orange-600" : "text-foreground"}`}>
              {isLoading ? "—" : leadsSemContato}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Leads sem contato</div>
          </CardContent>
        </Card>
        <Card className={corretoresSemAtividade > 0 ? "border-yellow-200" : undefined}>
          <CardContent className="p-4">
            <div className={`text-2xl font-bold ${corretoresSemAtividade > 0 ? "text-yellow-600" : "text-foreground"}`}>
              {isLoading ? "—" : corretoresSemAtividade}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Corretores inativos</div>
          </CardContent>
        </Card>
        <Card className={agendamentosSemConfirmacao > 0 ? "border-blue-200" : undefined}>
          <CardContent className="p-4">
            <div className={`text-2xl font-bold ${agendamentosSemConfirmacao > 0 ? "text-blue-600" : "text-foreground"}`}>
              {isLoading ? "—" : agendamentosSemConfirmacao}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Ag. s/ confirmação</div>
          </CardContent>
        </Card>
      </div>

      {leadsSemContato > 0 && alertas?.leadsSemPrimeiroContato && (
        <Card className="border-orange-200">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Leads aguardando primeiro contato
              <Badge className="ml-auto text-[10px] h-5 px-1.5 bg-orange-100 text-orange-700 hover:bg-orange-200">{leadsSemContato}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {alertas.leadsSemPrimeiroContato.slice(0, 5).map((lead: any) => (
              <div key={lead.id} className="flex items-center justify-between p-2.5 rounded-lg bg-orange-50 border border-orange-100">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{lead.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {lead.corretor?.name ?? "Sem corretor"} · {lead.updatedAt ? formatTimeAgo(lead.updatedAt) : "—"}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] h-5 shrink-0">{lead.origem ?? "—"}</Badge>
              </div>
            ))}
            {alertas.leadsSemPrimeiroContato.length > 5 && (
              <button onClick={() => setLocation("/leads")} className="text-xs text-primary hover:underline pl-1 mt-1">
                Ver todos ({alertas.leadsSemPrimeiroContato.length})
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {followUpsVencidos > 0 && alertas?.followUpsVencidos && (
        <Card className="border-red-200">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Follow-ups vencidos na equipe
              <Badge variant="destructive" className="ml-auto text-[10px] h-5 px-1.5">{followUpsVencidos}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {alertas.followUpsVencidos.slice(0, 5).map((item: any) => (
              <div key={item.id} className="flex items-center p-2.5 rounded-lg bg-red-50 border border-red-100">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.lead?.nome ?? item.nome ?? "Lead"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.corretor?.name ?? item.user?.name ?? "—"} · {item.dataHora ? formatTimeAgo(item.dataHora) : "—"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isCorretor = user?.role === "corretor";

  return (
    <DashboardLayout>
      <div>
        <div className="p-4 lg:p-6 pb-2">
          <h1 className="text-xl font-bold">
            {isCorretor ? `Olá, ${(user?.name ?? "").split(" ")[0]}!` : "Painel de Controle"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isCorretor ? "Seu resumo de hoje" : "Visão geral da equipe"}
          </p>
        </div>
        {isCorretor ? <DashboardCorretor /> : <DashboardGestor />}
      </div>
    </DashboardLayout>
  );
}
