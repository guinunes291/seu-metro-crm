/**
 * Google Drive API client usando Service Account
 *
 * Para acessar arquivos privados, a pasta/arquivo deve ser compartilhado com:
 *   crm-sheets-sync@seu-metro-quadrado-crm.iam.gserviceaccount.com  (acesso Visualizador)
 */

import { google } from 'googleapis';
import * as path from 'path';

const SA_PATH = path.join(__dirname, '../server/google-service-account.json');

function getDriveClient() {
  // Usar env GOOGLE_SERVICE_ACCOUNT_JSON se disponível (produção),
  // senão fallback para arquivo local (desenvolvimento)
  const envJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const authConfig = envJson
    ? { credentials: JSON.parse(envJson), scopes: ['https://www.googleapis.com/auth/drive.readonly'] }
    : { keyFile: SA_PATH, scopes: ['https://www.googleapis.com/auth/drive.readonly'] };
  const auth = new google.auth.GoogleAuth(authConfig);
  return google.drive({ version: 'v3', auth });
}

// ─── URL / ID helpers ─────────────────────────────────────────────────────────

export function extractFolderIdFromUrl(url: string): string | null {
  // Mobile URL: .../folders/PARENT_ID/FOLDER_ID?...  → pega o último ID
  const mobileMatch = url.match(/\/folders\/[a-zA-Z0-9_-]+\/([a-zA-Z0-9_-]+)/);
  if (mobileMatch) return mobileMatch[1];

  // Standard: .../folders/FOLDER_ID
  const standardMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (standardMatch) return standardMatch[1];

  // Param: ?id=FOLDER_ID
  const paramMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (paramMatch) return paramMatch[1];

  // Raw ID (sem barra, ~33 chars)
  if (/^[a-zA-Z0-9_-]{25,60}$/.test(url.trim())) return url.trim();

  return null;
}

// ─── Folder listing ───────────────────────────────────────────────────────────

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
};

export type DriveFolder = {
  id: string;
  name: string;
};

export async function listPdfsInFolder(folderId: string): Promise<DriveFile[]> {
  const drive = getDriveClient();
  const resp = await drive.files.list({
    q: `'${folderId}' in parents and mimeType = 'application/pdf' and trashed = false`,
    fields: 'files(id, name, mimeType, size)',
    pageSize: 200,
    orderBy: 'name',
  });
  return (resp.data.files ?? []) as DriveFile[];
}

export async function listSubfolders(folderId: string): Promise<DriveFolder[]> {
  const drive = getDriveClient();
  const resp = await drive.files.list({
    q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 200,
    orderBy: 'name',
  });
  return (resp.data.files ?? []) as DriveFolder[];
}

/**
 * Lista TODOS os PDFs em uma pasta, incluindo subpastas (um nível).
 * Retorna cada arquivo com o nome da subpasta como possível nome de construtora.
 */
export async function listAllPdfsRecursive(rootFolderId: string): Promise<
  Array<DriveFile & { construtoraHint: string }>
> {
  const results: Array<DriveFile & { construtoraHint: string }> = [];

  // PDFs direto na raiz
  const rootPdfs = await listPdfsInFolder(rootFolderId);
  for (const f of rootPdfs) {
    results.push({ ...f, construtoraHint: guessConstrutora(f.name) });
  }

  // Subpastas (estrutura: pasta por construtora)
  const subfolders = await listSubfolders(rootFolderId);
  for (const sf of subfolders) {
    const subPdfs = await listPdfsInFolder(sf.id);
    for (const f of subPdfs) {
      results.push({ ...f, construtoraHint: sf.name });
    }
  }

  return results;
}

/**
 * Tenta adivinhar o nome da construtora a partir do nome do arquivo.
 * Ex: "Cyrela_Tabelao_Mai2025.pdf" → "Cyrela"
 *     "tabelao-mrv-maio-2025.pdf"  → "MRV"
 */
function guessConstrutora(filename: string): string {
  const base = filename.replace(/\.pdf$/i, '').trim();
  // Separadores comuns: _ - espaço
  const parts = base.split(/[_\-\s]+/);
  const first = parts[0] ?? base;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

// ─── File download ────────────────────────────────────────────────────────────

export async function downloadFileFromDrive(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();
  const resp = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' },
  );
  return Buffer.from(resp.data as ArrayBuffer);
}

/**
 * Obtém metadados de um arquivo pelo ID.
 */
export async function getFileMetadata(fileId: string): Promise<DriveFile> {
  const drive = getDriveClient();
  const resp = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size',
  });
  return resp.data as DriveFile;
}

/**
 * Verifica se a service account consegue acessar a pasta.
 * Retorna null em caso de erro de permissão.
 */
export async function testFolderAccess(folderId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const drive = getDriveClient();
    await drive.files.get({ fileId: folderId, fields: 'id, name' });
    return { ok: true };
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 403 || status === 404) {
      return {
        ok: false,
        error: `Sem acesso (HTTP ${status}). Compartilhe a pasta com: crm-sheets-sync@seu-metro-quadrado-crm.iam.gserviceaccount.com`,
      };
    }
    return { ok: false, error: err?.message ?? 'Erro desconhecido' };
  }
}
