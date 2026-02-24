import { getRankingDia } from './server/db.js';

console.log('Testando getRankingDia()...\n');

try {
  const ranking = await getRankingDia();
  
  console.log('Total de corretores:', ranking.length);
  console.log('\nPrimeiros 3 corretores:');
  
  ranking.slice(0, 3).forEach((corretor, idx) => {
    console.log(`\n${idx + 1}. ${corretor.corretorNome}`);
    console.log(`   Ligações: ${corretor.ligacoesRealizadas}`);
    console.log(`   WhatsApp: ${corretor.whatsappEnviados}`);
    console.log(`   Agendamentos: ${corretor.agendamentosConfirmados}`);
    console.log(`   Visitas: ${corretor.visitasRealizadas}`);
    console.log(`   Documentações: ${corretor.documentacoesRecolhidas}`);
    console.log(`   Pontos: ${corretor.pontuacaoTotal}`);
  });
  
  console.log('\n✅ Teste concluído!');
} catch (error) {
  console.error('❌ Erro:', error.message);
  console.error(error.stack);
}

process.exit(0);
