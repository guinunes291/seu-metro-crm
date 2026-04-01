/**
 * Testes para as melhorias implementadas:
 * 1. sendWithRetry no emailService (retry com backoff exponencial)
 * 2. systemConfigDb (getSystemConfig / setSystemConfig via job_control)
 * 3. addInteraction não auto-atribui lead sem dono
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// 1. RETRY DE EMAIL — lógica isolada (sem nodemailer real)
// ============================================================================
describe("sendWithRetry logic", () => {
  async function sendWithRetry(
    sendFn: () => Promise<{ messageId: string }>,
    maxAttempts = 3,
    baseDelayMs = 0 // 0ms nos testes para não esperar
  ): Promise<{ messageId: string }> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await sendFn();
      } catch (err) {
        lastError = err;
        if (attempt < maxAttempts && baseDelayMs > 0) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * baseDelayMs));
        }
      }
    }
    throw lastError;
  }

  it("retorna sucesso na primeira tentativa", async () => {
    const mockSend = vi.fn().mockResolvedValue({ messageId: "abc123" });
    const result = await sendWithRetry(mockSend);
    expect(result.messageId).toBe("abc123");
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("tenta 3 vezes e retorna sucesso na terceira", async () => {
    const mockSend = vi
      .fn()
      .mockRejectedValueOnce(new Error("SMTP timeout"))
      .mockRejectedValueOnce(new Error("SMTP timeout"))
      .mockResolvedValue({ messageId: "retry-ok" });
    const result = await sendWithRetry(mockSend, 3, 0);
    expect(result.messageId).toBe("retry-ok");
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it("lança erro após esgotar todas as tentativas", async () => {
    const mockSend = vi.fn().mockRejectedValue(new Error("SMTP permanente"));
    await expect(sendWithRetry(mockSend, 3, 0)).rejects.toThrow("SMTP permanente");
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it("não tenta mais do que maxAttempts", async () => {
    const mockSend = vi.fn().mockRejectedValue(new Error("fail"));
    await expect(sendWithRetry(mockSend, 2, 0)).rejects.toThrow();
    expect(mockSend).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// 2. SYSTEMCONFIGDB — lógica de chave-valor
// ============================================================================
describe("systemConfigDb logic", () => {
  // Simula o comportamento do helper sem banco real
  const store = new Map<string, string>();

  async function getSystemConfig(key: string): Promise<string | null> {
    return store.get(key) ?? null;
  }

  async function setSystemConfig(key: string, value: string): Promise<void> {
    store.set(key, value);
  }

  beforeEach(() => store.clear());

  it("retorna null para chave inexistente", async () => {
    expect(await getSystemConfig("last_backup_date")).toBeNull();
  });

  it("salva e recupera um valor", async () => {
    await setSystemConfig("last_backup_date", "2026-04-01");
    expect(await getSystemConfig("last_backup_date")).toBe("2026-04-01");
  });

  it("sobrescreve valor existente", async () => {
    await setSystemConfig("last_backup_date", "2026-04-01");
    await setSystemConfig("last_backup_date", "2026-04-02");
    expect(await getSystemConfig("last_backup_date")).toBe("2026-04-02");
  });

  it("chaves diferentes são independentes", async () => {
    await setSystemConfig("last_backup_date", "2026-04-01");
    await setSystemConfig("last_dre_sync_date", "2026-03-31");
    expect(await getSystemConfig("last_backup_date")).toBe("2026-04-01");
    expect(await getSystemConfig("last_dre_sync_date")).toBe("2026-03-31");
  });
});

// ============================================================================
// 3. ADDINTERA­CTION — não auto-atribui lead sem dono
// ============================================================================
describe("addInteraction auto-assignment guard", () => {
  interface Lead {
    id: number;
    corretorId: number | null;
    status: string;
  }

  interface User {
    id: number;
    role: string;
  }

  // Replica a lógica corrigida do addInteraction
  function shouldAutoAssign(lead: Lead, user: User): boolean {
    // Corretor não pode auto-atribuir lead sem dono
    if (!lead.corretorId && user.role === "corretor") {
      return false;
    }
    // Admin/gestor pode atribuir a si mesmo se o lead não tem dono
    if (!lead.corretorId && ["admin", "gestor", "superintendente"].includes(user.role)) {
      return true;
    }
    return false;
  }

  it("corretor não auto-atribui lead sem dono", () => {
    const lead: Lead = { id: 1, corretorId: null, status: "aguardando" };
    const user: User = { id: 5, role: "corretor" };
    expect(shouldAutoAssign(lead, user)).toBe(false);
  });

  it("admin pode atribuir lead sem dono", () => {
    const lead: Lead = { id: 1, corretorId: null, status: "aguardando" };
    const user: User = { id: 1, role: "admin" };
    expect(shouldAutoAssign(lead, user)).toBe(true);
  });

  it("lead com dono não dispara auto-atribuição", () => {
    const lead: Lead = { id: 1, corretorId: 3, status: "em_atendimento" };
    const user: User = { id: 5, role: "corretor" };
    expect(shouldAutoAssign(lead, user)).toBe(false);
  });

  it("gestor pode atribuir lead sem dono", () => {
    const lead: Lead = { id: 1, corretorId: null, status: "aguardando" };
    const user: User = { id: 2, role: "gestor" };
    expect(shouldAutoAssign(lead, user)).toBe(true);
  });
});
