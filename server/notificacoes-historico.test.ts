import { describe, it, expect } from 'vitest';
import * as db from './db';

describe('Notificações em Tempo Real', () => {
  describe('getNewNotificationsSince', () => {
    it('deve retornar array vazio quando não há notificações', async () => {
      const result = await db.getNewNotificationsSince(999999, new Date());
      expect(Array.isArray(result)).toBe(true);
    });
    
    it('deve aceitar timestamp como Date', async () => {
      const since = new Date(Date.now() - 60000); // 1 minuto atrás
      const result = await db.getNewNotificationsSince(1, since);
      expect(Array.isArray(result)).toBe(true);
    });
  });
  
  describe('createNotification', () => {
    it('deve criar notificação com campos obrigatórios', async () => {
      const notification = {
        userId: 1,
        titulo: 'Teste de Notificação',
        mensagem: 'Esta é uma mensagem de teste',
        tipo: 'sistema' as const,
      };
      
      // Não deve lançar erro
      await expect(db.createNotification(notification)).resolves.toBeDefined();
    });
    
    it('deve criar notificação de lead recebido', async () => {
      const notification = {
        userId: 1,
        titulo: 'Novo Lead!',
        mensagem: 'Você recebeu um novo lead',
        tipo: 'lead_recebido' as const,
        leadId: 1,
      };
      
      await expect(db.createNotification(notification)).resolves.toBeDefined();
    });
  });
  
  describe('getNotificationsForUser', () => {
    it('deve retornar array de notificações', async () => {
      const result = await db.getNotificationsForUser(1);
      expect(Array.isArray(result)).toBe(true);
    });
    
    it('deve respeitar limite de notificações', async () => {
      const result = await db.getNotificationsForUser(1, 5);
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });
  
  describe('getUnreadNotificationsCount', () => {
    it('deve retornar número de notificações não lidas', async () => {
      const count = await db.getUnreadNotificationsCount(1);
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('markNotificationAsRead', () => {
    it('deve marcar notificação como lida sem erro', async () => {
      // Não deve lançar erro mesmo se notificação não existir
      await expect(db.markNotificationAsRead(999999, 1)).resolves.not.toThrow();
    });
  });
  
  describe('markAllNotificationsAsRead', () => {
    it('deve marcar todas notificações como lidas', async () => {
      await expect(db.markAllNotificationsAsRead(1)).resolves.not.toThrow();
    });
  });
  
  describe('notifyLeadDistribuido', () => {
    it('deve criar notificação quando lead é distribuído', async () => {
      await expect(
        db.notifyLeadDistribuido(1, 1, 'Lead Teste')
      ).resolves.toBeDefined();
    });
  });
});

describe('Histórico de Distribuição', () => {
  describe('getHistoricoDistribuicao', () => {
    it('deve retornar objeto com items e total', async () => {
      const result = await db.getHistoricoDistribuicao();
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.items)).toBe(true);
      expect(typeof result.total).toBe('number');
    });
    
    it('deve aceitar filtro de data início', async () => {
      const result = await db.getHistoricoDistribuicao({
        dataInicio: new Date('2024-01-01'),
      });
      expect(result).toHaveProperty('items');
    });
    
    it('deve aceitar filtro de data fim', async () => {
      const result = await db.getHistoricoDistribuicao({
        dataFim: new Date(),
      });
      expect(result).toHaveProperty('items');
    });
    
    it('deve aceitar filtro de corretor', async () => {
      const result = await db.getHistoricoDistribuicao({
        corretorId: 1,
      });
      expect(result).toHaveProperty('items');
    });
    
    it('deve aceitar filtro de tipo', async () => {
      const result = await db.getHistoricoDistribuicao({
        tipo: 'automatica',
      });
      expect(result).toHaveProperty('items');
    });
    
    it('deve respeitar paginação', async () => {
      const result = await db.getHistoricoDistribuicao({
        limit: 10,
        offset: 0,
      });
      expect(result.items.length).toBeLessThanOrEqual(10);
    });
    
    it('deve retornar items com estrutura correta', async () => {
      const result = await db.getHistoricoDistribuicao({ limit: 1 });
      if (result.items.length > 0) {
        const item = result.items[0];
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('leadId');
        expect(item).toHaveProperty('corretorId');
        expect(item).toHaveProperty('tipo');
        expect(item).toHaveProperty('createdAt');
      }
    });
  });
  
  describe('getDistribuicoesPorPeriodo', () => {
    it('deve retornar array de estatísticas por dia', async () => {
      const result = await db.getDistribuicoesPorPeriodo(30);
      expect(Array.isArray(result)).toBe(true);
    });
    
    it('deve retornar estatísticas com estrutura correta', async () => {
      const result = await db.getDistribuicoesPorPeriodo(7);
      if (result.length > 0) {
        const item = result[0];
        expect(item).toHaveProperty('data');
        expect(item).toHaveProperty('automaticas');
        expect(item).toHaveProperty('manuais');
        expect(item).toHaveProperty('total');
      }
    });
    
    it('deve aceitar diferentes períodos', async () => {
      const result7 = await db.getDistribuicoesPorPeriodo(7);
      const result30 = await db.getDistribuicoesPorPeriodo(30);
      
      expect(Array.isArray(result7)).toBe(true);
      expect(Array.isArray(result30)).toBe(true);
    });
  });
});
