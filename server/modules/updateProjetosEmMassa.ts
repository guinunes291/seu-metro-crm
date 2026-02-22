import { getDb } from "../db";
import { leads } from "../../drizzle/schema";
import { eq, isNull, or } from "drizzle-orm";
import { readGoogleSheet } from "../googleSheets";

const SPREADSHEET_ID = "1or0l4OToJUsGW8FpyGjSOovjc27riV4Wmi0YWQze8X8";
const RANGE = "MASTER_LEADS!A:Z";

/**
 * Normaliza telefone para comparação
 */
function normalizarTelefone(telefone: string): string {
  return telefone.replace(/\D/g, "");
}

/**
 * Extrai números de telefone de uma string
 */
function extrairNumerosTelefone(telefone: string): string {
  const normalized = normalizarTelefone(telefone);
  // Pegar últimos 8 ou 9 dígitos (número sem DDD)
  if (normalized.length >= 8) {
    return normalized.slice(-9); // Últimos 9 dígitos (inclui 9º dígito de celular)
  }
  return normalized;
}

/**
 * Atualiza o campo projetoCustom dos leads que estão sem projeto
 * Busca o projeto na planilha Google Sheets usando telefone e email
 */
export async function updateProjetosEmMassa() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = {
    total: 0,
    atualizados: 0,
    naoEncontrados: 0,
    erros: 0,
    details: [] as Array<{
      leadId: number;
      nome: string;
      telefone: string;
      email: string | null;
      status: "success" | "not_found" | "error";
      projeto?: string;
      message?: string;
    }>,
  };

  try {
    // 1. Buscar todos os leads sem projetoCustom
    const leadsSemProjeto = await db
      .select()
      .from(leads)
      .where(
        or(
          isNull(leads.projetoCustom),
          eq(leads.projetoCustom, "")
        )
      );

    result.total = leadsSemProjeto.length;
    console.log(`[Update Projetos] Encontrados ${result.total} leads sem projeto`);

    if (result.total === 0) {
      return result;
    }

    // 2. Buscar dados da planilha
    console.log("[Update Projetos] Lendo dados da planilha...");
    const sheetData = await readGoogleSheet(SPREADSHEET_ID, RANGE);
    console.log(`[Update Projetos] Lidos ${sheetData.length} registros da planilha`);

    // 3. Criar mapas de telefone -> projeto e email -> projeto
    const projetoMapTelefone = new Map<string, string>();
    const projetoMapEmail = new Map<string, string>();
    
    for (const row of sheetData) {
      if (row.projeto && row.projeto.trim() !== "") {
        const projeto = row.projeto.trim();
        
        // Mapear por telefone
        if (row.telefone && row.telefone.trim() !== "") {
          const telefoneNormalizado = extrairNumerosTelefone(row.telefone);
          if (telefoneNormalizado) {
            projetoMapTelefone.set(telefoneNormalizado, projeto);
          }
        }
        
        // Mapear por email
        if (row.email && row.email.trim() !== "") {
          const emailNormalizado = row.email.toLowerCase().trim();
          projetoMapEmail.set(emailNormalizado, projeto);
        }
      }
    }
    
    console.log(`[Update Projetos] Mapeados ${projetoMapTelefone.size} projetos por telefone`);
    console.log(`[Update Projetos] Mapeados ${projetoMapEmail.size} projetos por email`);

    // 4. Atualizar leads
    for (const lead of leadsSemProjeto) {
      try {
        let projeto: string | undefined;
        
        // Tentar buscar por telefone primeiro
        if (lead.telefone) {
          const telefoneNormalizado = extrairNumerosTelefone(lead.telefone);
          projeto = projetoMapTelefone.get(telefoneNormalizado);
        }
        
        // Se não encontrou por telefone, tentar por email
        if (!projeto && lead.email) {
          const emailNormalizado = lead.email.toLowerCase().trim();
          projeto = projetoMapEmail.get(emailNormalizado);
        }
        
        if (!projeto) {
          result.naoEncontrados++;
          result.details.push({
            leadId: lead.id,
            nome: lead.nome,
            telefone: lead.telefone,
            email: lead.email,
            status: "not_found",
            message: "Projeto não encontrado na planilha (telefone e email não encontrados)",
          });
          continue;
        }

        // Atualizar lead com o projeto
        await db
          .update(leads)
          .set({ projetoCustom: projeto })
          .where(eq(leads.id, lead.id));

        result.atualizados++;
        result.details.push({
          leadId: lead.id,
          nome: lead.nome,
          telefone: lead.telefone,
          email: lead.email,
          status: "success",
          projeto: projeto,
        });

        // Log a cada 100 atualizações
        if (result.atualizados % 100 === 0) {
          console.log(`[Update Projetos] Atualizados ${result.atualizados} leads...`);
        }
      } catch (error) {
        result.erros++;
        result.details.push({
          leadId: lead.id,
          nome: lead.nome,
          telefone: lead.telefone,
          email: lead.email,
          status: "error",
          message: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }
    }

    console.log(`[Update Projetos] Concluído! Atualizados: ${result.atualizados}, Não encontrados: ${result.naoEncontrados}, Erros: ${result.erros}`);
    
    return result;
  } catch (error) {
    console.error("[Update Projetos] Erro:", error);
    throw error;
  }
}

/**
 * Retorna estatísticas de leads sem projeto
 */
export async function getEstatisticasProjetosPendentes() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const leadsSemProjeto = await db
    .select()
    .from(leads)
    .where(
      or(
        isNull(leads.projetoCustom),
        eq(leads.projetoCustom, "")
      )
    );

  const comTelefone = leadsSemProjeto.filter(l => l.telefone !== null && l.telefone !== "").length;
  const comEmail = leadsSemProjeto.filter(l => l.email !== null && l.email !== "").length;
  const comTelefoneOuEmail = leadsSemProjeto.filter(l => 
    (l.telefone !== null && l.telefone !== "") || (l.email !== null && l.email !== "")
  ).length;

  return {
    total: leadsSemProjeto.length,
    comTelefone,
    comEmail,
    comTelefoneOuEmail,
  };
}
