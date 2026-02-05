import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { 
  createTarefa, 
  getTarefaById, 
  updateLeadProximaTarefaData, 
  getFollowUpsPendentes,
  concluirTarefa 
} from './db';
import { getDb } from './db';
import { users, leads, tarefas, followUps } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

describe('Sistema de Tarefas com Lead', () => {
  let testLeadId: number;
  let testCorretorId: number;
  let testTarefaId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Criar corretor de teste
    const corretor = await db.insert(users).values({
      openId: 'test-corretor-tarefa-lead',
      name: 'Corretor Teste Tarefa',
      email: 'corretor.tarefa@test.com',
      role: 'corretor',
    });
    testCorretorId = corretor[0].insertId;

    // Criar lead de teste
    const lead = await db.insert(leads).values({
      nome: 'Lead Teste Tarefa',
      telefone: '11999999999',
      corretorId: testCorretorId,
      status: 'em_atendimento',
    });
    testLeadId = lead[0].insertId;
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Limpar dados de teste
    await db.delete(tarefas).where(eq(tarefas.corretorId, testCorretorId));
    await db.delete(followUps).where(eq(followUps.leadId, testLeadId));
    await db.delete(leads).where(eq(leads.id, testLeadId));
    await db.delete(users).where(eq(users.id, testCorretorId));
  });

  it('deve criar tarefa vinculada a um lead', async () => {
    const dataFutura = new Date();
    dataFutura.setDate(dataFutura.getDate() + 3);

    testTarefaId = await createTarefa({
      corretorId: testCorretorId,
      leadId: testLeadId,
      titulo: 'Ligar para cliente',
      descricao: 'Retornar contato sobre documentação',
      tipo: 'ligacao',
      dataAgendada: dataFutura,
      prioridade: 'alta',
      status: 'pendente',
    });

    expect(testTarefaId).toBeGreaterThan(0);

    const tarefa = await getTarefaById(testTarefaId);
    expect(tarefa).toBeDefined();
    expect(tarefa?.leadId).toBe(testLeadId);
    expect(tarefa?.titulo).toBe('Ligar para cliente');
  });

  it('deve atualizar proximaTarefaData do lead', async () => {
    const dataFutura = new Date();
    dataFutura.setDate(dataFutura.getDate() + 3);

    await updateLeadProximaTarefaData(testLeadId, dataFutura);

    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const [lead] = await db.select({ proximaTarefaData: leads.proximaTarefaData })
      .from(leads)
      .where(eq(leads.id, testLeadId));

    expect(lead.proximaTarefaData).toBeDefined();
    expect(new Date(lead.proximaTarefaData).getTime()).toBeCloseTo(dataFutura.getTime(), -3);
  });

  it('deve verificar que proximaTarefaData pode ser definido como nulo', async () => {
    // Definir proximaTarefaData no futuro
    const dataFutura = new Date();
    dataFutura.setDate(dataFutura.getDate() + 3);
    await updateLeadProximaTarefaData(testLeadId, dataFutura);

    const db = await getDb();
    if (!db) throw new Error('Database not available');

    let [lead] = await db.select({ proximaTarefaData: leads.proximaTarefaData })
      .from(leads)
      .where(eq(leads.id, testLeadId));
    expect(lead.proximaTarefaData).toBeDefined();

    // Limpar proximaTarefaData
    await updateLeadProximaTarefaData(testLeadId, null);

    [lead] = await db.select({ proximaTarefaData: leads.proximaTarefaData })
      .from(leads)
      .where(eq(leads.id, testLeadId));
    expect(lead.proximaTarefaData).toBeNull();
  });



  it('deve limpar proximaTarefaData manualmente', async () => {
    // Definir proximaTarefaData no futuro
    const dataFutura = new Date();
    dataFutura.setDate(dataFutura.getDate() + 5);
    await updateLeadProximaTarefaData(testLeadId, dataFutura);

    // Verificar que foi definido
    let db = await getDb();
    if (!db) throw new Error("Database not available");
    let [lead] = await db.select({ proximaTarefaData: leads.proximaTarefaData })
      .from(leads)
      .where(eq(leads.id, testLeadId));
    expect(lead.proximaTarefaData).toBeDefined();

    // Limpar proximaTarefaData
    await updateLeadProximaTarefaData(testLeadId, null);

    // Verificar se proximaTarefaData foi limpo
    db = await getDb();
    if (!db) throw new Error("Database not available");
    [lead] = await db.select({ proximaTarefaData: leads.proximaTarefaData })
      .from(leads)
      .where(eq(leads.id, testLeadId));

    // proximaTarefaData deve ser null
    expect(lead.proximaTarefaData).toBeNull();
  });


});
