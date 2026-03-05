import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: string, id = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id,
    openId: `user-${id}`,
    email: `user${id}@example.com`,
    name: `User ${id}`,
    loginMethod: "manus",
    role: role as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

// ============================================================================
// RANKING ACCESS CONTROL
// ============================================================================

describe("ranking.getCompleto — controle de acesso", () => {
  it("corretor não pode acessar ranking.getCompleto (FORBIDDEN)", async () => {
    const ctx = createContext("corretor", 100);
    const caller = appRouter.createCaller(ctx);

    await expect(caller.ranking.getCompleto({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("gestor pode acessar ranking.getCompleto", async () => {
    const ctx = createContext("gestor", 200);
    const caller = appRouter.createCaller(ctx);

    // Pode lançar erro de DB em ambiente de teste, mas não FORBIDDEN
    try {
      await caller.ranking.getCompleto({});
    } catch (err: any) {
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });

  it("admin pode acessar ranking.getCompleto", async () => {
    const ctx = createContext("admin", 300);
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.ranking.getCompleto({});
    } catch (err: any) {
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });
});

describe("ranking.porPeriodo — controle de acesso", () => {
  it("corretor não pode acessar ranking.porPeriodo (FORBIDDEN)", async () => {
    const ctx = createContext("corretor", 100);
    const caller = appRouter.createCaller(ctx);

    await expect(caller.ranking.porPeriodo({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("gestor pode acessar ranking.porPeriodo", async () => {
    const ctx = createContext("gestor", 200);
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.ranking.porPeriodo({});
    } catch (err: any) {
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });
});

describe("ranking.semanal e mensal — controle de acesso", () => {
  it("corretor não pode acessar ranking.semanal (FORBIDDEN)", async () => {
    const ctx = createContext("corretor", 100);
    const caller = appRouter.createCaller(ctx);

    await expect(caller.ranking.semanal()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("corretor não pode acessar ranking.mensal (FORBIDDEN)", async () => {
    const ctx = createContext("corretor", 100);
    const caller = appRouter.createCaller(ctx);

    await expect(caller.ranking.mensal()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

// ============================================================================
// METAS PESSOAIS DO CORRETOR
// ============================================================================

describe("metas.minhaMeta — acesso do corretor", () => {
  it("corretor pode acessar metas.minhaMeta", async () => {
    const ctx = createContext("corretor", 100);
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.metas.minhaMeta({ mes: 3, ano: 2026 });
    } catch (err: any) {
      // Pode falhar por DB, mas não por FORBIDDEN
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });

  it("usuário não autenticado não pode acessar metas.minhaMeta (UNAUTHORIZED)", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.metas.minhaMeta({ mes: 3, ano: 2026 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("metas.meuProgresso — acesso do corretor", () => {
  it("corretor pode acessar metas.meuProgresso", async () => {
    const ctx = createContext("corretor", 100);
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.metas.meuProgresso({ mes: 3, ano: 2026 });
    } catch (err: any) {
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });
});

describe("ranking.minhaPerformance — acesso do corretor", () => {
  it("corretor pode acessar ranking.minhaPerformance", async () => {
    const ctx = createContext("corretor", 100);
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.ranking.minhaPerformance({ mes: 3, ano: 2026 });
    } catch (err: any) {
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });
});
