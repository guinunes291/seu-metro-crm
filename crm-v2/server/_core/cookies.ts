import type { Request } from "express";
import type { SerializeOptions } from "cookie";

export function getSessionCookieOptions(req: Request): SerializeOptions {
  const isHttps =
    req.secure ||
    req.headers["x-forwarded-proto"] === "https" ||
    process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? "strict" : "lax",
    path: "/",
  };
}
