import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error: unknown) {
    // Authentication is optional for public procedures.
    // Log apenas rotas protegidas (ignora ruído de assets/health)
    const url = opts.req.url ?? '';
    if (!url.startsWith('/api/trpc/system.health')) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn('[Auth] Falha na autenticação:', { url, error: msg });
    }
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
