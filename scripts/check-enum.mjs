import { createConnection } from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('No DATABASE_URL');
  process.exit(1);
}

const conn = await createConnection(url);
const [rows] = await conn.query("SHOW COLUMNS FROM lead_estoque LIKE 'tipoFila'");
console.log('lead_estoque.tipoFila:', JSON.stringify(rows[0]?.Type));

const [rows2] = await conn.query("SHOW COLUMNS FROM distribution_log LIKE 'tipoFila'");
console.log('distribution_log.tipoFila:', JSON.stringify(rows2[0]?.Type));

await conn.end();
