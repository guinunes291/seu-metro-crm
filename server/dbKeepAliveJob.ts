/**
 * server/dbKeepAliveJob.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Keep-alive para o TiDB Serverless: executa uma query leve a cada 4 minutos
 * para manter a conexão ativa e evitar o cold start (~10-30s de inicialização).
 *
 * O TiDB Serverless hiberna após ~5 minutos de inatividade. Sem este job,
 * a primeira query pesada (ex: dashboard sem filtro de data) pode falhar por
 * timeout durante o cold start, resultando em zeros no dashboard.
 */
import { getDb } from "./db";
import { sql } from "drizzle-orm";

const INTERVAL_MS = 4 * 60 * 1000; // 4 minutos (TiDB hiberna após ~5 min)

export function startDbKeepAliveJob() {
  const ping = async () => {
    try {
      const db = await getDb();
      if (!db) return;
      await db.execute(sql`SELECT 1`);
      console.log("[DB Keep-Alive] Ping OK");
    } catch (err) {
      console.warn("[DB Keep-Alive] Ping falhou:", err);
    }
  };

  // Executar imediatamente e depois a cada 4 minutos
  ping();
  setInterval(ping, INTERVAL_MS);
  console.log("[DB Keep-Alive] Job inicializado (ping a cada 4 minutos)");
}
