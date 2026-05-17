import { useEffect, useRef } from "react";
import { trpc } from "../lib/trpc.js";

type SSEHandler = (data: unknown) => void;

export function useSSE(handlers: Record<string, SSEHandler>) {
  const utils = trpc.useUtils();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const es = new EventSource("/api/events/corretor");

    es.onerror = () => {
      // Reconnects automatically
    };

    const registeredEvents: string[] = [];

    for (const event of Object.keys(handlersRef.current)) {
      const listener = (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data as string) as unknown;
          handlersRef.current[event]?.(data);
        } catch {
          // ignore parse errors
        }
      };
      es.addEventListener(event, listener);
      registeredEvents.push(event);
    }

    // Generic message to invalidate queries on lead updates
    const onLeadUpdate = () => {
      utils.leads.list.invalidate().catch(() => {});
      utils.leads.stats.invalidate().catch(() => {});
      utils.notificacoes.unreadCount.invalidate().catch(() => {});
    };

    es.addEventListener("lead_status_updated", onLeadUpdate);
    es.addEventListener("lead_recebido", onLeadUpdate);
    es.addEventListener("timer_expired", onLeadUpdate);

    return () => {
      es.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
