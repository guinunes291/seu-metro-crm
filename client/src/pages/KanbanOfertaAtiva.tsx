import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Phone, ExternalLink, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

type KanbanStatus = "ofertar" | "tratando" | "agendou" | "sem_retorno" | "perdido";

const COLUNAS: { key: KanbanStatus; label: string; color: string; bgHeader: string }[] = [
  { key: "ofertar", label: "Ofertar", color: "text-blue-700", bgHeader: "bg-blue-50 border-blue-200" },
  { key: "tratando", label: "Tratando", color: "text-yellow-700", bgHeader: "bg-yellow-50 border-yellow-200" },
  { key: "agendou", label: "Agendou", color: "text-green-700", bgHeader: "bg-green-50 border-green-200" },
  { key: "sem_retorno", label: "Sem Retorno", color: "text-orange-700", bgHeader: "bg-orange-50 border-orange-200" },
  { key: "perdido", label: "Perdido", color: "text-red-700", bgHeader: "bg-red-50 border-red-200" },
];

function temperaturaDot(t: string | null | undefined) {
  if (t === "quente") return "🔥";
  if (t === "morno") return "🟡";
  if (t === "frio") return "🔵";
  return "⚪";
}

function diasSemContato(data: Date | string | null | undefined): string {
  if (!data) return "—";
  const d = new Date(data);
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
  return dias === 0 ? "hoje" : `${dias}d`;
}

type ItemComLead = {
  id: number;
  leadId: number;
  statusKanban: KanbanStatus;
  observacao: string | null;
  contatadoEm: Date | null;
  agendamentoId: number | null;
  ordem: number;
  ofertaId: number;
  createdAt: Date;
  lead: {
    nome: string | null;
    telefone: string | null;
    temperatura: string | null;
    status: string | null;
    ultimaInteracao: Date | null;
    projectId: number | null;
  };
};

