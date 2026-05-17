import { getDb } from "../_core/db.js";
import { getEstoqueAguardando } from "../modules/distribuicao/repository.js";
import { processarLeadEstoque } from "../modules/distribuicao/service.js";

let isRunning = false;

export async function runDistribuicaoJob(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  try {
    const db = await getDb();
    if (!db) return;

    const estoque = await getEstoqueAguardando(db);
    if (estoque.length === 0) return;

    let distributed = 0;
    for (const item of estoque) {
      const ok = await processarLeadEstoque(db, item.leadId, item.tipoFila);
      if (ok) distributed++;
      else break; // No corretor available — stop processing
    }

    if (distributed > 0) {
      console.log(`[Job Distribuição] ${distributed} lead(s) distribuídos`);
    }
  } catch (err) {
    console.error("[Job Distribuição]", err);
  } finally {
    isRunning = false;
  }
}

export function agendarDistribuicao(): void {
  setInterval(() => { runDistribuicaoJob().catch(console.error); }, 10 * 60 * 1000);
  setTimeout(() => { runDistribuicaoJob().catch(console.error); }, 5000);
  console.log("[Job Distribuição] Agendado — executa a cada 10 min");
}
