import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { sql, eq, and } from 'drizzle-orm';

// Conectar ao banco
const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

console.log('🔍 Testando query do relatório de escolhas diárias...\n');

// Simular o que a procedure faz
const hoje = new Date();
const dataFim = hoje;
const dataInicio = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);

console.log('📅 Período:', {
  dataInicio: dataInicio.toISOString(),
  dataFim: dataFim.toISOString(),
});

// Query direta SQL
const resultadoSQL = await connection.query(`
  SELECT 
    e.id,
    e.corretorId,
    u.name as corretor_nome,
    DATE(e.data) as data_escolha,
    e.aceitouFollowUp,
    e.createdAt
  FROM escolha_diaria_follow_up e
  LEFT JOIN users u ON e.corretorId = u.id
  WHERE DATE(e.data) >= DATE(?)
    AND DATE(e.data) <= DATE(?)
  ORDER BY e.data DESC
`, [dataInicio, dataFim]);

console.log('\n✅ Resultado SQL direto:', resultadoSQL[0].length, 'registros');
console.log(JSON.stringify(resultadoSQL[0], null, 2));

// Query usando Drizzle (como na procedure)
try {
  const escolhas = await db.execute(sql`
    SELECT 
      e.id,
      e.corretorId,
      u.name as corretor_nome,
      DATE(e.data) as data_escolha,
      e.aceitouFollowUp,
      e.createdAt
    FROM escolha_diaria_follow_up e
    LEFT JOIN users u ON e.corretorId = u.id
    WHERE DATE(e.data) >= DATE(${dataInicio})
      AND DATE(e.data) <= DATE(${dataFim})
    ORDER BY e.data DESC
  `);
  
  console.log('\n✅ Resultado Drizzle:', escolhas.length, 'registros');
  console.log(JSON.stringify(escolhas, null, 2));
} catch (error) {
  console.error('\n❌ Erro no Drizzle:', error.message);
}

await connection.end();
console.log('\n✅ Teste concluído!');
