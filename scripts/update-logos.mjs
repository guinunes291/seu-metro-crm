import mysql from 'mysql2/promise';

// Mapeamento: construtora_id -> CDN URL do logo
const logoMap = {
  1:  'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/KHsyECfIVIFkYSww.jpg',   // CANOPUS
  2:  'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/KJtnXqlwStjZfKQd.svg',   // CONX
  3:  'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/vEIsIDOdcSJWnPEv.png',   // CP RESIDENCIAL
  4:  'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/aTenaiiqDcPwNlKM.png',   // CURY
  28: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/QbELcOXLblqtLQmO.svg',   // CYRELA E CIA
  29: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/BTSKrBACsuILxBwq.svg',   // DIALOGO
  5:  'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/jzhVzFBfqnFztLPa.svg',   // DING
  7:  'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/bSGQfQrIeNqbprgh.png',   // EPH
  8:  'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/lfjqnxpWspXpsEOQ.png',   // EVEN
  9:  'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/ThGYdEPoBMYvmxsu.png',   // EXTO
  10: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/YffVPucndSCEkTzl.png',   // EZTEC
  11: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/gJuSZTtKtBAeQhAS.png',   // FIBRA EXPERTS
  12: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/IqLCIuxDqARoDTzv.png',   // GAMARO
  13: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/pLAlzxGWprnVfeQQ.svg',   // GRAAL
  14: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/BESULVNBUggpFLvj.png',   // GRUPO LAR
  15: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/LdqayFbOQzSXZqtu.png',   // KAZZAS
  16: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/qhgVTwHOdWxRzYhV.svg',   // LAVVI
  17: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/fPQAmMpZruwerbeG.svg',   // MAC
  18: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/agHgIzBaWMDyoWZf.webp',  // MAGIK
  19: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/xmOCxlxYPYndqjah.svg',   // MARQUES CONSTRUTORA
  21: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/RRFWquZugjMBjCNT.svg',   // METROCASA
  22: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/kCVsjbhSLKcSnLDN.svg',   // PLANO&PLANO
  23: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/BQPmDsjcPbGEKEbp.png',   // RSF
  24: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/YrMJUZTTnXYvJDnd.jpg',   // TEGRA
  25: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/ltQkjdtGtoHDQCCm.png',   // THINK
  26: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/dOJZkahfjXAclHGC.svg',   // TRISUL
  27: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/FZPdoLioZRPcrYbM.jpg',   // VIBRA
};

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const connection = await mysql.createConnection(dbUrl);
  
  console.log('🔄 Atualizando logos das construtoras no banco de dados...\n');
  
  let updated = 0;
  let errors = 0;
  
  for (const [id, logoUrl] of Object.entries(logoMap)) {
    try {
      const [result] = await connection.execute(
        'UPDATE construtoras SET logoUrl = ? WHERE id = ?',
        [logoUrl, parseInt(id)]
      );
      
      // Get construtora name
      const [rows] = await connection.execute(
        'SELECT nome FROM construtoras WHERE id = ?',
        [parseInt(id)]
      );
      
      const nome = rows[0]?.nome || 'DESCONHECIDO';
      console.log(`✅ ${nome} (id=${id}): logo atualizado`);
      updated++;
    } catch (error) {
      console.error(`❌ Erro ao atualizar id=${id}:`, error.message);
      errors++;
    }
  }
  
  console.log(`\n📊 Resumo:`);
  console.log(`   ✅ ${updated} construtoras atualizadas`);
  console.log(`   ❌ ${errors} erros`);
  
  // Verificar resultado
  const [rows] = await connection.execute(
    'SELECT id, nome, logoUrl FROM construtoras WHERE logoUrl IS NOT NULL ORDER BY nome'
  );
  console.log(`\n📋 ${rows.length} construtoras com logo:`);
  for (const row of rows) {
    console.log(`   ${row.nome}: ${row.logoUrl.substring(0, 60)}...`);
  }
  
  await connection.end();
  console.log('\n✨ Atualização concluída!');
}

main().catch(err => {
  console.error('💥 Erro fatal:', err);
  process.exit(1);
});
