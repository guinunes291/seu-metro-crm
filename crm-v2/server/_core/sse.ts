import type { Response } from "express";

type SSEConnection = {
  res: Response;
  userId: number;
  keepaliveInterval: ReturnType<typeof setInterval>;
};

const connections = new Map<number, SSEConnection[]>();

export function addSSEConnection(userId: number, res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const keepalive = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 25_000);

  const connection: SSEConnection = { res, userId, keepaliveInterval: keepalive };

  const existing = connections.get(userId) ?? [];
  connections.set(userId, [...existing, connection]);

  res.on("close", () => {
    clearInterval(keepalive);
    const current = connections.get(userId) ?? [];
    connections.set(
      userId,
      current.filter((c) => c !== connection)
    );
  });
}

export function notifySSEUser(userId: number, event: string, data: unknown): void {
  const userConnections = connections.get(userId) ?? [];
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const conn of userConnections) {
    try {
      conn.res.write(payload);
    } catch {
      // Connection closed
    }
  }
}

export function getConnectedUsers(): number[] {
  return Array.from(connections.keys()).filter((id) => (connections.get(id)?.length ?? 0) > 0);
}
