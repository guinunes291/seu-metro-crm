import { Lock, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface LockedTabOverlayProps {
  total: number;
  concluidos: number;
  percentual: number;
}

/**
 * Overlay semi-transparente que bloqueia abas até atingir 60% de follow-ups
 * Mostra progresso visual e botão para ir para Tarefas do Dia
 */
export function LockedTabOverlay({ total, concluidos, percentual }: LockedTabOverlayProps) {
  const [, setLocation] = useLocation();
  
  const faltam = Math.ceil(total * 0.6) - concluidos;
  
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="max-w-md space-y-6 rounded-lg border-2 border-red-500 bg-card p-8 shadow-2xl">
        {/* Ícone de cadeado */}
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 p-4">
            <Lock className="h-12 w-12 text-red-600" />
          </div>
        </div>
        
        {/* Título */}
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-bold text-foreground">
            Complete seus Follow-ups
          </h2>
          <p className="text-muted-foreground">
            Você precisa concluir <span className="font-semibold text-red-600">{faltam} follow-up{faltam !== 1 ? 's' : ''}</span> para desbloquear esta aba
          </p>
        </div>
        
        {/* Progresso */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Target className="h-4 w-4" />
              Progresso
            </span>
            <span className="font-semibold">
              {concluidos}/{total} ({percentual}%)
            </span>
          </div>
          <Progress value={percentual} className="h-3" />
          <p className="text-center text-xs text-muted-foreground">
            Meta: 60% dos follow-ups concluídos
          </p>
        </div>
        
        {/* Botão */}
        <Button 
          onClick={() => setLocation("/tarefas-do-dia")}
          className="w-full"
          size="lg"
        >
          Ir para Tarefas do Dia
        </Button>
      </div>
    </div>
  );
}
