import { getDb } from "./db";
import { leads, projects } from "../drizzle/schema";
import { readGoogleSheet, extractSpreadsheetId } from "./googleSheets";
import { eq, or, inArray, sql, desc } from "drizzle-orm";

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
 * Normaliza o telefone para formato padrão (apenas números)
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
 * Extrai apenas os números do telefone para comparação
 */
function extractPhoneNumbers(telefone: string): string {
  return telefone.replace(/\D/g, "");
}

/**
 * Mapeia origem da planilha para valores válidos do enum
 */
function mapOrigem(origem: string | undefined | null): string | null {
  if (!origem || origem.trim() === "") return "google_sheets";
  
  const origemLower = origem.trim().toLowerCase();
  
  // Mapeamento de valores comuns da planilha para o enum
  const origemMap: Record<string, string> = {
    "facebook": "facebook",
    "google sheets": "google_sheets",
    "google_sheets": "google_sheets",
    "site": "site",
    "indicação": "indicacao",
    "indicacao": "indicacao",
    "captação corretor": "captacao_corretor",
    "captacao corretor": "captacao_corretor",
    "captacao_corretor": "captacao_corretor",
    "instagram": "instagram",
    "whatsapp": "whatsapp",
    "telefone": "telefone",
    "outro": "outro",
  };
  
  return origemMap[origemLower] || "google_sheets";
}

/**
 * Mapeia status da planilha para status do sistema
 */
function mapStatus(status: string): string {
  if (!status) return "novo";
  
  const statusMap: Record<string, string> = {
    "novo": "novo",
    "aguardando atendimento": "aguardando_atendimento",
    "aguardando_atendimento": "aguardando_atendimento",
    "em atendimento": "em_atendimento",
    "em_atendimento": "em_atendimento",
    "agendado": "agendado",
    "visita realizada": "visita_realizada",
    "visita_realizada": "visita_realizada",
    "análise de crédito": "analise_credito",
    "analise de credito": "analise_credito",
    "analise_credito": "analise_credito",
    "contrato fechado": "contrato_fechado",
    "contrato_fechado": "contrato_fechado",
    "perdido": "perdido",
  };

  const normalized = status.toLowerCase().trim();
  return statusMap[normalized] || "novo";
}

/**
 * Normaliza o nome de um projeto para evitar duplicatas
 * Remove acentos, converte para lowercase, remove espaços extras
 */
function normalizeProjectName(name: string): string {
  if (!name) return "";
  
  return name
    .trim()
    .toLowerCase()
    // Remover acentos
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Remover espaços extras (múltiplos espaços viram um só)
    .replace(/\s+/g, " ")
    // Remover caracteres especiais extras
    .replace(/[^a-z0-9\s-]/g, "")
    .trim();
}

/**
 * @deprecated Esta função NÃO DEVE MAIS SER USADA na importação de leads.
 * O campo "projeto" da planilha deve ser armazenado em projetoCustom (texto livre).
 * Esta função está mantida apenas para compatibilidade com testes antigos.
 * 
 * Busca um projeto existente baseado na origem
 * Se não encontrar, CRIA automaticamente um novo projeto
 * Usa normalização de nomes para evitar duplicatas
 */
export async function findExistingProject(origem: string): Promise<number | null> {
  if (!origem || origem.trim() === "") return null;

  const db = await getDb();
  if (!db) return null;

  try {
    const normalizedName = normalizeProjectName(origem);
    
    // Buscar projeto existente comparando nomes normalizados
    const allProjects = await db
      .select()
      .from(projects);
    
    // Encontrar projeto com nome normalizado igual
    const existing = allProjects.find(p => 
      normalizeProjectName(p.nome) === normalizedName
    );

    if (existing) {
      console.log(`[findExistingProject] Projeto encontrado: "${origem}" -> ID ${existing.id} ("${existing.nome}")`);
      return existing.id;
    }

    // Se não encontrar, criar novo projeto automaticamente
    console.log(`[findExistingProject] Criando novo projeto: ${origem}`);
    
    const newProject = await db.insert(projects).values({
      nome: origem.trim(),
      cidade: "São Paulo",
      estado: "SP",
      tipo: "mcmv",
      status: "ativo",
    });

    // Retornar o ID do projeto recém-criado
    const projectId = Number(newProject.insertId);
    console.log(`[findExistingProject] Projeto criado com ID: ${projectId}`);
    
    return projectId;
  } catch (error) {
    console.error(`Erro ao buscar/criar projeto ${origem}:`, error);
    return null;
  }
}

