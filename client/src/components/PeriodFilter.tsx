import { useState, useMemo } from "react";
import { Calendar, ChevronDown } from "lucide-react";
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
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subWeeks, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export type PeriodOption = 
  | "all"
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface PeriodFilterProps {
  value: PeriodOption;
  onChange: (period: PeriodOption, dateRange: DateRange) => void;
  customRange?: DateRange;
  className?: string;
  variant?: "default" | "dark";
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

export function getDateRangeForPeriod(period: PeriodOption, customRange?: DateRange): DateRange {
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

export function PeriodFilter({ 
  value, 
  onChange, 
  customRange,
  className = "",
  variant = "default"
}: PeriodFilterProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange>({ from: undefined, to: undefined });
  
  const handlePeriodSelect = (period: PeriodOption) => {
    if (period === "custom") {
      setIsCalendarOpen(true);
      return;
    }
    
    const dateRange = getDateRangeForPeriod(period);
    onChange(period, dateRange);
  };
  
  const handleCustomRangeSelect = () => {
    if (tempRange.from && tempRange.to) {
      onChange("custom", tempRange);
      setIsCalendarOpen(false);
    }
  };
  
  const displayLabel = useMemo(() => {
    if (value === "custom" && customRange?.from && customRange?.to) {
      return `${format(customRange.from, "dd/MM/yy", { locale: ptBR })} - ${format(customRange.to, "dd/MM/yy", { locale: ptBR })}`;
    }
    return periodLabels[value];
  }, [value, customRange]);
  
  const isDark = variant === "dark";
  
  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className={`gap-2 ${isDark ? 'bg-slate-800/50 border-slate-700 text-white hover:bg-slate-700' : ''}`}
          >
            <Calendar className="h-4 w-4" />
            {displayLabel}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {(Object.keys(periodLabels) as PeriodOption[]).map((period) => (
            period !== "custom" ? (
              <DropdownMenuItem
                key={period}
                onClick={() => handlePeriodSelect(period)}
                className={value === period ? "bg-accent" : ""}
              >
                {periodLabels[period]}
                {value === period && (
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
                className={value === "custom" ? "bg-accent" : ""}
              >
                {periodLabels.custom}
                {value === "custom" && (
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
    </div>
  );
}

export default PeriodFilter;
