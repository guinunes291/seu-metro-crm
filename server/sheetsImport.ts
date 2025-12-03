import { getDb } from "./db";
import { leads, projects } from "../drizzle/schema";
import { readGoogleSheet, extractSpreadsheetId } from "./googleSheets";
import { eq, or } from "drizzle-orm";

interface ImportResult {
  total: number;
  imported: number;
  duplicates: number;
  errors: number;
  details: Array<{
    row: number;
    nome: string;
    status: "imported" | "duplicate" | "error";
    message?: string;
  }>;
}

/**
 * Verifica se um lead já existe no banco de dados
 * Critérios: ID da planilha, telefone ou email
 */
async function isLeadDuplicate(
  sheetId: string,
  telefone: string,
  email: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Buscar por ID principal, telefone ou email
  const existing = await db
    .select()
    .from(leads)
    .where(
      or(
        eq(leads.idPrincipal, sheetId),
        eq(leads.telefone, telefone),
        email ? eq(leads.email, email) : undefined
      )
    )
    .limit(1);

  return existing.length > 0;
}

/**
 * Normaliza o telefone para formato padrão
 */
function normalizeTelefone(telefone: string): string {
  // Remove tudo que não é número
  const numbers = telefone.replace(/\D/g, "");
  
  // Formata para (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
  if (numbers.length === 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  } else if (numbers.length === 10) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  }
  
  return telefone;
}

/**
 * Mapeia o status da planilha para o status do sistema
 */
function mapStatus(sheetStatus: string): string {
  const statusMap: Record<string, string> = {
    "novo": "novo",
    "aguardando atendimento": "aguardando_atendimento",
    "em atendimento": "em_atendimento",
    "agendado": "agendado",
    "visita realizada": "visita_realizada",
    "análise de crédito": "analise_credito",
    "analise de credito": "analise_credito",
    "contrato fechado": "contrato_fechado",
    "perdido": "perdido",
  };

  const normalized = sheetStatus.toLowerCase().trim();
  return statusMap[normalized] || "novo";
}

/**
 * Busca ou cria um projeto baseado na origem
 */
async function getOrCreateProject(origem: string): Promise<number | null> {
  if (!origem || origem.trim() === "") return null;

  const db = await getDb();
  if (!db) return null;

  // Buscar projeto existente
  const existing = await db
    .select()
    .from(projects)
    .where(eq(projects.nome, origem))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Criar novo projeto
  const [newProject] = await db.insert(projects).values({
    nome: origem,
    cidade: "A definir",
    estado: "SP",
    tipo: "mcmv",
    status: "ativo",
  });

  return newProject.insertId;
}

/**
 * Importa leads de uma planilha do Google Sheets
 */
export async function importLeadsFromSheet(
  sheetUrl: string,
  sheetRange: string = "MASTER_LEADS!A:H"
): Promise<ImportResult> {
  const result: ImportResult = {
    total: 0,
    imported: 0,
    duplicates: 0,
    errors: 0,
    details: [],
  };

  try {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    const rows = await readGoogleSheet(spreadsheetId, sheetRange);

    result.total = rows.length;

    const db = await getDb();
    if (!db) {
      throw new Error("Database não disponível");
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 porque linha 1 é header e arrays começam em 0

      try {
        // Validar dados mínimos
        if (!row.nome || !row.telefone) {
          result.errors++;
          result.details.push({
            row: rowNumber,
            nome: row.nome || "Sem nome",
            status: "error",
            message: "Nome ou telefone ausente",
          });
          continue;
        }

        // Verificar duplicata
        const isDuplicate = await isLeadDuplicate(
          row.id,
          row.telefone,
          row.email
        );

        if (isDuplicate) {
          result.duplicates++;
          result.details.push({
            row: rowNumber,
            nome: row.nome,
            status: "duplicate",
            message: "Lead já existe no sistema",
          });
          continue;
        }

        // Buscar ou criar projeto
        const projectId = await getOrCreateProject(row.origem);

        // Importar lead
        const leadStatus = row.status ? mapStatus(row.status) : "novo";
        await db.insert(leads).values({
          idPrincipal: row.id,
          nome: row.nome,
          email: row.email || null,
          telefone: normalizeTelefone(row.telefone),
          origem: row.origem || null,
          projectId: projectId,
          status: leadStatus as "novo" | "aguardando_atendimento" | "em_atendimento" | "agendado" | "visita_realizada" | "analise_credito" | "contrato_fechado" | "perdido",
          dataDistribuicao: row.dataDistribuicao ? new Date(row.dataDistribuicao) : null,
        });

        result.imported++;
        result.details.push({
          row: rowNumber,
          nome: row.nome,
          status: "imported",
          message: "Importado com sucesso",
        });
      } catch (error: any) {
        result.errors++;
        result.details.push({
          row: rowNumber,
          nome: row.nome || "Desconhecido",
          status: "error",
          message: error.message || "Erro desconhecido",
        });
      }
    }

    return result;
  } catch (error: any) {
    throw new Error(`Erro ao importar planilha: ${error.message}`);
  }
}

/**
 * Importa apenas leads novos (sincronização incremental)
 */
export async function syncLeadsFromSheet(
  sheetUrl: string,
  sheetRange: string = "MASTER_LEADS!A:H"
): Promise<ImportResult> {
  // A função importLeadsFromSheet já faz verificação de duplicatas
  // então podemos usá-la diretamente para sincronização incremental
  return await importLeadsFromSheet(sheetUrl, sheetRange);
}
