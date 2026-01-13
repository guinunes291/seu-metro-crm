import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Phone,
  MessageSquare,
  Mail,
  Video,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  FileText,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface TimelineItem {
  id: number;
  tipo: "ligacao" | "whatsapp" | "email" | "visita" | "proposta" | "status" | "observacao" | "agendamento";
  resultado?: "respondeu" | "nao_respondeu" | "agendado" | "realizado" | "cancelado";
  observacoes?: string;
  criadoEm: Date;
  criadoPor?: string;
  statusAnterior?: string;
  statusNovo?: string;
}

interface TimelineHistoricoProps {
  items: TimelineItem[];
  className?: string;
  showFilters?: boolean;
}

const tipoConfig = {
  ligacao: {
    icon: Phone,
    label: "Ligação",
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  whatsapp: {
    icon: MessageSquare,
    label: "WhatsApp",
    color: "text-green-500",
    bgColor: "bg-green-50 dark:bg-green-950",
    borderColor: "border-green-200 dark:border-green-800",
  },
  email: {
    icon: Mail,
    label: "E-mail",
    color: "text-purple-500",
    bgColor: "bg-purple-50 dark:bg-purple-950",
    borderColor: "border-purple-200 dark:border-purple-800",
  },
  visita: {
    icon: Video,
    label: "Visita",
    color: "text-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-950",
    borderColor: "border-orange-200 dark:border-orange-800",
  },
  proposta: {
    icon: FileText,
    label: "Proposta",
    color: "text-indigo-500",
    bgColor: "bg-indigo-50 dark:bg-indigo-950",
    borderColor: "border-indigo-200 dark:border-indigo-800",
  },
  status: {
    icon: TrendingUp,
    label: "Mudança de Status",
    color: "text-cyan-500",
    bgColor: "bg-cyan-50 dark:bg-cyan-950",
    borderColor: "border-cyan-200 dark:border-cyan-800",
  },
  observacao: {
    icon: AlertCircle,
    label: "Observação",
    color: "text-gray-500",
    bgColor: "bg-gray-50 dark:bg-gray-950",
    borderColor: "border-gray-200 dark:border-gray-800",
  },
  agendamento: {
    icon: Calendar,
    label: "Agendamento",
    color: "text-pink-500",
    bgColor: "bg-pink-50 dark:bg-pink-950",
    borderColor: "border-pink-200 dark:border-pink-800",
  },
};

const resultadoConfig = {
  respondeu: {
    icon: CheckCircle2,
    label: "Respondeu",
    color: "text-green-600",
    variant: "default" as const,
  },
  nao_respondeu: {
    icon: XCircle,
    label: "Não Respondeu",
    color: "text-red-600",
    variant: "destructive" as const,
  },
  agendado: {
    icon: Calendar,
    label: "Agendado",
    color: "text-blue-600",
    variant: "default" as const,
  },
  realizado: {
    icon: CheckCircle2,
    label: "Realizado",
    color: "text-green-600",
    variant: "default" as const,
  },
  cancelado: {
    icon: XCircle,
    label: "Cancelado",
    color: "text-orange-600",
    variant: "secondary" as const,
  },
};

export function TimelineHistorico({ items, className, showFilters = false }: TimelineHistoricoProps) {
  if (!items || items.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Nenhuma interação registrada ainda</p>
      </Card>
    );
  }

  // Ordenar por data (mais recente primeiro)
  const sortedItems = [...items].sort((a, b) => 
    new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Timeline */}
      <div className="relative space-y-6">
        {/* Linha vertical */}
        <div className="absolute left-[21px] top-8 bottom-0 w-[2px] bg-border" />

        {sortedItems.map((item, index) => {
          const config = tipoConfig[item.tipo];
          const Icon = config.icon;
          const ResultadoIcon = item.resultado ? resultadoConfig[item.resultado]?.icon : null;

          return (
            <div key={item.id} className="relative flex gap-4">
              {/* Ícone do tipo de interação */}
              <div
                className={cn(
                  "relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-background",
                  config.bgColor,
                  config.borderColor
                )}
              >
                <Icon className={cn("h-5 w-5", config.color)} />
              </div>

              {/* Card de conteúdo */}
              <Card className={cn("flex-1 p-4", config.borderColor, "border-l-4")}>
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm">{config.label}</h4>
                      {item.resultado && (
                        <Badge variant={resultadoConfig[item.resultado].variant} className="text-xs">
                          {ResultadoIcon && <ResultadoIcon className="h-3 w-3 mr-1" />}
                          {resultadoConfig[item.resultado].label}
                        </Badge>
                      )}
                    </div>

                    {/* Mudança de status */}
                    {item.tipo === "status" && item.statusAnterior && item.statusNovo && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Badge variant="outline">{item.statusAnterior}</Badge>
                        <span>→</span>
                        <Badge variant="outline">{item.statusNovo}</Badge>
                      </div>
                    )}

                    {/* Observações */}
                    {item.observacoes && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {item.observacoes}
                      </p>
                    )}
                  </div>

                  {/* Data e hora */}
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-foreground">
                      {format(new Date(item.criadoEm), "HH:mm", { locale: ptBR })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(item.criadoEm), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                {/* Criado por */}
                {item.criadoPor && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2 pt-2 border-t">
                    <User className="h-3 w-3" />
                    <span>{item.criadoPor}</span>
                  </div>
                )}
              </Card>
            </div>
          );
        })}
      </div>

      {/* Resumo */}
      <Card className="p-4 bg-muted/50">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Total de interações: <strong>{items.length}</strong>
            </span>
          </div>
          {items.length > 0 && (
            <span className="text-xs text-muted-foreground">
              Última interação há{" "}
              {Math.floor(
                (new Date().getTime() - new Date(sortedItems[0].criadoEm).getTime()) / (1000 * 60 * 60 * 24)
              )}{" "}
              dias
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}
