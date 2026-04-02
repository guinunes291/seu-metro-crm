import { createConnection } from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('No DATABASE_URL');
  process.exit(1);
}

const conn = await createConnection(url);

// Verificar tipoFila em todas as tabelas
const tables = ['lead_estoque', 'distribution_log', 'leads'];
for (const table of tables) {
  try {
    const [rows] = await conn.query(`SHOW COLUMNS FROM ${table} LIKE 'tipoFila%'`);
    for (const row of rows) {
      console.log(`${table}.${row.Field}: ${row.Type}`);
    }
  } catch (e) {
    console.log(`${table}: error - ${e.message}`);
  }
}

// Verificar tipoFilaOrigem em leads
try {
  const [rows] = await conn.query("SHOW COLUMNS FROM leads LIKE 'tipoFilaOrigem'");
  for (const row of rows) {
    console.log(`leads.${row.Field}: ${row.Type}`);
  }
} catch (e) {
  console.log(`leads.tipoFilaOrigem: error - ${e.message}`);
}

await conn.end();
