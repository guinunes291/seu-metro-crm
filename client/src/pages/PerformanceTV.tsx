import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Trophy, TrendingUp, Target, DollarSign, FileCheck, 
  Calendar, Maximize, RefreshCw, Users
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

// Formatar valor em reais
function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1).replace('.', ',')}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
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
function PodiumVisual({ ranking }: { ranking: any[] }) {
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
                  <AvatarFallback className={`bg-gradient-to-br ${styles.bgGradient} text-white font-bold ${position === 1 ? 'text-2xl' : 'text-lg'}`}>
                    {getInitials(corretor.corretorNome)}
                  </AvatarFallback>
                </Avatar>
                
                {/* Badge de posição */}
                <div className={`
                  absolute -bottom-2 left-1/2 -translate-x-1/2 z-20
                  ${position === 1 ? 'w-8 h-8 text-sm' : 'w-6 h-6 text-xs'}
                  rounded-full flex items-center justify-center font-bold
                  ${position === 1 ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/50' : 
                    position === 2 ? 'bg-gray-300 text-gray-800' :
                    position === 3 ? 'bg-amber-500 text-white' :
                    'bg-blue-500 text-white'}
                `}>
                  {position}
                </div>
              </div>
              
              {/* Nome e valor */}
              <div className="text-center mt-2">
                <p className={`font-bold ${position === 1 ? 'text-base' : 'text-sm'} ${styles.nameColor} truncate max-w-[100px]`}>
                  {corretor.corretorNome?.split(' ')[0]}
                </p>
                <p className={`text-xs font-semibold ${styles.valueColor}`}>
                  {formatCurrency(corretor.vgv || 0)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Componente do Ranking Lateral
function RankingList({ ranking }: { ranking: any[] }) {
  return (
    <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 overflow-hidden h-full">
      {/* Header */}
      <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-slate-800/60 border-b border-slate-700/50">
        <div className="col-span-1 text-[10px] font-semibold text-gray-400 uppercase">#</div>
        <div className="col-span-7 text-[10px] font-semibold text-gray-400 uppercase">Executivo</div>
        <div className="col-span-4 text-[10px] font-semibold text-gray-400 uppercase text-right">VGV Realizado</div>
      </div>
      
      {/* Lista */}
      <div className="max-h-[380px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
        {ranking.map((corretor, index) => (
          <div 
            key={corretor.corretorId || index}
            className={`
              grid grid-cols-12 gap-2 px-4 py-2.5 items-center
              ${index % 2 === 0 ? 'bg-slate-800/30' : 'bg-transparent'}
              hover:bg-blue-500/10 transition-colors cursor-pointer
              ${index < 3 ? 'border-l-2' : 'border-l-2 border-l-transparent'}
              ${index === 0 ? 'border-l-yellow-400' : index === 1 ? 'border-l-gray-400' : index === 2 ? 'border-l-amber-500' : ''}
            `}
          >
            <div className="col-span-1">
              <span className={`
                text-sm font-bold
                ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-500' : 'text-gray-500'}
              `}>
                {index + 1}º
              </span>
            </div>
            <div className="col-span-7 flex items-center gap-2">
              <Avatar className="w-7 h-7 border border-slate-600">
                <AvatarImage src={corretor.corretorFoto} alt={corretor.corretorNome} />
                <AvatarFallback className="bg-slate-700 text-white text-[10px]">
                  {getInitials(corretor.corretorNome)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-white truncate">{corretor.corretorNome}</span>
            </div>
            <div className="col-span-4 text-right">
              <span className={`
                text-sm font-semibold
                ${index === 0 ? 'text-yellow-400' : 'text-cyan-400'}
              `}>
                {formatFullCurrency(corretor.vgv || 0)}
              </span>
            </div>
          </div>
        ))}
        
        {ranking.length === 0 && (
          <div className="py-8 text-center text-gray-500 text-sm">
            Nenhum corretor encontrado
          </div>
        )}
      </div>
    </div>
  );
}

// Componente do Gráfico de Barras com linha de tendência
function BarChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-cyan-400" />
          RANKING DE EQUIPES
        </h3>
        <div className="h-48 flex items-center justify-center text-gray-500">
          Sem dados para exibir
        </div>
      </div>
    );
  }
  
  const maxValue = Math.max(...data.map(d => d.vgv || d.pontuacao || 1));
  const chartData = data.slice(0, 12);
  
  return (
    <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-6">
      <h3 className="text-base font-bold text-white mb-6 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-cyan-400" />
        RANKING DE EQUIPES
      </h3>
      
      {/* Gráfico de barras */}
      <div className="relative">
        {/* Barras */}
        <div className="flex items-end justify-between gap-2 h-40">
          {chartData.map((item, index) => {
            const value = item.vgv || item.pontuacao || 0;
            const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
            const isTop3 = index < 3;
            
            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-1">
                {/* Percentual */}
                <span className="text-[10px] text-cyan-400 font-medium">{Math.round(percentage)}%</span>
                
                {/* Barra */}
                <div className="w-full flex flex-col items-center">
                  <div 
                    className={`
                      w-full rounded-t transition-all duration-700
                      ${isTop3 ? 'bg-gradient-to-t from-blue-600 to-cyan-400' : 'bg-gradient-to-t from-blue-800 to-blue-600'}
                    `}
                    style={{ height: `${Math.max(percentage, 5)}%`, minHeight: '8px', maxHeight: '120px' }}
                  />
                </div>
                
                {/* Nome abreviado */}
                <span className="text-[9px] text-gray-400 truncate w-full text-center">
                  {item.corretorNome?.split(' ')[0]?.slice(0, 6) || '-'}
                </span>
              </div>
            );
          })}
        </div>
        
        {/* Linha de tendência */}
        <svg className="absolute inset-0 w-full h-40 pointer-events-none" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={chartData.map((item, index) => {
              const value = item.vgv || item.pontuacao || 0;
              const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
              const x = (index / (chartData.length - 1 || 1)) * 100;
              const y = 100 - percentage;
              return `${x}%,${y}%`;
            }).join(' ')}
          />
          {/* Pontos na linha */}
          {chartData.map((item, index) => {
            const value = item.vgv || item.pontuacao || 0;
            const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
            const x = (index / (chartData.length - 1 || 1)) * 100;
            const y = 100 - percentage;
            return (
              <circle
                key={index}
                cx={`${x}%`}
                cy={`${y}%`}
                r="4"
                fill="white"
                stroke="rgba(6,182,212,0.8)"
                strokeWidth="2"
              />
            );
          })}
        </svg>
      </div>
      
      {/* Legenda */}
      <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gradient-to-t from-blue-600 to-cyan-400" />
          <span>Performance</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-white/50 rounded" />
          <span>Tendência</span>
        </div>
      </div>
    </div>
  );
}

