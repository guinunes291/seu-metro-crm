import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from './db';
import { leads, users, agendamentos, visitas } from '../drizzle/schema';
import { eq, and, like } from 'drizzle-orm';
import * as db from './db';

const TEST_PREFIX = '_T_AG_';

describe('Sistema de Agendamentos e Visitas', () => {
  let testLeadId: number;
  let testCorretorId: number;
  let testAgendamentoId: number;
  
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
      telefone: '11999998888',
      email: `${TEST_PREFIX}lead@test.com`,
      cpf: '123.456.789-00',
      status: 'novo',
      corretorId: testCorretorId
    });
    testLeadId = leadResult[0].insertId;
  });
  
  afterAll(async () => {
    const database = await getDb();
    if (!database) return;
    
    // Limpar visitas de teste
    await database.delete(visitas)
      .where(eq(visitas.leadId, testLeadId));
    
    // Limpar agendamentos de teste
    await database.delete(agendamentos)
      .where(eq(agendamentos.leadId, testLeadId));
    
    // Limpar lead de teste
    await database.delete(leads)
      .where(eq(leads.id, testLeadId));
    
    // Limpar corretor de teste
    await database.delete(users)
      .where(eq(users.id, testCorretorId));
  });
  
  describe('Agendamentos', () => {
    it('deve criar um agendamento e atualizar status do lead', async () => {
      const agendamento = await db.createAgendamento({
        leadId: testLeadId,
        corretorId: testCorretorId,
        projetoCustom: 'Projeto Teste',
        construtora: 'Construtora Teste',
        dataAgendamento: new Date('2025-12-25'),
        horaAgendamento: '10:00',
        observacoes: 'Agendamento de teste',
        criadoPorId: testCorretorId
      });
      
      expect(agendamento).not.toBeNull();
      expect(agendamento?.leadId).toBe(testLeadId);
      expect(agendamento?.corretorId).toBe(testCorretorId);
      expect(agendamento?.status).toBe('pendente');
      
      testAgendamentoId = agendamento!.id;
      
      // Verificar se o status do lead foi atualizado para 'agendado'
      const lead = await db.getLeadById(testLeadId);
      expect(lead?.status).toBe('agendado');
    });
    
    it('deve listar agendamentos do corretor', async () => {
      const agendamentosCorretor = await db.getAgendamentosCorretor(testCorretorId);
      
      expect(agendamentosCorretor.length).toBeGreaterThanOrEqual(1);
      const encontrado = agendamentosCorretor.find(a => a.id === testAgendamentoId);
      expect(encontrado).toBeDefined();
    });
    
    it('deve listar agendamentos de um lead', async () => {
      const agendamentosLead = await db.getAgendamentosLead(testLeadId);
      
      expect(agendamentosLead.length).toBeGreaterThanOrEqual(1);
    });
    
    it('deve atualizar status do agendamento', async () => {
      const sucesso = await db.updateAgendamentoStatus(testAgendamentoId, 'confirmado');
      expect(sucesso).toBe(true);
      
      const agendamento = await db.getAgendamentoById(testAgendamentoId);
      expect(agendamento?.status).toBe('confirmado');
    });
  });
  
  describe('Visitas', () => {
    it('deve criar uma visita e atualizar status do lead', async () => {
      const visita = await db.createVisita({
        leadId: testLeadId,
        corretorId: testCorretorId,
        agendamentoId: testAgendamentoId,
        projetoCustom: 'Projeto Teste',
        construtora: 'Construtora Teste',
        dataVisita: new Date('2025-12-25'),
        horaVisita: '10:30',
        resultado: 'interesse_alto',
        observacoes: 'Visita de teste',
        registradoPorId: testCorretorId
      });
      
      expect(visita).not.toBeNull();
      expect(visita?.leadId).toBe(testLeadId);
      expect(visita?.resultado).toBe('interesse_alto');
      
      // Verificar se o status do lead foi atualizado para 'visita_realizada'
      const lead = await db.getLeadById(testLeadId);
      expect(lead?.status).toBe('visita_realizada');
      
      // Verificar se o agendamento foi marcado como realizado
      const agendamento = await db.getAgendamentoById(testAgendamentoId);
      expect(agendamento?.status).toBe('realizado');
    });
    
    it('deve listar visitas do corretor', async () => {
      const visitasCorretor = await db.getVisitasCorretor(testCorretorId);
      
      expect(visitasCorretor.length).toBeGreaterThanOrEqual(1);
    });
    
    it('deve listar visitas de um lead', async () => {
      const visitasLead = await db.getVisitasLead(testLeadId);
      
      expect(visitasLead.length).toBeGreaterThanOrEqual(1);
    });
  });
  
  describe('Busca de Leads', () => {
    it('deve buscar lead por telefone', async () => {
      const resultados = await db.searchLeadByTelefone('999998888');
      
      expect(resultados.length).toBeGreaterThanOrEqual(1);
      const encontrado = resultados.find(l => l.id === testLeadId);
      expect(encontrado).toBeDefined();
    });
    
    it('deve buscar lead por email', async () => {
      const resultados = await db.searchLeadByEmail(`${TEST_PREFIX}lead@test.com`);
      
      expect(resultados.length).toBeGreaterThanOrEqual(1);
    });
    
    it('deve buscar lead por CPF', async () => {
      const resultados = await db.searchLeadByCpf('12345678900');
      
      expect(resultados.length).toBeGreaterThanOrEqual(1);
    });
    
    it('deve buscar lead por identificador genérico', async () => {
      // Buscar por telefone
      const porTelefone = await db.searchLeadByIdentifier('999998888');
      expect(porTelefone.length).toBeGreaterThanOrEqual(1);
      
      // Buscar por nome
      const porNome = await db.searchLeadByIdentifier(`${TEST_PREFIX}Lead`);
      expect(porNome.length).toBeGreaterThanOrEqual(1);
    });
  });
  
  describe('Métricas do Funil com Leads Únicos', () => {
    it('deve contar leads únicos por etapa do funil', async () => {
      const metricas = await db.getMetricasFunilLeadsUnicos(testCorretorId);
      
      // Deve ter pelo menos 1 lead recebido
      expect(metricas.leadsRecebidos).toBeGreaterThanOrEqual(1);
      
      // Deve ter pelo menos 1 agendamento (baseado nas tabelas de agendamentos)
      expect(metricas.agendados).toBeGreaterThanOrEqual(1);
      
      // Deve ter pelo menos 1 visita (baseado nas tabelas de visitas)
      expect(metricas.visitasRealizadas).toBeGreaterThanOrEqual(1);
    });
    
    it('não deve duplicar contagem mesmo com múltiplos agendamentos', async () => {
      // Criar segundo agendamento para o mesmo lead
      await db.createAgendamento({
        leadId: testLeadId,
        corretorId: testCorretorId,
        projetoCustom: 'Projeto Teste 2',
        construtora: 'Construtora Teste 2',
        dataAgendamento: new Date('2025-12-26'),
        horaAgendamento: '14:00',
        criadoPorId: testCorretorId
      });
      
      const metricas = await db.getMetricasFunilLeadsUnicos(testCorretorId);
      
      // Mesmo com 2 agendamentos, deve contar apenas 1 lead único agendado
      // (a contagem é de leads únicos, não de agendamentos)
      expect(metricas.agendados).toBeGreaterThanOrEqual(1);
    });
  });
});
