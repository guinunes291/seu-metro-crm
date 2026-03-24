import { getDb } from "./db";
import { leads, users, logTransferencias, distributionLog } from "../drizzle/schema";
import { eq, and, lt, ne, sql, inArray } from "drizzle-orm";
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

    // Contador global para round-robin entre todos os leads
    let roundRobinIndex = 0;

    for (const lead of leadsParaTransferir) {
      try {
        // Buscar corretores que já trabalharam este lead (via log de distribuição)
        const corretoresQueJaTrabalharamRows = await db
          .select({ corretorId: distributionLog.corretorId })
          .from(distributionLog)
          .where(eq(distributionLog.leadId, lead.id));

        const idsQueJaTrabalharam = new Set(
          corretoresQueJaTrabalharamRows
            .map((r) => r.corretorId)
            .filter((id): id is number => id !== null)
        );
        // Incluir o corretor atual na lista de exclusão
        if (lead.corretorId) idsQueJaTrabalharam.add(lead.corretorId);

        // Buscar todos os corretores presentes excluindo quem já trabalhou
        const todosCorretores = await db
          .select()
          .from(users)
          .where(
            and(
              eq(users.role, "corretor"),
              eq(users.status, "presente")
            )
          );

        const corretoresDisponiveis = todosCorretores.filter(
          (c) => !idsQueJaTrabalharam.has(c.id)
        );

        if (corretoresDisponiveis.length > 0) {
          // Round-robin real: usa índice global rotativo
          const novoCorretor = corretoresDisponiveis[roundRobinIndex % corretoresDisponiveis.length];
          roundRobinIndex++;
                  await db
            .update(leads)
            .set({
              corretorId: novoCorretor.id,
              dataDistribuicao: agora(),
              timestampRecebimento: agora(),
              status: "aguardando_atendimento",
              updatedAt: agora(),
            })
            .where(eq(leads.id, lead.id));

          // Registrar log de transferência
          await db.insert(logTransferencias).values({
            leadId: lead.id,
            leadNome: lead.nome,
            corretorOrigemId: lead.corretorId || null,
            corretorOrigemNome: null,
            corretorDestinoId: novoCorretor.id,
            corretorDestinoNome: novoCorretor.name,
            motivo: "2_dias_sem_interacao",
            statusFinal: "transferido",
            dataTransferencia: agora(),
          });

          // Registrar no distribution_log para rastrear histórico de corretores que já trabalharam
          await db.insert(distributionLog).values({
            leadId: lead.id,
            corretorId: novoCorretor.id,
            tipo: "automatica",
            motivo: "Transferência automática por 2 dias sem interação (round-robin)",
          });

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

          // Registrar log de transferência (perdido)
          await db.insert(logTransferencias).values({
            leadId: lead.id,
            leadNome: lead.nome,
            corretorOrigemId: lead.corretorId || null,
            corretorOrigemNome: null,
            corretorDestinoId: null,
            corretorDestinoNome: null,
            motivo: "sem_corretores_disponiveis",
            statusFinal: "perdido",
            dataTransferencia: agora(),
          });

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
