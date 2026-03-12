// Script de diagnóstico para testar distribuição
import "dotenv/config";
import { createConnection } from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL não definida");
  process.exit(1);
}

async function main() {
  const conn = await createConnection(DATABASE_URL);
  
  console.log("=== Diagnóstico de Distribuição ===\n");
  
  // 1. Verificar leads pendentes
  const [leadsResult] = await conn.execute(`
    SELECT 
      status,
      CASE WHEN corretorId IS NULL THEN 'sem_corretor' ELSE 'com_corretor_admin' END as tipo,
      COUNT(*) as total
    FROM leads
    WHERE (corretorId IS NULL OR corretorId IN (SELECT id FROM users WHERE role = 'admin'))
    AND status IN ('novo', 'aguardando_atendimento')
    GROUP BY status, tipo
  `);
  console.log("Leads pendentes de distribuição:");
  console.table(leadsResult);
  
  // 2. Verificar corretores presentes
  const [corretoresResult] = await conn.execute(`
    SELECT 
      u.id,
      u.name,
      u.status,
      COUNT(l.id) as total_leads,
      SUM(CASE WHEN l.status != 'aguardando_atendimento' THEN 1 ELSE 0 END) as leads_trabalhados,
      ROUND(SUM(CASE WHEN l.status != 'aguardando_atendimento' THEN 1 ELSE 0 END) / NULLIF(COUNT(l.id), 0) * 100, 1) as taxa_pct,
      CASE 
        WHEN COUNT(l.id) < 40 THEN 'ELEGIVEL (< 40 leads)'
        WHEN SUM(CASE WHEN l.status != 'aguardando_atendimento' THEN 1 ELSE 0 END) / NULLIF(COUNT(l.id), 0) >= 0.9 THEN 'ELEGIVEL (taxa >= 90%)'
        ELSE 'NAO_ELEGIVEL'
      END as elegibilidade
    FROM users u
    LEFT JOIN leads l ON l.corretorId = u.id
    WHERE u.role = 'corretor' AND u.status = 'presente'
    GROUP BY u.id, u.name, u.status
    ORDER BY total_leads ASC
  `);
  console.log("\nCorretores presentes:");
  console.table(corretoresResult);
  
  // 3. Verificar limite diário
  const hoje = new Date();
  const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 3, 0, 0); // UTC-3
  const fimDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1, 3, 0, 0);
  
  const [limiteResult] = await conn.execute(`
    SELECT 
      u.id,
      u.name,
      u.limiteDiarioLeads,
      COUNT(dl.id) as recebidos_hoje
    FROM users u
    LEFT JOIN distribution_log dl ON dl.corretorId = u.id 
      AND dl.createdAt >= ?
      AND dl.createdAt < ?
    WHERE u.role = 'corretor' AND u.status = 'presente'
    GROUP BY u.id, u.name, u.limiteDiarioLeads
    ORDER BY recebidos_hoje DESC
  `, [inicioDia, fimDia]);
  console.log("\nLimite diário de leads:");
  console.table(limiteResult);
  
  // 4. Verificar admins
  const [adminsResult] = await conn.execute(`
    SELECT id, name, role, status FROM users WHERE role = 'admin'
  `);
  console.log("\nAdmins/Gestores:");
  console.table(adminsResult);
  
  await conn.end();
}

main().catch(err => {
  console.error("Erro:", err);
  process.exit(1);
});
