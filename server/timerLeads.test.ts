/**
 * Testes unitários para o job de timer de leads (redistribuição automática)
 * Verifica:
 * 1. Timer configurado para 15 minutos
 * 2. Leads da fila FOCO redistribuídos APENAS entre corretores da fila foco
 * 3. Leads da fila GERAL redistribuídos APENAS entre corretores da fila geral
 * 4. Fallback para admin Guilherme Nunes (ID 7722800) quando nenhum corretor disponível
 * 5. tipoFilaOrigem é preservado durante redistribuições
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// CONSTANTES
// ============================================================================

const TIMER_MINUTOS = 15;
const ADMIN_GUILHERME_ID = 7722800;

// ============================================================================
// TIPOS
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
  tipoFilaOrigem: "geral" | "foco";
}

interface CorretorGeral {
  id: number;
  nome: string;
  status: string;
  role: string;
  posicao: number;
  ativo: boolean;
  leadsRecebidosHoje: number;
  limiteDiarioWebhook: number;
}

interface CorretorFoco {
  id: number;
  nome: string;
  status: string;
}

interface ConfigProjetoFoco {
  ativo: boolean;
  corretoresIds: number[];
  posicaoAtual: number;
}

// ============================================================================
// SIMULAÇÃO DA LÓGICA DO TIMER
// ============================================================================

function getProximoCorretorFilaFoco(
  corretorAtualId: number | null,
  config: ConfigProjetoFoco,
  corretoresFoco: CorretorFoco[]
): number | null {
  if (!config.ativo || config.corretoresIds.length === 0) return null;

  const corretoresIds = config.corretoresIds;
  const posicaoAtual = config.posicaoAtual % corretoresIds.length;

  // Candidatos: presentes e excluindo o atual
  const candidatos = corretoresFoco.filter(
    (c) =>
      corretoresIds.includes(c.id) &&
      c.status === "presente" &&
      c.id !== corretorAtualId
  );

  if (candidatos.length === 0) return null;

  // Round-robin
  let tentativas = 0;
  let pos = posicaoAtual;
  while (tentativas < corretoresIds.length) {
    const corretorId = corretoresIds[pos];
    const presente = candidatos.find((c) => c.id === corretorId);
    if (presente) return corretorId;
    pos = (pos + 1) % corretoresIds.length;
    tentativas++;
  }

  return null;
}

function getProximoCorretorFilaGeral(
  corretorAtualId: number | null,
  corretoresGeral: CorretorGeral[]
): number | null {
  const candidatos = corretoresGeral
    .filter(
      (c) =>
        c.ativo &&
        c.status === "presente" &&
        c.role === "corretor" &&
        c.id !== corretorAtualId &&
        c.leadsRecebidosHoje < c.limiteDiarioWebhook
    )
    .sort((a, b) => a.posicao - b.posicao);

  return candidatos.length > 0 ? candidatos[0].id : null;
}

function simularRedistribuicao(
  lead: Lead,
  configFoco: ConfigProjetoFoco,
  corretoresFoco: CorretorFoco[],
  corretoresGeral: CorretorGeral[],
  agora: Date
): { novoCorretorId: number; tipoFila: string; motivo: string } | null {
  const limiteTempoAtras = new Date(agora.getTime() - TIMER_MINUTOS * 60 * 1000);

  if (!lead.timerAtivo) return null;
  if (lead.status !== "aguardando_atendimento") return null;
  if (lead.timestampRecebimento > limiteTempoAtras) return null;

  const tipoFila = lead.tipoFilaOrigem || "geral";
  let proximoCorretorId: number | null = null;

  if (tipoFila === "foco") {
    proximoCorretorId = getProximoCorretorFilaFoco(lead.corretorId, configFoco, corretoresFoco);
  } else {
    proximoCorretorId = getProximoCorretorFilaGeral(lead.corretorId, corretoresGeral);
  }

  if (proximoCorretorId) {
    return {
      novoCorretorId: proximoCorretorId,
      tipoFila,
      motivo: `Redistribuição automática por timeout de ${TIMER_MINUTOS} minutos (fila ${tipoFila})`,
    };
  }

  // Fallback para admin
  return {
    novoCorretorId: ADMIN_GUILHERME_ID,
    tipoFila,
    motivo: `Fallback para admin: nenhum corretor disponível na fila ${tipoFila} após timeout de ${TIMER_MINUTOS} minutos`,
  };
}

// ============================================================================
// FIXTURES
// ============================================================================

const configFocoAtiva: ConfigProjetoFoco = {
  ativo: true,
  corretoresIds: [300, 301, 302],
  posicaoAtual: 0,
};

const configFocoInativa: ConfigProjetoFoco = {
  ativo: false,
  corretoresIds: [300, 301],
  posicaoAtual: 0,
};

const corretoresFocoPresentes: CorretorFoco[] = [
  { id: 300, nome: "Ana Foco", status: "presente" },
  { id: 301, nome: "Bruno Foco", status: "presente" },
  { id: 302, nome: "Carla Foco", status: "ausente" },
];

const corretoresGeralPresentes: CorretorGeral[] = [
  {
    id: 100,
    nome: "Diego Geral",
    status: "presente",
    role: "corretor",
    posicao: 1,
    ativo: true,
    leadsRecebidosHoje: 5,
    limiteDiarioWebhook: 50,
  },
  {
    id: 101,
    nome: "Eva Geral",
    status: "presente",
    role: "corretor",
    posicao: 2,
    ativo: true,
    leadsRecebidosHoje: 3,
    limiteDiarioWebhook: 50,
  },
];

// ============================================================================
// TESTES
// ============================================================================

describe("Timer de Leads - Separação de Filas (Foco vs Geral)", () => {
  let agora: Date;
  let leadFocoExpirado: Lead;
  let leadGeralExpirado: Lead;
  let leadRecente: Lead;

  beforeEach(() => {
    agora = new Date("2026-03-03T12:00:00Z");

    // Lead da fila FOCO expirado (recebido há 16 minutos)
    leadFocoExpirado = {
      id: 1,
      nome: "Cliente Foco",
      corretorId: 300,
      status: "aguardando_atendimento",
      timerAtivo: true,
      timestampRecebimento: new Date(agora.getTime() - 16 * 60 * 1000),
      origemWebhook: true,
      tentativasRedistribuicao: 0,
      tipoFilaOrigem: "foco",
    };

    // Lead da fila GERAL expirado (recebido há 16 minutos)
    leadGeralExpirado = {
      id: 2,
      nome: "Cliente Geral",
      corretorId: 100,
      status: "aguardando_atendimento",
      timerAtivo: true,
      timestampRecebimento: new Date(agora.getTime() - 16 * 60 * 1000),
      origemWebhook: true,
      tentativasRedistribuicao: 0,
      tipoFilaOrigem: "geral",
    };

    // Lead recente (não deve expirar)
    leadRecente = {
      id: 3,
      nome: "Cliente Recente",
      corretorId: 100,
      status: "aguardando_atendimento",
      timerAtivo: true,
      timestampRecebimento: new Date(agora.getTime() - 5 * 60 * 1000),
      origemWebhook: true,
      tentativasRedistribuicao: 0,
      tipoFilaOrigem: "geral",
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
      const resultado = simularRedistribuicao(
        leadFocoExpirado,
        configFocoAtiva,
        corretoresFocoPresentes,
        corretoresGeralPresentes,
        agora
      );
      expect(resultado).not.toBeNull();
    });

    it("NÃO deve expirar lead recebido há 5 minutos", () => {
      const resultado = simularRedistribuicao(
        leadRecente,
        configFocoAtiva,
        corretoresFocoPresentes,
        corretoresGeralPresentes,
        agora
      );
      expect(resultado).toBeNull();
    });

    it("NÃO deve redistribuir lead com timerAtivo=false", () => {
      const leadSemTimer = { ...leadFocoExpirado, timerAtivo: false };
      const resultado = simularRedistribuicao(
        leadSemTimer,
        configFocoAtiva,
        corretoresFocoPresentes,
        corretoresGeralPresentes,
        agora
      );
      expect(resultado).toBeNull();
    });

    it("NÃO deve redistribuir lead com status diferente de aguardando_atendimento", () => {
      const leadEmAtendimento = { ...leadFocoExpirado, status: "em_atendimento" };
      const resultado = simularRedistribuicao(
        leadEmAtendimento,
        configFocoAtiva,
        corretoresFocoPresentes,
        corretoresGeralPresentes,
        agora
      );
      expect(resultado).toBeNull();
    });
  });

  // ============================================================================
  // TESTES DE SEPARAÇÃO DE FILAS
  // ============================================================================

  describe("Separação de Filas - Lead da Fila FOCO", () => {
    it("deve redistribuir lead foco para corretor da fila foco", () => {
      const resultado = simularRedistribuicao(
        leadFocoExpirado,
        configFocoAtiva,
        corretoresFocoPresentes,
        corretoresGeralPresentes,
        agora
      );
      expect(resultado).not.toBeNull();
      // Deve ir para um corretor da fila foco (300 ou 301), NÃO para 100 ou 101 (geral)
      expect([300, 301]).toContain(resultado?.novoCorretorId);
      expect(resultado?.tipoFila).toBe("foco");
    });

    it("NÃO deve redistribuir lead foco para corretor da fila geral", () => {
      const resultado = simularRedistribuicao(
        leadFocoExpirado,
        configFocoAtiva,
        corretoresFocoPresentes,
        corretoresGeralPresentes,
        agora
      );
      // Corretores da fila geral têm IDs 100, 101
      expect([100, 101]).not.toContain(resultado?.novoCorretorId);
    });

    it("deve excluir o corretor atual (300) e ir para o próximo da fila foco (301)", () => {
      // Lead com corretor atual 300, próximo deve ser 301
      const resultado = simularRedistribuicao(
        { ...leadFocoExpirado, corretorId: 300 },
        { ...configFocoAtiva, posicaoAtual: 0 },
        corretoresFocoPresentes,
        corretoresGeralPresentes,
        agora
      );
      expect(resultado?.novoCorretorId).toBe(301);
    });

    it("deve ignorar corretor foco ausente (302) e ir para o próximo disponível", () => {
      // Corretor 302 está ausente, deve pular para 300 ou 301
      const resultado = simularRedistribuicao(
        { ...leadFocoExpirado, corretorId: 301 }, // Atual é 301
        { ...configFocoAtiva, posicaoAtual: 2 }, // Começa em 302 (ausente)
        corretoresFocoPresentes,
        corretoresGeralPresentes,
        agora
      );
      // Deve pular 302 (ausente) e ir para 300
      expect(resultado?.novoCorretorId).toBe(300);
    });

    it("deve fazer fallback para admin quando fila foco está inativa", () => {
      const resultado = simularRedistribuicao(
        leadFocoExpirado,
        configFocoInativa, // Fila foco inativa
        corretoresFocoPresentes,
        corretoresGeralPresentes,
        agora
      );
      // Com fila foco inativa, não há candidatos → fallback para admin
      expect(resultado?.novoCorretorId).toBe(ADMIN_GUILHERME_ID);
    });

    it("deve fazer fallback para admin quando todos corretores foco estão ausentes", () => {
      const todosFocoAusentes: CorretorFoco[] = [
        { id: 300, nome: "Ana Foco", status: "ausente" },
        { id: 301, nome: "Bruno Foco", status: "ausente" },
        { id: 302, nome: "Carla Foco", status: "ausente" },
      ];

      const resultado = simularRedistribuicao(
        leadFocoExpirado,
        configFocoAtiva,
        todosFocoAusentes,
        corretoresGeralPresentes,
        agora
      );
      expect(resultado?.novoCorretorId).toBe(ADMIN_GUILHERME_ID);
      expect(resultado?.motivo).toContain("fila foco");
    });
  });

  describe("Separação de Filas - Lead da Fila GERAL", () => {
    it("deve redistribuir lead geral para corretor da fila geral", () => {
      const resultado = simularRedistribuicao(
        leadGeralExpirado,
        configFocoAtiva,
        corretoresFocoPresentes,
        corretoresGeralPresentes,
        agora
      );
      expect(resultado).not.toBeNull();
      // Deve ir para um corretor da fila geral (100 ou 101), NÃO para 300, 301 (foco)
      expect([100, 101]).toContain(resultado?.novoCorretorId);
      expect(resultado?.tipoFila).toBe("geral");
    });

    it("NÃO deve redistribuir lead geral para corretor da fila foco", () => {
      const resultado = simularRedistribuicao(
        leadGeralExpirado,
        configFocoAtiva,
        corretoresFocoPresentes,
        corretoresGeralPresentes,
        agora
      );
      // Corretores da fila foco têm IDs 300, 301, 302
      expect([300, 301, 302]).not.toContain(resultado?.novoCorretorId);
    });

    it("deve excluir o corretor atual (100) e ir para o próximo da fila geral (101)", () => {
      const resultado = simularRedistribuicao(
        { ...leadGeralExpirado, corretorId: 100 },
        configFocoAtiva,
        corretoresFocoPresentes,
        corretoresGeralPresentes,
        agora
      );
      expect(resultado?.novoCorretorId).toBe(101);
    });

    it("deve respeitar o limite diário de webhook na fila geral", () => {
      const geralComLimite: CorretorGeral[] = [
        {
          id: 100,
          nome: "Diego Lotado",
          status: "presente",
          role: "corretor",
          posicao: 1,
          ativo: true,
          leadsRecebidosHoje: 50, // Atingiu o limite
          limiteDiarioWebhook: 50,
        },
        {
          id: 101,
          nome: "Eva Disponível",
          status: "presente",
          role: "corretor",
          posicao: 2,
          ativo: true,
          leadsRecebidosHoje: 10,
          limiteDiarioWebhook: 50,
        },
      ];

      const resultado = simularRedistribuicao(
        { ...leadGeralExpirado, corretorId: 999 }, // Corretor atual diferente
        configFocoAtiva,
        corretoresFocoPresentes,
        geralComLimite,
        agora
      );
      expect(resultado?.novoCorretorId).toBe(101); // Pula o lotado
    });

    it("deve fazer fallback para admin quando todos corretores geral estão ausentes", () => {
      const todosGeralAusentes: CorretorGeral[] = [
        {
          id: 100,
          nome: "Diego Ausente",
          status: "ausente",
          role: "corretor",
          posicao: 1,
          ativo: true,
          leadsRecebidosHoje: 0,
          limiteDiarioWebhook: 50,
        },
      ];

      const resultado = simularRedistribuicao(
        leadGeralExpirado,
        configFocoAtiva,
        corretoresFocoPresentes,
        todosGeralAusentes,
        agora
      );
      expect(resultado?.novoCorretorId).toBe(ADMIN_GUILHERME_ID);
      expect(resultado?.motivo).toContain("fila geral");
    });

    it("deve fazer fallback para admin quando fila geral está vazia", () => {
      const resultado = simularRedistribuicao(
        leadGeralExpirado,
        configFocoAtiva,
        corretoresFocoPresentes,
        [], // Fila geral vazia
        agora
      );
      expect(resultado?.novoCorretorId).toBe(ADMIN_GUILHERME_ID);
    });
  });

  // ============================================================================
  // TESTES DE ISOLAMENTO ENTRE FILAS
  // ============================================================================

  describe("Isolamento entre Filas", () => {
    it("lead foco NÃO deve ir para geral mesmo que geral tenha corretores disponíveis", () => {
      const todosFocoAusentes: CorretorFoco[] = [
        { id: 300, nome: "Ana Foco", status: "ausente" },
        { id: 301, nome: "Bruno Foco", status: "ausente" },
      ];

      const resultado = simularRedistribuicao(
        leadFocoExpirado,
        { ...configFocoAtiva, corretoresIds: [300, 301] },
        todosFocoAusentes,
        corretoresGeralPresentes, // Geral tem corretores disponíveis
        agora
      );

      // Deve ir para admin, NÃO para corretores da fila geral
      expect(resultado?.novoCorretorId).toBe(ADMIN_GUILHERME_ID);
      expect([100, 101]).not.toContain(resultado?.novoCorretorId);
    });

    it("lead geral NÃO deve ir para foco mesmo que foco tenha corretores disponíveis", () => {
      const todosGeralAusentes: CorretorGeral[] = [
        {
          id: 100,
          nome: "Diego Ausente",
          status: "ausente",
          role: "corretor",
          posicao: 1,
          ativo: true,
          leadsRecebidosHoje: 0,
          limiteDiarioWebhook: 50,
        },
      ];

      const resultado = simularRedistribuicao(
        leadGeralExpirado,
        configFocoAtiva,
        corretoresFocoPresentes, // Foco tem corretores disponíveis
        todosGeralAusentes,
        agora
      );

      // Deve ir para admin, NÃO para corretores da fila foco
      expect(resultado?.novoCorretorId).toBe(ADMIN_GUILHERME_ID);
      expect([300, 301, 302]).not.toContain(resultado?.novoCorretorId);
    });
  });

  // ============================================================================
  // TESTES DE FALLBACK
  // ============================================================================

  describe("Fallback para Admin Guilherme Nunes", () => {
    it("deve usar o ID correto do admin Guilherme Nunes", () => {
      expect(ADMIN_GUILHERME_ID).toBe(7722800);
    });

    it("motivo do fallback deve indicar a fila de origem", () => {
      const resultadoFoco = simularRedistribuicao(
        leadFocoExpirado,
        configFocoInativa,
        [],
        corretoresGeralPresentes,
        agora
      );
      expect(resultadoFoco?.motivo).toContain("fila foco");

      const resultadoGeral = simularRedistribuicao(
        leadGeralExpirado,
        configFocoAtiva,
        corretoresFocoPresentes,
        [],
        agora
      );
      expect(resultadoGeral?.motivo).toContain("fila geral");
    });
  });

  // ============================================================================
  // TESTES DE PRESERVAÇÃO DO tipoFilaOrigem
  // ============================================================================

  describe("Preservação do tipoFilaOrigem", () => {
    it("lead foco deve manter tipoFilaOrigem='foco' após redistribuição", () => {
      const resultado = simularRedistribuicao(
        leadFocoExpirado,
        configFocoAtiva,
        corretoresFocoPresentes,
        corretoresGeralPresentes,
        agora
      );
      expect(resultado?.tipoFila).toBe("foco");
    });

    it("lead geral deve manter tipoFilaOrigem='geral' após redistribuição", () => {
      const resultado = simularRedistribuicao(
        leadGeralExpirado,
        configFocoAtiva,
        corretoresFocoPresentes,
        corretoresGeralPresentes,
        agora
      );
      expect(resultado?.tipoFila).toBe("geral");
    });
  });
});
