import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import ModalOnboardingObrigatorio from "@/components/ModalOnboardingObrigatorio";
import { TimezoneFooter } from "@/components/TimezoneFooter";
import { 
  LayoutDashboard, LogOut, PanelLeft, Users, Building2, UserCircle, 
  BarChart3, Settings, FileSpreadsheet, Users2, TrendingUp, Bell, 
  Kanban, Target, Shuffle, History, BookOpen, ClipboardList, Trophy, 
  UserCheck, UserX, Circle, Trash2, ChevronDown, Tv, FolderOpen,
  UserCog, Import, Home, Clock, CalendarCheck, Sun, Moon, Calendar,
  FileText, MessageCircle, Link2, Activity, Lock, ArrowRightLeft, Database, Trash,
  Shield, Briefcase, Calculator, Phone, DollarSign, Zap, AlertTriangle, Bot
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import NotificationListener from "./NotificationListener";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { useFollowUpProgress } from "@/hooks/useFollowUpProgress";
import { LockedTabOverlay } from "./LockedTabOverlay";
import { ModalAgendaDia } from "@/components/ModalAgendaDia";
import { ModalAgendaGestor } from "@/components/ModalAgendaGestor";
import { ContadorLeadsFacebook } from "@/components/ContadorLeadsFacebook";
import { useSolicitarPermissaoNotificacao } from "@/hooks/useNotificacaoLead";
import { PushNotificationBanner } from "@/components/PushNotificationBanner";
import { useLeadEvents } from "@/hooks/useLeadEvents";

// Estrutura de menu agrupado
const menuGroups = [
  {
    id: "inicio",
    label: "Início",
    icon: Home,
    items: [
      { icon: BookOpen, label: "Boas-Vindas", path: "/boas-vindas" },
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
      { icon: ClipboardList, label: "Tarefas do Dia", path: "/tarefas-do-dia", roles: ["corretor"], showAlert: true },
    ],
  },
  {
    id: "leads",
    label: "Leads",
    icon: Users,
    items: [
      { icon: Users, label: "Meus Leads", path: "/leads" },
      { icon: Shield, label: "Carteira Ativa", path: "/carteira-ativa" },
      { icon: Kanban, label: "Kanban", path: "/kanban" },
      { icon: CalendarCheck, label: "Agendamentos", path: "/agendamentos" },
      { icon: Calendar, label: "Minha Agenda", path: "/minha-agenda", roles: ["corretor"] },
      { icon: FileText, label: "Propostas", path: "/propostas" },
      { icon: Users, label: "Leads por Corretor", path: "/leads-por-corretor", roles: ["gestor", "admin", "superintendente"] },
      { icon: Calendar, label: "Calendário Geral", path: "/calendario-gestor", roles: ["admin", "superintendente"] },
      { icon: Bell, label: "Notificações", path: "/notificacoes", roles: ["user", "corretor"], showBadge: true },
      { icon: Zap, label: "Modo Blitz", path: "/modo-blitz", roles: ["corretor"] },
      { icon: BookOpen, label: "Scripts de Vendas", path: "/scripts" },
    ],
  },
  {
    id: "projetos",
    label: "Projetos",
    icon: Building2,
    items: [
      { icon: Building2, label: "Catálogo", path: "/projetos" },
      { icon: Bot, label: "Buscador IA", path: "/buscador-projetos" },
      { icon: Import, label: "Importar Projetos", path: "/importar-projetos", roles: ["gestor", "admin", "superintendente"] },
      { icon: FileText, label: "Tabelões", path: "/gerenciar-tabeloes", roles: ["gestor", "admin", "superintendente"] },
      { icon: UserCheck, label: "Aprovar Projetos", path: "/aprovar-projetos", roles: ["gestor", "admin", "superintendente"] },
    ],
  },
  {
    id: "meu-negocio",
    label: "Meu Negócio",
    icon: Briefcase,
    roles: ["corretor", "gestor", "admin", "superintendente"],
    items: [
      { icon: LayoutDashboard, label: "Meu Dashboard", path: "/meu-negocio/dashboard", roles: ["corretor"] },
      { icon: Phone, label: "Follow-up", path: "/meu-negocio/followup", roles: ["corretor"] },
      { icon: Calculator, label: "Pré-Análise MCMV", path: "/meu-negocio/pre-analise", roles: ["corretor"] },
      { icon: TrendingUp, label: "Minha Evolução", path: "/meu-negocio/evolucao", roles: ["corretor"] },
      { icon: Zap, label: "Modo Foco", path: "/meu-negocio/foco", roles: ["corretor"] },
      { icon: BookOpen, label: "Como Avaliar", path: "/meu-negocio/como-avaliar", roles: ["corretor"] },
      { icon: DollarSign, label: "Minhas Comissões", path: "/comissoes", roles: ["corretor"] },
      { icon: ClipboardList, label: "Meu Painel", path: "/meu-painel", roles: ["corretor", "gestor", "admin", "superintendente"] },
    ],
  },
  {
    id: "performance",
    label: "Performance",
    icon: TrendingUp,
    items: [
      { icon: Trophy, label: "Conquistas", path: "/meu-perfil" },
      // Corretor acessa seu painel unificado
      { icon: BarChart3, label: "Meu Painel", path: "/meu-painel", roles: ["corretor"] },
      // Gestor e Admin acessam ranking do time / geral
      { icon: Trophy, label: "Corrida dos Campeões", path: "/ranking-tv", roles: ["gestor", "admin", "superintendente"] },
      { icon: Tv, label: "Performance TV", path: "/performance-tv", roles: ["gestor", "admin", "superintendente"] },
      { icon: Target, label: "Metas Mensais", path: "/metas", roles: ["admin", "superintendente"] },
      { icon: Target, label: "Metas Diárias", path: "/metas-diarias", roles: ["admin", "superintendente"] },
    ],
  },
  {
    id: "gestao",
    label: "Gestão",
    icon: UserCog,
    roles: ["gestor", "admin", "superintendente"],
    items: [
      { icon: Users, label: "Minha Equipe", path: "/minha-equipe", roles: ["gestor"] },
      { icon: AlertTriangle, label: "Central de Alertas", path: "/central-alertas", roles: ["gestor", "admin", "superintendente"] },
      { icon: Activity, label: "Monitoramento Follow-ups", path: "/monitoramento-followups", roles: ["gestor", "admin", "superintendente"] },
      { icon: Users2, label: "Corretores", path: "/corretores", roles: ["gestor", "admin", "superintendente"] },
      { icon: Users, label: "Gestão de Equipes", path: "/gestao-equipes", roles: ["admin", "superintendente"] },
      { icon: UserCircle, label: "Distribuição", path: "/controle-distribuicao", roles: ["admin"] },
      { icon: Target, label: "Controle de Limites", path: "/controle-limites", roles: ["admin"] },
      { icon: Shuffle, label: "Roleta de Leads", path: "/roleta", roles: ["admin"] },
      { icon: Target, label: "Projeto Foco do Mês", path: "/projeto-foco", roles: ["admin"] },
      { icon: History, label: "Histórico", path: "/historico-distribuicao", roles: ["admin"] },
      { icon: FileSpreadsheet, label: "Importar Leads", path: "/importar-sheets", roles: ["admin"] },
      { icon: Trash2, label: "Lixeira", path: "/lixeira", roles: ["admin"] },
      { icon: TrendingUp, label: "Comissões", path: "/comissoes", roles: ["corretor", "gestor", "admin", "superintendente"] },
      { icon: Settings, label: "Templates de Comissão", path: "/templates-comissao", roles: ["admin"] },
    ],
  },
  {
    id: "config",
    label: "Sistema",
    icon: Settings,
    items: [
      { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
      { icon: FileSpreadsheet, label: "Google Sheets", path: "/google-sheets-sync", roles: ["gestor", "admin", "superintendente"] },
      { icon: Database, label: "Sincronização BI", path: "/sincronizacao-bi", roles: ["gestor", "admin", "superintendente"] },
      { icon: Trash, label: "Limpeza de Duplicatas", path: "/limpeza-duplicatas", roles: ["admin"] },
      { icon: Database, label: "Atualizar Projetos", path: "/atualizar-projetos", roles: ["admin"] },
      { icon: Trash, label: "Limpar Projetos Órfãos", path: "/limpar-projetos", roles: ["admin"] },
      { icon: Settings, label: "Configurações", path: "/configuracoes" },
      { icon: FileText, label: "Log de Transferências", path: "/log-transferencias", roles: ["admin"] },
    ],
  },
];

// Menu simplificado para corretores — 4 grupos, ~13 itens
const menuGroupsCorretor = [
  {
    id: "inicio",
    label: "Início",
    icon: Home,
    items: [
      { icon: Home, label: "Início", path: "/meu-painel" },
      { icon: ClipboardList, label: "Tarefas do Dia", path: "/tarefas-do-dia", showAlert: true },
    ],
  },
  {
    id: "leads",
    label: "Leads",
    icon: Users,
    items: [
      { icon: Users, label: "Meus Leads", path: "/leads", showLeadsBadge: true },
      { icon: CalendarCheck, label: "Agendamentos", path: "/agendamentos" },
      { icon: Calendar, label: "Minha Agenda", path: "/minha-agenda" },
      { icon: FileText, label: "Propostas", path: "/propostas" },
      { icon: BookOpen, label: "Scripts de Vendas", path: "/scripts" },
    ],
  },
  {
    id: "trabalho",
    label: "Trabalho",
    icon: Zap,
    items: [
      { icon: Zap, label: "Modo Blitz", path: "/modo-blitz" },
      { icon: Bell, label: "Notificações", path: "/notificacoes", showBadge: true },
    ],
  },
  {
    id: "meu-negocio",
    label: "Meu Negócio",
    icon: Briefcase,
    items: [
      { icon: Phone, label: "Follow-up", path: "/meu-negocio/followup" },
      { icon: DollarSign, label: "Minhas Comissões", path: "/comissoes" },
      { icon: Calculator, label: "Pré-Análise MCMV", path: "/meu-negocio/pre-analise" },
      { icon: Building2, label: "Catálogo", path: "/projetos" },
      { icon: Bot, label: "Buscador IA", path: "/buscador-projetos" },
    ],
  },
];

// Menu simplificado para gestores — 5 grupos, ~14 itens
const menuGroupsGestor = [
  {
    id: "inicio",
    label: "Início",
    icon: Home,
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", showAlertasBadge: true },
      { icon: AlertTriangle, label: "Central de Alertas", path: "/central-alertas", showAlertasBadge: true },
    ],
  },
  {
    id: "equipe",
    label: "Minha Equipe",
    icon: Users2,
    items: [
      { icon: Users2, label: "Minha Equipe", path: "/minha-equipe" },
      { icon: Users, label: "Leads por Corretor", path: "/leads-por-corretor" },
      { icon: Activity, label: "Monitoramento Follow-ups", path: "/monitoramento-followups" },
    ],
  },
  {
    id: "leads",
    label: "Leads",
    icon: Users,
    items: [
      { icon: Users, label: "Todos os Leads", path: "/leads" },
      { icon: CalendarCheck, label: "Agendamentos", path: "/agendamentos" },
      { icon: BookOpen, label: "Scripts de Vendas", path: "/scripts" },
    ],
  },
  {
    id: "desempenho",
    label: "Desempenho",
    icon: TrendingUp,
    items: [
      { icon: ClipboardList, label: "Meu Painel", path: "/meu-painel" },
      { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
      { icon: TrendingUp, label: "Comissões", path: "/comissoes" },
    ],
  },
  {
    id: "operacoes",
    label: "Operações",
    icon: Building2,
    items: [
      { icon: Building2, label: "Catálogo", path: "/projetos" },
      { icon: Bot, label: "Buscador IA", path: "/buscador-projetos" },
      { icon: Import, label: "Importar Projetos", path: "/importar-projetos" },
      { icon: FileText, label: "Tabelões", path: "/gerenciar-tabeloes" },
      { icon: UserCheck, label: "Aprovar Projetos", path: "/aprovar-projetos" },
      { icon: Settings, label: "Configurações", path: "/configuracoes" },
    ],
  },
];

// Menu para admin e superintendente — 5 grupos, ~18 itens
const menuGroupsAdmin = [
  {
    id: "inicio",
    label: "Início",
    icon: Home,
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", showAlertasBadge: true },
      { icon: AlertTriangle, label: "Central de Alertas", path: "/central-alertas", showAlertasBadge: true },
    ],
  },
  {
    id: "leads-equipes",
    label: "Leads & Equipes",
    icon: Users,
    items: [
      { icon: Users, label: "Todos os Leads", path: "/leads" },
      { icon: Users, label: "Leads por Corretor", path: "/leads-por-corretor" },
      { icon: CalendarCheck, label: "Agendamentos", path: "/agendamentos" },
      { icon: Calendar, label: "Calendário Geral", path: "/calendario-gestor" },
      { icon: Users2, label: "Corretores", path: "/corretores" },
      { icon: UserCog, label: "Gestão de Equipes", path: "/gestao-equipes" },
      { icon: Activity, label: "Monitoramento Follow-ups", path: "/monitoramento-followups" },
    ],
  },
  {
    id: "distribuicao",
    label: "Distribuição",
    icon: Shuffle,
    items: [
      { icon: Shuffle, label: "Roleta de Leads", path: "/roleta" },
      { icon: Target, label: "Projeto Foco", path: "/projeto-foco" },
      { icon: UserCircle, label: "Controle Distribuição", path: "/controle-distribuicao" },
      { icon: Target, label: "Controle de Limites", path: "/controle-limites" },
      { icon: History, label: "Histórico Distribuição", path: "/historico-distribuicao" },
    ],
  },
  {
    id: "desempenho",
    label: "Desempenho",
    icon: TrendingUp,
    items: [
      { icon: Trophy, label: "Ranking TV", path: "/ranking-tv" },
      { icon: Tv, label: "Performance TV", path: "/performance-tv" },
      { icon: Target, label: "Metas Mensais", path: "/metas" },
      { icon: Target, label: "Metas Diárias", path: "/metas-diarias" },
      { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
      { icon: TrendingUp, label: "Comissões", path: "/comissoes" },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    icon: Settings,
    items: [
      { icon: Building2, label: "Catálogo", path: "/projetos" },
      { icon: Import, label: "Importar Leads", path: "/importar-sheets" },
      { icon: FileSpreadsheet, label: "Google Sheets", path: "/google-sheets-sync" },
      { icon: Database, label: "Sincronização BI", path: "/sincronizacao-bi" },
      { icon: Settings, label: "Templates Comissão", path: "/templates-comissao" },
      { icon: Trash2, label: "Lixeira", path: "/lixeira" },
      { icon: Settings, label: "Configurações", path: "/configuracoes" },
    ],
  },
];

// Menu para superintendente — visão da equipe, sem distribuição ou sistema
// Hierarquia: ADMIN → SUPT → Gestores → Corretores
const menuGroupsSuperintendente = [
  {
    id: "inicio",
    label: "Início",
    icon: Home,
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", showAlertasBadge: true },
      { icon: AlertTriangle, label: "Central de Alertas", path: "/central-alertas", showAlertasBadge: true },
    ],
  },
  {
    id: "equipe",
    label: "Minha Equipe",
    icon: Users2,
    items: [
      { icon: UserCog, label: "Gestão de Equipes", path: "/gestao-equipes" },
      { icon: Users2, label: "Corretores", path: "/corretores" },
      { icon: Users, label: "Leads por Corretor", path: "/leads-por-corretor" },
      { icon: Activity, label: "Monitoramento Follow-ups", path: "/monitoramento-followups" },
    ],
  },
  {
    id: "leads",
    label: "Leads",
    icon: Users,
    items: [
      { icon: Users, label: "Todos os Leads", path: "/leads" },
      { icon: CalendarCheck, label: "Agendamentos", path: "/agendamentos" },
      { icon: Calendar, label: "Calendário Geral", path: "/calendario-gestor" },
    ],
  },
  {
    id: "desempenho",
    label: "Desempenho",
    icon: TrendingUp,
    items: [
      { icon: Trophy, label: "Ranking TV", path: "/ranking-tv" },
      { icon: Tv, label: "Performance TV", path: "/performance-tv" },
      { icon: Target, label: "Metas Mensais", path: "/metas" },
      { icon: Target, label: "Metas Diárias", path: "/metas-diarias" },
      { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
      { icon: TrendingUp, label: "Comissões", path: "/comissoes" },
    ],
  },
  {
    id: "projetos",
    label: "Projetos",
    icon: Building2,
    items: [
      { icon: Building2, label: "Catálogo", path: "/projetos" },
      { icon: Bot, label: "Buscador IA", path: "/buscador-projetos" },
      { icon: UserCheck, label: "Aprovar Projetos", path: "/aprovar-projetos" },
    ],
  },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const MENU_GROUPS_KEY = "menu-groups-state";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

// Componente de toggle de tema
function ThemeToggle() {
  const { theme, toggleTheme, switchable } = useTheme();
  
  if (!switchable || !toggleTheme) return null;
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="h-9 w-9 rounded-lg"
      title={theme === 'light' ? 'Ativar Modo Noturno' : 'Ativar Modo Claro'}
    >
      {theme === 'light' ? (
        <Moon className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
      ) : (
        <Sun className="h-5 w-5 text-amber-400 hover:text-amber-300 transition-colors" />
      )}
    </Button>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  // Solicitar permissão de notificação do navegador ao entrar no sistema
  useSolicitarPermissaoNotificacao();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Acesso Restrito
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Faça login para continuar acessando o sistema.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Entrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <DashboardContent sidebarWidth={sidebarWidth} setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardContent>
    </SidebarProvider>
  );
}

// Componente para badge de notificações
function NotificationBadge() {
  const { data: count } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000, // 5 minutos (reduzido de 60s — badge de notificações não precisa de polling agressivo)
    refetchOnWindowFocus: true,
    staleTime: 2 * 60 * 1000,
  });
  
  if (!count || count === 0) return null;
  
  return (
    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
      {count > 9 ? '9+' : count}
    </span>
  );
}

function LeadsActionsBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
      {count > 9 ? '9+' : count}
    </span>
  );
}

function AlertasBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-medium text-white">
      {count > 9 ? '9+' : count}
    </span>
  );
}

function DashboardContent({
  children,
  sidebarWidth,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
}) {
  const { user, isLoading: authLoading } = useAuth();
  const [location, setLocation] = useLocation();
  // Sistema de bloqueio gamificado
  const { total, concluidos, percentual, desbloqueado, showPlusOne, escolhaDiariaFeita, aceitouFollowUp, refetch: refetchFollowUp } = useFollowUpProgress();

  // SSE — recebe evento imediato quando um lead é distribuído para este corretor
  useLeadEvents();

  // Verificar se o perfil está completo (para priorizar bloqueio de onboarding sobre follow-up)
  const { data: verificacaoOnboarding } = trpc.onboarding.verificar.useQuery(undefined, {
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
  const perfilIncompleto = verificacaoOnboarding && !verificacaoOnboarding.completo && verificacaoOnboarding.user?.role !== 'admin' && verificacaoOnboarding.user?.role !== 'superintendente';

  // Leads prioritários para badge, banner e modal agenda
  // SSE invalida a query instantaneamente; 30s é apenas fallback para quando a conexão cai
  const { data: leadsPrioritarios } = trpc.dashboard.leadsPrioritarios.useQuery(undefined, {
    enabled: user?.role === 'corretor',
    refetchInterval: 30 * 1000,
    staleTime: 0,
  });
  const totalAcoesLeads = (leadsPrioritarios?.followUpsVencidos?.length ?? 0) +
    (leadsPrioritarios?.leadsQuentes?.length ?? 0) +
    (leadsPrioritarios?.semPrimeiroContato?.length ?? 0);
  const leadsAguardandoCount = leadsPrioritarios?.semPrimeiroContato?.length ?? 0;
  const agendamentosHojeCount = leadsPrioritarios?.agendamentosHoje?.length ?? 0;

  // Estado localStorage para modal agenda diária
  const [agendaDiariaFeitaHoje, setAgendaDiariaFeitaHoje] = useState(() => {
    if (!user?.id) return false;
    const today = new Date().toISOString().split('T')[0];
    return localStorage.getItem(`agendaDia:${user.id}:${today}`) !== null;
  });
  const marcarAgendaDiariaFeita = () => {
    const today = new Date().toISOString().split('T')[0];
    if (user?.id) localStorage.setItem(`agendaDia:${user.id}:${today}`, '1');
    setAgendaDiariaFeitaHoje(true);
  };

  // Estado sessionStorage para dispensar banner de lead aguardando
  const [bannersDispensados, setBannersDispensados] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem('bannersDispensados') || '[]')); } catch { return new Set(); }
  });
  const dispensarBanner = (leadId: number) => {
    const next = new Set(bannersDispensados).add(leadId);
    setBannersDispensados(next);
    sessionStorage.setItem('bannersDispensados', JSON.stringify([...next]));
  };
  const atenderLeadMutation = trpc.leads.update.useMutation({
    onSuccess: (_, variables) => {
      utils.dashboard.leadsPrioritarios.invalidate();
      setLocation(`/leads?leadId=${variables.id}`);
    },
    onError: () => toast.error("Erro ao iniciar atendimento"),
  });
  const primeiroLeadAguardando = leadsPrioritarios?.semPrimeiroContato?.find(
    (l) => !bannersDispensados.has(l.id)
  );

  const { state: sidebarState } = useSidebar();
  const isCollapsed = sidebarState === "collapsed";
  const isMobile = useIsMobile();
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const utils = trpc.useUtils();
  
  // Estado dos grupos abertos/fechados
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem(MENU_GROUPS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Todas as abas fechadas por padrão
        return {};
      }
    }
    // Todas as abas fechadas por padrão
    return {};
  });

  // Salvar estado dos grupos no localStorage
  useEffect(() => {
    localStorage.setItem(MENU_GROUPS_KEY, JSON.stringify(openGroups));
  }, [openGroups]);

  // Auto-abrir grupo que contém o item ativo quando a rota muda
  useEffect(() => {
    const role = user?.role || "";
    const groups = role === 'corretor' ? menuGroupsCorretor
      : role === 'gestor' ? menuGroupsGestor
      : role === 'admin' ? menuGroupsAdmin
      : role === 'superintendente' ? menuGroupsSuperintendente
      : menuGroups;
    for (const group of groups) {
      const items = group.items.filter(item =>
        !(item as any).roles || (item as any).roles.includes(role)
      );
      if (items.some(item => item.path === location)) {
        setOpenGroups(prev => prev[group.id] ? prev : { ...prev, [group.id]: true });
        break;
      }
    }
  }, [location, user?.role]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Buscar status do corretor (polling a cada 2 min — reduzido de 30s para economizar recursos)
  const { data: corretorStatus } = trpc.corretores.meuStatus.useQuery(undefined, {
    enabled: user?.role === 'corretor',
    refetchInterval: 2 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  // Função para tocar som ao mudar status — reutiliza AudioContext singleton para evitar memory leak
  const playStatusSound = useCallback((isPresente: boolean) => {
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const audioContext = audioContextRef.current;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = isPresente ? 880 : 440;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.log('Som não suportado');
    }
  }, []);

  // Mutation para alterar status
  const alterarStatusMutation = trpc.corretores.alterarMeuStatus.useMutation({
    onMutate: async (newStatus) => {
      await utils.corretores.meuStatus.cancel();
      const previousStatus = utils.corretores.meuStatus.getData();
      const novoStatusVisual = newStatus.status === 'ativo' ? 'presente' : 'ausente';
      utils.corretores.meuStatus.setData(undefined, (old) => ({
        ...old,
        status: novoStatusVisual as 'presente' | 'ausente',
        name: old?.name || '',
      }));
      return { previousStatus };
    },
    onSuccess: (data) => {
      const isPresente = data.status === 'presente';
      playStatusSound(isPresente);
      toast.success(isPresente ? '✅ Você está PRESENTE e receberá leads!' : '⏸️ Você está AUSENTE e não receberá leads.');
      utils.corretores.meuStatus.invalidate();
    },
    onError: (err, newStatus, context) => {
      if (context?.previousStatus) {
        utils.corretores.meuStatus.setData(undefined, context.previousStatus);
      }
      toast.error('Erro ao alterar status. Tente novamente.');
    },
  });

  const isCorretor = user?.role === 'corretor';
  const isAtivo = corretorStatus?.status === 'presente';

  const handleToggleStatus = () => {
    const novoStatus = isAtivo ? 'inativo' : 'ativo';
    alterarStatusMutation.mutate({ status: novoStatus });
  };

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  // Alertas da equipe (para badge no menu de gestores)
  const isGestorOuSuperior = user?.role === 'gestor' || user?.role === 'admin' || user?.role === 'superintendente';
  const { data: alertasGestor } = trpc.alertasGestor.lista.useQuery(undefined, {
    enabled: isGestorOuSuperior,
    refetchInterval: 3 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });
  const totalAlertasEquipe = isGestorOuSuperior ? (
    (alertasGestor?.followUpsVencidos?.length ?? 0) +
    (alertasGestor?.corretoresSemAtividade?.length ?? 0) +
    (alertasGestor?.leadsSemPrimeiroContato?.length ?? 0)
  ) : 0;

  // Agenda do gestor — localStorage flag para modal matinal
  const [agendaGestorFeitaHoje, setAgendaGestorFeitaHoje] = useState(() => {
    if (!user?.id || !isGestorOuSuperior) return true;
    const today = new Date().toISOString().split('T')[0];
    return localStorage.getItem(`agendaGestor:${user.id}:${today}`) !== null;
  });
  const marcarAgendaGestorFeita = () => {
    const today = new Date().toISOString().split('T')[0];
    if (user?.id) localStorage.setItem(`agendaGestor:${user.id}:${today}`, '1');
    setAgendaGestorFeitaHoje(true);
  };

  // Filtrar grupos baseado no role do usuário
  // Hierarquia: ADMIN (tudo) → SUPTD (equipe, sem distribuição/sistema) → gestor → corretor
  const activeMenuGroups = isCorretor
    ? menuGroupsCorretor
    : user?.role === 'gestor'
    ? menuGroupsGestor
    : user?.role === 'admin'
    ? menuGroupsAdmin
    : user?.role === 'superintendente'
    ? menuGroupsSuperintendente
    : menuGroups;
  const filteredGroups = activeMenuGroups.filter(group => {
    if ((group as any).roles && !(group as any).roles.includes(user?.role || "")) {
      return false;
    }
    // Verificar se há pelo menos um item visível no grupo
    const visibleItems = group.items.filter(item =>
      !(item as any).roles || (item as any).roles.includes(user?.role || "")
    );
    return visibleItems.length > 0;
  });

  return (
    <>
      <NotificationListener />
      <Sidebar
        ref={sidebarRef}
        collapsible="icon"
        style={
          {
            "--sidebar-width": `${sidebarWidth}px`,
            "--sidebar-width-icon": "52px",
          } as CSSProperties
        }
      >
        <SidebarHeader className="p-3 border-b">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <img
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/nYdEnBpdRXDVWsgt.png"
                alt="Seu Metro Quadrado"
                className="h-8 w-8 object-contain"
              />
              {!isCollapsed && (
                <span className="font-semibold text-foreground text-sm">Seu m²</span>
              )}
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="gap-0 overflow-y-auto">
          {/* Botão de Presença/Ausência para Corretores */}
          {isCorretor && !isCollapsed && (
            <div className="px-3 py-2">
              <button
                onClick={handleToggleStatus}
                disabled={alterarStatusMutation.isPending}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg transition-all ${
                  isAtivo 
                    ? 'bg-green-500/10 hover:bg-green-500/20 border border-green-500/30' 
                    : 'bg-red-500/10 hover:bg-red-500/20 border border-red-500/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isAtivo ? (
                    <UserCheck className="h-4 w-4 text-green-600" />
                  ) : (
                    <UserX className="h-4 w-4 text-red-600" />
                  )}
                  <span className={`text-sm font-medium ${isAtivo ? 'text-green-700' : 'text-red-700'}`}>
                    {isAtivo ? 'PRESENTE' : 'AUSENTE'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Circle className={`h-2 w-2 ${isAtivo ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'} animate-pulse`} />
                  <span className="text-xs text-muted-foreground">
                    {isAtivo ? 'Recebendo leads' : 'Sem leads'}
                  </span>
                </div>
              </button>
              <p className="text-[10px] text-muted-foreground text-center mt-1">
                Clique para {isAtivo ? 'pausar' : 'ativar'} recebimento
              </p>
            </div>
          )}

          {/* Botão compacto quando sidebar está colapsada */}
          {isCorretor && isCollapsed && (
            <div className="px-2 py-2">
              <button
                onClick={handleToggleStatus}
                disabled={alterarStatusMutation.isPending}
                className={`w-full flex items-center justify-center p-2 rounded-lg transition-all ${
                  isAtivo 
                    ? 'bg-green-500/10 hover:bg-green-500/20' 
                    : 'bg-red-500/10 hover:bg-red-500/20'
                }`}
                title={isAtivo ? 'PRESENTE - Clique para ficar ausente' : 'AUSENTE - Clique para ficar presente'}
              >
                {isAtivo ? (
                  <UserCheck className="h-5 w-5 text-green-600" />
                ) : (
                  <UserX className="h-5 w-5 text-red-600" />
                )}
              </button>
            </div>
          )}

          {/* Menu Agrupado */}
          <div className="px-2 py-1 space-y-1">
            {filteredGroups.map((group) => {
              const visibleItems = group.items.filter(item =>
                !(item as any).roles || (item as any).roles.includes(user?.role || "")
              );
              const hasActiveItem = visibleItems.some(item => location === item.path);
              const GroupIcon = group.icon;

              if (isCollapsed) {
                // Quando colapsado, mostrar apenas os ícones dos itens
                return (
                  <div key={group.id} className="space-y-0.5">
                    {visibleItems.map(item => {
                      const isActive = location === item.path;
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => setLocation(item.path)}
                            tooltip={item.label}
                            className="h-10"
                          >
                            <div className="relative">
                              <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                              {(item as any).showBadge && <NotificationBadge />}
                              {(item as any).showLeadsBadge && isCorretor && <LeadsActionsBadge count={totalAcoesLeads} />}
                              {(item as any).showAlertasBadge && isGestorOuSuperior && <AlertasBadge count={totalAlertasEquipe} />}
                              {(item as any).showAlert && !desbloqueado && (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                              )}
                            </div>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </div>
                );
              }

              return (
                <Collapsible
                  key={group.id}
                  open={openGroups[group.id] ?? false}
                  onOpenChange={() => toggleGroup(group.id)}
                >
                  <CollapsibleTrigger className={`
                    w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold
                    transition-all duration-200 border
                    ${hasActiveItem 
                      ? 'text-primary bg-primary/10 border-primary/30 shadow-sm' 
                      : 'text-foreground bg-muted/50 border-transparent hover:bg-muted hover:border-border'
                    }
                  `}>
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1 rounded ${hasActiveItem ? 'bg-primary/20' : 'bg-muted-foreground/10'}`}>
                        <GroupIcon className={`h-4 w-4 ${hasActiveItem ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <span>{group.label}</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${openGroups[group.id] ? 'rotate-180' : ''}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="ml-3 mt-1 pl-3 border-l-2 border-muted space-y-0.5">
                    {visibleItems.map(item => {
                      const isActive = location === item.path;
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => setLocation(item.path)}
                            className={`h-8 text-sm pl-2 ${isActive ? 'font-medium' : 'font-normal text-muted-foreground'}`}
                          >
                            <div className="relative">
                              <item.icon className={`h-3.5 w-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                              {(item as any).showBadge && <NotificationBadge />}
                              {(item as any).showLeadsBadge && isCorretor && <LeadsActionsBadge count={totalAcoesLeads} />}
                              {(item as any).showAlertasBadge && isGestorOuSuperior && <AlertasBadge count={totalAlertasEquipe} />}
                              {(item as any).showAlert && !desbloqueado && (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                              )}
                            </div>
                            <span className={!desbloqueado && (item as any).showAlert ? "font-semibold text-red-600" : ""}>{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </SidebarContent>

        <SidebarFooter className="p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="relative">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                {!isCollapsed && (
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">
                      {user?.name}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {user?.email}
                    </span>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                <Badge variant="secondary" className="mt-1 text-[10px]">
                  {user?.role === 'gestor' ? 'Gestor' : user?.role === 'admin' ? 'Admin' : user?.role === 'superintendente' ? 'Superintendente' : 'Corretor'}
                </Badge>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  window.location.href = "/meu-perfil";
                }}
              >
                <UserCircle className="mr-2 h-4 w-4" />
                Meu Perfil
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  window.location.href = "/configuracoes";
                }}
              >
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  window.location.href = "/api/oauth/logout";
                }}
                className="text-red-600 focus:text-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>

        {/* Resize Handle */}
        {!isCollapsed && !isMobile && (
          <div
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20 transition-colors"
            onMouseDown={() => setIsResizing(true)}
          />
        )}
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 items-center justify-between gap-2 border-b px-4 lg:px-6">
          <SidebarTrigger className="-ml-2">
            <PanelLeft className="h-5 w-5" />
          </SidebarTrigger>
          
          {/* Indicador de Progresso de Follow-ups (apenas para corretores) */}
          {isCorretor && (
            <div className="hidden md:flex items-center gap-3 flex-1 justify-center max-w-md relative">
              <div className="flex items-center gap-2 text-sm relative">
                <span className="font-medium text-muted-foreground hidden lg:inline">Follow-ups:</span>
                <span className={`font-bold ${desbloqueado ? 'text-green-600' : 'text-red-600'}`}>
                  {concluidos}/{total}
                </span>
                <span className={`text-xs font-semibold ${desbloqueado ? 'text-green-600' : 'text-red-600'}`}>
                  ({percentual}%)
                </span>
                
                {/* Animação +1 */}
                {showPlusOne && (
                  <span 
                    className="absolute -top-6 left-1/2 -translate-x-1/2 text-green-600 font-bold text-lg animate-[slideUp_1.5s_ease-out_forwards] pointer-events-none"
                    style={{
                      animation: 'slideUp 1.5s ease-out forwards',
                    }}
                  >
                    +1
                  </span>
                )}
              </div>
              <div className="flex-1 max-w-[200px]">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${desbloqueado ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(percentual, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
          
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-auto relative">
          <div className="px-4 pt-4">
            <PushNotificationBanner />
          </div>
          {/* Banner de lead aguardando primeiro contato */}
          {isCorretor && primeiroLeadAguardando && (
            <div className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-red-600 px-4 py-2.5 text-white shadow-md">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg">🔥</span>
                <div className="min-w-0">
                  <span className="font-semibold text-sm">Novo lead aguardando: </span>
                  <span className="text-sm">{primeiroLeadAguardando.nome}</span>
                  {leadsPrioritarios!.semPrimeiroContato.length > 1 && (
                    <span className="ml-1 text-xs text-red-200">+{leadsPrioritarios!.semPrimeiroContato.length - 1} mais</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => atenderLeadMutation.mutate({ id: primeiroLeadAguardando.id, data: { status: 'em_atendimento' } })}
                  disabled={atenderLeadMutation.isPending}
                  className="rounded-md bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 transition-colors disabled:opacity-50"
                >
                  {atenderLeadMutation.isPending ? '⏳ Iniciando...' : '✅ Atender Agora'}
                </button>
                <button
                  onClick={() => dispensarBanner(primeiroLeadAguardando.id)}
                  className="rounded p-1 hover:bg-white/20 transition-colors"
                  title="Dispensar"
                >
                  <span className="text-sm leading-none">×</span>
                </button>
              </div>
            </div>
          )}
          {children}
          {/* Overlay de bloqueio se não atingiu follow-ups E perfil está completo E não está em páginas liberadas (APENAS CORRETORES) */}
          {/* Quando perfil está incompleto, NÃO mostra overlay de follow-up para permitir acesso à página de configurações */}
          {/* Só mostra overlay se o corretor ACEITOU fazer follow-ups (escolhaDiariaFeita && aceitouFollowUp === true) */}
          {isCorretor && !desbloqueado && !perfilIncompleto && escolhaDiariaFeita && aceitouFollowUp === true && location !== "/tarefas-do-dia" && location !== "/modo-blitz" && location !== "/configuracoes" && (
            <LockedTabOverlay
              total={total}
              concluidos={concluidos}
              percentual={percentual}
            />
          )}
        </main>
        <TimezoneFooter />
      </SidebarInset>
      
      {/* Modal de agenda diária (aparece ACIMA do bloqueio, z-100) */}
      {/* Mostra para corretores que têm qualquer tarefa hoje e ainda não fizeram a escolha */}
      {isCorretor && !perfilIncompleto && !agendaDiariaFeitaHoje && !escolhaDiariaFeita &&
        (total > 0 || leadsAguardandoCount > 0 || agendamentosHojeCount > 0) && (
        <ModalAgendaDia
          totalFollowUps={total}
          leadsAguardando={leadsAguardandoCount}
          agendamentosHoje={agendamentosHojeCount}
          onEscolhaFeita={() => { marcarAgendaDiariaFeita(); refetchFollowUp(); }}
          onDismiss={() => marcarAgendaDiariaFeita()}
        />
      )}
      
      {/* Modal de agenda matinal do gestor — aparece uma vez por dia quando há alertas */}
      {isGestorOuSuperior && !perfilIncompleto && !agendaGestorFeitaHoje && alertasGestor && (
        alertasGestor.followUpsVencidos.length > 0 ||
        alertasGestor.corretoresSemAtividade.length > 0 ||
        alertasGestor.leadsSemPrimeiroContato.length > 0 ||
        alertasGestor.agendamentosSemConfirmacao.length > 0
      ) && (
        <ModalAgendaGestor
          alertas={alertasGestor}
          onDismiss={marcarAgendaGestorFeita}
        />
      )}

      {/* Widget flutuante de contador de leads Facebook (apenas para corretores) */}
      <ContadorLeadsFacebook isCorretor={isCorretor} />

      {/* Modal de onboarding obrigatório (1ª camada de bloqueio) */}
      <ModalOnboardingObrigatorio />
    </>
  );
}
