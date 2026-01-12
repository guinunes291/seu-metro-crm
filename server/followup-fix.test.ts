import { describe, it, expect } from 'vitest';
import * as db from './db';

describe('Correção de Follow-ups - Aline', () => {
  it('deve retornar follow-ups para Aline incluindo leads aguardando_atendimento', async () => {
    // ID da Aline: 6600095 (conforme diagnóstico)
    const alineId = 6600095;
    
    // Buscar follow-ups do dia expandido
    const followUps = await db.getFollowUpsDoDiaExpandido(alineId);
    
    console.log(`\n=== Resultado do teste ===`);
    console.log(`Follow-ups encontrados: ${followUps.length}`);
    
    if (followUps.length > 0) {
      console.log('\nPrimeiros 5 follow-ups:');
      followUps.slice(0, 5).forEach((f, i) => {
        console.log(`${i + 1}. Lead: ${f.leadNome} (ID: ${f.leadId})`);
        console.log(`   Status: ${f.leadStatus}, Próxima: ${f.proximaTentativa}`);
        console.log(`   Tentativa: ${f.tentativaAtual}/${f.maxTentativas}`);
      });
      
      // Verificar se há leads com status "aguardando_atendimento"
      const leadsAguardando = followUps.filter(f => f.leadStatus === 'aguardando_atendimento');
      console.log(`\nLeads "aguardando_atendimento": ${leadsAguardando.length}`);
      
      // Verificar se há leads com status "em_atendimento"
      const leadsEmAtendimento = followUps.filter(f => f.leadStatus === 'em_atendimento');
      console.log(`Leads "em_atendimento": ${leadsEmAtendimento.length}`);
    }
    
    // A correção deve fazer com que Aline tenha follow-ups visíveis
    expect(followUps.length).toBeGreaterThan(0);
    
    // Deve incluir leads com status "aguardando_atendimento" OU "em_atendimento"
    const statusValidos = followUps.every(f => 
      f.leadStatus === 'aguardando_atendimento' || f.leadStatus === 'em_atendimento'
    );
    expect(statusValidos).toBe(true);
  });
  
  it('deve retornar total de follow-ups correto', async () => {
    const alineId = 6600095;
    
    // Buscar total de follow-ups
    const totalFollowUps = await db.getTotalFollowUpsDoDia(alineId);
    
    console.log(`\n=== Total de Follow-ups ===`);
    console.log(`Total: ${totalFollowUps.length}`);
    
    expect(totalFollowUps.length).toBeGreaterThan(0);
  });
});
