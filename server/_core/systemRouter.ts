import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, protectedProcedure, gestorProcedure, router } from "./trpc";
import { verificarTransferenciasAutomaticas } from "../transferenciaAutomaticaJob";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  // Endpoint de teste para executar transferência automática manualmente
  executarTransferenciaAutomatica: gestorProcedure
    .mutation(async () => {
      const resultado = await verificarTransferenciasAutomaticas();
      return resultado;
    }),

  // Redistribuir leads em aguardando_atendimento há mais de X dias
  redistribuirLeadsParados: gestorProcedure
    .input(
      z.object({
        diasParado: z.number().min(1).max(30).default(2),
        simular: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { leads, users, historicoAtribuicoes } = await import("../../drizzle/schema");
      const { eq, and, lt, sql, ne, notInArray, inArray } = await import("drizzle-orm");
      
      // 1. Buscar leads elegíveis para redistribuição
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - input.diasParado);
      
      const leadsElegiveis = await db
        .select({
          id: leads.id,
          nome: leads.nome,
          corretorId: leads.corretorId,
          dataDistribuicao: leads.dataDistribuicao,
        })
        .from(leads)
        .where(
          and(
            eq(leads.status, "aguardando_atendimento"),
            lt(leads.dataDistribuicao, dataLimite),
            ne(leads.origem, "captacao_corretor") // Não redistribuir leads de captação própria
          )
        );
      
      if (leadsElegiveis.length === 0) {
        return {
          sucesso: true,
          simulacao: input.simular,
          totalLeads: 0,
          corretoresAfetados: 0,
          redistribuidos: 0,
          erros: 0,
          mensagem: "Nenhum lead elegível para redistribuição",
        };
      }
      
      // 2. Buscar corretores disponíveis (apenas corretores ativos)
      const todosCorretores = await db
        .select({
          id: users.id,
          name: users.name,
        })
        .from(users)
        .where(
          and(
            eq(users.role, "corretor"),
            eq(users.situacao, "ativo")
          )
        );
      
      if (todosCorretores.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Nenhum corretor disponível para redistribuição",
        });
      }
      
      // 3. Para cada lead, buscar histórico de atribuições
      const leadIds = leadsElegiveis.map(l => l.id);
      const historico = await db
        .select({
          leadId: historicoAtribuicoes.leadId,
          corretorId: historicoAtribuicoes.corretorId,
        })
        .from(historicoAtribuicoes)
        .where(inArray(historicoAtribuicoes.leadId, leadIds));
      
      // Criar mapa de leads -> corretores que já trabalharam
      const leadParaCorretoresAntigos = new Map<number, Set<number>>();
      for (const h of historico) {
        if (!leadParaCorretoresAntigos.has(h.leadId)) {
          leadParaCorretoresAntigos.set(h.leadId, new Set());
        }
        leadParaCorretoresAntigos.get(h.leadId)!.add(h.corretorId);
      }
      
      // Adicionar corretor atual ao histórico
      for (const lead of leadsElegiveis) {
        if (!leadParaCorretoresAntigos.has(lead.id)) {
          leadParaCorretoresAntigos.set(lead.id, new Set());
        }
        if (lead.corretorId) {
          leadParaCorretoresAntigos.get(lead.id)!.add(lead.corretorId);
        }
      }
      
      if (input.simular) {
        // Modo simulação: calcular distribuição sem executar
        const corretoresAfetados = new Set(leadsElegiveis.map(l => l.corretorId)).size;
        const leadsParaRedistribuir = leadsElegiveis.length;
        const corretoresDisponiveis = todosCorretores.length;
        const leadsPorCorretor = Math.floor(leadsParaRedistribuir / corretoresDisponiveis);
        const leadsRestantes = leadsParaRedistribuir % corretoresDisponiveis;
        
        return {
          sucesso: true,
          simulacao: true,
          totalLeads: leadsParaRedistribuir,
          corretoresAfetados,
          redistribuidos: 0,
          erros: 0,
          mensagem: `${leadsParaRedistribuir} leads seriam redistribuídos entre ${corretoresDisponiveis} corretores (~${leadsPorCorretor} leads por corretor, ${leadsRestantes} corretores receberão +1 lead)`,
        };
      }
      
      // 4. Distribuição equilibrada: calcular quantos leads cada corretor deve receber
      const totalLeads = leadsElegiveis.length;
      const totalCorretores = todosCorretores.length;
      const leadsPorCorretor = Math.floor(totalLeads / totalCorretores);
      const leadsRestantes = totalLeads % totalCorretores;
      
      // Criar fila de distribuição: cada corretor tem uma cota
      const cotasPorCorretor = new Map<number, number>();
      for (let i = 0; i < todosCorretores.length; i++) {
        const corretor = todosCorretores[i];
        // Primeiros N corretores recebem +1 lead (onde N = leadsRestantes)
        const cota = leadsPorCorretor + (i < leadsRestantes ? 1 : 0);
        cotasPorCorretor.set(corretor.id, cota);
      }
      
      // 5. Redistribuir leads respeitando cotas e histórico
      let redistribuidos = 0;
      let perdidos = 0;
      let erros = 0;
      const redistribuicoes: Array<{ leadId: number; corretorId: number }> = [];
      const leadsPerdidos: Array<number> = [];
      
      for (const lead of leadsElegiveis) {
        try {
          const corretoresJaTrabalhou = leadParaCorretoresAntigos.get(lead.id) || new Set();
          
          // Encontrar corretor com cota disponível que não trabalhou este lead
          let corretorEscolhido: typeof todosCorretores[0] | null = null;
          
          for (const corretor of todosCorretores) {
            const cotaAtual = cotasPorCorretor.get(corretor.id) || 0;
            
            // Verificar se corretor tem cota e não trabalhou este lead
            if (cotaAtual > 0 && !corretoresJaTrabalhou.has(corretor.id)) {
              corretorEscolhido = corretor;
              break;
            }
          }
          
          // Se não encontrou corretor (todos já trabalharam), mover para Perdido + Lixeira
          if (!corretorEscolhido) {
            console.log(`Lead ${lead.id} será movido para Perdido (todos os corretores já trabalharam)`);
            leadsPerdidos.push(lead.id);
            perdidos++;
            continue;
          }
          
          // Registrar redistribuição
          redistribuicoes.push({
            leadId: lead.id,
            corretorId: corretorEscolhido.id,
          });
          
          // Decrementar cota
          cotasPorCorretor.set(
            corretorEscolhido.id,
            (cotasPorCorretor.get(corretorEscolhido.id) || 0) - 1
          );
          
          redistribuidos++;
        } catch (error) {
          console.error(`Erro ao processar lead ${lead.id}:`, error);
          erros++;
        }
      }
      
      // 6. Executar redistribuições no banco
      for (const { leadId, corretorId } of redistribuicoes) {
        try {
          // Atualizar lead
          await db
            .update(leads)
            .set({
              corretorId,
              dataDistribuicao: new Date(),
            })
            .where(eq(leads.id, leadId));
          
          // Registrar no histórico
          await db.insert(historicoAtribuicoes).values({
            leadId,
            corretorId,
            tipoAtribuicao: "redistribuicao_manual",
            dataAtribuicao: new Date(),
            observacoes: `Redistribuído por inatividade (${input.diasParado}+ dias sem interação)`,
          });
        } catch (error) {
          console.error(`Erro ao redistribuir lead ${leadId}:`, error);
          erros++;
        }
      }
      
      // 7. Mover leads perdidos para Perdido + Lixeira
      for (const leadId of leadsPerdidos) {
        try {
          await db
            .update(leads)
            .set({
              status: "perdido",
              lixeira: true,
            })
            .where(eq(leads.id, leadId));
        } catch (error) {
          console.error(`Erro ao mover lead ${leadId} para perdido:`, error);
          erros++;
        }
      }
      
      return {
        sucesso: true,
        simulacao: false,
        totalLeads: leadsElegiveis.length,
        corretoresAfetados: new Set(leadsElegiveis.map(l => l.corretorId)).size,
        redistribuidos,
        perdidos,
        erros,
        mensagem: `${redistribuidos} leads redistribuídos equilibradamente entre ${todosCorretores.length} corretores${perdidos > 0 ? `, ${perdidos} leads movidos para Perdido (todos os corretores já trabalharam)` : ''}`,
      };
    }),

  // Levantamento de leads parados para página de Distribuição
  levantarLeadsParadosDistribuicao: gestorProcedure
    .query(async () => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { leads, users } = await import("../../drizzle/schema");
      const { sql, lt, and, eq, ne, isNull, or } = await import("drizzle-orm");
      
      // Data limite: 2 dias atrás
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 2);
      
      // Buscar leads sem interação nos últimos 2 dias
      const leadsParados = await db
        .select({
          id: leads.id,
          nome: leads.nome,
          telefone: leads.telefone,
          email: leads.email,
          status: leads.status,
          origem: leads.origem,
          corretorId: leads.corretorId,
          corretorNome: users.name,
          ultimaInteracao: leads.ultimaInteracao,
          ultimoContato: leads.ultimoContato,
          createdAt: leads.createdAt,
        })
        .from(leads)
        .leftJoin(users, eq(leads.corretorId, users.id))
        .where(
          and(
            eq(leads.naLixeira, false),
            ne(leads.origem, "captacao_corretor"),
            or(
              isNull(leads.ultimaInteracao),
              lt(leads.ultimaInteracao, dataLimite)
            ),
            or(
              isNull(leads.ultimoContato),
              lt(leads.ultimoContato, dataLimite)
            )
          )
        );
      
      // Agrupar por status
      const porStatus: Record<string, number> = {};
      const porCorretor: Record<string, number> = {};
      const porOrigem: Record<string, number> = {};
      
      for (const lead of leadsParados) {
        porStatus[lead.status] = (porStatus[lead.status] || 0) + 1;
        const corretor = lead.corretorNome || "Sem corretor";
        porCorretor[corretor] = (porCorretor[corretor] || 0) + 1;
        const origem = lead.origem || "Sem origem";
        porOrigem[origem] = (porOrigem[origem] || 0) + 1;
      }
      
      return {
        total: leadsParados.length,
        porStatus,
        porCorretor,
        porOrigem,
        leads: leadsParados.slice(0, 50), // Retornar apenas os primeiros 50 para preview
      };
    }),

  // Redistribuir leads parados da página de Distribuição
  redistribuirLeadsParadosDistribuicao: gestorProcedure
    .mutation(async () => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { leads, users, historicoAtribuicoes, logTransferencias } = await import("../../drizzle/schema");
      const { sql, lt, and, eq, ne, isNull, or, notInArray } = await import("drizzle-orm");
      
      // 1. Buscar leads elegíveis
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 2);
      
      const leadsElegiveis = await db
        .select({
          id: leads.id,
          corretorId: leads.corretorId,
        })
        .from(leads)
        .where(
          and(
            eq(leads.naLixeira, false),
            ne(leads.origem, "captacao_corretor"),
            or(
              isNull(leads.ultimaInteracao),
              lt(leads.ultimaInteracao, dataLimite)
            ),
            or(
              isNull(leads.ultimoContato),
              lt(leads.ultimoContato, dataLimite)
            )
          )
        );
      
      if (leadsElegiveis.length === 0) {
        return {
          sucesso: true,
          totalLeads: 0,
          redistribuidos: 0,
          perdidos: 0,
          mensagem: "Nenhum lead elegível para redistribuição",
        };
      }
      
      // 2. Buscar todos os corretores (sem filtro de elegibilidade para leads parados)
      const todosCorretores = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.role, "corretor"));
      
      if (todosCorretores.length === 0) {
        return {
          sucesso: false,
          totalLeads: leadsElegiveis.length,
          corretoresAfetados: 0,
          redistribuidos: 0,
          perdidos: 0,
          erros: 0,
          mensagem: `Nenhum corretor disponível para redistribuir ${leadsElegiveis.length} leads.`,
        };
      }
      
      // 3. Calcular cota por corretor (distribuição equilibrada)
      const quotaPorCorretor = Math.ceil(leadsElegiveis.length / todosCorretores.length);
      const quotas: Record<number, number> = {};
      todosCorretores.forEach(c => {
        quotas[c.id] = quotaPorCorretor;
      });
      
      let redistribuidos = 0;
      let perdidos = 0;
      let erros = 0;
      const leadsPerdidos: number[] = [];
      
      // 4. Redistribuir cada lead com transação para evitar race condition
      console.log(`[REDISTRIBUIÇÃO] Iniciando redistribuição de ${leadsElegiveis.length} leads entre ${todosCorretores.length} corretores`);
      for (const lead of leadsElegiveis) {
        try {
          await db.transaction(async (tx) => {
            // SELECT FOR UPDATE: lock pessimista no lead
            const leadLockedResult = await tx
              .select()
              .from(leads)
              .where(eq(leads.id, lead.id))
              .for('update');
            
            if (!leadLockedResult || leadLockedResult.length === 0) {
              throw new Error("Lead não encontrado");
            }
            
            const leadData = leadLockedResult[0];
            
            // Verificar se o lead ainda está no corretor original (pode ter sido redistribuído)
            if (leadData.corretorId !== lead.corretorId) {
              throw new Error("Lead já foi redistribuído");
            }
            
            // Buscar histórico de atribuições deste lead
            const historico = await tx
              .select({ corretorId: historicoAtribuicoes.corretorId })
              .from(historicoAtribuicoes)
              .where(eq(historicoAtribuicoes.leadId, lead.id));
            
            const corretoresJaTrabalharam = historico.map(h => h.corretorId);
            
            // Filtrar corretores que ainda não trabalharam este lead e têm cota
            const corretoresDisponiveis = todosCorretores.filter(
              c => !corretoresJaTrabalharam.includes(c.id) && quotas[c.id] > 0
            );
            
            console.log(`[REDISTRIBUIÇÃO] Lead ${lead.id}: ${corretoresJaTrabalharam.length} corretores já trabalharam, ${corretoresDisponiveis.length} disponíveis`);
            
            if (corretoresDisponiveis.length === 0) {
              // Nenhum corretor disponível - mover para perdido
              leadsPerdidos.push(lead.id);
              perdidos++;
              return;
            }
            
            // Selecionar corretor com maior cota disponível
            const corretorSelecionado = corretoresDisponiveis.reduce((prev, curr) =>
              quotas[curr.id] > quotas[prev.id] ? curr : prev
            );
            
            // Atualizar lead (dentro da transação)
            await tx
              .update(leads)
              .set({
                corretorId: corretorSelecionado.id,
                dataDistribuicao: new Date(),
              })
              .where(eq(leads.id, lead.id));
            
            // Registrar no histórico
            await tx.insert(historicoAtribuicoes).values({
              leadId: lead.id,
              corretorId: corretorSelecionado.id,
              tipoAtribuicao: "redistribuicao_manual",
              dataAtribuicao: new Date(),
              observacoes: "Redistribuído por inatividade (2+ dias sem interação) - Página de Distribuição",
            });
            
            // Registrar no log de transferências
            await tx.insert(logTransferencias).values({
              leadId: lead.id,
              corretorOrigemId: lead.corretorId,
              corretorDestinoId: corretorSelecionado.id,
              motivo: "2 dias sem interação",
              statusFinal: "transferido",
              dataTransferencia: new Date(),
            });
            
            // Decrementar cota
            quotas[corretorSelecionado.id]--;
            redistribuidos++;
          });
        } catch (error: any) {
          console.error(`[REDISTRIBUIÇÃO] Erro ao redistribuir lead ${lead.id}:`, {
            leadId: lead.id,
            corretorAtual: lead.corretorId,
            erro: error.message,
            stack: error.stack,
          });
          erros++;
        }
      }
      
      // 5. Mover leads perdidos para Perdido + Lixeira
      for (const leadId of leadsPerdidos) {
        try {
          await db
            .update(leads)
            .set({
              status: "perdido",
              naLixeira: true,
              dataMovidoLixeira: new Date(),
              motivoPerdido: "Todos os corretores já trabalharam este lead",
            })
            .where(eq(leads.id, leadId));
        } catch (error) {
          console.error(`Erro ao mover lead ${leadId} para perdido:`, error);
          erros++;
        }
      }
      
      return {
        sucesso: true,
        totalLeads: leadsElegiveis.length,
        corretoresAfetados: todosCorretores.length,
        redistribuidos,
        perdidos,
        erros,
        mensagem: `${redistribuidos} leads redistribuídos equilibradamente entre ${todosCorretores.length} corretores${perdidos > 0 ? `, ${perdidos} leads movidos para Perdido (todos os corretores já trabalharam)` : ''}${erros > 0 ? `, ${erros} erros` : ''}`,
      };
    }),

  // Endpoint para executar backup manual sob demanda
  executarBackupManual: gestorProcedure
    .mutation(async () => {
      const { performBackup } = await import("../backup");
      const resultado = await performBackup();
      
      if (!resultado.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: resultado.error || "Erro ao executar backup",
        });
      }
      
      return {
        success: true,
        filename: resultado.filename,
        url: resultado.url,
        timestamp: resultado.timestamp,
        tables: resultado.tables,
      };
    }),
});
