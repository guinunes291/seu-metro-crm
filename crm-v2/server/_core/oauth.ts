import type { Express } from "express";
import { serialize as serializeCookie } from "cookie";
import { eq } from "drizzle-orm";
import { getDb } from "./db.js";
import { users } from "../../drizzle/schema/index.js";
import { createSessionToken, exchangeCodeForToken, getUserInfo } from "./sdk.js";
import { getSessionCookieOptions } from "./cookies.js";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { ENV } from "./env.js";

export function registerOAuthRoutes(app: Express): void {
  app.get("/api/oauth/callback", async (req, res) => {
    try {
      const { code, state } = req.query as { code?: string; state?: string };
      if (!code) {
        res.status(400).send("Missing code");
        return;
      }

      const { accessToken, openId } = await exchangeCodeForToken(code, state ?? "");
      const userInfo = await getUserInfo(accessToken);

      const db = await getDb();
      if (!db) {
        res.status(503).send("Database unavailable");
        return;
      }

      const existing = await db
        .select()
        .from(users)
        .where(eq(users.openId, openId))
        .limit(1);

      let user = existing[0];

      if (!user) {
        await db.insert(users).values({
          openId,
          name: userInfo.name,
          email: userInfo.email,
          role: "corretor",
          status: "ausente",
          lastSignedIn: new Date(),
        });
        const created = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
        user = created[0];
      } else {
        await db
          .update(users)
          .set({ name: userInfo.name, email: userInfo.email, lastSignedIn: new Date() })
          .where(eq(users.openId, openId));
      }

      if (!user) {
        res.status(500).send("Failed to create user");
        return;
      }

      const sessionToken = await createSessionToken({
        id: user.id,
        openId: user.openId,
        name: user.name,
        email: user.email ?? null,
        role: user.role,
        status: user.status,
      });

      const cookieOptions = getSessionCookieOptions(req);
      const cookieStr = serializeCookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS / 1000,
      });

      res.setHeader("Set-Cookie", cookieStr);
      res.redirect("/");
    } catch (err) {
      console.error("[OAuth] Callback error:", err);
      res.status(500).send("Authentication failed");
    }
  });

  app.get("/api/oauth/logout", (req, res) => {
    const cookieStr = serializeCookie(COOKIE_NAME, "", {
      ...getSessionCookieOptions(req),
      maxAge: 0,
    });
    res.setHeader("Set-Cookie", cookieStr);
    const portalUrl = ENV.VITE_OAUTH_PORTAL_URL ?? "/";
    res.redirect(portalUrl);
  });
}
