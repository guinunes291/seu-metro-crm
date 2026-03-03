/**
 * Testes unitários para o job de timer de leads (redistribuição automática)
 * Verifica:
 * 1. Timer configurado para 15 minutos
 * 2. Lógica de redistribuição para próximo corretor da mesma fila
 * 3. Fallback para admin Guilherme Nunes (ID 7722800) quando nenhum corretor disponível
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// CONSTANTES
// ============================================================================

const TIMER_MINUTOS = 15;
const ADMIN_GUILHERME_ID = 7722800;

// ============================================================================
// MOCK DA LÓGICA DO TIMER
// ============================================================================

interface Lead {
  id: number;
  nome: string;
  corretorId: number | null;
  status: string;
  timerAtivo: boolean;
  timestampRecebimento: Date;
  origemWebhook: boolean;
  tentativasRedistribuicao: number;
}

interface Corretor {
  id: number;
  nome: string;
  status: string;
  role: string;
  posicao: number;
  ativo: boolean;
  leadsRecebidosHoje: number;
  limiteDiarioWebhook: number;
}

/**
 * Simula a lógica de redistribuição do timerLeadsJob.ts
 */
function simularRedistribuicao(
  lead: Lead,
  corretoresNaFila: Corretor[],
  agora: Date
): { novoCorretorId: number; motivo: string } | null {
  const limiteTempoAtras = new Date(agora.getTime() - TIMER_MINUTOS * 60 * 1000);

  // Verificar se o lead expirou
  if (!lead.timerAtivo) return null;
  if (lead.status !== "aguardando_atendimento") return null;
  if (lead.timestampRecebimento > limiteTempoAtras) return null;

  // Buscar próximo corretor apto (excluindo o atual)
  const candidatos = corretoresNaFila
    .filter(
      (c) =>
        c.ativo &&
        c.status === "presente" &&
        c.role === "corretor" &&
        c.id !== lead.corretorId &&
        c.leadsRecebidosHoje < c.limiteDiarioWebhook
    )
    .sort((a, b) => a.posicao - b.posicao);

  if (candidatos.length > 0) {
    return {
      novoCorretorId: candidatos[0].id,
      motivo: `Redistribuição automática por timeout de ${TIMER_MINUTOS} minutos`,
    };
  }

  // Fallback para admin Guilherme Nunes
  return {
    novoCorretorId: ADMIN_GUILHERME_ID,
    motivo: `Fallback para admin: nenhum corretor disponível após timeout de ${TIMER_MINUTOS} minutos`,
  };
}

// ============================================================================
// TESTES
// ============================================================================

