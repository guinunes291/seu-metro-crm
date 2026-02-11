import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Trophy, TrendingUp, Target, DollarSign, FileCheck, 
  Calendar, Maximize, RefreshCw, Users, Phone, MessageSquare,
  CalendarCheck, Eye, FileText, Briefcase, Activity, ChevronDown,
  Settings, Save, ArrowUp, ArrowDown, Minus
} from "lucide-react";
import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subWeeks, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

// Tipos de período
type PeriodOption = 
  | "all" | "today" | "yesterday" | "this_week" | "last_week"
  | "this_month" | "last_month" | "this_year" | "custom";

interface DateRange { from: Date | undefined; to: Date | undefined; }

const periodLabels: Record<PeriodOption, string> = {
  all: "Todo o período", today: "Hoje", yesterday: "Ontem",
  this_week: "Esta semana", last_week: "Semana passada",
  this_month: "Este mês", last_month: "Mês passado",
  this_year: "Este ano", custom: "Personalizado",
};

function getDateRangeForPeriod(period: PeriodOption, customRange?: DateRange): DateRange {
  const now = new Date();
  switch (period) {
    case "all": return { from: new Date(2020, 0, 1), to: now };
    case "today": return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": { const y = subDays(now, 1); return { from: startOfDay(y), to: endOfDay(y) }; }
    case "this_week": return { from: startOfWeek(now, { locale: ptBR }), to: endOfWeek(now, { locale: ptBR }) };
    case "last_week": { const lw = subWeeks(now, 1); return { from: startOfWeek(lw, { locale: ptBR }), to: endOfWeek(lw, { locale: ptBR }) }; }
    case "this_month": return { from: startOfMonth(now), to: endOfMonth(now) };
    case "last_month": { const lm = subMonths(now, 1); return { from: startOfMonth(lm), to: endOfMonth(lm) }; }
    case "this_year": return { from: startOfYear(now), to: endOfYear(now) };
    case "custom": return customRange || { from: undefined, to: undefined };
    default: return { from: undefined, to: undefined };
  }
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1).replace('.', ',')}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}K`;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatCurrencyReais(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ============================================================================
// COMPONENTES DE UI PUROS (SEM CHART.JS)
// ============================================================================

function KPICard({ label, value, icon: Icon, variant = "default", subValue, percentage, highlight = false }: { 
  label: string; value: string; icon: any; 
  variant?: "default" | "success" | "warning" | "danger" | "info" | "accent";
  subValue?: string; percentage?: number; highlight?: boolean;
}) {
  const variants: Record<string, string> = {
    default: "bg-slate-800/60 border-slate-700/50", success: "bg-emerald-900/40 border-emerald-500/40",
    warning: "bg-amber-900/40 border-amber-500/40", danger: "bg-red-900/40 border-red-500/40",
    info: "bg-blue-900/40 border-blue-500/40", accent: "bg-cyan-900/40 border-cyan-500/40",
  };
  const iconColors: Record<string, string> = { default: "text-slate-300", success: "text-emerald-300", warning: "text-amber-300", danger: "text-red-300", info: "text-blue-300", accent: "text-cyan-300" };
  const labelColors: Record<string, string> = { default: "text-slate-200", success: "text-emerald-200", warning: "text-amber-200", danger: "text-red-200", info: "text-blue-200", accent: "text-cyan-200" };

  return (
    <div className={`relative rounded-xl p-4 border backdrop-blur-sm ${variants[variant]} ${highlight ? 'ring-2 ring-cyan-400/50' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`text-[11px] uppercase tracking-wider font-semibold mb-1 ${labelColors[variant]}`}>{label}</p>
          <p className="text-2xl font-bold text-white leading-tight drop-shadow-sm">{value}</p>
          {subValue && <p className="text-[11px] text-gray-300 mt-0.5 font-medium">{subValue}</p>}
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

// SVG Gauge Chart - PURO CSS/SVG, sem Chart.js
function GaugeChart({ percentage, label }: { percentage: number; label: string }) {
  const clampedPct = Math.min(Math.max(percentage, 0), 100);
  const getColor = (pct: number) => {
    if (pct >= 100) return '#10b981';
    if (pct >= 75) return '#22c55e';
    if (pct >= 50) return '#f59e0b';
    if (pct >= 25) return '#ef4444';
    return '#dc2626';
  };
  
  const radius = 70;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75; // 270 degrees
  const filledLength = arcLength * (clampedPct / 100);
  const emptyLength = arcLength - filledLength;

  return (
    <div className="relative flex flex-col items-center">
      <div className="w-48 h-48 relative">
        <svg viewBox="0 0 180 180" className="w-full h-full transform rotate-[135deg]">
          {/* Background arc */}
          <circle cx="90" cy="90" r={radius} fill="none" stroke="rgba(51, 65, 85, 0.5)"
            strokeWidth={strokeWidth} strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round" />
          {/* Filled arc */}
          <circle cx="90" cy="90" r={radius} fill="none" stroke={getColor(percentage)}
            strokeWidth={strokeWidth} strokeDasharray={`${filledLength} ${circumference}`}
            strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.5s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-white">{percentage.toFixed(1)}%</span>
          <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
        </div>
      </div>
    </div>
  );
}

