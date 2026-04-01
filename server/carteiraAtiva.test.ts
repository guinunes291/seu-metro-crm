/**
 * Testes da Carteira Ativa
 * Verifica que o router usa os campos corretos do schema de leads
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("carteiraAtiva router - campos do schema", () => {
  const routerPath = resolve(__dirname, "routers/carteiraAtiva.ts");
  const routerContent = readFileSync(routerPath, "utf-8");

  const schemaPath = resolve(__dirname, "../drizzle/schema.ts");
  const schemaContent = readFileSync(schemaPath, "utf-8");

  it("não deve usar leads.projeto (campo inexistente)", () => {
    // leads.projeto não existe no schema — deve usar projetoCustom
    expect(routerContent).not.toMatch(/leads\.projeto\b(?!Custom)/);
  });

  it("deve usar leads.projetoCustom para o campo de projeto", () => {
    expect(routerContent).toContain("leads.projetoCustom");
  });

  it("campo projetoCustom deve existir na tabela leads do schema", () => {
    // Verificar que projetoCustom está definido na tabela leads
    const leadsStart = schemaContent.indexOf('export const leads = mysqlTable("leads"');
    const leadsEnd = schemaContent.indexOf('\nexport const', leadsStart + 1);
    const leadsDefinition = schemaContent.slice(leadsStart, leadsEnd);
    expect(leadsDefinition).toContain("projetoCustom");
  });

  it("campo projeto não deve existir como coluna na tabela leads", () => {
    const leadsStart = schemaContent.indexOf('export const leads = mysqlTable("leads"');
    const leadsEnd = schemaContent.indexOf('\nexport const', leadsStart + 1);
    const leadsDefinition = schemaContent.slice(leadsStart, leadsEnd);
    // projeto: não deve existir como campo (apenas projetoCustom e projectId)
    expect(leadsDefinition).not.toMatch(/^\s+projeto\s*:/m);
  });
});
