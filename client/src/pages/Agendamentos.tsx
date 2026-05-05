import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Plus, 
  Calendar, 
  Clock, 
  Phone, 
  User, 
  Building2, 
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  MapPin,
  List,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Check,
  X
} from "lucide-react";
import CalendarioAgendamentos from "@/components/CalendarioAgendamentos";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

type Lead = {
  id: number;
  nome: string;
  telefone: string;
  email: string | null;
  cpf: string | null;
  status: string;
  projectId: number | null;
  projectName?: string;
};

type Agendamento = {
  id: number;
  leadId: number;
  corretorId: number;
  projectId: number | null;
  projetoCustom: string | null;
  construtora: string | null;
  dataAgendamento: Date;
  horaAgendamento: string;
  status: string;
  observacoes: string | null;
  createdAt: Date;
};

type Project = {
  id: number;
  nome: string;
  construtora: string | null;
};

const STATUS_CONFIG = {
  pendente: { label: "Pendente", color: "bg-yellow-500", icon: AlertCircle },
  confirmado: { label: "Confirmado", color: "bg-blue-500", icon: CheckCircle },
  realizado: { label: "Realizado", color: "bg-green-500", icon: CheckCircle },
  cancelado: { label: "Cancelado", color: "bg-red-500", icon: XCircle },
  reagendado: { label: "Reagendado", color: "bg-orange-500", icon: AlertCircle },
  nao_compareceu: { label: "Não Compareceu", color: "bg-gray-500", icon: XCircle }, // Fase 2
};

