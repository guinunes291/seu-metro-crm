import { readGoogleSheet } from "./server/googleSheets";
import { getDb } from "./server/db";
import { leads } from "./drizzle/schema";
import { eq, isNull, or } from "drizzle-orm";

const SPREADSHEET_ID = "1yoISMuiMPVhd4qyx8BOKzlDaW_xPzlRxGx7ardwMx-E";
const RANGE = "Sheet1!A:Z";

function normalizarTelefone(telefone: string): string {
  return telefone.replace(/\D/g, "");
}

function extrairNumerosTelefone(telefone: string): string {
  const normalized = normalizarTelefone(telefone);
  if (normalized.length >= 8) {
    return normalized.slice(-9);
  }
  return normalized;
}

async function main() {
  try {
    console.log("[Script] Iniciando atualização manual de projetos...");
    
    // 1. Ler planilha
    console.log("[Script] Lendo planilha...");
    const sheetData = await readGoogleSheet(SPREADSHEET_ID, RANGE);
    console.log(`[Script] Lidos ${sheetData.length} registros da planilha`);
    
    // Estatísticas da planilha
    const comProjeto = sheetData.filter(r => r.projeto && r.projeto.trim() !== "").length;
    const semProjeto = sheetData.length - comProjeto;
    console.log(`[Script] Planilha - Com projeto: ${comProjeto}, Sem projeto: ${semProjeto}`);
    
    // 2. Buscar leads sem projeto
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    console.log("[Script] Buscando leads sem projeto...");
    const leadsSemProjeto = await db
      .select()
      .from(leads)
      .where(
        or(
          isNull(leads.projetoCustom),
          eq(leads.projetoCustom, "")
        )
      );
    
    console.log(`[Script] Encontrados ${leadsSemProjeto.length} leads sem projeto`);
    
    // 3. Criar mapas de busca
    const projetoMapTelefone = new Map<string, string>();
    const projetoMapEmail = new Map<string, string>();
    
    for (const row of sheetData) {
      if (row.projeto && row.projeto.trim() !== "") {
        const projeto = row.projeto.trim();
        
        if (row.telefone && row.telefone.trim() !== "") {
          const telefoneNormalizado = extrairNumerosTelefone(row.telefone);
          if (telefoneNormalizado) {
            projetoMapTelefone.set(telefoneNormalizado, projeto);
          }
        }
        
        if (row.email && row.email.trim() !== "") {
          const emailNormalizado = row.email.toLowerCase().trim();
          projetoMapEmail.set(emailNormalizado, projeto);
        }
      }
    }
    
    console.log(`[Script] Mapeados ${projetoMapTelefone.size} projetos por telefone`);
    console.log(`[Script] Mapeados ${projetoMapEmail.size} projetos por email`);
    
    // 4. Atualizar leads
    let atualizados = 0;
    let naoEncontrados = 0;
    let erros = 0;
    
    for (const lead of leadsSemProjeto) {
      try {
        let projeto: string | undefined;
        
        // Buscar por telefone
        if (lead.telefone) {
          const telefoneNormalizado = extrairNumerosTelefone(lead.telefone);
          projeto = projetoMapTelefone.get(telefoneNormalizado);
        }
        
        // Se não encontrou, buscar por email
        if (!projeto && lead.email) {
          const emailNormalizado = lead.email.toLowerCase().trim();
          projeto = projetoMapEmail.get(emailNormalizado);
        }
        
        if (!projeto) {
          naoEncontrados++;
          continue;
        }
        
        // Atualizar lead
        await db
          .update(leads)
          .set({ projetoCustom: projeto })
          .where(eq(leads.id, lead.id));
        
        atualizados++;
        
        if (atualizados % 100 === 0) {
          console.log(`[Script] Atualizados ${atualizados} leads...`);
        }
      } catch (error) {
        erros++;
        console.error(`[Script] Erro ao atualizar lead ${lead.id}:`, error);
      }
    }
    
    console.log("\n[Script] ===== RESULTADO FINAL =====");
    console.log(`Total de leads sem projeto: ${leadsSemProjeto.length}`);
    console.log(`Atualizados: ${atualizados}`);
    console.log(`Não encontrados: ${naoEncontrados}`);
    console.log(`Erros: ${erros}`);
    console.log("====================================\n");
    
  } catch (error) {
    console.error("[Script] Erro fatal:", error);
    process.exit(1);
  }
}

main().then(() => {
  console.log("[Script] Concluído!");
  process.exit(0);
}).catch((error) => {
  console.error("[Script] Erro:", error);
  process.exit(1);
});
