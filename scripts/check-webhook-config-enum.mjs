import { createConnection } from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('No DATABASE_URL');
  process.exit(1);
}

const conn = await createConnection(url);

// Verificar tipoFila em webhook_config (sem 's')
try {
  const [rows] = await conn.query("SHOW COLUMNS FROM webhook_config LIKE 'tipoFila'");
  for (const row of rows) {
    console.log(`webhook_config.${row.Field}: ${row.Type}`);
  }
  if (rows.length === 0) {
    console.log('webhook_config.tipoFila: column not found');
  }
} catch (e) {
  console.log(`webhook_config: error - ${e.message}`);
}

// Verificar tabelas disponíveis
const [tables] = await conn.query("SHOW TABLES LIKE '%webhook%'");
console.log('Tables with webhook:', tables.map(t => Object.values(t)[0]));

await conn.end();
