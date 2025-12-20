import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Trophy, TrendingUp, Target, DollarSign, FileCheck, 
  Calendar, Maximize, RefreshCw, Users, Phone, MessageSquare,
  CalendarCheck, Eye, FileText, Briefcase, Activity
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

// Componente KPI Card no estilo Midrah
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
    success: "bg-emerald-900/30 border-emerald-500/30",
    warning: "bg-amber-900/30 border-amber-500/30",
    danger: "bg-red-900/30 border-red-500/30",
    info: "bg-blue-900/30 border-blue-500/30",
    accent: "bg-cyan-900/30 border-cyan-500/30",
  };

  const iconColors = {
    default: "text-slate-400",
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
    info: "text-blue-400",
    accent: "text-cyan-400",
  };

  return (
    <div className={`
      relative rounded-xl p-4 border backdrop-blur-sm
      ${variants[variant]}
      ${highlight ? 'ring-2 ring-cyan-400/50' : ''}
    `}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-1">{label}</p>
          <p className="text-xl font-bold text-white leading-tight">{value}</p>
          {subValue && (
            <p className="text-[10px] text-gray-500 mt-0.5">{subValue}</p>
          )}
          {percentage !== undefined && (
            <p className={`text-xs font-semibold mt-1 ${percentage >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {percentage >= 0 ? '+' : ''}{percentage}%
            </p>
          )}
        </div>
        <div className={`p-2 rounded-lg bg-white/5 ${iconColors[variant]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

// Componente do Pódio Visual estilo Midrah
function PodiumVisual({ ranking, type = "vgv" }: { ranking: any[]; type?: "vgv" | "produtividade" }) {
  if (ranking.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
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
        nameColor: 'text-yellow-400',
        valueColor: 'text-yellow-300',
        bgGradient: 'from-yellow-500 to-amber-600',
      };
      case 2: return {
        size: 'w-26 h-26',
        border: 'border-4 border-gray-300',
        glow: 'shadow-[0_0_40px_rgba(209,213,219,0.4)]',
        ring: 'ring-2 ring-gray-300/30',
        nameColor: 'text-gray-200',
        valueColor: 'text-gray-300',
        bgGradient: 'from-gray-400 to-gray-600',
      };
      case 3: return {
        size: 'w-24 h-24',
        border: 'border-4 border-amber-500',
        glow: 'shadow-[0_0_35px_rgba(245,158,11,0.4)]',
        ring: 'ring-2 ring-amber-400/30',
        nameColor: 'text-amber-400',
        valueColor: 'text-amber-300',
        bgGradient: 'from-amber-600 to-orange-700',
      };
      default: return {
        size: 'w-20 h-20',
        border: 'border-3 border-blue-400/60',
        glow: 'shadow-[0_0_25px_rgba(96,165,250,0.3)]',
        ring: 'ring-2 ring-blue-400/20',
        nameColor: 'text-blue-300',
        valueColor: 'text-cyan-400',
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
                {/* Anel de brilho externo */}
                <div className={`absolute inset-0 rounded-full ${styles.glow} ${styles.ring}`} />
                
                {/* Avatar principal */}
                <Avatar className={`${styles.size} ${styles.border} relative z-10`}>
                  <AvatarImage 
                    src={corretor.corretorFoto} 
                    alt={corretor.corretorNome}
                    className="object-cover"
                  />
                  <AvatarFallback className={`bg-gradient-to-br ${styles.bgGradient} text-white text-lg font-bold`}>
                    {getInitials(corretor.corretorNome)}
                  </AvatarFallback>
                </Avatar>
                
                {/* Badge de posição */}
                <div className={`
                  absolute -bottom-1 -right-1 w-7 h-7 rounded-full 
                  flex items-center justify-center text-xs font-bold
                  ${position === 1 ? 'bg-yellow-400 text-yellow-900' : 
                    position === 2 ? 'bg-gray-300 text-gray-800' :
                    position === 3 ? 'bg-amber-500 text-amber-900' :
                    'bg-blue-500 text-white'}
                  border-2 border-slate-900 z-20
                `}>
                  {position}º
                </div>
              </div>
              
              {/* Nome e valor */}
              <p className={`text-xs font-semibold ${styles.nameColor} text-center max-w-[100px] truncate`}>
                {corretor.corretorNome?.split(' ')[0] || 'Corretor'}
              </p>
              <p className={`text-sm font-bold ${styles.valueColor}`}>
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
function RankingList({ ranking, type = "vgv" }: { ranking: any[]; type?: "vgv" | "produtividade" }) {
  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
      {ranking.map((corretor, index) => {
        const displayValue = type === "vgv"
          ? formatCurrency(corretor.vgvTotal || 0)
          : `${corretor.pontuacaoTotal || 0} pts`;
        
        return (
          <div 
            key={corretor.corretorId || index}
            className={`
              flex items-center gap-3 p-2 rounded-lg
              ${index === 0 ? 'bg-yellow-500/10 border border-yellow-500/30' :
                index === 1 ? 'bg-gray-500/10 border border-gray-500/30' :
                index === 2 ? 'bg-amber-500/10 border border-amber-500/30' :
                'bg-slate-800/40 border border-slate-700/30'}
            `}
          >
            <span className={`
              w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
              ${index === 0 ? 'bg-yellow-400 text-yellow-900' :
                index === 1 ? 'bg-gray-300 text-gray-800' :
                index === 2 ? 'bg-amber-500 text-amber-900' :
                'bg-slate-700 text-gray-300'}
            `}>
              {index + 1}
            </span>
            <Avatar className="h-8 w-8">
              <AvatarImage src={corretor.corretorFoto} />
              <AvatarFallback className="text-xs bg-slate-700">
                {getInitials(corretor.corretorNome)}
              </AvatarFallback>
            </Avatar>
            <span className="flex-1 text-sm text-gray-200 truncate">
              {corretor.corretorNome || 'Corretor'}
            </span>
            <span className={`text-sm font-bold ${
              index === 0 ? 'text-yellow-400' :
              index === 1 ? 'text-gray-300' :
              index === 2 ? 'text-amber-400' :
              'text-cyan-400'
            }`}>
              {displayValue}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Componente de Gráfico de Barras
function BarChart({ data, type = "vgv" }: { data: any[]; type?: "vgv" | "produtividade" }) {
  if (data.length === 0) return null;
  
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
              <span className="text-gray-400">{item.corretorNome?.split(' ')[0] || 'Corretor'}</span>
              <span className="text-gray-300">{Math.round(percentage)}%</span>
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
  const [periodo, setPeriodo] = useState<'mes' | 'trimestre' | 'ano'>('mes');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'vgv' | 'produtividade'>('vgv');
  
  // Queries
  const { data: rankingVGV, refetch: refetchVGV } = trpc.ranking.corretores.useQuery();
  const { data: rankingDia, refetch: refetchDia } = trpc.ranking.dia.useQuery({});
  const { data: estatisticas } = trpc.leads.estatisticas.useQuery();
  
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
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Performance em Vendas</p>
                </div>
              </div>
            </div>
            
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'vgv' | 'produtividade')} className="mx-4">
              <TabsList className="bg-slate-800/50 border border-slate-700/50">
                <TabsTrigger value="vgv" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <DollarSign className="w-4 h-4 mr-2" />
                  VGV / Vendas
                </TabsTrigger>
                <TabsTrigger value="produtividade" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                  <Activity className="w-4 h-4 mr-2" />
                  Produtividade Diária
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            {/* Controles */}
            <div className="flex items-center gap-2">
              <Select value={periodo} onValueChange={(v) => setPeriodo(v as any)}>
                <SelectTrigger className="w-[130px] bg-slate-800/50 border-slate-700/50 text-white">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mes">Mês</SelectItem>
                  <SelectItem value="trimestre">Trimestre</SelectItem>
                  <SelectItem value="ano">Ano</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => { refetchVGV(); refetchDia(); }}
                className="bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              
              <Button 
                variant="outline" 
                size="icon"
                onClick={toggleFullscreen}
                className="bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50"
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
                  <h2 className="text-lg font-bold text-white mb-4">RANKING DE EQUIPES</h2>
                  <BarChart data={rankingFormatado} type="vgv" />
                </div>
              </div>
              
              {/* Ranking Lateral */}
              <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                  RANKING VGV
                </h2>
                <RankingList ranking={rankingFormatado} type="vgv" />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* KPIs de Produtividade Diária */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
              <KPICard 
                label="Ligações" 
                value={totalLigacoes.toString()} 
                icon={Phone}
                variant="info"
                subValue={`${totalLigacoesAtendidas} atendidas`}
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
                variant="info"
              />
              <KPICard 
                label="Pontuação Total" 
                value={totalPontos.toString()}
                icon={Trophy}
                variant="success"
                highlight
              />
              <KPICard 
                label="Corretores Ativos" 
                value={rankingProdutividade.filter((r: any) => r.pontuacaoTotal > 0).length.toString()}
                icon={Users}
                variant="accent"
              />
            </div>
            
            {/* Grid Principal - Produtividade */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Pódio e Gráfico */}
              <div className="lg:col-span-2 space-y-6">
                {/* Pódio Visual */}
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6">
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-400" />
                    TOP PERFORMERS - PRODUTIVIDADE DO DIA
                  </h2>
                  <PodiumVisual ranking={rankingProdutividade} type="produtividade" />
                </div>
                
                {/* Detalhes de Atividades */}
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6">
                  <h2 className="text-lg font-bold text-white mb-4">DETALHES POR CORRETOR</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-400 text-xs uppercase border-b border-slate-700/50">
                          <th className="text-left py-3 px-2">#</th>
                          <th className="text-left py-3 px-2">Corretor</th>
                          <th className="text-center py-3 px-2">📞 Lig.</th>
                          <th className="text-center py-3 px-2">💬 Wpp</th>
                          <th className="text-center py-3 px-2">📅 Agend.</th>
                          <th className="text-center py-3 px-2">👁 Visitas</th>
                          <th className="text-center py-3 px-2">📄 Docs</th>
                          <th className="text-right py-3 px-2">Pontos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankingProdutividade.slice(0, 10).map((item: any, index: number) => (
                          <tr key={item.corretorId || index} className="border-b border-slate-800/30 hover:bg-slate-800/30">
                            <td className="py-3 px-2">
                              <span className={`
                                w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                                ${index === 0 ? 'bg-yellow-400 text-yellow-900' :
                                  index === 1 ? 'bg-gray-300 text-gray-800' :
                                  index === 2 ? 'bg-amber-500 text-amber-900' :
                                  'bg-slate-700 text-gray-300'}
                              `}>
                                {index + 1}
                              </span>
                            </td>
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={item.corretorFoto} />
                                  <AvatarFallback className="text-xs bg-slate-700">
                                    {getInitials(item.corretorNome)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-gray-200 truncate max-w-[120px]">
                                  {item.corretorNome?.split(' ')[0] || 'Corretor'}
                                </span>
                              </div>
                            </td>
                            <td className="text-center py-3 px-2 text-blue-400">{item.ligacoesRealizadas}</td>
                            <td className="text-center py-3 px-2 text-green-400">{item.whatsappEnviados}</td>
                            <td className="text-center py-3 px-2 text-cyan-400">{item.agendamentosConfirmados}</td>
                            <td className="text-center py-3 px-2 text-amber-400">{item.visitasRealizadas}</td>
                            <td className="text-center py-3 px-2 text-purple-400">{item.documentacoesRecolhidas}</td>
                            <td className="text-right py-3 px-2 font-bold text-emerald-400">{item.pontuacaoTotal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              
              {/* Ranking Lateral */}
              <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-emerald-400" />
                  RANKING PONTUAÇÃO
                </h2>
                <RankingList ranking={rankingProdutividade} type="produtividade" />
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Footer com data/hora */}
      <div className="fixed bottom-4 right-4 text-xs text-gray-500 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-700/50">
        Atualizado: {new Date().toLocaleString('pt-BR')}
      </div>
    </div>
  );
}
