import mysql from 'mysql2/promise';

// Configuração do banco de dados
const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
});

async function desativarBloqueio() {
  console.log('🔓 Desativando sistema de bloqueio...\n');

  try {
    // Desativar bloqueio
    await connection.query(
      `UPDATE system_config SET bloqueioFollowUpAtivo = false WHERE id = 1`
    );

    console.log('✅ Bloqueio DESATIVADO com sucesso!');
    console.log('✅ Corretores agora podem registrar interações normalmente.\n');
  } catch (error) {
    console.error('❌ Erro ao desativar bloqueio:', error.message);
  }

  await connection.end();
}

// Executar
desativarBloqueio().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
