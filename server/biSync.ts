import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";
import * as path from "path";
import { getDb } from "./db";
import { contratos, leads, users, projects } from "../drizzle/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

/**
 * Módulo de Sincronização Completa com Google Sheets para BI
 * Sincroniza Leads, Contratos, Métricas Diárias e Performance de Corretores
 * Preparado para integração com Power BI, Looker Studio e outras ferramentas
 */

// Usar a mesma planilha que já existe para leads
const SPREADSHEET_ID = "1or0l4OToJUsGW8FpyGjSOovjc27riV4Wmi0YWQze8X8";

// Nomes das abas
const SHEET_LEADS = "Leads"; // Aba já existente
const SHEET_CONTRATOS = "Contratos";
const SHEET_METRICAS = "Métricas Diárias";
const SHEET_PERFORMANCE = "Performance Corretores";

// Caminho do arquivo de credenciais
const CREDENTIALS_PATH = path.resolve(process.cwd(), "server/google-service-account.json");

/**
 * Obtém cliente autenticado do Google Sheets
 */
async function getAuthenticatedClient() {
  const auth = new GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const authClient = await auth.getClient();
  return google.sheets({ version: "v4", auth: authClient as any });
}

/**
 * Formata data para exibição na planilha
 */
function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

/**
 * Formata data apenas (sem hora)
 */
function formatDateOnly(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

/**
 * Formata valor monetário
 */
function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Inicializa aba de Contratos com headers
 */
async function initContratosSheet() {
  try {
    const sheets = await getAuthenticatedClient();

    // Verificar se a aba já existe
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const sheetExists = response.data.sheets?.some(
      (sheet) => sheet.properties?.title === SHEET_CONTRATOS
    );

    if (!sheetExists) {
      // Criar aba
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: SHEET_CONTRATOS,
                },
              },
            },
          ],
        },
      });
    }

    // Adicionar headers
    const headers = [
      "ID Contrato",
      "Data Venda",
      "Corretor",
      "Cliente",
      "Telefone Cliente",
      "Email Cliente",
      "Projeto",
      "VGV (R$)",
      "Observações",
      "Quantidade Anexos",
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_CONTRATOS}!A1:J1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [headers],
      },
    });

    console.log("[BI Sync] Aba Contratos inicializada");
  } catch (error: any) {
    console.error("[BI Sync] Erro ao inicializar aba Contratos:", error.message);
    throw error;
  }
}

/**
 * Inicializa aba de Métricas Diárias com headers
 */
async function initMetricasSheet() {
  try {
    const sheets = await getAuthenticatedClient();

    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const sheetExists = response.data.sheets?.some(
      (sheet) => sheet.properties?.title === SHEET_METRICAS
    );

    if (!sheetExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: SHEET_METRICAS,
                },
              },
            },
          ],
        },
      });
    }

    const headers = [
      "Data",
      "Total Leads",
      "Leads Novos",
      "Agendamentos",
      "Visitas Realizadas",
      "Análises de Crédito",
      "Contratos Fechados",
      "VGV Total (R$)",
      "Taxa Conversão Agendamento (%)",
      "Taxa Conversão Visita (%)",
      "Taxa Conversão Contrato (%)",
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_METRICAS}!A1:K1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [headers],
      },
    });

    console.log("[BI Sync] Aba Métricas Diárias inicializada");
  } catch (error: any) {
    console.error("[BI Sync] Erro ao inicializar aba Métricas:", error.message);
    throw error;
  }
}

/**
 * Inicializa aba de Performance Corretores com headers
 */
async function initPerformanceSheet() {
  try {
    const sheets = await getAuthenticatedClient();

    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const sheetExists = response.data.sheets?.some(
      (sheet) => sheet.properties?.title === SHEET_PERFORMANCE
    );

    if (!sheetExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: SHEET_PERFORMANCE,
                },
              },
            },
          ],
        },
      });
    }

    const headers = [
      "Corretor",
      "Email",
      "Equipe",
      "Total Leads",
      "Leads Ativos",
      "Agendamentos",
      "Visitas Realizadas",
      "Análises de Crédito",
      "Contratos Fechados",
      "VGV Total (R$)",
      "Ticket Médio (R$)",
      "Taxa Conversão (%)",
      "Última Atualização",
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_PERFORMANCE}!A1:M1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [headers],
      },
    });

    console.log("[BI Sync] Aba Performance Corretores inicializada");
  } catch (error: any) {
    console.error("[BI Sync] Erro ao inicializar aba Performance:", error.message);
    throw error;
  }
}

