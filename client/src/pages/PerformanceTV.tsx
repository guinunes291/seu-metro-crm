import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Trophy, TrendingUp, Target, DollarSign, FileCheck, 
  Calendar, Maximize, RefreshCw, Users, Phone, MessageSquare,
  CalendarCheck, Eye, FileText, Briefcase, Activity, ChevronDown
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subWeeks, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

// Tipos de período
type PeriodOption = 
  | "all"
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

const periodLabels: Record<PeriodOption, string> = {
  all: "Todo o período",
  today: "Hoje",
  yesterday: "Ontem",
  this_week: "Esta semana",
  last_week: "Semana passada",
  this_month: "Este mês",
  last_month: "Mês passado",
  this_year: "Este ano",
  custom: "Personalizado",
};

function getDateRangeForPeriod(period: PeriodOption, customRange?: DateRange): DateRange {
  const now = new Date();
  
  switch (period) {
    case "all":
      return { from: undefined, to: undefined };
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday":
      const yesterday = subDays(now, 1);
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
    case "this_week":
      return { from: startOfWeek(now, { weekStartsOn: 0 }), to: endOfWeek(now, { weekStartsOn: 0 }) };
    case "last_week":
      const lastWeek = subWeeks(now, 1);
      return { from: startOfWeek(lastWeek, { weekStartsOn: 0 }), to: endOfWeek(lastWeek, { weekStartsOn: 0 }) };
    case "this_month":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "last_month":
      const lastMonth = subMonths(now, 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    case "this_year":
      return { from: startOfYear(now), to: endOfYear(now) };
    case "custom":
      return customRange || { from: undefined, to: undefined };
    default:
      return { from: undefined, to: undefined };
  }
}

// Formatar valor em reais
function formatCurrency(value: number): string {
  // Converter de centavos para reais
  const valueInReais = value / 100;
  if (valueInReais >= 1000000) {
    return `R$ ${(valueInReais / 1000000).toFixed(1).replace('.', ',')}M`;
  }
  if (valueInReais >= 1000) {
    return `R$ ${(valueInReais / 1000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valueInReais);
}

function formatFullCurrency(value: number): string {
  // Converter de centavos para reais
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

// Obter iniciais do nome
function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// Componente KPI Card no estilo Midrah - COM CONTRASTE CORRIGIDO
function KPICard({ 
  label, 
  value, 
  icon: Icon, 
  variant = "default",
  subValue,
  percentage,
  highlight = false
}: { 
  label: string; 
  value: string; 
  icon: any; 
  variant?: "default" | "success" | "warning" | "danger" | "info" | "accent";
  subValue?: string;
  percentage?: number;
  highlight?: boolean;
}) {
  const variants = {
    default: "bg-slate-800/60 border-slate-700/50",
    success: "bg-emerald-900/40 border-emerald-500/40",
    warning: "bg-amber-900/40 border-amber-500/40",
    danger: "bg-red-900/40 border-red-500/40",
    info: "bg-blue-900/40 border-blue-500/40",
    accent: "bg-cyan-900/40 border-cyan-500/40",
  };

  const iconColors = {
    default: "text-slate-300",
    success: "text-emerald-300",
    warning: "text-amber-300",
    danger: "text-red-300",
    info: "text-blue-300",
    accent: "text-cyan-300",
  };

  // CORES DE TEXTO COM ALTO CONTRASTE
  const labelColors = {
    default: "text-slate-200",
    success: "text-emerald-200",
    warning: "text-amber-200",
    danger: "text-red-200",
    info: "text-blue-200",
    accent: "text-cyan-200",
  };

  return (
    <div className={`
      relative rounded-xl p-4 border backdrop-blur-sm
      ${variants[variant]}
      ${highlight ? 'ring-2 ring-cyan-400/50' : ''}
    `}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Label com cor clara para contraste */}
          <p className={`text-[11px] uppercase tracking-wider font-semibold mb-1 ${labelColors[variant]}`}>
            {label}
          </p>
          {/* Valor sempre branco para máximo contraste */}
          <p className="text-2xl font-bold text-white leading-tight drop-shadow-sm">{value}</p>
          {subValue && (
            <p className="text-[11px] text-gray-300 mt-0.5 font-medium">{subValue}</p>
          )}
          {percentage !== undefined && (
            <p className={`text-xs font-semibold mt-1 ${percentage >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {percentage >= 0 ? '+' : ''}{percentage}%
            </p>
          )}
        </div>
        <div className={`p-2 rounded-lg bg-white/10 ${iconColors[variant]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

// Componente do Pódio Visual estilo Midrah
function PodiumVisual({ ranking, type = "vgv" }: { ranking: any[]; type?: "vgv" | "produtividade" }) {
  if (ranking.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <p>Nenhum corretor no ranking</p>
      </div>
    );
  }
  
  // Pegar top 6 para o pódio visual
  const top6 = ranking.slice(0, 6);
  
  // Organizar: [4º, 2º, 1º, 3º, 5º, 6º] para layout visual
  const podiumOrder = [
    { data: top6[3], position: 4 },
    { data: top6[1], position: 2 },
    { data: top6[0], position: 1 },
    { data: top6[2], position: 3 },
    { data: top6[4], position: 5 },
    { data: top6[5], position: 6 },
  ].filter(item => item.data);

  const getStyles = (position: number) => {
    switch(position) {
      case 1: return {
        size: 'w-32 h-32',
        border: 'border-[5px] border-yellow-400',
        glow: 'shadow-[0_0_50px_rgba(250,204,21,0.5),0_0_100px_rgba(250,204,21,0.3)]',
        ring: 'ring-4 ring-yellow-300/30',
        nameColor: 'text-yellow-300',
        valueColor: 'text-yellow-200',
        bgGradient: 'from-yellow-500 to-amber-600',
      };
      case 2: return {
        size: 'w-26 h-26',
        border: 'border-4 border-gray-300',
        glow: 'shadow-[0_0_40px_rgba(209,213,219,0.4)]',
        ring: 'ring-2 ring-gray-300/30',
        nameColor: 'text-gray-100',
        valueColor: 'text-gray-200',
        bgGradient: 'from-gray-400 to-gray-600',
      };
      case 3: return {
        size: 'w-24 h-24',
        border: 'border-4 border-amber-500',
        glow: 'shadow-[0_0_35px_rgba(245,158,11,0.4)]',
        ring: 'ring-2 ring-amber-400/30',
        nameColor: 'text-amber-300',
        valueColor: 'text-amber-200',
        bgGradient: 'from-amber-600 to-orange-700',
      };
      default: return {
        size: 'w-20 h-20',
        border: 'border-3 border-blue-400/60',
        glow: 'shadow-[0_0_25px_rgba(96,165,250,0.3)]',
        ring: 'ring-2 ring-blue-400/20',
        nameColor: 'text-blue-200',
        valueColor: 'text-cyan-300',
        bgGradient: 'from-blue-500 to-blue-700',
      };
    }
  };

  return (
    <div className="relative">
      {/* Linha de conexão visual */}
      <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
      
      {/* Pódio */}
      <div className="flex items-end justify-center gap-3 py-4">
        {podiumOrder.map(({ data: corretor, position }) => {
          if (!corretor) return null;
          const styles = getStyles(position);
          const displayValue = type === "vgv" 
            ? formatCurrency(corretor.vgvTotal || 0)
            : `${corretor.pontuacaoTotal || 0} pts`;
          
          return (
            <div 
              key={corretor.corretorId || position} 
              className={`flex flex-col items-center transition-all duration-300 hover:scale-105 ${position === 1 ? 'z-10' : ''}`}
            >
              {/* Avatar com efeito de brilho */}
              <div className={`relative ${position === 1 ? 'mb-3' : 'mb-2'}`}>
                {/* Posição */}
                <div className={`
                  absolute -top-2 -right-2 z-10 w-7 h-7 rounded-full 
                  flex items-center justify-center text-sm font-bold
                  bg-gradient-to-br ${styles.bgGradient} text-white
                  shadow-lg border-2 border-white/20
                `}>
                  {position}
                </div>
                
                {/* Avatar */}
                <Avatar className={`
                  ${styles.size} ${styles.border} ${styles.glow} ${styles.ring}
                  transition-all duration-300
                `}>
                  <AvatarImage src={corretor.corretorFoto || undefined} />
                  <AvatarFallback className={`bg-gradient-to-br ${styles.bgGradient} text-white text-lg font-bold`}>
                    {getInitials(corretor.corretorNome)}
                  </AvatarFallback>
                </Avatar>
              </div>
              
              {/* Nome e Valor */}
              <p className={`font-bold text-sm ${styles.nameColor} text-center max-w-[120px] truncate`}>
                {corretor.corretorNome?.split(' ')[0] || 'Corretor'}
              </p>
              <p className={`text-xs font-semibold ${styles.valueColor}`}>
                {displayValue}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Componente de Ranking Lateral
function RankingLateral({ ranking, type = "vgv" }: { ranking: any[]; type?: "vgv" | "produtividade" }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-[10px] text-gray-400 uppercase tracking-wider px-2 pb-2 border-b border-slate-700/50">
        <div className="col-span-1">#</div>
        <div className="col-span-7">Executivo</div>
        <div className="col-span-4 text-right">{type === "vgv" ? "VGV Realizado" : "Pontuação"}</div>
      </div>
      
      <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2">
        {ranking.map((item, index) => (
          <div 
            key={item.corretorId || index}
            className={`
              grid grid-cols-12 gap-2 items-center py-2 px-2 rounded-lg
              ${index < 3 ? 'bg-slate-800/40' : 'hover:bg-slate-800/30'}
              transition-colors
            `}
          >
            <div className={`col-span-1 font-bold text-sm ${
              index === 0 ? 'text-yellow-400' :
              index === 1 ? 'text-gray-300' :
              index === 2 ? 'text-amber-400' :
              'text-gray-500'
            }`}>
              {index + 1}º
            </div>
            <div className="col-span-7 flex items-center gap-2">
              <Avatar className="w-7 h-7">
                <AvatarImage src={item.corretorFoto || undefined} />
                <AvatarFallback className="text-[10px] bg-slate-700 text-white">
                  {getInitials(item.corretorNome)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-white truncate">{item.corretorNome || 'Corretor'}</span>
            </div>
            <div className={`col-span-4 text-right text-sm font-semibold ${
              index === 0 ? 'text-yellow-300' :
              index === 1 ? 'text-gray-200' :
              index === 2 ? 'text-amber-300' :
              'text-cyan-300'
            }`}>
              {type === "vgv" 
                ? formatFullCurrency(item.vgvTotal || 0)
                : `${item.pontuacaoTotal || 0} pts`
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Componente de Gráfico de Barras com Linha de Tendência
function BarChartWithTrend({ data, type = "vgv" }: { data: any[]; type?: "vgv" | "produtividade" }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <p>Sem dados para exibir</p>
      </div>
    );
  }
  
  const maxValue = type === "vgv"
    ? Math.max(...data.map(d => d.vgvTotal || 0))
    : Math.max(...data.map(d => d.pontuacaoTotal || 0));
  
  return (
    <div className="space-y-3">
      {data.slice(0, 10).map((item, index) => {
        const value = type === "vgv" ? (item.vgvTotal || 0) : (item.pontuacaoTotal || 0);
        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
        
        return (
          <div key={item.corretorId || index} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-300 font-medium">{item.corretorNome?.split(' ')[0] || 'Corretor'}</span>
              <span className="text-white font-semibold">{Math.round(percentage)}%</span>
            </div>
            <div className="h-6 bg-slate-800/60 rounded-lg overflow-hidden relative">
              <div 
                className={`h-full rounded-lg transition-all duration-500 ${
                  index === 0 ? 'bg-gradient-to-r from-yellow-500 to-amber-500' :
                  index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-500' :
                  index === 2 ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                  'bg-gradient-to-r from-blue-500 to-cyan-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
              {/* Linha de tendência */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-slate-900"
                style={{ left: `calc(${percentage}% - 6px)` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PerformanceTV() {
  const [periodo, setPeriodo] = useState<PeriodOption>('this_month');
  const [customRange, setCustomRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'vgv' | 'produtividade'>('vgv');
  
  // Calcular range de datas baseado no período selecionado
  const dateRange = useMemo(() => {
    return getDateRangeForPeriod(periodo, customRange);
  }, [periodo, customRange]);
  
  // Queries
  const { data: rankingVGV, refetch: refetchVGV } = trpc.ranking.getCompleto.useQuery();
  const { data: rankingDia, refetch: refetchDia } = trpc.ranking.dia.useQuery({});
  const { data: estatisticas } = trpc.distribuicao.getEstatisticas.useQuery();
  
  // Auto-refresh a cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      refetchVGV();
      refetchDia();
    }, 30000);
    return () => clearInterval(interval);
  }, [refetchVGV, refetchDia]);
  
  // Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  
  // Handler para seleção de período
  const handlePeriodSelect = (period: PeriodOption) => {
    if (period === "custom") {
      setIsCalendarOpen(true);
      return;
    }
    setPeriodo(period);
  };
  
  const handleCustomRangeSelect = () => {
    if (tempRange.from && tempRange.to) {
      setCustomRange(tempRange);
      setPeriodo("custom");
      setIsCalendarOpen(false);
    }
  };
  
  // Label do período
  const periodLabel = useMemo(() => {
    if (periodo === "custom" && customRange?.from && customRange?.to) {
      return `${format(customRange.from, "dd/MM/yy", { locale: ptBR })} - ${format(customRange.to, "dd/MM/yy", { locale: ptBR })}`;
    }
    return periodLabels[periodo];
  }, [periodo, customRange]);
  
  // Formatar ranking para o formato esperado
  const rankingFormatado = rankingVGV?.map((item: any, index: number) => ({
    corretorId: item.corretorId,
    corretorNome: item.corretorNome,
    corretorFoto: item.corretorFoto,
    vgvTotal: item.vgvTotal || 0,
    contratosFechados: item.contratosFechados || 0,
    posicao: index + 1,
  })) || [];

  // Formatar ranking de produtividade
  const rankingProdutividade = rankingDia?.map((item: any, index: number) => ({
    corretorId: item.corretorId,
    corretorNome: item.corretorNome,
    corretorFoto: item.corretorFoto,
    pontuacaoTotal: item.pontuacaoTotal || 0,
    ligacoesRealizadas: item.ligacoesRealizadas || 0,
    ligacoesAtendidas: item.ligacoesAtendidas || 0,
    whatsappEnviados: item.whatsappEnviados || 0,
    whatsappRespondidos: item.whatsappRespondidos || 0,
    agendamentosConfirmados: item.agendamentosConfirmados || 0,
    visitasRealizadas: item.visitasRealizadas || 0,
    documentacoesRecolhidas: item.documentacoesRecolhidas || 0,
    posicao: index + 1,
  })) || [];
  
  // Calcular totais
  const totalVGV = rankingFormatado.reduce((acc: number, item: any) => acc + (item.vgvTotal || 0), 0);
  const totalContratos = rankingFormatado.reduce((acc: number, item: any) => acc + (item.contratosFechados || 0), 0);
  const totalCorretores = rankingFormatado.length;
  
  // Totais de produtividade do dia
  const totalLigacoes = rankingProdutividade.reduce((acc: number, item: any) => acc + (item.ligacoesRealizadas || 0), 0);
  const totalLigacoesAtendidas = rankingProdutividade.reduce((acc: number, item: any) => acc + (item.ligacoesAtendidas || 0), 0);
  const totalWhatsapp = rankingProdutividade.reduce((acc: number, item: any) => acc + (item.whatsappEnviados || 0), 0);
  const totalAgendamentos = rankingProdutividade.reduce((acc: number, item: any) => acc + (item.agendamentosConfirmados || 0), 0);
  const totalVisitas = rankingProdutividade.reduce((acc: number, item: any) => acc + (item.visitasRealizadas || 0), 0);
  const totalDocumentacoes = rankingProdutividade.reduce((acc: number, item: any) => acc + (item.documentacoesRecolhidas || 0), 0);
  const totalPontos = rankingProdutividade.reduce((acc: number, item: any) => acc + (item.pontuacaoTotal || 0), 0);
  
  // Meta fictícia para demonstração (pode ser substituída por dados reais)
  const metaVGV = 50000000; // R$ 500.000 em centavos
  const gapMeta = metaVGV - totalVGV;
  const tendencia = totalVGV > 0 ? Math.round((totalVGV / metaVGV) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo e Título */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">SEU METRO QUADRADO</h1>
                  <p className="text-[10px] text-cyan-300 uppercase tracking-wider font-medium">Performance em Vendas</p>
                </div>
              </div>
            </div>
            
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'vgv' | 'produtividade')} className="mx-4">
              <TabsList className="bg-slate-800/50 border border-slate-700/50">
                <TabsTrigger value="vgv" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-300">
                  <DollarSign className="w-4 h-4 mr-2" />
                  VGV / Vendas
                </TabsTrigger>
                <TabsTrigger value="produtividade" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-gray-300">
                  <Activity className="w-4 h-4 mr-2" />
                  Produtividade Diária
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            {/* Controles */}
            <div className="flex items-center gap-2">
              {/* Filtro de Período Completo */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="gap-2 bg-slate-800/50 border-slate-700/50 text-white hover:bg-slate-700/50 hover:text-white"
                  >
                    <Calendar className="h-4 w-4" />
                    {periodLabel}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {(Object.keys(periodLabels) as PeriodOption[]).map((period) => (
                    period !== "custom" ? (
                      <DropdownMenuItem
                        key={period}
                        onClick={() => handlePeriodSelect(period)}
                        className={periodo === period ? "bg-accent" : ""}
                      >
                        {periodLabels[period]}
                        {periodo === period && (
                          <span className="ml-auto text-primary">✓</span>
                        )}
                      </DropdownMenuItem>
                    ) : null
                  ))}
                  <DropdownMenuSeparator />
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setIsCalendarOpen(true);
                        }}
                        className={periodo === "custom" ? "bg-accent" : ""}
                      >
                        {periodLabels.custom}
                        {periodo === "custom" && (
                          <span className="ml-auto text-primary">✓</span>
                        )}
                      </DropdownMenuItem>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <div className="p-4">
                        <CalendarComponent
                          mode="range"
                          selected={{ from: tempRange.from, to: tempRange.to }}
                          onSelect={(range) => setTempRange({ from: range?.from, to: range?.to })}
                          locale={ptBR}
                          numberOfMonths={2}
                        />
                        <div className="flex justify-end gap-2 mt-4">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setIsCalendarOpen(false)}
                          >
                            Cancelar
                          </Button>
                          <Button 
                            size="sm"
                            onClick={handleCustomRangeSelect}
                            disabled={!tempRange.from || !tempRange.to}
                          >
                            Aplicar
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => { refetchVGV(); refetchDia(); }}
                className="bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50 text-white"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              
              <Button 
                variant="outline" 
                size="icon"
                onClick={toggleFullscreen}
                className="bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50 text-white"
              >
                <Maximize className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Conteúdo Principal */}
      <div className="container mx-auto px-4 py-6">
        {activeTab === 'vgv' ? (
          <>
            {/* KPIs de VGV */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
              <KPICard 
                label="Meta" 
                value={formatCurrency(metaVGV)} 
                icon={Target}
                variant="info"
              />
              <KPICard 
                label="Faturamento" 
                value={formatCurrency(totalVGV)} 
                icon={DollarSign}
                variant="success"
                highlight
              />
              <KPICard 
                label="Realizado" 
                value={`${tendencia}%`}
                icon={TrendingUp}
                variant={tendencia >= 100 ? "success" : tendencia >= 50 ? "warning" : "danger"}
              />
              <KPICard 
                label="Gap da Meta" 
                value={formatCurrency(Math.abs(gapMeta))}
                subValue={gapMeta > 0 ? "faltam" : "excedido"}
                icon={Target}
                variant={gapMeta > 0 ? "warning" : "success"}
              />
              <KPICard 
                label="Tendência" 
                value={`${tendencia}%`}
                icon={TrendingUp}
                variant="accent"
              />
              <KPICard 
                label="Contratos" 
                value={totalContratos.toString()}
                icon={FileCheck}
                variant="success"
              />
              <KPICard 
                label="Corretores" 
                value={totalCorretores.toString()}
                icon={Users}
                variant="info"
              />
            </div>
            
            {/* Grid Principal - VGV */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Pódio e Gráfico */}
              <div className="lg:col-span-2 space-y-6">
                {/* Pódio Visual */}
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6">
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    TOP PERFORMERS - VGV
                  </h2>
                  <PodiumVisual ranking={rankingFormatado} type="vgv" />
                </div>
                
                {/* Gráfico de Barras */}
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6">
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-cyan-400" />
                    RANKING DE EQUIPES
                  </h2>
                  <BarChartWithTrend data={rankingFormatado} type="vgv" />
                </div>
              </div>
              
              {/* Ranking Lateral */}
              <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                  RANKING VGV
                </h2>
                <RankingLateral ranking={rankingFormatado} type="vgv" />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* KPIs de Produtividade */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
              <KPICard 
                label="Ligações" 
                value={totalLigacoes.toString()}
                subValue={`${totalLigacoesAtendidas} atendidas`}
                icon={Phone}
                variant="info"
              />
              <KPICard 
                label="WhatsApp" 
                value={totalWhatsapp.toString()}
                icon={MessageSquare}
                variant="success"
              />
              <KPICard 
                label="Agendamentos" 
                value={totalAgendamentos.toString()}
                icon={CalendarCheck}
                variant="accent"
              />
              <KPICard 
                label="Visitas" 
                value={totalVisitas.toString()}
                icon={Eye}
                variant="warning"
              />
              <KPICard 
                label="Documentações" 
                value={totalDocumentacoes.toString()}
                icon={FileText}
                variant="success"
              />
              <KPICard 
                label="Pontuação Total" 
                value={totalPontos.toString()}
                icon={Trophy}
                variant="accent"
                highlight
              />
              <KPICard 
                label="Corretores Ativos" 
                value={rankingProdutividade.filter((r: any) => r.pontuacaoTotal > 0).length.toString()}
                icon={Users}
                variant="info"
              />
            </div>
            
            {/* Grid Principal - Produtividade */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Pódio e Gráfico */}
              <div className="lg:col-span-2 space-y-6">
                {/* Pódio Visual */}
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6">
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    TOP PERFORMERS - PRODUTIVIDADE
                  </h2>
                  <PodiumVisual ranking={rankingProdutividade} type="produtividade" />
                </div>
                
                {/* Tabela de Atividades */}
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6 overflow-x-auto">
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-400" />
                    ATIVIDADES DO DIA
                  </h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-300 border-b border-slate-700/50">
                        <th className="text-left py-2 px-2">#</th>
                        <th className="text-left py-2 px-2">Corretor</th>
                        <th className="text-center py-2 px-2">📞</th>
                        <th className="text-center py-2 px-2">💬</th>
                        <th className="text-center py-2 px-2">📅</th>
                        <th className="text-center py-2 px-2">👁️</th>
                        <th className="text-center py-2 px-2">📄</th>
                        <th className="text-right py-2 px-2">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankingProdutividade.slice(0, 10).map((item: any, index: number) => (
                        <tr 
                          key={item.corretorId || index}
                          className={`border-b border-slate-800/30 ${index < 3 ? 'bg-slate-800/20' : ''}`}
                        >
                          <td className={`py-2 px-2 font-bold ${
                            index === 0 ? 'text-yellow-400' :
                            index === 1 ? 'text-gray-300' :
                            index === 2 ? 'text-amber-400' :
                            'text-gray-500'
                          }`}>{index + 1}º</td>
                          <td className="py-2 px-2 text-white">{item.corretorNome?.split(' ')[0] || 'Corretor'}</td>
                          <td className="py-2 px-2 text-center text-blue-300">{item.ligacoesRealizadas}</td>
                          <td className="py-2 px-2 text-center text-green-300">{item.whatsappEnviados}</td>
                          <td className="py-2 px-2 text-center text-purple-300">{item.agendamentosConfirmados}</td>
                          <td className="py-2 px-2 text-center text-amber-300">{item.visitasRealizadas}</td>
                          <td className="py-2 px-2 text-center text-cyan-300">{item.documentacoesRecolhidas}</td>
                          <td className={`py-2 px-2 text-right font-bold ${
                            index === 0 ? 'text-yellow-300' :
                            index === 1 ? 'text-gray-200' :
                            index === 2 ? 'text-amber-300' :
                            'text-white'
                          }`}>{item.pontuacaoTotal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Ranking Lateral */}
              <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  RANKING PONTUAÇÃO
                </h2>
                <RankingLateral ranking={rankingProdutividade} type="produtividade" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
