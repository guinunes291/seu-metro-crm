import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useRef, useState } from "react";
import { celebrate } from "@/lib/celebration";

/**
 * Hook de progresso de follow-ups com suporte a escolha diária.
 * 
 * Fluxo:
 * 1. Corretor abre o sistema → getProgresso retorna escolhaDiariaFeita e aceitouFollowUp
 * 2. Se escolhaDiariaFeita === false e total > 0 → mostrar modal de escolha
 * 3. Se aceitouFollowUp === true → bloqueio normal até completar 100%
 * 4. Se aceitouFollowUp === false → desbloqueado imediatamente
 */

export function useFollowUpProgress() {
  const { user } = useAuth();
  
  // Corretores e gestores veem indicador, mas só corretores têm bloqueio
  const isCorretor = user?.role === 'corretor';
  const isGestor = user?.role === 'gestor';
  const shouldFetchProgress = isCorretor || isGestor;
  
  const { data, isLoading, refetch } = trpc.progressoFollowUps.getProgresso.useQuery(
    undefined,
    {
      enabled: shouldFetchProgress,
      refetchInterval: 5 * 60 * 1000, // 5 minutos (reduzido de 60s — progresso de follow-up muda lentamente)
    }
  );
  
  // Detectar desbloqueio e celebrar
  const previousDesbloqueado = useRef<boolean | null>(null);
  
  const getCelebrationKey = () => {
    const hoje = new Date().toISOString().split('T')[0];
    return `celebration_shown_${user?.id}_${hoje}`;
  };
  
  const hasCelebrated = () => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(getCelebrationKey()) === 'true';
  };
  
  const markCelebrated = () => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(getCelebrationKey(), 'true');
  };
  
  // Detectar aumento de progresso para animação +1
  const previousConcluidos = useRef<number>(0);
  const [showPlusOne, setShowPlusOne] = useState(false);
  
  useEffect(() => {
    const desbloqueado = data?.desbloqueado ?? false;
    const concluidos = data?.concluidos ?? 0;
    
    // Se acabou de desbloquear e ainda não celebrou HOJE
    if (isCorretor && previousDesbloqueado.current === false && desbloqueado && !hasCelebrated()) {
      // Não celebrar se desbloqueou por recusar follow-up (aceitouFollowUp === false)
      if (data?.aceitouFollowUp !== false) {
        celebrate();
        markCelebrated();
      }
    }
    
    // Detectar aumento de concluídos para animação +1
    if (concluidos > previousConcluidos.current && previousConcluidos.current >= 0) {
      setShowPlusOne(true);
      setTimeout(() => setShowPlusOne(false), 1500);
    }
    
    previousDesbloqueado.current = desbloqueado;
    previousConcluidos.current = concluidos;
  }, [data?.desbloqueado, data?.concluidos, isCorretor, data?.aceitouFollowUp]);
  
  // Gestores e outros roles: sem bloqueio
  if (!shouldFetchProgress) {
    return {
      total: 0,
      concluidos: 0,
      percentual: 100,
      desbloqueado: true,
      isLoading: false,
      refetch,
      showPlusOne: false,
      escolhaDiariaFeita: true,
      aceitouFollowUp: null as boolean | null,
    };
  }
  
  const total = data?.total ?? 0;
  const concluidos = data?.concluidos ?? 0;
  const percentual = data?.percentual ?? 0;
  const desbloqueado = data?.desbloqueado ?? (total === 0 ? true : false);
  const escolhaDiariaFeita = data?.escolhaDiariaFeita ?? true; // default true para não mostrar modal durante loading
  const aceitouFollowUp = data?.aceitouFollowUp ?? null;
  
  return {
    total,
    concluidos,
    percentual,
    desbloqueado,
    isLoading,
    refetch,
    showPlusOne,
    escolhaDiariaFeita,
    aceitouFollowUp,
  };
}