export default function KanbanOfertaAtiva() {
  const [match, params] = useRoute("/oferta-ativa/:id");
  const [, navigate] = useLocation();
  const ofertaId = params?.id ? Number(params.id) : 0;

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.ofertaAtiva.get.useQuery({ id: ofertaId }, { enabled: !!ofertaId });

  const updateMutation = trpc.ofertaAtiva.updateItem.useMutation({
    onSuccess: () => {
      utils.ofertaAtiva.get.invalidate({ id: ofertaId });
      setSelectedItem(null);
    },
  });

  const [selectedItem, setSelectedItem] = useState<ItemComLead | null>(null);
  const [editStatus, setEditStatus] = useState<KanbanStatus>("ofertar");
  const [editObs, setEditObs] = useState("");
  const [agendData, setAgendData] = useState("");
  const [agendHora, setAgendHora] = useState("");
  const [agendProjectId, setAgendProjectId] = useState<number | undefined>();

  function openItem(item: ItemComLead) {
    setSelectedItem(item);
    setEditStatus(item.statusKanban);
    setEditObs(item.observacao ?? "");
    setAgendData("");
    setAgendHora("");
    setAgendProjectId(undefined);
  }

  function saveItem() {
    if (!selectedItem) return;
    updateMutation.mutate({
      itemId: selectedItem.id,
      statusKanban: editStatus,
      observacao: editObs || undefined,
      agendamentoData: editStatus === "agendou" ? agendData : undefined,
      agendamentoHora: editStatus === "agendou" ? agendHora : undefined,
      agendamentoProjectId: agendProjectId,
    });
  }

  function quickMove(item: ItemComLead, toStatus: KanbanStatus) {
    updateMutation.mutate({ itemId: item.id, statusKanban: toStatus });
  }

  if (!match || !ofertaId) return null;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-muted-foreground">Oferta não encontrada.</div>
      </DashboardLayout>
    );
  }

  const oferta = data;
  const itens = oferta.itens as unknown as ItemComLead[];
  const pctContato = oferta.totalLeads > 0 ? Math.round((oferta.totalContatados / oferta.totalLeads) * 100) : 0;
  const pctAvanc = oferta.totalLeads > 0 ? Math.round((oferta.totalAvancados / oferta.totalLeads) * 100) : 0;

  const itensByStatus = COLUNAS.reduce((acc, col) => {
    acc[col.key] = itens.filter((i) => i.statusKanban === col.key);
    return acc;
  }, {} as Record<KanbanStatus, ItemComLead[]>);

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-64px)]">
        {/* Header */}
        <div className="border-b bg-white px-6 py-4 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/oferta-ativa")}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="font-bold text-lg">{oferta.nome}</h1>
                <p className="text-xs text-muted-foreground">
                  {oferta.totalLeads} leads · {pctContato}% contatados · {pctAvanc}% agendados
                </p>
              </div>
            </div>
            <div className="flex gap-4 items-center">
              <div className="text-right text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <span>Contato</span>
                  <Progress value={pctContato} className="w-24 h-1.5" />
                  <span className="w-8 text-right">{pctContato}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Avanço</span>
                  <Progress value={pctAvanc} className="w-24 h-1.5 [&>div]:bg-green-500" />
                  <span className="w-8 text-right">{pctAvanc}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-3 h-full min-w-max">
            {COLUNAS.map((col) => {
              const colItens = itensByStatus[col.key] ?? [];
              return (
                <div key={col.key} className="flex flex-col w-72 shrink-0">
                  <div className={`border rounded-t-lg px-3 py-2 flex items-center justify-between ${col.bgHeader}`}>
                    <span className={`font-semibold text-sm ${col.color}`}>{col.label}</span>
                    <Badge variant="outline" className="text-xs">{colItens.length}</Badge>
                  </div>
                  <div className="flex-1 overflow-y-auto border border-t-0 rounded-b-lg bg-muted/30 p-2 space-y-2">
                    {colItens.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white border rounded-lg p-3 cursor-pointer hover:shadow-sm transition-shadow"
                        onClick={() => openItem(item)}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <p className="text-sm font-medium leading-tight line-clamp-1">
                            {temperaturaDot(item.lead.temperatura)} {item.lead.nome ?? `Lead #${item.leadId}`}
                          </p>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {diasSemContato(item.lead.ultimaInteracao)}
                          </span>
                        </div>
                        {item.lead.telefone && (
                          <a
                            href={`https://wa.me/55${item.lead.telefone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone className="w-3 h-3" />
                            {item.lead.telefone}
                          </a>
                        )}
                        <div className="flex gap-1 mt-2">
                          {COLUNAS.indexOf(col) > 0 && (
                            <button
                              className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 transition-colors"
                              onClick={(e) => { e.stopPropagation(); quickMove(item, COLUNAS[COLUNAS.indexOf(col) - 1].key); }}
                            >
                              ←
                            </button>
                          )}
                          {COLUNAS.indexOf(col) < COLUNAS.length - 1 && (
                            <button
                              className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 transition-colors"
                              onClick={(e) => { e.stopPropagation(); quickMove(item, COLUNAS[COLUNAS.indexOf(col) + 1].key); }}
                            >
                              →
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {colItens.length === 0 && (
                      <div className="text-center py-6 text-xs text-muted-foreground/50">Vazio</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Side Sheet */}
        <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
          <SheetContent className="w-96">
            {selectedItem && (
              <>
                <SheetHeader>
                  <SheetTitle className="line-clamp-1">
                    {selectedItem.lead.nome ?? `Lead #${selectedItem.leadId}`}
                  </SheetTitle>
                </SheetHeader>

                <div className="mt-4 space-y-4">
                  {selectedItem.lead.telefone && (
                    <div className="flex gap-2">
                      <a
                        href={`https://wa.me/55${selectedItem.lead.telefone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-50 text-green-700 rounded-lg text-sm hover:bg-green-100 transition-colors"
                      >
                        <Phone className="w-4 h-4" />
                        WhatsApp
                      </a>
                      <a
                        href={`/leads?id=${selectedItem.leadId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm hover:bg-muted/80 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground space-y-1 border rounded-lg p-3">
                    {selectedItem.lead.temperatura && (
                      <p>Temperatura: {temperaturaDot(selectedItem.lead.temperatura)} {selectedItem.lead.temperatura}</p>
                    )}
                    {selectedItem.lead.status && (
                      <p>Status CRM: <span className="font-medium">{selectedItem.lead.status}</span></p>
                    )}
                    {selectedItem.lead.ultimaInteracao && (
                      <p>Última interação: {new Date(selectedItem.lead.ultimaInteracao).toLocaleDateString("pt-BR")}</p>
                    )}
                  </div>

                  <div>
                    <Label>Mover para</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {COLUNAS.map((col) => (
                        <button
                          key={col.key}
                          type="button"
                          onClick={() => setEditStatus(col.key)}
                          className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                            editStatus === col.key
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background border-border hover:border-primary/50"
                          }`}
                        >
                          {col.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {editStatus === "agendou" && (
                    <div className="border rounded-lg p-3 space-y-3 bg-green-50">
                      <p className="text-xs font-medium text-green-700">Registrar agendamento</p>
                      <div>
                        <Label className="text-xs">Data *</Label>
                        <Input
                          type="date"
                          value={agendData}
                          onChange={(e) => setAgendData(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Hora *</Label>
                        <Input
                          type="time"
                          value={agendHora}
                          onChange={(e) => setAgendHora(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <Label>Observação</Label>
                    <Textarea
                      value={editObs}
                      onChange={(e) => setEditObs(e.target.value)}
                      placeholder="Anotar o que aconteceu..."
                      rows={3}
                      className="mt-1"
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={saveItem}
                    disabled={
                      updateMutation.isPending ||
                      (editStatus === "agendou" && (!agendData || !agendHora))
                    }
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Salvar
                  </Button>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </DashboardLayout>
  );
}