/**
 * Sincroniza todos os contratos para o Google Sheets
 */
export async function syncContratos(): Promise<{ success: number; errors: number }> {
  try {
    console.log("[BI Sync] Iniciando sincronização de contratos...");

    await initContratosSheet();

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Buscar todos os contratos com dados relacionados
    const allContratos = await db
      .select({
        id: contratos.id,
        dataVenda: contratos.createdAt,
        valorVenda: contratos.valorVenda,
        observacoes: contratos.observacoes,
        anexos: contratos.anexos,
        corretorNome: users.name,
        clienteNome: leads.nome,
        clienteTelefone: leads.telefone,
        clienteEmail: leads.email,
        projectId: leads.projectId,
        projetoCustom: leads.projetoCustom,
      })
      .from(contratos)
      .innerJoin(users, eq(contratos.corretorId, users.id))
      .innerJoin(leads, eq(contratos.leadId, leads.id))
      .orderBy(desc(contratos.createdAt));

    // Buscar nomes dos projetos
    const projectIds = [...new Set(allContratos.filter(c => c.projectId).map(c => c.projectId!))];
    let projectsMap = new Map<number, string>();

    if (projectIds.length > 0) {
      const projectsData = await db
        .select({ id: projects.id, nome: projects.nome })
        .from(projects)
        .where(sql`${projects.id} IN (${sql.join(projectIds.map(id => sql`${id}`), sql`, `)})`);

      projectsMap = new Map(projectsData.map(p => [p.id, p.nome]));
    }

    // Preparar dados para a planilha
    const rows = allContratos.map((contrato) => {
      const projetoNome = contrato.projectId
        ? projectsMap.get(contrato.projectId) || "Projeto removido"
        : contrato.projetoCustom || "Não informado";

      const anexosCount = Array.isArray(contrato.anexos) ? contrato.anexos.length : 0;

      return [
        contrato.id.toString(),
        formatDate(contrato.dataVenda),
        contrato.corretorNome || "",
        contrato.clienteNome || "",
        contrato.clienteTelefone || "",
        contrato.clienteEmail || "",
        projetoNome,
        contrato.valorVenda?.toString() || "0",
        contrato.observacoes || "",
        anexosCount.toString(),
      ];
    });

    // Limpar dados existentes (exceto header)
    const sheets = await getAuthenticatedClient();
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_CONTRATOS}!A2:J`,
    });

    // Adicionar novos dados
    if (rows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_CONTRATOS}!A2:J${rows.length + 1}`,
        valueInputOption: "RAW",
        requestBody: {
          values: rows,
        },
      });
    }

    console.log(`[BI Sync] ${rows.length} contratos sincronizados`);
    return { success: rows.length, errors: 0 };
  } catch (error: any) {
    console.error("[BI Sync] Erro ao sincronizar contratos:", error.message);
    return { success: 0, errors: 1 };
  }
}

/**
 * Sincroniza métricas diárias para o Google Sheets
 */