export default function PerformanceTV() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("12");
  const [selectedTrimester, setSelectedTrimester] = useState("4tri");
  const [selectedYear, setSelectedYear] = useState("2025");
  
  // Buscar dados de ranking
  const mes = parseInt(selectedMonth);
  const ano = parseInt(selectedYear);
  const { data: rankingData, refetch } = trpc.ranking.getCompleto.useQuery({ mes, ano });
  const { data: metas } = trpc.metas.list.useQuery();
  
  // Calcular KPIs - estrutura: { corretor, metricas, pontuacao, posicao }
  const totalVGV = rankingData?.reduce((acc, c) => acc + (c.metricas?.vgv || 0), 0) || 0;
  const totalContratos = rankingData?.reduce((acc, c) => acc + (c.metricas?.contratos || 0), 0) || 0;
  const totalCorretores = rankingData?.length || 0;
  
  // Transformar dados para o formato esperado pelos componentes
  const rankingFormatado = rankingData?.map(item => ({
    corretorId: item.corretor.id,
    corretorNome: item.corretor.nome,
    corretorFoto: item.corretor.fotoUrl,
    vgv: item.metricas.vgv,
    contratosFechados: item.metricas.contratos,
    pontuacao: item.pontuacao,
    posicao: item.posicao,
  })) || [];
  
  // Meta geral (pode vir das metas configuradas)
  const metaGeral = 50000000; // R$ 50 milhões de meta
  const gapMeta = metaGeral - totalVGV;
  const percentualMeta = metaGeral > 0 ? Math.round((totalVGV / metaGeral) * 100) : 0;
  
  // Tendência (simulada - pode ser calculada com dados históricos)
  const tendencia = totalVGV * 1.15; // Projeção de 15% a mais
  
  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Auto refresh a cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  const meses = [
    { value: "1", label: "Janeiro" },
    { value: "2", label: "Fevereiro" },
    { value: "3", label: "Março" },
    { value: "4", label: "Abril" },
    { value: "5", label: "Maio" },
    { value: "6", label: "Junho" },
    { value: "7", label: "Julho" },
    { value: "8", label: "Agosto" },
    { value: "9", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50 px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Logo e Título */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
                <span className="text-white font-bold text-lg">SM</span>
              </div>
              <div className="h-8 w-px bg-slate-700" />
              <h1 className="text-xl font-bold text-white tracking-wide">
                PERFORMANCE <span className="text-cyan-400">EM VENDAS</span>
              </h1>
            </div>
          </div>
          
          {/* Filtros */}
          <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-32 h-9 bg-slate-800/80 border-slate-700 text-white text-sm">
                <Calendar className="w-4 h-4 mr-2 text-cyan-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {meses.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedTrimester} onValueChange={setSelectedTrimester}>
              <SelectTrigger className="w-24 h-9 bg-slate-800/80 border-slate-700 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="1tri">1º Tri</SelectItem>
                <SelectItem value="2tri">2º Tri</SelectItem>
                <SelectItem value="3tri">3º Tri</SelectItem>
                <SelectItem value="4tri">4º Tri</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-20 h-9 bg-slate-800/80 border-slate-700 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="h-6 w-px bg-slate-700 mx-1" />
            
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => refetch()}
              className="h-9 w-9 text-gray-400 hover:text-white hover:bg-slate-800"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon"
              onClick={toggleFullscreen}
              className="h-9 w-9 text-gray-400 hover:text-white hover:bg-slate-800"
            >
              <Maximize className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-7 gap-3">
          <KPICard 
            label="Meta" 
            value={formatCurrency(metaGeral)}
            icon={Target}
            variant="info"
          />
          <KPICard 
            label="Faturamento" 
            value={formatCurrency(totalVGV)}
            icon={DollarSign}
            variant="success"
            percentage={percentualMeta}
          />
          <KPICard 
            label="Realizado" 
            value={`${percentualMeta}%`}
            subValue="da meta"
            icon={TrendingUp}
            variant="accent"
            highlight
          />
          <KPICard 
            label="Gap da Meta" 
            value={formatCurrency(Math.abs(gapMeta))}
            subValue={gapMeta > 0 ? "faltando" : "acima"}
            icon={Target}
            variant={gapMeta > 0 ? "danger" : "success"}
          />
          <KPICard 
            label="Tendência" 
            value={formatCurrency(tendencia)}
            icon={TrendingUp}
            variant="info"
          />
          <KPICard 
            label="Contratos" 
            value={totalContratos.toString()}
            subValue="fechados"
            icon={FileCheck}
            variant="warning"
          />
          <KPICard 
            label="Corretores" 
            value={totalCorretores.toString()}
            subValue="ativos"
            icon={Users}
            variant="default"
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 pb-6">
        <div className="grid grid-cols-12 gap-4">
          {/* Pódio e Gráfico - Lado Esquerdo */}
          <div className="col-span-8 space-y-4">
            {/* Pódio Visual */}
            <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-6">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <h2 className="text-sm font-bold text-yellow-400 tracking-wider">TOP PERFORMERS</h2>
                <Trophy className="w-5 h-5 text-yellow-400" />
              </div>
              <PodiumVisual ranking={rankingFormatado} />
            </div>
            
            {/* Gráfico de Barras */}
            <BarChart data={rankingFormatado} />
          </div>
          
          {/* Ranking Lateral - Lado Direito */}
          <div className="col-span-4">
            <RankingList ranking={rankingFormatado} />
          </div>
        </div>
      </div>
    </div>
  );
}
