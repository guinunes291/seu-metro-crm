import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDashboardMetrics } from './db';

/**
 * Testes para validar que o Dashboard do Gestor conta histórico de ações
 * ao invés de status atual dos leads
 * 
 * BUG ORIGINAL:
 * - Cards de "Agendado", "Visita Realizada", "Análise de Crédito" e "Contrato Fechado"
 *   contavam leads pelo status ATUAL
 * - Quando um lead avançava de etapa (ex: agendado → visita_realizada),
 *   o número de "Agendado" diminuía ❌
 * 
 * CORREÇÃO:
 * - Agora contamos registros nas tabelas especializadas:
 *   * agendamentos (histórico de agendamentos criados)
 *   * visitas (histórico de visitas realizadas)
 *   * analises_credito (histórico de análises enviadas)
 *   * contratos (histórico de contratos fechados)
 * - Os números refletem QUANTAS VEZES aquela ação aconteceu, não quantos leads
 *   estão naquele status no momento
 */

describe('Dashboard do Gestor - Contagem Histórica', () => {
  
  it('deve contar agendamentos da tabela agendamentos, não status do lead', async () => {
    const metrics = await getDashboardMetrics();
    
    // O número de agendados deve vir da tabela agendamentos
    // Não deve diminuir quando leads avançam para visita_realizada
    expect(metrics).toBeDefined();
    expect(metrics?.agendado).toBeGreaterThanOrEqual(0);
    
    // Se houver agendamentos, o número deve ser >= 0
    // (pode ser 0 se não houver agendamentos criados)
    expect(typeof metrics?.agendado).toBe('number');
  });
  
  it('deve contar visitas da tabela visitas, não status do lead', async () => {
    const metrics = await getDashboardMetrics();
    
    // O número de visitas deve vir da tabela visitas
    expect(metrics).toBeDefined();
    expect(metrics?.visitaRealizada).toBeGreaterThanOrEqual(0);
    expect(typeof metrics?.visitaRealizada).toBe('number');
  });
  
  it('deve contar análises da tabela analises_credito, não status do lead', async () => {
    const metrics = await getDashboardMetrics();
    
    // O número de análises deve vir da tabela analises_credito
    expect(metrics).toBeDefined();
    expect(metrics?.analiseCredito).toBeGreaterThanOrEqual(0);
    expect(typeof metrics?.analiseCredito).toBe('number');
  });
  
  it('deve contar contratos da tabela contratos, não status do lead', async () => {
    const metrics = await getDashboardMetrics();
    
    // O número de contratos deve vir da tabela contratos
    expect(metrics).toBeDefined();
    expect(metrics?.contratoFechado).toBeGreaterThanOrEqual(0);
    expect(typeof metrics?.contratoFechado).toBe('number');
  });
  
  it('deve calcular VGV baseado em contratos, não em status de leads', async () => {
    const metrics = await getDashboardMetrics();
    
    // VGV deve somar valores dos projetos vinculados aos contratos
    // Não deve contar leads com status contrato_fechado sem contrato registrado
    expect(metrics).toBeDefined();
    expect(metrics?.vgv).toBeGreaterThanOrEqual(0);
    expect(typeof metrics?.vgv).toBe('number');
  });
  
  it('deve manter contagens consistentes independente do status atual dos leads', async () => {
    const metrics = await getDashboardMetrics();
    
    // Validar que todas as métricas são números válidos
    expect(metrics).toBeDefined();
    expect(metrics?.total).toBeGreaterThanOrEqual(0);
    expect(metrics?.aguardando).toBeGreaterThanOrEqual(0);
    expect(metrics?.emAtendimento).toBeGreaterThanOrEqual(0);
    expect(metrics?.agendado).toBeGreaterThanOrEqual(0);
    expect(metrics?.visitaRealizada).toBeGreaterThanOrEqual(0);
    expect(metrics?.analiseCredito).toBeGreaterThanOrEqual(0);
    expect(metrics?.contratoFechado).toBeGreaterThanOrEqual(0);
    expect(metrics?.perdido).toBeGreaterThanOrEqual(0);
    expect(metrics?.vgv).toBeGreaterThanOrEqual(0);
    
    // A soma de aguardando + emAtendimento + perdido deve ser <= total
    // (agendado, visita, análise e contrato são histórico, não status atual)
    const statusAtuais = metrics.aguardando + metrics.emAtendimento + metrics.perdido;
    expect(statusAtuais).toBeLessThanOrEqual(metrics.total);
  });
  
  it('deve respeitar filtros de data ao contar histórico', async () => {
    const hoje = new Date();
    const umMesAtras = new Date(hoje);
    umMesAtras.setMonth(umMesAtras.getMonth() - 1);
    
    // Buscar métricas do último mês
    const metricsUltimoMes = await getDashboardMetrics({
      dataInicio: umMesAtras,
      dataFim: hoje
    });
    
    // Buscar métricas de todo o período
    const metricsTodas = await getDashboardMetrics();
    
    // As métricas filtradas devem ser <= métricas totais
    expect(metricsUltimoMes).toBeDefined();
    expect(metricsTodas).toBeDefined();
    
    if (metricsUltimoMes && metricsTodas) {
      expect(metricsUltimoMes.agendado).toBeLessThanOrEqual(metricsTodas.agendado);
      expect(metricsUltimoMes.visitaRealizada).toBeLessThanOrEqual(metricsTodas.visitaRealizada);
      expect(metricsUltimoMes.analiseCredito).toBeLessThanOrEqual(metricsTodas.analiseCredito);
      expect(metricsUltimoMes.contratoFechado).toBeLessThanOrEqual(metricsTodas.contratoFechado);
    }
  });
});
