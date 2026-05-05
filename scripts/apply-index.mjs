/**
 * Aplica o índice composto contratos_corretor_distrato_created_idx diretamente no TiDB.
 * Usa IF NOT EXISTS para ser idempotente.
 */
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}

const conn = await mysql.createConnection(url);

try {
  console.log('Verificando se o índice já existe...');
  const [rows] = await conn.execute(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'contratos' 
     AND INDEX_NAME = 'contratos_corretor_distrato_created_idx'`
  );
  
  if (rows.length > 0) {
    console.log('✅ Índice já existe, nada a fazer.');
  } else {
    console.log('Criando índice contratos_corretor_distrato_created_idx...');
    await conn.execute(
      `CREATE INDEX contratos_corretor_distrato_created_idx ON contratos (corretorId, distrato, createdAt)`
    );
    console.log('✅ Índice criado com sucesso!');
  }
} catch (err) {
  console.error('❌ Erro ao criar índice:', err.message);
  process.exit(1);
} finally {
  await conn.end();
}
