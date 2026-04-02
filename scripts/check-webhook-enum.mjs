import { createConnection } from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('No DATABASE_URL');
  process.exit(1);
}

const conn = await createConnection(url);

// Verificar tipoFila em webhook_configs
try {
  const [rows] = await conn.query("SHOW COLUMNS FROM webhook_configs LIKE 'tipoFila'");
  for (const row of rows) {
    console.log(`webhook_configs.${row.Field}: ${row.Type}`);
  }
} catch (e) {
  console.log(`webhook_configs: error - ${e.message}`);
}

await conn.end();
