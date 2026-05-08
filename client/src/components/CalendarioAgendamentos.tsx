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
  leadNome?: string | null;
  corretorNome?: string | null;
  projetoNome?: string | null;
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

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  realizado: "Realizado",
  cancelado: "Cancelado",
  reagendado: "Reagendado",
};

const CORRETOR_COLORS = [
  { border: "border-l-blue-500", dot: "bg-blue-500", text: "text-blue-600" },
  { border: "border-l-violet-500", dot: "bg-violet-500", text: "text-violet-600" },
  { border: "border-l-emerald-500", dot: "bg-emerald-500", text: "text-emerald-600" },
  { border: "border-l-orange-500", dot: "bg-orange-500", text: "text-orange-600" },
  { border: "border-l-pink-500", dot: "bg-pink-500", text: "text-pink-600" },
  { border: "border-l-cyan-500", dot: "bg-cyan-500", text: "text-cyan-600" },
  { border: "border-l-amber-500", dot: "bg-amber-500", text: "text-amber-600" },
  { border: "border-l-rose-500", dot: "bg-rose-500", text: "text-rose-600" },
];

interface CalendarioAgendamentosProps {
  onCreateAgendamento?: (date: Date) => void;
  onSelectAgendamento?: (agendamento: Agendamento) => void;
}

