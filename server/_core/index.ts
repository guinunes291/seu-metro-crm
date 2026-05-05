import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import webhookRoutes from "../webhookRoutes";
import uploadRoutes from "../uploadRoutes";
import helmet from "helmet";
import rateLimit from "express-rate-limit";


function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Segurança HTTP: headers de proteção (HSTS, X-Frame-Options, X-Content-Type, etc.)
  app.use(helmet({
    contentSecurityPolicy: false, // Desabilitado para compatibilidade com Vite/React
    crossOriginEmbedderPolicy: false,
  }));

  // Limite de 10 MB cobre uploads de PDF/imagem sem expor o servidor a payloads gigantes
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Rate limiting para webhooks: máximo 10 requisições por minuto por token
  const webhookRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas requisições. Tente novamente em 1 minuto.' },
    keyGenerator: (req) => {
      // Usar token do header como chave (mais preciso que IP para webhooks)
      const token = (req.headers['x-webhook-token'] || req.headers['authorization'] || req.ip || 'unknown') as string;
      return token;
    },
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // Webhook routes (público, com rate limiting de 10 req/min por token)
  app.use('/api/webhook', webhookRateLimit, webhookRoutes);

  // Endpoint de diagnóstico de métricas do dashboard (sem autenticação)
  app.get('/api/diag/metrics-check', async (_req, res) => {
    try {
      const { getDb } = await import('../db');
      const db = await getDb();
      if (!db) return res.json({ error: 'db null' });
      const { sql } = await import('drizzle-orm');
      // Testar contagem de contratos
      const contratos = await (db as any).execute(sql`SELECT COUNT(*) as total FROM contratos WHERE distrato = 0`);
      const contratosRows = Array.isArray(contratos) ? contratos[0] : contratos;
      const contratosRow = Array.isArray(contratosRows) ? contratosRows[0] : contratosRows;
      // Testar contagem de leads por status
      const leadsByStatus = await (db as any).execute(sql`SELECT status, COUNT(*) as total FROM leads GROUP BY status`);
      const statusRows = Array.isArray(leadsByStatus) ? leadsByStatus[0] : leadsByStatus;
      // Testar VGV
      const vgv = await (db as any).execute(sql`SELECT SUM(valorVenda) as total FROM contratos WHERE distrato = 0`);
      const vgvRows = Array.isArray(vgv) ? vgv[0] : vgv;
      const vgvRow = Array.isArray(vgvRows) ? vgvRows[0] : vgvRows;
      res.json({
        contratos: contratosRow?.total ?? -1,
        vgv: vgvRow?.total ?? -1,
        leadsByStatus: statusRows,
        ts: new Date().toISOString()
      });
    } catch (e: any) {
      res.json({ error: e.message });
    }
  });

  // Endpoint de diagnóstico de usuários (sem autenticação)
  app.get('/api/diag/user-check', async (req, res) => {
    try {
      const { getDb } = await import('../db');
      const db = await getDb();
      if (!db) return res.json({ error: 'db null' });
      const { sql } = await import('drizzle-orm');
      const email = req.query.email as string;
      let query;
      if (email) {
        query = sql`SELECT id, name, email, role, openId FROM users WHERE email = ${email} LIMIT 5`;
      } else {
        query = sql`SELECT id, name, email, role FROM users ORDER BY id DESC LIMIT 10`;
      }
      const result = await (db as any).execute(query);
      const rows = Array.isArray(result) ? result[0] : result;
      res.json({ users: rows, ts: new Date().toISOString() });
    } catch (e: any) {
      res.json({ error: e.message });
    }
  });

  // Endpoint de diagnóstico temporário (sem autenticação)
  app.get('/api/diag/leads-count', async (_req, res) => {
    try {
      const { getDb } = await import('../db');
      const db = await getDb();
      if (!db) return res.json({ error: 'db null', total: -1 });
      const { sql } = await import('drizzle-orm');
      const result = await (db as any).execute(sql`SELECT COUNT(*) as total FROM leads`);
      const rows = Array.isArray(result) ? result[0] : result;
      const row = Array.isArray(rows) ? rows[0] : rows;
      res.json({ total: row?.total ?? -2, ts: new Date().toISOString() });
    } catch (e: any) {
      res.json({ error: e.message, total: -3 });
    }
  });
  
  // Upload routes (requer autenticação via cookie)
  app.use('/api', uploadRoutes);
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    
    // Inicializar jobs de distribuição automática
    import("../distribuicaoJob").then(({ agendarDistribuicaoAutomatica }) => {
      agendarDistribuicaoAutomatica();
      console.log("[Job] Distribuição automática inicializada (a cada 5 minutos)");
    }).catch(err => {
      console.error("[Job] Erro ao inicializar job de distribuição:", err);
    });
    
    // Inicializar job de follow-up
    import("../followup").then(() => {
      console.log("[Job] Módulo de follow-up carregado");
    }).catch(err => {
      console.error("[Job] Erro ao carregar módulo de follow-up:", err);
    });
    
    // [DESATIVADO] Job de conquistas removido para reduzir custos de Cloud
    
    // [DESATIVADO] Job de limpeza de links expirados removido para reduzir custos de Cloud
    
    // Inicializar job de limpeza de follow-ups órfãos
    import("../followupCleanupJob").then(({ agendarLimpezaFollowUps }) => {
      agendarLimpezaFollowUps();
      console.log("[Job] Limpeza automática de follow-ups órfãos inicializada (a cada 1 hora)");
    }).catch(err => {
      console.error("[Job] Erro ao inicializar job de limpeza de follow-ups:", err);
    });
    
    // Inicializar job de transferência automática de leads (a cada 30 segundos)
    import("../transferenciaJob").then(({ agendarTransferenciaAutomatica }) => {
      agendarTransferenciaAutomatica();
      console.log("[Job] Transferência automática de leads inicializada (a cada 30 segundos)");
    }).catch(err => {
      console.error("[Job] Erro ao inicializar job de transferência automática:", err);
    });
    
    // Inicializar job de sincronização de todas as métricas
    import("../metricasSyncJob").then(({ startMetricasSyncJob }) => {
      startMetricasSyncJob();
      console.log("[Job] Sincronização automática de métricas inicializada (a cada 5 minutos)");
    }).catch(err => {
      console.error("[Job] Erro ao inicializar job de sincronização de métricas:", err);
    });
    
    // Inicializar job de backup automático (S3 - diário às 3h)
    import("../backupJob").then(({ startBackupJob }) => {
      startBackupJob();
      console.log("[Job] Backup automático S3 inicializado (diário às 3h)");
    }).catch(err => {
      console.error("[Job] Erro ao inicializar job de backup S3:", err);
    });
    
    // Inicializar job de backup para Google Sheets (diário)
    import("../sheetsBackupJob").then(({ startSheetsBackupJob }) => {
      startSheetsBackupJob();
      console.log("[Job] Backup Google Sheets inicializado (diário a cada 24 horas)");
    }).catch(err => {
      console.error("[Job] Erro ao inicializar job de backup Google Sheets:", err);
    });
    
    // [DESATIVADO] DRE Sync — apenas manual (acionado via procedure admin)
    // [DESATIVADO] BI Sync — excluído por decisão do usuário para reduzir custos
    
    // Inicializar job de recálculo de pontuação
    import("../pontuacaoJob").then(({ iniciarJobPontuacao }) => {
      iniciarJobPontuacao();
      console.log("[Job] Recálculo automático de pontuação inicializado (a cada 5 minutos)");
    }).catch(err => {
      console.error("[Job] Erro ao inicializar job de pontuação:", err);
    });
    
    // Inicializar job de reset de contadores diários
    import("../resetContadoresJob").then(({ startResetContadoresJob }) => {
      startResetContadoresJob();
      console.log("[Job] Reset automático de contadores inicializado (diário à meia-noite SP)");
    }).catch(err => {
      console.error("[Job] Erro ao inicializar job de reset de contadores:", err);
    });
    
    // Job de importação automática de leads DESATIVADO permanentemente
    // Motivo: Requisição do usuário - importação apenas manual
    // Importação manual disponível em: Sistema → Importação de Leads

    // [DESATIVADO] Notion Job — removido por decisão do usuário para reduzir custos
    // [DESATIVADO] Carteira Ativa Job — expiração e lembretes removidos por decisão do usuário
  });
}

startServer().catch(console.error);
