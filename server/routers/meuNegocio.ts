import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { meuNegocioParametros, preAnalisesMcmv, leads, followUps } from "../../drizzle/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

// ============================================================================
// HELPERS
// ============================================================================

function inicioDoMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function fimDoMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function inicioDeHoje() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function fimDeHoje() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

const STATUS_LABELS: Record<string, string> = {
  aguardando_atendimento: "Aguardando",
  em_atendimento: "Em Atendimento",
  agendado: "Agendado",
  visita_realizada: "Visita Realizada",
  proposta_enviada: "Proposta Enviada",
  analise_credito: "Análise de Crédito",
  contrato_assinado: "Contrato Assinado",
  perdido: "Perdido",
};

// ============================================================================
// ROUTER
// ============================================================================

export const meuNegocioRouter = router({

  // --------------------------------------------------------------------------
  // PARÂMETROS PESSOAIS
  // --------------------------------------------------------------------------

  getParametros: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const [existing] = await db
      .select()
      .from(meuNegocioParametros)
      .where(eq(meuNegocioParametros.corretorId, ctx.user.id))
      .limit(1);

    if (existing) return existing;

    // Criar com defaults
    await db.insert(meuNegocioParametros).values({
      corretorId: ctx.user.id,
    });
    const [created] = await db
      .select()
      .from(meuNegocioParametros)
      .where(eq(meuNegocioParametros.corretorId, ctx.user.id))
      .limit(1);
    return created;
  }),

  salvarParametros: protectedProcedure
    .input(z.object({
      ticketMedio: z.number().positive(),
      comissaoPct: z.number().min(0).max(100),
      metaReceitaMes: z.number().positive(),
      taxaLeadAgendamento: z.number().min(0).max(100),
      taxaAgendamentoVisita: z.number().min(0).max(100),
      taxaVisitaProposta: z.number().min(0).max(100),
      taxaPropostaVenda: z.number().min(0).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      // Converter percentuais de 0-100 para 0-1 antes de salvar
      const toDecimal = (v: number) => v > 1 ? v / 100 : v;
      const data = {
        ...input,
        comissaoPct: toDecimal(input.comissaoPct),
        taxaLeadAgendamento: toDecimal(input.taxaLeadAgendamento),
        taxaAgendamentoVisita: toDecimal(input.taxaAgendamentoVisita),
        taxaVisitaProposta: toDecimal(input.taxaVisitaProposta),
        taxaPropostaVenda: toDecimal(input.taxaPropostaVenda),
      };
      await db
        .insert(meuNegocioParametros)
        .values({ corretorId: ctx.user.id, ...data })
        .onDuplicateKeyUpdate({ set: data });
      return { ok: true };
    }),

  // --------------------------------------------------------------------------
  // RESULTADOS DO MÊS
  // --------------------------------------------------------------------------

  getResultadosMes: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const inicio = inicioDoMes();
    const fim = fimDoMes();

    const [leadsRecebidos] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(leads)
      .where(and(
        eq(leads.corretorId, ctx.user.id),
        gte(leads.createdAt, inicio),
        lte(leads.createdAt, fim),
      ));

    const [agendamentos] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(leads)
      .where(and(
        eq(leads.corretorId, ctx.user.id),
        gte(leads.updatedAt, inicio),
        lte(leads.updatedAt, fim),
        eq(leads.status, "agendado"),
      ));

    const [visitas] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(leads)
      .where(and(
        eq(leads.corretorId, ctx.user.id),
        gte(leads.updatedAt, inicio),
        lte(leads.updatedAt, fim),
        eq(leads.status, "visita_realizada"),
      ));

    const [propostas] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(leads)
      .where(and(
        eq(leads.corretorId, ctx.user.id),
        gte(leads.updatedAt, inicio),
        lte(leads.updatedAt, fim),
        eq(leads.status, "proposta_enviada"),
      ));

    const [vendas] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(leads)
      .where(and(
        eq(leads.corretorId, ctx.user.id),
        gte(leads.updatedAt, inicio),
        lte(leads.updatedAt, fim),
        eq(leads.status, "contrato_fechado"),
      ));

    const [params] = await db
      .select()
      .from(meuNegocioParametros)
      .where(eq(meuNegocioParametros.corretorId, ctx.user.id))
      .limit(1);

    const vendasCount = Number(vendas?.count ?? 0);
    const ticketMedio = Number(params?.ticketMedio ?? 275000);
    const comissaoPct = Number(params?.comissaoPct ?? 0.017);
    const receita = vendasCount * ticketMedio * comissaoPct;

    return {
      leadsRecebidos: Number(leadsRecebidos?.count ?? 0),
      agendamentos: Number(agendamentos?.count ?? 0),
      visitas: Number(visitas?.count ?? 0),
      propostas: Number(propostas?.count ?? 0),
      vendas: vendasCount,
      receita,
    };
  }),

  // --------------------------------------------------------------------------
  // ALERTAS DO DIA
  // --------------------------------------------------------------------------

  getAlertasDia: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const alertas: Array<{
      tipo: "urgente" | "atencao" | "info";
      titulo: string;
      descricao: string;
      badge?: string;
    }> = [];

    const [aguardandoUrgente] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(leads)
      .where(and(
        eq(leads.corretorId, ctx.user.id),
        eq(leads.status, "aguardando_atendimento"),
        lte(leads.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
      ));

    if (Number(aguardandoUrgente?.count ?? 0) > 0) {
      alertas.push({
        tipo: "urgente",
        titulo: "Leads aguardando atendimento",
        descricao: `${aguardandoUrgente.count} lead(s) aguardando há mais de 1 hora sem contato`,
        badge: String(aguardandoUrgente.count),
      });
    }

    const [agendamentosHoje] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(leads)
      .where(and(
        eq(leads.corretorId, ctx.user.id),
        eq(leads.status, "agendado"),
        gte(leads.updatedAt, inicioDeHoje()),
        lte(leads.updatedAt, fimDeHoje()),
      ));

    if (Number(agendamentosHoje?.count ?? 0) > 0) {
      alertas.push({
        tipo: "info",
        titulo: "Visitas agendadas para hoje",
        descricao: `Você tem ${agendamentosHoje.count} visita(s) agendada(s) para hoje`,
        badge: String(agendamentosHoje.count),
      });
    }

    const [analiseParada] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(leads)
      .where(and(
        eq(leads.corretorId, ctx.user.id),
        eq(leads.status, "analise_credito"),
        lte(leads.updatedAt, new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)),
      ));

    if (Number(analiseParada?.count ?? 0) > 0) {
      alertas.push({
        tipo: "atencao",
        titulo: "Análises de crédito paradas",
        descricao: `${analiseParada.count} lead(s) em análise de crédito sem atualização há 3+ dias`,
        badge: String(analiseParada.count),
      });
    }

    const [propostaSemResposta] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(leads)
      .where(and(
        eq(leads.corretorId, ctx.user.id),
        eq(leads.status, "proposta_enviada"),
        lte(leads.updatedAt, new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
      ));

    if (Number(propostaSemResposta?.count ?? 0) > 0) {
      alertas.push({
        tipo: "atencao",
        titulo: "Propostas sem resposta",
        descricao: `${propostaSemResposta.count} proposta(s) enviada(s) há 2+ dias sem retorno do cliente`,
        badge: String(propostaSemResposta.count),
      });
    }

    return alertas;
  }),

  // --------------------------------------------------------------------------
  // FOLLOW-UP DO DIA
  // --------------------------------------------------------------------------

  getLeadsFollowUp: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();

    const leadsParaFollowUp = await db
      .select({
        id: leads.id,
        nome: leads.nome,
        telefone: leads.telefone,
        status: leads.status,
        tentativas: leads.diasFollowupConsecutivos,
        ultimoContato: leads.ultimoContato,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(and(
        eq(leads.corretorId, ctx.user.id),
        eq(leads.status, "em_atendimento"),
        eq(leads.naLixeira, false),
      ))
      .orderBy(leads.ultimoContato)
      .limit(50);

    const hoje = inicioDeHoje();
    const filtered = leadsParaFollowUp.filter((l) => {
      if (!l.ultimoContato) return true;
      return new Date(l.ultimoContato) < hoje;
    });

    const agoraHoras = new Date().getHours();
    return filtered.map((l) => ({
      ...l,
      statusLabel: STATUS_LABELS[l.status] ?? l.status,
      alertaDescarte: agoraHoras >= 9 && Number(l.tentativas ?? 0) >= 4,
    }));
  }),

  registrarFollowUp: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      respondeu: z.boolean(),
      observacao: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [lead] = await db
        .select()
        .from(leads)
        .where(and(eq(leads.id, input.leadId), eq(leads.corretorId, ctx.user.id)))
        .limit(1);

      if (!lead) throw new Error("Lead não encontrado");

      const agora = new Date();
      const novasTentativas = input.respondeu ? 0 : (Number(lead.diasFollowupConsecutivos ?? 0) + 1);

      await db
        .update(leads)
        .set({
          ultimoContato: agora,
          diasFollowupConsecutivos: novasTentativas,
          ultimaInteracao: agora,
          updatedAt: agora,
        })
        .where(eq(leads.id, input.leadId));

      await db.insert(followUps).values({
        leadId: input.leadId,
        corretorId: ctx.user.id,
        dataFollowUp: agora,
        dataRegistro: agora,
        resultado: input.respondeu ? "respondeu" : "nao_respondeu",
        observacao: input.observacao ?? null,
        status: "concluido",
      });

      return { ok: true, novasTentativas };
    }),

  // --------------------------------------------------------------------------
  // PRÉ-ANÁLISES MCMV
  // --------------------------------------------------------------------------

  salvarPreAnalise: protectedProcedure
    .input(z.object({
      nomeCliente: z.string().min(1),
      rendaFamiliar: z.number().positive(),
      tipoVinculo: z.string(),
      saldoFgts: z.number().min(0),
      valorImovel: z.number().positive(),
      prazoMeses: z.number().min(60).max(420),
      possuiRestricao: z.boolean(),
      jaBeneficiarioMcmv: z.boolean(),
      possuiImovelNome: z.boolean(),
      faixaMcmv: z.string().nullable(),
      subsidioEstimado: z.number().nullable(),
      valorFinanciavel: z.number().nullable(),
      parcelaEstimada: z.number().nullable(),
      comprometimentoPct: z.number().nullable(),
      dentroLimite30pct: z.boolean().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      await db.insert(preAnalisesMcmv).values({
        corretorId: ctx.user.id,
        ...input,
      });
      return { ok: true };
    }),

  listarPreAnalises: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    return await db
      .select()
      .from(preAnalisesMcmv)
      .where(eq(preAnalisesMcmv.corretorId, ctx.user.id))
      .orderBy(desc(preAnalisesMcmv.createdAt))
      .limit(50);
  }),

  deletarPreAnalise: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      await db
        .delete(preAnalisesMcmv)
        .where(and(
          eq(preAnalisesMcmv.id, input.id),
          eq(preAnalisesMcmv.corretorId, ctx.user.id),
        ));
      return { ok: true };
    }),
});
