import 'dotenv/config';
import mysql from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const conn = await mysql.createConnection(dbUrl);

async function q(label, sql) {
  try {
    const [rows] = await conn.execute(sql);
    return rows;
  } catch (e) {
    console.error(`[${label}] Error:`, e.message);
    return [];
  }
}

const data = {};

console.log("Coletando dados para All Hands...\n");

// 1. Totais gerais
data.totais = await q("totais", `
  SELECT 
    (SELECT COUNT(*) FROM leads) as total_leads,
    (SELECT COUNT(*) FROM leads WHERE createdAt >= DATE_FORMAT(NOW(), '%Y-%m-01')) as leads_mes_atual,
    (SELECT COUNT(*) FROM users WHERE role = 'corretor' AND situacao = 'ativo') as corretores_ativos,
    (SELECT COUNT(*) FROM users WHERE role = 'gestor' AND situacao = 'ativo') as gestores_ativos,
    (SELECT COUNT(*) FROM users WHERE role = 'superintendente' AND situacao = 'ativo') as superintendentes_ativos,
    (SELECT COUNT(*) FROM equipes WHERE ativa = 1) as equipes_ativas,
    (SELECT COUNT(*) FROM projects WHERE status = 'ativo') as projetos_ativos,
    (SELECT COUNT(*) FROM contratos) as total_contratos,
    (SELECT COUNT(*) FROM contratos WHERE createdAt >= DATE_FORMAT(NOW(), '%Y-%m-01')) as contratos_mes,
    (SELECT COUNT(*) FROM agendamentos WHERE dataAgendamento >= DATE_FORMAT(NOW(), '%Y-%m-01')) as agendamentos_mes,
    (SELECT COUNT(*) FROM visitas WHERE dataVisita >= DATE_FORMAT(NOW(), '%Y-%m-01')) as visitas_mes
`);

// 2. Leads por status
data.leads_por_status = await q("leads_status", `
  SELECT status, COUNT(*) as total 
  FROM leads 
  GROUP BY status 
  ORDER BY total DESC
`);

// 3. Leads por origem
data.leads_por_origem = await q("leads_origem", `
  SELECT origem, COUNT(*) as total 
  FROM leads 
  GROUP BY origem 
  ORDER BY total DESC
`);

// 4. Leads por mês (últimos 6 meses)
data.leads_por_mes = await q("leads_mes", `
  SELECT DATE_FORMAT(createdAt, '%Y-%m') as mes, COUNT(*) as total 
  FROM leads 
  WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
  GROUP BY mes 
  ORDER BY mes
`);

// 5. Funil geral
data.funil_geral = await q("funil_geral", `
  SELECT statusNovo as etapa, COUNT(*) as total 
  FROM lead_status_transitions 
  GROUP BY statusNovo 
  ORDER BY total DESC
`);

// 6. Funil mês atual
data.funil_mes = await q("funil_mes", `
  SELECT statusNovo as etapa, COUNT(*) as total 
  FROM lead_status_transitions 
  WHERE createdAt >= DATE_FORMAT(NOW(), '%Y-%m-01')
  GROUP BY statusNovo 
  ORDER BY total DESC
`);

// 7. Equipes
data.equipes = await q("equipes", `
  SELECT e.id, e.nome, 
    (SELECT name FROM users WHERE id = e.gestorId) as gestor,
    (SELECT COUNT(*) FROM users WHERE equipeId = e.id AND role = 'corretor' AND situacao = 'ativo') as corretores
  FROM equipes e
  WHERE e.ativa = 1
  ORDER BY e.nome
`);

// 8. Performance por equipe (mês atual)
data.performance_equipes = await q("perf_equipes", `
  SELECT e.nome as equipe,
    (SELECT name FROM users WHERE id = e.gestorId) as gestor,
    (SELECT COUNT(*) FROM users WHERE equipeId = e.id AND role = 'corretor' AND situacao = 'ativo') as corretores,
    (SELECT COUNT(*) FROM leads l WHERE l.corretorId IN (SELECT id FROM users WHERE equipeId = e.id) AND l.createdAt >= DATE_FORMAT(NOW(), '%Y-%m-01')) as leads_mes,
    (SELECT COUNT(*) FROM lead_status_transitions lst WHERE lst.corretorId IN (SELECT id FROM users WHERE equipeId = e.id) AND lst.statusNovo = 'agendado' AND lst.createdAt >= DATE_FORMAT(NOW(), '%Y-%m-01')) as agendamentos,
    (SELECT COUNT(*) FROM lead_status_transitions lst WHERE lst.corretorId IN (SELECT id FROM users WHERE equipeId = e.id) AND lst.statusNovo = 'visita_realizada' AND lst.createdAt >= DATE_FORMAT(NOW(), '%Y-%m-01')) as visitas,
    (SELECT COUNT(*) FROM lead_status_transitions lst WHERE lst.corretorId IN (SELECT id FROM users WHERE equipeId = e.id) AND lst.statusNovo = 'contrato_fechado' AND lst.createdAt >= DATE_FORMAT(NOW(), '%Y-%m-01')) as contratos
  FROM equipes e
  WHERE e.ativa = 1
  ORDER BY contratos DESC
`);

