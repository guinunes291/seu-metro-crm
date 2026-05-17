import type { Express } from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

export async function setupVite(app: Express): Promise<void> {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root: path.join(ROOT, "client"),
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

export function serveStatic(app: Express): void {
  const { default: sirv } = require("sirv");
  app.use(sirv(path.join(ROOT, "dist/public"), { extensions: ["html"] }));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(ROOT, "dist/public/index.html"));
  });
}
