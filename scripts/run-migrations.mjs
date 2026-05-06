import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';

// Extrair DATABASE_URL do processo do servidor em execução
const pid = execSync('pgrep -f "tsx watch server"').toString().trim().split('\n')[0];
const envVars = readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0');
const dbUrlEntry = envVars.find(e => e.startsWith('DATABASE_URL='));
if (!dbUrlEntry) { console.error('DATABASE_URL não encontrada'); process.exit(1); }
const DATABASE_URL = dbUrlEntry.split('=').slice(1).join('=');
console.log('DATABASE_URL encontrada ✅');

const connection = await mysql.createConnection(DATABASE_URL);
console.log('Conectado ao TiDB ✅');

const migrations = [
  { name: '0016_scripts_vendas', file: 'drizzle/0016_scripts_vendas.sql' },
  { name: '0017_motivo_perda_categoria', file: 'drizzle/0017_motivo_perda_categoria.sql' },
  { name: '0018_novas_etapas_funil', file: 'drizzle/0018_novas_etapas_funil.sql' },
];

for (const migration of migrations) {
  console.log(`\nAplicando ${migration.name}...`);
  const sql = readFileSync(migration.file, 'utf8');
  
  const statements = sql
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  for (const stmt of statements) {
    const clean = stmt.replace(/^--.*$/gm, '').trim();
    if (!clean) continue;
    try {
      await connection.execute(clean);
      console.log(`  ✅ ${clean.substring(0, 80).replace(/\n/g, ' ')}`);
    } catch (err) {
      const ignorable = ['ER_TABLE_EXISTS_ERROR','ER_DUP_KEYNAME','ER_DUP_ENTRY'];
      const ignorableMsg = ['already exists','Duplicate key name','already exists'];
      if (ignorable.includes(err.code) || ignorableMsg.some(m => err.message?.includes(m))) {
        console.log(`  ⚠️  Já existe (ok): ${err.message.substring(0, 80)}`);
      } else {
        console.error(`  ❌ Erro: ${err.message}`);
      }
    }
  }
}

await connection.end();
console.log('\n✅ Migrations concluídas!');
