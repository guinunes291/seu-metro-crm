import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
config();

const conn = await createConnection(process.env.DATABASE_URL);

const [rows] = await conn.execute(`
  SELECT 
    p.id,
    p.nome,
    COUNT(l.id) as total_leads
  FROM projects p
  LEFT JOIN leads l ON l.projectId = p.id
  WHERE 
    p.nome REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
    OR p.nome REGEXP '^[0-9,\\.E\\+]+$'
    OR CHAR_LENGTH(TRIM(p.nome)) <= 2
    OR p.nome LIKE 'http%'
    OR p.nome LIKE '%undefined%'
    OR p.nome LIKE '%null%'
    OR p.nome LIKE '%NaN%'
  GROUP BY p.id, p.nome
  ORDER BY total_leads ASC, p.nome
  LIMIT 200
`);

console.log('Total encontrados:', rows.length);
console.log('');
for (const r of rows) {
  console.log('[ID:' + r.id + '] leads:' + r.total_leads + ' | "' + r.nome + '"');
}

await conn.end();
