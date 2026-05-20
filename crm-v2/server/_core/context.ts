import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookies } from "cookie";
import { verifySessionToken, type SessionUser } from "./sdk.js";
import { COOKIE_NAME } from "../../shared/const.js";

export type TrpcContext = {
  user: SessionUser | null;
};

export async function createContext({ req }: CreateExpressContextOptions): Promise<TrpcContext> {
  const cookieHeader = req.headers.cookie ?? "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies[COOKIE_NAME];

  if (!token) return { user: null };

  const user = await verifySessionToken(token);
  return { user };
}
