import { createConnection } from 'mysql2/promise';

const url = process.env.DATABASE_URL || '';
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

try {
  // Verificar se o campo já existe
  const [rows] = await conn.query("SHOW COLUMNS FROM contratos LIKE 'distratadoPorId'");
  if (rows.length > 0) {
    console.log('Campo distratadoPorId já existe!');
  } else {
    await conn.query('ALTER TABLE contratos ADD COLUMN distratadoPorId INT NULL');
    console.log('Campo distratadoPorId adicionado com sucesso!');
  }
} catch (e) {
  console.error('Erro:', e.message);
}

await conn.end();
