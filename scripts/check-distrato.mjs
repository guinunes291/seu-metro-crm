import { createConnection } from 'mysql2/promise';

const url = process.env.DATABASE_URL || '';
// Parse: mysql://user:pass@host:port/db?ssl=...
const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
if (!match) {
  console.log('No DB URL found');
  process.exit(1);
}

const conn = await createConnection({
  host: match[3],
  port: parseInt(match[4]),
  user: match[1],
  password: match[2],
  database: match[5],
  ssl: { rejectUnauthorized: false }
});

const [rows] = await conn.query('DESCRIBE contratos');
const fields = rows.filter(r => r.Field.toLowerCase().includes('distrato'));
console.log('Campos de distrato na tabela contratos:');
console.log(JSON.stringify(fields, null, 2));

await conn.end();
