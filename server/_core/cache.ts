/**
 * Cache em memória simples com TTL — usado para reduzir carga de queries pesadas
 * do dashboard no TiDB. Chave inclui userId/role/filtros para isolar resultados
 * entre usuários sem vazamento de dados.
 *
 * NÃO é distribuído — em deploy multi-instância cada Node terá seu próprio cache.
 * Para invalidação manual ver `cacheInvalidate()`.
 */

type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();

const DEFAULT_TTL_MS = 60_000; // 60s

export async function cacheGetOrSet<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;

  if (hit && hit.expiresAt > now) {
    return hit.value;
  }

  const value = await loader();
  store.set(key, { value, expiresAt: now + ttlMs });

  // Limpeza oportunista — quando o cache cresce, descarta entries expirados
  if (store.size > 500) {
    for (const [k, v] of store) {
      if (v.expiresAt <= now) store.delete(k);
    }
  }

  return value;
}

/** Invalida todas as entries cuja chave começa com o prefixo. */
export function cacheInvalidate(prefix: string): number {
  let removed = 0;
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) {
      store.delete(k);
      removed++;
    }
  }
  return removed;
}

export function cacheClear(): void {
  store.clear();
}

export const CACHE_TTL = {
  SHORT: 30_000,    // 30s — métricas críticas (totais)
  MEDIUM: 60_000,   // 60s — listagens (porCorretor, contratos)
  LONG: 300_000,    // 5min — gráficos históricos, distribuições
};

/**
 * Constrói chave de cache para procedures do dashboard.
 * `corretoresIds` representa o boundary de acesso: dois admins compartilham
 * o mesmo cache (ambos veem 'all'); gestores diferentes têm chaves diferentes.
 */
export function dashboardCacheKey(
  prefix: string,
  corretoresIds: number[] | null | undefined,
  input?: { dataInicio?: string; dataFim?: string },
) {
  const ids = corretoresIds === null ? 'all' : (corretoresIds || []).slice().sort().join(',');
  return `${prefix}:${ids}:${input?.dataInicio || ''}:${input?.dataFim || ''}`;
}