// Gráfico de Barras CSS - Evolução Mensal
function EvolucaoMensalChart({ data }: { data: any[] }) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const [hoveredType, setHoveredType] = React.useState<'fat' | 'meta' | null>(null);
  
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-48 text-gray-400">Sem dados</div>;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const maxVal = Math.max(...data.map(d => Math.max(d.vgvRealizado || 0, Number(d.metaVGV || 0))), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-400">
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-purple-500/70" /> Faturamento</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded border-2 border-indigo-400 border-dashed" /> Meta</div>
      </div>
      <div className="flex items-end gap-2 h-[260px]">
        {data.map((d, i) => {
          const fat = d.vgvRealizado || 0;
          const meta = Number(d.metaVGV || 0);
          const fatPct = (fat / maxVal) * 100;
          const metaPct = (meta / maxVal) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end relative">
              <div className="text-[9px] text-gray-300 font-semibold">
                {fat >= 1000000 ? `${(fat/1000000).toFixed(1)}M` : fat >= 1000 ? `${(fat/1000).toFixed(0)}K` : fat > 0 ? fat.toFixed(0) : ''}
              </div>
              <div className="w-full relative flex items-end justify-center" style={{ height: `${Math.max(fatPct, metaPct, 5)}%` }}>
                {/* Barra de faturamento */}
                <div 
                  className="w-[60%] bg-gradient-to-t from-purple-600 to-purple-400 rounded-t-md transition-all duration-500 cursor-pointer hover:from-purple-500 hover:to-purple-300"
                  style={{ height: `${fatPct > 0 ? (fatPct / Math.max(fatPct, metaPct, 5)) * 100 : 0}%`, minHeight: fat > 0 ? '4px' : '0' }}
                  onMouseEnter={() => { setHoveredIndex(i); setHoveredType('fat'); }}
                  onMouseLeave={() => { setHoveredIndex(null); setHoveredType(null); }}
                />
                {/* Linha de meta */}
                {meta > 0 && (
                  <div 
                    className="absolute w-[90%] border-t-2 border-dashed border-indigo-400 cursor-pointer hover:border-indigo-300"
                    style={{ bottom: `${(metaPct / Math.max(fatPct, metaPct, 5)) * 100}%` }}
                    onMouseEnter={() => { setHoveredIndex(i); setHoveredType('meta'); }}
                    onMouseLeave={() => { setHoveredIndex(null); setHoveredType(null); }}
                  />
                )}
                {/* Tooltip */}
                {hoveredIndex === i && hoveredType && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-3 py-2 rounded-lg shadow-xl border border-slate-700 whitespace-nowrap z-10">
                    <div className="font-semibold">{d.mesNome}</div>
                    <div className="text-gray-300">
                      {hoveredType === 'fat' ? (
                        <><span className="text-purple-400">Faturamento:</span> {formatCurrency(fat)}</>
                      ) : (
                        <><span className="text-indigo-400">Meta:</span> {formatCurrency(meta)}</>
                      )}
                    </div>
                    {/* Seta do tooltip */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-800" />
                  </div>
                )}
              </div>
              <span className="text-[10px] text-gray-400 font-medium">{d.mesNome}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Gráfico de Atingimento Mensal - Barras CSS
function AtingimentoMensalChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-48 text-gray-400">Sem dados</div>;
  }

  const maxDeviation = Math.max(...data.map(d => Math.abs((d.percentual || 0) - 100)), 10);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 h-[220px]">
        {data.map((d, i) => {
          const pct = d.percentual || 0;
          const deviation = pct - 100;
          const isPositive = deviation >= 0;
          const barHeight = Math.min(Math.abs(deviation) / maxDeviation * 45, 45);
          
          return (
            <div key={i} className="flex-1 flex flex-col items-center h-full relative">
              {/* Valor no topo */}
              <div className={`text-[9px] font-bold absolute ${isPositive ? 'top-0' : 'bottom-6'} ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {pct.toFixed(1)}%
              </div>
              {/* Container da barra centralizado */}
              <div className="flex-1 flex items-center w-full justify-center">
                <div className="relative w-[70%] h-full flex items-center">
                  {/* Linha de 100% */}
                  <div className="absolute w-full border-t border-slate-600 top-1/2" />
                  {/* Barra */}
                  <div className={`absolute w-full rounded-sm transition-all duration-500 ${isPositive ? 'bg-emerald-500/70' : 'bg-red-500/70'}`}
                    style={{
                      height: `${barHeight}%`,
                      ...(isPositive ? { bottom: '50%' } : { top: '50%' }),
                    }} />
                </div>
              </div>
              <span className="text-[9px] text-gray-400 font-medium mt-1">{d.mesNome}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Barras Horizontais CSS - Faturamento por Vendedor
function FaturamentoPorVendedorChart({ corretores }: { corretores: any[] }) {
  if (!corretores || corretores.length === 0) {
    return <div className="flex items-center justify-center h-48 text-gray-400">Sem dados</div>;
  }

  const top10 = corretores.slice(0, 10);
  const maxVal = Math.max(...top10.map(c => (c.vgv || 0) / 100), 1);
  const colors = [
    'from-purple-500 to-purple-400', 'from-indigo-500 to-indigo-400', 'from-blue-500 to-blue-400',
    'from-sky-500 to-sky-400', 'from-cyan-500 to-cyan-400', 'from-teal-500 to-teal-400',
    'from-emerald-500 to-emerald-400', 'from-lime-500 to-lime-400', 'from-yellow-500 to-yellow-400',
    'from-orange-500 to-orange-400',
  ];

  return (
    <div className="space-y-3">
      {top10.map((c, i) => {
        const val = (c.vgv || 0) / 100;
        const pct = (val / maxVal) * 100;
        return (
          <div key={c.id || i} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-300 font-medium truncate max-w-[120px]">{c.nome?.split(' ')[0] || 'Corretor'}</span>
              <span className="text-white font-semibold">
                {val >= 1000000 ? `R$ ${(val/1000000).toFixed(1)}M` : val >= 1000 ? `R$ ${(val/1000).toFixed(0)}K` : `R$ ${val.toFixed(0)}`}
              </span>
            </div>
            <div className="h-5 bg-slate-800/60 rounded-md overflow-hidden">
              <div className={`h-full rounded-md bg-gradient-to-r ${colors[i] || colors[0]} transition-all duration-700`}
                style={{ width: `${Math.max(pct, 2)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Tabela de Vendedores com Meta
function TabelaVendedoresMeta({ corretores }: { corretores: any[] }) {
  if (!corretores || corretores.length === 0) {
    return <div className="flex items-center justify-center h-48 text-gray-400">Sem dados de vendedores</div>;
  }

  const totalVGV = corretores.reduce((acc, c) => acc + (c.vgv || 0), 0);
  const totalMeta = corretores.reduce((acc, c) => acc + (c.metaVGV || 0), 0);
  const totalDiff = totalVGV - totalMeta;
  const totalPct = totalMeta > 0 ? ((totalVGV / totalMeta) * 100) : 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-300 border-b border-slate-700/50">
            <th className="text-left py-3 px-3 font-semibold">Vendedor</th>
            <th className="text-right py-3 px-3 font-semibold">Faturamento</th>
            <th className="text-right py-3 px-3 font-semibold">Meta</th>
            <th className="text-center py-3 px-3 font-semibold">Real x Meta</th>
            <th className="text-right py-3 px-3 font-semibold">% Real x Meta</th>
          </tr>
        </thead>
        <tbody>
          {corretores.map((corretor, index) => {
            const vgv = (corretor.vgv || 0) / 100;
            const meta = (corretor.metaVGV || 0) / 100;
            const diff = vgv - meta;
            const pct = meta > 0 ? ((vgv / meta) * 100 - 100) : 0;
            const isPositive = diff >= 0;

            return (
              <tr key={corretor.id || index} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={corretor.fotoUrl || undefined} />
                      <AvatarFallback className="text-[10px] bg-slate-700 text-white">{getInitials(corretor.nome)}</AvatarFallback>
                    </Avatar>
                    <span className="text-white font-medium">{corretor.nome || 'Corretor'}</span>
                  </div>
                </td>
                <td className="py-3 px-3 text-right text-white font-semibold">{formatCurrencyReais(vgv)}</td>
                <td className="py-3 px-3 text-right text-gray-400">{formatCurrencyReais(meta)}</td>
                <td className="py-3 px-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {isPositive ? <ArrowUp className="w-4 h-4 text-emerald-400" /> : diff === 0 ? <Minus className="w-4 h-4 text-gray-400" /> : <ArrowDown className="w-4 h-4 text-red-400" />}
                    <span className={isPositive ? 'text-emerald-400' : diff === 0 ? 'text-gray-400' : 'text-red-400'}>{formatCurrencyReais(Math.abs(diff))}</span>
                  </div>
                </td>
                <td className={`py-3 px-3 text-right font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isPositive ? '+' : ''}{pct.toFixed(2)}%
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-600 bg-slate-800/30">
            <td className="py-3 px-3 text-white font-bold">Total</td>
            <td className="py-3 px-3 text-right text-white font-bold">{formatCurrencyReais(totalVGV / 100)}</td>
            <td className="py-3 px-3 text-right text-gray-400 font-bold">{formatCurrencyReais(totalMeta / 100)}</td>
            <td className="py-3 px-3 text-center">
              <span className={totalDiff >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{formatCurrencyReais(Math.abs(totalDiff / 100))}</span>
            </td>
            <td className={`py-3 px-3 text-right font-bold ${totalPct >= 100 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalPct >= 100 ? '+' : ''}{(totalPct - 100).toFixed(2)}%
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// Pódio Visual
function PodiumVisual({ ranking, type = "vgv" }: { ranking: any[]; type?: "vgv" | "produtividade" }) {
  if (ranking.length === 0) return <div className="flex items-center justify-center h-48 text-gray-400"><p>Nenhum corretor no ranking</p></div>;
  
  const top6 = ranking.slice(0, 6);
  const podiumOrder = [
    { data: top6[3], position: 4 }, { data: top6[1], position: 2 },
    { data: top6[0], position: 1 }, { data: top6[2], position: 3 },
    { data: top6[4], position: 5 }, { data: top6[5], position: 6 },
  ].filter(item => item.data);

  const getStyles = (position: number) => {
    switch(position) {
      case 1: return { size: 'w-32 h-32', border: 'border-[5px] border-yellow-400', glow: 'shadow-[0_0_50px_rgba(250,204,21,0.5)]', ring: 'ring-4 ring-yellow-300/30', nameColor: 'text-yellow-300', valueColor: 'text-yellow-200', bgGradient: 'from-yellow-500 to-amber-600' };
      case 2: return { size: 'w-26 h-26', border: 'border-4 border-gray-300', glow: 'shadow-[0_0_40px_rgba(209,213,219,0.4)]', ring: 'ring-2 ring-gray-300/30', nameColor: 'text-gray-100', valueColor: 'text-gray-200', bgGradient: 'from-gray-400 to-gray-600' };
      case 3: return { size: 'w-24 h-24', border: 'border-4 border-amber-500', glow: 'shadow-[0_0_35px_rgba(245,158,11,0.4)]', ring: 'ring-2 ring-amber-400/30', nameColor: 'text-amber-300', valueColor: 'text-amber-200', bgGradient: 'from-amber-600 to-orange-700' };
      default: return { size: 'w-20 h-20', border: 'border-3 border-blue-400/60', glow: 'shadow-[0_0_25px_rgba(96,165,250,0.3)]', ring: 'ring-2 ring-blue-400/20', nameColor: 'text-blue-200', valueColor: 'text-cyan-300', bgGradient: 'from-blue-500 to-blue-700' };
    }
  };

  return (
    <div className="relative">
      <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
      <div className="flex items-end justify-center gap-3 py-4">
        {podiumOrder.map(({ data: corretor, position }) => {
          if (!corretor) return null;
          const styles = getStyles(position);
          const displayValue = type === "vgv" ? formatCurrency(corretor.vgvTotal || 0) : `${corretor.pontuacaoTotal || 0} pts`;
          return (
            <div key={corretor.corretorId || position} className={`flex flex-col items-center transition-all duration-300 hover:scale-105 ${position === 1 ? 'z-10' : ''}`}>
              <div className={`relative ${position === 1 ? 'mb-3' : 'mb-2'}`}>
                <div className={`absolute -top-2 -right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold bg-gradient-to-br ${styles.bgGradient} text-white shadow-lg border-2 border-white/20`}>{position}</div>
                <Avatar className={`${styles.size} ${styles.border} ${styles.glow} ${styles.ring} transition-all duration-300`}>
                  <AvatarImage src={corretor.corretorFoto || undefined} />
                  <AvatarFallback className={`bg-gradient-to-br ${styles.bgGradient} text-white text-lg font-bold`}>{getInitials(corretor.corretorNome)}</AvatarFallback>
                </Avatar>
              </div>
              <p className={`font-bold text-sm ${styles.nameColor} text-center max-w-[120px] truncate`}>{corretor.corretorNome?.split(' ')[0] || 'Corretor'}</p>
              <p className={`text-xs font-semibold ${styles.valueColor}`}>{displayValue}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Ranking Lateral
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
          <div key={item.corretorId || index} className={`grid grid-cols-12 gap-2 items-center py-2 px-2 rounded-lg ${index < 3 ? 'bg-slate-800/40' : 'hover:bg-slate-800/30'} transition-colors`}>
            <div className={`col-span-1 font-bold text-sm ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-400' : 'text-gray-500'}`}>{index + 1}º</div>
            <div className="col-span-7 flex items-center gap-2">
              <Avatar className="w-7 h-7">
                <AvatarImage src={item.corretorFoto || undefined} />
                <AvatarFallback className="text-[10px] bg-slate-700 text-white">{getInitials(item.corretorNome)}</AvatarFallback>
              </Avatar>
              <span className="text-sm text-white truncate">{item.corretorNome || 'Corretor'}</span>
            </div>
            <div className={`col-span-4 text-right text-sm font-semibold ${index === 0 ? 'text-yellow-300' : index === 1 ? 'text-gray-200' : index === 2 ? 'text-amber-300' : 'text-cyan-300'}`}>
              {type === "vgv" ? formatFullCurrency(item.vgvTotal || 0) : `${item.pontuacaoTotal || 0} pts`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Barras com Trend (CSS puro)
function BarChartWithTrend({ data, type = "vgv" }: { data: any[]; type?: "vgv" | "produtividade" }) {
  if (data.length === 0) return <div className="flex items-center justify-center h-48 text-gray-400"><p>Sem dados</p></div>;
  const maxValue = type === "vgv" ? Math.max(...data.map(d => d.vgvTotal || 0)) : Math.max(...data.map(d => d.pontuacaoTotal || 0));
  
  return (
    <div className="space-y-3">
      {data.slice(0, 10).map((item, index) => {
        const value = type === "vgv" ? (item.vgvTotal || 0) : (item.pontuacaoTotal || 0);
        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
        return (
          <div key={item.corretorId || index} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-300 font-medium">{item.corretorNome?.split(' ')[0] || 'Corretor'}</span>
              <span className="text-white font-semibold">{type === "vgv" ? formatCurrency(value) : `${value} pts`}</span>
            </div>
            <div className="h-6 bg-slate-800/60 rounded-lg overflow-hidden relative">
              <div className={`h-full rounded-lg transition-all duration-500 ${index === 0 ? 'bg-gradient-to-r from-yellow-500 to-amber-500' : index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-500' : index === 2 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'}`} style={{ width: `${percentage}%` }} />
              <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-slate-900" style={{ left: `calc(${percentage}% - 6px)` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Modal de Configuração de Metas
function MetasConfigModal({ mes, ano }: { mes: number; ano: number }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data: metaGlobal, refetch } = trpc.metasGlobais.get.useQuery({ mes, ano });
  const updateMeta = trpc.metasGlobais.update.useMutation({
    onSuccess: () => { toast.success("Meta atualizada!"); refetch(); },
    onError: (err) => { toast.error("Erro: " + err.message); },
  });

  const [formData, setFormData] = useState({ metaVGV: '', metaContratos: 0, metaLeads: 0, metaAgendamentos: 0, metaVisitas: 0 });

  useEffect(() => {
    if (metaGlobal) {
      setFormData({
        metaVGV: (Number(metaGlobal.metaVGV || 0) / 100).toString(),
        metaContratos: metaGlobal.metaContratos || 0, metaLeads: metaGlobal.metaLeads || 0,
        metaAgendamentos: metaGlobal.metaAgendamentos || 0, metaVisitas: metaGlobal.metaVisitas || 0,
      });
    }
  }, [metaGlobal]);

  const handleSave = () => {
    if (!metaGlobal?.id) return;
    updateMeta.mutate({
      id: metaGlobal.id,
      metaVGV: (Number(formData.metaVGV.replace(/[^\d.,]/g, '').replace(',', '.')) * 100).toString(),
      metaContratos: Number(formData.metaContratos), metaLeads: Number(formData.metaLeads),
      metaAgendamentos: Number(formData.metaAgendamentos), metaVisitas: Number(formData.metaVisitas),
    });
  };

  if (!isAdmin) return null;
  const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-slate-800/50 border-slate-700/50 text-white hover:bg-slate-700/50 hover:text-white">
          <Settings className="w-4 h-4" /> Configurar Metas
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Configurar Metas - {mesesNomes[mes - 1]} {ano}</DialogTitle>
          <DialogDescription className="text-gray-400">Defina as metas globais da operação para este mês.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm text-gray-300 mb-1 block">Meta de VGV (R$)</label>
            <Input type="text" value={formData.metaVGV} onChange={(e) => setFormData({ ...formData, metaVGV: e.target.value })} className="bg-slate-800 border-slate-700 text-white" placeholder="Ex: 500000" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm text-gray-300 mb-1 block">Meta de Contratos</label><Input type="number" value={formData.metaContratos} onChange={(e) => setFormData({ ...formData, metaContratos: Number(e.target.value) })} className="bg-slate-800 border-slate-700 text-white" /></div>
            <div><label className="text-sm text-gray-300 mb-1 block">Meta de Leads</label><Input type="number" value={formData.metaLeads} onChange={(e) => setFormData({ ...formData, metaLeads: Number(e.target.value) })} className="bg-slate-800 border-slate-700 text-white" /></div>
            <div><label className="text-sm text-gray-300 mb-1 block">Meta de Agendamentos</label><Input type="number" value={formData.metaAgendamentos} onChange={(e) => setFormData({ ...formData, metaAgendamentos: Number(e.target.value) })} className="bg-slate-800 border-slate-700 text-white" /></div>
            <div><label className="text-sm text-gray-300 mb-1 block">Meta de Visitas</label><Input type="number" value={formData.metaVisitas} onChange={(e) => setFormData({ ...formData, metaVisitas: Number(e.target.value) })} className="bg-slate-800 border-slate-700 text-white" /></div>
          </div>
          <Button onClick={handleSave} disabled={updateMeta.isPending} className="w-full bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" /> {updateMeta.isPending ? 'Salvando...' : 'Salvar Metas'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function PerformanceTV() {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState<PeriodOption>('this_month');
  const [customRange, setCustomRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'realxmeta' | 'vgv' | 'produtividade'>('realxmeta');
  
  const [selectedMes, setSelectedMes] = useState(() => new Date().getMonth() + 1);
  const [selectedAno, setSelectedAno] = useState(() => new Date().getFullYear());
  const [selectedEquipeId, setSelectedEquipeId] = useState<number | undefined>(undefined);
  
  // Buscar lista de equipes (admin vê todas, gestor vê apenas sua equipe)
  const { data: equipes } = trpc.equipes.list.useQuery(undefined, {
    enabled: user?.role === 'admin' || user?.role === 'gestor',
  });
  
  const dateRange = useMemo(() => getDateRangeForPeriod(periodo, customRange), [periodo, customRange]);
  
  const dateRangeInput = useMemo(() => ({
    dataInicio: dateRange.from, dataFim: dateRange.to,
  }), [dateRange.from?.getTime(), dateRange.to?.getTime()]);
  
  const { data: rankingVGV, refetch: refetchVGV } = trpc.ranking.getCompleto.useQuery();
  const { data: rankingPeriodo, refetch: refetchPeriodo } = trpc.ranking.porPeriodo.useQuery(dateRangeInput);
  const { data: dashboardData, refetch: refetchDashboard } = trpc.dashboardPerformance.getData.useQuery({ 
    mes: selectedMes, 
    ano: selectedAno,
    equipeId: selectedEquipeId, // Filtro de equipe (apenas admin)
  });
  const { data: evolucaoMensal, refetch: refetchEvolucao } = trpc.dashboardPerformance.evolucaoMensal.useQuery({ 
    ano: selectedAno,
    equipeId: selectedEquipeId, // Filtro de equipe (apenas admin)
  });
  
  useEffect(() => {
    const interval = setInterval(() => { refetchVGV(); refetchPeriodo(); refetchDashboard(); refetchEvolucao(); }, 30000);
    return () => clearInterval(interval);
  }, [refetchVGV, refetchPeriodo, refetchDashboard, refetchEvolucao]);
  
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); setIsFullscreen(true); }
    else { document.exitFullscreen(); setIsFullscreen(false); }
  };
  
  const handlePeriodSelect = (period: PeriodOption) => {
    if (period === "custom") { setIsCalendarOpen(true); return; }
    setPeriodo(period);
  };
  
  const handleCustomRangeSelect = () => {
    if (tempRange.from && tempRange.to) { setCustomRange(tempRange); setPeriodo("custom"); setIsCalendarOpen(false); }
  };
  
  const periodLabel = useMemo(() => {
    if (periodo === "custom" && customRange?.from && customRange?.to) {
      return `${format(customRange.from, "dd/MM/yy", { locale: ptBR })} - ${format(customRange.to, "dd/MM/yy", { locale: ptBR })}`;
    }
    return periodLabels[periodo];
  }, [periodo, customRange]);
  
  const rankingFormatado = useMemo(() => 
    rankingVGV?.map((item: any, index: number) => ({
      corretorId: item.corretorId, corretorNome: item.corretorNome, corretorFoto: item.corretorFoto,
      vgvTotal: item.vgvTotal || 0, contratosFechados: item.contratosFechados || 0, posicao: index + 1,
    })) || []
  , [rankingVGV]);

  const rankingProdutividade = useMemo(() => 
    rankingPeriodo?.map((item: any, index: number) => ({
      corretorId: item.corretorId, corretorNome: item.corretorNome, corretorFoto: item.corretorFoto,
      pontuacaoTotal: Number(item.totalPontos) || 0,
      ligacoesRealizadas: Number(item.totalLigacoes) || 0, ligacoesAtendidas: 0,
      whatsappEnviados: Number(item.totalWhatsapp) || 0, whatsappRespondidos: 0,
      agendamentosConfirmados: Number(item.totalAgendamentos) || 0,
      visitasRealizadas: Number(item.totalVisitas) || 0,
      documentacoesRecolhidas: Number(item.totalDocumentacoes) || 0,
      posicao: index + 1,
    })) || []
  , [rankingPeriodo]);
  
  const { totalVGV, totalContratos, totalCorretores } = useMemo(() => ({
    totalVGV: rankingFormatado.reduce((acc: number, item: any) => acc + (item.vgvTotal || 0), 0),
    totalContratos: rankingFormatado.reduce((acc: number, item: any) => acc + (item.contratosFechados || 0), 0),
    totalCorretores: rankingFormatado.length,
  }), [rankingFormatado]);
  
  const { totalLigacoes, totalWhatsapp, totalAgendamentos, totalVisitas, totalDocumentacoes, totalPontos } = useMemo(() => ({
    totalLigacoes: rankingProdutividade.reduce((acc: number, item: any) => acc + (item.ligacoesRealizadas || 0), 0),
    totalWhatsapp: rankingProdutividade.reduce((acc: number, item: any) => acc + (item.whatsappEnviados || 0), 0),
    totalAgendamentos: rankingProdutividade.reduce((acc: number, item: any) => acc + (item.agendamentosConfirmados || 0), 0),
    totalVisitas: rankingProdutividade.reduce((acc: number, item: any) => acc + (item.visitasRealizadas || 0), 0),
    totalDocumentacoes: rankingProdutividade.reduce((acc: number, item: any) => acc + (item.documentacoesRecolhidas || 0), 0),
    totalPontos: rankingProdutividade.reduce((acc: number, item: any) => acc + (item.pontuacaoTotal || 0), 0),
  }), [rankingProdutividade]);
  
  const resumo = dashboardData?.resumo;
  const metaVGV = resumo?.metaVGV || 50000000;
  const faturamento = resumo?.totalVGV || 0;
  const percentualAtingimento = resumo?.percentualAtingimento || 0;
  const gapMeta = resumo?.gapMeta || 0;
  const corretoresDashboard = useMemo(() => dashboardData?.corretores || [], [dashboardData?.corretores]);
  const evolucaoData = useMemo(() => evolucaoMensal || [], [evolucaoMensal]);
  
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">SEU METRO QUADRADO</h1>
                  <p className="text-[10px] text-cyan-300 uppercase tracking-wider font-medium">
                    Performance em Vendas {user?.role === 'gestor' ? '(Minha Equipe)' : '(Operação Completa)'}
                  </p>
                </div>
              </div>
            </div>
            
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mx-4">
              <TabsList className="bg-slate-800/50 border border-slate-700/50">
                <TabsTrigger value="realxmeta" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-300">
                  <Target className="w-4 h-4 mr-2" /> Real x Meta
                </TabsTrigger>
                <TabsTrigger value="vgv" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-300">
                  <DollarSign className="w-4 h-4 mr-2" /> VGV / Vendas
                </TabsTrigger>
                <TabsTrigger value="produtividade" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-gray-300">
                  <Activity className="w-4 h-4 mr-2" /> Produtividade
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="flex items-center gap-2">
              {/* Filtro de Equipe (apenas admin) */}
              {user?.role === 'admin' && equipes && equipes.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2 bg-slate-800/50 border-slate-700/50 text-white hover:bg-slate-700/50 hover:text-white">
                      <Users className="h-4 w-4" /> 
                      {selectedEquipeId ? equipes.find(e => e.id === selectedEquipeId)?.nome || 'Equipe' : 'Todas as Equipes'}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem 
                      onClick={() => setSelectedEquipeId(undefined)}
                      className={!selectedEquipeId ? "bg-accent" : ""}>
                      Todas as Equipes
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {equipes.map((equipe) => (
                      <DropdownMenuItem 
                        key={equipe.id} 
                        onClick={() => setSelectedEquipeId(equipe.id)}
                        className={selectedEquipeId === equipe.id ? "bg-accent" : ""}>
                        {equipe.nome}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              {activeTab === 'realxmeta' && (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="gap-2 bg-slate-800/50 border-slate-700/50 text-white hover:bg-slate-700/50 hover:text-white">
                        <Calendar className="h-4 w-4" /> {meses[selectedMes - 1]} {selectedAno} <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 max-h-80 overflow-y-auto">
                      {[2026, 2025, 2024].map(ano => (
                        <div key={ano}>
                          <DropdownMenuSeparator />
                          <div className="px-2 py-1 text-xs font-bold text-gray-500">{ano}</div>
                          {meses.map((mesNome, idx) => (
                            <DropdownMenuItem key={`${ano}-${idx}`} onClick={() => { setSelectedMes(idx + 1); setSelectedAno(ano); }}
                              className={selectedMes === idx + 1 && selectedAno === ano ? "bg-accent" : ""}>
                              {mesNome} {ano}
                            </DropdownMenuItem>
                          ))}
                        </div>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <MetasConfigModal mes={selectedMes} ano={selectedAno} />
                </>
              )}
              
              {activeTab !== 'realxmeta' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2 bg-slate-800/50 border-slate-700/50 text-white hover:bg-slate-700/50 hover:text-white">
                      <Calendar className="h-4 w-4" /> {periodLabel} <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {Object.entries(periodLabels).filter(([key]) => key !== 'custom').map(([key, label]) => (
                      <DropdownMenuItem key={key} onClick={() => handlePeriodSelect(key as PeriodOption)} className={periodo === key ? "bg-accent" : ""}>{label}</DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handlePeriodSelect("custom")}>Personalizado...</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              <Button variant="outline" size="icon" onClick={toggleFullscreen} className="bg-slate-800/50 border-slate-700/50 text-white hover:bg-slate-700/50 hover:text-white">
                <Maximize className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => { refetchVGV(); refetchPeriodo(); refetchDashboard(); refetchEvolucao(); }} className="bg-slate-800/50 border-slate-700/50 text-white hover:bg-slate-700/50 hover:text-white">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {isCalendarOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setIsCalendarOpen(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-4">Selecione o período</h3>
            <CalendarComponent mode="range" selected={{ from: tempRange.from, to: tempRange.to }}
              onSelect={(range: any) => setTempRange({ from: range?.from, to: range?.to })} locale={ptBR} className="text-white" />
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsCalendarOpen(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleCustomRangeSelect} className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!tempRange.from || !tempRange.to}>Aplicar</Button>
            </div>
          </div>
        </div>
      )}
      
      <div className="container mx-auto px-4 py-6">
        {/* ABA REAL x META */}
        {activeTab === 'realxmeta' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6">
                <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">FATURAMENTO: REALIZADO x META</h3>
                <div className="flex items-center gap-6">
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-1">FATURAMENTO</p>
                    <p className="text-3xl font-bold text-purple-300">{formatCurrency(faturamento)}</p>
                    <p className="text-xs text-gray-400 mt-3 mb-1">META</p>
                    <p className="text-xl font-semibold text-gray-300">{formatCurrency(metaVGV)}</p>
                    <p className="text-xs text-gray-400 mt-3 mb-1">GAP DA META</p>
                    <p className={`text-lg font-semibold ${gapMeta > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {gapMeta > 0 ? '-' : '+'}{formatCurrency(Math.abs(gapMeta))}
                    </p>
                  </div>
                  <GaugeChart percentage={percentualAtingimento} label="% Atingimento" />
                </div>
              </div>
              
              <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6">
                <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">% ATINGIMENTO DA META AO LONGO DO TEMPO</h3>
                <AtingimentoMensalChart data={evolucaoData} />
              </div>
              
              <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6 space-y-3">
                <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">INDICADORES DO MÊS</h3>
                <div className="grid grid-cols-2 gap-3">
                  <KPICard label="Contratos" value={(resumo?.totalContratos || 0).toString()} icon={FileCheck} variant="success" />
                  <KPICard label="Leads" value={(resumo?.totalLeads || 0).toString()} icon={Users} variant="info" />
                  <KPICard label="Agendamentos" value={(resumo?.totalAgendamentos || 0).toString()} icon={CalendarCheck} variant="accent" />
                  <KPICard label="Visitas" value={(resumo?.totalVisitas || 0).toString()} icon={Eye} variant="warning" />
                </div>
                <KPICard label="Corretores Ativos" value={(resumo?.totalCorretores || 0).toString()} icon={Users} variant="info" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6">
                <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-purple-400" /> FATURAMENTO POR VENDEDOR
                </h3>
                <FaturamentoPorVendedorChart corretores={corretoresDashboard} />
              </div>
              
              <div className="lg:col-span-2 bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6">
                <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-400" /> EVOLUÇÃO FATURAMENTO E META AO LONGO DO TEMPO
                </h3>
                <EvolucaoMensalChart data={evolucaoData} />
              </div>
            </div>
            
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6">
              <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-purple-400" /> FATURAMENTO POR VENDEDOR - REAL x META
              </h3>
              <TabelaVendedoresMeta corretores={corretoresDashboard} />
            </div>
          </>
        )}
        
        {/* ABA VGV / VENDAS */}
        {activeTab === 'vgv' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
              <KPICard label="Meta" value={formatCurrency(metaVGV)} icon={Target} variant="info" />
              <KPICard label="Faturamento" value={formatCurrency(totalVGV)} icon={DollarSign} variant="success" highlight />
              <KPICard label="Realizado" value={`${totalVGV > 0 ? Math.round((totalVGV / metaVGV) * 100) : 0}%`} icon={TrendingUp} variant={totalVGV >= metaVGV ? "success" : totalVGV >= metaVGV * 0.5 ? "warning" : "danger"} />
              <KPICard label="Gap da Meta" value={formatCurrency(Math.abs(metaVGV - totalVGV))} subValue={metaVGV - totalVGV > 0 ? "faltam" : "excedido"} icon={Target} variant={metaVGV - totalVGV > 0 ? "warning" : "success"} />
              <KPICard label="Tendência" value={`${totalVGV > 0 ? Math.round((totalVGV / metaVGV) * 100) : 0}%`} icon={TrendingUp} variant="accent" />
              <KPICard label="Contratos" value={totalContratos.toString()} icon={FileCheck} variant="success" />
              <KPICard label="Corretores" value={totalCorretores.toString()} icon={Users} variant="info" />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6">
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-400" /> TOP PERFORMERS - VGV</h2>
                  <PodiumVisual ranking={rankingFormatado} type="vgv" />
                </div>
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6">
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-cyan-400" /> RANKING DE EQUIPES</h2>
                  <BarChartWithTrend data={rankingFormatado} type="vgv" />
                </div>
              </div>
              <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-cyan-400" /> RANKING VGV</h2>
                <RankingLateral ranking={rankingFormatado} type="vgv" />
              </div>
            </div>
          </>
        )}
        
        {/* ABA PRODUTIVIDADE */}
        {activeTab === 'produtividade' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
              <KPICard label="Ligações" value={totalLigacoes.toString()} icon={Phone} variant="info" />
              <KPICard label="WhatsApp" value={totalWhatsapp.toString()} icon={MessageSquare} variant="success" />
              <KPICard label="Agendamentos" value={totalAgendamentos.toString()} icon={CalendarCheck} variant="accent" />
              <KPICard label="Visitas" value={totalVisitas.toString()} icon={Eye} variant="warning" />
              <KPICard label="Documentações" value={totalDocumentacoes.toString()} icon={FileText} variant="success" />
              <KPICard label="Pontuação Total" value={totalPontos.toString()} icon={Trophy} variant="accent" highlight />
              <KPICard label="Corretores Ativos" value={rankingProdutividade.filter((r: any) => r.pontuacaoTotal > 0).length.toString()} icon={Users} variant="info" />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6">
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-400" /> TOP PERFORMERS - PRODUTIVIDADE</h2>
                  <PodiumVisual ranking={rankingProdutividade} type="produtividade" />
                </div>
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6 overflow-x-auto">
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-emerald-400" /> ATIVIDADES DO DIA</h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-300 border-b border-slate-700/50">
                        <th className="text-left py-2 px-2">#</th><th className="text-left py-2 px-2">Corretor</th>
                        <th className="text-center py-2 px-2">Tel</th><th className="text-center py-2 px-2">Wpp</th>
                        <th className="text-center py-2 px-2">Agd</th><th className="text-center py-2 px-2">Vis</th>
                        <th className="text-center py-2 px-2">Doc</th><th className="text-right py-2 px-2">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankingProdutividade.slice(0, 10).map((item: any, index: number) => (
                        <tr key={item.corretorId || index} className={`border-b border-slate-800/30 ${index < 3 ? 'bg-slate-800/20' : ''}`}>
                          <td className={`py-2 px-2 font-bold ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-400' : 'text-gray-500'}`}>{index + 1}º</td>
                          <td className="py-2 px-2 text-white">{item.corretorNome?.split(' ')[0] || 'Corretor'}</td>
                          <td className="py-2 px-2 text-center text-blue-300">{item.ligacoesRealizadas}</td>
                          <td className="py-2 px-2 text-center text-green-300">{item.whatsappEnviados}</td>
                          <td className="py-2 px-2 text-center text-purple-300">{item.agendamentosConfirmados}</td>
                          <td className="py-2 px-2 text-center text-amber-300">{item.visitasRealizadas}</td>
                          <td className="py-2 px-2 text-center text-cyan-300">{item.documentacoesRecolhidas}</td>
                          <td className={`py-2 px-2 text-right font-bold ${index === 0 ? 'text-yellow-300' : index === 1 ? 'text-gray-200' : index === 2 ? 'text-amber-300' : 'text-white'}`}>{item.pontuacaoTotal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-400" /> RANKING PONTUAÇÃO</h2>
                <RankingLateral ranking={rankingProdutividade} type="produtividade" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
