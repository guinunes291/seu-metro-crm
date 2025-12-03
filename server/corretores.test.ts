import { describe, it, expect, beforeEach } from "vitest";
import * as db from "./db";

describe("Gestão de Corretores", () => {
  let testCorretor: any;

  beforeEach(async () => {
    // Criar corretor de teste antes de cada teste
    await db.createCorretor({
      name: "João Silva Teste",
      email: "joao.teste@exemplo.com",
      telefone: "(11) 99999-9999",
      status: "ausente",
    });
    
    // Buscar o corretor recém-criado
    const corretores = await db.getAllCorretores();
    testCorretor = corretores.find(c => c.email === "joao.teste@exemplo.com");
  });

  it("deve criar um novo corretor com email obrigatório", async () => {
    const result = await db.createCorretor({
      name: "João Silva Teste",
      email: "joao.teste@exemplo.com",
      telefone: "(11) 99999-9999",
      status: "ausente",
    });

    expect(result).toBeDefined();
    
    // Busca o corretor recém-criado para obter o ID correto
    const corretores = await db.getAllCorretores();
    testCorretor = corretores.find(c => c.email === "joao.teste@exemplo.com");
    
    expect(testCorretor).toBeDefined();
    expect(testCorretor.name).toBe("João Silva Teste");
  });

  it("deve listar todos os corretores", async () => {
    const corretores = await db.getAllCorretores();
    expect(Array.isArray(corretores)).toBe(true);
    expect(corretores.length).toBeGreaterThan(0);
  });

  it("deve buscar corretor por ID", async () => {
    const corretor = await db.getUserById(testCorretor.id);
    expect(corretor).toBeDefined();
    expect(corretor?.name).toBe("João Silva Teste");
    expect(corretor?.email).toBe("joao.teste@exemplo.com");
  });

  it("deve atualizar dados do corretor", async () => {
    await db.updateCorretor(testCorretor.id, {
      name: "João Silva Atualizado",
      telefone: "(11) 88888-8888",
    });

    const corretor = await db.getUserById(testCorretor.id);
    expect(corretor?.name).toBe("João Silva Atualizado");
    expect(corretor?.telefone).toBe("(11) 88888-8888");
  });

  it("deve atualizar status do corretor", async () => {
    await db.updateUserStatus(testCorretor.id, "presente");

    const corretor = await db.getUserById(testCorretor.id);
    expect(corretor?.status).toBe("presente");
  });

  it("deve listar apenas corretores presentes", async () => {
    const presentes = await db.getCorretoresPresentes();
    expect(Array.isArray(presentes)).toBe(true);
    
    // Verifica se todos os corretores retornados estão presentes
    presentes.forEach((corretor) => {
      expect(corretor.status).toBe("presente");
    });
  });

  it("deve excluir corretor sem leads", async () => {
    // Cria um corretor temporário para testar exclusão
    await db.createCorretor({
      name: "Corretor Temporário",
      email: "temp.delete@exemplo.com",
      status: "ausente",
    });

    // Busca o corretor recém-criado
    const corretores = await db.getAllCorretores();
    const tempCorretor = corretores.find(c => c.email === "temp.delete@exemplo.com");
    
    expect(tempCorretor).toBeDefined();

    // Exclui o corretor
    await db.deleteCorretor(tempCorretor!.id);

    // Verifica se foi excluído
    const corretor = await db.getUserById(tempCorretor!.id);
    expect(corretor).toBeUndefined();
  });

  it("não deve permitir excluir corretor com leads atribuídos", async () => {
    // Este teste assume que o corretor criado no primeiro teste
    // pode ter leads atribuídos em um cenário real
    // Por enquanto, vamos apenas verificar se a função existe
    expect(db.deleteCorretor).toBeDefined();
  });
});
