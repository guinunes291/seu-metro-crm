import { describe, it, expect, beforeAll } from 'vitest';
import * as db from './db';
import { users, leads } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

describe('Transferência de Leads', () => {
  let gestorId: number;
  let corretor1Id: number;
  let corretor2Id: number;
  let leadId: number;

  beforeAll(async () => {
    const dbInstance = db.getDb();
    // Buscar gestor existente
    const gestor = await dbInstance.select().from(users).where(eq(users.role, 'gestor')).limit(1);
    if (gestor.length === 0) throw new Error('Gestor não encontrado');
    gestorId = gestor[0].id;

    // Buscar dois corretores existentes
    const corretores = await dbInstance.select().from(users).where(eq(users.role, 'corretor')).limit(2);
    if (corretores.length < 2) throw new Error('Pelo menos 2 corretores necessários');
    corretor1Id = corretores[0].id;
    corretor2Id = corretores[1].id;

    // Buscar um lead do corretor1
    const leadsCorretor1 = await dbInstance.select().from(leads).where(eq(leads.userId, corretor1Id)).limit(1);
    if (leadsCorretor1.length === 0) throw new Error('Lead não encontrado para corretor1');
    leadId = leadsCorretor1[0].id;
  });

  it('deve transferir lead de um corretor para outro', async () => {
    const dbInstance = db.getDb();
    // Verificar lead antes da transferência
    const leadAntes = await dbInstance.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    expect(leadAntes[0].userId).toBe(corretor1Id);

    // Transferir lead
    await dbInstance.update(leads)
      .set({ userId: corretor2Id })
      .where(eq(leads.id, leadId));

    // Verificar lead depois da transferência
    const leadDepois = await dbInstance.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    expect(leadDepois[0].userId).toBe(corretor2Id);

    // Reverter transferência (cleanup)
    await dbInstance.update(leads)
      .set({ userId: corretor1Id })
      .where(eq(leads.id, leadId));
  });

  it('deve preservar dados do lead após transferência', async () => {
    const dbInstance = db.getDb();
    // Buscar dados do lead antes
    const leadAntes = await dbInstance.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    const nomeAntes = leadAntes[0].nome;
    const telefoneAntes = leadAntes[0].telefone;
    const emailAntes = leadAntes[0].email;

    // Transferir lead
    await dbInstance.update(leads)
      .set({ userId: corretor2Id })
      .where(eq(leads.id, leadId));

    // Verificar dados preservados
    const leadDepois = await dbInstance.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    expect(leadDepois[0].nome).toBe(nomeAntes);
    expect(leadDepois[0].telefone).toBe(telefoneAntes);
    expect(leadDepois[0].email).toBe(emailAntes);

    // Reverter transferência (cleanup)
    await dbInstance.update(leads)
      .set({ userId: corretor1Id })
      .where(eq(leads.id, leadId));
  });

  it('deve contar corretamente leads por corretor após transferência', async () => {
    const dbInstance = db.getDb();
    // Contar leads antes
    const leadsCorretor1Antes = await dbInstance.select().from(leads).where(eq(leads.userId, corretor1Id));
    const leadsCorretor2Antes = await dbInstance.select().from(leads).where(eq(leads.userId, corretor2Id));
    
    const countCorretor1Antes = leadsCorretor1Antes.length;
    const countCorretor2Antes = leadsCorretor2Antes.length;

    // Transferir lead
    await dbInstance.update(leads)
      .set({ userId: corretor2Id })
      .where(eq(leads.id, leadId));

    // Contar leads depois
    const leadsCorretor1Depois = await dbInstance.select().from(leads).where(eq(leads.userId, corretor1Id));
    const leadsCorretor2Depois = await dbInstance.select().from(leads).where(eq(leads.userId, corretor2Id));

    expect(leadsCorretor1Depois.length).toBe(countCorretor1Antes - 1);
    expect(leadsCorretor2Depois.length).toBe(countCorretor2Antes + 1);

    // Reverter transferência (cleanup)
    await dbInstance.update(leads)
      .set({ userId: corretor1Id })
      .where(eq(leads.id, leadId));
  });
});
