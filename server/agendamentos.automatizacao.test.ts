import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as db from './db';

describe('Automatização de Status do Lead', () => {
  let testLeadId: number;
  let testCorretorId: number;
  let testAgendamentoId: number;

  beforeAll(async () => {
    // Criar corretor de teste
    const corretor = await db.createCorretor({
      nome: 'Corretor Teste Automatização',
      email: `corretor-auto-${Date.now()}@teste.com`,
      telefone: '11999999999',
      statusPlantao: 'presente',
    });
    testCorretorId = corretor.id;

    // Criar lead de teste
    const lead = await db.createLead({
      nome: 'Lead Teste Automatização',
      telefone: `119${Date.now()}`,
      email: `lead-auto-${Date.now()}@teste.com`,
      status: 'em_atendimento',
      corretorId: testCorretorId,
      origem: 'outro',
      dataDistribuicao: new Date(),
    });
    testLeadId = lead!.id;
  });

  afterAll(async () => {
    // Limpar dados de teste
    if (testAgendamentoId) {
      await db.deleteAgendamento(testAgendamentoId);
    }
    if (testLeadId) {
      await db.deleteLead(testLeadId);
    }
    if (testCorretorId) {
      await db.deleteCorretor(testCorretorId);
    }
  });

  it('deve mudar status do lead para "agendado" ao criar agendamento', async () => {
    // Verificar status inicial
    const leadAntes = await db.getLeadById(testLeadId);
    expect(leadAntes?.status).toBe('em_atendimento');

    // Criar agendamento
    const dataAgendamento = new Date();
    dataAgendamento.setDate(dataAgendamento.getDate() + 1); // Amanhã

    const agendamento = await db.createAgendamento({
      leadId: testLeadId,
      corretorId: testCorretorId,
      dataAgendamento,
      horaAgendamento: '14:00',
      observacoes: 'Teste de automatização',
    });
    testAgendamentoId = agendamento.id;

    // Verificar se o status mudou para "agendado"
    const leadDepois = await db.getLeadById(testLeadId);
    expect(leadDepois?.status).toBe('agendado');
  });

  it('deve registrar alteração de status no histórico ao criar agendamento', async () => {
    // Buscar histórico do lead
    const historico = await db.getLeadHistory(testLeadId);
    
    // Verificar se há registro de mudança de status para "agendado"
    const mudancaStatus = historico.find(
      h => h.tipo === 'mudanca_status' && h.statusNovo === 'agendado'
    );
    
    expect(mudancaStatus).toBeDefined();
    expect(mudancaStatus?.statusAnterior).toBe('em_atendimento');
    expect(mudancaStatus?.observacoes).toContain('automaticamente ao criar agendamento');
  });

  it('deve mudar status do lead para "visita_realizada" ao marcar agendamento como realizado', async () => {
    // Atualizar status do agendamento para "realizado"
    await db.updateAgendamentoStatus(testAgendamentoId, 'realizado');

    // Verificar se o status do lead mudou para "visita_realizada"
    const lead = await db.getLeadById(testLeadId);
    expect(lead?.status).toBe('visita_realizada');
  });

  it('deve registrar alteração de status no histórico ao marcar agendamento como realizado', async () => {
    // Buscar histórico do lead
    const historico = await db.getLeadHistory(testLeadId);
    
    // Verificar se há registro de mudança de status para "visita_realizada"
    const mudancaStatus = historico.find(
      h => h.tipo === 'mudanca_status' && h.statusNovo === 'visita_realizada'
    );
    
    expect(mudancaStatus).toBeDefined();
    expect(mudancaStatus?.statusAnterior).toBe('agendado');
    expect(mudancaStatus?.observacoes).toContain('automaticamente ao marcar agendamento como realizado');
  });

  it('deve manter status "visita_realizada" após marcar agendamento como realizado', async () => {
    // Verificar que o status final é "visita_realizada"
    const lead = await db.getLeadById(testLeadId);
    expect(lead?.status).toBe('visita_realizada');
    
    // Verificar que há pelo menos 2 mudanças de status no histórico
    const historico = await db.getLeadHistory(testLeadId);
    const mudancasStatus = historico.filter(h => h.tipo === 'mudanca_status');
    expect(mudancasStatus.length).toBeGreaterThanOrEqual(2);
  });
});
