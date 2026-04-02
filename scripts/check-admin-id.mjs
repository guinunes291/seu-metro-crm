import { createConnection } from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('No DATABASE_URL');
  process.exit(1);
}

const conn = await createConnection(url);
const [rows] = await conn.query("SELECT id, name, email, role FROM users WHERE role = 'admin' LIMIT 5");
console.log('Admins:', JSON.stringify(rows, null, 2));
await conn.end();
