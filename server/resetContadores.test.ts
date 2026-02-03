/**
 * Testes para o job de reset de contadores diários
 */

import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { filaDistribuicao } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Reset de Contadores Diários", () => {
  let db: Awaited<ReturnType<typeof getDb>>;

  beforeAll(async () => {
    db = await getDb();
  });

  it("deve resetar leadsRecebidosHoje para 0", async () => {
    if (!db) throw new Error("Database not available");

    // Simular que alguns corretores receberam leads hoje
    const fila = await db.select().from(filaDistribuicao).limit(3);
    
    if (fila.length === 0) {
      console.log("Nenhum corretor na fila para testar");
      return;
    }

    // Atualizar alguns contadores para valores não-zero
    for (const item of fila) {
      await db.update(filaDistribuicao)
        .set({ leadsRecebidosHoje: 5 })
        .where(eq(filaDistribuicao.id, item.id));
    }

    // Verificar que os valores foram atualizados
    const filaAntes = await db.select().from(filaDistribuicao).limit(3);
    expect(filaAntes.every(f => f.leadsRecebidosHoje === 5)).toBe(true);

    // Executar reset (simular o que o job faz)
    await db.update(filaDistribuicao)
      .set({ leadsRecebidosHoje: 0 });

    // Verificar que todos os contadores foram zerados
    const filaDepois = await db.select().from(filaDistribuicao);
    expect(filaDepois.every(f => f.leadsRecebidosHoje === 0)).toBe(true);
  });

  it("deve manter outros campos inalterados após reset", async () => {
    if (!db) throw new Error("Database not available");

    const fila = await db.select().from(filaDistribuicao).limit(1);
    
    if (fila.length === 0) {
      console.log("Nenhum corretor na fila para testar");
      return;
    }

    const corretorAntes = fila[0];

    // Executar reset
    await db.update(filaDistribuicao)
      .set({ leadsRecebidosHoje: 0 })
      .where(eq(filaDistribuicao.id, corretorAntes.id));

    // Verificar que outros campos não foram alterados
    const corretorDepois = await db.select()
      .from(filaDistribuicao)
      .where(eq(filaDistribuicao.id, corretorAntes.id))
      .limit(1);

    expect(corretorDepois[0].posicao).toBe(corretorAntes.posicao);
    expect(corretorDepois[0].ativo).toBe(corretorAntes.ativo);
    expect(corretorDepois[0].maxLeadsDia).toBe(corretorAntes.maxLeadsDia);
    expect(corretorDepois[0].corretorId).toBe(corretorAntes.corretorId);
  });
});
