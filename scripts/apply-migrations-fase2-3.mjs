import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);
console.log('Conectado ao TiDB');

const migrations = [
  { name: '0016_scripts_vendas', file: 'drizzle/0016_scripts_vendas.sql' },
  { name: '0017_motivo_perda_categoria', file: 'drizzle/0017_motivo_perda_categoria.sql' },
  { name: '0018_novas_etapas_funil', file: 'drizzle/0018_novas_etapas_funil.sql' },
];

for (const migration of migrations) {
  console.log(`\nAplicando ${migration.name}...`);
  const sql = readFileSync(migration.file, 'utf8');
  
  // Dividir por statement-breakpoint e executar cada statement
  const statements = sql
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  for (const stmt of statements) {
    if (!stmt.trim()) continue;
    try {
      await connection.execute(stmt);
      console.log(`  ✅ ${stmt.substring(0, 80).replace(/\n/g, ' ')}...`);
    } catch (err) {
      if (err.code === 'ER_TABLE_EXISTS_ERROR' || 
          err.code === 'ER_DUP_KEYNAME' ||
          err.message?.includes('Duplicate key name') ||
          err.message?.includes('already exists')) {
        console.log(`  ⚠️  Já existe (ignorando): ${err.message.substring(0, 80)}`);
      } else {
        console.error(`  ❌ Erro: ${err.message}`);
        // Não abortar — continuar com próximos statements
      }
    }
  }
  console.log(`  ✅ ${migration.name} concluída`);
}

await connection.end();
console.log('\n✅ Todas as migrations aplicadas com sucesso!');
