import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useRef } from "react";
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
  const previousDesbloqueado = useRef<boolean>(false);
  const celebrationShown = useRef<boolean>(false);
  
  useEffect(() => {
    const desbloqueado = data?.desbloqueado ?? false;
    
    // Se acabou de desbloquear (passou de false para true) e ainda não celebrou
    if (!previousDesbloqueado.current && desbloqueado && !celebrationShown.current) {
      celebrate();
      celebrationShown.current = true;
    }
    
    previousDesbloqueado.current = desbloqueado;
  }, [data?.desbloqueado]);
  
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
    };
  }
  
  return {
    total: data?.total ?? 0,
    concluidos: data?.concluidos ?? 0,
    percentual: data?.percentual ?? 0,
    desbloqueado: data?.desbloqueado ?? false,
    isLoading,
    refetch,
  };
}
