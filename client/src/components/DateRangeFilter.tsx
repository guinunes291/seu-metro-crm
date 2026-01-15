import { useState } from "react";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type DateRangePreset =
  | "all"
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

interface DateRangeFilterProps {
  value: DateRangePreset;
  customStart?: Date;
  customEnd?: Date;
  onChange: (
    preset: DateRangePreset,
    customStart?: Date,
    customEnd?: Date
  ) => void;
}

const presetLabels: Record<DateRangePreset, string> = {
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

export function DateRangeFilter({
  value,
  customStart,
  customEnd,
  onChange,
}: DateRangeFilterProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [tempStart, setTempStart] = useState<Date | undefined>(customStart);
  const [tempEnd, setTempEnd] = useState<Date | undefined>(customEnd);

  const handlePresetChange = (preset: DateRangePreset) => {
    if (preset === "custom") {
      onChange(preset);
      // Abrir calendário após um pequeno delay para garantir que o estado foi atualizado
      setTimeout(() => setIsCalendarOpen(true), 100);
    } else {
      onChange(preset);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!tempStart || (tempStart && tempEnd)) {
      // Primeira seleção ou reiniciar
      setTempStart(date);
      setTempEnd(undefined);
    } else {
      // Segunda seleção
      if (date && date < tempStart) {
        // Se data selecionada é anterior, inverter
        setTempEnd(tempStart);
        setTempStart(date);
      } else {
        setTempEnd(date);
      }
    }
  };

  const handleApplyCustom = () => {
    if (tempStart && tempEnd) {
      onChange("custom", tempStart, tempEnd);
      setIsCalendarOpen(false);
    }
  };

  const getDisplayValue = () => {
    if (value === "custom" && customStart && customEnd) {
      return `${format(customStart, "dd/MM/yy", { locale: ptBR })} - ${format(
        customEnd,
        "dd/MM/yy",
        { locale: ptBR }
      )}`;
    }
    return presetLabels[value];
  };

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-full">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <SelectValue>{getDisplayValue()}</SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(presetLabels).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value === "custom" && (
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start">
              <Calendar className="mr-2 h-4 w-4" />
              {customStart && customEnd
                ? `${format(customStart, "dd/MM/yy", { locale: ptBR })} - ${format(
                    customEnd,
                    "dd/MM/yy",
                    { locale: ptBR }
                  )}`
                : "Selecione o período"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-3 space-y-3">
              <div className="flex gap-2">
                <CalendarComponent
                  mode="single"
                  selected={tempStart}
                  onSelect={handleDateSelect}
                  locale={ptBR}
                  month={tempStart || new Date()}
                  onMonthChange={(date) => setTempStart(date)}
                  initialFocus
                />
                <CalendarComponent
                  mode="single"
                  selected={tempEnd}
                  onSelect={handleDateSelect}
                  locale={ptBR}
                  month={tempStart ? new Date(tempStart.getFullYear(), tempStart.getMonth() + 1, 1) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)}
                  disabled={(date) => !tempStart || date < tempStart}
                />
              </div>
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {tempStart && tempEnd
                    ? `${format(tempStart, "dd/MM/yyyy", { locale: ptBR })} - ${format(
                        tempEnd,
                        "dd/MM/yyyy",
                        { locale: ptBR }
                      )}`
                    : "Selecione data inicial e final"}
                </div>
                <Button
                  size="sm"
                  onClick={handleApplyCustom}
                  disabled={!tempStart || !tempEnd}
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
