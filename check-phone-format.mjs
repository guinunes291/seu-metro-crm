import { createConnection } from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
const connection = await createConnection(DATABASE_URL);

// Buscar 20 telefones aleatórios do banco
const [rows] = await connection.execute(
  'SELECT id, nome, telefone FROM leads ORDER BY RAND() LIMIT 20'
);

console.log('📱 FORMATO DE TELEFONES NO BANCO DE DADOS:\n');
rows.forEach((row, idx) => {
  console.log(`${idx + 1}. ${row.nome?.padEnd(30, ' ')} → ${row.telefone}`);
});

await connection.end();
