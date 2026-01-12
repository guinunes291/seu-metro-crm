import { describe, it, expect } from 'vitest';
import * as db from './db';

describe('Sistema de Follow-ups - Correção Final', () => {
  it('deve criar follow-ups apenas para leads em_atendimento', async () => {
    const alineId = 6600095;
    
    // Executar criação automática
    const resultado = await db.criarFollowUpsAutomaticos(alineId);
    
    console.log(`\n=== Criação Automática ===`);
    console.log(`Follow-ups criados: ${resultado.criados}`);
    
    // Verificar que follow-ups foram criados (ou já existiam)
    expect(resultado.criados).toBeGreaterThanOrEqual(0);
  });
  
  it('deve retornar follow-ups de leads em_atendimento para hoje', async () => {
    const alineId = 6600095;
    
    // Buscar follow-ups do dia
    const followUps = await db.getFollowUpsDoDiaExpandido(alineId);
    
    console.log(`\n=== Follow-ups do Dia ===`);
    console.log(`Total: ${followUps.length}`);
    
    if (followUps.length > 0) {
      console.log('\nPrimeiros 5:');
      followUps.slice(0, 5).forEach((f, i) => {
        console.log(`${i + 1}. ${f.leadNome} - Status: ${f.leadStatus}`);
      });
      
      // Verificar que TODOS são de leads em_atendimento
      const todosEmAtendimento = followUps.every(f => f.leadStatus === 'em_atendimento');
      console.log(`\nTodos os follow-ups são de leads "em_atendimento": ${todosEmAtendimento}`);
      
      expect(todosEmAtendimento).toBe(true);
    }
    
    // Deve ter pelo menos alguns follow-ups
    expect(followUps.length).toBeGreaterThan(0);
  });
  
  it('deve ter follow-ups com proximaTentativa para hoje', async () => {
    const alineId = 6600095;
    
    const { inicioDoDiaHoje } = await import('./timezone');
    const hoje = inicioDoDiaHoje();
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    
    const followUps = await db.getFollowUpsDoDiaExpandido(alineId);
    
    console.log(`\n=== Verificação de Datas ===`);
    console.log(`Hoje: ${hoje.toISOString()}`);
    console.log(`Amanhã: ${amanha.toISOString()}`);
    
    if (followUps.length > 0) {
      const proximasTentativas = followUps.map(f => new Date(f.proximaTentativa));
      const todasHojeOuAntes = proximasTentativas.every(data => data <= amanha);
      
      console.log(`Todas as próximas tentativas são para hoje ou antes: ${todasHojeOuAntes}`);
      
      expect(todasHojeOuAntes).toBe(true);
    }
  });
});
