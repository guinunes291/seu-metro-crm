import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env.js";

const JWT_SECRET = new TextEncoder().encode(
  ENV.JWT_SECRET ?? "crm-v2-dev-secret-change-in-production-min-32-chars"
);

export type SessionUser = {
  id: number;
  openId: string;
  name: string;
  email: string | null;
  role: "admin" | "superintendente" | "gestor" | "corretor";
  status: "presente" | "ausente";
};

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function exchangeCodeForToken(
  code: string,
  _state: string
): Promise<{ accessToken: string; openId: string }> {
  const portalUrl = ENV.VITE_OAUTH_PORTAL_URL ?? "";
  const appId = ENV.VITE_APP_ID ?? "";

  const res = await fetch(`${portalUrl}/api/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, appId }),
  });

  if (!res.ok) {
    throw new Error(`OAuth token exchange failed: ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string; open_id: string };
  return { accessToken: data.access_token, openId: data.open_id };
}

export async function getUserInfo(
  accessToken: string
): Promise<{ openId: string; name: string; email: string | null }> {
  const portalUrl = ENV.VITE_OAUTH_PORTAL_URL ?? "";

  const res = await fetch(`${portalUrl}/api/oauth/userinfo`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Get user info failed: ${res.status}`);
  }

  const data = (await res.json()) as { open_id: string; name: string; email?: string };
  return { openId: data.open_id, name: data.name, email: data.email ?? null };
}
