/**
 * Testes unitários para a lógica do hook useWebhookLeadNotification
 * Valida a lógica pura sem dependência de React ou banco de dados
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Lógica pura extraída do hook ---

const TEN_MINUTES_MS = 10 * 60 * 1000;

function getInitialSince(stored: string | null): string {
  const tenMinutesAgo = new Date(Date.now() - TEN_MINUTES_MS);

  if (stored) {
    const storedDate = new Date(stored);
    return storedDate > tenMinutesAgo
      ? storedDate.toISOString()
      : tenMinutesAgo.toISOString();
  }

  return new Date().toISOString();
}

function calcularNovoSince(
  leads: Array<{ id: number; createdAt: string | null }>,
  notifiedIds: Set<number>
): { newSince: string | null; novosLeads: number[] } {
  let latestCreatedAt: Date | null = null;
  const novosLeads: number[] = [];

  leads.forEach((lead) => {
    if (notifiedIds.has(lead.id)) return;
    novosLeads.push(lead.id);

    const leadDate = lead.createdAt ? new Date(lead.createdAt) : null;
    if (leadDate && (!latestCreatedAt || leadDate > latestCreatedAt)) {
      latestCreatedAt = leadDate;
    }
  });

  if (!latestCreatedAt) return { newSince: null, novosLeads };

  const newSince = new Date((latestCreatedAt as Date).getTime() + 1).toISOString();
  return { newSince, novosLeads };
}

// --- Testes ---

describe("useWebhookLeadNotification — lógica pura", () => {
  describe("getInitialSince()", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-06T12:00:00.000Z"));
    });

    it("retorna timestamp atual quando não há nada no localStorage", () => {
      const result = getInitialSince(null);
      expect(new Date(result).getTime()).toBeCloseTo(
        new Date("2026-03-06T12:00:00.000Z").getTime(),
        -2
      );
    });

    it("retorna o stored quando está dentro dos últimos 10 minutos", () => {
      const fiveMinutesAgo = new Date("2026-03-06T11:55:00.000Z").toISOString();
      const result = getInitialSince(fiveMinutesAgo);
      expect(result).toBe(fiveMinutesAgo);
    });

    it("retorna 10 minutos atrás quando stored é muito antigo (mais de 10 min)", () => {
      const oneHourAgo = new Date("2026-03-06T11:00:00.000Z").toISOString();
      const result = getInitialSince(oneHourAgo);
      const expected = new Date("2026-03-06T11:50:00.000Z");
      expect(new Date(result).getTime()).toBeCloseTo(expected.getTime(), -2);
    });

    it("retorna 10 minutos atrás quando stored é exatamente 10 minutos atrás", () => {
      const tenMinutesAgo = new Date("2026-03-06T11:50:00.000Z").toISOString();
      const result = getInitialSince(tenMinutesAgo);
      // Stored é igual ao limite — deve retornar o stored (não é mais antigo)
      expect(result).toBe(tenMinutesAgo);
    });
  });

  describe("calcularNovoSince()", () => {
    it("retorna null quando não há leads novos", () => {
      const { newSince, novosLeads } = calcularNovoSince([], new Set());
      expect(newSince).toBeNull();
      expect(novosLeads).toHaveLength(0);
    });

    it("retorna null quando todos os leads já foram notificados", () => {
      const leads = [
        { id: 1, createdAt: "2026-03-06T12:00:00.000Z" },
        { id: 2, createdAt: "2026-03-06T12:01:00.000Z" },
      ];
      const notified = new Set([1, 2]);
      const { newSince, novosLeads } = calcularNovoSince(leads, notified);
      expect(newSince).toBeNull();
      expect(novosLeads).toHaveLength(0);
    });

    it("retorna 1ms após o lead mais recente", () => {
      const leads = [
        { id: 1, createdAt: "2026-03-06T12:00:00.000Z" },
        { id: 2, createdAt: "2026-03-06T12:05:00.000Z" }, // mais recente
        { id: 3, createdAt: "2026-03-06T12:02:00.000Z" },
      ];
      const { newSince, novosLeads } = calcularNovoSince(leads, new Set());
      const expectedTime = new Date("2026-03-06T12:05:00.001Z").getTime();
      expect(new Date(newSince!).getTime()).toBe(expectedTime);
      expect(novosLeads).toEqual([1, 2, 3]);
    });

    it("ignora leads já notificados ao calcular o since", () => {
      const leads = [
        { id: 1, createdAt: "2026-03-06T12:00:00.000Z" }, // já notificado
        { id: 2, createdAt: "2026-03-06T12:03:00.000Z" }, // novo
      ];
      const notified = new Set([1]);
      const { newSince, novosLeads } = calcularNovoSince(leads, notified);
      const expectedTime = new Date("2026-03-06T12:03:00.001Z").getTime();
      expect(new Date(newSince!).getTime()).toBe(expectedTime);
      expect(novosLeads).toEqual([2]);
    });

    it("lida com leads sem createdAt (null)", () => {
      const leads = [
        { id: 1, createdAt: null },
        { id: 2, createdAt: "2026-03-06T12:01:00.000Z" },
      ];
      const { newSince, novosLeads } = calcularNovoSince(leads, new Set());
      const expectedTime = new Date("2026-03-06T12:01:00.001Z").getTime();
      expect(new Date(newSince!).getTime()).toBe(expectedTime);
      expect(novosLeads).toEqual([1, 2]);
    });
  });
});