export async function syncMetricasDiarias(dias: number = 90): Promise<{ success: number; errors: number }> {
  try {
    console.log("[BI Sync] Iniciando sincronização de métricas diárias...");

    await initMetricasSheet();

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - dias);

    // Agregar métricas por dia
    const metricas: any[] = [];
    
    for (let i = 0; i < dias; i++) {
      const data = new Date();
      data.setDate(data.getDate() - i);
      data.setHours(0, 0, 0, 0);

      const dataFim = new Date(data);
      dataFim.setHours(23, 59, 59, 999);

      // Total de leads até esta data
      const totalLeads = await db
        .select({ count: sql<number>`count(*)` })
        .from(leads)
        .where(lte(leads.createdAt, dataFim));

      // Leads criados neste dia
      const leadsNovos = await db
        .select({ count: sql<number>`count(*)` })
        .from(leads)
        .where(and(gte(leads.createdAt, data), lte(leads.createdAt, dataFim)));

      // Agendamentos
      const agendamentos = await db
        .select({ count: sql<number>`count(*)` })
        .from(leads)
        .where(
          and(
            eq(leads.status, "agendado"),
            gte(leads.updatedAt, data),
            lte(leads.updatedAt, dataFim)
          )
        );

      // Visitas realizadas
      const visitas = await db
        .select({ count: sql<number>`count(*)` })
        .from(leads)
        .where(
          and(
            eq(leads.status, "visita_realizada"),
            gte(leads.updatedAt, data),
            lte(leads.updatedAt, dataFim)
          )
        );

      // Análises de crédito
      const analises = await db
        .select({ count: sql<number>`count(*)` })
        .from(leads)
        .where(
          and(
            eq(leads.status, "analise_credito"),
            gte(leads.updatedAt, data),
            lte(leads.updatedAt, dataFim)
          )
        );

      // Contratos fechados neste dia
      const contratosData = await db
        .select({
          count: sql<number>`count(*)`,
          vgvTotal: sql<number>`COALESCE(sum(${contratos.valorVenda}), 0)`,
        })
        .from(contratos)
        .where(and(gte(contratos.createdAt, data), lte(contratos.createdAt, dataFim)));

      const contratosFechados = contratosData[0]?.count || 0;
      const vgvTotal = contratosData[0]?.vgvTotal || 0;

      // Calcular taxas de conversão
      const totalLeadsNum = Number(totalLeads[0]?.count || 0);
      const agendamentosNum = Number(agendamentos[0]?.count || 0);
      const visitasNum = Number(visitas[0]?.count || 0);

      const taxaAgendamento = totalLeadsNum > 0 ? (agendamentosNum / totalLeadsNum) * 100 : 0;
      const taxaVisita = totalLeadsNum > 0 ? (visitasNum / totalLeadsNum) * 100 : 0;
      const taxaContrato = totalLeadsNum > 0 ? (contratosFechados / totalLeadsNum) * 100 : 0;

      metricas.push([
        formatDateOnly(data),
        totalLeadsNum.toString(),
        Number(leadsNovos[0]?.count || 0).toString(),
        agendamentosNum.toString(),
        visitasNum.toString(),
        Number(analises[0]?.count || 0).toString(),
        contratosFechados.toString(),
        vgvTotal.toString(),
        taxaAgendamento.toFixed(2),
        taxaVisita.toFixed(2),
        taxaContrato.toFixed(2),
      ]);
    }

    // Inverter para ordem cronológica (mais antigo primeiro)
    metricas.reverse();

    // Limpar e atualizar planilha
    const sheets = await getAuthenticatedClient();
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_METRICAS}!A2:K`,
    });

    if (metricas.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_METRICAS}!A2:K${metricas.length + 1}`,
        valueInputOption: "RAW",
        requestBody: {
          values: metricas,
        },
      });
    }

    console.log(`[BI Sync] ${metricas.length} dias de métricas sincronizados`);
    return { success: metricas.length, errors: 0 };
  } catch (error: any) {
    console.error("[BI Sync] Erro ao sincronizar métricas:", error.message);
    return { success: 0, errors: 1 };
  }
}

/**
 * Sincroniza performance dos corretores para o Google Sheets
 */
