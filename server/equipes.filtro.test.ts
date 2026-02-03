import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getCorretoresIdsParaFiltro, getEquipeByGestor, getCorretoresDaEquipe } from './equipes';
import * as db from './db';

/**
 * Testes para o sistema de filtro de equipes
 * 
 * O sistema deve filtrar dados do dashboard baseado no role do usuário:
 * - Admin: vê todos os dados (corretoresIds = null)
 * - Gestor: vê apenas dados da sua equipe (corretoresIds = [ids dos membros])
 * - Corretor: vê apenas seus próprios dados (corretoresIds = [seu id])
 */
describe('Sistema de Filtro de Equipes', () => {
  // IDs conhecidos do sistema
  const ADMIN_ID = 7722800; // guilherme_97fm@outlook.com
  const GESTOR_ID = 5055943; // guilherme.97fn@gmail.com
  const CORRETOR_BRENO_ID = 8082380; // Breno Brunelli (membro da equipe)
  
  describe('getCorretoresIdsParaFiltro', () => {
    it('deve retornar null para admin (sem filtro)', async () => {
      const result = await getCorretoresIdsParaFiltro(ADMIN_ID, 'admin');
      expect(result).toBeNull();
    });

    it('deve retornar IDs dos membros da equipe para gestor', async () => {
      const result = await getCorretoresIdsParaFiltro(GESTOR_ID, 'gestor');
      
      // Gestor deve ter uma equipe com membros
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(true);
      expect(result!.length).toBeGreaterThan(0);
      
      // Deve incluir o corretor Breno que está na equipe
      expect(result).toContain(CORRETOR_BRENO_ID);
    });

    it('deve retornar apenas o próprio ID para corretor', async () => {
      const result = await getCorretoresIdsParaFiltro(CORRETOR_BRENO_ID, 'corretor');
      
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([CORRETOR_BRENO_ID]);
    });
  });

  describe('getEquipeByGestor', () => {
    it('deve retornar equipe para gestor válido', async () => {
      const equipe = await getEquipeByGestor(GESTOR_ID);
      
      expect(equipe).not.toBeNull();
      expect(equipe?.gestorId).toBe(GESTOR_ID);
      expect(equipe?.nome).toBeDefined();
    });

    it('deve retornar null para usuário sem equipe', async () => {
      const equipe = await getEquipeByGestor(999999999);
      expect(equipe).toBeNull();
    });
  });

  describe('getCorretoresDaEquipe', () => {
    it('deve retornar membros da equipe', async () => {
      const equipe = await getEquipeByGestor(GESTOR_ID);
      expect(equipe).not.toBeNull();
      
      const membros = await getCorretoresDaEquipe(equipe!.id);
      
      expect(Array.isArray(membros)).toBe(true);
      expect(membros.length).toBeGreaterThan(0);
      
      // Breno deve estar na equipe
      const breno = membros.find(m => m.id === CORRETOR_BRENO_ID);
      expect(breno).toBeDefined();
    });
  });

  describe('getDashboardMetrics com filtro', () => {
    it('deve retornar métricas filtradas para equipe do gestor', async () => {
      // Obter IDs dos corretores da equipe
      const corretoresIds = await getCorretoresIdsParaFiltro(GESTOR_ID, 'gestor');
      expect(corretoresIds).not.toBeNull();
      
      // Buscar métricas filtradas
      const metricasFiltradas = await db.getDashboardMetrics({ corretoresIds });
      
      // Métricas devem existir
      expect(metricasFiltradas).toBeDefined();
      expect(metricasFiltradas.total).toBeGreaterThanOrEqual(0);
      
      // Buscar métricas sem filtro (admin)
      const metricasTotais = await db.getDashboardMetrics({});
      
      // Métricas filtradas devem ser <= métricas totais
      expect(metricasFiltradas.total).toBeLessThanOrEqual(metricasTotais.total);
    });

    it('deve retornar todas as métricas quando corretoresIds é null', async () => {
      const metricasSemFiltro = await db.getDashboardMetrics({ corretoresIds: null });
      const metricasComUndefined = await db.getDashboardMetrics({});
      
      // Ambas devem retornar os mesmos valores
      expect(metricasSemFiltro.total).toBe(metricasComUndefined.total);
    });
  });

  describe('getLeadsPorCorretorDashboard com filtro', () => {
    it('deve retornar apenas corretores da equipe quando filtrado', async () => {
      const corretoresIds = await getCorretoresIdsParaFiltro(GESTOR_ID, 'gestor');
      expect(corretoresIds).not.toBeNull();
      
      const resultado = await db.getLeadsPorCorretorDashboard({ corretoresIds });
      
      // Todos os corretores retornados devem estar na lista de IDs
      for (const corretor of resultado) {
        expect(corretoresIds).toContain(corretor.id);
      }
    });
  });
});
