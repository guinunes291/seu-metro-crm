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
  CalendarDays
} from "lucide-react";
import CalendarioAgendamentos from "@/components/CalendarioAgendamentos";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Lead = {
  id: number;
  nome: string;
  telefone: string;
  email: string | null;
  cpf: string | null;
  status: string;
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
};

export default function Agendamentos() {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [useCustomProject, setUseCustomProject] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    projectId: "",
    projetoCustom: "",
    construtora: "",
    dataAgendamento: "",
    horaAgendamento: "",
    observacoes: "",
  });

  // Queries
  const { data: agendamentos, isLoading, refetch } = trpc.agendamentos.list.useQuery();
  const { data: agendamentosHoje } = trpc.agendamentos.hoje.useQuery();
  const { data: projetos } = trpc.projects.list.useQuery();
  
  // Search leads
  const { data: searchResults, isLoading: isSearching } = trpc.searchLeads.byIdentifier.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length >= 3 }
  );

  // Mutations
  const createAgendamento = trpc.agendamentos.create.useMutation({
    onSuccess: () => {
      toast.success("Agendamento criado com sucesso!");
      setIsModalOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar agendamento");
    },
  });

  const updateStatus = trpc.agendamentos.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado!");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar status");
    },
  });

  const resetForm = () => {
    setSelectedLead(null);
    setSearchQuery("");
    setUseCustomProject(false);
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
    if (!selectedLead) {
      toast.error("Selecione um lead");
      return;
    }
    if (!formData.dataAgendamento || !formData.horaAgendamento) {
      toast.error("Preencha a data e hora do agendamento");
      return;
    }
    if (!useCustomProject && !formData.projectId) {
      toast.error("Selecione um projeto ou digite manualmente");
      return;
    }

    createAgendamento.mutate({
      leadId: selectedLead.id,
      projectId: useCustomProject ? undefined : parseInt(formData.projectId),
      projetoCustom: useCustomProject ? formData.projetoCustom : undefined,
      construtora: formData.construtora || undefined,
      dataAgendamento: formData.dataAgendamento,
      horaAgendamento: formData.horaAgendamento,
      observacoes: formData.observacoes || undefined,
    });
  };

  const handleProjectSelect = (projectId: string) => {
    if (projectId === "custom") {
      setUseCustomProject(true);
      setFormData({ ...formData, projectId: "" });
    } else {
      setUseCustomProject(false);
      const projeto = projetos?.find((p: Project) => p.id.toString() === projectId);
      setFormData({
        ...formData,
        projectId,
        construtora: projeto?.construtora || "",
      });
    }
  };

  // Abrir modal com data pré-selecionada do calendário
  const handleCreateFromCalendar = (date: Date) => {
    setSelectedDate(date);
    setFormData({
      ...formData,
      dataAgendamento: format(date, "yyyy-MM-dd"),
    });
    setIsModalOpen(true);
  };

  // Agrupar agendamentos por data
  const agendamentosPorData = (agendamentos || []).reduce((acc: Record<string, Agendamento[]>, ag: Agendamento) => {
    const data = format(new Date(ag.dataAgendamento), "yyyy-MM-dd");
    if (!acc[data]) acc[data] = [];
    acc[data].push(ag);
    return acc;
  }, {});

  // Ordenar datas
  const datasOrdenadas = Object.keys(agendamentosPorData).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agendamentos</h1>
            <p className="text-muted-foreground">Gerencie suas visitas agendadas</p>
          </div>
          
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Criar Agendamento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Novo Agendamento</DialogTitle>
                <DialogDescription>
                  Agende uma visita para um cliente
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Busca de Lead */}
                <div className="space-y-2">
                  <Label>Cliente (buscar por telefone, email, CPF ou nome)</Label>
                  <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-start text-left font-normal"
                      >
                        {selectedLead ? (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>{selectedLead.nome}</span>
                            <span className="text-muted-foreground">({selectedLead.telefone})</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Search className="h-4 w-4" />
                            <span>Buscar cliente...</span>
                          </div>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Digite telefone, email, CPF ou nome..."
                          value={searchQuery}
                          onValueChange={setSearchQuery}
                        />
                        <CommandList>
                          {isSearching && (
                            <div className="p-4 text-center">
                              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                            </div>
                          )}
                          {searchQuery.length < 3 && (
                            <CommandEmpty>Digite pelo menos 3 caracteres para buscar</CommandEmpty>
                          )}
                          {searchQuery.length >= 3 && !isSearching && (!searchResults || searchResults.length === 0) && (
                            <CommandEmpty>Nenhum cliente encontrado</CommandEmpty>
                          )}
                          {searchResults && searchResults.length > 0 && (
                            <CommandGroup heading="Resultados">
                              {searchResults.map((lead: Lead) => (
                                <CommandItem
                                  key={lead.id}
                                  value={lead.id.toString()}
                                  onSelect={() => {
                                    setSelectedLead(lead);
                                    setIsSearchOpen(false);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium">{lead.nome}</span>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <Phone className="h-3 w-3" />
                                      {lead.telefone}
                                      {lead.email && (
                                        <>
                                          <span>•</span>
                                          {lead.email}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Projeto */}
                <div className="space-y-2">
                  <Label>Projeto / Empreendimento</Label>
                  <Select
                    value={useCustomProject ? "custom" : formData.projectId}
                    onValueChange={handleProjectSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">
                        <span className="text-muted-foreground">✏️ Digitar manualmente</span>
                      </SelectItem>
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

                {/* Data e Hora */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={formData.dataAgendamento}
                      onChange={(e) => setFormData({ ...formData, dataAgendamento: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hora</Label>
                    <Input
                      type="time"
                      value={formData.horaAgendamento}
                      onChange={(e) => setFormData({ ...formData, horaAgendamento: e.target.value })}
                    />
                  </div>
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
                  disabled={createAgendamento.isPending}
                >
                  {createAgendamento.isPending ? (
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
                      {format(new Date(data + "T12:00:00"), "EEEE, d 'de' MMMM", { locale: ptBR })}
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

// Componente de Card de Agendamento
function AgendamentoCard({ 
  agendamento, 
  onUpdateStatus 
}: { 
  agendamento: Agendamento;
  onUpdateStatus: (status: 'pendente' | 'confirmado' | 'realizado' | 'cancelado' | 'reagendado') => void;
}) {
  const { data: lead } = trpc.leads.getById.useQuery({ id: agendamento.leadId });
  const statusConfig = STATUS_CONFIG[agendamento.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pendente;
  const StatusIcon = statusConfig.icon;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            {/* Cliente */}
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{lead?.nome || "Carregando..."}</span>
              {lead?.telefone && (
                <span className="text-sm text-muted-foreground">
                  ({lead.telefone})
                </span>
              )}
            </div>

            {/* Projeto */}
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>{agendamento.projetoCustom || "Projeto não especificado"}</span>
              {agendamento.construtora && (
                <span className="text-muted-foreground">
                  • {agendamento.construtora}
                </span>
              )}
            </div>

            {/* Hora */}
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{agendamento.horaAgendamento}</span>
            </div>

            {/* Observações */}
            {agendamento.observacoes && (
              <p className="text-sm text-muted-foreground mt-2">
                {agendamento.observacoes}
              </p>
            )}
          </div>

          {/* Status e Ações */}
          <div className="flex flex-col items-end gap-2">
            <Badge className={`${statusConfig.color} text-white`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>

            {agendamento.status === 'pendente' && (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-600 hover:text-green-700"
                  onClick={() => onUpdateStatus('confirmado')}
                >
                  Confirmar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => onUpdateStatus('cancelado')}
                >
                  Cancelar
                </Button>
              </div>
            )}

            {agendamento.status === 'confirmado' && (
              <Button
                size="sm"
                variant="outline"
                className="text-green-600 hover:text-green-700"
                onClick={() => onUpdateStatus('realizado')}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Marcar Realizado
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