export async function syncPerformanceCorretores(): Promise<{ success: number; errors: number }> {
  try {
    console.log("[BI Sync] Iniciando sincronização de performance dos corretores...");

    await initPerformanceSheet();

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Buscar todos os corretores ativos
    const corretores = await db
      .select({
        id: users.id,
        nome: users.name,
        email: users.email,
        equipeId: users.equipeId,
      })
      .from(users)
      .where(eq(users.role, "corretor"));

    const rows: any[] = [];

    for (const corretor of corretores) {
      // Total de leads
      const totalLeads = await db
        .select({ count: sql<number>`count(*)` })
        .from(leads)
        .where(eq(leads.corretorId, corretor.id));

      // Leads ativos (não perdidos nem fechados)
      const leadsAtivos = await db
        .select({ count: sql<number>`count(*)` })
        .from(leads)
        .where(
          and(
            eq(leads.corretorId, corretor.id),
            sql`${leads.status} NOT IN ('perdido', 'contrato_fechado')`
          )
        );

      // Agendamentos
      const agendamentos = await db
        .select({ count: sql<number>`count(*)` })
        .from(leads)
        .where(and(eq(leads.corretorId, corretor.id), eq(leads.status, "agendado")));

      // Visitas realizadas
      const visitas = await db
        .select({ count: sql<number>`count(*)` })
        .from(leads)
        .where(and(eq(leads.corretorId, corretor.id), eq(leads.status, "visita_realizada")));

      // Análises de crédito
      const analises = await db
        .select({ count: sql<number>`count(*)` })
        .from(leads)
        .where(and(eq(leads.corretorId, corretor.id), eq(leads.status, "analise_credito")));

      // Contratos fechados e VGV
      const contratosData = await db
        .select({
          count: sql<number>`count(*)`,
          vgvTotal: sql<number>`COALESCE(sum(${contratos.valorVenda}), 0)`,
        })
        .from(contratos)
        .where(eq(contratos.corretorId, corretor.id));

      const contratosFechados = Number(contratosData[0]?.count || 0);
      const vgvTotal = Number(contratosData[0]?.vgvTotal || 0);
      const ticketMedio = contratosFechados > 0 ? vgvTotal / contratosFechados : 0;

      // Taxa de conversão
      const totalLeadsNum = Number(totalLeads[0]?.count || 0);
      const taxaConversao = totalLeadsNum > 0 ? (contratosFechados / totalLeadsNum) * 100 : 0;

      rows.push([
        corretor.nome || "",
        corretor.email || "",
        corretor.equipeId?.toString() || "Sem equipe",
        totalLeadsNum.toString(),
        Number(leadsAtivos[0]?.count || 0).toString(),
        Number(agendamentos[0]?.count || 0).toString(),
        Number(visitas[0]?.count || 0).toString(),
        Number(analises[0]?.count || 0).toString(),
        contratosFechados.toString(),
        vgvTotal.toString(),
        ticketMedio.toString(),
        taxaConversao.toFixed(2),
        formatDate(new Date()),
      ]);
    }

    // Limpar e atualizar planilha
    const sheets = await getAuthenticatedClient();
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_PERFORMANCE}!A2:M`,
    });

    if (rows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_PERFORMANCE}!A2:M${rows.length + 1}`,
        valueInputOption: "RAW",
        requestBody: {
          values: rows,
        },
      });
    }

    console.log(`[BI Sync] ${rows.length} corretores sincronizados`);
    return { success: rows.length, errors: 0 };
  } catch (error: any) {
    console.error("[BI Sync] Erro ao sincronizar performance:", error.message);
    return { success: 0, errors: 1 };
  }
}

/**
 * Sincroniza todos os dados (Contratos, Métricas e Performance)
 */
export async function syncAllBI(): Promise<{
  contratos: { success: number; errors: number };
  metricas: { success: number; errors: number };
  performance: { success: number; errors: number };
}> {
  console.log("[BI Sync] Iniciando sincronização completa...");

  const contratos = await syncContratos();
  const metricas = await syncMetricasDiarias();
  const performance = await syncPerformanceCorretores();

  console.log("[BI Sync] Sincronização completa finalizada");

  return { contratos, metricas, performance };
}

/**
 * Testa a conexão com Google Sheets
 */
export async function testBIConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const sheets = await getAuthenticatedClient();

    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    return {
      success: true,
      message: `Conexão estabelecida com sucesso. Planilha: ${response.data.properties?.title}`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Erro ao conectar: ${error.message}`,
    };
  }
}
