/**
 * Módulo de Limpeza de Leads Duplicados
 * 
 * Identifica e mescla leads duplicados criados durante período de importação em massa
 * Preserva histórico completo: agendamentos, follow-ups, observações, interações
 */

import { getDb } from "./db";
import { leads, agendamentos, followUps } from "../drizzle/schema";
import { sql, eq, inArray } from "drizzle-orm";

interface LeadDuplicado {
  id: number;
  idPrincipal: string;
  nome: string;
  email: string | null;
  telefone: string;
  origem: string;
  status: string;
  corretorId: number | null;
  projectId: number | null;
  projetoCustom: string | null;
  dataDistribuicao: Date | null;
  observacoes: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Contadores de histórico
  totalAgendamentos: number;
  totalFollowUps: number;
}

interface GrupoDuplicatas {
  criterio: "telefone" | "email";
  valor: string;
  leads: LeadDuplicado[];
  totalLeads: number;
}

/**
 * Normaliza telefone para comparação (apenas números)
 */
function normalizeTelefone(telefone: string): string {
  return telefone.replace(/\D/g, "");
}

/**
 * Identifica grupos de leads duplicados por telefone
 */
export async function identificarDuplicatasPorTelefone(): Promise<GrupoDuplicatas[]> {
  const db = await getDb();
  if (!db) throw new Error("Database não disponível");

  // Buscar telefones que aparecem mais de uma vez
  const duplicates = await db
    .select({
      telefoneNormalizado: sql<string>`REGEXP_REPLACE(${leads.telefone}, '[^0-9]', '')`,
      count: sql<number>`COUNT(*)`.as("count"),
    })
    .from(leads)
    .where(sql`${leads.naLixeira} = 0`)
    .groupBy(sql`REGEXP_REPLACE(${leads.telefone}, '[^0-9]', '')`)
    .having(sql`COUNT(*) > 1`);

  const grupos: GrupoDuplicatas[] = [];

  for (const dup of duplicates) {
    // Buscar todos os leads com este telefone
    const leadsComTelefone = await db
      .select()
      .from(leads)
      .where(
        sql`REGEXP_REPLACE(${leads.telefone}, '[^0-9]', '') = ${dup.telefoneNormalizado} AND ${leads.naLixeira} = 0`
      );

    if (leadsComTelefone.length > 1) {
      // Contar agendamentos e follow-ups para cada lead
      const leadsComHistorico: LeadDuplicado[] = [];
      
      for (const lead of leadsComTelefone) {
        const [agendamentosCount] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(agendamentos)
          .where(eq(agendamentos.leadId, lead.id));

        const [followUpsCount] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(followUps)
          .where(eq(followUps.leadId, lead.id));

        leadsComHistorico.push({
          ...lead,
          totalAgendamentos: Number(agendamentosCount.count) || 0,
          totalFollowUps: Number(followUpsCount.count) || 0,
        });
      }

      grupos.push({
        criterio: "telefone",
        valor: leadsComTelefone[0].telefone,
        leads: leadsComHistorico,
        totalLeads: leadsComHistorico.length,
      });
    }
  }

  return grupos;
}

/**
 * Identifica grupos de leads duplicados por email
 */
