/**
 * Subscribes to the /api/events/corretor SSE stream.
 * When the server pushes a 'novo_lead' event (immediately after
 * distribuirLeadPelaRoleta runs), we invalidate the leadsPrioritarios
 * query so the banner and "O que fazer agora?" update without waiting
 * for the next polling cycle.
 */

import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export function useLeadEvents() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!user || user.role !== "corretor") return;

    let es: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    function connect() {
      if (closed) return;
      es = new EventSource("/api/events/corretor");

      es.addEventListener("novo_lead", () => {
        utils.dashboard.leadsPrioritarios.invalidate();
        utils.leads.getNewWebhookLeads.invalidate();
      });

      es.onerror = () => {
        es?.close();
        // Reconnect after 5s on error (network blip, server restart, etc.)
        if (!closed) {
          reconnectTimeout = setTimeout(connect, 5_000);
        }
      };
    }

    connect();

    return () => {
      closed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      es?.close();
    };
  }, [user?.id, user?.role]);
}
