import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createGestorContext(equipeId?: number): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "gestor-user",
    email: "gestor@example.com",
    name: "Gestor User",
    loginMethod: "manus",
    role: "gestor",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    equipeId: equipeId || 1,
  } as any;

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("metasGlobais", () => {
  it("admin can get meta global for a month", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.metasGlobais.get({ mes: 2, ano: 2026 });

    // Should return a meta object (created if not exists)
    expect(result).toBeDefined();
    expect(result).toHaveProperty("mes", 2);
    expect(result).toHaveProperty("ano", 2026);
    expect(result).toHaveProperty("metaVGV");
    expect(result).toHaveProperty("metaContratos");
    expect(result).toHaveProperty("metaLeads");
    expect(result).toHaveProperty("metaAgendamentos");
    expect(result).toHaveProperty("metaVisitas");
  });

  it("admin can update meta global", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // First get to ensure it exists
    const meta = await caller.metasGlobais.get({ mes: 2, ano: 2026 });
    expect(meta).toBeDefined();
    expect(meta?.id).toBeDefined();

    // Update
    const updated = await caller.metasGlobais.update({
      id: meta!.id,
      metaVGV: "100000000",
      metaContratos: 20,
    });

    expect(updated).toBeDefined();
    expect(updated?.metaVGV).toBe("100000000.00");
    expect(updated?.metaContratos).toBe(20);
  });

  it("gestor can get meta global", async () => {
    const ctx = createGestorContext(1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.metasGlobais.get({ mes: 2, ano: 2026 });
    expect(result).toBeDefined();
    expect(result).toHaveProperty("mes", 2);
  });
});

describe("dashboardPerformance", () => {
  it("admin can get dashboard data for a month", { timeout: 30000 }, async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboardPerformance.getData({ mes: 2, ano: 2026 });

    expect(result).toBeDefined();
    expect(result).toHaveProperty("resumo");
    expect(result).toHaveProperty("corretores");
    expect(result).toHaveProperty("metaGlobal");

    // Resumo should have expected fields
    expect(result?.resumo).toHaveProperty("totalVGV");
    expect(result?.resumo).toHaveProperty("totalContratos");
    expect(result?.resumo).toHaveProperty("totalLeads");
    expect(result?.resumo).toHaveProperty("percentualAtingimento");
    expect(result?.resumo).toHaveProperty("gapMeta");
    expect(result?.resumo).toHaveProperty("totalCorretores");

    // Corretores should be an array
    expect(Array.isArray(result?.corretores)).toBe(true);
  });

  it("gestor gets filtered data for their team", { timeout: 30000 }, async () => {
    const ctx = createGestorContext(1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboardPerformance.getData({ mes: 2, ano: 2026 });

    expect(result).toBeDefined();
    expect(result).toHaveProperty("resumo");
    expect(result).toHaveProperty("corretores");
    // All corretores should belong to equipeId 1 (or empty if no corretores in that team)
    if (result?.corretores && result.corretores.length > 0) {
      for (const corretor of result.corretores) {
        expect(corretor.equipeId).toBe(1);
      }
    }
  });

  it("admin can get evolucao mensal", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboardPerformance.evolucaoMensal({ ano: 2026 });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(12);

    // Each month should have expected fields
    for (const month of result) {
      expect(month).toHaveProperty("mes");
      expect(month).toHaveProperty("mesNome");
      expect(month).toHaveProperty("vgvRealizado");
      expect(month).toHaveProperty("metaVGV");
      expect(month).toHaveProperty("percentual");
      expect(month).toHaveProperty("diferenca");
    }

    // Months should be in order
    expect(result[0].mesNome).toBe("Jan");
    expect(result[11].mesNome).toBe("Dez");
  });

  it("gestor can get evolucao mensal filtered by team", async () => {
    const ctx = createGestorContext(1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboardPerformance.evolucaoMensal({ ano: 2026 });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(12);
  });
});
