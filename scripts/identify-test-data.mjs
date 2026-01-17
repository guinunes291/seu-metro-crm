import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { users, leads } from '../drizzle/schema.js';
import { like, or } from 'drizzle-orm';
import 'dotenv/config';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// Buscar usuários de teste
const testUsers = await db.select().from(users).where(
  or(
    like(users.email, '%test%'),
    like(users.email, '%@test.com%'),
    like(users.name, '%test%'),
    like(users.name, '%Test%'),
    like(users.name, '%_T_%'),
    like(users.openId, '%test%'),
    like(users.openId, '%_T_%')
  )
);

console.log('=== USUÁRIOS DE TESTE ENCONTRADOS ===');
console.log('Total:', testUsers.length);
testUsers.slice(0, 20).forEach(u => {
  console.log(`ID: ${u.id}, Nome: ${u.name}, Email: ${u.email}, OpenID: ${u.openId}`);
});

// Buscar leads de teste
const testLeads = await db.select().from(leads).where(
  or(
    like(leads.email, '%test%'),
    like(leads.email, '%@test.com%'),
    like(leads.nome, '%test%'),
    like(leads.nome, '%Test%'),
    like(leads.nome, '%_T_%'),
    like(leads.nome, '%Lead Teste%')
  )
);

console.log('\n=== LEADS DE TESTE ENCONTRADOS ===');
console.log('Total:', testLeads.length);
testLeads.slice(0, 20).forEach(l => {
  console.log(`ID: ${l.id}, Nome: ${l.nome}, Email: ${l.email}`);
});

await connection.end();
