import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Clock,
  User,
  Building2,
  Plus
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isToday,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";

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

type Corretor = {
  id: number;
  name: string | null;
  fotoUrl: string | null;
};

type ViewMode = "month" | "week";

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-yellow-500",
  confirmado: "bg-blue-500",
  realizado: "bg-green-500",
  cancelado: "bg-red-500",
  reagendado: "bg-orange-500",
};

interface CalendarioAgendamentosProps {
  onCreateAgendamento?: (date: Date) => void;
  onSelectAgendamento?: (agendamento: Agendamento) => void;
}

export default function CalendarioAgendamentos({
  onCreateAgendamento,
  onSelectAgendamento,
}: CalendarioAgendamentosProps) {
  const { user } = useAuth();
  const isGestor = user?.role === "gestor" || user?.role === "admin";
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedCorretorId, setSelectedCorretorId] = useState<string>("all");
  
  // Calcular range de datas para a query
  const dateRange = useMemo(() => {
    if (viewMode === "month") {
      const start = startOfWeek(startOfMonth(currentDate), { locale: ptBR });
      const end = endOfWeek(endOfMonth(currentDate), { locale: ptBR });
      return { start, end };
    } else {
      const start = startOfWeek(currentDate, { locale: ptBR });
      const end = endOfWeek(currentDate, { locale: ptBR });
      return { start, end };
    }
  }, [currentDate, viewMode]);
  
  // Buscar agendamentos
  const { data: agendamentos, isLoading } = isGestor
    ? trpc.agendamentos.listAll.useQuery({
        dataInicio: dateRange.start.toISOString(),
        dataFim: dateRange.end.toISOString(),
        corretorId: selectedCorretorId !== "all" ? parseInt(selectedCorretorId) : undefined,
      })
    : trpc.agendamentos.list.useQuery({
        dataInicio: dateRange.start.toISOString(),
        dataFim: dateRange.end.toISOString(),
      });
  
  // Buscar corretores (apenas para gestor)
  const { data: corretores } = trpc.users.corretores.useQuery(undefined, {
    enabled: isGestor,
  });
  
  // Agrupar agendamentos por dia
  const agendamentosPorDia = useMemo(() => {
    const map = new Map<string, Agendamento[]>();
    
    (agendamentos || []).forEach((ag: Agendamento) => {
      const dateKey = format(new Date(ag.dataAgendamento), "yyyy-MM-dd");
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(ag);
    });
    
    // Ordenar por hora
    map.forEach((ags) => {
      ags.sort((a, b) => a.horaAgendamento.localeCompare(b.horaAgendamento));
    });
    
    return map;
  }, [agendamentos]);
  
  // Gerar dias do calendário
  const calendarDays = useMemo(() => {
    if (viewMode === "month") {
      const start = startOfWeek(startOfMonth(currentDate), { locale: ptBR });
      const end = endOfWeek(endOfMonth(currentDate), { locale: ptBR });
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfWeek(currentDate, { locale: ptBR });
      const end = endOfWeek(currentDate, { locale: ptBR });
      return eachDayOfInterval({ start, end });
    }
  }, [currentDate, viewMode]);
  
  // Navegação
  const goToPrevious = () => {
    if (viewMode === "month") {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };
  
  const goToNext = () => {
    if (viewMode === "month") {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };
  
  const goToToday = () => {
    setCurrentDate(new Date());
  };
  
  // Buscar nome do corretor
  const getCorretorNome = (corretorId: number) => {
    const corretor = corretores?.find((c: Corretor) => c.id === corretorId);
    return corretor?.name || "Corretor";
  };
  
  // Renderizar um agendamento
  const renderAgendamento = (ag: Agendamento, compact = false) => {
    const statusColor = STATUS_COLORS[ag.status] || STATUS_COLORS.pendente;
    
    if (compact) {
      return (
        <TooltipProvider key={ag.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`${statusColor} text-white text-xs px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity`}
                onClick={() => onSelectAgendamento?.(ag)}
              >
                {ag.horaAgendamento}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <div className="space-y-1">
                <div className="font-medium">{ag.horaAgendamento}</div>
                {ag.projetoCustom && (
                  <div className="text-sm flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {ag.projetoCustom}
                  </div>
                )}
                {isGestor && (
                  <div className="text-sm flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {getCorretorNome(ag.corretorId)}
                  </div>
                )}
                <Badge className={`${statusColor} text-white text-xs`}>
                  {ag.status}
                </Badge>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    return (
      <div
        key={ag.id}
        className={`${statusColor} text-white text-xs p-2 rounded cursor-pointer hover:opacity-80 transition-opacity`}
        onClick={() => onSelectAgendamento?.(ag)}
      >
        <div className="font-medium flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {ag.horaAgendamento}
        </div>
        {ag.projetoCustom && (
          <div className="truncate mt-1">{ag.projetoCustom}</div>
        )}
        {isGestor && (
          <div className="text-xs opacity-80 mt-1">
            {getCorretorNome(ag.corretorId)}
          </div>
        )}
      </div>
    );
  };
  
  // Renderizar célula do dia
  const renderDayCell = (day: Date) => {
    const dateKey = format(day, "yyyy-MM-dd");
    const dayAgendamentos = agendamentosPorDia.get(dateKey) || [];
    const isCurrentMonth = isSameMonth(day, currentDate);
    const isDayToday = isToday(day);
    
    return (
      <div
        key={dateKey}
        className={`
          min-h-[100px] border border-border p-1 
          ${!isCurrentMonth && viewMode === "month" ? "bg-muted/30" : "bg-background"}
          ${isDayToday ? "ring-2 ring-primary ring-inset" : ""}
          hover:bg-muted/50 transition-colors cursor-pointer
        `}
        onClick={() => {
          if (dayAgendamentos.length === 0) {
            onCreateAgendamento?.(day);
          }
        }}
      >
        <div className={`
          text-sm font-medium mb-1 flex items-center justify-between
          ${!isCurrentMonth && viewMode === "month" ? "text-muted-foreground" : ""}
          ${isDayToday ? "text-primary" : ""}
        `}>
          <span>{format(day, "d")}</span>
          {dayAgendamentos.length > 0 && (
            <Badge variant="secondary" className="text-xs h-5 px-1">
              {dayAgendamentos.length}
            </Badge>
          )}
        </div>
        
        <div className="space-y-1">
          {viewMode === "month" ? (
            // Visualização mensal - compacta
            <>
              {dayAgendamentos.slice(0, 3).map((ag) => renderAgendamento(ag, true))}
              {dayAgendamentos.length > 3 && (
                <div className="text-xs text-muted-foreground text-center">
                  +{dayAgendamentos.length - 3} mais
                </div>
              )}
            </>
          ) : (
            // Visualização semanal - expandida
            dayAgendamentos.map((ag) => renderAgendamento(ag, false))
          )}
        </div>
        
        {dayAgendamentos.length === 0 && (
          <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <Plus className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
    );
  };
  
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Calendário de Agendamentos
          </CardTitle>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro de corretor (apenas para gestor) */}
            {isGestor && corretores && (
              <Select
                value={selectedCorretorId}
                onValueChange={setSelectedCorretorId}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar corretor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os corretores</SelectItem>
                  {corretores.map((corretor: Corretor) => (
                    <SelectItem key={corretor.id} value={corretor.id.toString()}>
                      {corretor.name || "Corretor"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {/* Toggle de visualização */}
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === "month" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("month")}
                className="rounded-r-none"
              >
                Mês
              </Button>
              <Button
                variant={viewMode === "week" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("week")}
                className="rounded-l-none"
              >
                Semana
              </Button>
            </div>
          </div>
        </div>
        
        {/* Navegação */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={goToNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Hoje
            </Button>
          </div>
          
          <h3 className="text-lg font-semibold">
            {viewMode === "month"
              ? format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })
              : `Semana de ${format(startOfWeek(currentDate, { locale: ptBR }), "d 'de' MMMM", { locale: ptBR })}`
            }
          </h3>
          
          <div className="w-[100px]" /> {/* Spacer para centralizar o título */}
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            {/* Cabeçalho dos dias da semana */}
            <div className="grid grid-cols-7 bg-muted">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium py-2 border-b border-border"
                >
                  {day}
                </div>
              ))}
            </div>
            
            {/* Grid do calendário */}
            <div className={`grid grid-cols-7 ${viewMode === "week" ? "min-h-[400px]" : ""}`}>
              {calendarDays.map((day) => renderDayCell(day))}
            </div>
          </div>
        )}
        
        {/* Legenda */}
        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-500"></div>
            <span>Pendente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span>Confirmado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span>Realizado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500"></div>
            <span>Cancelado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-orange-500"></div>
            <span>Reagendado</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
