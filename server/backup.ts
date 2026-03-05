import { getDb } from "./db";
import {
  users,
  leads,
  agendamentos,
  visitas,
  analises_credito,
  contratos,
  documentacoes,
  projects,
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
} from "../drizzle/schema";
import { storagePut } from "./storage";

/**
 * Tabelas críticas incluídas no backup (ordem respeita dependências de FK)
 */
const CRITICAL_TABLES = [
  { name: "users", table: users },
  { name: "equipes", table: equipes },
  { name: "projects", table: projects },
  { name: "leads", table: leads },
  { name: "agendamentos", table: agendamentos },
  { name: "visitas", table: visitas },
  { name: "analises_credito", table: analises_credito },
  { name: "contratos", table: contratos },
  { name: "documentacoes", table: documentacoes },
  { name: "interacoes", table: interacoes },
  { name: "propostas", table: propostas },
  { name: "follow_ups", table: followUps },
  { name: "tarefas", table: tarefas },
  { name: "comissoes", table: comissoes },
  { name: "atividades_diarias", table: atividadesDiarias },
  { name: "conquistas", table: conquistas },
  { name: "metas", table: metas },
  { name: "metas_globais", table: metasGlobais },
];

export interface BackupResult {
  success: boolean;
  timestamp: string;
  filename: string;
  url?: string;
  tables: {
    name: string;
    rowCount: number;
  }[];
  error?: string;
}

/**
 * Realiza backup completo de todas as tabelas críticas
 * @returns Resultado do backup com URL do arquivo no S3
 */
export async function performBackup(): Promise<BackupResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.json`;

  try {
    console.log(`[Backup] Iniciando backup: ${filename}`);

    // IMPORTANTE: usar await getDb() — getDb() é assíncrono
    const db = await getDb();
    if (!db) {
      throw new Error("Banco de dados não disponível");
    }

    const backupData: Record<string, any[]> = {};
    const tableSummary: { name: string; rowCount: number }[] = [];

    // Exportar cada tabela
    for (const { name, table } of CRITICAL_TABLES) {
      try {
        const rows = await db.select().from(table as any);
        backupData[name] = rows;
        tableSummary.push({ name, rowCount: rows.length });
        console.log(`[Backup] ${name}: ${rows.length} registros`);
      } catch (error) {
        console.error(`[Backup] Erro ao exportar tabela ${name}:`, error);
        backupData[name] = [];
        tableSummary.push({ name, rowCount: 0 });
      }
    }

    // Adicionar metadados
    const backup = {
      version: "2.0",
      timestamp: new Date().toISOString(),
      tables: backupData,
      summary: tableSummary,
    };

    // Converter para JSON e fazer upload para S3
    const jsonContent = JSON.stringify(backup, null, 2);
    const buffer = Buffer.from(jsonContent, "utf-8");

    const s3Key = `backups/${filename}`;
    const { url } = await storagePut(s3Key, buffer, "application/json");

    console.log(`[Backup] ✅ Backup concluído com sucesso: ${url}`);

    return {
      success: true,
      timestamp: new Date().toISOString(),
      filename,
      url,
      tables: tableSummary,
    };
  } catch (error) {
    console.error("[Backup] Erro ao realizar backup:", error);
    return {
      success: false,
      timestamp: new Date().toISOString(),
      filename,
      tables: [],
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}
