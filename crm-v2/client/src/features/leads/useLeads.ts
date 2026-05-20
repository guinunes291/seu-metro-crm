import { useState } from "react";
import { trpc } from "../../lib/trpc.js";
import type { LeadStatus } from "../../../../shared/const.js";

export interface LeadFilters {
  status?: LeadStatus;
  naLixeira?: boolean;
  page?: number;
}

export function useLeads(filters: LeadFilters = {}) {
  const utils = trpc.useUtils();

  const { data, isLoading, isFetching } = trpc.leads.list.useQuery(
    {
      status: filters.status,
      naLixeira: filters.naLixeira ?? false,
      page: filters.page ?? 1,
      limit: 50,
    },
    { staleTime: 30_000 }
  );

  const updateStatusMutation = trpc.leads.updateStatus.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate().catch(() => {});
      utils.leads.stats.invalidate().catch(() => {});
    },
  });

  const registrarInteracaoMutation = trpc.leads.registrarInteracao.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate().catch(() => {});
    },
  });

  const moveToLixeiraMutation = trpc.leads.moveToLixeira.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate().catch(() => {});
      utils.leads.stats.invalidate().catch(() => {});
    },
  });

  return {
    leads: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading,
    isFetching,
    updateStatus: updateStatusMutation.mutate,
    registrarInteracao: registrarInteracaoMutation.mutate,
    moveToLixeira: moveToLixeiraMutation.mutate,
  };
}

export function useLeadSearch() {
  const [query, setQuery] = useState("");
  const { data, isFetching } = trpc.leads.search.useQuery(
    { q: query },
    { enabled: query.length >= 2, staleTime: 10_000 }
  );
  return { query, setQuery, results: data ?? [], isFetching };
}

export function useLeadStats() {
  return trpc.leads.stats.useQuery(undefined, { staleTime: 60_000 });
}
