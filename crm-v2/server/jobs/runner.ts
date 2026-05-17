import { agendarDistribuicao } from "./distribuicao.job.js";
import { agendarTimer } from "./timer.job.js";
import { agendarPriorizacao } from "./priorizacao.job.js";
import { getDb } from "../_core/db.js";
import { resetLeadsRecebidos } from "../modules/distribuicao/repository.js";

function horaAtualSP(): number {
  return parseInt(
    new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }),
    10
  );
}

let resetRanToday = false;

function agendarResetDiario(): void {
  const verificar = async () => {
    const hora = horaAtualSP();
    if (hora === 0 && !resetRanToday) {
      resetRanToday = true;
      try {
        const db = await getDb();
        if (db) {
          await resetLeadsRecebidos(db);
          console.log("[Job Reset] Contadores de leads zerados para novo dia");
        }
      } catch (err) {
        console.error("[Job Reset]", err);
      }
    } else if (hora !== 0) {
      resetRanToday = false;
    }
  };

  setInterval(() => { verificar().catch(console.error); }, 60 * 60 * 1000);
}

export function startAllJobs(): void {
  agendarDistribuicao();
  agendarTimer();
  agendarPriorizacao();
  agendarResetDiario();
  console.log("[Jobs] Todos os jobs iniciados");
}
