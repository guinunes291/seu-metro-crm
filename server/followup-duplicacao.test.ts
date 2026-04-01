import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb, updateLead, registrarTentativaFollowUp } from './db';
import { leads, followUps, users } from '../drizzle/schema';
import { eq, and, sql, like } from 'drizzle-orm';

describe('Prevenção de Duplicação de Follow-ups', () => {
  let testLeadId: number;
  let testCorretorId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Criar corretor de teste
    const corretor = await db.insert(users).values({
      openId: `test-corretor-followup-dup-${Date.now()}`,
      name: 'Corretor Teste Duplicação',
      email: `corretor-dup-${Date.now()}@test.com`,
      role: 'corretor',
      status: 'presente',
    });
    testCorretorId = corretor[0].insertId;

    // Criar lead de teste
    const lead = await db.insert(leads).values({
      nome: 'Lead Teste Duplicação',
      telefone: '11999999999',
      email: 'lead-dup@test.com',
      origem: 'facebook',
      status: 'aguardando_atendimento',
      corretorId: testCorretorId,
    });
    testLeadId = lead[0].insertId;
  });

  it('não deve criar follow-up duplicado ao mudar status para em_atendimento múltiplas vezes', async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Mudar para em_atendimento pela primeira vez
    await updateLead(testLeadId, { status: 'em_atendimento' });

    // Contar follow-ups criados
    const followUps1 = await db.select()
      .from(followUps)
      .where(and(
        eq(followUps.leadId, testLeadId),
        eq(followUps.status, 'pendente')
      ));

    expect(followUps1.length).toBe(1);

    // Mudar para outro status e depois voltar para em_atendimento
    await updateLead(testLeadId, { status: 'agendado' });
    await updateLead(testLeadId, { status: 'em_atendimento' });

    // Contar follow-ups novamente - deve continuar sendo 1 (não duplicou)
    const followUps2 = await db.select()
      .from(followUps)
      .where(and(
        eq(followUps.leadId, testLeadId),
        eq(followUps.status, 'pendente')
      ));

    expect(followUps2.length).toBe(1);
  });

  it('não deve criar follow-up duplicado ao registrar resposta múltiplas vezes no mesmo dia', async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Garantir que lead está em atendimento com follow-up pendente
    await updateLead(testLeadId, { status: 'em_atendimento' });

    // Buscar follow-up pendente
    const followUpsPendentes = await db.select()
      .from(followUps)
      .where(and(
        eq(followUps.leadId, testLeadId),
        eq(followUps.status, 'pendente')
      ))
      .limit(1);

    expect(followUpsPendentes.length).toBeGreaterThan(0);
    const followUpId = followUpsPendentes[0].id;

    // Registrar que cliente respondeu (cria novo follow-up para amanhã)
    await registrarTentativaFollowUp(followUpId, 'respondeu', 'Cliente respondeu no WhatsApp');

    // Contar follow-ups pendentes após primeira resposta
    const followUpsApos1 = await db.select()
      .from(followUps)
      .where(and(
        eq(followUps.leadId, testLeadId),
        eq(followUps.status, 'pendente')
      ));

    const quantidadeApos1 = followUpsApos1.length;
    expect(quantidadeApos1).toBeGreaterThan(0);

    // Buscar o novo follow-up criado
    const novoFollowUp = followUpsApos1[0];

    // Tentar registrar resposta novamente no mesmo follow-up
    await registrarTentativaFollowUp(novoFollowUp.id, 'respondeu', 'Cliente respondeu novamente');

    // Contar follow-ups pendentes - não deve ter duplicado
    const followUpsApos2 = await db.select()
      .from(followUps)
      .where(and(
        eq(followUps.leadId, testLeadId),
        eq(followUps.status, 'pendente')
      ));

    // Deve ter apenas 1 follow-up pendente (o criado após a segunda resposta)
    expect(followUpsApos2.length).toBe(1);
  });

  it('não deve haver follow-ups duplicados para mesma data', async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Buscar todos os follow-ups pendentes do lead
    const todosFollowUps = await db.select()
      .from(followUps)
      .where(and(
        eq(followUps.leadId, testLeadId),
        eq(followUps.status, 'pendente')
      ));

    // Agrupar por data para verificar duplicação
    const porData = new Map<string, number>();
    for (const fu of todosFollowUps) {
      const data = new Date(fu.dataFollowUp).toISOString().split('T')[0];
      porData.set(data, (porData.get(data) || 0) + 1);
    }

    // Verificar que não há mais de 1 follow-up por data
    for (const [data, count] of porData.entries()) {
      expect(count).toBe(1, `Encontrados ${count} follow-ups para a data ${data}, esperado 1`);
    }
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    // Limpar follow-ups do lead de teste
    if (testLeadId) {
      await db.delete(followUps).where(eq(followUps.leadId, testLeadId));
      await db.delete(leads).where(eq(leads.id, testLeadId));
    }
    // Limpar corretor de teste
    if (testCorretorId) {
      await db.delete(users).where(eq(users.id, testCorretorId));
    }
    // Limpeza extra: remover qualquer usuário com email de teste
    const testUsers = await db.select({ id: users.id }).from(users).where(like(users.email, '%@test.com'));
    for (const u of testUsers) {
      await db.delete(leads).where(eq(leads.corretorId, u.id));
      await db.delete(users).where(eq(users.id, u.id));
    }
  });
});
