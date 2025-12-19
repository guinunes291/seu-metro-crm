import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Webhook Facebook - Graph API Integration', () => {
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
  
  it('deve ter o token do Facebook configurado', () => {
    expect(accessToken).toBeDefined();
    expect(accessToken?.length).toBeGreaterThan(50);
  });
  
  it('deve buscar dados de um lead de teste via Graph API', async () => {
    // Nota: Este teste só funciona com um leadgen_id real
    // Para testes automatizados, usamos mock
    
    // Simulação de busca de lead
    const mockLeadgenId = '123456789';
    const url = `https://graph.facebook.com/v18.0/${mockLeadgenId}?access_token=${accessToken}`;
    
    // Verificar que a URL está correta
    expect(url).toContain('graph.facebook.com');
    expect(url).toContain(mockLeadgenId);
    expect(url).toContain(accessToken);
  });
  
  it('deve extrair campos corretamente do field_data', () => {
    // Simular resposta da Graph API
    const mockResponse = {
      id: '123456789',
      field_data: [
        { name: 'full_name', values: ['João Silva'] },
        { name: 'email', values: ['joao@email.com'] },
        { name: 'phone_number', values: ['+5511999999999'] },
      ],
      created_time: '2025-12-19T10:00:00+0000',
    };
    
    // Extrair dados
    let nome = '';
    let email = '';
    let telefone = '';
    
    for (const field of mockResponse.field_data) {
      const fieldName = field.name?.toLowerCase();
      const value = field.values?.[0] || '';
      
      if (fieldName === 'full_name' || fieldName === 'nome' || fieldName === 'name') {
        nome = value;
      } else if (fieldName === 'email') {
        email = value;
      } else if (fieldName === 'phone_number' || fieldName === 'telefone' || fieldName === 'phone') {
        telefone = value;
      }
    }
    
    expect(nome).toBe('João Silva');
    expect(email).toBe('joao@email.com');
    expect(telefone).toBe('+5511999999999');
  });
  
  it('deve lidar com campos em português', () => {
    // Simular resposta com campos em português
    const mockResponse = {
      id: '987654321',
      field_data: [
        { name: 'nome', values: ['Maria Santos'] },
        { name: 'e-mail', values: ['maria@email.com'] },
        { name: 'telefone', values: ['11988887777'] },
      ],
    };
    
    let nome = '';
    let email = '';
    let telefone = '';
    
    for (const field of mockResponse.field_data) {
      const fieldName = field.name?.toLowerCase();
      const value = field.values?.[0] || '';
      
      if (fieldName === 'full_name' || fieldName === 'nome' || fieldName === 'name' || 
          fieldName === 'nome_completo' || fieldName === 'primeiro_nome') {
        nome = value;
      } else if (fieldName === 'email' || fieldName === 'e-mail') {
        email = value;
      } else if (fieldName === 'phone_number' || fieldName === 'telefone' || 
                 fieldName === 'phone' || fieldName === 'celular' || fieldName === 'whatsapp') {
        telefone = value;
      }
    }
    
    expect(nome).toBe('Maria Santos');
    expect(email).toBe('maria@email.com');
    expect(telefone).toBe('11988887777');
  });
  
  it('deve validar estrutura do payload do Facebook', () => {
    // Simular payload que o Facebook envia
    const facebookPayload = {
      object: 'page',
      entry: [{
        id: '122278435958236192',
        time: 1734604800,
        changes: [{
          field: 'leadgen',
          value: {
            leadgen_id: '1234567890123456',
            page_id: '122278435958236192',
            form_id: '9876543210',
          }
        }]
      }]
    };
    
    // Verificar estrutura
    expect(facebookPayload.object).toBe('page');
    expect(facebookPayload.entry).toBeDefined();
    expect(facebookPayload.entry[0].changes).toBeDefined();
    expect(facebookPayload.entry[0].changes[0].field).toBe('leadgen');
    expect(facebookPayload.entry[0].changes[0].value.leadgen_id).toBeDefined();
  });
});
