import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { 
  Phone, Mail, Building2, Calendar, MessageSquare, Search, Filter,
  Clock, AlertCircle, CheckCircle2, XCircle, Eye, LayoutGrid, List, Plus, UserPlus, Loader2, MessageCircle, CalendarPlus, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { gerarLinkWhatsApp } from "@/lib/whatsapp";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { CopilotQuickActions } from "@/components/CopilotQuickActions";
import { SMQCopilotButton } from "@/components/SMQCopilotChat";
import { useCopilot } from "@/contexts/CopilotContext";
import { Bot } from "lucide-react";
import { ProjectCombobox } from "@/components/ProjectCombobox";
import { FilterProjectCombobox } from "@/components/FilterProjectCombobox";
import LeadTimer, { LeadUrgencyBadge } from "@/components/LeadTimer";
import { TimerLead } from "@/components/TimerLead";
import { useWebhookLeadNotification } from "@/hooks/useWebhookLeadNotification";
import { AtribuirCorretorDialog } from "@/components/AtribuirCorretorDialog";
import { TransferirEmLoteDialog } from "@/components/TransferirEmLoteDialog";
import TransferirLeadButton from "@/components/TransferirLeadButton";
import ReatribuirLeadButton from "@/components/ReatribuirLeadButton";
import { DateRangeFilter, DateRangePreset } from "@/components/DateRangeFilter";
import { getDateRangeFromPreset } from "@/lib/dateRangeUtils";

const statusLabels: Record<string, string> = {
  novo: "Novo",
  aguardando_atendimento: "Aguardando Atendimento",
  em_atendimento: "Em Atendimento",
  // agendado e visita_realizada são automáticos (não selecionáveis manualmente)
  analise_credito: "Análise de Crédito",
  contrato_fechado: "Contrato Fechado",
  perdido: "Perdido",
};

const tipoLabels: Record<string, string> = {
  whatsapp: "WhatsApp",
  ligacao: "Ligação",
  email: "E-mail",
  sms: "SMS",
  visita: "Visita",
  outro: "Outro",
};

const resultadoLabels: Record<string, string> = {
  contato_realizado: "Contato Realizado",
  nao_atendeu: "Não Atendeu",
  agendamento: "Agendamento",
  visita_realizada: "Visita Realizada",
  proposta_enviada: "Proposta Enviada",
  recusou: "Recusou",
  outro: "Outro",
};

const origemLabels: Record<string, string> = {
  facebook: "Facebook",
  google_sheets: "Google Sheets",
  site: "Site",
  indicacao: "Indicação",
  captacao_corretor: "Captação Própria",
  whatsapp: "WhatsApp",
  telefone: "Telefone",
  plantao: "Plantão",
  agendamento_self_service: "Agendamento Self-Service",
  chatbot: "Chatbot",
  outro: "Outro",
};

export default function Leads() {
  // Estado de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  
  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [origemFilter, setOrigemFilter] = useState<string>("all");
  const [corretorFilter, setCorretorFilter] = useState<string>("all");
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>("all");
  const [customDateStart, setCustomDateStart] = useState<Date | undefined>();
  const [customDateEnd, setCustomDateEnd] = useState<Date | undefined>();
  
  // Calcular datas baseado no preset
  const { dataInicio: dataInicioFilter, dataFim: dataFimFilter } = getDateRangeFromPreset(
    dateRangePreset,
    customDateStart,
    customDateEnd
  );
  
  // Debounce para busca (evita queries excessivas)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  // Query com filtros server-side (usa debouncedSearch)
  const { data: leadsData, isLoading, refetch } = trpc.leads.list.useQuery({ 
    page: currentPage, 
    limit: pageSize,
    searchTerm: debouncedSearch || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    projectId: projectFilter !== 'all' ? parseInt(projectFilter) : undefined,
    origem: origemFilter !== 'all' ? origemFilter : undefined,
    corretorId: corretorFilter !== 'all' ? parseInt(corretorFilter) : undefined,
    dataInicio: dataInicioFilter || undefined,
    dataFim: dataFimFilter || undefined,
  }, {
    keepPreviousData: true, // Evita tela branca durante re-fetch
    refetchInterval: 30000, // Atualiza automaticamente a cada 30 segundos
    refetchOnMount: 'always', // Sempre busca dados frescos ao montar
    refetchOnWindowFocus: true, // Atualiza quando a janela recebe foco
  });
  const leads = leadsData?.leads || [];
  const totalPages = leadsData?.totalPages || 1;
  const totalLeads = leadsData?.total || 0;
  
  const { data: projects } = trpc.projects.list.useQuery();
  const { data: corretores } = trpc.corretores.listParaTransferencia.useQuery();
  const { data: user } = trpc.auth.me.useQuery();
  const isGestor = user?.role === 'gestor' || user?.role === 'admin' || user?.role === 'superintendente';
  const [selectedLead, setSelectedLead] = useState<any>(null);
  
  // Hook de notificação para leads Facebook Ads
  const { popup: webhookPopup } = useWebhookLeadNotification();
  
  // Hook para integrar com o Copilot flutuante
  const { openWithLead } = useCopilot();
  const [detailsDialog, setDetailsDialog] = useState(false);
  const [, setLocation] = useLocation();
  
  // Ler leadId da URL para abrir modal automaticamente
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const leadIdParam = urlParams.get('leadId');
    
    if (leadIdParam && leads) {
      const leadId = parseInt(leadIdParam);
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        setSelectedLead(lead);
        setDetailsDialog(true);
        // Limpar o parâmetro da URL após abrir o modal
        window.history.replaceState({}, '', '/leads');
      }
    }
  }, [leads]);
  const [interactionDialog, setInteractionDialog] = useState(false);
  const [atribuirDialog, setAtribuirDialog] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  
  // Estados para seleção múltipla
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [transferirEmLoteDialog, setTransferirEmLoteDialog] = useState(false);

  const utils = trpc.useUtils();
  const updateLeadMutation = trpc.leads.update.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
    },
  });
  const addInteractionMutation = trpc.leads.addInteraction.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
    },
  });
  const createLeadMutation = trpc.leads.createByCorretor.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
    },
  });
  
  const enviarAlertaMutation = trpc.alertas.enviar.useMutation({
    onSuccess: () => {
      toast.success("Alerta enviado ao corretor com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao enviar alerta: ${error.message}`);
    },
  });
  const { data: leadHistory } = trpc.leads.getHistory.useQuery(
    { leadId: selectedLead?.id || 0 },
    { enabled: !!selectedLead }
  );

  // Estado para o dialog de tipo de contato (obrigatório ao sair de 'novo' ou 'aguardando')
  const [contactTypeDialog, setContactTypeDialog] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{leadId: number, newStatus: string, currentStatus: string} | null>(null);
  const [selectedContactType, setSelectedContactType] = useState<'ligacao' | 'whatsapp' | ''>('');

  // Estado para o dialog de motivo de perda
  const [motivoPerdidoDialog, setMotivoPerdidoDialog] = useState(false);
  const [pendingLossChange, setPendingLossChange] = useState<{leadId: number} | null>(null);
  const [motivoPerdido, setMotivoPerdido] = useState('');
  const [outroMotivo, setOutroMotivo] = useState('');

  // Estado para o dialog de agendamento
  const [agendamentoDialog, setAgendamentoDialog] = useState(false);
  const [isSubmittingAgendamento, setIsSubmittingAgendamento] = useState(false);
  const [agendamentoForm, setAgendamentoForm] = useState({
    projectId: "",
    projetoCustom: "",
    construtora: "",
    dataAgendamento: "",
    horaAgendamento: "",
    observacoes: "",
    useCustomProject: false,
  });
  
  // Mutation para criar agendamento
  const createAgendamentoMutation = trpc.agendamentos.create.useMutation({
    onSuccess: () => {
      toast.success("Agendamento criado com sucesso!");
      setIsSubmittingAgendamento(false);
      setAgendamentoDialog(false);
      setAgendamentoForm({
        projectId: "",
        projetoCustom: "",
        construtora: "",
        dataAgendamento: "",
        horaAgendamento: "",
        observacoes: "",
        useCustomProject: false,
      });
      // Invalidar cache para atualizar listas
      utils.leads.list.invalidate();
      utils.agendamentos.list.invalidate();
      utils.agendamentos.hoje.invalidate();
    },
    onError: (error) => {
      console.error("Erro ao criar agendamento:", error);
      toast.error(error.message || "Erro ao criar agendamento. Tente novamente.");
      setIsSubmittingAgendamento(false);
    },
  });
  
  const handleCreateAgendamento = () => {
    // Prevenir múltiplas submissões
    if (isSubmittingAgendamento || createAgendamentoMutation.isPending) {
      return;
    }
    
    if (!selectedLead) {
      toast.error("Selecione um lead");
      return;
    }
    
    // Validação mais robusta que aceita strings vazias mas não valores null/undefined
    const dataValida = agendamentoForm.dataAgendamento && agendamentoForm.dataAgendamento.trim() !== "";
    const horaValida = agendamentoForm.horaAgendamento && agendamentoForm.horaAgendamento.trim() !== "";
    
    if (!dataValida || !horaValida) {
      toast.error("Preencha a data e hora do agendamento");
      return;
    }
    
    // Validar formato da data (YYYY-MM-DD)
    const dataRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dataRegex.test(agendamentoForm.dataAgendamento)) {
      toast.error("Formato de data inválido. Use AAAA-MM-DD");
      return;
    }
    
    // Validar formato da hora (HH:MM)
    const horaRegex = /^\d{2}:\d{2}$/;
    if (!horaRegex.test(agendamentoForm.horaAgendamento)) {
      toast.error("Formato de hora inválido. Use HH:MM");
      return;
    }
    
    if (!agendamentoForm.useCustomProject && !agendamentoForm.projectId) {
      toast.error("Selecione um projeto ou digite manualmente");
      return;
    }
    
    // Marcar como submetendo antes de fazer a mutation
    setIsSubmittingAgendamento(true);
    
    createAgendamentoMutation.mutate({
      leadId: selectedLead.id,
      projectId: agendamentoForm.useCustomProject ? undefined : parseInt(agendamentoForm.projectId),
      projetoCustom: agendamentoForm.useCustomProject ? agendamentoForm.projetoCustom : undefined,
      construtora: agendamentoForm.construtora || undefined,
      dataAgendamento: agendamentoForm.dataAgendamento,
      horaAgendamento: agendamentoForm.horaAgendamento,
      observacoes: agendamentoForm.observacoes || undefined,
    });
  };

  // Estado para o dialog de novo lead
  const [newLeadDialog, setNewLeadDialog] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({
    nome: "",
    telefone: "",
    email: "",
    projectId: "",
    projectManual: "", // Nome do projeto digitado manualmente
    isProjectManual: false, // Se o projeto foi digitado manualmente
    origem: "captacao_corretor" as "captacao_corretor" | "indicacao" | "whatsapp" | "telefone" | "plantao" | "facebook" | "site" | "outro",
    observacoes: "",
  });

  const handleCreateLead = async () => {
    if (!newLeadForm.nome || !newLeadForm.telefone) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }

    try {
      // Se o projeto foi digitado manualmente, adiciona nas observações
      let observacoesFinais = newLeadForm.observacoes || "";
      if (newLeadForm.isProjectManual && newLeadForm.projectManual) {
        const projetoInfo = `[Projeto de interesse: ${newLeadForm.projectManual}]`;
        observacoesFinais = observacoesFinais ? `${projetoInfo}\n${observacoesFinais}` : projetoInfo;
      }

      await createLeadMutation.mutateAsync({
        nome: newLeadForm.nome,
        telefone: newLeadForm.telefone,
        email: newLeadForm.email || undefined,
        projectId: !newLeadForm.isProjectManual && newLeadForm.projectId ? parseInt(newLeadForm.projectId) : undefined,
        origem: newLeadForm.origem,
        observacoes: observacoesFinais || undefined,
      });

      toast.success("Lead criado com sucesso!");
      setNewLeadDialog(false);
      setNewLeadForm({
        nome: "",
        telefone: "",
        email: "",
        projectId: "",
        projectManual: "",
        isProjectManual: false,
        origem: "indicacao",
        observacoes: "",
      });
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar lead");
    }
  };

  const [interactionForm, setInteractionForm] = useState({
    tipo: "whatsapp" as "ligacao" | "whatsapp" | "email" | "sms" | "visita" | "outro",
    resultado: "contato_realizado" as "contato_realizado" | "nao_atendeu" | "agendamento" | "visita_realizada" | "proposta_enviada" | "recusou" | "outro",
    observacoes: "",
  });

  const handleAddInteraction = async () => {
    if (!selectedLead) return;

    try {
      await addInteractionMutation.mutateAsync({
        leadId: selectedLead.id,
        ...interactionForm,
      });

      toast.success("Interação registrada com sucesso!");
      setInteractionDialog(false);
      setInteractionForm({
        tipo: "whatsapp",
        resultado: "contato_realizado",
        observacoes: "",
      });
      refetch();
    } catch (error) {
      toast.error("Erro ao registrar interação");
    }
  };

  const handleUpdateStatus = async (leadId: number, newStatus: string, currentStatus?: string) => {
    // Se o status for 'perdido', mostrar modal de motivo da perda
    if (newStatus === 'perdido') {
      setPendingLossChange({ leadId });
      setMotivoPerdidoDialog(true);
      return;
    }
    
    // Se o status atual é 'novo' ou 'aguardando_atendimento' e está mudando para outro,
    // obrigar a especificar o tipo de contato (ligação ou WhatsApp)
    const statusAtual = currentStatus || leads?.find(l => l.id === leadId)?.status;
    const statusQueExigemContato = ['novo', 'aguardando_atendimento'];
    
    if (statusQueExigemContato.includes(statusAtual || '') && 
        !statusQueExigemContato.includes(newStatus)) {
      // Mostrar modal para escolher tipo de contato
      setPendingStatusChange({ leadId, newStatus, currentStatus: statusAtual || '' });
      setContactTypeDialog(true);
      return;
    }
    
    // Atualizar status normalmente
    await executeStatusUpdate(leadId, newStatus);
  };

  const executeStatusUpdate = async (leadId: number, newStatus: string, contactType?: 'ligacao' | 'whatsapp', motivoPerdido?: string) => {
    try {
      const updateData: any = { status: newStatus as any };
      
      // Se foi fornecido motivo da perda, incluir no update
      if (motivoPerdido) {
        updateData.motivoPerdido = motivoPerdido;
      }
      
      await updateLeadMutation.mutateAsync({
        id: leadId,
        data: updateData,
      });

      // Se foi especificado tipo de contato, registrar a atividade
      if (contactType) {
        await addInteractionMutation.mutateAsync({
          leadId,
          tipo: contactType,
          resultado: 'contato_realizado',
          observacoes: `Primeiro contato realizado via ${contactType === 'ligacao' ? 'Ligação' : 'WhatsApp'}`,
        });
      }

      toast.success("Status atualizado com sucesso!");
      refetch();
    } catch (error) {
      toast.error("Erro ao atualizar status");
    }
  };

  const handleConfirmContactType = async () => {
    if (!pendingStatusChange || !selectedContactType) {
      toast.error("Selecione o tipo de contato realizado");
      return;
    }
    
    await executeStatusUpdate(
      pendingStatusChange.leadId, 
      pendingStatusChange.newStatus, 
      selectedContactType
    );
    
    // Limpar estados
    setContactTypeDialog(false);
    setPendingStatusChange(null);
    setSelectedContactType('');
  };

  const handleUpdateObservacoes = async (leadId: number, observacoes: string) => {
    try {
      await updateLeadMutation.mutateAsync({
        id: leadId,
        data: { observacoes },
      });

      toast.success("Observações atualizadas!");
      refetch();
    } catch (error) {
      toast.error("Erro ao atualizar observações");
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "contrato_fechado":
        return "default";
      case "perdido":
        return "destructive";
      case "novo":
      case "aguardando_atendimento":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "contrato_fechado":
        return <CheckCircle2 className="h-4 w-4" />;
      case "perdido":
        return <XCircle className="h-4 w-4" />;
      case "novo":
      case "aguardando_atendimento":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  // Resetar para página 1 quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, projectFilter, origemFilter]);
  
  // Usar leads diretamente do backend (já filtrados)
  const filteredLeads = leads;

  const openDetails = (lead: any) => {
    setSelectedLead(lead);
    setDetailsDialog(true);
  };

  return (
    <DashboardLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Meus Leads</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie seus contatos e acompanhe o funil de vendas
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setNewLeadDialog(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Novo Lead
            </Button>
            {isGestor && selectedLeadIds.length > 0 && (
              <Button 
                onClick={() => setTransferirEmLoteDialog(true)} 
                variant="secondary"
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Transferir {selectedLeadIds.length} {selectedLeadIds.length === 1 ? 'Lead' : 'Leads'}
              </Button>
            )}
          </div>
        </div>

        {/* Filtros e Busca */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`grid gap-4 ${isGestor ? 'md:grid-cols-6' : 'md:grid-cols-4'}`}>
              <div className="space-y-2">
                <Label htmlFor="search">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Nome, telefone, email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            <div className="space-y-2">
              <Label htmlFor="project">Projeto</Label>
              <FilterProjectCombobox
                projects={projects || []}
                value={projectFilter}
                onChange={setProjectFilter}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="origem">Origem</Label>
              <Select value={origemFilter} onValueChange={setOrigemFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as origens" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as origens</SelectItem>
                  {Object.entries(origemLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de Corretor (apenas para gestor) */}
            {isGestor && (
              <div className="space-y-2">
                <Label htmlFor="corretor">Corretor</Label>
                <Select value={corretorFilter} onValueChange={setCorretorFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os corretores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os corretores</SelectItem>
                    {corretores?.map((corretor) => (
                      <SelectItem key={corretor.id} value={corretor.id.toString()}>
                        {corretor.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Filtro de Período */}
            <div className="space-y-2">
              <Label>Período</Label>
              <DateRangeFilter
                value={dateRangePreset}
                customStart={customDateStart}
                customEnd={customDateEnd}
                onChange={(preset, start, end) => {
                  setDateRangePreset(preset);
                  setCustomDateStart(start);
                  setCustomDateEnd(end);
                }}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-1 mt-4">
            <div className="space-y-2">
                <Label>Visualização</Label>
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === "cards" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("cards")}
                    className="flex-1"
                  >
                    <LayoutGrid className="h-4 w-4 mr-2" />
                    Cards
                  </Button>
                  <Button
                    variant={viewMode === "table" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("table")}
                    className="flex-1"
                  >
                    <List className="h-4 w-4 mr-2" />
                    Tabela
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas Rápidas - Mostra total filtrado */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Leads {(searchTerm || statusFilter !== 'all' || projectFilter !== 'all' || origemFilter !== 'all') && '(filtrados)'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalLeads}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Nesta Página
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredLeads.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Página Atual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentPage} de {totalPages}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Leads por Página
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">
                {pageSize}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de leads */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Carregando leads...</p>
          </div>
        ) : filteredLeads.length > 0 ? (
          viewMode === "cards" ? (
            <div className="grid gap-4">
              {filteredLeads.map((lead) => {
                const project = projects?.find(p => p.id === lead.projectId);
                
                // Calcular dias sem interação
                const diasSemInteracao = lead.ultimaInteracao 
                  ? Math.floor((Date.now() - new Date(lead.ultimaInteracao).getTime()) / (1000 * 60 * 60 * 24))
                  : null;
                const mostrarAlertaInatividade = lead.status === "em_atendimento" && diasSemInteracao !== null && diasSemInteracao >= 2;
                
                return (
                  <Card key={lead.id} className={`hover:shadow-md transition-shadow ${
                    lead.origemWebhook ? 'border-l-4 border-l-red-500 bg-red-50/30' : ''
                  }`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-xl">{lead.nome}</CardTitle>
                            {isGestor && lead.corretorNome && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <UserPlus className="h-3 w-3" />
                                {lead.corretorNome}
                              </Badge>
                            )}
                            {lead.origemWebhook && (
                              <Badge className="bg-red-600 hover:bg-red-700 text-white">
                                🔥 FACEBOOK ADS - URGENTE
                              </Badge>
                            )}
                            {mostrarAlertaInatividade && (
                              <Badge 
                                variant="outline" 
                                className="text-orange-600 border-orange-600"
                              >
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Lead será descartado hoje às 00:00 por falta de interação
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="mt-1">
                            {lead.origem && `Origem: ${lead.origem}`}
                          </CardDescription>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant={getStatusVariant(lead.status)} className="flex items-center gap-1">
                            {getStatusIcon(lead.status)}
                            {statusLabels[lead.status]}
                          </Badge>
                          <div className="flex flex-col gap-1">
                            <LeadTimer createdAt={lead.createdAt} status={lead.status} compact />
                            <TimerLead 
                              timestampRecebimento={lead.timestampRecebimento} 
                              timerAtivo={lead.timerAtivo ?? false}
                              origem={lead.origem}
                              nomeCliente={lead.nome}
                              leadId={lead.id}
                              showProgress={true}
                              isCorretor={user?.role === 'corretor'}
                            />
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <button
                              onClick={() => {
                                const projeto = project?.nome || lead.projetoCustom;
                                window.open(gerarLinkWhatsApp(lead.telefone, lead.nome, projeto), '_blank');
                              }}
                              className="hover:underline text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                            >
                              {lead.telefone}
                              <MessageCircle className="h-3 w-3" />
                            </button>
                          </div>
                          {lead.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <a href={`mailto:${lead.email}`} className="hover:underline">
                                {lead.email}
                              </a>
                            </div>
                          )}
                          {(project || lead.projetoCustom) && (
                            <div className="flex items-center gap-2 text-sm">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span>{project?.nome || lead.projetoCustom}</span>
                            </div>
                          )}
                          {lead.ultimoContato && (
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span>
                                Último contato: {format(new Date(lead.ultimoContato), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            </div>
                          )}
                          {/* Campos do Facebook Lead Ads */}
                          {lead.campanha && (
                            <div className="flex items-center gap-2 text-sm">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span><strong>Campanha:</strong> {lead.campanha}</span>
                            </div>
                          )}
                          {lead.faixaRenda && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="h-4 w-4 text-muted-foreground font-bold">R$</span>
                              <span><strong>Faixa de Renda:</strong> {lead.faixaRenda.replace(/_/g, ' ')}</span>
                            </div>
                          )}
                          {lead.prefereContatoPor && (
                            <div className="flex items-center gap-2 text-sm">
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                              <span><strong>Prefere contato por:</strong> {lead.prefereContatoPor}</span>
                            </div>
                          )}
                          {lead.finalidadeImovel && (
                            <div className="flex items-center gap-2 text-sm">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span><strong>Finalidade:</strong> {lead.finalidadeImovel}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          {/* Badge de Status (read-only) */}
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-sm">
                              {statusLabels[lead.status as keyof typeof statusLabels] || lead.status}
                            </Badge>
                          </div>
                          
                          {/* Botões de Ação Contextuais */}
                          <div className="flex flex-wrap gap-2">
                            {/* Aguardando Atendimento → Em Atendimento */}
                            {(lead.status === 'aguardando_atendimento' || lead.status === 'novo') && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleUpdateStatus(lead.id, 'em_atendimento', lead.status)}
                              >
                                <Phone className="h-4 w-4 mr-1" />
                                Iniciar Atendimento
                              </Button>
                            )}
                            
                            {/* Em Atendimento → Agendado (via criar agendamento) */}
                            {lead.status === 'em_atendimento' && (
                              <Button
                                variant="default"
                                size="sm"
                onClick={() => {
                  setSelectedLead(lead);
                  setAgendamentoForm({
                    projectId: "",
                    projetoCustom: "",
                    construtora: "",
                    dataAgendamento: "",
                    horaAgendamento: "",
                    observacoes: "",
                    useCustomProject: false,
                  });
                  setAgendamentoDialog(true);
                }}
                              >
                                <Calendar className="h-4 w-4 mr-1" />
                                Criar Agendamento
                              </Button>
                            )}
                            
                            {/* Visita Realizada → Análise de Crédito */}
                            {lead.status === 'visita_realizada' && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleUpdateStatus(lead.id, 'analise_credito')}
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                Enviar para Análise
                              </Button>
                            )}
                            
                            {/* Análise de Crédito → Contrato Fechado */}
                            {lead.status === 'analise_credito' && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleUpdateStatus(lead.id, 'contrato_fechado')}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Fechar Contrato
                              </Button>
                            )}
                            
                            {/* Marcar como Perdido (sempre disponível, exceto se já for perdido) */}
                            {lead.status !== 'perdido' && lead.status !== 'contrato_fechado' && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleUpdateStatus(lead.id, 'perdido', lead.status)}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Marcar como Perdido
                              </Button>
                            )}
                          </div>
                          
                          <div className="flex gap-2">
                            {isGestor && !lead.corretorId && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  setSelectedLead(lead);
                                  setAtribuirDialog(true);
                                }}
                              >
                                <UserPlus className="h-4 w-4 mr-1" />
                                Atribuir
                              </Button>
                            )}
                            {lead.telefone && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-green-500 hover:bg-green-600 border-green-500 text-white"
                                onClick={() => {
                                  const projeto = projects?.find(p => p.id === lead.projectId)?.nome || lead.projetoCustom;
                                  window.open(gerarLinkWhatsApp(lead.telefone, lead.nome, projeto), '_blank');
                                }}
                              >
                                <MessageCircle className="h-4 w-4 mr-1" />
                                WhatsApp
                              </Button>
                            )}
                            
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                setSelectedLead(lead);
                                setInteractionDialog(true);
                              }}
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Registrar
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => {
                setSelectedLead(lead);
                                // Preencher projeto do lead se existir
                                if (lead.projectId) {
                                  setAgendamentoForm(prev => ({
                                    ...prev,
                                    projectId: lead.projectId?.toString() || "",
                                    useCustomProject: false,
                                  }));
                                }
                                setAgendamentoDialog(true);
                              }}
                            >
                              <CalendarPlus className="h-4 w-4 mr-1" />
                              Agendar
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDetails(lead)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {lead.observacoes && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm text-muted-foreground">
                            <strong>Observações:</strong> {lead.observacoes}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    {isGestor && (
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLeadIds(filteredLeads.map(l => l.id));
                            } else {
                              setSelectedLeadIds([]);
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </TableHead>
                    )}
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Projeto</TableHead>
                    {isGestor && <TableHead>Corretor</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead>Aguardando</TableHead>
                    <TableHead>Último Contato</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => {
                    const project = projects?.find(p => p.id === lead.projectId);
                    
                    return (
                      <TableRow key={lead.id} className={lead.origemWebhook ? 'bg-red-50/30' : ''}>
                        {isGestor && (
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedLeadIds.includes(lead.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedLeadIds([...selectedLeadIds, lead.id]);
                                } else {
                                  setSelectedLeadIds(selectedLeadIds.filter(id => id !== lead.id));
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {lead.nome}
                            {lead.origemWebhook && (
                              <Badge className="bg-red-600 hover:bg-red-700 text-white text-xs">
                                🔥 ADS
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{lead.telefone}</TableCell>
                        <TableCell>{project?.nome || lead.projetoCustom || "-"}</TableCell>
                        {isGestor && <TableCell>{lead.corretorNome || "-"}</TableCell>}
                        <TableCell>
                          <Badge variant={getStatusVariant(lead.status)}>
                            {statusLabels[lead.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <LeadTimer createdAt={lead.createdAt} status={lead.status} compact showIcon={false} />
                            <TimerLead 
                              timestampRecebimento={lead.timestampRecebimento} 
                              timerAtivo={lead.timerAtivo ?? false}
                              origem={lead.origem}
                              nomeCliente={lead.nome}
                              leadId={lead.id}
                              showProgress={true}
                              isCorretor={user?.role === 'corretor'}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          {lead.ultimoContato 
                            ? format(new Date(lead.ultimoContato), "dd/MM/yyyy", { locale: ptBR })
                            : "-"
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {isGestor && !lead.corretorId && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  setSelectedLead(lead);
                                  setAtribuirDialog(true);
                                }}
                              >
                                <UserPlus className="h-4 w-4 mr-1" />
                                Atribuir
                              </Button>
                            )}
                            {isGestor && lead.corretorId && lead.status === "aguardando_atendimento" && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  enviarAlertaMutation.mutate({
                                    leadId: lead.id,
                                    corretorId: lead.corretorId,
                                  });
                                }}
                                disabled={enviarAlertaMutation.isPending}
                              >
                                {enviarAlertaMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 mr-1" />
                                )}
                                Alertar
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedLead(lead);
                                setInteractionDialog(true);
                              }}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDetails(lead)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )
        ) : (
          <div className="text-center py-12">
            <Phone className="h-20 w-20 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Nenhum lead encontrado</h3>
            <p className="text-muted-foreground">
              {searchTerm || statusFilter !== "all" || projectFilter !== "all" || origemFilter !== "all"
                ? "Tente ajustar os filtros de busca"
                : "Aguarde a distribuição de novos leads pelo gestor"
              }
            </p>
          </div>
        )}

        {/* Controles de Paginação */}
        {!isLoading && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Mostrando {((currentPage - 1) * pageSize) + 1} a {Math.min(currentPage * pageSize, totalLeads)} de {totalLeads} leads
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-10"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}

        {/* Dialog de detalhes do lead */}
        <Dialog open={detailsDialog} onOpenChange={setDetailsDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">{selectedLead?.nome}</DialogTitle>
              <DialogDescription>
                Detalhes completos do lead e histórico de interações
              </DialogDescription>
            </DialogHeader>
            
            {selectedLead && (
              <div className="space-y-6">
                {/* Informações básicas */}
                <div>
                  <h3 className="font-semibold mb-3">Informações de Contato</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${selectedLead.telefone}`} className="hover:underline">
                        {selectedLead.telefone}
                      </a>
                      {selectedLead.telefone && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-2 bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
                          onClick={() => {
                            const projeto = projects?.find(p => p.id === selectedLead.projectId)?.nome || selectedLead.projetoCustom;
                            window.open(gerarLinkWhatsApp(selectedLead.telefone, selectedLead.nome, projeto), '_blank');
                          }}
                        >
                          <MessageCircle className="h-4 w-4 mr-1" />
                          WhatsApp
                        </Button>
                      )}
                    </div>
                    {selectedLead.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${selectedLead.email}`} className="hover:underline">
                          {selectedLead.email}
                        </a>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{projects?.find(p => p.id === selectedLead.projectId)?.nome || selectedLead.projetoCustom || "Sem projeto"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        Criado em: {format(new Date(selectedLead.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Campos do Facebook Lead Ads */}
                {(selectedLead.campanha || selectedLead.faixaRenda || selectedLead.prefereContatoPor || selectedLead.finalidadeImovel || selectedLead.dataHoraCriacao) && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold mb-3">Informações do Facebook Lead Ads</h3>
                      <div className="grid gap-3 md:grid-cols-2">
                        {selectedLead.dataHoraCriacao && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>
                              <strong>Data/Hora de Criação:</strong>{" "}
                              {format(new Date(selectedLead.dataHoraCriacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        )}
                        {selectedLead.campanha && (
                          <div className="flex items-center gap-2 text-sm">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>
                              <strong>Campanha:</strong> {selectedLead.campanha}
                            </span>
                          </div>
                        )}
                        {selectedLead.faixaRenda && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="h-4 w-4 text-muted-foreground">R$</span>
                            <span>
                              <strong>Faixa de Renda:</strong> {selectedLead.faixaRenda.replace(/_/g, ' ')}
                            </span>
                          </div>
                        )}
                        {selectedLead.prefereContatoPor && (
                          <div className="flex items-center gap-2 text-sm">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            <span>
                              <strong>Prefere contato por:</strong> {selectedLead.prefereContatoPor}
                            </span>
                          </div>
                        )}
                        {selectedLead.finalidadeImovel && (
                          <div className="flex items-center gap-2 text-sm">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>
                              <strong>Finalidade do Imóvel:</strong> {selectedLead.finalidadeImovel}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Status e Ações */}
                <div>
                  <h3 className="font-semibold mb-3">Status e Ações</h3>
                  <div>
                    <div>
                      <Label>Status Atual</Label>
                      <div className="mt-2">
                        <Badge variant="outline" className="text-sm">
                          {statusLabels[selectedLead.status as keyof typeof statusLabels] || selectedLead.status}
                        </Badge>
                      </div>
                      
                      {/* Botões de Ação Contextuais */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {/* Aguardando Atendimento → Em Atendimento */}
                        {(selectedLead.status === 'aguardando_atendimento' || selectedLead.status === 'novo') && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              handleUpdateStatus(selectedLead.id, 'em_atendimento', selectedLead.status);
                              setSelectedLead({ ...selectedLead, status: 'em_atendimento' });
                            }}
                          >
                            <Phone className="h-4 w-4 mr-1" />
                            Iniciar Atendimento
                          </Button>
                        )}
                        
                        {/* Em Atendimento → Agendado (via criar agendamento) */}
                        {selectedLead.status === 'em_atendimento' && (
                          <Button
                            variant="default"
                            size="sm"
                onClick={() => {
                  setAgendamentoForm({
                    projectId: "",
                    projetoCustom: "",
                    construtora: "",
                    dataAgendamento: "",
                    horaAgendamento: "",
                    observacoes: "",
                    useCustomProject: false,
                  });
                  setAgendamentoDialog(true);
                }}
                          >
                            <Calendar className="h-4 w-4 mr-1" />
                            Criar Agendamento
                          </Button>
                        )}
                        
                        {/* Visita Realizada → Análise de Crédito */}
                        {selectedLead.status === 'visita_realizada' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              handleUpdateStatus(selectedLead.id, 'analise_credito');
                              setSelectedLead({ ...selectedLead, status: 'analise_credito' });
                            }}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Enviar para Análise
                          </Button>
                        )}
                        
                        {/* Análise de Crédito → Contrato Fechado */}
                        {selectedLead.status === 'analise_credito' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              handleUpdateStatus(selectedLead.id, 'contrato_fechado');
                              setSelectedLead({ ...selectedLead, status: 'contrato_fechado' });
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Fechar Contrato
                          </Button>
                        )}
                        
                        {/* Marcar como Perdido */}
                        {selectedLead.status !== 'perdido' && selectedLead.status !== 'contrato_fechado' && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              handleUpdateStatus(selectedLead.id, 'perdido', selectedLead.status);
                              setSelectedLead({ ...selectedLead, status: 'perdido' });
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Marcar como Perdido
                          </Button>
                        )}
                      </div>
                      
                      {/* Botões de Transferência e Reatribuição (apenas para gestores) */}
                      {isGestor && corretores && corretores.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                          <TransferirLeadButton
                            leadId={selectedLead.id}
                            leadNome={selectedLead.nome}
                            corretores={corretores}
                            onSuccess={() => {
                              refetch();
                              toast.success('Lead transferido com sucesso!');
                            }}
                            variant="outline"
                            size="sm"
                          />
                          <ReatribuirLeadButton
                            leadId={selectedLead.id}
                            leadNome={selectedLead.nome}
                            leadStatus={selectedLead.status}
                            corretores={corretores}
                            onSuccess={() => {
                              refetch();
                              toast.success('Lead reatribuído com sucesso!');
                            }}
                            variant="outline"
                            size="sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Observações */}
                <div>
                  <Label htmlFor="observacoes-detail">Observações</Label>
                  <Textarea
                    id="observacoes-detail"
                    value={selectedLead.observacoes || ""}
                    onChange={(e) => setSelectedLead({ ...selectedLead, observacoes: e.target.value })}
                    onBlur={() => handleUpdateObservacoes(selectedLead.id, selectedLead.observacoes || "")}
                    rows={3}
                    placeholder="Adicione observações sobre o lead..."
                    className="mt-1"
                  />
                </div>

                <Separator />

                {/* SMQ Copilot - Assistente de IA */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <span className="text-purple-600">🤖</span> SMQ Copilot
                    </h3>
                    <Button
                      onClick={() => {
                        const projetoNome = projects?.find(p => p.id === selectedLead.projectId)?.nome;
                        openWithLead({
                          id: selectedLead.id,
                          nome: selectedLead.nome,
                          telefone: selectedLead.telefone,
                          email: selectedLead.email,
                          status: statusLabels[selectedLead.status] || selectedLead.status,
                          projeto: projetoNome,
                          projetoId: selectedLead.projectId,
                          origem: selectedLead.origem,
                          observacoes: selectedLead.observacoes,
                          faixaRenda: selectedLead.faixaRenda,
                          campanha: selectedLead.campanha,
                          diasFollowupConsecutivos: selectedLead.diasFollowupConsecutivos,
                          ultimoContato: selectedLead.ultimoContato,
                        });
                      }}
                      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    >
                      <Bot className="h-4 w-4 mr-2" />
                      Abrir no Copilot
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Abra o SMQ Copilot com o contexto completo deste lead para receber scripts e sugestões personalizadas.
                  </p>
                  <CopilotQuickActions leadId={selectedLead.id} leadNome={selectedLead.nome} compact />
                </div>

                <Separator />

                {/* Histórico de interações */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Histórico de Interações</h3>
                    <Button
                      size="sm"
                      onClick={() => {
                        setInteractionDialog(true);
                        setDetailsDialog(false);
                      }}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Nova Interação
                    </Button>
                  </div>
                  
                  {leadHistory && leadHistory.length > 0 ? (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {leadHistory.map((interaction: any) => (
                        <div key={interaction.id} className="p-3 border rounded-lg bg-muted/50">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{tipoLabels[interaction.tipo]}</Badge>
                              <Badge variant="secondary">{resultadoLabels[interaction.resultado]}</Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(interaction.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          {interaction.observacoes && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {interaction.observacoes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhuma interação registrada ainda</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog de interação */}
        <Dialog open={interactionDialog} onOpenChange={setInteractionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Interação</DialogTitle>
              <DialogDescription>
                Adicione um registro de contato com o lead {selectedLead?.nome}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="tipo">Tipo de Contato</Label>
                <Select
                  value={interactionForm.tipo}
                  onValueChange={(value: any) => setInteractionForm({ ...interactionForm, tipo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="ligacao">Ligação</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="visita">Visita</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="resultado">Resultado</Label>
                <Select
                  value={interactionForm.resultado}
                  onValueChange={(value: any) => setInteractionForm({ ...interactionForm, resultado: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contato_realizado">Contato Realizado</SelectItem>
                    <SelectItem value="nao_atendeu">Não Atendeu</SelectItem>
                    <SelectItem value="agendamento">Agendamento</SelectItem>
                    <SelectItem value="visita_realizada">Visita Realizada</SelectItem>
                    <SelectItem value="proposta_enviada">Proposta Enviada</SelectItem>
                    <SelectItem value="recusou">Recusou</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={interactionForm.observacoes}
                  onChange={(e) => setInteractionForm({ ...interactionForm, observacoes: e.target.value })}
                  rows={4}
                  placeholder="Descreva o que foi conversado..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInteractionDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddInteraction} disabled={addInteractionMutation.isPending}>
                {addInteractionMutation.isPending ? "Salvando..." : "Salvar Interação"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Novo Lead */}
        <Dialog open={newLeadDialog} onOpenChange={setNewLeadDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Novo Lead
              </DialogTitle>
              <DialogDescription>
                Cadastre um novo lead manualmente. O lead será vinculado a você automaticamente.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={newLeadForm.nome}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, nome: e.target.value })}
                  placeholder="Nome completo do lead"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="telefone">Telefone *</Label>
                <Input
                  id="telefone"
                  value={newLeadForm.telefone}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, telefone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={newLeadForm.email}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="projeto">Projeto de Interesse</Label>
                <ProjectCombobox
                  projects={projects || []}
                  value={newLeadForm.isProjectManual ? newLeadForm.projectManual : newLeadForm.projectId}
                  onChange={(value, isManual) => {
                    if (isManual) {
                      setNewLeadForm({ 
                        ...newLeadForm, 
                        projectId: "",
                        projectManual: value,
                        isProjectManual: true 
                      });
                    } else {
                      setNewLeadForm({ 
                        ...newLeadForm, 
                        projectId: value,
                        projectManual: "",
                        isProjectManual: false 
                      });
                    }
                  }}
                  placeholder="Buscar ou digitar projeto..."
                />
                {newLeadForm.isProjectManual && newLeadForm.projectManual && (
                  <p className="text-xs text-muted-foreground">
                    ⚠️ Projeto não cadastrado. Será salvo nas observações.
                  </p>
                )}
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="origem">Origem do Lead</Label>
                <Select 
                  value={newLeadForm.origem} 
                  onValueChange={(value: any) => setNewLeadForm({ ...newLeadForm, origem: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="captacao_corretor">Captação Própria</SelectItem>
                    <SelectItem value="indicacao">Indicação</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="telefone">Telefone</SelectItem>
                    <SelectItem value="plantao">Plantão</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="site">Site</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="observacoes-novo">Observações</Label>
                <Textarea
                  id="observacoes-novo"
                  value={newLeadForm.observacoes}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, observacoes: e.target.value })}
                  rows={3}
                  placeholder="Informações adicionais sobre o lead..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewLeadDialog(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateLead} 
                disabled={createLeadMutation.isPending}
                className="gap-2"
              >
                {createLeadMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Criar Lead
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Tipo de Contato - Obrigatório ao sair de 'novo' ou 'aguardando' */}
        <Dialog open={contactTypeDialog} onOpenChange={(open) => {
          if (!open) {
            setContactTypeDialog(false);
            setPendingStatusChange(null);
            setSelectedContactType('');
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                Tipo de Contato Realizado
              </DialogTitle>
              <DialogDescription>
                Para alterar o status deste lead, informe como foi feito o primeiro contato.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setSelectedContactType('ligacao')}
                  className={`flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all ${
                    selectedContactType === 'ligacao'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50 hover:bg-muted'
                  }`}
                >
                  <Phone className={`h-10 w-10 ${selectedContactType === 'ligacao' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="font-semibold">Ligação</span>
                  <span className="text-xs text-muted-foreground">+5 pontos</span>
                </button>
                <button
                  onClick={() => setSelectedContactType('whatsapp')}
                  className={`flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all ${
                    selectedContactType === 'whatsapp'
                      ? 'border-green-500 bg-green-500/10 text-green-600'
                      : 'border-border hover:border-green-500/50 hover:bg-muted'
                  }`}
                >
                  <MessageCircle className={`h-10 w-10 ${selectedContactType === 'whatsapp' ? 'text-green-500' : 'text-muted-foreground'}`} />
                  <span className="font-semibold">WhatsApp</span>
                  <span className="text-xs text-muted-foreground">+1 ponto</span>
                </button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setContactTypeDialog(false);
                setPendingStatusChange(null);
                setSelectedContactType('');
              }}>
                Cancelar
              </Button>
              <Button 
                onClick={handleConfirmContactType}
                disabled={!selectedContactType || updateLeadMutation.isPending}
                className="gap-2"
              >
                {updateLeadMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  'Confirmar e Atualizar Status'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Motivo da Perda - Obrigatório ao marcar como 'perdido' */}
        <Dialog open={motivoPerdidoDialog} onOpenChange={(open) => {
          if (!open) {
            setMotivoPerdidoDialog(false);
            setPendingLossChange(null);
            setMotivoPerdido('');
            setOutroMotivo('');
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                Motivo da Perda do Lead
              </DialogTitle>
              <DialogDescription>
                Para marcar este lead como perdido, é necessário informar o motivo. Isso ajuda na análise gerencial.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="motivo">Motivo da Perda *</Label>
                <Select value={motivoPerdido} onValueChange={setMotivoPerdido}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem_interesse">Sem Interesse</SelectItem>
                    <SelectItem value="sem_credito">Sem Crédito / Não Aprovado</SelectItem>
                    <SelectItem value="comprou_concorrente">Comprou com Concorrente</SelectItem>
                    <SelectItem value="preco_alto">Preço Muito Alto</SelectItem>
                    <SelectItem value="localizacao">Localização Não Atende</SelectItem>
                    <SelectItem value="nao_atende">Não Atende / Não Responde</SelectItem>
                    <SelectItem value="desistiu">Desistiu da Compra</SelectItem>
                    <SelectItem value="outro">Outro Motivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {motivoPerdido === 'outro' && (
                <div className="space-y-2">
                  <Label htmlFor="outro-motivo">Especifique o Motivo *</Label>
                  <Textarea
                    id="outro-motivo"
                    placeholder="Descreva o motivo da perda..."
                    value={outroMotivo}
                    onChange={(e) => setOutroMotivo(e.target.value)}
                    rows={3}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setMotivoPerdidoDialog(false);
                setPendingLossChange(null);
                setMotivoPerdido('');
                setOutroMotivo('');
              }}>
                Cancelar
              </Button>
              <Button 
                onClick={async () => {
                  if (!motivoPerdido) {
                    toast.error('Selecione o motivo da perda');
                    return;
                  }
                  if (motivoPerdido === 'outro' && !outroMotivo.trim()) {
                    toast.error('Especifique o motivo da perda');
                    return;
                  }
                  
                  if (pendingLossChange) {
                    const motivoFinal = motivoPerdido === 'outro' ? outroMotivo : motivoPerdido;
                    await executeStatusUpdate(pendingLossChange.leadId, 'perdido', undefined, motivoFinal);
                    setMotivoPerdidoDialog(false);
                    setPendingLossChange(null);
                    setMotivoPerdido('');
                    setOutroMotivo('');
                  }
                }}
                disabled={!motivoPerdido || (motivoPerdido === 'outro' && !outroMotivo.trim()) || updateLeadMutation.isPending}
                className="gap-2"
                variant="destructive"
              >
                {updateLeadMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Marcando como Perdido...
                  </>
                ) : (
                  'Confirmar e Marcar como Perdido'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Dialog de Agendamento */}
        <Dialog open={agendamentoDialog} onOpenChange={setAgendamentoDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Criar Agendamento</DialogTitle>
              <DialogDescription>
                Agende uma visita para {selectedLead?.nome}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Projeto */}
              <div className="space-y-2">
                <Label>Projeto / Empreendimento</Label>
                <Select
                  value={agendamentoForm.useCustomProject ? "custom" : agendamentoForm.projectId}
                  onValueChange={(value) => {
                    if (value === "custom") {
                      setAgendamentoForm(prev => ({ ...prev, useCustomProject: true, projectId: "" }));
                    } else {
                      const projeto = projects?.find(p => p.id.toString() === value);
                      setAgendamentoForm(prev => ({
                        ...prev,
                        useCustomProject: false,
                        projectId: value,
                        construtora: projeto?.construtora || "",
                      }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects?.map((projeto: any) => (
                      <SelectItem key={projeto.id} value={projeto.id.toString()}>
                        {projeto.nome}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Digitar manualmente...</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {agendamentoForm.useCustomProject && (
                <div className="space-y-2">
                  <Label>Nome do Projeto</Label>
                  <Input
                    placeholder="Digite o nome do projeto"
                    value={agendamentoForm.projetoCustom}
                    onChange={(e) => setAgendamentoForm(prev => ({ ...prev, projetoCustom: e.target.value }))}
                  />
                </div>
              )}
              
              {/* Construtora */}
              <div className="space-y-2">
                <Label>Construtora (opcional)</Label>
                <Input
                  placeholder="Nome da construtora"
                  value={agendamentoForm.construtora}
                  onChange={(e) => setAgendamentoForm(prev => ({ ...prev, construtora: e.target.value }))}
                />
              </div>
              
              {/* Data e Hora */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <input
                    type="date"
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={agendamentoForm.dataAgendamento}
                    onChange={(e) => setAgendamentoForm(prev => ({ ...prev, dataAgendamento: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hora</Label>
                  <input
                    type="time"
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={agendamentoForm.horaAgendamento}
                    onChange={(e) => setAgendamentoForm(prev => ({ ...prev, horaAgendamento: e.target.value }))}
                  />
                </div>
              </div>
              
              {/* Observações */}
              <div className="space-y-2">
                <Label>Observações (opcional)</Label>
                <Textarea
                  placeholder="Observações sobre o agendamento..."
                  value={agendamentoForm.observacoes}
                  onChange={(e) => setAgendamentoForm(prev => ({ ...prev, observacoes: e.target.value }))}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setAgendamentoDialog(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateAgendamento}
                disabled={isSubmittingAgendamento || createAgendamentoMutation.isPending}
                className="gap-2"
              >
                {(isSubmittingAgendamento || createAgendamentoMutation.isPending) ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <CalendarPlus className="h-4 w-4" />
                    Criar Agendamento
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Popup urgente para leads Facebook Ads */}
      {webhookPopup}
      
      {/* Dialog de atribuição de corretor */}
      <AtribuirCorretorDialog
        open={atribuirDialog}
        onOpenChange={setAtribuirDialog}
        lead={selectedLead}
        onSuccess={() => {
          refetch();
          toast.success("Lead atribuído com sucesso!");
        }}
      />
      
      <TransferirEmLoteDialog
        open={transferirEmLoteDialog}
        onOpenChange={setTransferirEmLoteDialog}
        leadIds={selectedLeadIds}
        onSuccess={() => {
          refetch();
          setSelectedLeadIds([]);
        }}
      />
    </DashboardLayout>
  );
}
