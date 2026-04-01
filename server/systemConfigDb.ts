/**
 * Helper para acessar a tabela system_config (configurações chave-valor do sistema).
 * Substitui o uso de arquivos /tmp para persistir estado de jobs entre reinicializações.
 */
import { getDb } from "./db";
import { jobControl } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Lê o valor de uma configuração do sistema.
 * Retorna null se a chave não existir.
 */
export async function getSystemConfig(key: string): Promise<string | null> {
  try {
    const db = await getDb();
    const rows = await db
      .select({ value: jobControl.value })
      .from(jobControl)
      .where(eq(jobControl.key, key))
      .limit(1);
    return rows[0]?.value ?? null;
  } catch (err) {
    console.error(`[SystemConfig] Erro ao ler chave "${key}":`, err);
    return null;
  }
}

/**
 * Salva ou atualiza o valor de uma configuração do sistema.
 */
export async function setSystemConfig(key: string, value: string): Promise<void> {
  try {
    const db = await getDb();
    await db
      .insert(jobControl)
      .values({ key, value })
      .onDuplicateKeyUpdate({ set: { value } });
  } catch (err) {
    console.error(`[SystemConfig] Erro ao salvar chave "${key}":`, err);
  }
}
