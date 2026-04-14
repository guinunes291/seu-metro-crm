import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Shield,
  Clock,
  Plus,
  CheckCircle2,
  Trash2,
  RefreshCw,
  XCircle,
  Bell,
  CalendarDays,
  Phone,
  User,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatarData(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatarDataHora(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function badgeStatus(status: string | null) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    aguardando_atendimento: { label: "Aguardando", variant: "secondary" },
    em_atendimento: { label: "Em Atendimento", variant: "default" },
    agendado: { label: "Agendado", variant: "default" },
    visita_realizada: { label: "Visita Realizada", variant: "default" },
    analise_credito: { label: "Análise de Crédito", variant: "default" },
    perdido: { label: "Perdido", variant: "destructive" },
  };
  const s = map[status ?? ""] ?? { label: status ?? "—", variant: "outline" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

// ─── Componente de Tarefa ─────────────────────────────────────────────────────

function TarefaItem({
  tarefa,
  onConcluir,
  onExcluir,
}: {
  tarefa: any;
  onConcluir: (id: number) => void;
  onExcluir: (id: number) => void;
}) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataLembrete = new Date(tarefa.dataLembrete);
  const isHoje = dataLembrete >= hoje && dataLembrete < new Date(hoje.getTime() + 86400000);
  const isAtrasada = dataLembrete < hoje && !tarefa.concluida;

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border ${
        tarefa.concluida
          ? "opacity-50 bg-muted/30"
          : isAtrasada
          ? "border-destructive/40 bg-destructive/5"
          : isHoje
          ? "border-amber-400/50 bg-amber-50/10"
          : "border-border bg-card"
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${tarefa.concluida ? "line-through text-muted-foreground" : ""}`}>
          {tarefa.descricao}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <CalendarDays className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{formatarDataHora(tarefa.dataLembrete)}</span>
          {isHoje && !tarefa.concluida && (
            <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">
              Hoje
            </Badge>
          )}
          {isAtrasada && (
            <Badge variant="destructive" className="text-xs">
              Atrasada
            </Badge>
          )}
        </div>
      </div>
      {!tarefa.concluida && (
        <div className="flex gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={() => onConcluir(tarefa.id)}
            title="Marcar como concluída"
          >
            <CheckCircle2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onExcluir(tarefa.id)}
            title="Excluir tarefa"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Card de Lead na Carteira Ativa ──────────────────────────────────────────

function CarteiraCard({ item, onRefresh }: { item: any; onRefresh: () => void }) {
  const [expandido, setExpandido] = useState(false);
  const [modalTarefa, setModalTarefa] = useState(false);
  const [modalEncerrar, setModalEncerrar] = useState(false);
  const [descricaoTarefa, setDescricaoTarefa] = useState("");
  const [dataLembrete, setDataLembrete] = useState("");

  const utils = trpc.useUtils();

  const renovarMutation = trpc.carteiraAtiva.renovar.useMutation({
    onSuccess: (data) => {
      toast.success(`Proteção estendida até ${formatarData(data.novaProtecaoAte)}`);
      onRefresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const encerrarMutation = trpc.carteiraAtiva.encerrar.useMutation({
    onSuccess: () => {
      toast.success("Lead voltou para a fila de redistribuição.");
      onRefresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const criarTarefaMutation = trpc.carteiraAtiva.criarTarefa.useMutation({
    onSuccess: () => {
      toast.success("Tarefa criada!");
      setModalTarefa(false);
      setDescricaoTarefa("");
      setDataLembrete("");
      onRefresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const concluirTarefaMutation = trpc.carteiraAtiva.concluirTarefa.useMutation({
    onSuccess: () => { toast.success("Tarefa concluída!"); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });

  const excluirTarefaMutation = trpc.carteiraAtiva.excluirTarefa.useMutation({
    onSuccess: () => { toast.success("Tarefa excluída"); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });

  const tarefasPendentes = item.tarefasPendentes?.filter((t: any) => !t.concluida) ?? [];
  const tarefasConcluidas = item.tarefasPendentes?.filter((t: any) => t.concluida) ?? [];
  const tarefasHoje = item.tarefasHoje ?? [];

  const corBorda = item.expirado
    ? "border-destructive/60"
    : item.diasRestantes <= 2
    ? "border-amber-400/60"
    : "border-border";

  return (
    <Card className={`border-2 ${corBorda} transition-all`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base font-semibold truncate">
                {item.leadNome ?? `Lead #${item.leadId}`}
              </CardTitle>
              {badgeStatus(item.leadStatus)}
              {tarefasHoje.length > 0 && (
                <Badge variant="outline" className="border-amber-400 text-amber-600 gap-1">
                  <Bell className="h-3 w-3" />
                  {tarefasHoje.length} hoje
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {item.leadTelefone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {item.leadTelefone}
                </span>
              )}
              {item.leadProjeto && (
                <span className="truncate max-w-[150px]">{item.leadProjeto}</span>
              )}
            </div>
          </div>

          {/* Prazo de proteção */}
          <div className="text-right shrink-0">
            {item.expirado ? (
              <div className="flex flex-col items-end gap-1">
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Expirado
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-primary text-primary hover:bg-primary/10"
                  onClick={() => renovarMutation.mutate({ carteiraId: item.id })}
                  disabled={renovarMutation.isPending}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Renovar +3 dias
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1 text-xs">
                  <Shield className="h-3 w-3 text-green-500" />
                  <span className="text-green-600 font-medium">Protegido</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {item.diasRestantes === 0
                    ? "Expira hoje"
                    : `${item.diasRestantes} dia${item.diasRestantes !== 1 ? "s" : ""} restante${item.diasRestantes !== 1 ? "s" : ""}`}
                </span>
                <span className="text-xs text-muted-foreground">até {formatarData(item.protecaoAte)}</span>
                {item.diasRestantes <= 3 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => renovarMutation.mutate({ carteiraId: item.id })}
                    disabled={renovarMutation.isPending}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Renovar
                  </Button>
                )}
              </div>
            )}
            {item.renovacoes > 0 && (
              <span className="text-xs text-muted-foreground mt-1 block">
                {item.renovacoes} renovação{item.renovacoes !== 1 ? "ões" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Contadores de dias */}
        <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border/50">
          {/* Dias na Carteira Ativa */}
          <div className="flex items-center gap-1.5 text-xs">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <CalendarDays className="h-3 w-3 text-blue-500" />
              <span className="text-blue-700 dark:text-blue-400 font-medium">
                {item.diasNaCarteira === 0
                  ? "Hoje"
                  : `${item.diasNaCarteira} dia${item.diasNaCarteira !== 1 ? "s" : ""} na carteira`}
              </span>
            </div>
          </div>
          {/* Dias sem interação */}
          <div className="flex items-center gap-1.5 text-xs">
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full border font-medium ${
                item.diasSemInteracao === 0
                  ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                  : item.diasSemInteracao <= 2
                  ? "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400"
                  : item.diasSemInteracao <= 5
                  ? "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400"
                  : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
              }`}
            >
              <Clock className="h-3 w-3" />
              <span>
                {item.diasSemInteracao === 0
                  ? "Interagido hoje"
                  : `${item.diasSemInteracao} dia${item.diasSemInteracao !== 1 ? "s" : ""} sem contato`}
              </span>
            </div>
          </div>
        </div>
        {/* Observação */}
        {item.observacao && (
          <p className="text-xs text-muted-foreground mt-2 italic border-l-2 border-muted pl-2">
            {item.observacao}
          </p>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {/* Tarefas de hoje em destaque */}
        {tarefasHoje.length > 0 && (
          <div className="mb-3 p-2 rounded-md bg-amber-50/20 border border-amber-400/30">
            <p className="text-xs font-medium text-amber-700 mb-2 flex items-center gap-1">
              <Bell className="h-3 w-3" />
              Tarefas para hoje
            </p>
            <div className="space-y-1">
              {tarefasHoje.map((t: any) => (
                <TarefaItem
                  key={t.id}
                  tarefa={t}
                  onConcluir={(id) => concluirTarefaMutation.mutate({ tarefaId: id })}
                  onExcluir={(id) => excluirTarefaMutation.mutate({ tarefaId: id })}
                />
              ))}
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1"
            onClick={() => setModalTarefa(true)}
          >
            <Plus className="h-3 w-3" />
            Nova tarefa
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs gap-1"
            onClick={() => setExpandido(!expandido)}
          >
            {expandido ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {tarefasPendentes.length} tarefa{tarefasPendentes.length !== 1 ? "s" : ""} pendente{tarefasPendentes.length !== 1 ? "s" : ""}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
            onClick={() => setModalEncerrar(true)}
          >
            <XCircle className="h-3 w-3" />
            Encerrar
          </Button>
        </div>

        {/* Lista de tarefas expandida */}
        {expandido && (
          <div className="mt-3 space-y-2">
            {tarefasPendentes.length === 0 && tarefasConcluidas.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Nenhuma tarefa criada ainda.
              </p>
            )}
            {tarefasPendentes.map((t: any) => (
              <TarefaItem
                key={t.id}
                tarefa={t}
                onConcluir={(id) => concluirTarefaMutation.mutate({ tarefaId: id })}
                onExcluir={(id) => excluirTarefaMutation.mutate({ tarefaId: id })}
              />
            ))}
            {tarefasConcluidas.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1">Concluídas</p>
                {tarefasConcluidas.map((t: any) => (
                  <TarefaItem
                    key={t.id}
                    tarefa={t}
                    onConcluir={(id) => concluirTarefaMutation.mutate({ tarefaId: id })}
                    onExcluir={(id) => excluirTarefaMutation.mutate({ tarefaId: id })}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Modal: Nova tarefa */}
      <Dialog open={modalTarefa} onOpenChange={setModalTarefa}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova tarefa para {item.leadNome ?? `Lead #${item.leadId}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                placeholder="Ex: Ligar amanhã às 10h para confirmar visita..."
                value={descricaoTarefa}
                onChange={(e) => setDescricaoTarefa(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Data e hora do lembrete</label>
              <Input
                type="datetime-local"
                value={dataLembrete}
                onChange={(e) => setDataLembrete(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalTarefa(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!descricaoTarefa.trim() || !dataLembrete) {
                  toast.error("Preencha todos os campos");
                  return;
                }
                criarTarefaMutation.mutate({
                  carteiraId: item.id,
                  descricao: descricaoTarefa.trim(),
                  dataLembrete: new Date(dataLembrete).toISOString(),
                });
              }}
              disabled={criarTarefaMutation.isPending}
            >
              Criar tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar encerramento */}
      <Dialog open={modalEncerrar} onOpenChange={setModalEncerrar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar proteção?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O lead <strong>{item.leadNome}</strong> será removido da sua Carteira Ativa e voltará para a fila de redistribuição automática. Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEncerrar(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                encerrarMutation.mutate({ carteiraId: item.id });
                setModalEncerrar(false);
              }}
              disabled={encerrarMutation.isPending}
            >
              Confirmar encerramento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Visão do Gestor ──────────────────────────────────────────────────────────

function VisaoGestor() {
  const { data: todos, isLoading } = trpc.carteiraAtiva.listarTodos.useQuery();
  const { data: resumo } = trpc.carteiraAtiva.resumoGestor.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo por corretor */}
      {resumo && resumo.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {resumo.map((r: any) => (
            <Card key={r.corretorId} className="p-3">
              <p className="text-sm font-medium truncate">{r.corretorNome ?? `Corretor #${r.corretorId}`}</p>
              <p className="text-2xl font-bold mt-1">{r.total}</p>
              <p className="text-xs text-muted-foreground">
                {r.expirados > 0 && (
                  <span className="text-destructive">{r.expirados} expirado{r.expirados !== 1 ? "s" : ""}</span>
                )}
                {r.expirados === 0 && "Todos protegidos"}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Tabela de todos os leads */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Todos os leads em Carteira Ativa</CardTitle>
        </CardHeader>
        <CardContent>
          {!todos || todos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum lead em Carteira Ativa no momento.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-2 pr-4">Lead</th>
                    <th className="text-left py-2 pr-4">Corretor</th>
                    <th className="text-left py-2 pr-4">Status</th>
                    <th className="text-left py-2 pr-4">Proteção até</th>
                    <th className="text-left py-2 pr-4">Dias restantes</th>
                    <th className="text-left py-2">Renovações</th>
                  </tr>
                </thead>
                <tbody>
                  {todos.map((item: any) => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 pr-4">
                        <div>
                          <p className="font-medium">{item.leadNome ?? `Lead #${item.leadId}`}</p>
                          {item.leadTelefone && (
                            <p className="text-xs text-muted-foreground">{item.leadTelefone}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-4">{item.corretorNome ?? `#${item.corretorId}`}</td>
                      <td className="py-2 pr-4">{badgeStatus(item.leadStatus)}</td>
                      <td className="py-2 pr-4">{formatarData(item.protecaoAte)}</td>
                      <td className="py-2 pr-4">
                        {item.expirado ? (
                          <Badge variant="destructive">Expirado</Badge>
                        ) : (
                          <span className={item.diasRestantes <= 2 ? "text-amber-600 font-medium" : ""}>
                            {item.diasRestantes} dia{item.diasRestantes !== 1 ? "s" : ""}
                          </span>
                        )}
                      </td>
                      <td className="py-2">{item.renovacoes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Quick Button (usado no modal de detalhes do lead) ──────────────────────

export function CarteiraAtivaQuickButton({ leadId, leadNome }: { leadId: number; leadNome: string }) {
  const utils = trpc.useUtils();
  const { data: carteira } = trpc.carteiraAtiva.listar.useQuery();
  const adicionarMutation = trpc.carteiraAtiva.adicionar.useMutation({
    onSuccess: () => {
      toast.success(`"${leadNome}" adicionado à Carteira Ativa! Protegido por 15 dias.`);
      utils.carteiraAtiva.listar.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const jaEstaNaCarteira = carteira?.some((c: any) => c.leadId === leadId);

  if (jaEstaNaCarteira) {
    return (
      <div className="flex items-center gap-2 mt-3 pt-3 border-t">
        <Shield className="h-4 w-4 text-green-600" />
        <span className="text-sm text-green-700 font-medium">Na Carteira Ativa</span>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t">
      <Button
        variant="outline"
        size="sm"
        className="border-green-300 text-green-700 hover:bg-green-50"
        onClick={() => adicionarMutation.mutate({ leadId })}
        disabled={adicionarMutation.isPending}
      >
        <Shield className="h-4 w-4 mr-1" />
        {adicionarMutation.isPending ? "Adicionando..." : "Adicionar à Carteira Ativa"}
      </Button>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function CarteiraAtiva() {
    const { user } = useAuth();
  const isGestor = user?.role === "gestor" || user?.role === "admin" || user?.role === "superintendente";
  const [ordenacao, setOrdenacao] = useState<"urgencia" | "semContato" | "naCarteira" | "expiracao">("urgencia");
  const { data: carteira, isLoading, refetch } = trpc.carteiraAtiva.listar.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000, // 5 minutos (reduzido de 60s — carteira ativa muda lentamente)
  });
  const { data: tarefasHoje } = trpc.carteiraAtiva.tarefasHoje.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000, // 5 minutos
  });
  const totalItens = carteira?.length ?? 0;
  const itensExpirados = carteira?.filter((i) => i.expirado).length ?? 0;
  const tarefasHojeCount = tarefasHoje?.length ?? 0;

  // Ordenação dos cards
  const carteiraOrdenada = carteira ? [...carteira].sort((a, b) => {
    if (ordenacao === "semContato") {
      return (b.diasSemInteracao ?? 0) - (a.diasSemInteracao ?? 0);
    }
    if (ordenacao === "naCarteira") {
      return (b.diasNaCarteira ?? 0) - (a.diasNaCarteira ?? 0);
    }
    if (ordenacao === "expiracao") {
      // Expirados primeiro, depois por menor dias restantes
      if (a.expirado !== b.expirado) return a.expirado ? -1 : 1;
      return a.diasRestantes - b.diasRestantes;
    }
    // urgencia: expirados + sem contato há mais tempo primeiro
    const scoreA = (a.expirado ? 1000 : 0) + (a.diasSemInteracao ?? 0);
    const scoreB = (b.expirado ? 1000 : 0) + (b.diasSemInteracao ?? 0);
    return scoreB - scoreA;
  }) : [];;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Carteira Ativa
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Leads em tratamento ativo — protegidos contra redistribuição automática
            </p>
          </div>
          {/* Seletor de ordenação */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block">Ordenar por:</span>
            <div className="flex gap-1 flex-wrap">
              {([
                { key: "urgencia", label: "Urgência" },
                { key: "semContato", label: "Sem contato" },
                { key: "naCarteira", label: "Tempo na carteira" },
                { key: "expiracao", label: "Expiração" },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setOrdenacao(key)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    ordenacao === key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs: Corretor vs Gestor */}
        <Tabs defaultValue="minha">
          <TabsList>
            <TabsTrigger value="minha">Minha Carteira</TabsTrigger>
            {isGestor && <TabsTrigger value="equipe">Visão da Equipe</TabsTrigger>}
          </TabsList>

          {/* ── Minha Carteira ── */}
          <TabsContent value="minha" className="space-y-4 mt-4">
            {/* Métricas rápidas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Na carteira</p>
                <p className="text-2xl font-bold mt-1">{totalItens}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Expirados</p>
                <p className={`text-2xl font-bold mt-1 ${itensExpirados > 0 ? "text-destructive" : ""}`}>
                  {itensExpirados}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Tarefas hoje</p>
                <p className={`text-2xl font-bold mt-1 ${tarefasHojeCount > 0 ? "text-amber-600" : ""}`}>
                  {tarefasHojeCount}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Proteção</p>
                <p className="text-xs font-medium mt-2 text-green-600 flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  15 dias + renovações de 3 dias
                </p>
              </Card>
            </div>

            {/* Tarefas do dia em destaque */}
            {tarefasHoje && tarefasHoje.length > 0 && (
              <Card className="border-amber-400/50 bg-amber-50/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
                    <Bell className="h-4 w-4" />
                    Tarefas para hoje ({tarefasHoje.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {tarefasHoje.map((t: any) => (
                      <div key={t.id} className="flex items-center gap-3 text-sm">
                        <Clock className="h-3 w-3 text-amber-600 shrink-0" />
                        <span className="flex-1 truncate">{t.descricao}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {t.leadNome ?? `Lead #${t.leadId}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lista de leads */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : !carteira || carteira.length === 0 ? (
              <Card className="p-12 text-center">
                <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Sua Carteira Ativa está vazia</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Para adicionar um lead à Carteira Ativa, abra o lead na aba "Meus Leads" e clique em "Adicionar à Carteira Ativa". O lead ficará protegido por 15 dias contra redistribuição automática.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {carteiraOrdenada.map((item) => (
                  <CarteiraCard key={item.id} item={item} onRefresh={refetch} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Visão da Equipe (Gestor) ── */}
          {isGestor && (
            <TabsContent value="equipe" className="mt-4">
              <VisaoGestor />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
