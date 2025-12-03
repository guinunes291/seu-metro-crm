import { describe, it, expect } from "vitest";
import { gerarInstrucoesAcesso } from "./conviteCorretor";

describe("Sistema de Convite de Corretores", () => {
  it("deve gerar instruções de acesso completas", () => {
    const nome = "João Silva";
    const url = "https://crm.example.com";
    
    const instrucoes = gerarInstrucoesAcesso(nome, url);
    
    expect(instrucoes).toContain(nome);
    expect(instrucoes).toContain(url);
    expect(instrucoes).toContain("Manus");
    expect(instrucoes).toContain("convite");
  });

  it("deve incluir passos de acesso nas instruções", () => {
    const instrucoes = gerarInstrucoesAcesso("Maria", "https://test.com");
    
    expect(instrucoes).toContain("Como acessar");
    expect(instrucoes).toContain("Aguarde receber");
    expect(instrucoes).toContain("Clique no link");
    expect(instrucoes).toContain("Faça login");
  });

  it("deve incluir informações sobre credenciais", () => {
    const instrucoes = gerarInstrucoesAcesso("Pedro", "https://test.com");
    
    expect(instrucoes).toContain("credenciais");
    expect(instrucoes).toContain("Email");
    expect(instrucoes).toContain("Senha");
  });

  it("deve incluir mensagem de boas-vindas", () => {
    const nome = "Ana";
    const instrucoes = gerarInstrucoesAcesso(nome, "https://test.com");
    
    expect(instrucoes).toContain(`Olá ${nome}`);
    expect(instrucoes).toContain("Bem-vindo");
  });
});
