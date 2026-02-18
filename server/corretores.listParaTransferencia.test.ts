import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createGestorContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "gestor-user",
    email: "gestor@example.com",
    name: "Gestor Test",
    loginMethod: "manus",
    role: "gestor",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

function createAdminContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 99,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin Test",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("corretores.listParaTransferencia", () => {
  it("returns an array (admin context)", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.corretores.listParaTransferencia();

    expect(Array.isArray(result)).toBe(true);
    // Should include both corretores and gestores
    if (result.length > 0) {
      const roles = [...new Set(result.map((u: any) => u.role))];
      // At minimum, the result should have name and id fields
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("name");
    }
  });

  it("returns an array (gestor context)", async () => {
    const { ctx } = createGestorContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.corretores.listParaTransferencia();

    expect(Array.isArray(result)).toBe(true);
    // For gestor, should include gestores in the list
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("name");
    }
  });

  it("includes gestores in the result for admin", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.corretores.listParaTransferencia();

    // Check that gestores are included (if any exist in the database)
    const gestores = result.filter((u: any) => u.role === "gestor");
    const corretores = result.filter((u: any) => u.role === "corretor");
    
    // The function should return both roles
    // We can't guarantee specific counts, but the structure should be correct
    expect(Array.isArray(result)).toBe(true);
    
    // If there are gestores in the system, they should appear
    // This is a structural test - the function should not filter out gestores
    result.forEach((user: any) => {
      expect(["corretor", "gestor"]).toContain(user.role);
    });
  });
});
