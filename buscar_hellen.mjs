import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { users } from './drizzle/schema.js';
import { eq } from 'drizzle-orm';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

const hellen = await db.select().from(users).where(eq(users.email, 'hellen.rs0710@gmail.com'));

if (hellen.length > 0) {
  console.log('✅ Hellen encontrada:');
  console.log('ID:', hellen[0].id);
  console.log('Nome:', hellen[0].name);
  console.log('Role:', hellen[0].role);
} else {
  console.log('❌ Hellen não encontrada');
}

await connection.end();
