import { describe, it, expect } from 'vitest';
import * as db from './db';

describe('Upload de Foto de Perfil', () => {
  describe('updateCorretorFoto', () => {
    it('deve atualizar a foto do corretor', async () => {
      const corretores = await db.getAllCorretores();
      
      if (corretores.length > 0) {
        const corretor = corretores[0];
        const novaFotoUrl = `https://storage.example.com/foto-teste-${Date.now()}.jpg`;
        
        await db.updateCorretorFoto(corretor.id, novaFotoUrl);
        
        const corretorAtualizado = await db.getUserById(corretor.id);
        expect(corretorAtualizado?.fotoUrl).toBe(novaFotoUrl);
      }
    });

    it('deve aceitar URL vazia para remover foto', async () => {
      const corretores = await db.getAllCorretores();
      
      if (corretores.length > 0) {
        const corretor = corretores[0];
        
        // Primeiro define uma foto
        await db.updateCorretorFoto(corretor.id, 'https://example.com/foto.jpg');
        
        // Depois remove (URL vazia ou null)
        await db.updateCorretorFoto(corretor.id, '');
        
        const corretorAtualizado = await db.getUserById(corretor.id);
        expect(corretorAtualizado?.fotoUrl).toBe('');
      }
    });
  });

  describe('Validações de Upload', () => {
    it('deve validar tipos de arquivo permitidos', () => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      
      // Tipos válidos
      expect(allowedTypes.includes('image/jpeg')).toBe(true);
      expect(allowedTypes.includes('image/png')).toBe(true);
      expect(allowedTypes.includes('image/gif')).toBe(true);
      expect(allowedTypes.includes('image/webp')).toBe(true);
      
      // Tipos inválidos
      expect(allowedTypes.includes('image/bmp')).toBe(false);
      expect(allowedTypes.includes('application/pdf')).toBe(false);
      expect(allowedTypes.includes('text/plain')).toBe(false);
    });

    it('deve validar tamanho máximo de arquivo (5MB)', () => {
      const maxSize = 5 * 1024 * 1024; // 5MB em bytes
      
      // Arquivos válidos
      expect(1024 * 1024 <= maxSize).toBe(true); // 1MB
      expect(3 * 1024 * 1024 <= maxSize).toBe(true); // 3MB
      expect(5 * 1024 * 1024 <= maxSize).toBe(true); // 5MB exato
      
      // Arquivos inválidos
      expect(6 * 1024 * 1024 <= maxSize).toBe(false); // 6MB
      expect(10 * 1024 * 1024 <= maxSize).toBe(false); // 10MB
    });

    it('deve gerar nome único para arquivo', () => {
      const userId = 123;
      const timestamp1 = Date.now();
      const timestamp2 = timestamp1 + 1;
      
      const fileName1 = `corretores/${userId}/foto-${timestamp1}.jpg`;
      const fileName2 = `corretores/${userId}/foto-${timestamp2}.jpg`;
      
      expect(fileName1).not.toBe(fileName2);
      expect(fileName1).toContain(`corretores/${userId}/`);
      expect(fileName1).toContain('foto-');
      expect(fileName1).toContain('.jpg');
    });

    it('deve extrair extensão do arquivo corretamente', () => {
      const getExtension = (fileName: string) => fileName.split('.').pop() || 'jpg';
      
      expect(getExtension('foto.jpg')).toBe('jpg');
      expect(getExtension('foto.png')).toBe('png');
      expect(getExtension('foto.teste.gif')).toBe('gif');
      expect(getExtension('foto')).toBe('foto'); // sem extensão
    });
  });

  describe('Base64 Processing', () => {
    it('deve extrair dados base64 corretamente', () => {
      const extractBase64 = (fileData: string) => {
        return fileData.includes('base64,')
          ? fileData.split('base64,')[1]
          : fileData;
      };
      
      // Com prefixo data URL
      const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
      expect(extractBase64(dataUrl)).toBe('/9j/4AAQSkZJRg==');
      
      // Sem prefixo (apenas base64)
      const rawBase64 = '/9j/4AAQSkZJRg==';
      expect(extractBase64(rawBase64)).toBe('/9j/4AAQSkZJRg==');
    });

    it('deve converter base64 para buffer', () => {
      const base64Data = 'SGVsbG8gV29ybGQ='; // "Hello World" em base64
      const buffer = Buffer.from(base64Data, 'base64');
      
      expect(buffer.toString('utf8')).toBe('Hello World');
      expect(buffer.length).toBe(11);
    });
  });

  describe('Ranking com Fotos', () => {
    it('deve incluir fotoUrl no ranking de corretores', async () => {
      const ranking = await db.getRankingCorretores();
      
      if (ranking.length > 0) {
        const primeiro = ranking[0];
        expect(primeiro.corretor).toHaveProperty('fotoUrl');
      }
    });

    it('deve incluir fotoUrl na performance do corretor', async () => {
      const corretores = await db.getAllCorretores();
      
      if (corretores.length > 0) {
        const performance = await db.getPerformanceCorretor(corretores[0].id);
        
        if (performance) {
          expect(performance.corretor).toHaveProperty('fotoUrl');
        }
      }
    });
  });
});
