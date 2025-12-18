import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";

describe("Gráficos - Métricas Históricas", () => {
  it("deve retornar array de métricas históricas", async () => {
    const resultado = await db.getMetricasHistoricas(30);
    
    expect(Array.isArray(resultado)).toBe(true);
  });

  it("deve retornar métricas com estrutura correta", async () => {
    const resultado = await db.getMetricasHistoricas(7);
    
    // Deve ter 7 dias de dados
    expect(resultado.length).toBeLessThanOrEqual(7);
    
    if (resultado.length > 0) {
      const primeiroItem = resultado[0];
      expect(primeiroItem).toHaveProperty("data");
      expect(primeiroItem).toHaveProperty("total");
      expect(primeiroItem).toHaveProperty("novos");
      expect(primeiroItem).toHaveProperty("contratosFechados");
      expect(primeiroItem).toHaveProperty("perdidos");
    }
  });

  it("deve aceitar diferentes períodos", async () => {
    const resultado7dias = await db.getMetricasHistoricas(7);
    const resultado30dias = await db.getMetricasHistoricas(30);
    
    expect(resultado7dias.length).toBeLessThanOrEqual(7);
    expect(resultado30dias.length).toBeLessThanOrEqual(30);
  });
});

describe("Gráficos - Evolução do Funil", () => {
  it("deve retornar dados do funil", async () => {
    const resultado = await db.getEvolucaoFunil(30);
    
    expect(Array.isArray(resultado)).toBe(true);
  });

  it("deve retornar etapas do funil com estrutura correta", async () => {
    const resultado = await db.getEvolucaoFunil(30);
    
    // Deve ter as etapas do funil
    expect(resultado.length).toBeGreaterThan(0);
    
    const primeiraEtapa = resultado[0];
    expect(primeiraEtapa).toHaveProperty("etapa");
    expect(primeiraEtapa).toHaveProperty("valor");
    expect(primeiraEtapa).toHaveProperty("cor");
  });

  it("deve incluir todas as etapas do funil", async () => {
    const resultado = await db.getEvolucaoFunil(30);
    
    const etapas = resultado.map(r => r.etapa);
    expect(etapas).toContain("Novos");
    expect(etapas).toContain("Aguardando");
    expect(etapas).toContain("Em Atendimento");
    expect(etapas).toContain("Agendados");
    expect(etapas).toContain("Visitas");
    expect(etapas).toContain("Análise de Crédito");
    expect(etapas).toContain("Contratos Fechados");
    expect(etapas).toContain("Perdidos");
  });
});

describe("Metas - CRUD", () => {
  let metaCriada: any;
  const corretorIdTeste = 1; // ID de teste
  const mesTeste = 12;
  const anoTeste = 2025;

  it("deve criar uma nova meta", async () => {
    // Primeiro, limpar qualquer meta existente para o teste
    const metaExistente = await db.getMetaByCorretorMesAno(corretorIdTeste, mesTeste, anoTeste);
    if (metaExistente) {
      await db.deleteMeta(metaExistente.id);
    }

    const novaMeta = await db.createMeta({
      corretorId: corretorIdTeste,
      mes: mesTeste,
      ano: anoTeste,
      metaLeads: 50,
      metaAgendamentos: 20,
      metaVisitas: 15,
      metaContratos: 5,
      metaVGV: 50000000, // R$ 500.000 em centavos
      observacoes: "Meta de teste",
    });

    expect(novaMeta).toBeDefined();
    expect(novaMeta.id).toBeDefined();
    expect(novaMeta.corretorId).toBe(corretorIdTeste);
    expect(novaMeta.mes).toBe(mesTeste);
    expect(novaMeta.ano).toBe(anoTeste);
    expect(novaMeta.metaLeads).toBe(50);
    
    metaCriada = novaMeta;
  });

  it("deve buscar meta por corretor/mês/ano", async () => {
    const meta = await db.getMetaByCorretorMesAno(corretorIdTeste, mesTeste, anoTeste);
    
    expect(meta).toBeDefined();
    expect(meta?.corretorId).toBe(corretorIdTeste);
    expect(meta?.mes).toBe(mesTeste);
    expect(meta?.ano).toBe(anoTeste);
  });

  it("deve atualizar uma meta existente", async () => {
    if (!metaCriada) {
      throw new Error("Meta não foi criada no teste anterior");
    }

    await db.updateMeta(metaCriada.id, {
      metaLeads: 60,
      metaContratos: 8,
      observacoes: "Meta atualizada",
    });

    const metaAtualizada = await db.getMetaByCorretorMesAno(corretorIdTeste, mesTeste, anoTeste);
    
    expect(metaAtualizada?.metaLeads).toBe(60);
    expect(metaAtualizada?.metaContratos).toBe(8);
    expect(metaAtualizada?.observacoes).toBe("Meta atualizada");
  });

  it("deve listar metas do mês", async () => {
    const metas = await db.getMetasDoMes(mesTeste, anoTeste);
    
    expect(Array.isArray(metas)).toBe(true);
  });

  it("deve listar metas de um corretor", async () => {
    const metas = await db.getMetasDoCorretor(corretorIdTeste);
    
    expect(Array.isArray(metas)).toBe(true);
  });

  it("deve calcular progresso da meta", async () => {
    const progresso = await db.getProgressoMeta(corretorIdTeste, mesTeste, anoTeste);
    
    expect(progresso).toBeDefined();
    expect(progresso).toHaveProperty("meta");
    expect(progresso).toHaveProperty("realizado");
    expect(progresso).toHaveProperty("progresso");
    
    expect(progresso?.realizado).toHaveProperty("leads");
    expect(progresso?.realizado).toHaveProperty("agendamentos");
    expect(progresso?.realizado).toHaveProperty("visitas");
    expect(progresso?.realizado).toHaveProperty("contratos");
    expect(progresso?.realizado).toHaveProperty("vgv");
    
    expect(progresso?.progresso).toHaveProperty("leads");
    expect(progresso?.progresso).toHaveProperty("agendamentos");
    expect(progresso?.progresso).toHaveProperty("visitas");
    expect(progresso?.progresso).toHaveProperty("contratos");
    expect(progresso?.progresso).toHaveProperty("vgv");
  });

  it("deve calcular progresso de todos os corretores", async () => {
    const progressoTodos = await db.getProgressoMetasTodosCorretores(mesTeste, anoTeste);
    
    expect(Array.isArray(progressoTodos)).toBe(true);
    
    if (progressoTodos.length > 0) {
      const primeiro = progressoTodos[0];
      expect(primeiro).toHaveProperty("corretor");
      expect(primeiro.corretor).toHaveProperty("id");
      expect(primeiro.corretor).toHaveProperty("nome");
    }
  });

  it("deve excluir uma meta", async () => {
    if (!metaCriada) {
      throw new Error("Meta não foi criada no teste anterior");
    }

    await db.deleteMeta(metaCriada.id);

    const metaExcluida = await db.getMetaByCorretorMesAno(corretorIdTeste, mesTeste, anoTeste);
    expect(metaExcluida).toBeNull();
  });
});

describe("Metas - Validações", () => {
  it("deve retornar null para meta inexistente", async () => {
    const meta = await db.getMetaByCorretorMesAno(99999, 1, 2020);
    expect(meta).toBeNull();
  });

  it("deve retornar null para progresso de meta inexistente", async () => {
    const progresso = await db.getProgressoMeta(99999, 1, 2020);
    expect(progresso).toBeNull();
  });
});