/**
 * Busca leads existentes em lote para otimizar performance
 */
async function getExistingLeads(telefones: string[]): Promise<Set<string>> {
  const db = await getDb();
  if (!db || telefones.length === 0) return new Set();

  try {
    // Normalizar telefones da planilha (apenas números)
    const normalizedPhones = telefones.map(t => extractPhoneNumbers(t));
    
    // Buscar leads cujo telefone (apenas números) corresponda a algum da lista
    // Usamos REGEXP_REPLACE para remover caracteres não numéricos no SQL
    const existing = await db
      .select({ telefone: leads.telefone })
      .from(leads)
      .where(
        sql`REGEXP_REPLACE(${leads.telefone}, '[^0-9]', '') IN (${sql.join(normalizedPhones.map(p => sql`${p}`), sql`, `)})`
      );

    // Retornar Set de telefones normalizados (apenas números)
    return new Set(existing.map(l => extractPhoneNumbers(l.telefone)));
  } catch (error) {
    console.error("Erro ao buscar leads existentes:", error);
    return new Set();
  }
}

/**
 * Importa leads de uma planilha do Google Sheets
 * Usa importação em lotes para melhor performance
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

    // Processar em lotes de 100 para melhor performance
    const BATCH_SIZE = 100;
    
    for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
      const batch = rows.slice(batchStart, batchStart + BATCH_SIZE);
      
      // Buscar todos os telefones existentes deste lote de uma vez
      const batchTelefones = batch
        .filter(row => row.telefone)
        .map(row => normalizeTelefone(row.telefone));
      
      const existingPhones = await getExistingLeads(batchTelefones);

      // Processar cada lead do lote
      for (let i = 0; i < batch.length; i++) {
        const row = batch[i];
        const rowNumber = batchStart + i + 2; // +2 porque linha 1 é header e arrays começam em 0

        try {
          // Validar dados mínimos
          if (!row.nome || row.nome.trim() === "") {
            result.errors++;
            result.details.push({
              row: rowNumber,
              nome: row.nome || "Sem nome",
              status: "error",
              message: "Nome ausente",
            });
            continue;
          }

          if (!row.telefone || row.telefone.trim() === "") {
            result.errors++;
            result.details.push({
              row: rowNumber,
              nome: row.nome,
              status: "error",
              message: "Telefone ausente",
            });
            continue;
          }

          // Verificar duplicata por telefone
          const normalizedPhone = normalizeTelefone(row.telefone);
          const phoneNumbers = extractPhoneNumbers(normalizedPhone);
          
          if (existingPhones.has(phoneNumbers)) {
            result.duplicates++;
            result.details.push({
              row: rowNumber,
              nome: row.nome,
              status: "duplicate",
              message: "Lead já existe no sistema (telefone duplicado)",
            });
            continue;
          }

          // Armazenar projeto como texto livre (projetoCustom)
          // NÃO criar projetos automaticamente na tabela projects
          const projectName = row.projeto && row.projeto.trim() !== "" ? row.projeto.trim() : null;

          // Preparar dados do lead
          const leadStatus = mapStatus(row.status || "");
          const leadOrigem = mapOrigem(row.origem);
          
          // Importar lead
          await db.insert(leads).values({
            idPrincipal: row.id || null,
            nome: row.nome.trim(),
            email: row.email && row.email.trim() !== "" ? row.email.trim() : null,
            telefone: normalizedPhone,
            origem: leadOrigem as any,
            projectId: null,
            projetoCustom: projectName,
            status: leadStatus as any,
            dataDistribuicao: row.dataDistribuicao && row.dataDistribuicao.trim() !== "" 
              ? new Date(row.dataDistribuicao) 
              : null,
            faixaRenda: row.faixaRenda && row.faixaRenda.trim() !== "" ? row.faixaRenda.trim() : null,
            prefereContatoPor: row.prefereContatoPor && row.prefereContatoPor.trim() !== "" ? row.prefereContatoPor.trim() : null,
            finalidadeImovel: row.finalidadeImovel && row.finalidadeImovel.trim() !== "" ? row.finalidadeImovel.trim() : null,
          });

          // Adicionar ao set de existentes para evitar duplicatas dentro do mesmo batch
          existingPhones.add(phoneNumbers);

          // Buscar ID do lead recém-inserido para distribuição
          const newLeadQuery = await db
            .select()
            .from(leads)
            .where(eq(leads.telefone, normalizedPhone))
            .orderBy(desc(leads.id))
            .limit(1);
          
          const newLeadId = newLeadQuery[0]?.id;

          result.imported++;
          
          // Lead importado sem distribuição automática
          
          // Só adicionar aos detalhes se for erro ou primeiros 100 importados
          if (result.imported <= 100) {
            result.details.push({
              row: rowNumber,
              nome: row.nome,
              status: "imported",
              message: "Importado com sucesso",
            });
          }
        } catch (error: any) {
          result.errors++;
          
          let errorMessage = "Erro desconhecido";
          if (error.message) {
            errorMessage = error.message;
            // Simplificar mensagens de erro SQL
            if (errorMessage.includes("Duplicate entry")) {
              errorMessage = "Telefone duplicado";
            } else if (errorMessage.length > 100) {
              errorMessage = errorMessage.substring(0, 100) + "...";
            }
          }
          
          result.details.push({
            row: rowNumber,
            nome: row.nome || "Desconhecido",
            status: "error",
            message: errorMessage,
          });
        }
      }
    }

    // Limitar detalhes para não sobrecarregar a resposta
    if (result.details.length > 200) {
      result.details = [
        ...result.details.filter(d => d.status === "error").slice(0, 100),
        ...result.details.filter(d => d.status === "duplicate").slice(0, 50),
        ...result.details.filter(d => d.status === "imported").slice(0, 50),
      ];
    }

    return result;
  } catch (error: any) {
    throw new Error(`Erro ao importar planilha: ${error.message}`);
  }
}

/**
 * Importa apenas leads novos (sincronização incremental)
 * E atualiza leads existentes com projetoCustom se estiver vazio
 */
