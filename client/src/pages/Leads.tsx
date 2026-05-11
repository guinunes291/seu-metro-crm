import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  Phone, Mail, Building2, Calendar, MessageSquare, Search,
  Clock, AlertCircle, CheckCircle2, XCircle, Eye, LayoutGrid, List, Plus, UserPlus, Loader2, MessageCircle, CalendarPlus, FileText,
  Shield, Flame, Thermometer, Snowflake, BookOpen, Copy, MoreHorizontal, Zap, ChevronDown, ChevronUp, SlidersHorizontal
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useRef } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CopilotQuickActions } from "@/components/CopilotQuickActions";
import { SMQCopilotButton } from "@/components/SMQCopilotChat";
import { useCopilot } from "@/contexts/CopilotContext";
import { Bot } from "lucide-react";
import { ProjectCombobox } from "@/components/ProjectCombobox";
import { FilterProjectCombobox } from "@/components/FilterProjectCombobox";
import LeadTimer, { LeadUrgencyBadge } from "@/components/LeadTimer";
import { TimerLead } from "@/components/TimerLead";
// useWebhookLeadNotification movido para CorretorNotifications (App.tsx) — gestores não recebem sons/popups de leads
import { AtribuirCorretorDialog } from "@/components/AtribuirCorretorDialog";
import { TransferirEmLoteDialog } from "@/components/TransferirEmLoteDialog";
import TransferirLeadButton from "@/components/TransferirLeadButton";
import ReatribuirLeadButton from "@/components/ReatribuirLeadButton";
import { DateRangeFilter, DateRangePreset } from "@/components/DateRangeFilter";
import { getDateRangeFromPreset } from "@/lib/dateRangeUtils";
import { ExecutandoComIA } from "@/components/ExecutandoComIA";
import { CarteiraAtivaQuickButton } from "@/pages/CarteiraAtiva";

