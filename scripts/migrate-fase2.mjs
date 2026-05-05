import mysql from 'mysql2/promise';
import { createRequire } from 'module';
import { config } from 'dotenv';

config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}

async function migrate() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  console.log('Verificando colunas existentes na tabela leads...');
  
  const columnsToAdd = [
    { name: 'temperatura', sql: `ALTER TABLE leads ADD COLUMN temperatura ENUM('quente','morno','frio') NULL` },
    { name: 'rendaInformada', sql: `ALTER TABLE leads ADD COLUMN rendaInformada VARCHAR(100) NULL` },
    { name: 'usaFgts', sql: `ALTER TABLE leads ADD COLUMN usaFgts TINYINT(1) DEFAULT 0` },
    { name: 'entradaDisponivel', sql: `ALTER TABLE leads ADD COLUMN entradaDisponivel VARCHAR(100) NULL` },
    { name: 'dataNascimento', sql: `ALTER TABLE leads ADD COLUMN dataNascimento DATETIME NULL` },
    { name: 'utmSource', sql: `ALTER TABLE leads ADD COLUMN utmSource VARCHAR(255) NULL` },
    { name: 'utmMedium', sql: `ALTER TABLE leads ADD COLUMN utmMedium VARCHAR(255) NULL` },
    { name: 'utmCampaign', sql: `ALTER TABLE leads ADD COLUMN utmCampaign VARCHAR(255) NULL` },
    { name: 'utmContent', sql: `ALTER TABLE leads ADD COLUMN utmContent VARCHAR(255) NULL` },
    { name: 'utmTerm', sql: `ALTER TABLE leads ADD COLUMN utmTerm VARCHAR(255) NULL` },
    { name: 'primeiroContatoEm', sql: `ALTER TABLE leads ADD COLUMN primeiroContatoEm DATETIME NULL` },
    { name: 'tempoAtePrimeiroContato', sql: `ALTER TABLE leads ADD COLUMN tempoAtePrimeiroContato INT NULL` },
  ];

  for (const col of columnsToAdd) {
    try {
      const [rows] = await conn.execute(`SHOW COLUMNS FROM leads LIKE '${col.name}'`);
      if (rows.length > 0) {
        console.log(`  ✓ ${col.name} já existe`);
        continue;
      }
      await conn.execute(col.sql);
      console.log(`  + ${col.name} adicionado`);
    } catch (e) {
      console.error(`  ✗ Erro em ${col.name}: ${e.message}`);
    }
  }

  // Índice de temperatura
  try {
    const [idxRows] = await conn.execute(`SHOW INDEX FROM leads WHERE Key_name = 'lead_temperatura_idx'`);
    if (idxRows.length === 0) {
      await conn.execute(`CREATE INDEX lead_temperatura_idx ON leads (temperatura)`);
      console.log('  + índice lead_temperatura_idx criado');
    } else {
      console.log('  ✓ índice lead_temperatura_idx já existe');
    }
  } catch (e) {
    console.error(`  ✗ Erro no índice: ${e.message}`);
  }

  // Campos de agendamentos — Fase 2
  console.log('\nVerificando colunas na tabela agendamentos...');
  const agendamentosColumns = [
    { name: 'naoCompareceu', sql: `ALTER TABLE agendamentos ADD COLUMN naoCompareceu TINYINT(1) DEFAULT 0` },
    { name: 'motivoNaoCompareceu', sql: `ALTER TABLE agendamentos ADD COLUMN motivoNaoCompareceu VARCHAR(255) NULL` },
  ];

  for (const col of agendamentosColumns) {
    try {
      const [rows] = await conn.execute(`SHOW COLUMNS FROM agendamentos LIKE '${col.name}'`);
      if (rows.length > 0) {
        console.log(`  ✓ ${col.name} já existe`);
        continue;
      }
      await conn.execute(col.sql);
      console.log(`  + ${col.name} adicionado`);
    } catch (e) {
      console.error(`  ✗ Erro em ${col.name}: ${e.message}`);
    }
  }

  // Adicionar valor 'nao_compareceu' ao ENUM status de agendamentos
  try {
    const [enumRows] = await conn.execute(`SHOW COLUMNS FROM agendamentos LIKE 'status'`);
    if (enumRows.length > 0) {
      const enumType = enumRows[0].Type;
      if (!enumType.includes('nao_compareceu')) {
        await conn.execute(`ALTER TABLE agendamentos MODIFY COLUMN status ENUM('pendente','confirmado','realizado','cancelado','reagendado','nao_compareceu') NOT NULL DEFAULT 'pendente'`);
        console.log('  + valor nao_compareceu adicionado ao ENUM status');
      } else {
        console.log('  ✓ ENUM status já tem nao_compareceu');
      }
    }
  } catch (e) {
    console.error(`  ✗ Erro no ENUM: ${e.message}`);
  }

  // Adicionar cpf à tabela leads (se não existir)
  console.log('\nVerificando coluna cpf na tabela leads...');
  try {
    const [cpfRows] = await conn.execute(`SHOW COLUMNS FROM leads LIKE 'cpf'`);
    if (cpfRows.length === 0) {
      await conn.execute(`ALTER TABLE leads ADD COLUMN cpf VARCHAR(20) NULL`);
      console.log('  + cpf adicionado');
    } else {
      console.log('  ✓ cpf já existe');
    }
  } catch (e) {
    console.error(`  ✗ Erro em cpf: ${e.message}`);
  }

  await conn.end();
  console.log('\nMigração da Fase 2 concluída!');
}

migrate().catch((e) => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
