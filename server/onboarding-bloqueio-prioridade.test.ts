import { describe, it, expect } from "vitest";
import { verificarPerfilCompletoSync } from "./modules/onboarding";

/**
 * Testa a lógica de prioridade de bloqueio:
 * - Quando perfil está incompleto, o bloqueio de follow-up NÃO deve aparecer
 * - O bloqueio de onboarding (cadastro) tem prioridade absoluta
 * - A rota /configuracoes deve estar sempre liberada do bloqueio de follow-up
 */

// Simula a lógica de decisão do DashboardLayout
function shouldShowFollowUpOverlay(params: {
  isCorretor: boolean;
  desbloqueado: boolean;
  perfilIncompleto: boolean;
  location: string;
}): boolean {
  const { isCorretor, desbloqueado, perfilIncompleto, location } = params;
  return (
    isCorretor &&
    !desbloqueado &&
    !perfilIncompleto &&
    location !== "/tarefas-do-dia" &&
    location !== "/modo-blitz" &&
    location !== "/configuracoes"
  );
}

function shouldShowOnboardingModal(params: {
  completo: boolean;
  role: string;
}): boolean {
  const { completo, role } = params;
  if (role === "admin") return false;
  return !completo;
}

describe("Prioridade de Bloqueio: Onboarding vs Follow-up", () => {
  const perfilIncompleto = {
    name: "Graziele",
    email: "graziele@example.com",
    telefone: null,
    cpf: null,
    dataNascimento: null,
    fotoUrl: null,
    dataCredenciamento: null,
    status: null,
    cep: null,
    logradouro: null,
    numero: null,
    bairro: null,
    cidade: null,
    estado: null,
    role: "corretor" as const,
  };

  const perfilCompleto = {
    name: "João Silva",
    email: "joao@example.com",
    telefone: "(11) 99999-9999",
    cpf: "123.456.789-00",
    dataNascimento: new Date("1990-01-01"),
    fotoUrl: "https://example.com/foto.jpg",
    dataCredenciamento: new Date("2024-01-01"),
    status: "presente" as const,
    cep: "01310-100",
    logradouro: "Av. Paulista",
    numero: "1000",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    estado: "SP",
    role: "corretor" as const,
  };

  it("NÃO deve mostrar overlay de follow-up quando perfil está incompleto", () => {
    const verificacao = verificarPerfilCompletoSync(perfilIncompleto);
    expect(verificacao.completo).toBe(false);

    const showOverlay = shouldShowFollowUpOverlay({
      isCorretor: true,
      desbloqueado: false, // follow-ups pendentes
      perfilIncompleto: !verificacao.completo, // true = perfil incompleto
      location: "/dashboard",
    });

    expect(showOverlay).toBe(false);
  });

  it("DEVE mostrar modal de onboarding quando perfil está incompleto (corretor)", () => {
    const verificacao = verificarPerfilCompletoSync(perfilIncompleto);

    const showModal = shouldShowOnboardingModal({
      completo: verificacao.completo,
      role: "corretor",
    });

    expect(showModal).toBe(true);
  });

  it("NÃO deve mostrar overlay de follow-up na rota /configuracoes", () => {
    const showOverlay = shouldShowFollowUpOverlay({
      isCorretor: true,
      desbloqueado: false,
      perfilIncompleto: false, // mesmo com perfil completo
      location: "/configuracoes",
    });

    expect(showOverlay).toBe(false);
  });

  it("DEVE mostrar overlay de follow-up quando perfil está completo e follow-ups pendentes", () => {
    const verificacao = verificarPerfilCompletoSync(perfilCompleto);
    expect(verificacao.completo).toBe(true);

    const showOverlay = shouldShowFollowUpOverlay({
      isCorretor: true,
      desbloqueado: false,
      perfilIncompleto: !verificacao.completo, // false = perfil completo
      location: "/dashboard",
    });

    expect(showOverlay).toBe(true);
  });

  it("NÃO deve mostrar overlay de follow-up para admin", () => {
    const showOverlay = shouldShowFollowUpOverlay({
      isCorretor: false, // admin não é corretor
      desbloqueado: false,
      perfilIncompleto: false,
      location: "/dashboard",
    });

    expect(showOverlay).toBe(false);
  });

  it("NÃO deve mostrar modal de onboarding para admin mesmo com perfil incompleto", () => {
    const showModal = shouldShowOnboardingModal({
      completo: false,
      role: "admin",
    });

    expect(showModal).toBe(false);
  });

  it("cenário Graziele: ambos bloqueios ativos, apenas onboarding deve aparecer", () => {
    const verificacao = verificarPerfilCompletoSync(perfilIncompleto);
    
    // Graziele tem perfil incompleto
    expect(verificacao.completo).toBe(false);
    
    // Modal de onboarding DEVE aparecer
    const showOnboarding = shouldShowOnboardingModal({
      completo: verificacao.completo,
      role: "corretor",
    });
    expect(showOnboarding).toBe(true);
    
    // Overlay de follow-up NÃO deve aparecer (prioridade para onboarding)
    const showFollowUp = shouldShowFollowUpOverlay({
      isCorretor: true,
      desbloqueado: false,
      perfilIncompleto: !verificacao.completo,
      location: "/dashboard",
    });
    expect(showFollowUp).toBe(false);
  });

  it("cenário Graziele: ao clicar 'Completar Cadastro', rota /configuracoes deve estar livre", () => {
    // Mesmo que o perfil fique completo depois, /configuracoes está sempre livre
    const showFollowUp = shouldShowFollowUpOverlay({
      isCorretor: true,
      desbloqueado: false,
      perfilIncompleto: false,
      location: "/configuracoes",
    });
    expect(showFollowUp).toBe(false);
  });
});
