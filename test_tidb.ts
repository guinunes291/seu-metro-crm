import { getDb } from './server/db';
import { leads } from './drizzle/schema';
import { gte, lte, and, sql } from 'drizzle-orm';

(async () => {
  const db = await getDb();
  if (!db) { console.log('No db'); process.exit(1); }

  // Testar com datas sem milissegundos
  const d1 = new Date('2026-04-06T03:00:00.000Z');
  const d2 = new Date('2026-05-06T03:59:59.000Z');
  
  console.log('d1:', d1.toISOString(), 'ms:', d1.getMilliseconds());
  console.log('d2:', d2.toISOString(), 'ms:', d2.getMilliseconds());
  
  // Testar query simples
  try {
    const rows = await db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(gte(leads.createdAt, d1), lte(leads.createdAt, d2)));
    console.log('Query simples OK:', rows);
  } catch(e: any) {
    console.error('Query simples FALHOU:', e.message.slice(0, 300));
  }
  
  // Testar com DATE_FORMAT
  try {
    const rows = await db.select({
      dataStr: sql<string>`DATE_FORMAT(${leads.createdAt}, '%Y-%m-%d')`.as('dataStr'),
      count: sql<number>`count(*)`.as('count'),
    })
      .from(leads)
      .where(and(gte(leads.createdAt, d1), lte(leads.createdAt, d2)))
      .groupBy(sql`DATE_FORMAT(${leads.createdAt}, '%Y-%m-%d')`);
    console.log('DATE_FORMAT query OK:', rows.length, 'rows');
  } catch(e: any) {
    console.error('DATE_FORMAT query FALHOU:', e.message.slice(0, 300));
  }
  
  // Testar com datas sem milissegundos usando setMilliseconds(0)
  const d3 = new Date(d1);
  d3.setMilliseconds(0);
  const d4 = new Date(d2);
  d4.setMilliseconds(0);
  
  console.log('\nd3 (setMs=0):', d3.toISOString());
  console.log('d4 (setMs=0):', d4.toISOString());
  
  try {
    const rows = await db.select({
      dataStr: sql<string>`DATE_FORMAT(${leads.createdAt}, '%Y-%m-%d')`.as('dataStr'),
      count: sql<number>`count(*)`.as('count'),
    })
      .from(leads)
      .where(and(gte(leads.createdAt, d3), lte(leads.createdAt, d4)))
      .groupBy(sql`DATE_FORMAT(${leads.createdAt}, '%Y-%m-%d')`);
    console.log('DATE_FORMAT com setMs=0 OK:', rows.length, 'rows');
  } catch(e: any) {
    console.error('DATE_FORMAT com setMs=0 FALHOU:', e.message.slice(0, 300));
  }
  
  // Testar com strings SQL diretas
  try {
    const rows = await db.execute(sql`SELECT DATE_FORMAT(createdAt, '%Y-%m-%d') as dataStr, count(*) as count FROM leads WHERE createdAt >= '2026-04-06 03:00:00' AND createdAt <= '2026-05-06 03:59:59' GROUP BY DATE_FORMAT(createdAt, '%Y-%m-%d')`);
    console.log('SQL direto OK:', (rows[0] as any[]).length, 'rows');
  } catch(e: any) {
    console.error('SQL direto FALHOU:', e.message.slice(0, 300));
  }
  
  process.exit(0);
})();
