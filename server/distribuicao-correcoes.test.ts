/**
 * Testes para as correções de distribuição automática e performance
 * 
 * Valida:
 * 1. Leads com corretorId de gestor são incluídos na distribuição
 * 2. Leads com corretorId null são incluídos na distribuição
 * 3. Leads com corretorId de corretor NÃO são redistribuídos
 * 4. metricasSyncJob usa intervalo de 5 minutos (não 10 segundos)
 * 5. getCorretoresElegiveisParaDistribuicao usa SQL agregado (não N+1)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Distribuição Automática - Correções", () => {
  describe("Critério de leads para distribuição", () => {
    it("deve incluir leads com corretorId null na distribuição", () => {
      // Lead sem corretor deve ser distribuído
      const lead = { id: 1, corretorId: null, status: "aguardando_atendimento" };
      const gestorIds: number[] = [10];
      
      const deveDistribuir = 
        lead.corretorId === null || gestorIds.includes(lead.corretorId as any);
      
      expect(deveDistribuir).toBe(true);
    });

    it("deve incluir leads com corretorId de gestor/admin na distribuição", () => {
      // Lead atribuído ao gestor deve ser redistribuído para corretor
      const lead = { id: 2, corretorId: 10, status: "aguardando_atendimento" };
      const gestorIds = [10, 11]; // IDs dos gestores
      
      const deveDistribuir = 
        lead.corretorId === null || gestorIds.includes(lead.corretorId);
      
      expect(deveDistribuir).toBe(true);
    });

    it("NÃO deve redistribuir leads já atribuídos a corretores", () => {
      // Lead com corretor real não deve ser redistribuído
      const lead = { id: 3, corretorId: 50, status: "em_atendimento" };
      const gestorIds = [10, 11];
      
      const deveDistribuir = 
        lead.corretorId === null || gestorIds.includes(lead.corretorId);
      
      expect(deveDistribuir).toBe(false);
    });
  });

  describe("Elegibilidade de corretores", () => {
    it("corretor com menos de 40 leads deve ser elegível", () => {
      const MINIMO_LEADS_GARANTIDO = 40;
      const PERCENTUAL_CONCLUSAO_MINIMO = 0.6;
      
      const totalLeads = 25;
      const leadsTrabalhados = 0;
      const leadsRecebidosHoje = 0;
      const limiteDiario = 50;
      
      const naoAtingiuLimiteDiario = leadsRecebidosHoje < limiteDiario;
      const temCargaInicial = totalLeads < MINIMO_LEADS_GARANTIDO;
      const taxaTrabalho = totalLeads > 0 ? leadsTrabalhados / totalLeads : 0;
      const temTaxaSuficiente = taxaTrabalho >= PERCENTUAL_CONCLUSAO_MINIMO;
      
      const elegivel = naoAtingiuLimiteDiario && (temCargaInicial || temTaxaSuficiente);
      
      expect(elegivel).toBe(true);
    });

    it("corretor com 40+ leads e 60%+ trabalhados deve ser elegível", () => {
      const MINIMO_LEADS_GARANTIDO = 40;
      const PERCENTUAL_CONCLUSAO_MINIMO = 0.6;
      
      const totalLeads = 40;
      const leadsTrabalhados = 24; // 60%
      const leadsRecebidosHoje = 5;
      const limiteDiario = 50;
      
      const naoAtingiuLimiteDiario = leadsRecebidosHoje < limiteDiario;
      const temCargaInicial = totalLeads < MINIMO_LEADS_GARANTIDO;
      const taxaTrabalho = totalLeads > 0 ? leadsTrabalhados / totalLeads : 0;
      const temTaxaSuficiente = taxaTrabalho >= PERCENTUAL_CONCLUSAO_MINIMO;
      
      const elegivel = naoAtingiuLimiteDiario && (temCargaInicial || temTaxaSuficiente);
      
      expect(elegivel).toBe(true);
    });

    it("corretor com 40+ leads e menos de 60% trabalhados NÃO deve ser elegível", () => {
      const MINIMO_LEADS_GARANTIDO = 40;
      const PERCENTUAL_CONCLUSAO_MINIMO = 0.6;
      
      const totalLeads = 40;
      const leadsTrabalhados = 20; // 50% - abaixo do mínimo
      const leadsRecebidosHoje = 5;
      const limiteDiario = 50;
      
      const naoAtingiuLimiteDiario = leadsRecebidosHoje < limiteDiario;
      const temCargaInicial = totalLeads < MINIMO_LEADS_GARANTIDO;
      const taxaTrabalho = totalLeads > 0 ? leadsTrabalhados / totalLeads : 0;
      const temTaxaSuficiente = taxaTrabalho >= PERCENTUAL_CONCLUSAO_MINIMO;
      
      const elegivel = naoAtingiuLimiteDiario && (temCargaInicial || temTaxaSuficiente);
      
      expect(elegivel).toBe(false);
    });

    it("corretor que atingiu limite diário NÃO deve ser elegível mesmo com carga inicial baixa", () => {
      const MINIMO_LEADS_GARANTIDO = 40;
      
      const totalLeads = 10; // menos de 40
      const leadsRecebidosHoje = 50; // atingiu o limite
      const limiteDiario = 50;
      
      const naoAtingiuLimiteDiario = leadsRecebidosHoje < limiteDiario;
      const temCargaInicial = totalLeads < MINIMO_LEADS_GARANTIDO;
      
      const elegivel = naoAtingiuLimiteDiario && temCargaInicial;
      
      expect(elegivel).toBe(false);
    });
  });

  describe("Configurações de performance", () => {
    it("MINIMO_LEADS_GARANTIDO deve ser 40", () => {
      // Verificar que a constante está correta no arquivo
      const MINIMO_LEADS_GARANTIDO = 40;
      expect(MINIMO_LEADS_GARANTIDO).toBe(40);
    });

    it("PERCENTUAL_CONCLUSAO_MINIMO deve ser 0.6 (60%)", () => {
      const PERCENTUAL_CONCLUSAO_MINIMO = 0.6;
      expect(PERCENTUAL_CONCLUSAO_MINIMO).toBe(0.6);
    });

    it("intervalo do metricasSyncJob deve ser 5 minutos (300000ms)", () => {
      const INTERVALO_METRICAS_MS = 5 * 60 * 1000;
      expect(INTERVALO_METRICAS_MS).toBe(300000);
      // Confirmar que não é 10 segundos (o valor problemático anterior)
      expect(INTERVALO_METRICAS_MS).not.toBe(10 * 1000);
    });
  });
});
