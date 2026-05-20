import { getDb } from "../_core/db.js";
import { invokeLLM } from "../_core/llm.js";
import { notifySSEUser } from "../_core/sse.js";
import { eq, and, ne } from "drizzle-orm";
import { users, leads, projects, jobControl, notifications } from "../../drizzle/schema/index.js";

let isRunning = false;

function hojeStrSP(): string {
  return new Date()
    .toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
    .split("/")
    .reverse()
    .join("-");
}

function horaAtualSP(): number {
  return parseInt(
    new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }),
    10
  );
}

function buildResumoLead(lead: {
  id: number; nome: string; status: string; temperatura: string | null;
  ultimaInteracao: Date | null; createdAt: Date; proximoFollowup: Date | null;
  projetoNome: string | null;
}): string {
  const diasSem = lead.ultimaInteracao
    ? Math.floor((Date.now() - new Date(lead.ultimaInteracao).getTime()) / 86_400_000)
    : Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / 86_400_000);

  let linha = `ID:${lead.id} | ${lead.nome} | Status:${lead.status}`;
  if (lead.temperatura) linha += ` | Temp:${lead.temperatura}`;
  if (lead.projetoNome) linha += ` | Projeto:${lead.projetoNome}`;
  linha += ` | DiasSemContato:${diasSem}`;
  if (lead.proximoFollowup) {
    linha += ` | Followup:${new Date(lead.proximoFollowup).toLocaleDateString("pt-BR")}`;
  }
  return linha;
}

export async function runPriorizacaoJob(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  try {
    const db = await getDb();
    if (!db) return;

    // Idempotência diária
    const hoje = hojeStrSP();
    const lastRun = await db
      .select()
      .from(jobControl)
      .where(eq(jobControl.key, "priorizacao_ultima_execucao"))
      .limit(1);
    if (lastRun[0]?.value === hoje) return;

    console.log("[Job Priorização] Iniciando...");

    const corretores = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.role, "corretor"), eq(users.status, "presente")));

    for (const corretor of corretores) {
      try {
        const leadsCorretor = await db
          .select({
            id: leads.id,
            nome: leads.nome,
            status: leads.status,
            temperatura: leads.temperatura,
            ultimaInteracao: leads.ultimaInteracao,
            createdAt: leads.createdAt,
            proximoFollowup: leads.proximoFollowup,
            projetoNome: projects.nome,
          })
          .from(leads)
          .leftJoin(projects, eq(leads.projetoId, projects.id))
          .where(
            and(
              eq(leads.corretorId, corretor.id),
              ne(leads.status, "perdido"),
              ne(leads.status, "contrato_fechado"),
              eq(leads.naLixeira, false)
            )
          )
          .limit(40);

        if (leadsCorretor.length === 0) continue;

        const contexto = leadsCorretor.map(buildResumoLead).join("\n");

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Você é um coach de vendas imobiliárias. Analise a carteira e escolha os 5 leads mais urgentes para contato HOJE. Responda SOMENTE em JSON puro sem markdown:\n{"prioridades":[{"leadId":N,"leadNome":"...","motivo":"1 frase","acao":"ação concreta"}]}`,
            },
            {
              role: "user",
              content: `Carteira do corretor ${corretor.name}:\n${contexto}`,
            },
          ],
        });

        const raw = (() => {
          const content = response.choices[0]?.message?.content;
          if (!content) return "";
          if (typeof content === "string") return content;
          return (content as Array<{ type: string; text?: string }>)
            .filter((p) => p.type === "text")
            .map((p) => p.text ?? "")
            .join("");
        })();

        let prioridades: Array<{ leadId: number; leadNome: string; motivo: string; acao: string }> = [];
        try {
          let json = raw.trim();
          if (json.includes("```json")) json = json.split("```json")[1]!.split("```")[0]!.trim();
          else if (json.includes("```")) json = json.split("```")[1]!.split("```")[0]!.trim();
          const parsed = JSON.parse(json) as { prioridades: typeof prioridades };
          prioridades = (parsed.prioridades ?? []).slice(0, 5);
        } catch {
          continue;
        }

        if (prioridades.length === 0) continue;

        await db.insert(notifications).values({
          userId: corretor.id,
          titulo: `[IA] Leads prioritários — ${new Date().toLocaleDateString("pt-BR")}`,
          mensagem: JSON.stringify(prioridades),
          tipo: "ia_priorizacao",
          lida: false,
        });

        notifySSEUser(corretor.id, "ia_priorizacao_diaria", { prioridades });
        console.log(`[Job Priorização] ${prioridades.length} leads para ${corretor.name}`);
      } catch (err) {
        console.error(`[Job Priorização] Erro para corretor #${corretor.id}:`, err);
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    // Marcar como executado hoje
    const existing = lastRun[0];
    if (existing) {
      await db.update(jobControl).set({ value: hoje }).where(eq(jobControl.key, "priorizacao_ultima_execucao"));
    } else {
      await db.insert(jobControl).values({ key: "priorizacao_ultima_execucao", value: hoje });
    }

    console.log("[Job Priorização] Concluído.");
  } catch (err) {
    console.error("[Job Priorização]", err);
  } finally {
    isRunning = false;
  }
}

export function agendarPriorizacao(): void {
  const verificar = () => {
    if (horaAtualSP() === 7) {
      runPriorizacaoJob().catch(console.error);
    }
  };
  setInterval(verificar, 60 * 60 * 1000);
  setTimeout(verificar, 5000);
  console.log("[Job Priorização] Agendado — executa diariamente às 7h SP");
}
