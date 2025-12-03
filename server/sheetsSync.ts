import { getDb } from "./db";
import { leads, users, distributionLog } from "../drizzle/schema";
import { eq, and, sql, isNull } from "drizzle-orm";

/**
 * Interface para configuração de sincronização
 */
export interface SheetsSyncConfig {
  sheetUrl: string;
  sheetName: string;
  enableAutoSync: boolean;
  syncInterval: number; // em minutos
}

/**
 * Atualiza o status de um lead na planilha do Google Sheets
 * 
 * NOTA: Esta é uma implementação placeholder que simula a atualização.
 * Para implementação real, seria necessário:
 * 1. Usar Google Sheets API com autenticação OAuth2
 * 2. Encontrar a linha do lead na planilha (por telefone ou ID)
 * 3. Atualizar as colunas de status, corretor e data de distribuição
 * 
 * Exemplo de implementação real:
 * - Usar biblioteca `googleapis` do npm
 * - Autenticar com service account ou OAuth2
 * - Usar sheets.spreadsheets.values.update() para atualizar células
 */
export async function atualizarLeadNaPlanilha(
  leadId: number,
  sheetUrl: string,
  sheetName: string = "Leads"
): Promise<{ success: boolean; message: string }> {
  try {
    const db = await getDb();
    if (!db) {
      return { success: false, message: "Database não disponível" };
    }

    // Buscar dados do lead
    const lead = await db
      .select({
        id: leads.id,
        nome: leads.nome,
        telefone: leads.telefone,
        status: leads.status,
        corretorId: leads.corretorId,
        dataDistribuicao: leads.dataDistribuicao,
      })
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (lead.length === 0) {
      return { success: false, message: "Lead não encontrado" };
    }

    const leadData = lead[0];

    // Buscar dados do corretor se houver
    let corretorNome = "";
    if (leadData.corretorId) {
      const corretor = await db
        .select()
        .from(users)
        .where(eq(users.id, leadData.corretorId))
        .limit(1);

      if (corretor.length > 0) {
        corretorNome = corretor[0].name || "";
      }
    }

    // TODO: Implementar atualização real na planilha usando Google Sheets API
    // Por enquanto, apenas registrar no log
    console.log(`[Sheets Sync] Atualizando lead ${leadData.nome} na planilha:`, {
      telefone: leadData.telefone,
      status: leadData.status,
      corretor: corretorNome,
      dataDistribuicao: leadData.dataDistribuicao,
    });

    // Simular sucesso
    return {
      success: true,
      message: `Lead ${leadData.nome} atualizado na planilha (simulado)`,
    };
  } catch (error) {
    console.error("[Sheets Sync] Erro ao atualizar lead na planilha:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Registra a distribuição de um lead no histórico da planilha
 * 
 * NOTA: Esta é uma implementação placeholder.
 * Para implementação real, seria necessário:
 * 1. Adicionar uma nova linha na aba "Histórico" da planilha
 * 2. Incluir: data, lead, corretor, status anterior, status novo
 */
export async function registrarDistribuicaoNaPlanilha(
  leadId: number,
  corretorId: number,
  sheetUrl: string,
  sheetName: string = "Histórico"
): Promise<{ success: boolean; message: string }> {
  try {
    const db = await getDb();
    if (!db) {
      return { success: false, message: "Database não disponível" };
    }

    // Buscar dados do lead e corretor
    const lead = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    const corretor = await db
      .select()
      .from(users)
      .where(eq(users.id, corretorId))
      .limit(1);

    if (lead.length === 0 || corretor.length === 0) {
      return { success: false, message: "Lead ou corretor não encontrado" };
    }

    const leadData = lead[0];
    const corretorData = corretor[0];

    // TODO: Implementar registro real no histórico da planilha
    console.log(`[Sheets Sync] Registrando distribuição no histórico:`, {
      data: new Date().toISOString(),
      lead: leadData.nome,
      telefone: leadData.telefone,
      corretor: corretorData.name,
      statusAnterior: "novo",
      statusNovo: leadData.status,
    });

    return {
      success: true,
      message: `Distribuição registrada no histórico (simulado)`,
    };
  } catch (error) {
    console.error("[Sheets Sync] Erro ao registrar no histórico:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Sincroniza todos os leads distribuídos recentemente com a planilha
 * "Recentemente" = últimas 24 horas
 */
export async function sincronizarLeadsDistribuidos(
  sheetUrl: string,
  sheetName: string = "Leads"
): Promise<{
  success: number;
  failed: number;
  details: Array<{ leadId: number; leadNome: string; success: boolean; message: string }>;
}> {
  const db = await getDb();
  if (!db) {
    return { success: 0, failed: 0, details: [] };
  }

  // Buscar leads distribuídos nas últimas 24 horas
  const umDiaAtras = new Date();
  umDiaAtras.setDate(umDiaAtras.getDate() - 1);

  const leadsRecentes = await db
    .select()
    .from(leads)
    .where(
      and(
        sql`${leads.corretorId} IS NOT NULL`,
        sql`${leads.dataDistribuicao} >= ${umDiaAtras}`
      )
    );

  const details: Array<{ leadId: number; leadNome: string; success: boolean; message: string }> = [];
  let success = 0;
  let failed = 0;

  for (const lead of leadsRecentes) {
    const resultado = await atualizarLeadNaPlanilha(lead.id, sheetUrl, sheetName);

    details.push({
      leadId: lead.id,
      leadNome: lead.nome,
      success: resultado.success,
      message: resultado.message,
    });

    if (resultado.success) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed, details };
}

/**
 * Marca um lead como "Distribuído" na planilha central
 * 
 * NOTA: Esta é uma implementação placeholder.
 * Para implementação real, seria necessário:
 * 1. Encontrar a linha do lead na planilha central
 * 2. Atualizar a coluna "Status" para "Distribuído"
 * 3. Adicionar data e corretor nas colunas correspondentes
 */
export async function marcarComoDistribuidoNaPlanilha(
  leadId: number,
  sheetUrl: string,
  sheetName: string = "Leads"
): Promise<{ success: boolean; message: string }> {
  try {
    const db = await getDb();
    if (!db) {
      return { success: false, message: "Database não disponível" };
    }

    const lead = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (lead.length === 0) {
      return { success: false, message: "Lead não encontrado" };
    }

    const leadData = lead[0];

    // TODO: Implementar marcação real na planilha
    console.log(`[Sheets Sync] Marcando lead como distribuído:`, {
      telefone: leadData.telefone,
      nome: leadData.nome,
      status: "Distribuído",
    });

    return {
      success: true,
      message: `Lead marcado como distribuído (simulado)`,
    };
  } catch (error) {
    console.error("[Sheets Sync] Erro ao marcar como distribuído:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Job de sincronização automática com Google Sheets
 * Executa periodicamente para manter a planilha atualizada
 */
export async function executarSincronizacaoAutomatica(
  config: SheetsSyncConfig
): Promise<{
  success: boolean;
  leadsAtualizados: number;
  erros: number;
}> {
  console.log("[Job] Iniciando sincronização automática com Google Sheets...");

  try {
    const resultado = await sincronizarLeadsDistribuidos(
      config.sheetUrl,
      config.sheetName
    );

    console.log(
      `[Job] Sincronização concluída: ${resultado.success} sucesso, ${resultado.failed} erros`
    );

    return {
      success: true,
      leadsAtualizados: resultado.success,
      erros: resultado.failed,
    };
  } catch (error) {
    console.error("[Job] Erro na sincronização automática:", error);
    return {
      success: false,
      leadsAtualizados: 0,
      erros: 1,
    };
  }
}

/**
 * Agenda job de sincronização automática
 * 
 * NOTA: Por padrão, a sincronização está DESABILITADA.
 * Para habilitar, configure enableAutoSync = true nas configurações do sistema.
 */
export function agendarSincronizacaoAutomatica(config: SheetsSyncConfig) {
  if (!config.enableAutoSync) {
    console.log("[Job] Sincronização automática com Google Sheets DESABILITADA");
    return;
  }

  const intervalMs = config.syncInterval * 60 * 1000; // Converter minutos para ms

  // Executar primeira sincronização após 2 minutos
  setTimeout(() => {
    console.log("[Job] Executando primeira sincronização com Google Sheets...");
    executarSincronizacaoAutomatica(config).catch(console.error);
  }, 120000);

  // Executar sincronizações periódicas
  setInterval(() => {
    console.log("[Job] Executando sincronização periódica com Google Sheets...");
    executarSincronizacaoAutomatica(config).catch(console.error);
  }, intervalMs);

  console.log(
    `[Job] Sincronização automática com Google Sheets agendada (intervalo: ${config.syncInterval} minutos)`
  );
}
