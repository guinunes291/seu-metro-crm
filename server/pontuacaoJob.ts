import { getDb } from './db.ts';
import { atividadesDiarias } from '../drizzle/schema.ts';
import { sql } from 'drizzle-orm';

// Job que recalcula pontuação de todas as atividades a cada 60 minutos (reduzido de 15 min para economizar recursos)
export async function iniciarJobPontuacao() {
  console.log('[Pontuação Job] Iniciando job de recálculo de pontuação...');
  
  // Executar imediatamente ao iniciar
  await recalcularPontuacaoTodasAtividades();
  
  // Executar a cada 6 horas (reduzido para economizar recursos)
  setInterval(async () => {
    await recalcularPontuacaoTodasAtividades();
  }, 6 * 60 * 60 * 1000);
}

async function recalcularPontuacaoTodasAtividades() {
  try {
    const db = await getDb();
    if (!db) {
      console.error('[Pontuação Job] Banco de dados não disponível');
      return;
    }
    
    console.log('[Pontuação Job] Recalculando pontuação de todas as atividades...');
    
    // Sistema de pontuação oficial:
    // Ligação: 5 pontos, WhatsApp: 1 ponto, Agendamento: 25 pontos
    // Visita: 40 pontos, Análise/Documentação: 60 pontos, Contrato: 150 pontos
    
    const result = await db.execute(sql`
      UPDATE ${atividadesDiarias}
      SET pontuacaoTotal = (
        (COALESCE(ligacoesRealizadas, 0) * 5) +
        (COALESCE(whatsappEnviados, 0) * 1) +
        (COALESCE(agendamentosConfirmados, 0) * 25) +
        (COALESCE(visitasRealizadas, 0) * 40) +
        (COALESCE(documentacoesRecolhidas, 0) * 60) +
        (COALESCE(analiseCreditoEnviadas, 0) * 60) +
        (COALESCE(contratosFechados, 0) * 150)
      )
    `);
    
    console.log(`[Pontuação Job] Pontuação recalculada com sucesso!`);
  } catch (error) {
    console.error('[Pontuação Job] Erro ao recalcular pontuação:', error);
  }
}