export async function syncLeadsFromSheet(
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

    // Processar em lotes de 100 para melhor performance
    const BATCH_SIZE = 100;
    
    for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
      const batch = rows.slice(batchStart, batchStart + BATCH_SIZE);
      
      // Buscar leads existentes por idPrincipal, telefone e email
      const batchIdsPrincipais = batch.filter(row => row.id).map(row => String(row.id));
      const batchTelefones = batch.filter(row => row.telefone).map(row => extractPhoneNumbers(normalizeTelefone(row.telefone)));
      const batchEmails = batch.filter(row => row.email).map(row => row.email.toLowerCase().trim());
      
      const existingIds = new Set<string>();
      const existingPhones = new Set<string>();
      const existingEmails = new Set<string>();
      
      // Buscar por idPrincipal
      if (batchIdsPrincipais.length > 0) {
        const byId = await db
          .select({ idPrincipal: leads.idPrincipal })
          .from(leads)
          .where(inArray(leads.idPrincipal, batchIdsPrincipais));
        byId.forEach(l => existingIds.add(l.idPrincipal));
      }
      
      // Buscar por telefone
      if (batchTelefones.length > 0) {
        const byPhone = await db
          .select({ telefone: leads.telefone })
          .from(leads)
          .where(
            sql`REGEXP_REPLACE(${leads.telefone}, '[^0-9]', '') IN (${sql.join(batchTelefones.map(p => sql`${p}`), sql`, `)})`
          );
        byPhone.forEach(l => existingPhones.add(extractPhoneNumbers(l.telefone)));
      }
      
      // Buscar por email
      if (batchEmails.length > 0) {
        const byEmail = await db
          .select({ email: leads.email })
          .from(leads)
          .where(inArray(leads.email, batchEmails));
        byEmail.forEach(l => l.email && existingEmails.add(l.email.toLowerCase().trim()));
      }

      for (let i = 0; i < batch.length; i++) {
        const row = batch[i];
        const rowNumber = batchStart + i + 2;

        try {
          // Validar dados obrigatórios
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

          const idPrincipal = String(row.id);
          const normalizedPhone = normalizeTelefone(row.telefone);
          const phoneNumbers = extractPhoneNumbers(normalizedPhone);
          const normalizedEmail = row.email ? row.email.toLowerCase().trim() : null;

          // Verificar duplicatas por idPrincipal, telefone ou email
          if (existingIds.has(idPrincipal) || existingPhones.has(phoneNumbers) || (normalizedEmail && existingEmails.has(normalizedEmail))) {
            // Lead existente - atualizar projetoCustom se necessário
            const projectName = row.projeto && row.projeto.trim() !== "" ? row.projeto.trim() : null;
            if (projectName) {
              // Buscar lead existente pelo telefone
              const existingLead = await db
                .select()
                .from(leads)
                .where(eq(leads.telefone, normalizedPhone))
                .limit(1);

              if (existingLead.length > 0) {
                const lead = existingLead[0];
                
                // Atualizar apenas se projetoCustom estiver vazio
                if (!lead.projetoCustom || lead.projetoCustom.trim() === "") {
                  await db
                    .update(leads)
                    .set({
                      projetoCustom: projectName,
                    })
                    .where(eq(leads.id, lead.id));
                  
                  result.details.push({
                    row: rowNumber,
                    nome: row.nome,
                    status: "duplicate",
                    message: `Lead atualizado com projeto: ${projectName}`,
                  });
                } else {
                  result.details.push({
                    row: rowNumber,
                    nome: row.nome,
                    status: "duplicate",
                    message: "Lead já possui projeto",
                  });
                }
              }
            }
            
            result.duplicates++;
            continue;
          }

          // Lead novo - importar normalmente
          const projectName = row.projeto && row.projeto.trim() !== "" ? row.projeto.trim() : null;
          const leadStatus = mapStatus(row.status || "");
          const leadOrigem = mapOrigem(row.origem);
          
          await db.insert(leads).values({
            idPrincipal: row.id || null,
            nome: row.nome.trim(),
            email: row.email && row.email.trim() !== "" ? row.email.trim() : null,
            telefone: normalizedPhone,
            origem: leadOrigem as any,
            projectId: null,
            projetoCustom: projectName,
            status: leadStatus as any,
            dataDistribuicao: row.dataDistribuicao && row.dataDistribuicao.trim() !== "" 
              ? new Date(row.dataDistribuicao) 
              : null,
            faixaRenda: row.faixaRenda && row.faixaRenda.trim() !== "" ? row.faixaRenda.trim() : null,
            prefereContatoPor: row.prefereContatoPor && row.prefereContatoPor.trim() !== "" ? row.prefereContatoPor.trim() : null,
            finalidadeImovel: row.finalidadeImovel && row.finalidadeImovel.trim() !== "" ? row.finalidadeImovel.trim() : null,
          });

          existingPhones.add(phoneNumbers);
          result.imported++;
          result.details.push({
            row: rowNumber,
            nome: row.nome,
            status: "imported",
            message: "Lead importado com sucesso",
          });
        } catch (error) {
          console.error(`Erro ao processar lead ${rowNumber}:`, error);
          result.errors++;
          result.details.push({
            row: rowNumber,
            nome: row.nome || "Desconhecido",
            status: "error",
            message: error instanceof Error ? error.message : "Erro desconhecido",
          });
        }
      }
    }

    return result;
  } catch (error) {
    console.error("Erro ao sincronizar leads:", error);
    throw error;
  }
}
