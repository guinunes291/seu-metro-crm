import { describe, it, expect, beforeAll } from 'vitest';
import { getSystemConfig, updateBloqueioFollowUp } from './systemConfig';

describe('Sistema de Controle de Bloqueio', () => {
  beforeAll(async () => {
    // Garantir que existe uma configuração inicial
    await updateBloqueioFollowUp(false);
  });

  it('deve buscar a configuração do sistema', async () => {
    const config = await getSystemConfig();
    
    expect(config).toBeDefined();
    expect(config).toHaveProperty('id');
    expect(config).toHaveProperty('bloqueio_ativo');
    // MySQL retorna 0/1 para BOOLEAN, então o tipo é 'number'
    expect(typeof config!.bloqueio_ativo).toBe('number');
  });

  it('deve ativar o bloqueio de follow-ups', async () => {
    const success = await updateBloqueioFollowUp(true);
    expect(success).toBe(true);
    
    const config = await getSystemConfig();
    expect(config?.bloqueio_ativo).toBeTruthy();
  });

  it('deve desativar o bloqueio de follow-ups', async () => {
    const success = await updateBloqueioFollowUp(false);
    expect(success).toBe(true);
    
    const config = await getSystemConfig();
    expect(config?.bloqueio_ativo).toBeFalsy();
  });

  it('deve alternar entre ativo e inativo múltiplas vezes', async () => {
    // Ativar
    await updateBloqueioFollowUp(true);
    let config = await getSystemConfig();
    expect(config?.bloqueio_ativo).toBeTruthy();
    
    // Desativar
    await updateBloqueioFollowUp(false);
    config = await getSystemConfig();
    expect(config?.bloqueio_ativo).toBeFalsy();
    
    // Ativar novamente
    await updateBloqueioFollowUp(true);
    config = await getSystemConfig();
    expect(config?.bloqueio_ativo).toBeTruthy();
    
    // Desativar novamente
    await updateBloqueioFollowUp(false);
    config = await getSystemConfig();
    expect(config?.bloqueio_ativo).toBeFalsy();
  });
});
