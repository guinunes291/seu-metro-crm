/**
 * Cache com TTL para reduzir carga de queries pesadas no TiDB.
 *
 * Usa Redis quando `REDIS_URL` está definido (multi-instância / produção).
 * Fallback: Map em memória (single-instance / dev).
 *
 * A chave inclui userId/role/filtros para isolar resultados entre usuários
 * sem vazamento de dados.
 */

import Redis from 'ioredis';

// ---- Redis client (lazy, opcional) ----------------------------------------

let _redis: Redis | null = null;
let _redisReady = false;

function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (_redis) return _redis;

  _redis = new Redis(process.env.REDIS_URL, {
    enableOfflineQueue: false,
    connectTimeout: 5_000,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });

  _redis.on('ready', () => { _redisReady = true; });
  _redis.on('error', (err) => {
    _redisReady = false;
    console.warn('[cache] Redis error — usando fallback em memória:', err.message);
  });

  _redis.connect().catch(() => {}); // silenciosamente — o listener de error loga
  return _redis;
}

// ---- In-memory fallback ---------------------------------------------------

type Entry<T> = { value: T; expiresAt: number };
const store = new Map<string, Entry<unknown>>();

// ---- Public API -----------------------------------------------------------

export async function cacheGetOrSet<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const redis = getRedis();

  // ── Redis path ──────────────────────────────────────────────────────────
  if (redis && _redisReady) {
    try {
      const cached = await redis.get(key);
      if (cached !== null) {
        return JSON.parse(cached) as T;
      }
      const value = await loader();
      await redis.set(key, JSON.stringify(value), 'PX', ttlMs);
      return value;
    } catch (err: any) {
      console.warn('[cache] Redis get/set falhou, usando in-memory:', err.message);
      // fall through to in-memory
    }
  }

  // ── In-memory path ───────────────────────────────────────────────────────
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;

  if (hit && hit.expiresAt > now) {
    return hit.value;
  }

  const value = await loader();
  store.set(key, { value, expiresAt: now + ttlMs });

  // Limpeza oportunista — descarta entries expirados quando o store cresce
  if (store.size > 500) {
    for (const [k, v] of Array.from(store)) {
      if (v.expiresAt <= now) store.delete(k);
    }
  }

  return value;
}

/** Invalida todas as entries cuja chave começa com o prefixo. */
export async function cacheInvalidate(prefix: string): Promise<number> {
  const redis = getRedis();
  let removed = 0;

  // Redis: usar SCAN para não bloquear
  if (redis && _redisReady) {
    try {
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
        cursor = next;
        if (keys.length > 0) {
          await redis.del(...keys);
          removed += keys.length;
        }
      } while (cursor !== '0');
      return removed;
    } catch (err: any) {
      console.warn('[cache] Redis invalidate falhou, usando in-memory:', err.message);
    }
  }

  // In-memory fallback
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(prefix)) {
      store.delete(k);
      removed++;
    }
  }
  return removed;
}

export function cacheClear(): void {
  store.clear();
  const redis = getRedis();
  if (redis && _redisReady) {
    redis.flushdb().catch(() => {});
  }
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
