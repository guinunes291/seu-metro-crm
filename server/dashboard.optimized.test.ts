/**
 * Testes para validar a otimização do getDashboardMetrics
 * 
 * A função foi refatorada de 9 queries separadas para 5 queries em paralelo:
 * - 1 query consolidada para leads (total, aguardando, emAtendimento, perdido)
 * - 4 queries para tabelas relacionadas (agendamentos, visitas, análises, contratos)
 * - 1 query para VGV
 * Total: 6 queries em paralelo (vs 9 antes)
 */
import { describe, it, expect } from "vitest";
import * as db from "./db";

describe("getDashboardMetrics - Otimização de Queries", () => {
  it("deve retornar todos os campos esperados após otimização", async () => {
    const metrics = await db.getDashboardMetrics();
    
    expect(metrics).toBeDefined();
    expect(metrics).not.toBeNull();
    
    // Verificar que todos os campos ainda existem após a refatoração
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

  it("deve retornar valores numéricos válidos em todos os campos", async () => {
    const metrics = await db.getDashboardMetrics();
    
    expect(metrics).toBeDefined();
    expect(typeof metrics?.total).toBe("number");
    expect(typeof metrics?.aguardando).toBe("number");
    expect(typeof metrics?.emAtendimento).toBe("number");
    expect(typeof metrics?.agendado).toBe("number");
    expect(typeof metrics?.visitaRealizada).toBe("number");
    expect(typeof metrics?.analiseCredito).toBe("number");
    expect(typeof metrics?.contratoFechado).toBe("number");
    expect(typeof metrics?.perdido).toBe("number");
    expect(typeof metrics?.vgv).toBe("number");
    
    // Todos os valores devem ser >= 0
    expect(metrics!.total).toBeGreaterThanOrEqual(0);
    expect(metrics!.aguardando).toBeGreaterThanOrEqual(0);
    expect(metrics!.emAtendimento).toBeGreaterThanOrEqual(0);
    expect(metrics!.agendado).toBeGreaterThanOrEqual(0);
    expect(metrics!.visitaRealizada).toBeGreaterThanOrEqual(0);
    expect(metrics!.analiseCredito).toBeGreaterThanOrEqual(0);
    expect(metrics!.contratoFechado).toBeGreaterThanOrEqual(0);
    expect(metrics!.perdido).toBeGreaterThanOrEqual(0);
    expect(metrics!.vgv).toBeGreaterThanOrEqual(0);
  });

  it("deve retornar total >= soma dos status de leads", async () => {
    const metrics = await db.getDashboardMetrics();
    
    expect(metrics).toBeDefined();
    // O total deve ser >= soma dos status conhecidos (aguardando + emAtendimento + perdido)
    // (outros status como 'contrato_fechado' não estão incluídos nos contadores de leads)
    const somaStatusConhecidos = metrics!.aguardando + metrics!.emAtendimento + metrics!.perdido;
    expect(metrics!.total).toBeGreaterThanOrEqual(somaStatusConhecidos);
  });

  it("deve filtrar corretamente por período de data", async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    const metrics = await db.getDashboardMetrics({
      dataInicio: startOfMonth,
      dataFim: endOfMonth,
    });
    
    expect(metrics).toBeDefined();
    expect(metrics?.total).toBeGreaterThanOrEqual(0);
    
    // Métricas filtradas devem ser <= métricas totais
    const metricasTotal = await db.getDashboardMetrics();
    expect(metrics!.total).toBeLessThanOrEqual(metricasTotal!.total);
  });

  it("deve retornar zero leads quando filtro de corretores é array vazio", async () => {
    const metrics = await db.getDashboardMetrics({
      corretoresIds: [], // Gestor sem corretores na equipe
    });
    
    expect(metrics).toBeDefined();
    expect(metrics?.total).toBe(0);
    expect(metrics?.aguardando).toBe(0);
    expect(metrics?.emAtendimento).toBe(0);
    expect(metrics?.perdido).toBe(0);
  });

  it("deve funcionar com filtro de corretores específicos", async () => {
    // Buscar um corretor real do banco
    const leadsPorCorretor = await db.getLeadsPorCorretorDashboard();
    
    if (leadsPorCorretor.length > 0) {
      const primeiroCorretor = leadsPorCorretor[0];
      
      const metrics = await db.getDashboardMetrics({
        corretoresIds: [primeiroCorretor.id],
      });
      
      expect(metrics).toBeDefined();
      expect(metrics?.total).toBeGreaterThanOrEqual(0);
      
      // Total filtrado deve ser <= total geral
      const metricasTotal = await db.getDashboardMetrics();
      expect(metrics!.total).toBeLessThanOrEqual(metricasTotal!.total);
    }
  });
});
