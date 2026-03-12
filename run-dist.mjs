// Script para executar distribuição diretamente no banco
import "dotenv/config";
import { createConnection } from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const conn = await createConnection(DATABASE_URL);
  
  console.log("=== Executando Distribuição Manual ===\n");
  
  // Buscar admins
  const [admins] = await conn.execute(`SELECT id FROM users WHERE role = 'admin'`);
  const adminIds = admins.map(a => a.id);
  console.log("Admin IDs:", adminIds);
  
  // Buscar corretores elegíveis (< 40 leads)
  const [corretoresElegiveis] = await conn.execute(`
    SELECT 
      u.id,
      u.name,
      COUNT(l.id) as total_leads,
      u.limiteDiarioLeads,
      COUNT(dl.id) as recebidos_hoje
    FROM users u
    LEFT JOIN leads l ON l.corretorId = u.id
    LEFT JOIN distribution_log dl ON dl.corretorId = u.id 
      AND dl.createdAt >= DATE_SUB(NOW(), INTERVAL 1 DAY)
    WHERE u.role = 'corretor' AND u.status = 'presente'
    GROUP BY u.id, u.name, u.limiteDiarioLeads
    HAVING total_leads < 40 AND recebidos_hoje < u.limiteDiarioLeads
    ORDER BY total_leads ASC
  `);
  
  console.log("Corretores elegíveis (< 40 leads):");
  console.table(corretoresElegiveis);
  
  if (corretoresElegiveis.length === 0) {
    console.log("Nenhum corretor elegível!");
    await conn.end();
    return;
  }
  
  // Buscar leads para distribuir (máximo 200 por vez)
  const adminIdList = adminIds.join(',');
  const [leadsParaDistribuir] = await conn.execute(`
    SELECT id, nome, status, corretorId
    FROM leads
    WHERE (corretorId IS NULL OR corretorId IN (${adminIdList}))
    AND status IN ('novo', 'aguardando_atendimento')
    LIMIT 200
  `);
  
  console.log(`\nLeads para distribuir: ${leadsParaDistribuir.length}`);
  
  if (leadsParaDistribuir.length === 0) {
    console.log("Nenhum lead para distribuir!");
    await conn.end();
    return;
  }
  
  // Distribuir em round-robin
  let distribuidos = 0;
  let erros = 0;
  const corretorIds = corretoresElegiveis.map(c => c.id);
  
  for (let i = 0; i < leadsParaDistribuir.length; i++) {
    const lead = leadsParaDistribuir[i];
    const corretorId = corretorIds[i % corretorIds.length];
    
    try {
      await conn.execute(`
        UPDATE leads SET 
          corretorId = ?,
          dataDistribuicao = NOW(),
          status = 'aguardando_atendimento'
        WHERE id = ?
      `, [corretorId, lead.id]);
      
      await conn.execute(`
        INSERT INTO distribution_log (leadId, corretorId, tipo, motivo, createdAt)
        VALUES (?, ?, 'automatica', 'Distribuição automática corrigida', NOW())
      `, [lead.id, corretorId]);
      
      distribuidos++;
    } catch (err) {
      console.error(`Erro ao distribuir lead ${lead.id}:`, err.message);
      erros++;
    }
  }
  
  console.log(`\n✅ Distribuídos: ${distribuidos}`);
  console.log(`❌ Erros: ${erros}`);
  
  // Verificar resultado
  const [resultado] = await conn.execute(`
    SELECT 
      u.name,
      COUNT(l.id) as total_leads
    FROM users u
    JOIN leads l ON l.corretorId = u.id
    WHERE u.id IN (${corretorIds.join(',')})
    GROUP BY u.id, u.name
  `);
  console.log("\nLeads por corretor após distribuição:");
  console.table(resultado);
  
  await conn.end();
}

main().catch(err => {
  console.error("Erro:", err);
  process.exit(1);
});
