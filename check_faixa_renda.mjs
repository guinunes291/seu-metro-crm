import Database from 'better-sqlite3';

const db = new Database('./database.sqlite');

// Buscar leads do Facebook Ads
const leadsComFaixaRenda = db.prepare(`
  SELECT id, nome, telefone, origem, faixaRenda, campanha
  FROM leads 
  WHERE origem = 'facebook' 
  AND faixaRenda IS NOT NULL 
  AND faixaRenda != ''
  LIMIT 10
`).all();

const leadsSemFaixaRenda = db.prepare(`
  SELECT id, nome, telefone, origem, faixaRenda, campanha
  FROM leads 
  WHERE origem = 'facebook' 
  AND (faixaRenda IS NULL OR faixaRenda = '')
  LIMIT 10
`).all();

const totalFacebook = db.prepare(`
  SELECT COUNT(*) as total FROM leads WHERE origem = 'facebook'
`).get();

const totalComFaixa = db.prepare(`
  SELECT COUNT(*) as total FROM leads WHERE origem = 'facebook' AND faixaRenda IS NOT NULL AND faixaRenda != ''
`).get();

console.log('\n=== ESTATÍSTICAS ===');
console.log(`Total de leads do Facebook: ${totalFacebook.total}`);
console.log(`Leads COM faixa de renda: ${totalComFaixa.total}`);
console.log(`Leads SEM faixa de renda: ${totalFacebook.total - totalComFaixa.total}`);

console.log('\n=== LEADS COM FAIXA DE RENDA ===');
console.table(leadsComFaixaRenda);

console.log('\n=== LEADS SEM FAIXA DE RENDA ===');
console.table(leadsSemFaixaRenda);

db.close();
