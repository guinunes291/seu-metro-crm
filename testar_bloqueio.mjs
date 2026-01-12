import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log('🧪 Testando lógica de bloqueio...\n');

// Função para calcular início do dia (timezone São Paulo)
function inicioDoDiaHoje() {
  const agora = new Date();
  const saoPaulo = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  saoPaulo.setHours(0, 0, 0, 0);
  return saoPaulo;
}

const hoje = inicioDoDiaHoje();
const amanha = new Date(hoje);
amanha.setDate(amanha.getDate() + 1);

console.log('📅 Hoje (início do dia):', hoje.toISOString());
console.log('📅 Amanhã (início do dia):', amanha.toISOString());
console.log('');

// Buscar um corretor de teste (não a Hellen)
const [corretores] = await connection.execute(
  'SELECT id, name FROM users WHERE role = ? AND id != ? LIMIT 1',
  ['corretor', 6600098]
);

if (corretores.length === 0) {
  console.log('❌ Nenhum corretor encontrado para teste');
  await connection.end();
  process.exit(1);
}

const corretor = corretores[0];
console.log(`👤 Testando com corretor: ${corretor.name} (ID: ${corretor.id})\n`);

// Contar follow-ups do corretor
const [total] = await connection.execute(
  'SELECT COUNT(*) as count FROM follow_ups WHERE corretorId = ? AND status = ?',
  [corretor.id, 'ativo']
);

console.log(`📊 Total de follow-ups ativos: ${total[0].count}`);

// Contar follow-ups de HOJE (proximaTentativa <= hoje)
const [hoje_count] = await connection.execute(
  'SELECT COUNT(*) as count FROM follow_ups WHERE corretorId = ? AND status = ? AND proximaTentativa <= ?',
  [corretor.id, 'ativo', hoje]
);

console.log(`📊 Follow-ups de HOJE (proximaTentativa <= hoje): ${hoje_count[0].count}`);

// Contar follow-ups de AMANHÃ (proximaTentativa = amanhã)
const [amanha_count] = await connection.execute(
  'SELECT COUNT(*) as count FROM follow_ups WHERE corretorId = ? AND status = ? AND proximaTentativa >= ? AND proximaTentativa < ?',
  [corretor.id, 'ativo', amanha, new Date(amanha.getTime() + 24 * 60 * 60 * 1000)]
);

console.log(`📊 Follow-ups de AMANHÃ (proximaTentativa = amanhã): ${amanha_count[0].count}`);

console.log('\n✅ Teste de lógica de bloqueio:');
console.log(`   - Bloqueio deve considerar apenas: ${hoje_count[0].count} follow-ups (de hoje)`);
console.log(`   - Bloqueio NÃO deve considerar: ${amanha_count[0].count} follow-ups (de amanhã)`);

// Verificar se o corretor está bloqueado
const percentualMinimo = 0.60; // 60%
const totalDiario = hoje_count[0].count;
const percentualConcluido = totalDiario > 0 ? 0 / totalDiario : 1; // Assumindo 0 concluídos

console.log(`\n🔒 Status de bloqueio:`);
console.log(`   - Follow-ups do dia: ${totalDiario}`);
console.log(`   - Follow-ups concluídos: 0 (assumindo)`);
console.log(`   - Percentual concluído: ${(percentualConcluido * 100).toFixed(1)}%`);
console.log(`   - Percentual mínimo: ${(percentualMinimo * 100).toFixed(1)}%`);
console.log(`   - Corretor está bloqueado? ${percentualConcluido < percentualMinimo ? '🔴 SIM' : '🟢 NÃO'}`);

await connection.end();
