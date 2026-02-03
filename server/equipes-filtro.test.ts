import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do banco de dados
vi.mock('./_core/db', () => ({
  getDb: vi.fn(),
}));

describe('getCorretoresIdsParaFiltro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve retornar null para admin (vê tudo)', async () => {
    const { getCorretoresIdsParaFiltro } = await import('./equipes');
    
    const result = await getCorretoresIdsParaFiltro(1, 'admin');
    
    expect(result).toBeNull();
  });

  it('deve retornar array vazio para gestor sem equipe', async () => {
    const { getDb } = await import('./_core/db');
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]), // Nenhuma equipe encontrada
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);
    
    // Reimportar para usar o mock
    vi.resetModules();
    const { getCorretoresIdsParaFiltro } = await import('./equipes');
    
    const result = await getCorretoresIdsParaFiltro(999, 'gestor');
    
    // Se não encontrar equipe, deve retornar array vazio
    expect(result).toEqual([]);
  });

  it('deve retornar próprio ID para corretor', async () => {
    const { getCorretoresIdsParaFiltro } = await import('./equipes');
    
    const result = await getCorretoresIdsParaFiltro(42, 'corretor');
    
    expect(result).toEqual([42]);
  });
});
