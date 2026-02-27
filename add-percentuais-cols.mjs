import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  await connection.execute(`
    ALTER TABLE contratos 
    ADD COLUMN IF NOT EXISTS percentualCorretor DECIMAL(5,2) DEFAULT 1.85,
    ADD COLUMN IF NOT EXISTS percentualGerente DECIMAL(5,2) DEFAULT 0.50,
    ADD COLUMN IF NOT EXISTS percentualSuperintendente DECIMAL(5,2) DEFAULT 0.30
  `);
  console.log('✅ Colunas adicionadas com sucesso!');
} catch (error) {
  console.error('❌ Erro:', error.message);
} finally {
  await connection.end();
}
