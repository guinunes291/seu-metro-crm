import { getDb } from "./db";
import { leads } from "../drizzle/schema";

/**
 * Detecta automaticamente o delimitador do CSV
 * Testa vírgula, ponto-e-vírgula e tab
 */
export function detectDelimiter(sample: string): string {
  const delimiters = [',', ';', '\t'];
  const lines = sample.split('\n').slice(0, 5); // Analisa primeiras 5 linhas
  
  let bestDelimiter = ',';
  let maxConsistency = 0;
  
  for (const delimiter of delimiters) {
    const counts = lines.map(line => line.split(delimiter).length);
    const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;
    
    // Verifica consistência (todas as linhas têm número similar de colunas)
    const consistency = counts.filter(c => Math.abs(c - avgCount) < 2).length / counts.length;
    
    if (consistency > maxConsistency && avgCount > 1) {
      maxConsistency = consistency;
      bestDelimiter = delimiter;
    }
  }
  
  return bestDelimiter;
}

/**
 * Detecta encoding do arquivo (UTF-8 ou Latin1)
 */
export function detectEncoding(buffer: Buffer): 'utf-8' | 'latin1' {
  const sample = buffer.toString('utf-8', 0, Math.min(1000, buffer.length));
  
  // Verifica se há caracteres inválidos em UTF-8
  const hasInvalidChars = sample.includes('\uFFFD');
  
  return hasInvalidChars ? 'latin1' : 'utf-8';
}

/**
 * Parse CSV com detecção automática de delimitador
 */
export function parseCSV(content: string, delimiter?: string): string[][] {
  // Detectar delimitador se não fornecido
  if (!delimiter) {
    delimiter = detectDelimiter(content);
  }
  
  const lines = content.split('\n').filter(line => line.trim());
  const rows: string[][] = [];
  
  for (const line of lines) {
    // Parse simples (não trata aspas complexas)
    const cells = line.split(delimiter).map(cell => cell.trim().replace(/^"|"$/g, ''));
    rows.push(cells);
  }
  
  return rows;
}

/**
 * Mapeia colunas do CSV para campos do lead
 */
export interface CSVColumnMapping {
  nome?: number;
  telefone?: number;
  email?: number;
  origem?: number;
  observacoes?: number;
}

/**
 * Detecta automaticamente o mapeamento de colunas
 * Procura por nomes comuns de colunas
 */
export function detectColumnMapping(headers: string[]): CSVColumnMapping {
  const mapping: CSVColumnMapping = {};
  
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  
  // Detectar coluna de nome
  const nomePatterns = ['nome', 'name', 'cliente', 'lead'];
  const nomeIndex = normalizedHeaders.findIndex(h => 
    nomePatterns.some(p => h.includes(p))
  );
  if (nomeIndex >= 0) mapping.nome = nomeIndex;
  
  // Detectar coluna de telefone
  const telefonePatterns = ['telefone', 'phone', 'celular', 'whatsapp', 'contato'];
  const telefoneIndex = normalizedHeaders.findIndex(h => 
    telefonePatterns.some(p => h.includes(p))
  );
  if (telefoneIndex >= 0) mapping.telefone = telefoneIndex;
  
  // Detectar coluna de email
  const emailPatterns = ['email', 'e-mail', 'mail'];
  const emailIndex = normalizedHeaders.findIndex(h => 
    emailPatterns.some(p => h.includes(p))
  );
  if (emailIndex >= 0) mapping.email = emailIndex;
  
  // Detectar coluna de origem
  const origemPatterns = ['origem', 'source', 'canal', 'midia'];
  const origemIndex = normalizedHeaders.findIndex(h => 
    origemPatterns.some(p => h.includes(p))
  );
  if (origemIndex >= 0) mapping.origem = origemIndex;
  
  // Detectar coluna de observações
  const obsPatterns = ['observa', 'obs', 'notes', 'comentario', 'descri'];
  const obsIndex = normalizedHeaders.findIndex(h => 
    obsPatterns.some(p => h.includes(p))
  );
  if (obsIndex >= 0) mapping.observacoes = obsIndex;
  
  return mapping;
}

/**
 * Valida telefone (formato brasileiro)
 */
