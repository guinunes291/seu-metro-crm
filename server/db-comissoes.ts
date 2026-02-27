import { eq, and, sql } from 'drizzle-orm';
import { getDb } from './db';
import { comissoes, contratos, leads, users, projects } from '../drizzle/schema';

/**
 * Listar comissões com filtros
 */
export async function getComissoes(filtros?: {
  usuarioId?: number;
  status?: string;
  tipo?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: any[] = [];
  
  if (filtros?.usuarioId) {
    conditions.push(eq(comissoes.usuarioId, filtros.usuarioId));
  }
  
  if (filtros?.status) {
    conditions.push(eq(comissoes.status, filtros.status as any));
  }
  
  if (filtros?.tipo) {
    conditions.push(eq(comissoes.tipo, filtros.tipo as any));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const resultado = await db.select({
    id: comissoes.id,
    contratoId: comissoes.contratoId,
    usuarioId: comissoes.usuarioId,
    usuarioNome: users.name,
    tipo: comissoes.tipo,
    valorBase: comissoes.valorBase,
    percentual: comissoes.percentual,
    valorComissao: comissoes.valorComissao,
    percentualDesconto: comissoes.percentualDesconto,
    valorLiquido: comissoes.valorLiquido,
    status: comissoes.status,
    dataPagamento: comissoes.dataPagamento,
    comprovantePagamento: comissoes.comprovantePagamento,
    observacoes: comissoes.observacoes,
    createdAt: comissoes.createdAt,
    // Dados do contrato e lead
    clienteNome: leads.nome,
    projetoNome: sql<string>`COALESCE(${projects.nome}, ${leads.projetoCustom})`,
    dataVenda: contratos.createdAt,
  })
    .from(comissoes)
    .innerJoin(users, eq(comissoes.usuarioId, users.id))
    .innerJoin(contratos, eq(comissoes.contratoId, contratos.id))
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .leftJoin(projects, eq(leads.projectId, projects.id))
    .where(whereClause)
    .orderBy(sql`${comissoes.createdAt} DESC`);
  
  return resultado;
}

/**
 * Marcar comissão como paga
 */
export async function marcarComissaoComoPaga(id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  await db.update(comissoes)
    .set({
      status: 'paga',
      dataPagamento: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(comissoes.id, id));
  
  return { success: true };
}

/**
 * Aplicar desconto de NF na comissão
 */
export async function aplicarDescontoComissao(id: number, percentualDesconto: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // Buscar comissão
  const [comissao] = await db.select()
    .from(comissoes)
    .where(eq(comissoes.id, id))
    .limit(1);
  
  if (!comissao) {
    throw new Error('Comissão não encontrada');
  }
  
  // Calcular novo valor líquido
  const valorComissao = Number(comissao.valorComissao);
  const desconto = valorComissao * (percentualDesconto / 100);
  const valorLiquido = valorComissao - desconto;
  
  // Atualizar comissão
  await db.update(comissoes)
    .set({
      percentualDesconto: percentualDesconto.toString(),
      valorLiquido: valorLiquido.toString(),
      updatedAt: new Date(),
    })
    .where(eq(comissoes.id, id));
  
  return { success: true, valorLiquido };
}

/**
 * Listar contratos para select de importação de comissão
 */
export async function listarContratosParaComissao() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const resultado = await db.select({
    id: contratos.id,
    clienteNome: leads.nome,
    projetoNome: projects.nome,
    projetoCustom: leads.projetoCustom,
    valorVenda: contratos.valorVenda,
  })
    .from(contratos)
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .leftJoin(projects, eq(leads.projectId, projects.id))
    .orderBy(sql`${contratos.createdAt} DESC`);

  return resultado;
}

/**
 * Listar usuários para select de importação de comissão
 */
export async function listarUsuariosParaComissao() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  return await db.select({
    id: users.id,
    name: users.name,
    role: users.role,
  })
    .from(users)
    .orderBy(users.name);
}

/**
 * Importar comissão manual
 */
export async function importarComissaoManual(dados: {
  contratoId: number;
  usuarioId: number;
  tipo: 'corretor' | 'gerente' | 'superintendente';
  valorBase: number;
  percentual: number;
  valorComissao: number;
  percentualDesconto: number;
  valorLiquido: number;
  status: 'pendente_assinatura' | 'a_pagar' | 'paga';
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const [comissao] = await db.insert(comissoes)
    .values({
      contratoId: dados.contratoId,
      usuarioId: dados.usuarioId,
      tipo: dados.tipo,
      valorBase: dados.valorBase.toString(),
      percentual: dados.percentual.toString(),
      valorComissao: dados.valorComissao.toString(),
      percentualDesconto: dados.percentualDesconto.toString(),
      valorLiquido: dados.valorLiquido.toString(),
      status: dados.status,
      dataPagamento: dados.status === 'paga' ? new Date() : null,
    })
    .$returningId();

  return comissao;
}
