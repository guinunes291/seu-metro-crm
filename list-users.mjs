import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn);

const users = await conn.query('SELECT id, name, role, email FROM users ORDER BY id');
console.log('=== USUÁRIOS ===');
console.table(users[0]);

const leads = await conn.query('SELECT corretorId, COUNT(*) as total FROM leads GROUP BY corretorId ORDER BY total DESC LIMIT 10');
console.log('\n=== LEADS POR CORRETOR ===');
console.table(leads[0]);

await conn.end();
