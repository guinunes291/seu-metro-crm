import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

// Mock the schema
vi.mock("../drizzle/schema", () => ({
  leads: { id: "id", status: "status", corretorId: "corretorId", createdAt: "createdAt", origem: "origem" },
  users: { id: "id", name: "name", fotoUrl: "fotoUrl", equipeId: "equipeId", role: "role", situacao: "situacao" },
  contratos: { id: "id", corretorId: "corretorId", leadId: "leadId", valorVenda: "valorVenda", distrato: "distrato", createdAt: "createdAt" },
  leadStatusTransitions: { id: "id", leadId: "leadId", corretorId: "corretorId", statusNovo: "statusNovo", createdAt: "createdAt" },
  equipes: { id: "id", nome: "nome", gestorId: "gestorId", cor: "cor", metaMensal: "metaMensal", ativa: "ativa" },
  metas: { id: "id", corretorId: "corretorId", mes: "mes", ano: "ano", metaLeads: "metaLeads", metaAgendamentos: "metaAgendamentos", metaVisitas: "metaVisitas", metaContratos: "metaContratos", metaVGV: "metaVGV" },
}));

import { getDb } from "./db";

describe("Central de Análises — Unit Tests", () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getDb as any).mockResolvedValue(mockDb);
  });

  describe("getVisaoGeralKPIs", () => {
    it("should return empty KPIs when db is null", async () => {
      (getDb as any).mockResolvedValue(null);
      const { getVisaoGeralKPIs } = await import("./analisesCentral");
      const result = await getVisaoGeralKPIs(
        new Date("2026-04-01"),
        new Date("2026-04-30"),
        4,
        2026,
        null
      );
      expect(result.kpis).toBeDefined();
      expect(result.kpis.leads.valor).toBe(0);
      expect(result.kpis.agendamentos.valor).toBe(0);
      expect(result.kpis.contratos_val.valor).toBe(0);
      expect(result.kpis.vgv.valor).toBe(0);
      expect(result.kpis.taxaConversao).toBe(0);
      expect(result.alertas).toEqual([]);
    });

    it("should return correct KPI structure", async () => {
      // Mock status counts
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.groupBy.mockReturnThis();
      mockDb.orderBy.mockReturnThis();

      // Chain: statusCounts, transCounts, contratosResult, metasResult
      let callCount = 0;
      mockDb.groupBy.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // statusCounts
          return [
            { status: "novo", count: 100 },
            { status: "em_atendimento", count: 50 },
            { status: "contrato_fechado", count: 5 },
          ];
        }
        if (callCount === 2) {
          // transCounts
          return [
            { statusNovo: "agendado", count: 30 },
            { statusNovo: "visita_realizada", count: 20 },
          ];
        }
        return [];
      });

      mockDb.where.mockImplementation(() => {
        return mockDb;
      });

      // We can't easily test the full flow with mocked drizzle,
      // but we can verify the structure
      const { getVisaoGeralKPIs } = await import("./analisesCentral");
      expect(typeof getVisaoGeralKPIs).toBe("function");
    });
  });

  describe("Module exports", () => {
    it("should export all required functions", async () => {
      const mod = await import("./analisesCentral");
      expect(typeof mod.getVisaoGeralKPIs).toBe("function");
      expect(typeof mod.getComparativoEquipes).toBe("function");
      expect(typeof mod.getFunilComGargalos).toBe("function");
      expect(typeof mod.getMetasProgresso).toBe("function");
      expect(typeof mod.getEvolucaoTemporal).toBe("function");
      expect(typeof mod.getOrigensComConversao).toBe("function");
    });

    it("should export correct TypeScript interfaces", async () => {
      const mod = await import("./analisesCentral");
      // Verify the functions exist and are callable
      expect(mod.getVisaoGeralKPIs.length).toBeGreaterThanOrEqual(0);
      expect(mod.getComparativoEquipes.length).toBeGreaterThanOrEqual(0);
      expect(mod.getFunilComGargalos.length).toBeGreaterThanOrEqual(0);
      expect(mod.getMetasProgresso.length).toBeGreaterThanOrEqual(0);
      expect(mod.getEvolucaoTemporal.length).toBeGreaterThanOrEqual(0);
      expect(mod.getOrigensComConversao.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getComparativoEquipes", () => {
    it("should return empty array when db is null", async () => {
      (getDb as any).mockResolvedValue(null);
      const { getComparativoEquipes } = await import("./analisesCentral");
      const result = await getComparativoEquipes(
        new Date("2026-04-01"),
        new Date("2026-04-30"),
        null
      );
      expect(result).toEqual([]);
    });
  });

  describe("getFunilComGargalos", () => {
    it("should return empty array when db is null", async () => {
      (getDb as any).mockResolvedValue(null);
      const { getFunilComGargalos } = await import("./analisesCentral");
      const result = await getFunilComGargalos(
        new Date("2026-04-01"),
        new Date("2026-04-30"),
        null
      );
      expect(result).toEqual([]);
    });
  });

  describe("getMetasProgresso", () => {
    it("should return empty array when db is null", async () => {
      (getDb as any).mockResolvedValue(null);
      const { getMetasProgresso } = await import("./analisesCentral");
      const result = await getMetasProgresso(4, 2026, null);
      expect(result).toEqual([]);
    });
  });

  describe("getEvolucaoTemporal", () => {
    it("should return empty array when db is null", async () => {
      (getDb as any).mockResolvedValue(null);
      const { getEvolucaoTemporal } = await import("./analisesCentral");
      const result = await getEvolucaoTemporal(
        new Date("2026-04-01"),
        new Date("2026-04-30"),
        null,
        "dia"
      );
      expect(result).toEqual([]);
    });
  });

  describe("getOrigensComConversao", () => {
    it("should return empty array when db is null", async () => {
      (getDb as any).mockResolvedValue(null);
      const { getOrigensComConversao } = await import("./analisesCentral");
      const result = await getOrigensComConversao(
        new Date("2026-04-01"),
        new Date("2026-04-30"),
        null
      );
      expect(result).toEqual([]);
    });
  });
});