export function validatePhone(phone: string): boolean {
  if (!phone) return false;
  
  // Remove caracteres não numéricos
  const cleaned = phone.replace(/\D/g, '');
  
  // Telefone brasileiro: 10 ou 11 dígitos (com DDD)
  return cleaned.length >= 10 && cleaned.length <= 11;
}

/**
 * Valida email
 */
export function validateEmail(email: string): boolean {
  if (!email) return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Normaliza telefone para formato padrão
 */
export function normalizePhone(phone: string): string {
  // Remove tudo exceto números
  const cleaned = phone.replace(/\D/g, '');
  
  // Formata: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  
  return phone;
}

/**
 * Importa leads do CSV
 */
export interface CSVImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: number;
  details: Array<{
    row: number;
    status: 'imported' | 'skipped' | 'error';
    message: string;
    data?: any;
  }>;
}

export async function importLeadsFromCSV(
  csvContent: string,
  corretorId: number,
  mapping?: CSVColumnMapping,
  delimiter?: string
): Promise<CSVImportResult> {
  const result: CSVImportResult = {
    success: true,
    imported: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };
  
  try {
    // Parse CSV
    const rows = parseCSV(csvContent, delimiter);
    
    if (rows.length === 0) {
      result.success = false;
      result.details.push({
        row: 0,
        status: 'error',
        message: 'Arquivo CSV vazio',
      });
      return result;
    }
    
    // Primeira linha é o cabeçalho
    const headers = rows[0];
    
    // Detectar mapeamento se não fornecido
    if (!mapping) {
      mapping = detectColumnMapping(headers);
    }
    
    // Validar mapeamento mínimo
    if (mapping.nome === undefined || mapping.telefone === undefined) {
      result.success = false;
      result.details.push({
        row: 0,
        status: 'error',
        message: 'Não foi possível detectar as colunas de nome e telefone. Por favor, mapeie manualmente.',
      });
      return result;
    }
    
    const db = await getDb();
    if (!db) {
      throw new Error('Database não disponível');
    }
    
    // Processar cada linha (pular cabeçalho)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;
      
      try {
        // Extrair dados conforme mapeamento
        const nome = mapping.nome !== undefined ? row[mapping.nome] : '';
        const telefone = mapping.telefone !== undefined ? row[mapping.telefone] : '';
        const email = mapping.email !== undefined ? row[mapping.email] : '';
        const origem = mapping.origem !== undefined ? row[mapping.origem] : 'CSV';
        const observacoes = mapping.observacoes !== undefined ? row[mapping.observacoes] : '';
        
        // Validações
        if (!nome || !telefone) {
          result.skipped++;
          result.details.push({
            row: rowNumber,
            status: 'skipped',
            message: 'Nome ou telefone vazio',
            data: { nome, telefone },
          });
          continue;
        }
        
        if (!validatePhone(telefone)) {
          result.skipped++;
          result.details.push({
            row: rowNumber,
            status: 'skipped',
            message: 'Telefone inválido',
            data: { nome, telefone },
          });
          continue;
        }
        
        if (email && !validateEmail(email)) {
          result.skipped++;
          result.details.push({
            row: rowNumber,
            status: 'skipped',
            message: 'Email inválido',
            data: { nome, telefone, email },
          });
          continue;
        }
        
        // Normalizar telefone
        const telefoneLimpo = normalizePhone(telefone);
        
        // Inserir lead
        await db.insert(leads).values({
          nome,
          telefone: telefoneLimpo,
          email: email || null,
          origem,
          observacoes: observacoes || null,
          corretorId,
          status: 'novo',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        result.imported++;
        
        // Adicionar aos detalhes apenas os primeiros 100
        if (result.imported <= 100) {
          result.details.push({
            row: rowNumber,
            status: 'imported',
            message: 'Importado com sucesso',
            data: { nome, telefone: telefoneLimpo, email },
          });
        }
        
      } catch (error: any) {
        result.errors++;
        result.details.push({
          row: rowNumber,
          status: 'error',
          message: error.message || 'Erro desconhecido',
        });
      }
    }
    
    result.success = result.errors === 0;
    
  } catch (error: any) {
    result.success = false;
    result.errors++;
    result.details.push({
      row: 0,
      status: 'error',
      message: error.message || 'Erro ao processar CSV',
    });
  }
  
  return result;
}
