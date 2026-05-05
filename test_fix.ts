import { getDb } from './server/db';
import { leads } from './drizzle/schema';
import { gte, lte, and, sql } from 'drizzle-orm';

(async () => {
  const db = await getDb();
  if (!db) { console.log('No db'); process.exit(1); }

  const d1 = new Date('2026-04-06T03:00:00.000Z');
  const d2 = new Date('2026-05-06T03:59:59.000Z');
  
  // Solução 1: usar alias no groupBy em vez de referenciar a coluna
  try {
    const rows = await db.select({
      dataStr: sql<string>`DATE_FORMAT(${leads.createdAt}, '%Y-%m-%d')`.as('dataStr'),
      status: leads.status,
      count: sql<number>`count(*)`.as('count'),
    })
      .from(leads)
      .where(and(gte(leads.createdAt, d1), lte(leads.createdAt, d2)))
      .groupBy(sql`DATE_FORMAT(createdAt, '%Y-%m-%d')`, leads.status);
    console.log('Solução 1 (groupBy sem template literal de coluna) OK:', rows.length, 'rows');
    if (rows.length > 0) console.log('Amostra:', JSON.stringify(rows.slice(0, 2)));
  } catch(e: any) {
    console.error('Solução 1 FALHOU:', e.message.slice(0, 300));
  }
  
  // Solução 2: usar sql raw completo
  try {
    const rows = await db.execute(sql`
      SELECT DATE_FORMAT(createdAt, '%Y-%m-%d') as dataStr, status, count(*) as count 
      FROM leads 
      WHERE createdAt >= ${d1} AND createdAt <= ${d2}
      GROUP BY DATE_FORMAT(createdAt, '%Y-%m-%d'), status
    `);
    const data = rows[0] as any[];
    console.log('Solução 2 (sql raw com params bindados) OK:', data.length, 'rows');
    if (data.length > 0) console.log('Amostra:', JSON.stringify(data.slice(0, 2)));
  } catch(e: any) {
    console.error('Solução 2 FALHOU:', e.message.slice(0, 300));
  }
  
  process.exit(0);
})();
