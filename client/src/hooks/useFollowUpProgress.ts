import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useRef, useState } from "react";
import { celebrate } from "@/lib/celebration";

/**
 * Hook para monitorar progresso de follow-ups e controlar bloqueio de abas
 * Retorna:
 * - total: número total de follow-ups do dia
 * - concluidos: número de follow-ups com tentativa registrada
 * - percentual: % de conclusão (0-100)
 * - desbloqueado: true se atingiu 60% ou mais
 * - isLoading: carregando dados
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
      enabled: shouldFetchProgress, // Busca para corretores e gestores
      refetchInterval: 10000, // Atualiza a cada 10 segundos
    }
  );
  
  // Detectar desbloqueio e celebrar
  // Usar null para indicar "primeira carga" e evitar celebração falsa
  const previousDesbloqueado = useRef<boolean | null>(null);
  
  // Usar sessionStorage para persistir celebração durante toda a sessão
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
    
    // Se acabou de desbloquear (passou de false para true) e ainda não celebrou HOJE
    // Ignora primeira carga (previousDesbloqueado === null)
    // APENAS corretores veem celebração (gestores não têm bloqueio)
    if (isCorretor && previousDesbloqueado.current === false && desbloqueado && !hasCelebrated()) {
      celebrate();
      markCelebrated();
    }
    
    // Detectar aumento de concluídos para animação +1
    // Dispara quando concluidos aumenta (0→1, 1→2, etc)
    if (concluidos > previousConcluidos.current && previousConcluidos.current >= 0) {
      console.log('[+1 Animation] Triggered:', { previous: previousConcluidos.current, current: concluidos });
      setShowPlusOne(true);
      setTimeout(() => setShowPlusOne(false), 1500); // Duração da animação
    }
    
    previousDesbloqueado.current = desbloqueado;
    previousConcluidos.current = concluidos;
  }, [data?.desbloqueado, data?.concluidos]);
  
  // Gestores veem indicador mas sempre desbloqueados (sem celebração)
  // Outros roles (admin, etc) não veem indicador
  if (!shouldFetchProgress) {
    return {
      total: 0,
      concluidos: 0,
      percentual: 100,
      desbloqueado: true,
      isLoading: false,
      refetch,
      showPlusOne: false, // Sempre false para não-corretores
    };
  }
  
  return {
    total: data?.total ?? 0,
    concluidos: data?.concluidos ?? 0,
    percentual: data?.percentual ?? 0,
    desbloqueado: data?.desbloqueado ?? false,
    isLoading,
    refetch,
    showPlusOne, // Flag para disparar animação
  };
}
