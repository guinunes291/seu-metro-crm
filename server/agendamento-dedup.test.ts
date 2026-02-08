import { describe, it, expect } from "vitest";
import * as db from "./db";

describe("Agendamento - Verificação de duplicação", () => {
  it("checkAgendamentoDuplicado deve ser uma função exportada", () => {
    expect(typeof db.checkAgendamentoDuplicado).toBe("function");
  });

  it("checkAgendamentoDuplicado deve retornar boolean", async () => {
    const result = await db.checkAgendamentoDuplicado({
      leadId: 999999, // ID inexistente
      dataAgendamento: new Date("2026-01-01"),
      horaAgendamento: "10:00",
    });
    expect(typeof result).toBe("boolean");
    expect(result).toBe(false); // Não deve existir agendamento para lead inexistente
  });

  it("createAgendamento deve ser uma função exportada", () => {
    expect(typeof db.createAgendamento).toBe("function");
  });
});
