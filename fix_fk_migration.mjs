import mysql2 from 'mysql2/promise';

const url = process.env.DATABASE_URL;

async function main() {
  const conn = await mysql2.createConnection(url);
  
  // Verificar constraints existentes para users
  const [rows] = await conn.execute(`
    SELECT 
      kcu.TABLE_NAME,
      kcu.COLUMN_NAME,
      kcu.CONSTRAINT_NAME,
      rc.DELETE_RULE
    FROM information_schema.KEY_COLUMN_USAGE kcu
    JOIN information_schema.REFERENTIAL_CONSTRAINTS rc 
      ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
      AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
    WHERE kcu.TABLE_SCHEMA = DATABASE()
    AND kcu.REFERENCED_TABLE_NAME = 'users'
    ORDER BY kcu.TABLE_NAME
  `);
  
  console.log('FK constraints para users:');
  rows.forEach(r => console.log(`  ${r.TABLE_NAME}.${r.COLUMN_NAME} [${r.CONSTRAINT_NAME}] -> ${r.DELETE_RULE}`));
  
  // Tabelas históricas que devem ter SET NULL (não CASCADE)
  const historicalTables = [
    'historico_atribuicoes',
    'interacoes',
    'documentacoes',
    'analises_credito',
    'contratos',
    'comissoes',
  ];
  
  // Colunas correspondentes
  const columnMap = {
    'historico_atribuicoes': 'corretorId',
    'interacoes': 'corretorId',
    'documentacoes': 'corretorId',
    'analises_credito': 'corretorId',
    'contratos': 'corretorId',
    'comissoes': 'usuarioId',
  };
  
  for (const row of rows) {
    if (historicalTables.includes(row.TABLE_NAME) && row.DELETE_RULE === 'CASCADE') {
      const col = columnMap[row.TABLE_NAME];
      const constraintName = row.CONSTRAINT_NAME;
      const tableName = row.TABLE_NAME;
      
      console.log(`\nFixing ${tableName}.${col}: CASCADE -> SET NULL`);
      
      // Dropar a FK existente
      await conn.execute(`ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${constraintName}\``);
      console.log(`  Dropped FK ${constraintName}`);
      
      // Tornar a coluna nullable (se ainda não for)
      // Verificar tipo da coluna
      const [colInfo] = await conn.execute(`
        SELECT COLUMN_TYPE, IS_NULLABLE 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = '${tableName}' 
        AND COLUMN_NAME = '${col}'
      `);
      
      if (colInfo[0]?.IS_NULLABLE === 'NO') {
        await conn.execute(`ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${col}\` INT NULL`);
        console.log(`  Made ${col} nullable`);
      }
      
      // Recriar a FK com SET NULL
      await conn.execute(`
        ALTER TABLE \`${tableName}\` 
        ADD CONSTRAINT \`${constraintName}\` 
        FOREIGN KEY (\`${col}\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
      `);
      console.log(`  Recreated FK with SET NULL`);
    }
  }
  
  console.log('\nDone! All historical tables now use SET NULL on user delete.');
  await conn.end();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
