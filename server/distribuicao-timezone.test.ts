import { describe, it, expect } from "vitest";
import { fimDoDiaHoje, fimDoDia, inicioDoDiaHoje, inicioDoDia } from "./timezone";

describe("timezone - fimDoDia", () => {
  it("fimDoDiaHoje deve retornar uma data válida (não NaN)", () => {
    const fim = fimDoDiaHoje();
    expect(fim).toBeInstanceOf(Date);
    expect(isNaN(fim.getTime())).toBe(false);
  });

  it("fimDoDiaHoje deve ser posterior ao inicioDoDiaHoje", () => {
    const inicio = inicioDoDiaHoje();
    const fim = fimDoDiaHoje();
    expect(fim.getTime()).toBeGreaterThan(inicio.getTime());
  });

  it("fimDoDia deve retornar uma data válida para uma data qualquer", () => {
    const dataRef = new Date("2026-03-09T12:00:00Z");
    const fim = fimDoDia(dataRef);
    expect(fim).toBeInstanceOf(Date);
    expect(isNaN(fim.getTime())).toBe(false);
  });

  it("fimDoDia deve ser posterior ao inicioDoDia para a mesma data", () => {
    const dataRef = new Date("2026-03-09T12:00:00Z");
    const inicio = inicioDoDia(dataRef);
    const fim = fimDoDia(dataRef);
    expect(fim.getTime()).toBeGreaterThan(inicio.getTime());
  });

  it("fimDoDia deve ser no máximo 24h após inicioDoDia", () => {
    const dataRef = new Date("2026-03-09T12:00:00Z");
    const inicio = inicioDoDia(dataRef);
    const fim = fimDoDia(dataRef);
    const diffMs = fim.getTime() - inicio.getTime();
    const diffHoras = diffMs / (1000 * 60 * 60);
    // Deve ser aproximadamente 24h (entre 23h e 25h)
    expect(diffHoras).toBeGreaterThan(23);
    expect(diffHoras).toBeLessThan(25);
  });

  it("fimDoDiaHoje não deve ter hora 26 (bug corrigido)", () => {
    const fim = fimDoDiaHoje();
    // Hora 26 em Date.UTC retorna NaN em alguns ambientes
    // Verificar que a data é válida e tem hora <= 23 em UTC
    expect(isNaN(fim.getTime())).toBe(false);
    const horaUTC = fim.getUTCHours();
    // Hora UTC deve ser 2 (que representa 23:59 SP)
    expect(horaUTC).toBe(2);
  });
});

describe("distribution - MINIMO_LEADS_GARANTIDO", () => {
  it("deve usar 40 como mínimo de leads garantido", async () => {
    // Verificar que as constantes foram atualizadas
    const fs = await import("fs");
    const content = fs.readFileSync("./server/distribution.ts", "utf-8");
    expect(content).toContain("const MINIMO_LEADS_GARANTIDO = 40");
    expect(content).toContain("const PERCENTUAL_CONCLUSAO_MINIMO = 0.6");
  });
});
