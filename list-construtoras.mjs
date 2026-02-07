import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.ts';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { schema, mode: 'default' });

const construtoras = await db.select().from(schema.construtoras).orderBy(schema.construtoras.nome);

console.log(JSON.stringify(construtoras, null, 2));

await connection.end();