export default function AgendamentosPage() {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [useCustomProject, setUseCustomProject] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedHour, setSelectedHour] = useState("");
  const [selectedMinute, setSelectedMinute] = useState("");
  const [formData, setFormData] = useState({
    projectId: "",
    projetoCustom: "",
    construtora: "",
    dataAgendamento: "",
    horaAgendamento: "",
    observacoes: "",
  });

  const HOURS = Array.from({ length: 14 }, (_, i) => String(i + 7).padStart(2, "0")); // 07-20
  const MINUTES = ["00", "15", "30", "45"];

  // Queries
  const { data: agendamentos, isLoading } = trpc.agendamentos.list.useQuery();
  const { data: agendamentosHoje } = trpc.agendamentos.hoje.useQuery();
  const { data: leads } = trpc.leads.list.useQuery();
  const { data: projetos } = trpc.projects.list.useQuery();

  // Mutations
  const utils = trpc.useUtils();
  const createAgendamento = trpc.agendamentos.create.useMutation({
    onSuccess: () => {
      toast.success("Agendamento criado com sucesso!");
      setIsSubmitting(false);
      setIsModalOpen(false);
      resetForm();
      utils.agendamentos.list.invalidate();
      utils.agendamentos.hoje.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar agendamento");
      setIsSubmitting(false);
    },
  });

  const updateStatus = trpc.agendamentos.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado com sucesso!");
      utils.agendamentos.list.invalidate();
      utils.agendamentos.hoje.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar status");
    },
  });

  // Filtrar leads pela busca
  const leadsArray = Array.isArray(leads) ? leads : (leads?.leads || []);
  const filteredLeads = leadsArray.filter((lead: Lead) =>
    lead.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.telefone.includes(searchTerm)
  );

  // Agrupar agendamentos por data
  const agendamentosPorData = (agendamentos || []).reduce((acc: Record<string, Agendamento[]>, ag: Agendamento) => {
    // ag.dataAgendamento já vem como Date do backend, não precisa parseISO
    const data = format(new Date(ag.dataAgendamento), "yyyy-MM-dd");
    if (!acc[data]) acc[data] = [];
    acc[data].push(ag);
    return acc;
  }, {});

  const datasOrdenadas = Object.keys(agendamentosPorData).sort();

  const resetForm = () => {
    setSelectedLead(null);
    setSearchTerm("");
    setUseCustomProject(false);
    setSelectedDate(undefined);
    setSelectedHour("");
    setSelectedMinute("");
    setFormData({
      projectId: "",
      projetoCustom: "",
      construtora: "",
      dataAgendamento: "",
      horaAgendamento: "",
      observacoes: "",
    });
  };

  const handleSubmit = () => {
    if (isSubmitting || createAgendamento.isPending) return;

    if (!selectedLead) {
      toast.error("Selecione um cliente");
      return;
    }

    if (!selectedDate) {
      toast.error("Selecione a data do agendamento");
      return;
    }

    if (!selectedHour || !selectedMinute) {
      toast.error("Selecione o horário do agendamento");
      return;
    }

    if (!useCustomProject && !formData.projectId) {
      toast.error("Selecione um projeto ou digite um nome customizado");
      return;
    }

    if (useCustomProject && !formData.projetoCustom) {
      toast.error("Digite o nome do projeto");
      return;
    }

    const dataFormatted = format(selectedDate, "yyyy-MM-dd");
    const horaFormatted = `${selectedHour}:${selectedMinute}`;

    setIsSubmitting(true);
    createAgendamento.mutate({
      leadId: selectedLead.id,
      projectId: useCustomProject ? undefined : parseInt(formData.projectId),
      projetoCustom: useCustomProject ? formData.projetoCustom : undefined,
      construtora: formData.construtora || undefined,
      dataAgendamento: dataFormatted,
      horaAgendamento: horaFormatted,
      observacoes: formData.observacoes || undefined,
    });
  };

  const handleCreateFromCalendar = (date: Date) => {
    setSelectedDate(date);
    setFormData({
      ...formData,
      dataAgendamento: format(date, "yyyy-MM-dd"),
    });
    setIsModalOpen(true);
  };

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Agendamentos</h1>
            <p className="text-muted-foreground">
              Gerencie seus agendamentos de visitas
            </p>
          </div>

          {/* Botão Criar Agendamento */}
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Criar Agendamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Novo Agendamento</DialogTitle>
                <DialogDescription>
                  Preencha os dados para agendar uma visita com o cliente
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Buscar Cliente */}
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        {selectedLead ? selectedLead.nome : "Buscar cliente..."}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput
                          placeholder="Digite nome ou telefone..."
                          value={searchTerm}
                          onValueChange={setSearchTerm}
                        />
                        <CommandList>
                          <CommandEmpty>Nenhum cliente encontrado</CommandEmpty>
                          <CommandGroup>
                            {filteredLeads.slice(0, 10).map((lead: Lead) => (
                              <CommandItem
                                key={lead.id}
                                onSelect={() => {
                                  setSelectedLead(lead);
                                  setSearchTerm("");
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{lead.nome}</span>
                                  <span className="text-sm text-muted-foreground">
                                    {lead.telefone}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Projeto */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Projeto *</Label>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setUseCustomProject(!useCustomProject)}
                    >
                      {useCustomProject ? "Selecionar da lista" : "Digitar manualmente"}
                    </Button>
                  </div>

                  <Select
                    value={formData.projectId}
                    onValueChange={(value) => setFormData({ ...formData, projectId: value })}
                    disabled={useCustomProject}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      {projetos?.map((projeto: Project) => (
                        <SelectItem key={projeto.id} value={projeto.id.toString()}>
                          {projeto.nome}
                          {projeto.construtora && (
                            <span className="text-muted-foreground ml-2">
                              ({projeto.construtora})
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Projeto customizado */}
                {useCustomProject && (
                  <div className="space-y-2">
                    <Label>Nome do Projeto</Label>
                    <Input
                      placeholder="Digite o nome do projeto"
                      value={formData.projetoCustom}
                      onChange={(e) => setFormData({ ...formData, projetoCustom: e.target.value })}
                    />
                  </div>
                )}

                {/* Construtora */}
                <div className="space-y-2">
                  <Label>Construtora</Label>
                  <Input
                    placeholder="Nome da construtora"
                    value={formData.construtora}
                    onChange={(e) => setFormData({ ...formData, construtora: e.target.value })}
                  />
                </div>

                {/* Data */}
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <div className="flex justify-center">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        if (date) {
                          setFormData({ ...formData, dataAgendamento: format(date, "yyyy-MM-dd") });
                        }
                      }}
                      disabled={(date) => isBefore(date, startOfDay(new Date()))}
                      locale={ptBR}
                      className="rounded-md border"
                    />
                  </div>
                  {selectedDate && (
                    <p className="text-sm text-center text-muted-foreground">
                      Selecionado: {format(selectedDate, "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                    </p>
                  )}
                </div>

                {/* Hora */}
                <div className="space-y-2">
                  <Label>Horário *</Label>
                  <div className="flex gap-4 items-center">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground mb-1 block">Hora</Label>
                      <div className="grid grid-cols-7 gap-1">
                        {HOURS.map((h) => (
                          <Button
                            key={h}
                            type="button"
                            size="sm"
                            variant={selectedHour === h ? "default" : "outline"}
                            className="h-8 text-xs"
                            onClick={() => setSelectedHour(h)}
                          >
                            {h}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="w-24">
                      <Label className="text-xs text-muted-foreground mb-1 block">Min</Label>
                      <div className="grid grid-cols-2 gap-1">
                        {MINUTES.map((m) => (
                          <Button
                            key={m}
                            type="button"
                            size="sm"
                            variant={selectedMinute === m ? "default" : "outline"}
                            className="h-8 text-xs"
                            onClick={() => setSelectedMinute(m)}
                          >
                            {m}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {selectedHour && selectedMinute && (
                    <p className="text-sm text-center text-muted-foreground">
                      Horário: {selectedHour}:{selectedMinute}
                    </p>
                  )}
                </div>

                {/* Observações */}
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    placeholder="Observações sobre o agendamento..."
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={isSubmitting || createAgendamento.isPending}
                >
                  {(isSubmitting || createAgendamento.isPending) ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Criando...
                    </>
                  ) : (
                    "Criar Agendamento"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs de Visualização */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "calendar")} className="w-full">
          <TabsList className="grid w-full max-w-[300px] grid-cols-2">
            <TabsTrigger value="calendar" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Calendário
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-2">
              <List className="h-4 w-4" />
              Lista
            </TabsTrigger>
          </TabsList>

          {/* Visualização em Calendário */}
          <TabsContent value="calendar" className="mt-4">
            <CalendarioAgendamentos
              onCreateAgendamento={handleCreateFromCalendar}
              onSelectAgendamento={(ag) => {
                toast.info(`Agendamento: ${ag.projetoCustom || 'Sem projeto'} - ${ag.horaAgendamento}`);
              }}
            />
          </TabsContent>

          {/* Visualização em Lista */}
          <TabsContent value="list" className="mt-4 space-y-6">
            {/* Agendamentos de Hoje */}
            {agendamentosHoje && agendamentosHoje.length > 0 && (
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Agendamentos de Hoje ({agendamentosHoje.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {agendamentosHoje.map((ag: Agendamento) => (
                      <AgendamentoCard
                        key={ag.id}
                        agendamento={ag}
                        onUpdateStatus={(status) => updateStatus.mutate({ id: ag.id, status })}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lista de Agendamentos */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : datasOrdenadas.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">Nenhum agendamento</h3>
                  <p className="text-muted-foreground">
                    Clique em "Criar Agendamento" para agendar uma visita
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {datasOrdenadas.map((data) => (
                  <div key={data}>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      {format(parseISO(data + "T12:00:00"), "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </h3>
                    <div className="grid gap-3">
                      {agendamentosPorData[data].map((ag: Agendamento) => (
                        <AgendamentoCard
                          key={ag.id}
                          agendamento={ag}
                          onUpdateStatus={(status) => updateStatus.mutate({ id: ag.id, status })}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// Componente de Card de Agendamento com Detalhes Expandíveis
function AgendamentoCard({ 
  agendamento, 
  onUpdateStatus 
}: { 
  agendamento: Agendamento;
  onUpdateStatus: (status: 'pendente' | 'confirmado' | 'realizado' | 'cancelado' | 'reagendado' | 'nao_compareceu') => void; // Fase 2
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: lead } = trpc.leads.getById.useQuery({ id: agendamento.leadId });
  const { data: corretor } = trpc.users.getById.useQuery({ id: agendamento.corretorId });
  const { data: projeto } = trpc.projects.getById.useQuery(
    { id: agendamento.projectId! },
    { enabled: !!agendamento.projectId }
  );
  
  const statusConfig = STATUS_CONFIG[agendamento.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pendente;
  const StatusIcon = statusConfig.icon;

  const nomeProjeto = projeto?.nome || agendamento.projetoCustom || "Projeto não especificado";

  // Formatar data de agendamento de forma segura
  const formatDataAgendamento = (dataStr: any) => {
    try {
      if (!dataStr) return "-";
      const d = typeof dataStr === 'string' ? new Date(dataStr) : dataStr;
      if (isNaN(d.getTime())) return "-";
      return format(d, "dd/MM/yyyy");
    } catch {
      return "-";
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Header do Card - Sempre Visível */}
        <div 
          className="flex items-start justify-between gap-4 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex-1 space-y-2">
            {/* Cliente e Hora */}
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{lead?.nome || "Carregando..."}</span>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                {agendamento.horaAgendamento}
              </div>
            </div>

            {/* Projeto */}
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>{nomeProjeto}</span>
            </div>
          </div>

          {/* Status e Botão Expandir */}
          <div className="flex items-center gap-2">
            <Badge className={`${statusConfig.color} text-white`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Detalhes Expandidos */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t space-y-4">
            {/* Informações Completas */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Telefone:</span>
                <div className="font-medium">{lead?.telefone || "-"}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Corretor:</span>
                <div className="font-medium">{corretor?.name || "-"}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Construtora:</span>
                <div className="font-medium">{agendamento.construtora || "-"}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Data:</span>
                <div className="font-medium">
                  {formatDataAgendamento(agendamento.dataAgendamento)}
                </div>
              </div>
            </div>

            {/* Observações */}
            {agendamento.observacoes && (
              <div>
                <span className="text-sm text-muted-foreground">Observações:</span>
                <p className="text-sm mt-1">{agendamento.observacoes}</p>
              </div>
            )}

            {/* Botões de Ação - Apenas para Pendente/Confirmado */}
            {(agendamento.status === 'pendente' || agendamento.status === 'confirmado') && (
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  size="sm"
                  variant="default"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus('realizado');
                  }}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Realizado
                </Button>
                {/* Botão Não Compareceu — Fase 2 */}
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 border-gray-400 text-gray-700 hover:bg-gray-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus('nao_compareceu');
                  }}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Não Compareceu
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus('cancelado');
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
