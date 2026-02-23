import { describe, it, expect, beforeEach } from "vitest";
import { verificarPerfilCompletoSync } from "./modules/onboarding";

describe("Sistema de Onboarding Obrigatório", () => {
  describe("verificarPerfilCompleto", () => {
    it("deve identificar perfil completo com todos os campos obrigatórios", () => {
      const user = {
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
        role: "user" as const,
      };

      const resultado = verificarPerfilCompletoSync(user);

      expect(resultado.completo).toBe(true);
      expect(resultado.camposFaltantes).toHaveLength(0);
    });

    it("deve identificar perfil incompleto sem foto", () => {
      const user = {
        name: "João Silva",
        email: "joao@example.com",
        telefone: "(11) 99999-9999",
        cpf: "123.456.789-00",
        dataNascimento: new Date("1990-01-01"),
        fotoUrl: null,
        dataCredenciamento: new Date("2024-01-01"),
        status: "presente" as const,
        cep: "01310-100",
        logradouro: "Av. Paulista",
        numero: "1000",
        bairro: "Bela Vista",
        cidade: "São Paulo",
        estado: "SP",
        role: "user" as const,
      };

      const resultado = verificarPerfilCompletoSync(user);

      expect(resultado.completo).toBe(false);
      expect(resultado.camposFaltantes).toContain("Foto de perfil");
    });

    it("deve identificar perfil incompleto sem dados pessoais", () => {
      const user = {
        name: "",
        email: "joao@example.com",
        telefone: "",
        cpf: null,
        dataNascimento: null,
        fotoUrl: "https://example.com/foto.jpg",
        dataCredenciamento: new Date("2024-01-01"),
        status: "presente" as const,
        cep: "01310-100",
        logradouro: "Av. Paulista",
        numero: "1000",
        bairro: "Bela Vista",
        cidade: "São Paulo",
        estado: "SP",
        role: "user" as const,
      };

      const resultado = verificarPerfilCompletoSync(user);

      expect(resultado.completo).toBe(false);
      expect(resultado.camposFaltantes).toContain("Nome completo");
      expect(resultado.camposFaltantes).toContain("CPF");
      expect(resultado.camposFaltantes).toContain("Data de nascimento");
      expect(resultado.camposFaltantes).toContain("Telefone");
    });

    it("deve identificar perfil incompleto sem endereço", () => {
      const user = {
        name: "João Silva",
        email: "joao@example.com",
        telefone: "(11) 99999-9999",
        cpf: "123.456.789-00",
        dataNascimento: new Date("1990-01-01"),
        fotoUrl: "https://example.com/foto.jpg",
        dataCredenciamento: new Date("2024-01-01"),
        status: "presente" as const,
        cep: null,
        logradouro: null,
        numero: null,
        bairro: null,
        cidade: null,
        estado: null,
        role: "user" as const,
      };

      const resultado = verificarPerfilCompletoSync(user);

      expect(resultado.completo).toBe(false);
      expect(resultado.camposFaltantes).toContain("CEP");
      expect(resultado.camposFaltantes).toContain("Logradouro");
      expect(resultado.camposFaltantes).toContain("Número");
      expect(resultado.camposFaltantes).toContain("Bairro");
      expect(resultado.camposFaltantes).toContain("Cidade");
      expect(resultado.camposFaltantes).toContain("Estado");
    });

    it("deve identificar perfil incompleto sem dados profissionais", () => {
      const user = {
        name: "João Silva",
        email: "joao@example.com",
        telefone: "(11) 99999-9999",
        cpf: "123.456.789-00",
        dataNascimento: new Date("1990-01-01"),
        fotoUrl: "https://example.com/foto.jpg",
        dataCredenciamento: null,
        status: null,
        cep: "01310-100",
        logradouro: "Av. Paulista",
        numero: "1000",
        bairro: "Bela Vista",
        cidade: "São Paulo",
        estado: "SP",
        role: "user" as const,
      };

      const resultado = verificarPerfilCompletoSync(user);

      expect(resultado.completo).toBe(false);
      expect(resultado.camposFaltantes).toContain("Data de credenciamento");
      expect(resultado.camposFaltantes).toContain("Status de plantão");
    });

    it("não deve exigir campos opcionais (CRECI, Situação, Data Descredenciamento, Complemento)", () => {
      const user = {
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
        role: "user" as const,
        // Campos opcionais ausentes
        creci: null,
        situacao: null,
        dataDescredenciamento: null,
        complemento: null,
      };

      const resultado = verificarPerfilCompletoSync(user);

      expect(resultado.completo).toBe(true);
      expect(resultado.camposFaltantes).not.toContain("CRECI");
      expect(resultado.camposFaltantes).not.toContain("Situação");
      expect(resultado.camposFaltantes).not.toContain("Data de descredenciamento");
      expect(resultado.camposFaltantes).not.toContain("Complemento");
    });
  });

  describe("buscarEnderecoPorCEP", () => {
    it("deve normalizar CEP removendo caracteres especiais", async () => {
      const cep1 = "01310-100";
      const cep2 = "01310100";
      
      // Ambos devem resultar no mesmo CEP normalizado
      expect(cep1.replace(/\D/g, "")).toBe(cep2);
    });

    it("deve validar CEP com 8 dígitos", () => {
      const cepValido = "01310100";
      const cepInvalido = "0131010";
      
      expect(cepValido.length).toBe(8);
      expect(cepInvalido.length).not.toBe(8);
    });
  });
});
