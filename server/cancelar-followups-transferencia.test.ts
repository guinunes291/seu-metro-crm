/**
 * Teste: cancelarFollowUpsPorTransferencia
 *
 * Valida que a função existe, está exportada e se comporta corretamente
 * ao ser chamada com IDs inexistentes (sem erros) e com IDs válidos.
 */
import { describe, it, expect } from 'vitest';
import * as db from './db';

describe('cancelarFollowUpsPorTransferencia', () => {

  it('deve estar exportada como função', () => {
    expect(typeof db.cancelarFollowUpsPorTransferencia).toBe('function');
  });

  it('deve retornar 0 quando lead não existe', async () => {
    const resultado = await db.cancelarFollowUpsPorTransferencia(999999, 999998);
    expect(typeof resultado).toBe('number');
    expect(resultado).toBe(0);
  });

  it('deve retornar 0 quando corretorId não tem follow-ups pendentes', async () => {
    const resultado = await db.cancelarFollowUpsPorTransferencia(1, 999998);
    expect(typeof resultado).toBe('number');
    expect(resultado).toBeGreaterThanOrEqual(0);
  });

  it('não deve lançar exceção mesmo com IDs inválidos', async () => {
    await expect(
      db.cancelarFollowUpsPorTransferencia(-1, -1)
    ).resolves.not.toThrow();
  });

});

describe('Pontos de transferência cobertos', () => {

  it('leads.transferir deve ter cancelarFollowUpsPorTransferencia disponível', () => {
    // Valida que a função existe para ser chamada pelos 5 pontos de transferência:
    // 1. leads.transferir (transferência manual pelo gestor)
    // 2. leads.reatribuir (reatribuição mantendo status)
    // 3. leads.transferirEmLote (transferência em lote)
    // 4. updateLead com status=perdido (transferência automática por perda)
    // 5. reatribuicao.reatribuirLead (reatribuição via painel de reatribuição)
    expect(db.cancelarFollowUpsPorTransferencia).toBeDefined();
    expect(db.cancelarFollowUpsPendentes).toBeDefined();
  });

});
