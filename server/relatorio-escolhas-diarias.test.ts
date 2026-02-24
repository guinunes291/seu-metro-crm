import { describe, it, expect, afterAll } from 'vitest';
import { getDb } from './db';
import { escolhaDiariaFollowUp } from '../drizzle/schema';
import { sql } from 'drizzle-orm';

describe('Relatório de Escolhas Diárias de Follow-up', () => {

  afterAll(async () => {
    // Limpar dados de teste
    const db = await getDb();
    if (!db) return;
    await db.delete(escolhaDiariaFollowUp).where(sql`corretorId >= 9990000`);
  });

  it('deve inserir e consultar estatísticas de escolhas diárias', async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    // Limpar dados anteriores
    await db.delete(escolhaDiariaFollowUp).where(sql`corretorId >= 9990000`);
    
    // Inserir dados de teste
    const hoje = new Date();
    await db.insert(escolhaDiariaFollowUp).values([
      { corretorId: 9990001, data: hoje, aceitouFollowUp: true },
      { corretorId: 9990002, data: hoje, aceitouFollowUp: true },
      { corretorId: 9990003, data: hoje, aceitouFollowUp: false },
    ]);

    // Consultar estatísticas
    const result = await db
      .select({
        totalEscolhas: sql<number>`COUNT(*)`,
        aceitaram: sql<number>`SUM(CASE WHEN aceitouFollowUp = 1 THEN 1 ELSE 0 END)`,
        recusaram: sql<number>`SUM(CASE WHEN aceitouFollowUp = 0 THEN 1 ELSE 0 END)`,
      })
      .from(escolhaDiariaFollowUp)
      .where(sql`DATE(data) = DATE(${hoje}) AND corretorId >= 9990000`);

    expect(Number(result[0].totalEscolhas)).toBe(3);
    expect(Number(result[0].aceitaram)).toBe(2);
    expect(Number(result[0].recusaram)).toBe(1);
    
    // Calcular taxa de adesão
    const taxaAdesao = (Number(result[0].aceitaram) / Number(result[0].totalEscolhas)) * 100;
    expect(taxaAdesao).toBeCloseTo(66.67, 1); // 2/3 = 66.67%
  });

  it('deve agrupar escolhas por data corretamente', async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    // Limpar dados anteriores
    await db.delete(escolhaDiariaFollowUp).where(sql`corretorId >= 9990000`);
    
    const hoje = new Date();
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Inserir dados de teste para dois dias diferentes
    await db.insert(escolhaDiariaFollowUp).values([
      { corretorId: 9990001, data: hoje, aceitouFollowUp: true },
      { corretorId: 9990002, data: hoje, aceitouFollowUp: true },
      { corretorId: 9990003, data: hoje, aceitouFollowUp: false },
      { corretorId: 9990004, data: ontem, aceitouFollowUp: true },
      { corretorId: 9990005, data: ontem, aceitouFollowUp: false },
    ]);

    const result = await db
      .select({
        data: sql<string>`DATE(data)`,
        total: sql<number>`COUNT(*)`,
      })
      .from(escolhaDiariaFollowUp)
      .where(sql`corretorId >= 9990000`)
      .groupBy(sql`DATE(data)`)
      .orderBy(sql`DATE(data)`);

    expect(result.length).toBe(2);
    expect(result.some(r => Number(r.total) === 3)).toBe(true); // 3 escolhas hoje
    expect(result.some(r => Number(r.total) === 2)).toBe(true); // 2 escolhas ontem
  });

  it('deve filtrar escolhas por corretor específico', async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    // Limpar dados anteriores
    await db.delete(escolhaDiariaFollowUp).where(sql`corretorId >= 9990000`);
    
    const hoje = new Date();
    
    // Inserir dados de teste para múltiplos corretores
    await db.insert(escolhaDiariaFollowUp).values([
      { corretorId: 9990001, data: hoje, aceitouFollowUp: true },
      { corretorId: 9990001, data: hoje, aceitouFollowUp: true },
      { corretorId: 9990002, data: hoje, aceitouFollowUp: false },
    ]);

    // Consultar apenas corretor 9990001
    const result = await db
      .select({
        total: sql<number>`COUNT(*)`,
        aceitaram: sql<number>`SUM(CASE WHEN aceitouFollowUp = 1 THEN 1 ELSE 0 END)`,
      })
      .from(escolhaDiariaFollowUp)
      .where(sql`corretorId = 9990001`);

    expect(Number(result[0].total)).toBe(2);
    expect(Number(result[0].aceitaram)).toBe(2);
  });
});
