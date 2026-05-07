/**
 * Server-Sent Events manager.
 *
 * Maintains a Map of userId → active SSE Response objects.
 * Called by distribuirLeadPelaRoleta to push instant notifications
 * to the corretor's browser without waiting for the next poll cycle.
 */

import type { Response } from "express";

type SSEConnection = {
  res: Response;
  keepAlive: NodeJS.Timeout;
};

const connections = new Map<number, SSEConnection[]>();

export function addSSEConnection(userId: number, res: Response): void {
  const keepAlive = setInterval(() => {
    try {
      res.write("event: ping\ndata: {}\n\n");
    } catch {
      removeSSEConnection(userId, res);
    }
  }, 25_000);

  const conn: SSEConnection = { res, keepAlive };
  const existing = connections.get(userId) ?? [];
  connections.set(userId, [...existing, conn]);
}

export function removeSSEConnection(userId: number, res: Response): void {
  const existing = connections.get(userId) ?? [];
  const filtered = existing.filter((c) => {
    if (c.res === res) {
      clearInterval(c.keepAlive);
      return false;
    }
    return true;
  });
  if (filtered.length === 0) {
    connections.delete(userId);
  } else {
    connections.set(userId, filtered);
  }
}

export function notifySSEUser(
  userId: number,
  event: string,
  data: Record<string, unknown>
): void {
  const conns = connections.get(userId);
  if (!conns || conns.length === 0) return;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const { res } of conns) {
    try {
      res.write(payload);
    } catch {
      // Connection already closed — will be cleaned up on 'close' event
    }
  }
}