export default function CalendarioAgendamentos({
  onCreateAgendamento,
  onSelectAgendamento,
}: CalendarioAgendamentosProps) {
  const { user } = useAuth();
  const isGestor = user?.role === "gestor" || user?.role === "admin" || user?.role === "superintendente";

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedCorretorId, setSelectedCorretorId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);

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
  const { data: agendamentosRaw, isLoading } = isGestor
    ? trpc.agendamentos.listAll.useQuery({
        dataInicio: dateRange.start.toISOString(),
        dataFim: dateRange.end.toISOString(),
        corretorId: selectedCorretorId !== "all" ? parseInt(selectedCorretorId) : undefined,
      })
    : trpc.agendamentos.list.useQuery({
        dataInicio: dateRange.start.toISOString(),
        dataFim: dateRange.end.toISOString(),
      });

  // Filtrar por status selecionados
  const agendamentos = useMemo(() => {
    const raw = (agendamentosRaw || []) as Agendamento[];
    if (selectedStatus.length === 0) return raw;
    return raw.filter(ag => selectedStatus.includes(ag.status));
  }, [agendamentosRaw, selectedStatus]);

  // Buscar corretores (apenas para gestor)
  const { data: corretores } = trpc.users.corretores.useQuery(undefined, {
    enabled: isGestor,
  });

  // Mapa de cores por corretor (determinístico por id)
  const corretorColorMap = useMemo(() => {
    const sorted = [...(corretores ?? [])].sort((a: Corretor, b: Corretor) => a.id - b.id);
    return new Map(sorted.map((c: Corretor, i: number) => [c.id, CORRETOR_COLORS[i % CORRETOR_COLORS.length]]));
  }, [corretores]);

  const getCorretorColor = (id: number) => corretorColorMap.get(id) ?? CORRETOR_COLORS[0];

  // Agrupar agendamentos por dia
  const agendamentosPorDia = useMemo(() => {
    const map = new Map<string, Agendamento[]>();

    agendamentos.forEach((ag: Agendamento) => {
      let dateKey: string;
      if (typeof ag.dataAgendamento === 'string') {
        dateKey = (ag.dataAgendamento as string).split('T')[0];
      } else {
        const date = new Date(ag.dataAgendamento);
        dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(ag);
    });

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

  const goToPrevious = () => {
    if (viewMode === "month") setCurrentDate(subMonths(currentDate, 1));
    else setCurrentDate(subWeeks(currentDate, 1));
  };

  const goToNext = () => {
    if (viewMode === "month") setCurrentDate(addMonths(currentDate, 1));
    else setCurrentDate(addWeeks(currentDate, 1));
  };

  const goToToday = () => setCurrentDate(new Date());

  const toggleStatus = (status: string) => {
    setSelectedStatus(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  // Renderizar um agendamento no calendário
  const renderAgendamento = (ag: Agendamento, compact = false) => {
    const statusColor = STATUS_COLORS[ag.status] || STATUS_COLORS.pendente;
    const corretorColor = getCorretorColor(ag.corretorId);
    const projetoDisplay = ag.projetoNome || ag.projetoCustom;
    const corretorDisplay = ag.corretorNome?.split(' ')[0] || 'Corretor';
    const leadDisplay = ag.leadNome;

    if (compact) {
      return (
        <TooltipProvider key={ag.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`bg-muted border-l-4 ${corretorColor.border} text-foreground text-xs px-1.5 py-0.5 rounded-r truncate cursor-pointer hover:bg-muted/80 transition-colors`}
                onClick={() => onSelectAgendamento?.(ag)}
              >
                <span className="font-semibold">{ag.horaAgendamento}</span>
                {isGestor && <span className={`ml-1 ${corretorColor.text} font-medium`}>{corretorDisplay}</span>}
                {leadDisplay && <span className="ml-1 text-muted-foreground truncate"> — {leadDisplay}</span>}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <div className="space-y-1">
                <div className="font-medium">{ag.horaAgendamento}</div>
                {leadDisplay && (
                  <div className="text-sm flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {leadDisplay}
                  </div>
                )}
                {projetoDisplay && (
                  <div className="text-sm flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {projetoDisplay}
                  </div>
                )}
                {isGestor && (
                  <div className={`text-sm flex items-center gap-1 ${corretorColor.text}`}>
                    <User className="h-3 w-3" />
                    {ag.corretorNome || corretorDisplay}
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
        className={`bg-muted border-l-4 ${corretorColor.border} text-foreground text-xs p-2 rounded-r cursor-pointer hover:bg-muted/80 transition-colors`}
        onClick={() => onSelectAgendamento?.(ag)}
      >
        <div className="font-semibold flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {ag.horaAgendamento}
          <span className={`ml-1 ${corretorColor.text} font-medium`}>{corretorDisplay}</span>
        </div>
        {leadDisplay && (
          <div className="truncate mt-0.5 text-foreground/80">{leadDisplay}</div>
        )}
        {projetoDisplay && (
          <div className="truncate text-muted-foreground">{projetoDisplay}</div>
        )}
        <Badge className={`${statusColor} text-white text-[10px] mt-1`}>
          {ag.status}
        </Badge>
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
            <>
              {dayAgendamentos.slice(0, 3).map((ag) => renderAgendamento(ag, true))}
              {dayAgendamentos.length > 3 && (
                <div className="text-xs text-muted-foreground text-center">
                  +{dayAgendamentos.length - 3} mais
                </div>
              )}
            </>
          ) : (
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

        {/* Filtros de status */}
        <div className="flex flex-wrap gap-2 mt-3">
          {Object.entries(STATUS_LABELS).map(([status, label]) => {
            const active = selectedStatus.includes(status);
            return (
              <button
                key={status}
                onClick={() => toggleStatus(status)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  active
                    ? `${STATUS_COLORS[status]} text-white border-transparent`
                    : "bg-background text-muted-foreground border-border hover:border-foreground/30"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${active ? 'bg-white/70' : STATUS_COLORS[status]}`} />
                {label}
              </button>
            );
          })}
          {selectedStatus.length > 0 && (
            <button
              onClick={() => setSelectedStatus([])}
              className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Legenda de corretores (apenas para gestor, quando há dados) */}
        {isGestor && corretores && agendamentos.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {[...(corretores as Corretor[])].sort((a, b) => a.id - b.id).map((c, i) => {
              const color = CORRETOR_COLORS[i % CORRETOR_COLORS.length];
              const count = (agendamentos as Agendamento[]).filter(ag => ag.corretorId === c.id).length;
              if (count === 0) return null;
              return (
                <span
                  key={c.id}
                  className="flex items-center gap-1 text-xs text-muted-foreground bg-muted rounded-full px-2.5 py-1"
                >
                  <span className={`w-2 h-2 rounded-full ${color.dot}`} />
                  {c.name?.split(' ')[0] || 'Corretor'} ({count})
                </span>
              );
            })}
          </div>
        )}

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

          <div className="w-[100px]" />
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

        {/* Legenda de status */}
        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <div key={status} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${STATUS_COLORS[status]}`} />
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
