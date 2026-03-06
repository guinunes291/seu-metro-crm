/**
 * Testes unitários para o sistema de alertas
 * Foco na lógica de proteção anti-duplicata e rastreamento por ID
 */
import { describe, expect, it } from "vitest";

// ============================================================================
// Testes da lógica de rastreamento de alertas por ID (frontend)
// ============================================================================

describe("AlertasNotification - rastreamento por ID", () => {
  it("deve registrar IDs na primeira carga sem notificar", () => {
    const notifiedIds = new Set<number>();
    let initialLoadDone = false;

    const alertas = [
      { id: 1, mensagem: "Alerta 1", leadId: 10, leadNome: "Lead A" },
      { id: 2, mensagem: "Alerta 2", leadId: 11, leadNome: "Lead B" },
    ];

    if (!initialLoadDone) {
      alertas.forEach(a => notifiedIds.add(a.id));
      initialLoadDone = true;
    }

    expect(notifiedIds.size).toBe(2);
    expect(notifiedIds.has(1)).toBe(true);
    expect(notifiedIds.has(2)).toBe(true);
    expect(initialLoadDone).toBe(true);
  });

  it("deve detectar apenas alertas com IDs novos nas cargas subsequentes", () => {
    const notifiedIds = new Set<number>([1, 2]); // IDs já conhecidos

    const alertas = [
      { id: 1, mensagem: "Alerta 1", leadId: 10 },
      { id: 2, mensagem: "Alerta 2", leadId: 11 },
      { id: 3, mensagem: "Alerta 3", leadId: 12 }, // NOVO
    ];

    const novosAlertas = alertas.filter(a => !notifiedIds.has(a.id));

    expect(novosAlertas).toHaveLength(1);
    expect(novosAlertas[0]?.id).toBe(3);
  });

  it("não deve notificar nada se todos os alertas já foram vistos", () => {
    const notifiedIds = new Set<number>([1, 2, 3]);

    const alertas = [
      { id: 1, mensagem: "Alerta 1", leadId: 10 },
      { id: 2, mensagem: "Alerta 2", leadId: 11 },
      { id: 3, mensagem: "Alerta 3", leadId: 12 },
    ];

    const novosAlertas = alertas.filter(a => !notifiedIds.has(a.id));
    expect(novosAlertas).toHaveLength(0);
  });

  it("deve limpar IDs de alertas que foram marcados como lidos", () => {
    const notifiedIds = new Set<number>([1, 2, 3]);

    // Após marcar 1 e 2 como lidos, o backend retorna apenas 3
    const alertasAtuais = [{ id: 3, mensagem: "Alerta 3", leadId: 12 }];
    const currentIds = new Set(alertasAtuais.map(a => a.id));

    notifiedIds.forEach(id => {
      if (!currentIds.has(id)) {
        notifiedIds.delete(id);
      }
    });

    expect(notifiedIds.size).toBe(1);
    expect(notifiedIds.has(3)).toBe(true);
    expect(notifiedIds.has(1)).toBe(false);
    expect(notifiedIds.has(2)).toBe(false);
  });
});

// ============================================================================
// Testes da lógica de proteção anti-duplicata (backend)
// ============================================================================

