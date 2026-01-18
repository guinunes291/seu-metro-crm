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
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // Webhook routes (público, sem autenticação)
  app.use('/api/webhook', webhookRoutes);
  
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
    
    // Inicializar job de verificação de conquistas
    import("../conquistasJob").then(({ iniciarJobConquistas }) => {
      iniciarJobConquistas();
      console.log("[Job] Verificação automática de conquistas inicializada (a cada 5 minutos)");
    }).catch(err => {
      console.error("[Job] Erro ao inicializar job de conquistas:", err);
    });
    
    // Inicializar job de limpeza de links expirados
    import("../linksCleanupJob").then(({ iniciarJobLimpezaLinks }) => {
      iniciarJobLimpezaLinks();
      console.log("[Job] Limpeza automática de links expirados inicializada (a cada 1 minuto)");
    }).catch(err => {
      console.error("[Job] Erro ao inicializar job de limpeza de links:", err);
    });
    
    // Inicializar job de limpeza de follow-ups órfãos
    import("../followupCleanupJob").then(({ agendarLimpezaFollowUps }) => {
      agendarLimpezaFollowUps();
      console.log("[Job] Limpeza automática de follow-ups órfãos inicializada (a cada 1 hora)");
    }).catch(err => {
      console.error("[Job] Erro ao inicializar job de limpeza de follow-ups:", err);
    });
    
    // Inicializar job de transferência automática de leads
    import("../transferenciaAutomaticaJob").then(({ agendarTransferenciaAutomatica }) => {
      agendarTransferenciaAutomatica();
      console.log("[Job] Transferência automática de leads inicializada (diariamente à meia-noite SP)");
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
    
    // Inicializar job de backup automático
    import("../backupJob").then(({ startBackupJob }) => {
      startBackupJob();
      console.log("[Job] Backup automático inicializado (diário às 3h)");
    }).catch(err => {
      console.error("[Job] Erro ao inicializar job de backup:", err);
    });
    
    // Inicializar job de recálculo de pontuação
    import("../pontuacaoJob").then(({ iniciarJobPontuacao }) => {
      iniciarJobPontuacao();
      console.log("[Job] Recálculo automático de pontuação inicializado (a cada 5 minutos)");
    }).catch(err => {
      console.error("[Job] Erro ao inicializar job de pontuação:", err);
    });
  });
}

startServer().catch(console.error);
