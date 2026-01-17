import mysql from 'mysql2/promise';
import 'dotenv/config';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // 1. Buscar todos os corretores ativos
  const [corretores] = await connection.execute(
    'SELECT id, name, email FROM users WHERE role = ? ORDER BY id',
    ['corretor']
  );
  
  console.log(`\n=== CORRETORES ATIVOS ===`);
  console.log(`Total: ${corretores.length}`);
  corretores.forEach(c => console.log(`  - ${c.name} (${c.email}) [ID: ${c.id}]`));
  
  // 2. Buscar leads órfãos (com corretorId inválido)
  const [leadsOrfaos] = await connection.execute(`
    SELECT id, nome, email, corretorId, status
    FROM leads 
    WHERE status = 'em_atendimento' 
      AND corretorId NOT IN (
        SELECT id FROM users WHERE role = 'corretor'
      )
    ORDER BY id
  `);
  
  console.log(`\n=== LEADS ÓRFÃOS ===`);
  console.log(`Total: ${leadsOrfaos.length}`);
  
  if (leadsOrfaos.length === 0) {
    console.log('Nenhum lead órfão encontrado!');
    await connection.end();
    process.exit(0);
  }
  
  // 3. Distribuir leads de forma equilibrada
  const leadsPerCorretor = Math.ceil(leadsOrfaos.length / corretores.length);
  console.log(`\nDistribuindo ~${leadsPerCorretor} leads por corretor...`);
  
  let corretorIndex = 0;
  const distribuicao = {};
  
  for (const lead of leadsOrfaos) {
    const corretor = corretores[corretorIndex];
    
    // Atualizar lead com novo corretorId
    await connection.execute(
      'UPDATE leads SET corretorId = ?, dataDistribuicao = NOW() WHERE id = ?',
      [corretor.id, lead.id]
    );
    
    // Registrar distribuição
    if (!distribuicao[corretor.id]) {
      distribuicao[corretor.id] = { nome: corretor.name, count: 0 };
    }
    distribuicao[corretor.id].count++;
    
    // Avançar para próximo corretor (round-robin)
    corretorIndex = (corretorIndex + 1) % corretores.length;
  }
  
  // 4. Exibir resultado
  console.log(`\n=== RESULTADO DA REDISTRIBUIÇÃO ===`);
  for (const [corretorId, info] of Object.entries(distribuicao)) {
    console.log(`${info.nome}: ${info.count} leads`);
  }
  
  console.log(`\n✅ Redistribuição concluída com sucesso!`);
  console.log(`Total de leads redistribuídos: ${leadsOrfaos.length}`);
  
} catch (error) {
  console.error('❌ Erro na redistribuição:', error);
} finally {
  await connection.end();
}
