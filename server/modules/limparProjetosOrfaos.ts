import { getDb } from "../db";
import { projects, leads } from "../../drizzle/schema";
import { notInArray, sql } from "drizzle-orm";

/**
 * Identifica projetos que não têm leads associados
 */
export async function identificarProjetosOrfaos() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Buscar IDs de projetos que têm leads
    const leadsComProjeto = await db
      .selectDistinct({ projectId: leads.projectId })
      .from(leads)
      .where(sql`${leads.projectId} IS NOT NULL`);

    const idsComLeads = leadsComProjeto
      .map(l => l.projectId)
      .filter((id): id is number => id !== null);

    // Buscar todos os projetos
    const todosProjetos = await db.select().from(projects);

    // Filtrar projetos órfãos (sem leads)
    const projetosOrfaos = todosProjetos.filter(
      p => !idsComLeads.includes(p.id)
    );

    return {
      total: todosProjetos.length,
      comLeads: idsComLeads.length,
      orfaos: projetosOrfaos.length,
      listaOrfaos: projetosOrfaos,
    };
  } catch (error) {
    console.error("[Limpar Projetos] Erro ao identificar órfãos:", error);
    throw error;
  }
}

/**
 * Remove projetos órfãos (sem leads associados)
 */
export async function limparProjetosOrfaos() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = {
    removidos: 0,
    erros: 0,
    detalhes: [] as Array<{
      id: number;
      nome: string;
      status: "success" | "error";
      message?: string;
    }>,
  };

  try {
    // Identificar projetos órfãos
    const { listaOrfaos } = await identificarProjetosOrfaos();

    console.log(`[Limpar Projetos] Encontrados ${listaOrfaos.length} projetos órfãos`);

    if (listaOrfaos.length === 0) {
      return result;
    }

    // Remover cada projeto órfão
    for (const projeto of listaOrfaos) {
      try {
        await db.delete(projects).where(sql`${projects.id} = ${projeto.id}`);

        result.removidos++;
        result.detalhes.push({
          id: projeto.id,
          nome: projeto.nome,
          status: "success",
        });

        console.log(`[Limpar Projetos] Removido: ${projeto.nome} (ID: ${projeto.id})`);
      } catch (error) {
        result.erros++;
        result.detalhes.push({
          id: projeto.id,
          nome: projeto.nome,
          status: "error",
          message: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }
    }

    console.log(`[Limpar Projetos] Concluído! Removidos: ${result.removidos}, Erros: ${result.erros}`);

    return result;
  } catch (error) {
    console.error("[Limpar Projetos] Erro:", error);
    throw error;
  }
}
