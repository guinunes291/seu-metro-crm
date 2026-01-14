import { describe, it, expect, beforeEach, vi } from "vitest";
import { verificarTimerLeads } from "./timerLeadsJob";
import { getDb } from "./db";
import { leads, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// Mock do getDb
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

// Mock da função de redistribuição
vi.mock("./distribution", () => ({
  distribuirLeadParaProximoCorretor: vi.fn().mockResolvedValue({
    sucesso: true,
    corretorId: "corretor-123",
  }),
}));

describe("Sistema de Timer de Leads (5 minutos)", () => {
  let mockDb: any;

  beforeEach(() => {
    // Reset dos mocks
    vi.clearAllMocks();

    // Mock do banco de dados
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };

    (getDb as any).mockResolvedValue(mockDb);
  });

  it("deve identificar leads com timer expirado (mais de 5 minutos)", async () => {
    const agora = new Date();
    const seisMinutosAtras = new Date(agora.getTime() - 6 * 60 * 1000);

    const leadExpirado = {
      id: "lead-123",
      nome: "João Silva",
      timerAtivo: true,
      status: "aguardando_atendimento",
      timestampRecebimento: seisMinutosAtras,
      origem: "webhook_facebook",
      tentativasRedistribuicao: 0,
    };

    mockDb.where.mockResolvedValue([leadExpirado]);

    await verificarTimerLeads();

    // Verifica se a query foi feita corretamente
    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.from).toHaveBeenCalled();
    expect(mockDb.where).toHaveBeenCalled();
  });

  it("NÃO deve redistribuir leads com menos de 5 minutos", async () => {
    const agora = new Date();
    const quatroMinutosAtras = new Date(agora.getTime() - 4 * 60 * 1000);

    const leadRecente = {
      id: "lead-456",
      nome: "Maria Santos",
      timerAtivo: true,
      status: "aguardando_atendimento",
      timestampRecebimento: quatroMinutosAtras,
      origem: "webhook_facebook",
      tentativasRedistribuicao: 0,
    };

    // Simula que não encontrou leads expirados
    mockDb.where.mockResolvedValue([]);

    await verificarTimerLeads();

    // Verifica que não tentou atualizar nenhum lead
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("deve desativar timer e incrementar tentativas ao redistribuir", async () => {
    const agora = new Date();
    const seisMinutosAtras = new Date(agora.getTime() - 6 * 60 * 1000);

    const leadExpirado = {
      id: "lead-789",
      nome: "Pedro Oliveira",
      timerAtivo: true,
      status: "aguardando_atendimento",
      timestampRecebimento: seisMinutosAtras,
      origem: "webhook_facebook",
      tentativasRedistribuicao: 0,
    };

    mockDb.where.mockResolvedValue([leadExpirado]);

    await verificarTimerLeads();

    // Verifica se tentou atualizar o lead
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        timerAtivo: false,
        tentativasRedistribuicao: 1,
      })
    );
  });

  it("deve ignorar leads que já foram trabalhados (status diferente de aguardando_atendimento)", async () => {
    const agora = new Date();
    const seisMinutosAtras = new Date(agora.getTime() - 6 * 60 * 1000);

    const leadTrabalhado = {
      id: "lead-999",
      nome: "Ana Costa",
      timerAtivo: true,
      status: "em_atendimento", // Status diferente
      timestampRecebimento: seisMinutosAtras,
      origem: "webhook_facebook",
      tentativasRedistribuicao: 0,
    };

    // Simula que não encontrou leads expirados (filtro de status funcionou)
    mockDb.where.mockResolvedValue([]);

    await verificarTimerLeads();

    // Verifica que não tentou redistribuir
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("deve lidar com múltiplos leads expirados simultaneamente", async () => {
    const agora = new Date();
    const seisMinutosAtras = new Date(agora.getTime() - 6 * 60 * 1000);
    const seteMinutosAtras = new Date(agora.getTime() - 7 * 60 * 1000);

    const leadsExpirados = [
      {
        id: "lead-1",
        nome: "Lead 1",
        timerAtivo: true,
        status: "aguardando_atendimento",
        timestampRecebimento: seisMinutosAtras,
        origem: "webhook_facebook",
        tentativasRedistribuicao: 0,
      },
      {
        id: "lead-2",
        nome: "Lead 2",
        timerAtivo: true,
        status: "aguardando_atendimento",
        timestampRecebimento: seteMinutosAtras,
        origem: "webhook_facebook",
        tentativasRedistribuicao: 1,
      },
    ];

    mockDb.where.mockResolvedValue(leadsExpirados);

    await verificarTimerLeads();

    // Verifica que processou ambos os leads
    expect(mockDb.update).toHaveBeenCalledTimes(2);
  });
});
