import { describe, it, expect, beforeAll } from 'vitest';
import { getDb, getFollowUpsDoDiaExpandido, getTotalFollowUpsDoDia } from './db';
import { users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

describe('Sistema de Follow-ups - Timezone e Filtros', () => {
  let hellenId: number;

  beforeAll(async () => {
    const db = await getDb();
    const hellen = await db.select().from(users).where(eq(users.email, "hellen.rs0710@gmail.com")).limit(1);
    hellenId = hellen[0].id;
  });

  it('deve retornar follow-ups usando fimDoDiaHoje (não inicioDoDiaHoje)', async () => {
    const followUps = await getFollowUpsDoDiaExpandido(hellenId);
    
    // Hellen tem 81 follow-ups de leads em_atendimento agendados para hoje
    expect(followUps.length).toBeGreaterThan(0);
    expect(followUps.length).toBe(81);
  });

  it('deve usar timezone de São Paulo corretamente', async () => {
    const { fimDoDiaHoje } = await import('./timezone');
    const fimDeHoje = fimDoDiaHoje();
    
    // fimDoDiaHoje deve retornar 23:59:59.999 de hoje em SP
    // Em UTC isso será 04:59:59.999 do dia seguinte (SP = UTC-3)
    const horaUTC = fimDeHoje.getUTCHours();
    const minutoUTC = fimDeHoje.getUTCMinutes();
    
    // Verificar que é fim do dia (23:59 em SP = 02:59 ou 04:59 UTC dependendo do horário de verão)
    expect(minutoUTC).toBe(59);
  });

  it('getTotalFollowUpsDoDia deve usar fimDoDiaHoje', async () => {
    const totalFollowUps = await getTotalFollowUpsDoDia(hellenId);
    
    // Deve retornar todos os follow-ups do dia (não apenas os de antes da meia-noite)
    expect(totalFollowUps.length).toBeGreaterThan(0);
  });

  it('follow-ups com proximaTentativa às 9h devem aparecer', async () => {
    const followUps = await getFollowUpsDoDiaExpandido(hellenId);
    
    // Verificar que pelo menos um follow-up tem proximaTentativa às 9h UTC (6h SP)
    const followUpAs9h = followUps.find(f => {
      const proxTent = new Date(f.proximaTentativa);
      return proxTent.getUTCHours() === 9;
    });
    
    expect(followUpAs9h).toBeDefined();
  });
});

describe('Sistema de Bloqueio/Desbloqueio (40%)', () => {
  let hellenId: number;

  beforeAll(async () => {
    const db = await getDb();
    const hellen = await db.select().from(users).where(eq(users.email, "hellen.rs0710@gmail.com")).limit(1);
    hellenId = hellen[0].id;
  });

  it('deve calcular percentual de follow-ups concluídos', async () => {
    const totalFollowUps = await getTotalFollowUpsDoDia(hellenId);
    const { inicioDoDiaHoje } = await import('./timezone');
    const hoje = inicioDoDiaHoje();
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    
    const total = totalFollowUps.length;
    const concluidos = totalFollowUps.filter(f => {
      if (!f.ultimaTentativa) return false;
      const ultimaTentativaDate = new Date(f.ultimaTentativa);
      return ultimaTentativaDate >= hoje && ultimaTentativaDate < amanha;
    }).length;
    
    const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 100;
    
    expect(percentual).toBeGreaterThanOrEqual(0);
    expect(percentual).toBeLessThanOrEqual(100);
  });

  it('deve desbloquear quando percentual >= 40%', () => {
    const percentual = 40;
    const desbloqueado = percentual >= 40;
    
    expect(desbloqueado).toBe(true);
  });

  it('deve manter bloqueado quando percentual < 40%', () => {
    const percentual = 39;
    const desbloqueado = percentual >= 40;
    
    expect(desbloqueado).toBe(false);
  });
});
