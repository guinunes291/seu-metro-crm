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
import { 
  LayoutDashboard, LogOut, PanelLeft, Users, Building2, UserCircle, 
  BarChart3, Settings, FileSpreadsheet, Users2, TrendingUp, Bell, 
  Kanban, Target, Shuffle, History, BookOpen, ClipboardList, Trophy, 
  UserCheck, UserX, Circle, Trash2, ChevronDown, Tv, FolderOpen,
  UserCog, Import, Home
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import NotificationListener from "./NotificationListener";
import { Badge } from "./ui/badge";
import { toast } from "sonner";

// Estrutura de menu agrupado
const menuGroups = [
  {
    id: "inicio",
    label: "Início",
    icon: Home,
    items: [
      { icon: BookOpen, label: "Boas-Vindas", path: "/boas-vindas" },
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
      { icon: ClipboardList, label: "Tarefas do Dia", path: "/tarefas-do-dia", roles: ["corretor"] },
    ],
  },
  {
    id: "leads",
    label: "Leads",
    icon: Users,
    items: [
      { icon: Users, label: "Meus Leads", path: "/leads" },
      { icon: Kanban, label: "Kanban", path: "/kanban" },
      { icon: Users, label: "Leads por Corretor", path: "/leads-por-corretor", roles: ["gestor", "admin"] },
      { icon: Bell, label: "Notificações", path: "/notificacoes", roles: ["user", "corretor"], showBadge: true },
    ],
  },
  {
    id: "projetos",
    label: "Projetos",
    icon: Building2,
    items: [
      { icon: Building2, label: "Catálogo", path: "/projetos" },
      { icon: Import, label: "Importar Projetos", path: "/importar-projetos", roles: ["gestor", "admin"] },
    ],
  },
  {
    id: "performance",
    label: "Performance",
    icon: TrendingUp,
    items: [
      { icon: TrendingUp, label: "Minha Performance", path: "/minha-performance" },
      { icon: Trophy, label: "Ranking TV", path: "/ranking-tv", roles: ["gestor", "admin"] },
      { icon: Tv, label: "Performance TV", path: "/performance-tv", roles: ["gestor", "admin"] },
      { icon: Target, label: "Metas Mensais", path: "/metas", roles: ["gestor", "admin"] },
      { icon: Target, label: "Metas Diárias", path: "/metas-diarias", roles: ["gestor", "admin"] },
    ],
  },
  {
    id: "gestao",
    label: "Gestão",
    icon: UserCog,
    roles: ["gestor", "admin"],
    items: [
      { icon: Users2, label: "Corretores", path: "/corretores", roles: ["gestor", "admin"] },
      { icon: UserCircle, label: "Distribuição", path: "/controle-distribuicao", roles: ["gestor", "admin"] },
      { icon: Shuffle, label: "Roleta de Leads", path: "/roleta", roles: ["gestor", "admin"] },
      { icon: History, label: "Histórico", path: "/historico-distribuicao", roles: ["gestor", "admin"] },
      { icon: FileSpreadsheet, label: "Importar Leads", path: "/importar-sheets", roles: ["gestor", "admin"] },
      { icon: Trash2, label: "Lixeira", path: "/lixeira", roles: ["gestor", "admin"] },
    ],
  },
  {
    id: "config",
    label: "Sistema",
    icon: Settings,
    items: [
      { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
      { icon: Settings, label: "Configurações", path: "/configuracoes" },
    ],
  },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const MENU_GROUPS_KEY = "menu-groups-state";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

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
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Continue
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
  const { data: count } = trpc.notifications.unreadCount.useQuery();
  
  if (!count || count === 0) return null;
  
  return (
    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
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
  const { user } = useAuth();
  const { state: sidebarState } = useSidebar();
  const isCollapsed = sidebarState === "collapsed";
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
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

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Buscar status do corretor
  const { data: corretorStatus } = trpc.corretores.meuStatus.useQuery(undefined, {
    enabled: user?.role === 'corretor',
    refetchInterval: 30000,
  });

  // Função para tocar som ao mudar status
  const playStatusSound = (isPresente: boolean) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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
  };

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

  // Filtrar grupos baseado no role do usuário
  const filteredGroups = menuGroups.filter(group => {
    if (group.roles && !group.roles.includes(user?.role || "")) {
      return false;
    }
    // Verificar se há pelo menos um item visível no grupo
    const visibleItems = group.items.filter(item => 
      !item.roles || item.roles.includes(user?.role || "")
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
            {!isCollapsed ? (
              <div className="flex items-center gap-2">
                <img
                  src={import.meta.env.VITE_APP_LOGO || "/logo.svg"}
                  alt="Logo"
                  className="h-10 object-contain"
                />
              </div>
            ) : null}
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
                !item.roles || item.roles.includes(user?.role || "")
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
                    w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium
                    transition-colors hover:bg-accent/50
                    ${hasActiveItem ? 'text-primary bg-accent/30' : 'text-muted-foreground'}
                  `}>
                    <div className="flex items-center gap-2">
                      <GroupIcon className="h-4 w-4" />
                      <span>{group.label}</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${openGroups[group.id] ? 'rotate-180' : ''}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-4 mt-1 space-y-0.5">
                    {visibleItems.map(item => {
                      const isActive = location === item.path;
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => setLocation(item.path)}
                            className="h-9 text-sm"
                          >
                            <div className="relative">
                              <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                              {(item as any).showBadge && <NotificationBadge />}
                            </div>
                            <span>{item.label}</span>
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
                  {user?.role === 'gestor' ? 'Gestor' : user?.role === 'admin' ? 'Admin' : 'Corretor'}
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
        <header className="flex h-14 items-center gap-2 border-b px-4 lg:px-6">
          <SidebarTrigger className="-ml-2">
            <PanelLeft className="h-5 w-5" />
          </SidebarTrigger>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </SidebarInset>
    </>
  );
}
