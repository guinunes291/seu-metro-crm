import { createConnection } from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('No DATABASE_URL');
  process.exit(1);
}

const conn = await createConnection(url);
const [rows] = await conn.query("SELECT COUNT(*) as total FROM leads WHERE corretorId IS NOT NULL");
console.log('Leads com corretorId:', rows[0].total);

const [rows2] = await conn.query("SELECT COUNT(*) as total FROM leads WHERE nome LIKE '[TEST]%'");
console.log('Leads de teste:', rows2[0].total);

const [rows3] = await conn.query("SELECT corretorId, COUNT(*) as total FROM leads WHERE corretorId IS NOT NULL GROUP BY corretorId LIMIT 5");
console.log('Primeiros 5 corretores com leads:', rows3);

await conn.end();
