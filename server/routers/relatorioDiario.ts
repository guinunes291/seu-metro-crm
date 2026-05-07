import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import {
  atividadesDiarias,
  metasDiarias,
  agendamentos,
  visitas,
  leads,
  leadStatusTransitions,
  propostas,
  contratos,
  users,
  whatsappLogs,
} from "../../drizzle/schema";
import { eq, and, gte, lte, sql, desc, between } from "drizzle-orm";

// ============================================================================
// HELPERS
// ============================================================================

function isGestorLevel(role: string): boolean {
  return role === "gestor" || role === "admin" || role === "superintendente";
}

// ============================================================================
// ROUTER
// ============================================================================

export const relatorioDiarioRouter = router({
  // Busca os dados do relatório diário para um período
  getDiario: protectedProcedure
    .input(
      z.object({
        inicio: z.date(),
        fim: z.date(),
        corretorId: z.number().optional(), // Para gestores/admins filtrarem por corretor
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const { inicio, fim } = input;
      const userRole = ctx.user.role;

      // Determinar qual corretor está sendo analisado
      let targetCorretorId: number;
      if (
        input.corretorId &&
        isGestorLevel(userRole)
      ) {
        targetCorretorId = input.corretorId;
      } else {
        targetCorretorId = ctx.user.id;
      }

      // ======================================================================
      // QUERY 1: Atividades diárias no período (tabela atividadesDiarias)
      // ======================================================================
      const atividadesRows = await db
        .select()
        .from(atividadesDiarias)
        .where(
          and(
            eq(atividadesDiarias.corretorId, targetCorretorId),
            gte(atividadesDiarias.data, inicio),
            lte(atividadesDiarias.data, fim)
          )
        );

      // Somar todas as atividades do período
      const atividades = atividadesRows.reduce(
        (acc, row) => ({
          ligacoesRealizadas: acc.ligacoesRealizadas + (row.ligacoesRealizadas || 0),
          ligacoesAtendidas: acc.ligacoesAtendidas + (row.ligacoesAtendidas || 0),
          whatsappEnviados: acc.whatsappEnviados + (row.whatsappEnviados || 0),
          whatsappRespondidos: acc.whatsappRespondidos + (row.whatsappRespondidos || 0),
          agendamentosConfirmados: acc.agendamentosConfirmados + (row.agendamentosConfirmados || 0),
          visitasRealizadas: acc.visitasRealizadas + (row.visitasRealizadas || 0),
          propostasEnviadas: acc.propostasEnviadas + (row.propostasEnviadas || 0),
          analiseCreditoEnviadas: acc.analiseCreditoEnviadas + (row.analiseCreditoEnviadas || 0),
          analiseCreditoEnviadas: acc.analiseCreditoEnviadas + (row.analiseCreditoEnviadas || 0),
          contratosFechados: acc.contratosFechados + (row.contratosFechados || 0),
          clientesCadastrados: acc.clientesCadastrados + (row.clientesCadastrados || 0),
          alteracoesStatus: acc.alteracoesStatus + (row.alteracoesStatus || 0),
          vgvDia: acc.vgvDia + (row.vgvDia || 0),
          pontuacaoTotal: acc.pontuacaoTotal + (row.pontuacaoTotal || 0),
        }),
        {
          ligacoesRealizadas: 0,
          ligacoesAtendidas: 0,
          whatsappEnviados: 0,
          whatsappRespondidos: 0,
          agendamentosConfirmados: 0,
          visitasRealizadas: 0,
          propostasEnviadas: 0,
          analiseCreditoEnviadas: 0,
          analiseCreditoEnviadas: 0,
          contratosFechados: 0,
          clientesCadastrados: 0,
          alteracoesStatus: 0,
          vgvDia: 0,
          pontuacaoTotal: 0,
        }
      );

      // ======================================================================
      // QUERY 2: Metas diárias do corretor
      // ======================================================================
      const [metaRow] = await db
        .select()
        .from(metasDiarias)
        .where(
          and(
            eq(metasDiarias.corretorId, targetCorretorId),
            eq(metasDiarias.ativo, true)
          )
        )
        .limit(1);

      const metas = metaRow || {
        metaLigacoes: 20,
        metaWhatsapp: 30,
        metaAgendamentos: 3,
        metaVisitas: 2,
        metaDocumentacoes: 1,
        metaVendas: 1,
      };

      // ======================================================================
      // QUERY 3: Agendamentos criados no período
      // ======================================================================
      const agendamentosRows = await db
        .select({
          id: agendamentos.id,
          status: agendamentos.status,
          dataAgendamento: agendamentos.dataAgendamento,
        })
        .from(agendamentos)
        .where(
          and(
            eq(agendamentos.corretorId, targetCorretorId),
            gte(agendamentos.createdAt, inicio),
            lte(agendamentos.createdAt, fim)
          )
        );

      const agendamentosStats = {
        total: agendamentosRows.length,
        confirmados: agendamentosRows.filter((a) => a.status === "confirmado").length,
        realizados: agendamentosRows.filter((a) => a.status === "realizado").length,
        cancelados: agendamentosRows.filter((a) => a.status === "cancelado").length,
        pendentes: agendamentosRows.filter((a) => a.status === "pendente").length,
      };

      // ======================================================================
      // QUERY 4: Visitas realizadas no período
      // ======================================================================
      const visitasRows = await db
        .select({
          id: visitas.id,
          resultado: visitas.resultado,
          dataVisita: visitas.dataVisita,
        })
        .from(visitas)
        .where(
          and(
            eq(visitas.corretorId, targetCorretorId),
            gte(visitas.dataVisita, inicio),
            lte(visitas.dataVisita, fim)
          )
        );

      const visitasStats = {
        total: visitasRows.length,
        interesseAlto: visitasRows.filter((v) => v.resultado === "interesse_alto").length,
        interesseMedio: visitasRows.filter((v) => v.resultado === "interesse_medio").length,
        interesseBaixo: visitasRows.filter((v) => v.resultado === "interesse_baixo").length,
        semInteresse: visitasRows.filter((v) => v.resultado === "sem_interesse").length,
        encaminhadoAnalise: visitasRows.filter((v) => v.resultado === "encaminhado_analise").length,
      };

      // ======================================================================
      // QUERY 5: Propostas enviadas no período
      // ======================================================================
      const propostasRows = await db
        .select({
          id: propostas.id,
          status: propostas.status,
          valorImovel: propostas.valorImovel,
        })
        .from(propostas)
        .where(
          and(
            eq(propostas.corretorId, targetCorretorId),
            gte(propostas.createdAt, inicio),
            lte(propostas.createdAt, fim)
          )
        );

      const propostasStats = {
        total: propostasRows.length,
        enviadas: propostasRows.filter((p) => p.status === "enviada").length,
        visualizadas: propostasRows.filter((p) => p.status === "visualizada").length,
        aceitas: propostasRows.filter((p) => p.status === "aceita").length,
        recusadas: propostasRows.filter((p) => p.status === "recusada").length,
      };

      // ======================================================================
      // QUERY 6: Contratos fechados no período
      // ======================================================================
      const contratosRows = await db
        .select({
          id: contratos.id,
          valorVenda: contratos.valorVenda,
          distrato: contratos.distrato,
        })
        .from(contratos)
        .where(
          and(
            eq(contratos.corretorId, targetCorretorId),
            gte(contratos.createdAt, inicio),
            lte(contratos.createdAt, fim),
            eq(contratos.distrato, false)
          )
        );

      const vgvTotal = contratosRows.reduce(
        (acc, c) => acc + (c.valorVenda ? parseFloat(String(c.valorVenda)) : 0),
        0
      );

      // ======================================================================
      // QUERY 7: Leads recebidos no período (novos leads atribuídos)
      // ======================================================================
      const [leadsRecebidosResult] = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM leads
        WHERE corretorId = ${targetCorretorId}
          AND dataDistribuicao >= ${inicio}
          AND dataDistribuicao <= ${fim}
      `);
      const leadsRecebidos = Number((leadsRecebidosResult as any[])[0]?.total || 0);

      // ======================================================================
      // QUERY 8: Avanços de status no período
      // ======================================================================
      const [avancoResult] = await db.execute(sql`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN statusNovo = 'agendado' THEN 1 ELSE 0 END) as paraAgendado,
          SUM(CASE WHEN statusNovo = 'visita_realizada' THEN 1 ELSE 0 END) as paraVisita,
          SUM(CASE WHEN statusNovo = 'analise_credito' THEN 1 ELSE 0 END) as paraAnalise,
          SUM(CASE WHEN statusNovo = 'contrato_fechado' THEN 1 ELSE 0 END) as paraContrato
        FROM lead_status_transitions
        WHERE corretorId = ${targetCorretorId}
          AND createdAt >= ${inicio}
          AND createdAt <= ${fim}
      `);
      const avancos = (avancoResult as any[])[0] || {};

      // ======================================================================
      // QUERY 9: Leads na carteira atual (por status)
      // ======================================================================
      const [carteiraResult] = await db.execute(sql`
        SELECT 
          status,
          COUNT(*) as total
        FROM leads
        WHERE corretorId = ${targetCorretorId}
          AND naLixeira = 0
        GROUP BY status
      `);
      const carteiraRows = carteiraResult as any[];
      const carteira: Record<string, number> = {};
      for (const row of carteiraRows) {
        carteira[row.status] = Number(row.total);
      }

      // ======================================================================
      // QUERY 10: Dados do corretor (para exibição)
      // ======================================================================
      const [corretorData] = await db
        .select({
          id: users.id,
          name: users.name,
          fotoUrl: users.fotoUrl,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, targetCorretorId))
        .limit(1);

      // ======================================================================
      // CALCULAR SCORE DE PRODUTIVIDADE (0-100)
      // ======================================================================
      const totalDias = Math.max(
        1,
        Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
      );

      const metaLigacoesPeriodo = metas.metaLigacoes * totalDias;
      const metaWhatsappPeriodo = metas.metaWhatsapp * totalDias;
      const metaAgendamentosPeriodo = metas.metaAgendamentos * totalDias;
      const metaVisitasPeriodo = metas.metaVisitas * totalDias;
      const metaVendasPeriodo = metas.metaVendas * totalDias;

      const scoreLigacoes = Math.min(100, metaLigacoesPeriodo > 0 ? (atividades.ligacoesRealizadas / metaLigacoesPeriodo) * 100 : 0);
      const scoreWhatsapp = Math.min(100, metaWhatsappPeriodo > 0 ? (atividades.whatsappEnviados / metaWhatsappPeriodo) * 100 : 0);
      const scoreAgendamentos = Math.min(100, metaAgendamentosPeriodo > 0 ? (agendamentosStats.total / metaAgendamentosPeriodo) * 100 : 0);
      const scoreVisitas = Math.min(100, metaVisitasPeriodo > 0 ? (visitasStats.total / metaVisitasPeriodo) * 100 : 0);
      const scoreVendas = Math.min(100, metaVendasPeriodo > 0 ? (contratosRows.length / metaVendasPeriodo) * 100 : 0);

      const scoreProdutividade = Math.round(
        scoreLigacoes * 0.2 +
          scoreWhatsapp * 0.2 +
          scoreAgendamentos * 0.2 +
          scoreVisitas * 0.2 +
          scoreVendas * 0.2
      );

      // ======================================================================
      // CHECKLIST DO DIA
      // ======================================================================
      const checklist = [
        { label: "Ligações realizadas (meta: " + metas.metaLigacoes + "/dia)", ok: atividades.ligacoesRealizadas >= metas.metaLigacoes },
        { label: "WhatsApp enviados (meta: " + metas.metaWhatsapp + "/dia)", ok: atividades.whatsappEnviados >= metas.metaWhatsapp },
        { label: "Agendamentos confirmados (meta: " + metas.metaAgendamentos + "/dia)", ok: agendamentosStats.total >= metas.metaAgendamentos },
        { label: "Visitas realizadas (meta: " + metas.metaVisitas + "/dia)", ok: visitasStats.total >= metas.metaVisitas },
        { label: "Proposta enviada", ok: propostasStats.total > 0 },
        { label: "Venda fechada", ok: contratosRows.length > 0 },
      ];

      return {
        corretor: corretorData || null,
        periodo: { inicio, fim, totalDias },
        atividades,
        metas: {
          ligacoes: metas.metaLigacoes,
          whatsapp: metas.metaWhatsapp,
          agendamentos: metas.metaAgendamentos,
          visitas: metas.metaVisitas,
          documentacoes: metas.metaDocumentacoes,
          vendas: metas.metaVendas,
        },
        agendamentos: agendamentosStats,
        visitas: visitasStats,
        propostas: propostasStats,
        contratos: {
          total: contratosRows.length,
          vgvTotal,
        },
        leadsRecebidos,
        avancos: {
          total: Number(avancos.total || 0),
          paraAgendado: Number(avancos.paraAgendado || 0),
          paraVisita: Number(avancos.paraVisita || 0),
          paraAnalise: Number(avancos.paraAnalise || 0),
          paraContrato: Number(avancos.paraContrato || 0),
        },
        carteira,
        scoreProdutividade,
        checklist,
      };
    }),

  // Relatório de leads por origem (canal de captação) — apenas gestores/admins
  leadsPorOrigem: protectedProcedure
    .input(
      z.object({
        inicio: z.date(),
        fim: z.date(),
        equipeId: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!isGestorLevel(ctx.user.role)) {
        throw new Error("Acesso negado");
      }
      const db = await getDb();
      const { inicio, fim } = input;

      // Leads por origem no período
      const [origemRows] = await db.execute(sql`
        SELECT
          COALESCE(origem, 'outro') AS origem,
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'contrato_fechado' THEN 1 ELSE 0 END) AS convertidos,
          SUM(CASE WHEN status IN ('perdido', 'descartado') THEN 1 ELSE 0 END) AS perdidos,
          SUM(CASE WHEN status = 'aguardando_atendimento' THEN 1 ELSE 0 END) AS aguardando
        FROM leads
        WHERE createdAt >= ${inicio}
          AND createdAt <= ${fim}
          AND naLixeira = 0
        GROUP BY origem
        ORDER BY total DESC
      `);

      // Leads por UTM source (campanhas pagas)
      const [utmRows] = await db.execute(sql`
        SELECT
          COALESCE(utmSource, 'organico') AS utmSource,
          COALESCE(utmCampaign, '') AS utmCampaign,
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'contrato_fechado' THEN 1 ELSE 0 END) AS convertidos
        FROM leads
        WHERE createdAt >= ${inicio}
          AND createdAt <= ${fim}
          AND naLixeira = 0
          AND utmSource IS NOT NULL
        GROUP BY utmSource, utmCampaign
        ORDER BY total DESC
        LIMIT 20
      `);

      // Evolução diária de leads por origem (últimos 30 dias)
      const [evolucaoRows] = await db.execute(sql`
        SELECT
          DATE(createdAt) AS dia,
          COALESCE(origem, 'outro') AS origem,
          COUNT(*) AS total
        FROM leads
        WHERE createdAt >= ${inicio}
          AND createdAt <= ${fim}
          AND naLixeira = 0
        GROUP BY dia, origem
        ORDER BY dia ASC
      `);

      return {
        porOrigem: (origemRows as any[]).map((r) => ({
          origem: r.origem as string,
          total: Number(r.total),
          convertidos: Number(r.convertidos),
          perdidos: Number(r.perdidos),
          aguardando: Number(r.aguardando),
          taxaConversao: r.total > 0 ? Math.round((Number(r.convertidos) / Number(r.total)) * 100) : 0,
        })),
        porUtm: (utmRows as any[]).map((r) => ({
          utmSource: r.utmSource as string,
          utmCampaign: r.utmCampaign as string,
          total: Number(r.total),
          convertidos: Number(r.convertidos),
          taxaConversao: r.total > 0 ? Math.round((Number(r.convertidos) / Number(r.total)) * 100) : 0,
        })),
        evolucao: (evolucaoRows as any[]).map((r) => ({
          dia: String(r.dia),
          origem: r.origem as string,
          total: Number(r.total),
        })),
      };
    }),

  // Logs de mensagens WhatsApp enviadas — apenas gestores/admins
  logsWhatsapp: protectedProcedure
    .input(
      z.object({
        inicio: z.date(),
        fim: z.date(),
        tipo: z.enum(["boas_vindas", "lembrete_agendamento", "followup_vencido", "manual"]).optional(),
        page: z.number().default(1),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!isGestorLevel(ctx.user.role)) {
        throw new Error("Acesso negado");
      }
      const db = await getDb();
      const { inicio, fim, tipo, page } = input;
      const limit = 50;
      const offset = (page - 1) * limit;

      const conditions = [
        gte(whatsappLogs.createdAt, inicio),
        lte(whatsappLogs.createdAt, fim),
      ];
      if (tipo) conditions.push(eq(whatsappLogs.tipo, tipo));

      const logs = await db
        .select({
          id: whatsappLogs.id,
          leadId: whatsappLogs.leadId,
          corretorId: whatsappLogs.corretorId,
          tipo: whatsappLogs.tipo,
          mensagem: whatsappLogs.mensagem,
          telefone: whatsappLogs.telefone,
          status: whatsappLogs.status,
          erroDetalhe: whatsappLogs.erroDetalhe,
          createdAt: whatsappLogs.createdAt,
          leadNome: leads.nome,
          corretorNome: users.name,
        })
        .from(whatsappLogs)
        .leftJoin(leads, eq(whatsappLogs.leadId, leads.id))
        .leftJoin(users, eq(whatsappLogs.corretorId, users.id))
        .where(and(...conditions))
        .orderBy(desc(whatsappLogs.createdAt))
        .limit(limit)
        .offset(offset);

      // Resumo por tipo e status
      const [resumoRows] = await db.execute(sql`
        SELECT tipo, status, COUNT(*) AS total
        FROM whatsapp_logs
        WHERE createdAt >= ${inicio} AND createdAt <= ${fim}
        GROUP BY tipo, status
      `);

      return {
        logs,
        resumo: (resumoRows as any[]).map((r) => ({
          tipo: r.tipo as string,
          status: r.status as string,
          total: Number(r.total),
        })),
        page,
        hasMore: logs.length === limit,
      };
    }),

  // Lista corretores disponíveis para filtro (apenas para gestores/admins)
  listarCorretores: protectedProcedure.query(async ({ ctx }) => {
    if (!isGestorLevel(ctx.user.role)) {
      return [];
    }
    const db = await getDb();
    const corretores = await db
      .select({
        id: users.id,
        name: users.name,
        fotoUrl: users.fotoUrl,
        role: users.role,
        status: users.status,
      })
      .from(users)
      .where(
        and(
          eq(users.situacao, "ativo"),
          sql`${users.role} IN ('corretor', 'gestor')`
        )
      )
      .orderBy(users.name);

    return corretores;
  }),
});