const statusLabels: Record<string, string> = {
  novo: "Novo",
  aguardando_atendimento: "Aguardando Atendimento",
  em_atendimento: "Em Atendimento",
  qualificado: "Qualificado",
  agendado: "Agendado",
  visita_realizada: "Visita Realizada",
  proposta_enviada: "Proposta Enviada",
  analise_credito: "Análise de Crédito",
  contrato_fechado: "Contrato Fechado",
  pos_venda: "Pós-venda",
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
  const [temperaturaFilter, setTemperaturaFilter] = useState<string>("all"); // Fase 2
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
    temperatura: temperaturaFilter !== 'all' ? temperaturaFilter as 'quente' | 'morno' | 'frio' : undefined, // Fase 2
    dataInicio: dataInicioFilter || undefined,
    dataFim: dataFimFilter || undefined,
  }, {
    keepPreviousData: true, // Evita tela branca durante re-fetch
    refetchInterval: 5 * 60 * 1000, // Atualiza a cada 5 minutos (reduzido de 30s — 10x menos queries)
    refetchOnMount: 'always', // Sempre busca dados frescos ao montar
    refetchOnWindowFocus: true, // Reativado: atualiza ao focar a janela (substitui o polling agressivo)
  });
  const leads = leadsData?.leads || [];
  const totalPages = leadsData?.totalPages || 1;
  const totalLeads = leadsData?.total || 0;
  
  const { data: projects } = trpc.projects.list.useQuery();
  const { data: corretores } = trpc.corretores.listParaTransferencia.useQuery();
  const { data: user } = trpc.auth.me.useQuery();
  const isGestor = user?.role === 'gestor' || user?.role === 'admin' || user?.role === 'superintendente';
  const [selectedLead, setSelectedLead] = useState<any>(null);
  
  // Hook de notificação movido para CorretorNotifications (App.tsx)
  
  // Hook para integrar com o Copilot flutuante
  const { openWithLead } = useCopilot();
  const [detailsDialog, setDetailsDialog] = useState(false);
  const [, setLocation] = useLocation();

  // Ler leadId da URL para abrir modal automaticamente — roda uma vez por mount
  // Usa ref para não disparar novamente quando `leads` é atualizado pelo React Query
  const urlLeadIdHandled = useRef(false);
  useEffect(() => {
    if (urlLeadIdHandled.current || !leads) return;
    const urlParams = new URLSearchParams(window.location.search);
    const leadIdParam = urlParams.get('leadId');
    if (!leadIdParam) return;
    const leadId = parseInt(leadIdParam);
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      urlLeadIdHandled.current = true;
      setSelectedLead(lead);
      setDetailsDialog(true);
      window.history.replaceState({}, '', '/leads');
    }
  }, [leads]);
  const [interactionDialog, setInteractionDialog] = useState(false);
  const [atribuirDialog, setAtribuirDialog] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  
  // Estados para seleção múltipla
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [transferirEmLoteDialog, setTransferirEmLoteDialog] = useState(false);
  const [bulkStatusDialog, setBulkStatusDialog] = useState<{ open: boolean; novoStatus: string | null }>({ open: false, novoStatus: null });

  const utils = trpc.useUtils();
  const updateLeadMutation = trpc.leads.update.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar lead: ${error.message}`);
    },
  });
  const analisarLeadMutation = trpc.ia.analisarLeadPosInteracao.useMutation({
    onSuccess: (data) => {
      const tempLabel: Record<string, string> = { quente: '🔥 Quente', morno: '🌡️ Morno', frio: '❄️ Frio' };
      toast.success(
        `IA: ${tempLabel[data.temperatura] ?? data.temperatura} • ${data.proximaAcao} — análise salva nas observações do lead`,
        { duration: 8000 }
      );
      // Recarregar lead para mostrar observações atualizadas
      utils.leads.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const addInteractionMutation = trpc.leads.addInteraction.useMutation({
    onSuccess: (_, variables) => {
      utils.leads.list.invalidate();
      // Invalidar o histórico para que ele seja recarregado após registrar interação
      utils.leads.getHistory.invalidate();
      // Agente 1: analisar lead em background após registrar interação
      if (variables.leadId) {
        analisarLeadMutation.mutate({ leadId: variables.leadId });
      }
    },
    onError: (error) => {
      toast.error(`Erro ao registrar interação: ${error.message}`);
    },
  });
  const createLeadMutation = trpc.leads.createByCorretor.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao criar lead: ${error.message}`);
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

  const bulkUpdateStatusMutation = trpc.leads.bulkUpdateStatus.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.atualizados} leads atualizados com sucesso!`);
      setSelectedLeadIds([]);
      utils.leads.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar status: ${error.message}`);
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
  const [expandedAds, setExpandedAds] = useState<Set<number>>(new Set());
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
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
    },
  });
  
  const handleCreateAgendamento = () => {
    if (createAgendamentoMutation.isPending) {
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
      // Reabrir o modal de detalhes para que o usuário veja o histórico atualizado
      if (selectedLead) {
        setDetailsDialog(true);
      }
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

  const executeStatusUpdate = async (
    leadId: number,
    newStatus: string,
    contactType?: 'ligacao' | 'whatsapp',
    motivoPerdidoTexto?: string,
    motivoPerdaCategoria?: string,
  ) => {
    try {
      const updateData: any = { status: newStatus as any };

      if (motivoPerdidoTexto) {
        updateData.motivoPerdido = motivoPerdidoTexto;
      }
      if (motivoPerdaCategoria) {
        updateData.motivoPerdaCategoria = motivoPerdaCategoria;
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

  // ── Helpers visuais ──────────────────────────────────────────────────────

  // Melhoria 7: Badge honesto de inatividade (sem falso "será descartado")
  function getInactivityBadge(lead: any) {
    const statusAtivo = !['contrato_fechado', 'perdido', 'novo', 'aguardando_atendimento'].includes(lead.status);
    if (!statusAtivo || !lead.ultimaInteracao) return null;
    const dias = Math.floor((Date.now() - new Date(lead.ultimaInteracao).getTime()) / 86_400_000);
    if (dias < 2) return null;
    if (dias >= 15) return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300"><AlertCircle className="h-3 w-3" /> {dias} dias sem contato — verifique urgência</span>;
    if (dias >= 7)  return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200"><Clock className="h-3 w-3" /> {dias} dias sem contato</span>;
    if (dias >= 4)  return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200"><Clock className="h-3 w-3" /> {dias} dias parado</span>;
    return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200"><Clock className="h-3 w-3" /> {dias} dias sem interação</span>;
  }

  // Melhoria 9: Badge de origem com ícone e cor
  function OrigemBadge({ origem }: { origem: string }) {
    const config: Record<string, { icon: string; label: string; cls: string }> = {
      facebook:                  { icon: '📘', label: 'Facebook',           cls: 'bg-blue-50 text-blue-700 border-blue-200' },
      google_sheets:             { icon: '📊', label: 'Google Sheets',       cls: 'bg-green-50 text-green-700 border-green-200' },
      site:                      { icon: '🌐', label: 'Site',                cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
      indicacao:                 { icon: '👥', label: 'Indicação',           cls: 'bg-purple-50 text-purple-700 border-purple-200' },
      captacao_corretor:         { icon: '🎯', label: 'Captação Própria',    cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
      whatsapp:                  { icon: '💬', label: 'WhatsApp',            cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      telefone:                  { icon: '📞', label: 'Telefone',            cls: 'bg-teal-50 text-teal-700 border-teal-200' },
      plantao:                   { icon: '🏠', label: 'Plantão',             cls: 'bg-amber-50 text-amber-700 border-amber-200' },
      agendamento_self_service:  { icon: '🗓', label: 'Self-Service',        cls: 'bg-violet-50 text-violet-700 border-violet-200' },
      chatbot:                   { icon: '🤖', label: 'Chatbot',             cls: 'bg-slate-50 text-slate-700 border-slate-200' },
      outro:                     { icon: '❓', label: 'Outro',               cls: 'bg-gray-50 text-gray-600 border-gray-200' },
    };
    const cfg = config[origem] || config['outro'];
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.cls}`}>
        <span>{cfg.icon}</span>{cfg.label}
      </span>
    );
  }

  // Melhoria 6: Badge de próximo follow-up
  function FollowUpBadge({ lead }: { lead: any }) {
    const hasFollowUp = lead.proximoFollowup || lead.proximaTarefaData;
    const streak = lead.diasFollowupConsecutivos;
    if (!hasFollowUp && !(streak >= 2)) return null;
    const followDate = hasFollowUp ? new Date(hasFollowUp) : null;
    const isOverdue = followDate && followDate < new Date();
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {followDate && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
            isOverdue ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'
          }`}>
            📅 {isOverdue ? 'Follow-up atrasado: ' : 'Follow-up: '}
            {format(followDate, "dd/MM HH:mm", { locale: ptBR })}
          </span>
        )}
        {streak >= 2 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
            🔥 {streak} dias de cadência
          </span>
        )}
      </div>
    );
  }

  // Melhoria 1: Pipeline de status com contagens da lista atual
  const statusCounts = leads.reduce((acc: Record<string, number>, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const leadsParados = leads.filter(l => {
    if (!['em_atendimento', 'qualificado', 'agendado', 'visita_realizada'].includes(l.status)) return false;
    if (!l.ultimaInteracao) return false;
    return Math.floor((Date.now() - new Date(l.ultimaInteracao).getTime()) / 86_400_000) >= 3;
  }).length;
  const activeFiltersCount = [
    origemFilter !== 'all', temperaturaFilter !== 'all', dateRangePreset !== 'all', corretorFilter !== 'all'
  ].filter(Boolean).length;

  return (
    <DashboardLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
              <>
                <Button
                  onClick={() => setTransferirEmLoteDialog(true)}
                  variant="secondary"
                  className="gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  Transferir {selectedLeadIds.length} {selectedLeadIds.length === 1 ? 'Lead' : 'Leads'}
                </Button>
                <Select
                  onValueChange={(novoStatus) => {
                    if (novoStatus) {
                      setBulkStatusDialog({ open: true, novoStatus });
                    }
                  }}
                >
                  <SelectTrigger className="w-auto gap-2 border-dashed">
                    <SelectValue placeholder="Alterar status em massa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aguardando_atendimento">Aguardando Atendimento</SelectItem>
                    <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                    <SelectItem value="agendado">Agendado</SelectItem>
                    <SelectItem value="visita_realizada">Visita Realizada</SelectItem>
                    <SelectItem value="analise_credito">Análise de Crédito</SelectItem>
                    <SelectItem value="contrato_fechado">Contrato Fechado</SelectItem>
                    <SelectItem value="perdido">Perdido</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>

        {/* Melhoria 2: Navegação unificada — Lista (cards/tabela), Kanban, Carteira Ativa */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="flex gap-1 p-1 rounded-lg bg-muted">
            <button
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'cards' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}`}
            >
              <LayoutGrid className="h-4 w-4" />
              Cards
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'table' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}`}
            >
              <List className="h-4 w-4" />
              Tabela
            </button>
          </div>
          {!isGestor && (
            <>
              <button
                onClick={() => setLocation("/kanban")}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-transparent hover:border-border"
              >
                <LayoutGrid className="h-4 w-4" />
                Kanban
              </button>
              <button
                onClick={() => setLocation("/carteira-ativa")}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-transparent hover:border-border"
              >
                <Shield className="h-4 w-4" />
                Carteira Ativa
              </button>
            </>
          )}
        </div>

        {/* Melhoria 2+3: Filtros compactos com status pills */}
        <Card className="mb-4">
          <CardContent className="pt-4 pb-3">
            {/* Linha 1: Busca + Projeto + botão Mais Filtros */}
            <div className="flex gap-2 flex-wrap items-end mb-3">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, telefone, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="min-w-[160px]">
                <FilterProjectCombobox
                  projects={projects || []}
                  value={projectFilter}
                  onChange={setProjectFilter}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedFilters(v => !v)}
                className="gap-2 shrink-0"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Mais filtros
                {activeFiltersCount > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">{activeFiltersCount}</span>
                )}
                {showAdvancedFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </div>

            {/* Melhoria 3: Status pills */}
            <div className="flex gap-1.5 flex-wrap">
              {[
                { value: 'all', label: 'Todos', count: totalLeads },
                { value: 'aguardando_atendimento', label: 'Aguardando', count: statusCounts['aguardando_atendimento'] || 0 },
                { value: 'novo', label: 'Novo', count: statusCounts['novo'] || 0 },
                { value: 'em_atendimento', label: 'Em Atendimento', count: statusCounts['em_atendimento'] || 0 },
                { value: 'agendado', label: 'Agendados', count: statusCounts['agendado'] || 0 },
                { value: 'visita_realizada', label: 'Visita', count: statusCounts['visita_realizada'] || 0 },
                { value: 'analise_credito', label: 'Análise', count: statusCounts['analise_credito'] || 0 },
                { value: 'proposta_enviada', label: 'Proposta', count: statusCounts['proposta_enviada'] || 0 },
                { value: 'contrato_fechado', label: '✅ Fechados', count: statusCounts['contrato_fechado'] || 0 },
                { value: 'perdido', label: '❌ Perdidos', count: statusCounts['perdido'] || 0 },
              ].map(pill => (
                <button
                  key={pill.value}
                  onClick={() => { setStatusFilter(pill.value); setCurrentPage(1); }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    statusFilter === pill.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                  }`}
                >
                  {pill.label}
                  {pill.count > 0 && <span className={`ml-0.5 ${statusFilter === pill.value ? 'opacity-80' : 'opacity-60'}`}>({pill.count})</span>}
                </button>
              ))}
            </div>

            {/* Filtros avançados colapsáveis */}
            {showAdvancedFilters && (
              <div className={`grid gap-3 mt-3 pt-3 border-t ${isGestor ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                <div className="space-y-1">
                  <Label className="text-xs">Origem</Label>
                  <Select value={origemFilter} onValueChange={setOrigemFilter}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as origens</SelectItem>
                      {Object.entries(origemLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isGestor && (
                  <div className="space-y-1">
                    <Label className="text-xs">Corretor</Label>
                    <Select value={corretorFilter} onValueChange={setCorretorFilter}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {corretores?.map((corretor) => (
                          <SelectItem key={corretor.id} value={corretor.id.toString()}>{corretor.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Temperatura</Label>
                  <Select value={temperaturaFilter} onValueChange={(v) => { setTemperaturaFilter(v); setCurrentPage(1); }}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="quente"><span className="flex items-center gap-1"><Flame className="h-3 w-3 text-red-500" /> Quente</span></SelectItem>
                      <SelectItem value="morno"><span className="flex items-center gap-1"><Thermometer className="h-3 w-3 text-orange-400" /> Morno</span></SelectItem>
                      <SelectItem value="frio"><span className="flex items-center gap-1"><Snowflake className="h-3 w-3 text-blue-400" /> Frio</span></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Período</Label>
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
            )}
          </CardContent>
        </Card>

        {/* Melhoria 1: Pipeline de status com contagens acionáveis */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-5">
          {[
            { status: 'aguardando_atendimento', label: 'Aguardando', color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: '⏳', extra: null },
            { status: 'em_atendimento',         label: 'Em Atendimento', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: '📞', extra: leadsParados > 0 ? `${leadsParados} parados` : null },
            { status: 'agendado',               label: 'Agendados',     color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', icon: '📅', extra: null },
            { status: 'visita_realizada',        label: 'Visita',        color: 'text-teal-600',   bg: 'bg-teal-50 border-teal-200',   icon: '🏠', extra: null },
            { status: 'contrato_fechado',        label: 'Fechados',      color: 'text-emerald-600',bg: 'bg-emerald-50 border-emerald-200',icon:'✅', extra: null },
            { status: 'perdido',                 label: 'Perdidos',      color: 'text-gray-500',   bg: 'bg-gray-50 border-gray-200',   icon: '❌', extra: null },
          ].map(({ status, label, color, bg, icon, extra }) => {
            const count = statusCounts[status] || 0;
            const isActive = statusFilter === status;
            return (
              <button
                key={status}
                onClick={() => { setStatusFilter(isActive ? 'all' : status); setCurrentPage(1); }}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                  isActive ? `${bg} ${color} ring-2 ring-offset-1 ring-current` : 'bg-card border-border hover:border-primary/30 hover:bg-muted/50'
                }`}
              >
                <span className="text-lg mb-0.5">{icon}</span>
                <span className={`text-xl font-bold ${isActive ? color : ''}`}>{count}</span>
                <span className={`text-[10px] font-medium ${isActive ? color : 'text-muted-foreground'}`}>{label}</span>
                {extra && <span className="text-[9px] text-red-500 font-semibold mt-0.5">{extra}</span>}
              </button>
            );
          })}
        </div>

        {/* Lista de leads */}
        {isLoading ? (
          <div className="grid gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-6 w-28 rounded-full" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-4 w-44" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-9 w-32 rounded-md" />
                      <Skeleton className="h-9 w-9 rounded-md" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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
                            {lead.temperatura === 'quente' && (
                              <Badge className="bg-red-100 text-red-700 border border-red-300 flex items-center gap-1">
                                <Flame className="h-3 w-3" /> Quente
                              </Badge>
                            )}
                            {lead.temperatura === 'morno' && (
                              <Badge className="bg-orange-100 text-orange-700 border border-orange-300 flex items-center gap-1">
                                <Thermometer className="h-3 w-3" /> Morno
                              </Badge>
                            )}
                            {lead.temperatura === 'frio' && (
                              <Badge className="bg-blue-100 text-blue-700 border border-blue-300 flex items-center gap-1">
                                <Snowflake className="h-3 w-3" /> Frio
                              </Badge>
                            )}
                            {lead.origemWebhook && (
                              <Badge className="bg-red-600 hover:bg-red-700 text-white">
                                🔥 FACEBOOK ADS - URGENTE
                              </Badge>
                            )}
                            {/* Melhoria 7: Badge honesto de inatividade */}
                            {getInactivityBadge(lead)}
                          </div>
                          {/* Melhoria 9: OrigemBadge com ícone */}
                          <div className="mt-1">
                            {lead.origem && <OrigemBadge origem={lead.origem} />}
                          </div>
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
                              ultimaInteracao={lead.ultimaInteracao}
                            />
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          {/* Melhoria 8: Telefone com botão copiar */}
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
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
                            <button
                              title="Copiar número"
                              aria-label="Copiar número"
                              onClick={() => {
                                navigator.clipboard.writeText(lead.telefone.replace(/\D/g, ''));
                                toast.success('Número copiado!');
                              }}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                          {lead.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                              <a href={`mailto:${lead.email}`} className="hover:underline truncate">{lead.email}</a>
                              <button
                                title="Copiar e-mail"
                                aria-label="Copiar e-mail"
                                onClick={() => { navigator.clipboard.writeText(lead.email!); toast.success('E-mail copiado!'); }}
                                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
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
                              <span>Último contato: {format(new Date(lead.ultimoContato), "dd/MM/yyyy", { locale: ptBR })}</span>
                            </div>
                          )}
                          {/* Melhoria 6: Follow-up e streak */}
                          <FollowUpBadge lead={lead} />
                          {/* Melhoria 5: Campos ADS colapsáveis */}
                          {lead.origemWebhook && (lead.campanha || lead.faixaRenda || lead.prefereContatoPor || lead.finalidadeImovel) && (
                            <div>
                              <button
                                onClick={() => setExpandedAds(prev => {
                                  const next = new Set(prev);
                                  next.has(lead.id) ? next.delete(lead.id) : next.add(lead.id);
                                  return next;
                                })}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                              >
                                📘 Dados do Facebook ADS
                                {expandedAds.has(lead.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </button>
                              {expandedAds.has(lead.id) && (
                                <div className="mt-1.5 pl-2 border-l-2 border-blue-200 space-y-1">
                                  {lead.campanha && <p className="text-xs text-muted-foreground"><span className="font-medium">Campanha:</span> {lead.campanha}</p>}
                                  {lead.faixaRenda && <p className="text-xs text-muted-foreground"><span className="font-medium">Renda:</span> {lead.faixaRenda.replace(/_/g, ' ')}</p>}
                                  {lead.prefereContatoPor && <p className="text-xs text-muted-foreground"><span className="font-medium">Contato via:</span> {lead.prefereContatoPor}</p>}
                                  {lead.finalidadeImovel && <p className="text-xs text-muted-foreground"><span className="font-medium">Finalidade:</span> {lead.finalidadeImovel}</p>}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Melhoria 4: 3-button pattern — primário + WhatsApp + "..." */}
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2 items-center flex-wrap">
                            {/* Ação primária contextual */}
                            {(lead.status === 'aguardando_atendimento' || lead.status === 'novo') && (
                              <Button size="sm" onClick={() => handleUpdateStatus(lead.id, 'em_atendimento', lead.status)}>
                                <Phone className="h-4 w-4 mr-1" /> Iniciar Atendimento
                              </Button>
                            )}
                            {lead.status === 'em_atendimento' && (
                              <Button size="sm" onClick={() => { setSelectedLead(lead); setAgendamentoForm({ projectId: "", projetoCustom: "", construtora: "", dataAgendamento: "", horaAgendamento: "", observacoes: "", useCustomProject: false }); setAgendamentoDialog(true); }}>
                                <Calendar className="h-4 w-4 mr-1" /> Criar Agendamento
                              </Button>
                            )}
                            {lead.status === 'visita_realizada' && (
                              <Button size="sm" onClick={() => handleUpdateStatus(lead.id, 'analise_credito')}>
                                <FileText className="h-4 w-4 mr-1" /> Enviar para Análise
                              </Button>
                            )}
                            {lead.status === 'analise_credito' && (
                              <Button size="sm" onClick={() => handleUpdateStatus(lead.id, 'contrato_fechado')}>
                                <CheckCircle2 className="h-4 w-4 mr-1" /> Fechar Contrato
                              </Button>
                            )}
                            {isGestor && !lead.corretorId && (
                              <Button size="sm" onClick={() => { setSelectedLead(lead); setAtribuirDialog(true); }}>
                                <UserPlus className="h-4 w-4 mr-1" /> Atribuir
                              </Button>
                            )}
                            {/* WhatsApp sempre visível */}
                            {lead.telefone && (
                              <Button
                                variant="outline" size="sm"
                                className="bg-green-500 hover:bg-green-600 border-green-500 text-white px-2"
                                onClick={() => { const p = projects?.find((p: any) => p.id === lead.projectId)?.nome || lead.projetoCustom; window.open(gerarLinkWhatsApp(lead.telefone, lead.nome, p), '_blank'); }}
                              >
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {/* "..." overflow com ações secundárias */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="px-2">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openDetails(lead)}>
                                  <Eye className="h-4 w-4 mr-2" /> Ver Detalhes
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSelectedLead(lead); setInteractionDialog(true); }}>
                                  <MessageSquare className="h-4 w-4 mr-2" /> Registrar Interação
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSelectedLead(lead); if (lead.projectId) setAgendamentoForm(prev => ({ ...prev, projectId: lead.projectId?.toString() || "", useCustomProject: false })); setAgendamentoDialog(true); }}>
                                  <CalendarPlus className="h-4 w-4 mr-2" /> Agendar Visita
                                </DropdownMenuItem>
                                {corretores && corretores.length > 0 && isGestor && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => { setSelectedLead(lead); }}>
                                      <UserPlus className="h-4 w-4 mr-2" /> Transferir / Reatribuir
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {lead.status !== 'perdido' && lead.status !== 'contrato_fechado' && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => handleUpdateStatus(lead.id, 'perdido', lead.status)}
                                    >
                                      <XCircle className="h-4 w-4 mr-2" /> Marcar como Perdido
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {/* Botão detalhes como fallback visível */}
                            <Button variant="outline" size="sm" onClick={() => openDetails(lead)}>
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
                    const statusAtivo = !['contrato_fechado', 'perdido', 'novo'].includes(lead.status);
                    const diasParado = lead.ultimaInteracao && statusAtivo
                      ? Math.floor((Date.now() - new Date(lead.ultimaInteracao).getTime()) / 86_400_000)
                      : null;
                    const estaParado = diasParado !== null && diasParado >= 3;

                    return (
                      <TableRow key={lead.id} className={
                        lead.origemWebhook ? 'bg-red-50/30' :
                        estaParado && diasParado! >= 15 ? 'bg-red-50/20 dark:bg-red-950/10' :
                        estaParado && diasParado! >= 7  ? 'bg-orange-50/20 dark:bg-orange-950/10' :
                        estaParado ? 'bg-yellow-50/20 dark:bg-yellow-950/10' : ''
                      }>
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
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span>{lead.telefone}</span>
                            {lead.telefone && (
                              <button
                                title="Copiar telefone"
                                aria-label="Copiar telefone"
                                className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
                                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(lead.telefone); toast.success('Número copiado!'); }}
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{project?.nome || lead.projetoCustom || "-"}</TableCell>
                        {isGestor && <TableCell>{lead.corretorNome || "-"}</TableCell>}
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={getStatusVariant(lead.status)}>
                              {statusLabels[lead.status]}
                            </Badge>
                            {estaParado && (
                              <Badge variant="outline" className={`text-xs ${
                                diasParado! >= 15 ? 'text-red-600 border-red-400' :
                                diasParado! >= 7  ? 'text-orange-600 border-orange-400' :
                                                    'text-yellow-600 border-yellow-400'
                              }`}>
                                <Clock className="h-3 w-3 mr-1" />
                                Parado {diasParado}d
                              </Badge>
                            )}
                          </div>
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
                              ultimaInteracao={lead.ultimaInteracao}
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
                              aria-label="Registrar interação"
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
                              aria-label="Ver detalhes"
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
              <Tabs defaultValue="detalhes" className="w-full">
                <TabsList className="flex flex-wrap h-auto gap-0.5 w-full mb-4 p-1">
                  <TabsTrigger value="detalhes" className="text-xs flex-1 min-w-[80px]">Detalhes</TabsTrigger>
                  <TabsTrigger value="copilot" className="text-xs flex-1 min-w-[80px]">Histórico</TabsTrigger>
                  <TabsTrigger value="ia" className="flex items-center gap-1 text-xs flex-1 min-w-[80px]">
                    <span>🤖</span> IA
                  </TabsTrigger>
                  <TabsTrigger value="scripts" className="flex items-center gap-1 text-xs flex-1 min-w-[80px]">
                    <BookOpen className="h-3 w-3" /> Scripts
                  </TabsTrigger>
                </TabsList>

                {/* ── ABA: DETALHES ── */}
                <TabsContent value="detalhes">
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
                    {(selectedLead as any).tempoAtePrimeiroContato != null && (
                      <div className="flex items-center gap-2 text-sm">
                        <Zap className={`h-4 w-4 ${
                          (selectedLead as any).tempoAtePrimeiroContato <= 5 ? 'text-green-500' :
                          (selectedLead as any).tempoAtePrimeiroContato <= 30 ? 'text-yellow-500' :
                          'text-red-500'
                        }`} />
                        <span>
                          SLA de atendimento:{" "}
                          <strong className={
                            (selectedLead as any).tempoAtePrimeiroContato <= 5 ? 'text-green-600' :
                            (selectedLead as any).tempoAtePrimeiroContato <= 30 ? 'text-yellow-600' :
                            'text-red-600'
                          }>
                            {(selectedLead as any).tempoAtePrimeiroContato < 60
                              ? `${(selectedLead as any).tempoAtePrimeiroContato} min`
                              : `${Math.round((selectedLead as any).tempoAtePrimeiroContato / 60)}h`}
                          </strong>
                          {(selectedLead as any).tempoAtePrimeiroContato <= 5 && <span className="ml-1 text-green-600 text-xs">⚡ Excelente</span>}
                          {(selectedLead as any).tempoAtePrimeiroContato > 60 && <span className="ml-1 text-red-600 text-xs">⚠ Tardio</span>}
                        </span>
                      </div>
                    )}
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
                      
                      {/* Botão Carteira Ativa (apenas para o próprio corretor) */}
                      {!isGestor && selectedLead.status !== 'perdido' && selectedLead.status !== 'contrato_fechado' && (
                        <CarteiraAtivaQuickButton leadId={selectedLead.id} leadNome={selectedLead.nome} />
                      )}

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

                {/* Temperatura e Qualificação Financeira — Fase 2 */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    Temperatura e Qualificação Financeira
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">

                    {/* Temperatura */}
                    <div className="space-y-2">
                      <Label>Temperatura do Lead</Label>
                      <Select
                        value={selectedLead.temperatura || ""}
                        onValueChange={(val) => {
                          const novaTemp = val === "" ? null : val;
                          updateLeadMutation.mutate({ id: selectedLead.id, data: { temperatura: novaTemp as any } });
                          setSelectedLead({ ...selectedLead, temperatura: novaTemp });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Não classificado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">
                            <span className="text-muted-foreground">Não classificado</span>
                          </SelectItem>
                          <SelectItem value="quente">
                            <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-red-500" /> Quente</span>
                          </SelectItem>
                          <SelectItem value="morno">
                            <span className="flex items-center gap-1"><Thermometer className="h-3 w-3 text-orange-400" /> Morno</span>
                          </SelectItem>
                          <SelectItem value="frio">
                            <span className="flex items-center gap-1"><Snowflake className="h-3 w-3 text-blue-400" /> Frio</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Renda Informada */}
                    <div className="space-y-2">
                      <Label htmlFor="rendaInformada">Renda Familiar Informada</Label>
                      <Input
                        id="rendaInformada"
                        placeholder="Ex: R$ 3.500,00"
                        value={selectedLead.rendaInformada || ""}
                        onChange={(e) => setSelectedLead({ ...selectedLead, rendaInformada: e.target.value })}
                        onBlur={() => updateLeadMutation.mutate({ id: selectedLead.id, data: { rendaInformada: selectedLead.rendaInformada || null } })}
                      />
                    </div>

                    {/* Entrada Disponível */}
                    <div className="space-y-2">
                      <Label htmlFor="entradaDisponivel">Entrada Disponível</Label>
                      <Input
                        id="entradaDisponivel"
                        placeholder="Ex: R$ 10.000,00"
                        value={selectedLead.entradaDisponivel || ""}
                        onChange={(e) => setSelectedLead({ ...selectedLead, entradaDisponivel: e.target.value })}
                        onBlur={() => updateLeadMutation.mutate({ id: selectedLead.id, data: { entradaDisponivel: selectedLead.entradaDisponivel || null } })}
                      />
                    </div>

                    {/* Usa FGTS */}
                    <div className="space-y-2">
                      <Label>Possui FGTS disponível?</Label>
                      <div className="flex gap-3 mt-1">
                        <Button
                          size="sm"
                          variant={selectedLead.usaFgts === true ? "default" : "outline"}
                          onClick={() => {
                            updateLeadMutation.mutate({ id: selectedLead.id, data: { usaFgts: true } });
                            setSelectedLead({ ...selectedLead, usaFgts: true });
                          }}
                        >
                          Sim
                        </Button>
                        <Button
                          size="sm"
                          variant={selectedLead.usaFgts === false ? "default" : "outline"}
                          onClick={() => {
                            updateLeadMutation.mutate({ id: selectedLead.id, data: { usaFgts: false } });
                            setSelectedLead({ ...selectedLead, usaFgts: false });
                          }}
                        >
                          Não
                        </Button>
                      </div>
                    </div>

                    {/* CPF */}
                    <div className="space-y-2">
                      <Label htmlFor="cpf-detail">CPF</Label>
                      <Input
                        id="cpf-detail"
                        placeholder="000.000.000-00"
                        value={selectedLead.cpf || ""}
                        onChange={(e) => setSelectedLead({ ...selectedLead, cpf: e.target.value })}
                        onBlur={() => updateLeadMutation.mutate({ id: selectedLead.id, data: { cpf: selectedLead.cpf || null } })}
                      />
                    </div>

                    {/* Data de Nascimento */}
                    <div className="space-y-2">
                      <Label htmlFor="dataNascimento">Data de Nascimento</Label>
                      <Input
                        id="dataNascimento"
                        type="date"
                        value={selectedLead.dataNascimento ? new Date(selectedLead.dataNascimento).toISOString().split('T')[0] : ""}
                        onChange={(e) => setSelectedLead({ ...selectedLead, dataNascimento: e.target.value ? new Date(e.target.value) : null })}
                        onBlur={() => updateLeadMutation.mutate({ id: selectedLead.id, data: { dataNascimento: selectedLead.dataNascimento ? new Date(selectedLead.dataNascimento) : null } })}
                      />
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

                </div>
                </TabsContent>

                {/* ── ABA: COPILOT & HISTÓRICO ── */}
                <TabsContent value="copilot">
                <div className="space-y-6">

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
                        // Não fechar o modal de detalhes — mantém contexto do lead
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
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline">{tipoLabels[interaction.tipo]}</Badge>
                              <Badge variant="secondary">{resultadoLabels[interaction.resultado]}</Badge>
                              {interaction.corretorNome && (
                                <span className="text-xs text-muted-foreground font-medium">{interaction.corretorNome}</span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                              {format(new Date(interaction.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          {interaction.observacoes && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {interaction.observacoes}
                            </p>
                          )}
                          {(interaction.statusAnterior && interaction.statusNovo) && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Status: {statusLabels[interaction.statusAnterior] || interaction.statusAnterior} → {statusLabels[interaction.statusNovo] || interaction.statusNovo}
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
                </TabsContent>

                {/* ── ABA: EXECUTANDO COM IA ── */}
                <TabsContent value="ia">
                  <div className="space-y-4">
                    <IALeadPanel leadId={selectedLead.id} />
                    <div className="border-t pt-4">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Script WhatsApp com IA</p>
                      <ExecutandoComIA
                        lead={{
                          id: selectedLead.id,
                          nome: selectedLead.nome,
                          faixaRenda: selectedLead.faixaRenda,
                          origem: selectedLead.origem,
                          observacoes: selectedLead.observacoes,
                          finalidadeImovel: selectedLead.finalidadeImovel,
                          status: selectedLead.status,
                          projectId: selectedLead.projectId,
                          projetoCustom: selectedLead.projetoCustom,
                        }}
                        nomeEmpreendimento={
                          projects?.find((p: { id: number }) => p.id === selectedLead.projectId)?.nome ||
                          selectedLead.projetoCustom ||
                          undefined
                        }
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* ── ABA: SCRIPTS ── */}
                <TabsContent value="scripts">
                  <ScriptsLeadTab leadStatus={selectedLead?.status} />
                </TabsContent>
              </Tabs>
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
                <Label htmlFor="motivo">Categoria da Perda *</Label>
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
                    <SelectItem value="mudou_planos">Mudou de Planos</SelectItem>
                    <SelectItem value="sem_entrada">Sem Entrada / Sem Recurso Próprio</SelectItem>
                    <SelectItem value="outro">Outro Motivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="outro-motivo">
                  {motivoPerdido === 'outro' ? 'Especifique o Motivo *' : 'Observações (opcional)'}
                </Label>
                <Textarea
                  id="outro-motivo"
                  placeholder={motivoPerdido === 'outro' ? 'Descreva o motivo da perda...' : 'Detalhes adicionais...'}
                  value={outroMotivo}
                  onChange={(e) => setOutroMotivo(e.target.value)}
                  rows={3}
                />
              </div>
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
                    await executeStatusUpdate(
                      pendingLossChange.leadId,
                      'perdido',
                      undefined,
                      outroMotivo.trim() || undefined,
                      motivoPerdido,
                    );
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
                  <Input
                    type="date"
                    value={agendamentoForm.dataAgendamento}
                    onChange={(e) => setAgendamentoForm(prev => ({ ...prev, dataAgendamento: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hora</Label>
                  <Input
                    type="time"
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
                disabled={createAgendamentoMutation.isPending}
                className="gap-2"
              >
                {createAgendamentoMutation.isPending ? (
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
      
      {/* Popup urgente para leads Facebook Ads — movido para CorretorNotifications (App.tsx) */}
      
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

      {/* AlertDialog para confirmação de alteração de status em massa */}
      <AlertDialog
        open={bulkStatusDialog.open}
        onOpenChange={(open) => !open && setBulkStatusDialog({ open: false, novoStatus: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar status em massa</AlertDialogTitle>
            <AlertDialogDescription>
              Alterar {selectedLeadIds.length} lead{selectedLeadIds.length !== 1 ? 's' : ''} para{' '}
              <strong>"{statusLabels[bulkStatusDialog.novoStatus ?? ''] ?? bulkStatusDialog.novoStatus}"</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (bulkStatusDialog.novoStatus) {
                  bulkUpdateStatusMutation.mutate({ ids: selectedLeadIds, novoStatus: bulkStatusDialog.novoStatus as any });
                }
                setBulkStatusDialog({ open: false, novoStatus: null });
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

function IALeadPanel({ leadId }: { leadId: number }) {
  const [abaAtiva, setAbaAtiva] = useState<"resumo" | "acao" | "temperatura">("resumo");

  const resumoQuery = trpc.ia.resumoLead.useQuery({ leadId }, { enabled: abaAtiva === "resumo", staleTime: 5 * 60_000 });
  const acaoQuery = trpc.ia.sugestaoProximaAcao.useQuery({ leadId }, { enabled: abaAtiva === "acao", staleTime: 5 * 60_000 });
  const [tempResult, setTempResult] = useState<{ temperatura: string; confianca: string; motivo: string } | null>(null);
  const classificarMutation = trpc.ia.classificarTemperatura.useMutation({
    onSuccess: (data) => setTempResult(data),
  });

  const URGENCIA_COLORS: Record<string, string> = {
    imediata: "text-red-600 font-semibold",
    hoje: "text-orange-500 font-semibold",
    essa_semana: "text-yellow-600",
  };
  const TEMP_COLORS: Record<string, string> = {
    quente: "text-red-500",
    morno: "text-orange-400",
    frio: "text-blue-500",
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 border-b pb-2">
        {(["resumo", "acao", "temperatura"] as const).map((aba) => (
          <button
            key={aba}
            onClick={() => setAbaAtiva(aba)}
            className={`text-xs px-3 py-1 rounded-full transition-colors ${abaAtiva === aba ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            {aba === "resumo" ? "📋 Resumo" : aba === "acao" ? "⚡ Próxima Ação" : "🌡️ Temperatura"}
          </button>
        ))}
      </div>

      {abaAtiva === "resumo" && (
        <div className="space-y-3">
          {resumoQuery.isLoading && <p className="text-sm text-muted-foreground text-center py-6 animate-pulse">Gerando resumo com IA...</p>}
          {resumoQuery.error && <p className="text-sm text-red-500 text-center py-4">{resumoQuery.error.message}</p>}
          {resumoQuery.data && (
            <>
              <div className="bg-muted/40 rounded-lg p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Resumo</p>
                <p className="text-sm leading-relaxed">{resumoQuery.data.resumo}</p>
              </div>
              {resumoQuery.data.pontosCriticos.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pontos Críticos</p>
                  <ul className="space-y-1">
                    {resumoQuery.data.pontosCriticos.map((p, i) => (
                      <li key={i} className="text-sm flex items-start gap-2"><span className="text-amber-500 mt-0.5">⚠</span>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Próximo Follow-up</p>
                <p className="text-sm">{resumoQuery.data.proximoFollowup}</p>
              </div>
            </>
          )}
        </div>
      )}

      {abaAtiva === "acao" && (
        <div className="space-y-3">
          {acaoQuery.isLoading && <p className="text-sm text-muted-foreground text-center py-6 animate-pulse">Analisando histórico...</p>}
          {acaoQuery.error && <p className="text-sm text-red-500 text-center py-4">{acaoQuery.error.message}</p>}
          {acaoQuery.data && (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold">{acaoQuery.data.acao}</span>
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{acaoQuery.data.canal}</span>
                <span className={`text-xs ${URGENCIA_COLORS[acaoQuery.data.urgencia] || ""}`}>{acaoQuery.data.urgencia?.replace("_", " ")}</span>
              </div>
              <p className="text-xs text-muted-foreground italic">{acaoQuery.data.justificativa}</p>
              {acaoQuery.data.script && (
                <div className="bg-muted/40 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Script sugerido</p>
                    <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => navigator.clipboard.writeText(acaoQuery.data!.script).then(() => toast.success("Copiado!"))}>
                      <Copy className="h-3 w-3" />Copiar
                    </Button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{acaoQuery.data.script}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {abaAtiva === "temperatura" && (
        <div className="space-y-3">
          {!tempResult && !classificarMutation.isPending && (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-muted-foreground">A IA irá analisar o histórico e perfil do lead para classificar a temperatura.</p>
              <Button size="sm" onClick={() => classificarMutation.mutate({ leadId, salvar: false })}>
                🌡️ Classificar com IA
              </Button>
            </div>
          )}
          {classificarMutation.isPending && <p className="text-sm text-muted-foreground text-center py-6 animate-pulse">Analisando lead...</p>}
          {classificarMutation.error && <p className="text-sm text-red-500 text-center py-4">{classificarMutation.error.message}</p>}
          {tempResult && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className={`text-2xl font-bold capitalize ${TEMP_COLORS[tempResult.temperatura] || ""}`}>{tempResult.temperatura}</span>
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full">confiança: {tempResult.confianca}</span>
              </div>
              <p className="text-sm text-muted-foreground">{tempResult.motivo}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => classificarMutation.mutate({ leadId, salvar: true })} disabled={classificarMutation.isPending}>
                  Salvar no lead
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setTempResult(null); classificarMutation.reset(); }}>
                  Reclassificar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Map lead status → script category for contextual pre-filtering
const STATUS_CATEGORIA_MAP: Record<string, string> = {
  novo: "primeiro_contato",
  aguardando_atendimento: "primeiro_contato",
  em_atendimento: "primeiro_contato",
  agendado: "agendamento",
  visita_realizada: "pos_visita",
  analise_credito: "objecao_credito",
  contrato_fechado: "fechamento",
  perdido: "reativacao",
};

function ScriptsLeadTab({ leadStatus }: { leadStatus?: string }) {
  const categoriaContexto = leadStatus ? STATUS_CATEGORIA_MAP[leadStatus] : undefined;
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>(categoriaContexto || "todas");
  const [busca, setBusca] = useState("");

  const { data: scripts = [], isLoading } = trpc.scripts.list.useQuery({});

  function copiar(conteudo: string) {
    navigator.clipboard.writeText(conteudo).then(() => {
      toast.success("Script copiado!");
    }).catch(() => {
      toast.error("Não foi possível copiar automaticamente");
    });
  }

  const CATEGORIA_LABELS: Record<string, string> = {
    primeiro_contato: "Primeiro Contato",
    agendamento: "Agendamento",
    pos_visita: "Pós-visita",
    objecao_preco: "Objeção: Preço",
    objecao_documentacao: "Objeção: Doc.",
    objecao_credito: "Objeção: Crédito",
    nao_compareceu: "Não Compareceu",
    reativacao: "Reativação",
    fechamento: "Fechamento",
    outro: "Outro",
  };

  const categorias = ["todas", ...Object.keys(CATEGORIA_LABELS)];

  const filtrados = scripts.filter((s: any) => {
    const matchCategoria = categoriaSelecionada === "todas" || s.categoria === categoriaSelecionada;
    const matchBusca = !busca || s.titulo.toLowerCase().includes(busca.toLowerCase()) || s.conteudo.toLowerCase().includes(busca.toLowerCase());
    return matchCategoria && matchBusca;
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-32">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Buscar..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={categoriaSelecionada} onValueChange={setCategoriaSelecionada}>
          <SelectTrigger className="w-auto h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            {Object.entries(CATEGORIA_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {categoriaContexto && categoriaSelecionada !== "todas" && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <BookOpen className="h-3 w-3" />
          Scripts sugeridos para o status atual: <strong>{CATEGORIA_LABELS[categoriaContexto]}</strong>
        </p>
      )}
      {isLoading && <p className="text-sm text-muted-foreground py-4 text-center">Carregando scripts...</p>}
      {!isLoading && filtrados.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">Nenhum script encontrado</p>
      )}
      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
        {filtrados.map((script: any) => (
          <div key={script.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{script.titulo}</p>
                <p className="text-xs text-muted-foreground">{CATEGORIA_LABELS[script.categoria] || script.categoria}</p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => copiar(script.conteudo)}>
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{script.conteudo}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
