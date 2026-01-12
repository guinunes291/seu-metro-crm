import { getDb } from './db';
import { sql } from 'drizzle-orm';

export interface SystemConfig {
  id: number;
  bloqueio_ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Busca a configuração do sistema
 */
export async function getSystemConfig(): Promise<SystemConfig | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.execute(sql`SELECT * FROM system_config LIMIT 1`);
    const rows = result[0] as any[];
    
    if (rows.length === 0) {
      return null;
    }

    return rows[0] as SystemConfig;
  } catch (error) {
    console.error('[SystemConfig] Erro ao buscar configuração:', error);
    return null;
  }
}

/**
 * Atualiza o status do bloqueio de follow-ups
 * Apenas gestores podem chamar esta função
 */
export async function updateBloqueioFollowUp(ativo: boolean): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.execute(sql`
      UPDATE system_config 
      SET bloqueio_ativo = ${ativo}, 
          updatedAt = CURRENT_TIMESTAMP 
      WHERE id = 1
    `);
    
    console.log(`[SystemConfig] Bloqueio de follow-ups ${ativo ? 'ATIVADO' : 'DESATIVADO'}`);
    return true;
  } catch (error) {
    console.error('[SystemConfig] Erro ao atualizar bloqueio:', error);
    return false;
  }
}