export async function identificarDuplicatasPorEmail(): Promise<GrupoDuplicatas[]> {
  const db = await getDb();
  if (!db) throw new Error("Database não disponível");

  // Buscar emails que aparecem mais de uma vez (ignorar nulls)
  const duplicates = await db
    .select({
      email: leads.email,
      count: sql<number>`COUNT(*)`.as("count"),
    })
    .from(leads)
    .where(sql`${leads.email} IS NOT NULL AND ${leads.email} != '' AND ${leads.naLixeira} = 0`)
    .groupBy(leads.email)
    .having(sql`COUNT(*) > 1`);

  const grupos: GrupoDuplicatas[] = [];

  for (const dup of duplicates) {
    if (!dup.email) continue;

    // Buscar todos os leads com este email
    const leadsComEmail = await db
      .select()
      .from(leads)
      .where(sql`${leads.email} = ${dup.email} AND ${leads.naLixeira} = 0`);

    if (leadsComEmail.length > 1) {
      // Contar agendamentos e follow-ups para cada lead
      const leadsComHistorico: LeadDuplicado[] = [];
      
      for (const lead of leadsComEmail) {
        const [agendamentosCount] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(agendamentos)
          .where(eq(agendamentos.leadId, lead.id));

        const [followUpsCount] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(followUps)
          .where(eq(followUps.leadId, lead.id));

        leadsComHistorico.push({
          ...lead,
          totalAgendamentos: Number(agendamentosCount.count) || 0,
          totalFollowUps: Number(followUpsCount.count) || 0,
        });
      }

      grupos.push({
        criterio: "email",
        valor: dup.email,
        leads: leadsComHistorico,
        totalLeads: leadsComHistorico.length,
      });
    }
  }

  return grupos;
}

/**
 * Mescla um grupo de leads duplicados mantendo o lead principal
 * e transferindo todo o histórico dos duplicados para ele
 */
export async function mesclarLeadsDuplicados(
  leadPrincipalId: number,
  leadsDuplicadosIds: number[]
): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database não disponível");

  try {
    // Verificar se lead principal existe
    const [leadPrincipal] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadPrincipalId));

    if (!leadPrincipal) {
      return { success: false, message: "Lead principal não encontrado" };
    }

    // Transferir agendamentos dos duplicados para o principal
    if (leadsDuplicadosIds.length > 0) {
      await db
        .update(agendamentos)
        .set({ leadId: leadPrincipalId })
        .where(inArray(agendamentos.leadId, leadsDuplicadosIds));

      // Transferir follow-ups dos duplicados para o principal
      await db
        .update(followUps)
        .set({ leadId: leadPrincipalId })
        .where(inArray(followUps.leadId, leadsDuplicadosIds));

      // Mesclar observações (concatenar)
      const leadsDuplicados = await db
        .select()
        .from(leads)
        .where(inArray(leads.id, leadsDuplicadosIds));

      const observacoesExtras = leadsDuplicados
        .filter(l => l.observacoes && l.observacoes.trim() !== "")
        .map(l => `[Mesclado de lead ${l.id}]: ${l.observacoes}`)
        .join("\n\n");

      if (observacoesExtras) {
        const observacoesAtuais = leadPrincipal.observacoes || "";
        const novasObservacoes = observacoesAtuais
          ? `${observacoesAtuais}\n\n${observacoesExtras}`
          : observacoesExtras;

        await db
          .update(leads)
          .set({ observacoes: novasObservacoes })
          .where(eq(leads.id, leadPrincipalId));
      }

      // Mover leads duplicados para lixeira (soft delete)
      await db
        .update(leads)
        .set({
          naLixeira: true,
          dataMovidoLixeira: new Date(),
        })
        .where(inArray(leads.id, leadsDuplicadosIds));
    }

    return {
      success: true,
      message: `Lead ${leadPrincipalId} mesclado com sucesso. ${leadsDuplicadosIds.length} duplicatas movidas para lixeira.`,
    };
  } catch (error: any) {
    console.error("Erro ao mesclar leads:", error);
    return {
      success: false,
      message: `Erro ao mesclar leads: ${error.message}`,
    };
  }
}

/**
 * Retorna estatísticas de duplicatas no sistema
 */
export async function getEstatisticasDuplicatas(): Promise<{
  totalGruposTelefone: number;
  totalGruposEmail: number;
  totalLeadsDuplicados: number;
}> {
  const gruposTelefone = await identificarDuplicatasPorTelefone();
  const gruposEmail = await identificarDuplicatasPorEmail();

  const totalLeadsDuplicados =
    gruposTelefone.reduce((sum, g) => sum + g.totalLeads, 0) +
    gruposEmail.reduce((sum, g) => sum + g.totalLeads, 0);

  return {
    totalGruposTelefone: gruposTelefone.length,
    totalGruposEmail: gruposEmail.length,
    totalLeadsDuplicados,
  };
}
