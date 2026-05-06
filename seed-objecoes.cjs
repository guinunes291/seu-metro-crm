const mysql = require('./node_modules/.pnpm/mysql2@3.15.1/node_modules/mysql2/promise.js');
const fs = require('fs');

const data = JSON.parse(fs.readFileSync('/home/ubuntu/objections_structured.json', 'utf8'));

const FASE_SLUGS = {
  'FASE A - Lead Novo / Primeiro Contato': 'fase_a',
  'FASE B - Tentativa de Contato / Sem Resposta': 'fase_b',
  'FASE C - Qualificação': 'fase_c',
  'FASE D - Simulação e Crédito': 'fase_d',
  'FASE E - Produto, Localização e Projeto': 'fase_e',
  'FASE F - Preço, Entrada e Negociação': 'fase_f',
  'FASE G - Agendamento de Visita': 'fase_g',
  'FASE H - Confirmação de Visita': 'fase_h',
  'FASE I - Pós-Visita': 'fase_i',
  'FASE J - Documentação': 'fase_j',
  'FASE K - Análise de Crédito': 'fase_k',
  'FASE L - Fechamento': 'fase_l',
  'FASE M - Recuperação e Reativação': 'fase_m',
};

async function seed() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  await conn.execute('DELETE FROM objecoes_playbook');
  console.log('Tabela limpa.');
  
  let ordem = 0;
  let total = 0;
  const seen = new Set();
  
  for (const [fase, items] of Object.entries(data.fases)) {
    const faseSlug = FASE_SLUGS[fase] || 'fase_a';
    
    for (const item of items) {
      const key = `${fase}|${item.situacao}|${item.frase}`;
      if (seen.has(key)) continue;
      seen.add(key);
      
      const temperatura = ['quente', 'morno', 'frio'].includes(item.temperatura) 
        ? item.temperatura 
        : 'morno';
      
      await conn.execute(
        `INSERT INTO objecoes_playbook 
         (fase, faseSlug, situacao, frase, significado, tipoObjecao, temperatura, objetivo, 
          respostaAcr, msgWhatsapp, canal, perguntaQualificacao, 
          tagCrm, tempoResposta, prioridade, erroComum, ativo, ordem)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true, ?)`,
        [
          fase.substring(0, 100),
          faseSlug,
          item.situacao.substring(0, 255),
          item.frase.substring(0, 255),
          item.significado || null,
          item.tipo ? item.tipo.substring(0, 50) : null,
          temperatura,
          item.objetivo || null,
          item.resposta_acr || null,
          item.msg_curta || null,
          item.canal ? item.canal.substring(0, 30) : null,
          item.pergunta_qualificacao || null,
          item.tag_crm ? item.tag_crm.substring(0, 100) : null,
          item.tempo_resposta ? item.tempo_resposta.substring(0, 50) : null,
          item.prioridade ? item.prioridade.substring(0, 20) : null,
          item.erro_comum || null,
          ordem++,
        ]
      );
      total++;
    }
  }
  
  await conn.end();
  console.log(`✅ ${total} objeções inseridas com sucesso!`);
}

seed().catch(console.error);