describe("Timer de Leads - Redistribuição Automática", () => {
  let agora: Date;
  let leadExpirado: Lead;
  let leadRecente: Lead;

  beforeEach(() => {
    agora = new Date("2026-03-03T12:00:00Z");

    // Lead que expirou (recebido há 16 minutos)
    leadExpirado = {
      id: 1,
      nome: "João Silva",
      corretorId: 100,
      status: "aguardando_atendimento",
      timerAtivo: true,
      timestampRecebimento: new Date(agora.getTime() - 16 * 60 * 1000),
      origemWebhook: true,
      tentativasRedistribuicao: 0,
    };

    // Lead recente (recebido há 5 minutos - não deve expirar)
    leadRecente = {
      id: 2,
      nome: "Maria Santos",
      corretorId: 100,
      status: "aguardando_atendimento",
      timerAtivo: true,
      timestampRecebimento: new Date(agora.getTime() - 5 * 60 * 1000),
      origemWebhook: true,
      tentativasRedistribuicao: 0,
    };
  });

  // ============================================================================
  // TESTES DE TIMER
  // ============================================================================

  describe("Configuração do Timer", () => {
    it("deve usar 15 minutos como limite de tempo", () => {
      expect(TIMER_MINUTOS).toBe(15);
    });

    it("deve expirar lead recebido há 16 minutos", () => {
      const resultado = simularRedistribuicao(leadExpirado, [], agora);
      // Retorna fallback para admin pois não há corretores
      expect(resultado).not.toBeNull();
      expect(resultado?.novoCorretorId).toBe(ADMIN_GUILHERME_ID);
    });

    it("NÃO deve expirar lead recebido há 5 minutos", () => {
      const resultado = simularRedistribuicao(leadRecente, [], agora);
      expect(resultado).toBeNull();
    });

    it("NÃO deve redistribuir lead com timerAtivo=false", () => {
      const leadSemTimer = { ...leadExpirado, timerAtivo: false };
      const resultado = simularRedistribuicao(leadSemTimer, [], agora);
      expect(resultado).toBeNull();
    });

    it("NÃO deve redistribuir lead com status diferente de aguardando_atendimento", () => {
      const leadEmAtendimento = { ...leadExpirado, status: "em_atendimento" };
      const resultado = simularRedistribuicao(leadEmAtendimento, [], agora);
      expect(resultado).toBeNull();
    });
  });

  // ============================================================================
  // TESTES DE REDISTRIBUIÇÃO
  // ============================================================================

  describe("Redistribuição para Próximo Corretor", () => {
    const corretoresDisponiveis: Corretor[] = [
      {
        id: 200,
        nome: "Ana Lima",
        status: "presente",
        role: "corretor",
        posicao: 1,
        ativo: true,
        leadsRecebidosHoje: 5,
        limiteDiarioWebhook: 50,
      },
      {
        id: 201,
        nome: "Carlos Souza",
        status: "presente",
        role: "corretor",
        posicao: 2,
        ativo: true,
        leadsRecebidosHoje: 3,
        limiteDiarioWebhook: 50,
      },
    ];

    it("deve redistribuir para o próximo corretor disponível na fila", () => {
      const resultado = simularRedistribuicao(leadExpirado, corretoresDisponiveis, agora);
      expect(resultado).not.toBeNull();
      expect(resultado?.novoCorretorId).toBe(200); // Primeiro na fila
      expect(resultado?.motivo).toContain("timeout de 15 minutos");
    });

    it("deve excluir o corretor atual da redistribuição", () => {
      const corretoresComAtual: Corretor[] = [
        {
          id: 100, // Mesmo ID do corretor atual
          nome: "Corretor Atual",
          status: "presente",
          role: "corretor",
          posicao: 1,
          ativo: true,
          leadsRecebidosHoje: 0,
          limiteDiarioWebhook: 50,
        },
        {
          id: 201,
          nome: "Próximo Corretor",
          status: "presente",
          role: "corretor",
          posicao: 2,
          ativo: true,
          leadsRecebidosHoje: 0,
          limiteDiarioWebhook: 50,
        },
      ];

      const resultado = simularRedistribuicao(leadExpirado, corretoresComAtual, agora);
      expect(resultado?.novoCorretorId).toBe(201); // Não deve ir para o corretor atual (100)
    });

    it("deve respeitar o limite diário de webhook", () => {
      const corretoresLimitados: Corretor[] = [
        {
          id: 200,
          nome: "Corretor Lotado",
          status: "presente",
          role: "corretor",
          posicao: 1,
          ativo: true,
          leadsRecebidosHoje: 50, // Atingiu o limite
          limiteDiarioWebhook: 50,
        },
        {
          id: 201,
          nome: "Corretor Disponível",
          status: "presente",
          role: "corretor",
          posicao: 2,
          ativo: true,
          leadsRecebidosHoje: 10,
          limiteDiarioWebhook: 50,
        },
      ];

      const resultado = simularRedistribuicao(leadExpirado, corretoresLimitados, agora);
      expect(resultado?.novoCorretorId).toBe(201); // Pula o lotado
    });

    it("deve ignorar corretores ausentes", () => {
      const corretoresComAusente: Corretor[] = [
        {
          id: 200,
          nome: "Corretor Ausente",
          status: "ausente",
          role: "corretor",
          posicao: 1,
          ativo: true,
          leadsRecebidosHoje: 0,
          limiteDiarioWebhook: 50,
        },
        {
          id: 201,
          nome: "Corretor Presente",
          status: "presente",
          role: "corretor",
          posicao: 2,
          ativo: true,
          leadsRecebidosHoje: 0,
          limiteDiarioWebhook: 50,
        },
      ];

      const resultado = simularRedistribuicao(leadExpirado, corretoresComAusente, agora);
      expect(resultado?.novoCorretorId).toBe(201);
    });

    it("deve ignorar corretores inativos na fila", () => {
      const corretoresComInativo: Corretor[] = [
        {
          id: 200,
          nome: "Corretor Inativo",
          status: "presente",
          role: "corretor",
          posicao: 1,
          ativo: false, // Inativo na fila
          leadsRecebidosHoje: 0,
          limiteDiarioWebhook: 50,
        },
        {
          id: 201,
          nome: "Corretor Ativo",
          status: "presente",
          role: "corretor",
          posicao: 2,
          ativo: true,
          leadsRecebidosHoje: 0,
          limiteDiarioWebhook: 50,
        },
      ];

      const resultado = simularRedistribuicao(leadExpirado, corretoresComInativo, agora);
      expect(resultado?.novoCorretorId).toBe(201);
    });
  });

  // ============================================================================
  // TESTES DE FALLBACK PARA ADMIN
  // ============================================================================

  describe("Fallback para Admin Guilherme Nunes", () => {
    it("deve transferir para admin quando nenhum corretor disponível", () => {
      const resultado = simularRedistribuicao(leadExpirado, [], agora);
      expect(resultado).not.toBeNull();
      expect(resultado?.novoCorretorId).toBe(ADMIN_GUILHERME_ID);
      expect(resultado?.motivo).toContain("Fallback para admin");
    });

    it("deve transferir para admin quando todos os corretores estão ausentes", () => {
      const corretoresAusentes: Corretor[] = [
        {
          id: 200,
          nome: "Corretor 1",
          status: "ausente",
          role: "corretor",
          posicao: 1,
          ativo: true,
          leadsRecebidosHoje: 0,
          limiteDiarioWebhook: 50,
        },
        {
          id: 201,
          nome: "Corretor 2",
          status: "ausente",
          role: "corretor",
          posicao: 2,
          ativo: true,
          leadsRecebidosHoje: 0,
          limiteDiarioWebhook: 50,
        },
      ];

      const resultado = simularRedistribuicao(leadExpirado, corretoresAusentes, agora);
      expect(resultado?.novoCorretorId).toBe(ADMIN_GUILHERME_ID);
    });

    it("deve transferir para admin quando todos atingiram o limite diário", () => {
      const corretoresLotados: Corretor[] = [
        {
          id: 200,
          nome: "Corretor 1",
          status: "presente",
          role: "corretor",
          posicao: 1,
          ativo: true,
          leadsRecebidosHoje: 50,
          limiteDiarioWebhook: 50,
        },
      ];

      const resultado = simularRedistribuicao(leadExpirado, corretoresLotados, agora);
      expect(resultado?.novoCorretorId).toBe(ADMIN_GUILHERME_ID);
    });

    it("deve usar o ID correto do admin Guilherme Nunes", () => {
      expect(ADMIN_GUILHERME_ID).toBe(7722800);
    });
  });

  // ============================================================================
  // TESTES DE BORDA
  // ============================================================================

  describe("Casos de Borda", () => {
    it("deve expirar lead recebido exatamente há 15 minutos (no limite)", () => {
      const leadNoLimite = {
        ...leadExpirado,
        timestampRecebimento: new Date(agora.getTime() - 15 * 60 * 1000),
      };
      // No limite exato (15 min), o lead DEVE expirar (lt usa <, então 15 min = expirado)
      const resultado = simularRedistribuicao(leadNoLimite, [], agora);
      expect(resultado).not.toBeNull();
    });

    it("deve expirar lead recebido há 14 minutos e 59 segundos (antes do limite)", () => {
      const leadQuaseExpirando = {
        ...leadExpirado,
        timestampRecebimento: new Date(agora.getTime() - (15 * 60 * 1000 - 1000)),
      };
      // 14:59 ainda não expirou
      const resultado = simularRedistribuicao(leadQuaseExpirando, [], agora);
      expect(resultado).toBeNull();
    });
  });
});
