/**
 * Testes unitários para a lógica de detecção de transferência de lead
 * Valida a lógica pura sem dependência de banco de dados ou React
 */
import { describe, it, expect } from "vitest";

// Lógica pura extraída do UrgentLeadPopup
function detectarTransferencia(params: {
  leadAtual: { corretorId: number } | null | undefined;
  leadError: boolean;
  userId: number | undefined;
}): boolean {
  const { leadAtual, leadError, userId } = params;

  // Se der erro FORBIDDEN, o lead foi transferido
  if (leadError) return true;

  // Se o lead carregou mas pertence a outro corretor
  if (leadAtual != null && userId != null && leadAtual.corretorId !== userId) {
    return true;
  }

  return false;
}

// Lógica do countdown
function calcularCountdownWidth(countdown: number, total: number): number {
  return (countdown / total) * 100;
}

describe("UrgentLeadPopup — detecção de transferência", () => {
  describe("detectarTransferencia()", () => {
    it("retorna false quando lead pertence ao corretor logado", () => {
      expect(
        detectarTransferencia({
          leadAtual: { corretorId: 42 },
          leadError: false,
          userId: 42,
        })
      ).toBe(false);
    });

    it("retorna true quando lead pertence a outro corretor", () => {
      expect(
        detectarTransferencia({
          leadAtual: { corretorId: 99 },
          leadError: false,
          userId: 42,
        })
      ).toBe(true);
    });

    it("retorna true quando a query retorna erro FORBIDDEN", () => {
      expect(
        detectarTransferencia({
          leadAtual: undefined,
          leadError: true,
          userId: 42,
        })
      ).toBe(true);
    });

    it("retorna false quando leadAtual ainda não carregou (undefined)", () => {
      expect(
        detectarTransferencia({
          leadAtual: undefined,
          leadError: false,
          userId: 42,
        })
      ).toBe(false);
    });

    it("retorna false quando leadAtual é null (não encontrado mas sem erro)", () => {
      expect(
        detectarTransferencia({
          leadAtual: null,
          leadError: false,
          userId: 42,
        })
      ).toBe(false);
    });

    it("retorna false quando userId é undefined (usuário ainda carregando)", () => {
      expect(
        detectarTransferencia({
          leadAtual: { corretorId: 99 },
          leadError: false,
          userId: undefined,
        })
      ).toBe(false);
    });

    it("retorna true quando erro ocorre mesmo com userId undefined", () => {
      expect(
        detectarTransferencia({
          leadAtual: undefined,
          leadError: true,
          userId: undefined,
        })
      ).toBe(true);
    });
  });

  describe("calcularCountdownWidth()", () => {
    it("retorna 100% no início do countdown (5/5)", () => {
      expect(calcularCountdownWidth(5, 5)).toBe(100);
    });

    it("retorna 60% quando restam 3 de 5 segundos", () => {
      expect(calcularCountdownWidth(3, 5)).toBe(60);
    });

    it("retorna 20% quando resta 1 de 5 segundos", () => {
      expect(calcularCountdownWidth(1, 5)).toBe(20);
    });

    it("retorna 0% quando countdown chega a 0", () => {
      expect(calcularCountdownWidth(0, 5)).toBe(0);
    });
  });
});
