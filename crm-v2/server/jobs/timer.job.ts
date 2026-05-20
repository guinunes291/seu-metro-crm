import { getDb } from "../_core/db.js";
import { notifySSEUser } from "../_core/sse.js";
import { getLeadsComTimerAtivo } from "../modules/leads/repository.js";
import { redistribuirLeadTimedOut } from "../modules/distribuicao/service.js";

let isRunning = false;

export async function runTimerJob(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  try {
    const db = await getDb();
    if (!db) return;

    const leadsExpirados = await getLeadsComTimerAtivo(db);
    if (leadsExpirados.length === 0) return;

    for (const lead of leadsExpirados) {
      const corretorAnterior = lead.corretorId;
      const resultado = await redistribuirLeadTimedOut(db, lead.id);

      if (corretorAnterior) {
        notifySSEUser(corretorAnterior, "timer_expired", {
          leadId: lead.id,
          leadNome: lead.nome,
          resultado,
        });
      }

      console.log(`[Job Timer] Lead #${lead.id} — ${resultado}`);
    }
  } catch (err) {
    console.error("[Job Timer]", err);
  } finally {
    isRunning = false;
  }
}

export function agendarTimer(): void {
  setInterval(() => { runTimerJob().catch(console.error); }, 2 * 60 * 1000);
  console.log("[Job Timer] Agendado — executa a cada 2 min");
}
