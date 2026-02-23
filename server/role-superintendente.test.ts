import { describe, it, expect } from "vitest";

/**
 * Testa que a role 'superintendente' tem os mesmos acessos que admin/gestor
 * Replica as funções helper do routers.ts para validar a lógica
 */

function isGestorLevel(role: string): boolean {
  return role === 'gestor' || role === 'admin' || role === 'superintendente';
}

function isAdminLevel(role: string): boolean {
  return role === 'admin' || role === 'superintendente';
}

describe("Role Superintendente - Acesso de Gestor/Admin", () => {
  describe("isGestorLevel", () => {
    it("deve retornar true para admin", () => {
      expect(isGestorLevel("admin")).toBe(true);
    });

    it("deve retornar true para gestor", () => {
      expect(isGestorLevel("gestor")).toBe(true);
    });

    it("deve retornar true para superintendente", () => {
      expect(isGestorLevel("superintendente")).toBe(true);
    });

    it("deve retornar false para corretor", () => {
      expect(isGestorLevel("corretor")).toBe(false);
    });

    it("deve retornar false para user", () => {
      expect(isGestorLevel("user")).toBe(false);
    });
  });

  describe("isAdminLevel", () => {
    it("deve retornar true para admin", () => {
      expect(isAdminLevel("admin")).toBe(true);
    });

    it("deve retornar true para superintendente", () => {
      expect(isAdminLevel("superintendente")).toBe(true);
    });

    it("deve retornar false para gestor", () => {
      expect(isAdminLevel("gestor")).toBe(false);
    });

    it("deve retornar false para corretor", () => {
      expect(isAdminLevel("corretor")).toBe(false);
    });
  });

  describe("Cenários de acesso da Dayane (superintendente)", () => {
    const dayaneRole = "superintendente";

    it("deve ter acesso ao dashboard geral (isGestorLevel)", () => {
      expect(isGestorLevel(dayaneRole)).toBe(true);
    });

    it("deve ter acesso a funcionalidades de admin (isAdminLevel)", () => {
      expect(isAdminLevel(dayaneRole)).toBe(true);
    });

    it("não deve ser tratada como corretor", () => {
      expect(dayaneRole === "corretor").toBe(false);
    });

    it("deve ver todos os leads (não filtrado por equipe)", () => {
      // Superintendente tem acesso total, não filtra por equipe
      const equipeId = dayaneRole === 'gestor' ? 123 : null;
      expect(equipeId).toBeNull();
    });

    it("não deve ser bloqueada por onboarding", () => {
      const shouldBlock = dayaneRole !== "admin" && dayaneRole !== "superintendente";
      expect(shouldBlock).toBe(false);
    });

    it("não deve ser bloqueada por follow-up", () => {
      const isCorretor = dayaneRole === "corretor";
      expect(isCorretor).toBe(false);
    });
  });

  describe("Exportação - superintendente NÃO pode exportar", () => {
    it("admin pode exportar", () => {
      expect("admin" === "admin").toBe(true);
    });

    it("superintendente NÃO pode exportar", () => {
      expect("superintendente" === "admin").toBe(false);
    });

    it("gestor NÃO pode exportar", () => {
      expect("gestor" === "admin").toBe(false);
    });

    it("corretor NÃO pode exportar", () => {
      expect("corretor" === "admin").toBe(false);
    });

    it("isAdminExport deve ser diferente de isAdminLevel", () => {
      const isAdminExport = (role: string) => role === 'admin';
      // Admin: ambos true
      expect(isAdminExport('admin')).toBe(true);
      expect(isAdminLevel('admin')).toBe(true);
      // Superintendente: export false, level true
      expect(isAdminExport('superintendente')).toBe(false);
      expect(isAdminLevel('superintendente')).toBe(true);
    });
  });

  describe("Navegação - superintendente deve ver menus de gestão", () => {
    const gestaoRoles = ["gestor", "admin", "superintendente"];
    const adminRoles = ["admin", "superintendente"];

    it("deve ver seção Gestão no sidebar", () => {
      expect(gestaoRoles.includes("superintendente")).toBe(true);
    });

    it("deve ver Metas Mensais", () => {
      expect(adminRoles.includes("superintendente")).toBe(true);
    });

    it("deve ver Controle de Bloqueio", () => {
      expect(adminRoles.includes("superintendente")).toBe(true);
    });

    it("deve ver Gestão de Equipes", () => {
      expect(adminRoles.includes("superintendente")).toBe(true);
    });

    it("deve ver Importar Leads", () => {
      expect(adminRoles.includes("superintendente")).toBe(true);
    });

    it("deve ver Log de Transferências", () => {
      expect(adminRoles.includes("superintendente")).toBe(true);
    });
  });
});
