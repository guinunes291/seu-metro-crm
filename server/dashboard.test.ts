import { describe, it, expect } from "vitest";
import * as db from "./db";

describe("Dashboard do Gestor - Métricas", () => {
  it("deve retornar métricas do dashboard sem filtro de data", async () => {
    const metrics = await db.getDashboardMetrics();
    
    expect(metrics).toBeDefined();
    expect(metrics).toHaveProperty("total");
    expect(metrics).toHaveProperty("aguardando");
    expect(metrics).toHaveProperty("emAtendimento");
    expect(metrics).toHaveProperty("agendado");
    expect(metrics).toHaveProperty("visitaRealizada");
    expect(metrics).toHaveProperty("analiseCredito");
    expect(metrics).toHaveProperty("contratoFechado");
    expect(metrics).toHaveProperty("perdido");
    expect(metrics).toHaveProperty("vgv");
  });

  it("deve retornar métricas do dashboard com filtro de data", async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const metrics = await db.getDashboardMetrics({
      dataInicio: startOfMonth,
      dataFim: endOfMonth,
    });
    
    expect(metrics).toBeDefined();
    expect(metrics?.total).toBeGreaterThanOrEqual(0);
  });

  it("deve retornar leads por corretor", async () => {
    const leadsPorCorretor = await db.getLeadsPorCorretorDashboard();
    
    expect(Array.isArray(leadsPorCorretor)).toBe(true);
    
    // Verificar estrutura do resultado
    if (leadsPorCorretor.length > 0) {
      const corretor = leadsPorCorretor[0];
      expect(corretor).toHaveProperty("id");
      expect(corretor).toHaveProperty("nome");
      expect(corretor).toHaveProperty("totalLeads");
    }
  });

  it("deve retornar agendamentos por corretor", async () => {
    const agendamentos = await db.getAgendamentosPorCorretor();
    
    expect(Array.isArray(agendamentos)).toBe(true);
    
    if (agendamentos.length > 0) {
      const corretor = agendamentos[0];
      expect(corretor).toHaveProperty("id");
      expect(corretor).toHaveProperty("nome");
      expect(corretor).toHaveProperty("agendados");
    }
  });

  it("deve retornar visitas por corretor", async () => {
    const visitas = await db.getVisitasPorCorretor();
    
    expect(Array.isArray(visitas)).toBe(true);
    
    if (visitas.length > 0) {
      const corretor = visitas[0];
      expect(corretor).toHaveProperty("id");
      expect(corretor).toHaveProperty("nome");
      expect(corretor).toHaveProperty("visitas");
    }
  });

  it("deve retornar vendas por corretor com VGV", async () => {
    const vendas = await db.getVendasPorCorretor();
    
    expect(Array.isArray(vendas)).toBe(true);
    
    if (vendas.length > 0) {
      const corretor = vendas[0];
      expect(corretor).toHaveProperty("id");
      expect(corretor).toHaveProperty("nome");
      expect(corretor).toHaveProperty("vendas");
      expect(corretor).toHaveProperty("vgv");
    }
  });

  it("deve filtrar métricas por período específico", async () => {
    // Filtrar por período que não deve ter dados (ano passado)
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 2);
    const endLastYear = new Date(lastYear);
    endLastYear.setMonth(endLastYear.getMonth() + 1);

    const metrics = await db.getDashboardMetrics({
      dataInicio: lastYear,
      dataFim: endLastYear,
    });
    
    expect(metrics).toBeDefined();
    // Período antigo deve ter poucos ou nenhum lead
    expect(metrics?.total).toBeGreaterThanOrEqual(0);
  });

  it("deve calcular VGV corretamente para contratos fechados", async () => {
    const metrics = await db.getDashboardMetrics();
    
    expect(metrics).toBeDefined();
    expect(typeof metrics?.vgv).toBe("number");
    expect(metrics?.vgv).toBeGreaterThanOrEqual(0);
  });

  it("deve filtrar leads por corretor com filtro de data", async () => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const endOfYear = new Date(now.getFullYear(), 11, 31);

    const leadsPorCorretor = await db.getLeadsPorCorretorDashboard({
      dataInicio: startOfYear,
      dataFim: endOfYear,
    });
    
    expect(Array.isArray(leadsPorCorretor)).toBe(true);
  });

  it("deve filtrar vendas por corretor com filtro de data", async () => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const endOfYear = new Date(now.getFullYear(), 11, 31);

    const vendas = await db.getVendasPorCorretor({
      dataInicio: startOfYear,
      dataFim: endOfYear,
    });
    
    expect(Array.isArray(vendas)).toBe(true);
  });
});
