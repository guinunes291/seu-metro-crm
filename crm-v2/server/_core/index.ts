import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createContext } from "./context.js";
import { registerOAuthRoutes } from "./oauth.js";
import { addSSEConnection } from "./sse.js";
import { verifySessionToken } from "./sdk.js";
import { COOKIE_NAME } from "../../shared/const.js";
import { parse as parseCookies } from "cookie";
import { appRouter } from "../router.js";
import { makeWebhookRouter } from "../modules/webhooks/router.js";
import { startAllJobs } from "../jobs/runner.js";

export async function startServer(): Promise<void> {

  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true }));

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api", apiLimiter);

  const webhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
  });
  app.use("/api/webhook", webhookLimiter);

  registerOAuthRoutes(app);

  // Webhook HTTP routes (raw, not tRPC)
  app.use("/api/webhook", makeWebhookRouter());

  // SSE endpoint
  app.get("/api/events/corretor", async (req, res) => {
    const cookieHeader = req.headers.cookie ?? "";
    const cookies = parseCookies(cookieHeader);
    const token = cookies[COOKIE_NAME];
    if (!token) {
      res.status(401).end();
      return;
    }
    const user = await verifySessionToken(token);
    if (!user) {
      res.status(401).end();
      return;
    }
    addSSEConnection(user.id, res);
  });

  // tRPC
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Static / Vite
  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite.js");
    await setupVite(app);
  } else {
    const { serveStatic } = await import("./vite.js");
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT ?? "3000", 10);

  app.listen(port, () => {
    console.log(`[Server] CRM v2 rodando em http://localhost:${port}`);
    startAllJobs();
  });
}

startServer().catch(console.error);
