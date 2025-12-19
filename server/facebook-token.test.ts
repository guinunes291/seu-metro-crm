import { describe, it, expect } from 'vitest';

describe('Facebook Access Token', () => {
  it('deve ter o token configurado', () => {
    const token = process.env.FACEBOOK_ACCESS_TOKEN;
    expect(token).toBeDefined();
    expect(token).not.toBe('');
    expect(token?.startsWith('EAA')).toBe(true);
  });

  it('deve validar o token com a Graph API', async () => {
    const token = process.env.FACEBOOK_ACCESS_TOKEN;
    if (!token) {
      throw new Error('FACEBOOK_ACCESS_TOKEN não configurado');
    }

    // Testar o token fazendo uma chamada simples à Graph API
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me?access_token=${token}`
    );
    
    const data = await response.json();
    
    // Se o token for válido, deve retornar um objeto com id
    // Se for inválido, retorna error
    if (data.error) {
      console.error('Erro do Facebook:', data.error);
      throw new Error(`Token inválido: ${data.error.message}`);
    }
    
    expect(data.id).toBeDefined();
    console.log('Token válido! ID:', data.id);
  });
});
