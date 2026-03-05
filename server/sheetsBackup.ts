/**
 * Backup Automático para Google Sheets
 *
 * Exporta todas as tabelas críticas do banco de dados para abas separadas
 * na planilha de backup. Executa a cada hora.
 *
 * Planilha: https://docs.google.com/spreadsheets/d/17rNBEdN9AcBt-mxWbohJkxZ5YvP67x9h0Wp_iUYmr-c
 */

import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";
import * as path from "path";
import { getDb } from "./db";
import {
  users,
  leads,
  agendamentos,
  visitas,
  contratos,
  atividadesDiarias,
  conquistas,
  metas,
  metasGlobais,
  equipes,
  interacoes,
  propostas,
  followUps,
  tarefas,
  comissoes,
  analises_credito,
} from "../drizzle/schema";

const BACKUP_SPREADSHEET_ID = "17rNBEdN9AcBt-mxWbohJkxZ5YvP67x9h0Wp_iUYmr-c";
// Usar keyFile para evitar problemas com OpenSSL (mesmo padrão do googleSheetsSync.ts)
const CREDENTIALS_PATH = path.resolve(process.cwd(), "server/google-service-account.json");

// Definição das abas a exportar
const EXPORT_TABLES = [
  { name: "Usuários", table: users },
  { name: "Equipes", table: equipes },
  { name: "Leads", table: leads },
  { name: "Agendamentos", table: agendamentos },
  { name: "Visitas", table: visitas },
  { name: "Contratos", table: contratos },
  { name: "Interações", table: interacoes },
  { name: "Propostas", table: propostas },
  { name: "Follow-ups", table: followUps },
  { name: "Tarefas", table: tarefas },
  { name: "Comissões", table: comissoes },
  { name: "Análises Crédito", table: analises_credito },
  { name: "Atividades Diárias", table: atividadesDiarias },
  { name: "Conquistas", table: conquistas },
  { name: "Metas", table: metas },
  { name: "Metas Globais", table: metasGlobais },
];

/**
 * Obtém cliente autenticado do Google Sheets
 */
async function getSheetsClient() {
  const auth = new GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const authClient = await auth.getClient();
  return google.sheets({ version: "v4", auth: authClient as any });
}

/**
 * Converte um valor para string legível na planilha
 */
function formatValue(val: any): string {
  if (val === null || val === undefined) return "";
  if (val instanceof Date) {
    return val.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  }
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

/**
 * Garante que a aba existe na planilha, criando se necessário
 */
async function ensureSheet(
  sheets: any,
  spreadsheetId: string,
  sheetTitle: string
): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets?.find(
    (s: any) => s.properties?.title === sheetTitle
  );
  if (existing) {
    return existing.properties.sheetId;
  }
  // Criar nova aba
  const res = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: sheetTitle } } }],
    },
  });
  return res.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;
}

/**
 * Exporta uma tabela para uma aba da planilha
 */
async function exportTableToSheet(
  sheets: any,
  db: any,
  tableDef: { name: string; table: any }
): Promise<{ name: string; rowCount: number }> {
  const { name, table } = tableDef;

  try {
    // Buscar dados
    const rows = await db.select().from(table);

    if (rows.length === 0) {
      // Garantir que a aba existe mesmo vazia
      await ensureSheet(sheets, BACKUP_SPREADSHEET_ID, name);
      // Escrever apenas cabeçalho vazio com timestamp
      await sheets.spreadsheets.values.update({
        spreadsheetId: BACKUP_SPREADSHEET_ID,
        range: `'${name}'!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[`Sem dados — Atualizado em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`]],
        },
      });
      return { name, rowCount: 0 };
    }

    // Extrair cabeçalhos das chaves do primeiro objeto
    const headers = Object.keys(rows[0]);

    // Montar linhas: cabeçalho + dados
    const sheetRows: string[][] = [
      // Linha 0: metadados
      [`Backup: ${name}`, `Atualizado em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, `Total: ${rows.length} registros`],
      // Linha 1: cabeçalhos
      headers,
      // Linhas de dados
      ...rows.map((row: any) => headers.map((h) => formatValue(row[h]))),
    ];

    // Garantir que a aba existe
    await ensureSheet(sheets, BACKUP_SPREADSHEET_ID, name);

    // Limpar conteúdo anterior e escrever novos dados
    await sheets.spreadsheets.values.clear({
      spreadsheetId: BACKUP_SPREADSHEET_ID,
      range: `'${name}'!A:ZZ`,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: BACKUP_SPREADSHEET_ID,
      range: `'${name}'!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: sheetRows },
    });

    console.log(`[Sheets Backup] ✅ ${name}: ${rows.length} registros exportados`);
    return { name, rowCount: rows.length };
  } catch (err: any) {
    console.error(`[Sheets Backup] ❌ Erro ao exportar ${name}:`, err.message);
    return { name, rowCount: -1 };
  }
}

/**
 * Atualiza a aba de resumo "📊 Resumo" com o status de todas as exportações
 */
async function updateSummarySheet(
  sheets: any,
  results: { name: string; rowCount: number }[],
  startTime: Date
): Promise<void> {
  const summaryName = "📊 Resumo";
  await ensureSheet(sheets, BACKUP_SPREADSHEET_ID, summaryName);

  const endTime = new Date();
  const duration = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(1);

  const rows: string[][] = [
    ["🗄️ BACKUP CRM - SEU METRO QUADRADO"],
    [""],
    ["Último backup:", endTime.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })],
    ["Duração:", `${duration}s`],
    ["Status:", "✅ Concluído"],
    [""],
    ["Tabela", "Registros", "Status"],
    ...results.map((r) => [
      r.name,
      r.rowCount >= 0 ? String(r.rowCount) : "ERRO",
      r.rowCount >= 0 ? "✅" : "❌",
    ]),
    [""],
    ["Total de registros:", String(results.filter(r => r.rowCount > 0).reduce((s, r) => s + r.rowCount, 0))],
  ];

  await sheets.spreadsheets.values.clear({
    spreadsheetId: BACKUP_SPREADSHEET_ID,
    range: `'${summaryName}'!A:C`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: BACKUP_SPREADSHEET_ID,
    range: `'${summaryName}'!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });
}

/**
 * Executa o backup completo para o Google Sheets
 */
export async function performSheetsBackup(): Promise<{
  success: boolean;
  tables: { name: string; rowCount: number }[];
  error?: string;
}> {
  const startTime = new Date();
  console.log("[Sheets Backup] Iniciando backup para Google Sheets...");

  try {
    const db = await getDb();
    if (!db) throw new Error("Banco de dados não disponível");

    const sheets = await getSheetsClient();
    const results: { name: string; rowCount: number }[] = [];

    // Exportar cada tabela sequencialmente para evitar rate limit
    for (const tableDef of EXPORT_TABLES) {
      const result = await exportTableToSheet(sheets, db, tableDef);
      results.push(result);
      // Pequena pausa para respeitar rate limits da API
      await new Promise((r) => setTimeout(r, 300));
    }

    // Atualizar aba de resumo
    await updateSummarySheet(sheets, results, startTime);

    const totalRows = results.filter(r => r.rowCount > 0).reduce((s, r) => s + r.rowCount, 0);
    console.log(`[Sheets Backup] ✅ Backup concluído! ${totalRows} registros exportados em ${((Date.now() - startTime.getTime()) / 1000).toFixed(1)}s`);

    return { success: true, tables: results };
  } catch (err: any) {
    console.error("[Sheets Backup] ❌ Erro no backup:", err.message);
    return { success: false, tables: [], error: err.message };
  }
}
