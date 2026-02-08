#!/usr/bin/env node
/**
 * Script para distribuir manualmente um lead pela roleta
 * Uso: node scripts/distribuirLeadManual.mjs <leadId>
 */

import { distribuirLeadPelaRoleta } from '../server/db.ts';

const leadId = process.argv[2];

if (!leadId) {
  console.error('❌ Uso: node scripts/distribuirLeadManual.mjs <leadId>');
  process.exit(1);
}

console.log(`🎯 Distribuindo lead ${leadId} pela roleta...`);

try {
  const corretorId = await distribuirLeadPelaRoleta(parseInt(leadId));
  
  if (corretorId) {
    console.log(`✅ Lead ${leadId} distribuído com sucesso para o corretor ${corretorId}`);
  } else {
    console.log(`⚠️ Nenhum corretor disponível para receber o lead ${leadId}`);
  }
  
  process.exit(0);
} catch (error) {
  console.error('❌ Erro ao distribuir lead:', error);
  process.exit(1);
}
