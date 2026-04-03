import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

// Verificar elegibilidade dos corretores com a mesma lógica do distribution.ts
const MINIMO_LEADS_GARANTIDO = 40;
const MAXIMO_LEADS_AGUARDANDO = 20;

// Calcular início do dia em SP (UTC-3)
const agora = new Date();
const offsetSP = -3 * 60;
const agoraSP = new Date(agora.getTime() + (offsetSP - agora.getTimezoneOffset()) * 60 * 1000);
const inicioDiaSP = new Date(agoraSP);
inicioDiaSP.setHours(0, 0, 0, 0);
const inicioDiaUTC = new Date(inicioDiaSP.getTime() - offsetSP * 60 * 1000);
const fimDiaSP = new Date(agoraSP);
fimDiaSP.setHours(23, 59, 59, 999);
const fimDiaUTC = new Date(fimDiaSP.getTime() - offsetSP * 60 * 1000);

const [rows] = await conn.execute(`
  SELECT 
    u.id,
    u.name,
    u.limiteDiarioLeads,
    COALESCE(ativos_agg.total_ativos, 0) as total_ativos,
    COALESCE(ativos_agg.em_atendimento, 0) as em_atendimento,
    COALESCE(ativos_agg.total_ativos, 0) - COALESCE(ativos_agg.em_atendimento, 0) as aguardando,
    COALESCE(dist_agg.leads_recebidos_hoje, 0) as leads_recebidos_hoje
  FROM users u
  LEFT JOIN (
    SELECT corretorId,
      COUNT(*) as total_ativos,
      SUM(CASE WHEN status = 'em_atendimento' THEN 1 ELSE 0 END) as em_atendimento
    FROM leads
    WHERE status IN ('aguardando_atendimento', 'em_atendimento') AND naLixeira = 0
    GROUP BY corretorId
  ) ativos_agg ON ativos_agg.corretorId = u.id
  LEFT JOIN (
    SELECT corretorId, COUNT(*) as leads_recebidos_hoje
    FROM distribution_log
    WHERE createdAt >= ? AND createdAt <= ?
    GROUP BY corretorId
  ) dist_agg ON dist_agg.corretorId = u.id
  WHERE u.role = 'corretor' AND u.status = 'presente'
  ORDER BY u.name
`, [inicioDiaUTC, fimDiaUTC]);

console.log(`\n=== Elegibilidade dos Corretores (${new Date().toLocaleString('pt-BR', {timeZone: 'America/Sao_Paulo'})}) ===`);
console.log(`Regras: min ${MINIMO_LEADS_GARANTIDO} leads garantidos, max ${MAXIMO_LEADS_AGUARDANDO} aguardando\n`);

let elegiveis = 0;
let naoElegiveis = 0;

for (const row of rows) {
  const limiteDiario = Number(row.limiteDiarioLeads) || 50;
  const leadsHoje = Number(row.leads_recebidos_hoje) || 0;
  const totalAtivos = Number(row.total_ativos) || 0;
  const emAtendimento = Number(row.em_atendimento) || 0;
  const aguardando = totalAtivos - emAtendimento;
  
  let elegivel = false;
  let motivo = '';
  
  if (leadsHoje >= limiteDiario) {
    motivo = `Limite diário atingido (${leadsHoje}/${limiteDiario})`;
  } else if (totalAtivos < MINIMO_LEADS_GARANTIDO) {
    elegivel = true;
    motivo = `Menos de ${MINIMO_LEADS_GARANTIDO} leads ativos (${totalAtivos})`;
  } else if (aguardando < MAXIMO_LEADS_AGUARDANDO) {
    elegivel = true;
    motivo = `${aguardando} aguardando < ${MAXIMO_LEADS_AGUARDANDO}`;
  } else {
    motivo = `${aguardando} aguardando >= ${MAXIMO_LEADS_AGUARDANDO} (bloqueado)`;
  }
  
  if (elegivel) elegiveis++;
  else naoElegiveis++;
  
  console.log(`${elegivel ? '✅' : '❌'} ${row.name}: ativos=${totalAtivos}, aguardando=${aguardando}, hoje=${leadsHoje}/${limiteDiario} | ${motivo}`);
}

console.log(`\nTotal: ${elegiveis} elegíveis, ${naoElegiveis} não elegíveis`);

await conn.end();
