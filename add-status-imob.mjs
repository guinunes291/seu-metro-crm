import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

try {
  await conn.execute(`ALTER TABLE contratos ADD COLUMN IF NOT EXISTS statusRecebimentoImobiliaria VARCHAR(20) DEFAULT 'pendente'`);
  console.log('✅ statusRecebimentoImobiliaria adicionado');
} catch (e) { console.log('statusRecebimentoImobiliaria já existe ou erro:', e.message); }

try {
  await conn.execute(`ALTER TABLE contratos ADD COLUMN IF NOT EXISTS dataRecebimentoImobiliaria TIMESTAMP NULL`);
  console.log('✅ dataRecebimentoImobiliaria adicionado');
} catch (e) { console.log('dataRecebimentoImobiliaria já existe ou erro:', e.message); }

await conn.end();
console.log('Concluído!');
