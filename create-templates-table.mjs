import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS templates_comissao (
      id INT PRIMARY KEY AUTO_INCREMENT,
      projectId INT,
      nome VARCHAR(255) NOT NULL,
      percentualImobiliaria DECIMAL(5,2) NOT NULL DEFAULT 3.50,
      percentualCorretor DECIMAL(5,2) NOT NULL DEFAULT 1.85,
      percentualGerente DECIMAL(5,2) NOT NULL DEFAULT 0.50,
      percentualSuperintendente DECIMAL(5,2) NOT NULL DEFAULT 0.30,
      isPadrao BOOLEAN DEFAULT FALSE,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
      INDEX templates_comissao_project_idx (projectId),
      INDEX templates_comissao_nome_idx (nome)
    )
  `);
  console.log('✅ Tabela templates_comissao criada com sucesso!');
} catch (error) {
  console.error('❌ Erro:', error.message);
} finally {
  await connection.end();
}
