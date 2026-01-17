import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from './db';
import { users, leads } from '../drizzle/schema';
import * as db from './db';

describe('Funcionalidade de Registro de Visitas', () => {
  let testLeadId: number;
  let testCorretorId: number;
  
  beforeEach(async () => {
    const database = await getDb();
    if (!database) throw new Error('Database not available');
    
    // Criar corretor de teste
    const [corretor] = await database.insert(users).values({
      openId: `test-corretor-visita-${Date.now()}`,
      name: 'Corretor Teste Visitas',
      email: `corretor-visitas-${Date.now()}@test.com`,
      role: 'corretor',
      status: 'presente',
    });
    testCorretorId = corretor.insertId;
    
    // Criar lead de teste
    const [lead] = await database.insert(leads).values({
      nome: 'Lead Teste Visita',
      telefone: '11999999999',
      email: `lead-visita-${Date.now()}@test.com`,
      status: 'agendado',
      corretorId: testCorretorId,
      origem: 'Captação Corretor',
    });
    testLeadId = lead.insertId;
  });
  
  it('deve criar registro de visita na tabela visitas', async () => {
    const visita = await db.createVisita({
      leadId: testLeadId,
      corretorId: testCorretorId,
      dataVisita: new Date('2026-01-20'),
      horaVisita: '14:30',
      resultado: 'interesse_alto',
      observacoes: 'Cliente muito interessado no projeto',
      registradoPorId: testCorretorId,
    });
    
    expect(visita).toBeDefined();
    expect(visita.leadId).toBe(testLeadId);
    expect(visita.corretorId).toBe(testCorretorId);
    expect(visita.resultado).toBe('interesse_alto');
  });
  
  it('deve incrementar contador de visitas no dashboard após registro', async () => {
    // Obter métricas antes
    const metricasAntes = await db.getDashboardMetrics({});
    const visitasAntes = metricasAntes.visitasRealizadas;
    
    // Registrar visita
    await db.createVisita({
      leadId: testLeadId,
      corretorId: testCorretorId,
      dataVisita: new Date(),
      resultado: 'interesse_medio',
      registradoPorId: testCorretorId,
    });
    
    // Obter métricas depois
    const metricasDepois = await db.getDashboardMetrics({});
    const visitasDepois = metricasDepois.visitasRealizadas;
    
    expect(visitasDepois).toBe(visitasAntes + 1);
  });
  
  it('deve permitir múltiplas visitas para o mesmo lead', async () => {
    // Primeira visita
    const visita1 = await db.createVisita({
      leadId: testLeadId,
      corretorId: testCorretorId,
      dataVisita: new Date('2026-01-15'),
      resultado: 'interesse_medio',
      observacoes: 'Primeira visita',
      registradoPorId: testCorretorId,
    });
    
    // Segunda visita
    const visita2 = await db.createVisita({
      leadId: testLeadId,
      corretorId: testCorretorId,
      dataVisita: new Date('2026-01-20'),
      resultado: 'interesse_alto',
      observacoes: 'Segunda visita - cliente mais decidido',
      registradoPorId: testCorretorId,
    });
    
    expect(visita1.id).not.toBe(visita2.id);
    expect(visita1.leadId).toBe(visita2.leadId);
    
    // Verificar que ambas foram contabilizadas
    const metricas = await db.getDashboardMetrics({});
    expect(metricas.visitasRealizadas).toBeGreaterThanOrEqual(2);
  });
  
  it('deve preservar histórico mesmo quando lead avança de etapa', async () => {
    // Registrar visita
    await db.createVisita({
      leadId: testLeadId,
      corretorId: testCorretorId,
      dataVisita: new Date(),
      resultado: 'interesse_alto',
      registradoPorId: testCorretorId,
    });
    
    const metricasAposVisita = await db.getDashboardMetrics({});
    const visitasAposVisita = metricasAposVisita.visitasRealizadas;
    
    // Avançar lead para análise de crédito
    await db.updateLead(testLeadId, {
      status: 'analise_credito',
    });
    
    // Verificar que contador de visitas não diminuiu
    const metricasAposAvanco = await db.getDashboardMetrics({});
    const visitasAposAvanco = metricasAposAvanco.visitasRealizadas;
    
    expect(visitasAposAvanco).toBe(visitasAposVisita);
  });
  
  it('deve registrar visita com todos os campos opcionais', async () => {
    const visita = await db.createVisita({
      leadId: testLeadId,
      corretorId: testCorretorId,
      agendamentoId: 123, // ID fictício
      projectId: 456, // ID fictício
      projetoCustom: 'Residencial Vista Verde',
      construtora: 'Tenda',
      dataVisita: new Date('2026-01-18'),
      horaVisita: '15:00',
      resultado: 'encaminhado_analise',
      observacoes: 'Cliente gostou muito do projeto, solicitou análise de crédito',
      registradoPorId: testCorretorId,
    });
    
    expect(visita.projetoCustom).toBe('Residencial Vista Verde');
    expect(visita.construtora).toBe('Tenda');
    expect(visita.resultado).toBe('encaminhado_analise');
    expect(visita.observacoes).toContain('análise de crédito');
  });
  
  it('deve filtrar visitas por período de datas', async () => {
    // Criar visitas em datas diferentes
    await db.createVisita({
      leadId: testLeadId,
      corretorId: testCorretorId,
      dataVisita: new Date('2026-01-10'),
      resultado: 'interesse_medio',
      registradoPorId: testCorretorId,
    });
    
    await db.createVisita({
      leadId: testLeadId,
      corretorId: testCorretorId,
      dataVisita: new Date('2026-01-20'),
      resultado: 'interesse_alto',
      registradoPorId: testCorretorId,
    });
    
    // Buscar visitas do corretor
    const visitas = await db.getVisitasCorretor(testCorretorId, {
      dataInicio: new Date('2026-01-01'),
      dataFim: new Date('2026-01-31'),
    });
    
    expect(visitas.length).toBeGreaterThanOrEqual(2);
  });
});
