import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context.js";
import type { UserRole } from "../../shared/const.js";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

function requireRole(roles: UserRole[]) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.user || !roles.includes(ctx.user.role as UserRole)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx: { ...ctx, user: ctx.user! } });
  });
}

export const corretorProcedure = protectedProcedure.use(
  requireRole(["corretor", "gestor", "superintendente", "admin"])
);

export const gestorProcedure = protectedProcedure.use(
  requireRole(["gestor", "superintendente", "admin"])
);

export const adminProcedure = protectedProcedure.use(
  requireRole(["superintendente", "admin"])
);

export const superAdminProcedure = protectedProcedure.use(requireRole(["admin"]));
