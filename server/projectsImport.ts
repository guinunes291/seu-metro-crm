import { readGoogleSheet, extractSpreadsheetId } from "./googleSheets";
import * as db from "./db";

interface ProjectRow {
  zona?: string;
  nome?: string;
  construtora?: string;
  endereco?: string;
  metragem?: string;
  vagas?: string;
  valor?: string;
  enquadramento?: string;
}

function parseValor(valorStr: string): number | undefined {
  if (!valorStr) return undefined;
  
  // Remove "R$", pontos e vírgulas, converte para número
  const cleanValue = valorStr
    .replace(/R\$/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .trim();
  
  const valor = parseFloat(cleanValue);
  return isNaN(valor) ? undefined : Math.round(valor * 100); // Converte para centavos
}

function parseMetragem(metragemStr: string): { min?: number; max?: number } {
  if (!metragemStr) return {};
  
  // Remove "m²" e espaços
  const clean = metragemStr.replace(/m²/g, "").trim();
  
  // Verifica se tem "a" ou "/" indicando range
  if (clean.includes(" a ") || clean.includes("/")) {
    const parts = clean.split(/\s+a\s+|\//).map(p => p.trim());
    const min = parseFloat(parts[0]);
    const max = parseFloat(parts[parts.length - 1]);
    
    return {
      min: isNaN(min) ? undefined : min,
      max: isNaN(max) ? undefined : max,
    };
  }
  
  // Valor único
  const valor = parseFloat(clean);
  return {
    min: isNaN(valor) ? undefined : valor,
    max: isNaN(valor) ? undefined : valor,
  };
}

function parseVagas(vagasStr: string): number {
  if (!vagasStr) return 0;
  
  const lower = vagasStr.toLowerCase();
  
  if (lower.includes("não") || lower.includes("sem")) {
    return 0;
  }
  
  if (lower.includes("sim")) {
    return 1; // Assume 1 vaga se apenas diz "Sim"
  }
  
  // Tenta extrair número
  const match = vagasStr.match(/\d+/);
  if (match) {
    return parseInt(match[0]);
  }
  
  return 0;
}

function normalizarZona(zona: string): "norte" | "sul" | "leste" | "oeste" | "centro" | undefined {
  if (!zona) return undefined;
  
  const lower = zona.toLowerCase().trim();
  
  if (lower.includes("norte")) return "norte";
  if (lower.includes("sul")) return "sul";
  if (lower.includes("leste")) return "leste";
  if (lower.includes("oeste")) return "oeste";
  if (lower.includes("centro")) return "centro";
  
  return undefined;
}

function normalizarEnquadramento(enq: string): "HIS1" | "HIS2" | "HMP" | "R2V" | undefined {
  if (!enq) return undefined;
  
  const upper = enq.toUpperCase().trim();
  
  if (upper.includes("HIS1") || upper.includes("HIS 1")) return "HIS1";
  if (upper.includes("HIS2") || upper.includes("HIS 2")) return "HIS2";
  if (upper.includes("HMP")) return "HMP";
  if (upper.includes("R2V")) return "R2V";
  
  return undefined;
}

export interface ImportProjectsResult {
  totalRows: number;
  imported: number;
  duplicates: number;
  errors: number;
  details: Array<{
    row: number;
    nome: string;
    status: "success" | "duplicate" | "error";
    message?: string;
  }>;
}

export async function importProjectsFromSheet(
  sheetUrl: string,
  sheetName: string = "GERAL",
  syncMode: "all" | "new" = "new"
): Promise<ImportProjectsResult> {
  const result: ImportProjectsResult = {
    totalRows: 0,
    imported: 0,
    duplicates: 0,
    errors: 0,
    details: [],
  };

  try {
    // Busca dados da planilha
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    const range = `${sheetName}!A:H`; // Colunas A até H
    
    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_SHEETS_API_KEY não configurada");
    }
    
    const { google } = require("googleapis");
    const sheets = google.sheets({ version: "v4", auth: apiKey });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    
    const rows = response.data.values || [];
    
    if (rows.length === 0) {
      return result;
    }

    // Assume que a primeira linha é o cabeçalho
    const headers = rows[0] as string[];
    const dataRows = rows.slice(1);
    
    result.totalRows = dataRows.length;

    // Busca projetos existentes para verificar duplicatas
    const existingProjects = await db.getAllProjects();
    const existingNames = new Set(existingProjects.map(p => p.nome.toLowerCase().trim()));

    // Processa cada linha em lotes de 50
    const batchSize = 50;
    for (let i = 0; i < dataRows.length; i += batchSize) {
      const batch = dataRows.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (row: any[], batchIndex: number) => {
          const rowIndex = i + batchIndex + 2; // +2 porque: +1 para header, +1 para index 1-based
          
          try {
            // Mapeia colunas (assumindo ordem: Zona, Nome, Construtora, Endereço, Metragem, Vagas, Valor, Enquadramento)
            const projectData: ProjectRow = {
              zona: row[0] as string,
              nome: row[1] as string,
              construtora: row[2] as string,
              endereco: row[3] as string,
              metragem: row[4] as string,
              vagas: row[5] as string,
              valor: row[6] as string,
              enquadramento: row[7] as string,
            };

            // Valida nome obrigatório
            if (!projectData.nome || projectData.nome.trim() === "") {
              result.errors++;
              result.details.push({
                row: rowIndex,
                nome: "N/A",
                status: "error",
                message: "Nome do projeto não informado",
              });
              return;
            }

            const nomeTrimmed = projectData.nome.trim();

            // Verifica duplicata
            if (syncMode === "new" && existingNames.has(nomeTrimmed.toLowerCase())) {
              result.duplicates++;
              result.details.push({
                row: rowIndex,
                nome: nomeTrimmed,
                status: "duplicate",
                message: "Projeto já existe no sistema",
              });
              return;
            }

            // Parseia dados
            const metragem = parseMetragem(projectData.metragem || "");
            const valor = parseValor(projectData.valor || "");
            const vagas = parseVagas(projectData.vagas || "");
            const zona = normalizarZona(projectData.zona || "");
            const enquadramento = normalizarEnquadramento(projectData.enquadramento || "");

            // Extrai cidade e estado do endereço
            let cidade = "São Paulo";
            let estado = "SP";
            let bairro = "";
            
            if (projectData.endereco) {
              const enderecoLower = projectData.endereco.toLowerCase();
              
              // Tenta extrair cidade
              if (enderecoLower.includes("são paulo")) {
                cidade = "São Paulo";
                estado = "SP";
              } else if (enderecoLower.includes("guarulhos")) {
                cidade = "Guarulhos";
                estado = "SP";
              } else if (enderecoLower.includes("osasco")) {
                cidade = "Osasco";
                estado = "SP";
              }
              
              // Tenta extrair bairro (geralmente vem depois de "-")
              const parts = projectData.endereco.split("-");
              if (parts.length >= 2) {
                bairro = parts[parts.length - 2].trim();
              }
            }

            // Cria projeto
            await db.createProject({
              nome: nomeTrimmed,
              construtora: projectData.construtora || undefined,
              developer: projectData.construtora || undefined,
              endereco: projectData.endereco || undefined,
              bairro: bairro || undefined,
              cidade,
              estado,
              tipo: "mcmv",
              status: "ativo",
              valorMinimo: valor,
              valorMaximo: valor,
              metragemMinima: metragem.min,
              metragemMaxima: metragem.max,
              vagas,
              zona,
              enquadramento,
            });

            result.imported++;
            result.details.push({
              row: rowIndex,
              nome: nomeTrimmed,
              status: "success",
            });
            
            // Adiciona ao set de existentes para evitar duplicatas dentro do mesmo batch
            existingNames.add(nomeTrimmed.toLowerCase());
            
          } catch (error) {
            result.errors++;
            result.details.push({
              row: rowIndex,
              nome: (row[1] as string) || "N/A",
              status: "error",
              message: error instanceof Error ? error.message : "Erro desconhecido",
            });
          }
        })
      );
    }

    return result;
  } catch (error) {
    throw new Error(`Erro ao importar projetos: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
  }
}
