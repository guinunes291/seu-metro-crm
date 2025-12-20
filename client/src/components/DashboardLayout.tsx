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
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, PanelLeft, Users, Building2, UserCircle, BarChart3, Settings, FileSpreadsheet, Users2, TrendingUp, Bell, Kanban, Target, Shuffle, History, BookOpen, ClipboardList, Trophy, UserCheck, UserX, Circle, Trash2 } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import NotificationListener from "./NotificationListener";
import { Badge } from "./ui/badge";
import { toast } from "sonner";

const menuItems = [
  { icon: BookOpen, label: "Boas-Vindas", path: "/boas-vindas" },
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: ClipboardList, label: "Tarefas do Dia", path: "/tarefas-do-dia", roles: ["corretor"] },
  { icon: Building2, label: "Projetos", path: "/projetos" },
  { icon: Users, label: "Meus Leads", path: "/leads" },
  { icon: TrendingUp, label: "Minha Performance", path: "/minha-performance" },
  { icon: Kanban, label: "Kanban", path: "/kanban" },
  { icon: Bell, label: "Notificações", path: "/notificacoes", roles: ["user", "corretor"], showBadge: true },
  { icon: Users2, label: "Corretores", path: "/corretores", roles: ["gestor", "admin"] },
  { icon: UserCircle, label: "Distribuição", path: "/controle-distribuicao", roles: ["gestor", "admin"] },
  { icon: Users, label: "Leads por Corretor", path: "/leads-por-corretor", roles: ["gestor", "admin"] },
  { icon: Target, label: "Metas", path: "/metas", roles: ["gestor", "admin"] },
  { icon: Shuffle, label: "Roleta de Leads", path: "/roleta", roles: ["gestor", "admin"] },
  { icon: History, label: "Histórico Distribuição", path: "/historico-distribuicao", roles: ["gestor", "admin"] },
  { icon: Trophy, label: "Ranking TV", path: "/ranking-tv", roles: ["gestor", "admin"] },
  { icon: Trash2, label: "Lixeira", path: "/lixeira", roles: ["gestor", "admin"] },
  { icon: FileSpreadsheet, label: "Importar Leads", path: "/importar-sheets", roles: ["gestor", "admin"] },
  { icon: Building2, label: "Importar Projetos", path: "/importar-projetos", roles: ["gestor", "admin"] },
  { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
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
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  // Query para verificar status do corretor
  const utils = trpc.useUtils();
  const { data: corretorStatus } = trpc.corretores.meuStatus.useQuery(undefined, {
    enabled: user?.role === 'corretor',
    refetchInterval: 60000, // Atualiza a cada 1 minuto
  });

  // Função para tocar som de notificação
  const playStatusSound = (isPresente: boolean) => {
    try {
      // Criar contexto de áudio
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Som diferente para presente (agudo) e ausente (grave)
      oscillator.frequency.value = isPresente ? 880 : 440; // Lá agudo ou Lá grave
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.log('Som não suportado');
    }
  };

  // Mutation para alterar status com optimistic update
  const alterarStatusMutation = trpc.corretores.alterarMeuStatus.useMutation({
    onMutate: async (newStatus) => {
      // Cancelar queries em andamento
      await utils.corretores.meuStatus.cancel();
      
      // Salvar estado anterior
      const previousStatus = utils.corretores.meuStatus.getData();
      
      // Atualizar otimisticamente
      const novoStatusVisual = newStatus.status === 'ativo' ? 'ativo' : 'inativo';
      utils.corretores.meuStatus.setData(undefined, (old) => ({
        ...old,
        status: novoStatusVisual,
        name: old?.name || '',
      }));
      
      return { previousStatus };
    },
    onSuccess: (data) => {
      // Backend retorna 'presente' ou 'ausente'
      const isPresente = data.status === 'presente';
      
      // Tocar som
      playStatusSound(isPresente);
      
      // Mostrar toast
      toast.success(isPresente ? '✅ Você está PRESENTE e receberá leads!' : '⏸️ Você está AUSENTE e não receberá leads.');
      
      // Invalidar para sincronizar com o servidor
      utils.corretores.meuStatus.invalidate();
    },
    onError: (err, newStatus, context) => {
      // Reverter para o estado anterior em caso de erro
      if (context?.previousStatus) {
        utils.corretores.meuStatus.setData(undefined, context.previousStatus);
      }
      toast.error('Erro ao alterar status. Tente novamente.');
    },
  });

  const isCorretor = user?.role === 'corretor';
  const isAtivo = corretorStatus?.status === 'ativo';

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

  const handleToggleStatus = () => {
    const novoStatus = isAtivo ? 'inativo' : 'ativo';
    alterarStatusMutation.mutate({ status: novoStatus });
  };

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <img 
                    src="/logo-seu-metro-quadrado.png" 
                    alt="Seu Metro Quadrado" 
                    className="h-10 object-contain"
                  />
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
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

            <SidebarMenu className="px-2 py-1">
              {menuItems.filter(item => !item.roles || item.roles.includes(user?.role || "")).map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <div className="relative">
                        <item.icon
                          className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                        />
                        {item.showBadge && <NotificationBadge />}
                      </div>
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
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
                    {isCorretor && (
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${isAtivo ? 'bg-green-500' : 'bg-red-500'}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate leading-none">
                        {user?.name || "-"}
                      </p>
                      {isCorretor && (
                        <Badge variant={isAtivo ? "default" : "destructive"} className="text-[9px] px-1 py-0 h-4">
                          {isAtivo ? 'ON' : 'OFF'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {isCorretor && (
                  <>
                    <DropdownMenuItem
                      onClick={handleToggleStatus}
                      className="cursor-pointer"
                    >
                      {isAtivo ? (
                        <>
                          <UserX className="mr-2 h-4 w-4 text-red-500" />
                          <span>Ficar Ausente</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="mr-2 h-4 w-4 text-green-500" />
                          <span>Ficar Presente</span>
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
            {/* Botão de status no mobile */}
            {isCorretor && (
              <button
                onClick={handleToggleStatus}
                disabled={alterarStatusMutation.isPending}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                  isAtivo 
                    ? 'bg-green-500/10 text-green-700' 
                    : 'bg-red-500/10 text-red-700'
                }`}
              >
                <Circle className={`h-2 w-2 ${isAtivo ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'}`} />
                {isAtivo ? 'Presente' : 'Ausente'}
              </button>
            )}
          </div>
        )}
        <main className="flex-1 p-4">
          {/* Listener de notificações em tempo real com som */}
          <NotificationListener />
          {children}
        </main>
      </SidebarInset>
    </>
  );
}


// Componente de badge de notificações não lidas
function NotificationBadge() {
  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  if (!unreadCount || unreadCount === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
      {unreadCount > 9 ? "9+" : unreadCount}
    </span>
  );
}