// 9. Ranking top 15 corretores
data.ranking_corretores = await q("ranking", `
  SELECT u.name, e.nome as equipe,
    (SELECT COUNT(*) FROM lead_status_transitions WHERE corretorId = u.id AND statusNovo = 'contrato_fechado' AND createdAt >= DATE_FORMAT(NOW(), '%Y-%m-01')) as contratos,
    (SELECT COUNT(*) FROM lead_status_transitions WHERE corretorId = u.id AND statusNovo = 'visita_realizada' AND createdAt >= DATE_FORMAT(NOW(), '%Y-%m-01')) as visitas,
    (SELECT COUNT(*) FROM lead_status_transitions WHERE corretorId = u.id AND statusNovo = 'agendado' AND createdAt >= DATE_FORMAT(NOW(), '%Y-%m-01')) as agendamentos,
    (SELECT COUNT(*) FROM leads WHERE corretorId = u.id AND createdAt >= DATE_FORMAT(NOW(), '%Y-%m-01')) as leads_recebidos
  FROM users u
  LEFT JOIN equipes e ON u.equipeId = e.id
  WHERE u.role = 'corretor' AND u.situacao = 'ativo'
  ORDER BY contratos DESC, visitas DESC, agendamentos DESC
  LIMIT 15
`);

// 10. Contratos resumo
data.contratos_resumo = await q("contratos", `
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN status = 'em_andamento' THEN 1 ELSE 0 END) as em_andamento,
    SUM(CASE WHEN status = 'concluido' THEN 1 ELSE 0 END) as concluidos,
    SUM(CASE WHEN status = 'cancelado' THEN 1 ELSE 0 END) as cancelados,
    SUM(CASE WHEN status = 'distratado' THEN 1 ELSE 0 END) as distratados,
    COALESCE(SUM(valorVenda), 0) as vgv_total,
    COALESCE(SUM(CASE WHEN createdAt >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN valorVenda ELSE 0 END), 0) as vgv_mes_atual
  FROM contratos
`);

// 11. Contratos por mês
data.contratos_por_mes = await q("contratos_mes", `
  SELECT DATE_FORMAT(createdAt, '%Y-%m') as mes, 
    COUNT(*) as total,
    COALESCE(SUM(valorVenda), 0) as vgv
  FROM contratos 
  WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
  GROUP BY mes 
  ORDER BY mes
`);

// 12. Top projetos
data.top_projetos = await q("top_projetos", `
  SELECT p.nome, p.construtora, COUNT(l.id) as total_leads,
    SUM(CASE WHEN l.status = 'contrato_fechado' THEN 1 ELSE 0 END) as contratos,
    SUM(CASE WHEN l.status = 'agendado' THEN 1 ELSE 0 END) as agendados,
    SUM(CASE WHEN l.status = 'visita_realizada' THEN 1 ELSE 0 END) as visitas_realizadas
  FROM projects p
  LEFT JOIN leads l ON l.projectId = p.id
  WHERE p.status = 'ativo'
  GROUP BY p.id, p.nome, p.construtora
  ORDER BY total_leads DESC
  LIMIT 15
`);

// 13. Agendamentos do mês por status
data.agendamentos_status = await q("agendamentos", `
  SELECT status, COUNT(*) as total
  FROM agendamentos
  WHERE dataAgendamento >= DATE_FORMAT(NOW(), '%Y-%m-01')
  GROUP BY status
  ORDER BY total DESC
`);

// 14. Visitas do mês por resultado
data.visitas_resultado = await q("visitas", `
  SELECT resultado, COUNT(*) as total
  FROM visitas
  WHERE dataVisita >= DATE_FORMAT(NOW(), '%Y-%m-01')
  GROUP BY resultado
  ORDER BY total DESC
`);

// 15. Motivos de perda
data.motivos_perda = await q("motivos_perda", `
  SELECT motivoPerda, COUNT(*) as total
  FROM leads
  WHERE status = 'perdido' AND motivoPerda IS NOT NULL AND motivoPerda != ''
  GROUP BY motivoPerda
  ORDER BY total DESC
  LIMIT 10
`);

