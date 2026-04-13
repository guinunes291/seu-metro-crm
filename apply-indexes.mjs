import { config } from 'dotenv';
import mysql from 'mysql2/promise';

config({ path: '.env' });

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const indexes = [
  'CREATE INDEX IF NOT EXISTS dist_log_lead_idx ON distribution_log (leadId)',
  'CREATE INDEX IF NOT EXISTS dist_log_corretor_idx ON distribution_log (corretorId)',
  'CREATE INDEX IF NOT EXISTS dist_log_created_at_idx ON distribution_log (createdAt)',
  'CREATE INDEX IF NOT EXISTS notification_user_idx ON notifications (userId)',
  'CREATE INDEX IF NOT EXISTS notification_lida_idx ON notifications (lida)',
  'CREATE INDEX IF NOT EXISTS notification_created_at_idx ON notifications (createdAt)',
  'CREATE INDEX IF NOT EXISTS notification_user_lida_idx ON notifications (userId, lida)',
];

console.log('Applying missing indexes...\n');

for (const sql of indexes) {
  const indexName = sql.match(/INDEX IF NOT EXISTS (\w+)/)?.[1] ?? sql;
  try {
    await connection.execute(sql);
    console.log(`✓ ${indexName}`);
  } catch (e) {
    if (e.code === 'ER_DUP_KEYNAME') {
      console.log(`↷ ${indexName} (already exists)`);
    } else {
      console.log(`✗ ${indexName}: ${e.message}`);
    }
  }
}

await connection.end();
console.log('\nDone.');
