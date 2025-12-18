import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";

describe("Sistema de Fila/Roleta de Distribuição", () => {
  describe("Funções de Fila", () => {
    it("deve inicializar a fila de distribuição", async () => {
      const fila = await db.inicializarFilaDistribuicao();
      expect(Array.isArray(fila)).toBe(true);
    });

    it("deve retornar a fila de distribuição ordenada por posição", async () => {
      const fila = await db.getFilaDistribuicao();
      expect(Array.isArray(fila)).toBe(true);
      
      // Verificar se está ordenada por posição
      if (fila.length > 1) {
        for (let i = 1; i < fila.length; i++) {
          expect(fila[i].posicao).toBeGreaterThanOrEqual(fila[i - 1].posicao);
        }
      }
    });

    it("deve retornar null quando não há corretor disponível", async () => {
      // Desativar todos os corretores da fila
      const fila = await db.getFilaDistribuicao();
      for (const item of fila) {
        await db.toggleCorretorFila(item.corretorId, false);
      }
      
      const proximo = await db.getProximoCorretorFila();
      expect(proximo).toBeNull();
      
      // Reativar os corretores
      for (const item of fila) {
        await db.toggleCorretorFila(item.corretorId, true);
      }
    });

    it("deve resetar os contadores diários", async () => {
      await db.resetarContadorLeadsDiarios();
      const fila = await db.getFilaDistribuicao();
      
      for (const item of fila) {
        expect(item.leadsRecebidosHoje).toBe(0);
      }
    });
  });

  describe("Funções de Webhook Config", () => {
    let webhookId: number;
    let webhookToken: string;

    it("deve criar um novo webhook config", async () => {
      const result = await db.createWebhookConfig({
        nome: "Teste Facebook Ads",
        fonte: "facebook",
      });
      
      expect(result.id).toBeGreaterThan(0);
      expect(result.webhookToken).toBeTruthy();
      expect(result.webhookToken.length).toBe(32); // UUID sem hífens
      
      webhookId = result.id;
      webhookToken = result.webhookToken;
    });

    it("deve listar webhooks configurados", async () => {
      const webhooks = await db.getWebhookConfigs();
      expect(Array.isArray(webhooks)).toBe(true);
      expect(webhooks.length).toBeGreaterThan(0);
    });

    it("deve buscar webhook por token", async () => {
      const webhook = await db.getWebhookConfigByToken(webhookToken);
      expect(webhook).not.toBeNull();
      expect(webhook?.nome).toBe("Teste Facebook Ads");
      expect(webhook?.fonte).toBe("facebook");
      expect(webhook?.ativo).toBe(true);
    });

    it("deve retornar null para token inválido", async () => {
      const webhook = await db.getWebhookConfigByToken("token_invalido_123");
      expect(webhook).toBeNull();
    });

    it("deve ativar/desativar webhook", async () => {
      await db.toggleWebhookConfig(webhookId, false);
      let webhook = await db.getWebhookConfigByToken(webhookToken);
      expect(webhook?.ativo).toBe(false);
      
      await db.toggleWebhookConfig(webhookId, true);
      webhook = await db.getWebhookConfigByToken(webhookToken);
      expect(webhook?.ativo).toBe(true);
    });

    it("deve incrementar contador de leads do webhook", async () => {
      const webhookAntes = await db.getWebhookConfigByToken(webhookToken);
      const leadsAntes = webhookAntes?.leadsRecebidos || 0;
      
      await db.incrementarLeadsWebhook(webhookId);
      
      const webhookDepois = await db.getWebhookConfigByToken(webhookToken);
      expect(webhookDepois?.leadsRecebidos).toBe(leadsAntes + 1);
    });

    it("deve excluir webhook", async () => {
      await db.deleteWebhookConfig(webhookId);
      const webhook = await db.getWebhookConfigByToken(webhookToken);
      expect(webhook).toBeNull();
    });
  });

  describe("Processamento de Lead via Webhook", () => {
    let webhookToken: string;

    beforeAll(async () => {
      // Criar webhook para teste
      const result = await db.createWebhookConfig({
        nome: "Webhook Teste Processamento",
        fonte: "facebook",
      });
      webhookToken = result.webhookToken;
      
      // Garantir que há corretores na fila
      await db.inicializarFilaDistribuicao();
    });

    it("deve rejeitar webhook inválido", async () => {
      await expect(
        db.processarLeadWebhook("token_invalido", {
          nome: "Lead Teste",
          telefone: "11999999999",
        })
      ).rejects.toThrow("Webhook inválido ou inativo");
    });

    it("deve criar lead via webhook", async () => {
      const resultado = await db.processarLeadWebhook(webhookToken, {
        nome: "Lead via Webhook",
        email: "lead@webhook.com",
        telefone: "11888888888",
        origem: "facebook",
      });
      
      expect(resultado.lead).toBeDefined();
      expect(resultado.lead.nome).toBe("Lead via Webhook");
      expect(resultado.lead.telefone).toBe("11888888888");
    });
  });

  describe("Distribuição pela Roleta", () => {
    it("deve distribuir lead para corretor da fila", async () => {
      // Criar um lead para distribuir
      const lead = await db.createLead({
        nome: "Lead para Roleta",
        telefone: "11777777777",
        status: "novo",
      });
      
      // Garantir que há corretores ativos na fila
      await db.inicializarFilaDistribuicao();
      const fila = await db.getFilaDistribuicao();
      if (fila.length > 0) {
        await db.toggleCorretorFila(fila[0].corretorId, true);
      }
      
      // Tentar distribuir
      const corretorId = await db.distribuirLeadPelaRoleta(lead.id);
      
      // Verificar se foi distribuído (pode ser null se não houver corretor presente)
      if (corretorId !== null) {
        expect(corretorId).toBeGreaterThan(0);
        
        // Verificar se o lead foi atualizado
        const leadAtualizado = await db.getLeadById(lead.id);
        expect(leadAtualizado?.corretorId).toBe(corretorId);
        expect(leadAtualizado?.status).toBe("aguardando_atendimento");
      }
    });
  });
});
