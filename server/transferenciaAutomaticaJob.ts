import { getDb } from "./db";
import { leads, users } from "../drizzle/schema";
import { eq, and, lt, ne, isNull, or } from "drizzle-orm";
import { agora } from "./timezone";

/**
 * Job de Transferência Automática de Leads
 * 
 * Verifica diariamente leads "Em Atendimento" sem interação há mais de 2 dias
 * e os transfere automaticamente para outro corretor disponível.
 * 
 * Regras:
 * - Apenas leads com status "em_atendimento"
 * - ultimaInteracao > 2 dias atrás
 * - Origem NÃO é "captacao_corretor" (exceção)
 * - Se não houver corretor disponível → status "perdido" + lixeira
 */

export async function verificarTransferenciasAutomaticas() {
  try {
    const db = await getDb();
    if (!db) {
      console.error("[Transferência Automática] Banco de dados não disponível");
      return { transferidos: 0, perdidos: 0, erros: 0 };
    }

    const dataLimite = new Date(agora().getTime() - 2 * 24 * 60 * 60 * 1000); // 2 dias atrás
    
    console.log(`[Transferência Automática] Verificando leads sem interação desde ${dataLimite.toISOString()}...`);

    // Buscar leads elegíveis para transferência
    const leadsParaTransferir = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.status, "em_atendimento"),
          lt(leads.ultimaInteracao, dataLimite),
          ne(leads.origem, "captacao_corretor"), // Exceção: não transferir leads de captação própria
          eq(leads.naLixeira, false) // Não processar leads na lixeira
        )
      );

    console.log(`[Transferência Automática] Encontrados ${leadsParaTransferir.length} leads para transferir`);

    let transferidos = 0;
    let perdidos = 0;
    let erros = 0;

    for (const lead of leadsParaTransferir) {
      try {
        // Buscar próximo corretor disponível (excluindo o atual)
        const corretoresDisponiveis = await db
          .select()
          .from(users)
          .where(
            and(
              eq(users.role, "corretor"),
              ne(users.id, lead.corretorId || 0)
            )
          );

        if (corretoresDisponiveis.length > 0) {
          // Transferir para o próximo corretor (round-robin simples)
          const novoCorretor = corretoresDisponiveis[0];
          
          await db
            .update(leads)
            .set({
              corretorId: novoCorretor.id,
              status: "aguardando_atendimento", // Volta para aguardando atendimento
              ultimaInteracao: agora(),
              updatedAt: agora(),
            })
            .where(eq(leads.id, lead.id));

          console.log(
            `[Transferência Automática] Lead ${lead.id} (${lead.nome}) transferido de corretor ${lead.corretorId} para ${novoCorretor.id} (${novoCorretor.name})`
          );
          
          transferidos++;
        } else {
          // Não há mais corretores disponíveis → marcar como perdido e mover para lixeira
          await db
            .update(leads)
            .set({
              status: "perdido",
              naLixeira: true,
              dataMovidoLixeira: agora(),
              updatedAt: agora(),
            })
            .where(eq(leads.id, lead.id));

          console.log(
            `[Transferência Automática] Lead ${lead.id} (${lead.nome}) movido para PERDIDO (sem corretores disponíveis)`
          );
          
          perdidos++;
        }
      } catch (error) {
        console.error(
          `[Transferência Automática] Erro ao processar lead ${lead.id}:`,
          error
        );
        erros++;
      }
    }

    console.log(
      `[Transferência Automática] Concluído: ${transferidos} transferidos, ${perdidos} perdidos, ${erros} erros`
    );

    return { transferidos, perdidos, erros };
  } catch (error) {
    console.error("[Transferência Automática] Erro na verificação:", error);
    return { transferidos: 0, perdidos: 0, erros: 1 };
  }
}

/**
 * Agenda o job de transferência automática para rodar à meia-noite (00:00) no fuso de São Paulo
 */
export function agendarTransferenciaAutomatica() {
  // Calcular tempo até a próxima meia-noite em São Paulo
  function calcularTempoAteMeiaNoite(): number {
    const agoraSP = agora();
    const proximaMeiaNoite = new Date(agoraSP);
    proximaMeiaNoite.setHours(24, 0, 0, 0); // Próxima meia-noite
    
    const diff = proximaMeiaNoite.getTime() - agoraSP.getTime();
    return diff > 0 ? diff : 0;
  }

  // Função para agendar próxima execução
  function agendarProximaExecucao() {
    const tempoAteExecucao = calcularTempoAteMeiaNoite();
    
    console.log(
      `[Transferência Automática] Próxima execução em ${Math.round(tempoAteExecucao / 1000 / 60)} minutos (à meia-noite SP)`
    );

    setTimeout(async () => {
      console.log("[Transferência Automática] Executando verificação diária...");
      await verificarTransferenciasAutomaticas();
      
      // Agendar próxima execução (24h depois)
      agendarProximaExecucao();
    }, tempoAteExecucao);
  }

  // Executar primeira verificação após 1 minuto (para teste)
  setTimeout(() => {
    console.log("[Transferência Automática] Executando primeira verificação...");
    verificarTransferenciasAutomaticas().catch(console.error);
  }, 60000);

  // Agendar execuções diárias à meia-noite
  agendarProximaExecucao();

  console.log("[Transferência Automática] Job agendado para executar diariamente à meia-noite (fuso SP)");
}
