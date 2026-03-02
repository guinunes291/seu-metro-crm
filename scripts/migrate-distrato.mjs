import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL);

// Verificar se as colunas já existem
const [cols] = await conn.execute(`
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contratos' 
  AND COLUMN_NAME IN ('distrato','dataDistrato','motivoDistrato','distratadoPorId')
`);

const existingCols = cols.map(c => c.COLUMN_NAME);
console.log('Colunas já existentes:', existingCols);

if (!existingCols.includes('distrato')) {
  await conn.execute('ALTER TABLE contratos ADD COLUMN distrato BOOLEAN NOT NULL DEFAULT FALSE');
  console.log('✓ Coluna distrato adicionada');
} else {
  console.log('- Coluna distrato já existe');
}

if (!existingCols.includes('dataDistrato')) {
  await conn.execute('ALTER TABLE contratos ADD COLUMN dataDistrato TIMESTAMP NULL');
  console.log('✓ Coluna dataDistrato adicionada');
} else {
  console.log('- Coluna dataDistrato já existe');
}

if (!existingCols.includes('motivoDistrato')) {
  await conn.execute('ALTER TABLE contratos ADD COLUMN motivoDistrato TEXT NULL');
  console.log('✓ Coluna motivoDistrato adicionada');
} else {
  console.log('- Coluna motivoDistrato já existe');
}

if (!existingCols.includes('distratadoPorId')) {
  await conn.execute('ALTER TABLE contratos ADD COLUMN distratadoPorId INT NULL');
  console.log('✓ Coluna distratadoPorId adicionada');
} else {
  console.log('- Coluna distratadoPorId já existe');
}

// Adicionar índice para distrato
try {
  await conn.execute('ALTER TABLE contratos ADD INDEX contratos_distrato_idx (distrato)');
  console.log('✓ Índice distrato adicionado');
} catch(e) {
  console.log('- Índice já existe:', e.message);
}

console.log('\nMigração concluída!');
await conn.end();