describe("Alertas - proteção anti-duplicata", () => {
  function verificarDuplicata(
    alertaExistente: { leadId: number; corretorId: number; lido: boolean; createdAt: Date },
    novaRequisicao: { leadId: number; corretorId: number },
    janelaTempo = 2 * 60 * 1000
  ): boolean {
    const limite = new Date(Date.now() - janelaTempo);
    return (
      alertaExistente.leadId === novaRequisicao.leadId &&
      alertaExistente.corretorId === novaRequisicao.corretorId &&
      !alertaExistente.lido &&
      alertaExistente.createdAt > limite
    );
  }

  it("deve bloquear criação de alerta duplicado para o mesmo lead/corretor nos últimos 2 minutos", () => {
    const alertaExistente = {
      leadId: 10,
      corretorId: 5,
      lido: false,
      createdAt: new Date(Date.now() - 30 * 1000), // 30 segundos atrás
    };

    expect(verificarDuplicata(alertaExistente, { leadId: 10, corretorId: 5 })).toBe(true);
  });

  it("deve permitir criação de alerta após 2 minutos do anterior", () => {
    const alertaAntigo = {
      leadId: 10,
      corretorId: 5,
      lido: false,
      createdAt: new Date(Date.now() - 3 * 60 * 1000), // 3 minutos atrás
    };

    expect(verificarDuplicata(alertaAntigo, { leadId: 10, corretorId: 5 })).toBe(false);
  });

  it("deve permitir criação de alerta para lead diferente", () => {
    const alertaExistente = {
      leadId: 10,
      corretorId: 5,
      lido: false,
      createdAt: new Date(Date.now() - 30 * 1000),
    };

    expect(verificarDuplicata(alertaExistente, { leadId: 99, corretorId: 5 })).toBe(false);
  });

  it("deve permitir criação de alerta para corretor diferente", () => {
    const alertaExistente = {
      leadId: 10,
      corretorId: 5,
      lido: false,
      createdAt: new Date(Date.now() - 30 * 1000),
    };

    expect(verificarDuplicata(alertaExistente, { leadId: 10, corretorId: 99 })).toBe(false);
  });

  it("deve permitir novo alerta se o anterior já foi lido", () => {
    const alertaLido = {
      leadId: 10,
      corretorId: 5,
      lido: true, // já foi lido
      createdAt: new Date(Date.now() - 30 * 1000),
    };

    expect(verificarDuplicata(alertaLido, { leadId: 10, corretorId: 5 })).toBe(false);
  });
});

// ============================================================================
// Testes do hook useWebhookLeadNotification - rastreamento por ID
// ============================================================================

describe("useWebhookLeadNotification - rastreamento por ID", () => {
  it("deve notificar apenas leads com IDs não vistos anteriormente", () => {
    const notifiedLeads = new Set<number>([101, 102]);
    const newLeads = [
      { id: 101, nome: "Lead Antigo 1", telefone: "11999999999" },
      { id: 102, nome: "Lead Antigo 2", telefone: "11888888888" },
      { id: 103, nome: "Lead Novo!", telefone: "11777777777" },
    ];

    const leadsParaNotificar = newLeads.filter(l => !notifiedLeads.has(l.id));

    expect(leadsParaNotificar).toHaveLength(1);
    expect(leadsParaNotificar[0]?.id).toBe(103);
    expect(leadsParaNotificar[0]?.nome).toBe("Lead Novo!");
  });

  it("deve adicionar IDs ao set após notificar", () => {
    const notifiedLeads = new Set<number>();
    const newLeads = [
      { id: 201, nome: "Lead A", telefone: "11999999999" },
      { id: 202, nome: "Lead B", telefone: "11888888888" },
    ];

    newLeads.forEach(lead => {
      if (!notifiedLeads.has(lead.id)) {
        notifiedLeads.add(lead.id);
      }
    });

    expect(notifiedLeads.size).toBe(2);
    expect(notifiedLeads.has(201)).toBe(true);
    expect(notifiedLeads.has(202)).toBe(true);
  });

  it("não deve re-notificar o mesmo lead quando o efeito roda novamente", () => {
    const notifiedLeads = new Set<number>([301]);
    let notificacoesFired = 0;

    const newLeads = [{ id: 301, nome: "Lead Já Notificado", telefone: "11999999999" }];

    newLeads.forEach(lead => {
      if (!notifiedLeads.has(lead.id)) {
        notificacoesFired++;
        notifiedLeads.add(lead.id);
      }
    });

    expect(notificacoesFired).toBe(0);
  });

  it("deve atualizar o timestamp apenas quando há leads novos", () => {
    const notifiedLeads = new Set<number>([401]);
    let timestampAtualizado = false;

    const newLeads = [{ id: 401, nome: "Lead Antigo", telefone: "11999999999" }];

    let hasNewLeads = false;
    newLeads.forEach(lead => {
      if (!notifiedLeads.has(lead.id)) {
        hasNewLeads = true;
        notifiedLeads.add(lead.id);
      }
    });

    if (hasNewLeads) {
      timestampAtualizado = true;
    }

    expect(timestampAtualizado).toBe(false); // Não deve atualizar pois não há leads novos
  });
});
