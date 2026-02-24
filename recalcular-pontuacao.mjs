import mysql from 'mysql2/promise';
import { config } from 'dotenv';

config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL não encontrada');
  process.exit(1);
}

// Nova pontuação (24/02/2026)
const PONTOS = {
  LIGACAO: 2,
  WHATSAPP: 1,
  AGENDAMENTO: 100,
  VISITA: 250,
  DOCUMENTACAO: 400,
  VENDA: 1000,
};

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     RECÁLCULO DE PONTUAÇÃO HISTÓRICA - Seu Metro Quadrado  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Novos valores de pontuação:');
  console.log(`  Ligação realizada:      ${PONTOS.LIGACAO} pts`);
  console.log(`  WhatsApp enviado:       ${PONTOS.WHATSAPP} pt`);
  console.log(`  Agendamento confirmado: ${PONTOS.AGENDAMENTO} pts`);
  console.log(`  Visita realizada:       ${PONTOS.VISITA} pts`);
  console.log(`  Análise de crédito:     ${PONTOS.DOCUMENTACAO} pts`);
  console.log(`  Contrato fechado:       ${PONTOS.VENDA} pts`);
  console.log('');

  // 1. Contar registros
  const [countRows] = await connection.execute('SELECT COUNT(*) as total FROM atividades_diarias');
  const total = countRows[0].total;
  console.log(`📊 Total de registros de atividades diárias: ${total}`);

  // 2. Ranking ANTES do recálculo
  const [rankingAntes] = await connection.execute(`
    SELECT a.corretorId, u.name as nome, 
           SUM(a.pontuacaoTotal) as totalPontos
    FROM atividades_diarias a
    LEFT JOIN users u ON a.corretorId = u.id
    GROUP BY a.corretorId, u.name
    ORDER BY totalPontos DESC
    LIMIT 10
  `);
  console.log('\n📋 RANKING ANTES DO RECÁLCULO (Top 10):');
  let pos = 1;
  for (const row of rankingAntes) {
    console.log(`  ${String(pos).padStart(2)}º ${(row.nome || 'ID:' + row.corretorId).padEnd(30)} | ${String(row.totalPontos).padStart(8)} pts`);
    pos++;
  }

  // 3. Recalcular pontuação via SQL direto (mais eficiente que loop)
  console.log('\n⏳ Recalculando pontuação de todos os registros...');
  
  const updateQuery = `
    UPDATE atividades_diarias 
    SET pontuacaoTotal = (
      (COALESCE(ligacoesRealizadas, 0) * ${PONTOS.LIGACAO}) +
      (COALESCE(whatsappEnviados, 0) * ${PONTOS.WHATSAPP}) +
      (COALESCE(agendamentosConfirmados, 0) * ${PONTOS.AGENDAMENTO}) +
      (COALESCE(visitasRealizadas, 0) * ${PONTOS.VISITA}) +
      (GREATEST(COALESCE(analiseCreditoEnviadas, 0), COALESCE(documentacoesRecolhidas, 0)) * ${PONTOS.DOCUMENTACAO}) +
      (COALESCE(contratosFechados, 0) * ${PONTOS.VENDA})
    ),
    updatedAt = NOW()
  `;

  const [updateResult] = await connection.execute(updateQuery);
  console.log(`✅ Registros processados: ${updateResult.affectedRows}`);
  console.log(`✅ Registros com pontuação alterada: ${updateResult.changedRows}`);

  // 4. Ranking DEPOIS do recálculo
  const [rankingDepois] = await connection.execute(`
    SELECT a.corretorId, u.name as nome, 
           SUM(a.pontuacaoTotal) as totalPontos,
           SUM(a.ligacoesRealizadas) as totalLigacoes,
           SUM(a.whatsappEnviados) as totalWhatsapp,
           SUM(a.agendamentosConfirmados) as totalAgendamentos,
           SUM(a.visitasRealizadas) as totalVisitas,
           GREATEST(SUM(COALESCE(a.analiseCreditoEnviadas, 0)), SUM(COALESCE(a.documentacoesRecolhidas, 0))) as totalAnalises,
           SUM(a.contratosFechados) as totalVendas
    FROM atividades_diarias a
    LEFT JOIN users u ON a.corretorId = u.id
    GROUP BY a.corretorId, u.name
    ORDER BY totalPontos DESC
    LIMIT 15
  `);
  console.log('\n🏆 RANKING ATUALIZADO (Top 15):');
  console.log('  ──────────────────────────────────────────────────────────────────────────────────────');
  console.log('  Pos  Nome                           Pontos     Lig    WA    Ag   Vis   AC  Vendas');
  console.log('  ──────────────────────────────────────────────────────────────────────────────────────');
  pos = 1;
  for (const row of rankingDepois) {
    const nome = (row.nome || 'ID:' + row.corretorId).padEnd(30);
    const pts = String(row.totalPontos).padStart(8);
    const lig = String(row.totalLigacoes || 0).padStart(5);
    const wa = String(row.totalWhatsapp || 0).padStart(5);
    const ag = String(row.totalAgendamentos || 0).padStart(5);
    const vis = String(row.totalVisitas || 0).padStart(5);
    const ac = String(row.totalAnalises || 0).padStart(4);
    const vendas = String(row.totalVendas || 0).padStart(6);
    console.log(`  ${String(pos).padStart(2)}º  ${nome} ${pts}  ${lig}  ${wa}  ${ag}  ${vis}  ${ac}  ${vendas}`);
    pos++;
  }
  console.log('  ──────────────────────────────────────────────────────────────────────────────────────');

  // 5. Validação: verificar 5 registros aleatórios
  const [validacao] = await connection.execute(`
    SELECT id, corretorId, DATE(data) as dia, 
           ligacoesRealizadas, whatsappEnviados, agendamentosConfirmados, 
           visitasRealizadas, analiseCreditoEnviadas, documentacoesRecolhidas, contratosFechados, 
           pontuacaoTotal
    FROM atividades_diarias 
    WHERE ligacoesRealizadas > 0 OR agendamentosConfirmados > 0 OR visitasRealizadas > 0
    ORDER BY RAND() LIMIT 5
  `);
  console.log('\n🔍 VALIDAÇÃO (5 registros aleatórios):');
  let todosOk = true;
  for (const row of validacao) {
    const docsOuAnalise = Math.max(row.analiseCreditoEnviadas || 0, row.documentacoesRecolhidas || 0);
    const esperado = 
      (row.ligacoesRealizadas || 0) * PONTOS.LIGACAO +
      (row.whatsappEnviados || 0) * PONTOS.WHATSAPP +
      (row.agendamentosConfirmados || 0) * PONTOS.AGENDAMENTO +
      (row.visitasRealizadas || 0) * PONTOS.VISITA +
      docsOuAnalise * PONTOS.DOCUMENTACAO +
      (row.contratosFechados || 0) * PONTOS.VENDA;
    const ok = row.pontuacaoTotal === esperado;
    if (!ok) todosOk = false;
    console.log(`  ${ok ? '✅' : '❌'} ID ${row.id} | ${row.dia} | Calculado: ${row.pontuacaoTotal} | Esperado: ${esperado}`);
  }

  // 6. Atualizar tabela configuracao_pontuacao
  try {
    const [configRows] = await connection.execute('SELECT COUNT(*) as total FROM configuracao_pontuacao');
    if (configRows[0].total > 0) {
      await connection.execute(`
        UPDATE configuracao_pontuacao SET 
          pontosLigacao = ${PONTOS.LIGACAO},
          pontosLigacaoAtendida = 0,
          pontosWhatsapp = ${PONTOS.WHATSAPP},
          pontosWhatsappRespondido = 0,
          pontosAgendamento = ${PONTOS.AGENDAMENTO},
          pontosVisita = ${PONTOS.VISITA},
          pontosDocumentacao = ${PONTOS.DOCUMENTACAO},
          pontosVenda = ${PONTOS.VENDA},
          pontosClienteCadastrado = 0,
          pontosAlteracaoStatus = 0,
          updatedAt = NOW()
      `);
      console.log('\n✅ Tabela configuracao_pontuacao atualizada com novos valores');
    } else {
      await connection.execute(`
        INSERT INTO configuracao_pontuacao (pontosLigacao, pontosLigacaoAtendida, pontosWhatsapp, pontosWhatsappRespondido, pontosAgendamento, pontosVisita, pontosDocumentacao, pontosVenda, pontosClienteCadastrado, pontosAlteracaoStatus)
        VALUES (${PONTOS.LIGACAO}, 0, ${PONTOS.WHATSAPP}, 0, ${PONTOS.AGENDAMENTO}, ${PONTOS.VISITA}, ${PONTOS.DOCUMENTACAO}, ${PONTOS.VENDA}, 0, 0)
      `);
      console.log('\n✅ Tabela configuracao_pontuacao criada com novos valores');
    }
  } catch (e) {
    console.log('\n⚠️  configuracao_pontuacao:', e.message);
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log(`║  RESUMO: ${updateResult.changedRows} registros recalculados com sucesso       ║`);
  console.log(`║  Validação: ${todosOk ? 'TODOS OK ✅' : 'ERROS ENCONTRADOS ❌'}                              ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');

  await connection.end();
}

main().catch(console.error);