// 16. Metas do mês atual
data.metas = await q("metas", `
  SELECT m.tipo, m.valorMeta, m.valorAtual,
    ROUND(m.valorAtual / NULLIF(m.valorMeta, 0) * 100, 1) as percentual,
    u.name as corretor, e.nome as equipe
  FROM metas m
  LEFT JOIN users u ON m.corretorId = u.id
  LEFT JOIN equipes e ON m.equipeId = e.id
  WHERE m.mes = MONTH(NOW()) AND m.ano = YEAR(NOW())
  ORDER BY m.tipo, percentual DESC
`);

// 17. Origens mais efetivas (com taxa de conversão)
data.origens_efetividade = await q("origens", `
  SELECT origem,
    COUNT(*) as total_leads,
    SUM(CASE WHEN status IN ('agendado','visita_realizada','analise_credito','contrato_fechado') THEN 1 ELSE 0 END) as convertidos,
    ROUND(SUM(CASE WHEN status IN ('agendado','visita_realizada','analise_credito','contrato_fechado') THEN 1 ELSE 0 END) / COUNT(*) * 100, 1) as taxa_conversao
  FROM leads
  WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 3 MONTH)
  GROUP BY origem
  HAVING total_leads >= 5
  ORDER BY taxa_conversao DESC
`);

// 18. Evolução semanal (últimas 8 semanas)
data.evolucao_semanal = await q("evolucao", `
  SELECT 
    YEARWEEK(createdAt, 1) as semana,
    MIN(DATE(createdAt)) as inicio_semana,
    COUNT(*) as leads,
    SUM(CASE WHEN status IN ('agendado','visita_realizada','analise_credito','contrato_fechado') THEN 1 ELSE 0 END) as avancaram_funil
  FROM leads
  WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 8 WEEK)
  GROUP BY semana
  ORDER BY semana
`);

// Save
const fs = await import('fs');
fs.writeFileSync('/home/ubuntu/allhands_data.json', JSON.stringify(data, null, 2));

// Print summary
console.log("=== RESUMO EXECUTIVO ===\n");
const t = data.totais[0];
console.log(`Total de Leads no Sistema: ${t.total_leads}`);
console.log(`Leads no Mês Atual: ${t.leads_mes_atual}`);
console.log(`Corretores Ativos: ${t.corretores_ativos}`);
console.log(`Gestores Ativos: ${t.gestores_ativos}`);
console.log(`Equipes Ativas: ${t.equipes_ativas}`);
console.log(`Projetos Ativos: ${t.projetos_ativos}`);
console.log(`Total de Contratos: ${t.total_contratos}`);
console.log(`Contratos no Mês: ${t.contratos_mes}`);
console.log(`Agendamentos no Mês: ${t.agendamentos_mes}`);
console.log(`Visitas no Mês: ${t.visitas_mes}`);

if (data.contratos_resumo[0]) {
  const c = data.contratos_resumo[0];
  console.log(`\nVGV Total: R$ ${Number(c.vgv_total).toLocaleString('pt-BR')}`);
  console.log(`VGV Mês Atual: R$ ${Number(c.vgv_mes_atual).toLocaleString('pt-BR')}`);
}

console.log("\n=== EQUIPES ===");
for (const eq of data.equipes) {
  console.log(`  ${eq.nome} (Gestor: ${eq.gestor}) - ${eq.corretores} corretores`);
}

console.log("\n=== RANKING TOP 5 CORRETORES (MÊS) ===");
for (const r of data.ranking_corretores.slice(0, 5)) {
  console.log(`  ${r.name} (${r.equipe}) - ${r.contratos} contratos, ${r.visitas} visitas, ${r.agendamentos} agend.`);
}

console.log("\n=== PERFORMANCE POR EQUIPE (MÊS) ===");
for (const pe of data.performance_equipes) {
  console.log(`  ${pe.equipe}: ${pe.leads_mes} leads, ${pe.agendamentos} agend., ${pe.visitas} visitas, ${pe.contratos} contratos`);
}

console.log("\n=== FUNIL MÊS ATUAL ===");
for (const f of data.funil_mes) {
  console.log(`  ${f.etapa}: ${f.total}`);
}

console.log("\n=== TOP 5 PROJETOS ===");
for (const p of data.top_projetos.slice(0, 5)) {
  console.log(`  ${p.nome}: ${p.total_leads} leads, ${p.contratos} contratos`);
}

console.log("\nDados completos salvos em /home/ubuntu/allhands_data.json");

await conn.end();
