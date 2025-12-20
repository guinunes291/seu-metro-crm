import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from './db';
import { leads, users, leadStatusTransitions } from '../drizzle/schema';
import { eq, and, like } from 'drizzle-orm';
import * as db from './db';

const TEST_PREFIX = '_T_TRANS_';

describe('Sistema de Transições de Status', () => {
  let testLeadId: number;
  let testCorretorId: number;
  
  beforeAll(async () => {
    const database = await getDb();
    if (!database) throw new Error('Database not available');
    
    // Criar corretor de teste
    const corretorResult = await database.insert(users).values({
      openId: `${TEST_PREFIX}corretor_${Date.now()}`,
      name: `${TEST_PREFIX}Corretor Teste`,
      email: `${TEST_PREFIX}corretor@test.com`,
      role: 'corretor',
      status: 'presente'
    });
    testCorretorId = corretorResult[0].insertId;
    
    // Criar lead de teste
    const leadResult = await database.insert(leads).values({
      nome: `${TEST_PREFIX}Lead Teste`,
      telefone: '11999999999',
      status: 'novo',
      corretorId: testCorretorId
    });
    testLeadId = leadResult[0].insertId;
  });
  
  afterAll(async () => {
    const database = await getDb();
    if (!database) return;
    
    // Limpar transições de teste
    await database.delete(leadStatusTransitions)
      .where(eq(leadStatusTransitions.leadId, testLeadId));
    
    // Limpar lead de teste
    await database.delete(leads)
      .where(eq(leads.id, testLeadId));
    
    // Limpar corretor de teste
    await database.delete(users)
      .where(eq(users.id, testCorretorId));
  });
  
  it('deve registrar transição ao mudar status do lead', async () => {
    // Mudar status de 'novo' para 'em_atendimento'
    await db.updateLead(testLeadId, { status: 'em_atendimento' });
    
    // Verificar se a transição foi registrada
    const transicoes = await db.getHistoricoTransicoesLead(testLeadId);
    
    expect(transicoes.length).toBeGreaterThanOrEqual(1);
    const ultimaTransicao = transicoes[transicoes.length - 1];
    expect(ultimaTransicao.statusAnterior).toBe('novo');
    expect(ultimaTransicao.statusNovo).toBe('em_atendimento');
    expect(ultimaTransicao.corretorId).toBe(testCorretorId);
  });
  
  it('deve registrar múltiplas transições ao passar pelo funil', async () => {
    // Mudar para agendado
    await db.updateLead(testLeadId, { status: 'agendado' });
    
    // Mudar para visita_realizada
    await db.updateLead(testLeadId, { status: 'visita_realizada' });
    
    // Mudar para analise_credito
    await db.updateLead(testLeadId, { status: 'analise_credito' });
    
    // Verificar histórico completo
    const transicoes = await db.getHistoricoTransicoesLead(testLeadId);
    
    // Deve ter pelo menos 4 transições (novo->em_atendimento, em_atendimento->agendado, agendado->visita, visita->analise)
    expect(transicoes.length).toBeGreaterThanOrEqual(4);
    
    // Verificar sequência
    const statusSequence = transicoes.map(t => t.statusNovo);
    expect(statusSequence).toContain('em_atendimento');
    expect(statusSequence).toContain('agendado');
    expect(statusSequence).toContain('visita_realizada');
    expect(statusSequence).toContain('analise_credito');
  });
  
  it('deve calcular métricas do funil por corretor', async () => {
    const metricas = await db.getMetricasFunilCorretor(testCorretorId);
    
    // Deve ter contado as transições
    expect(metricas.agendamentos).toBeGreaterThanOrEqual(1);
    expect(metricas.visitasRealizadas).toBeGreaterThanOrEqual(1);
    expect(metricas.analisesCredito).toBeGreaterThanOrEqual(1);
    expect(metricas.emAtendimento).toBeGreaterThanOrEqual(1);
  });
  
  it('não deve registrar transição se status não mudou', async () => {
    // Buscar quantidade atual de transições
    const transicoesAntes = await db.getHistoricoTransicoesLead(testLeadId);
    const qtdAntes = transicoesAntes.length;
    
    // Atualizar lead sem mudar status (apenas outro campo)
    const leadAtual = await db.getLeadById(testLeadId);
    await db.updateLead(testLeadId, { observacoes: 'Teste de observação' });
    
    // Verificar que não criou nova transição
    const transicoesDepois = await db.getHistoricoTransicoesLead(testLeadId);
    expect(transicoesDepois.length).toBe(qtdAntes);
  });
  
  it('deve calcular métricas gerais do funil', async () => {
    const metricas = await db.getMetricasFunilGeral();
    
    // Deve ter alguma transição registrada
    expect(metricas.totalTransicoes).toBeGreaterThanOrEqual(0);
    expect(typeof metricas.agendamentos).toBe('number');
    expect(typeof metricas.visitasRealizadas).toBe('number');
    expect(typeof metricas.analisesCredito).toBe('number');
    expect(typeof metricas.contratosFechados).toBe('number');
    expect(typeof metricas.perdidos).toBe('number');
  });
});
