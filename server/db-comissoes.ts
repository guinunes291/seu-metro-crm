import { eq, and, ne, sql } from 'drizzle-orm';
import { getDb } from './db';
import { comissoes, contratos, leads, users, projects, equipes } from '../drizzle/schema';

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

/**
 * Listar comissões da imobiliária por contrato
 * Usa o campo percentualComissao salvo em cada contrato
 */
export async function getComissoesImobiliaria() {
  const db = await getDb();
  if (!db) return [];

  const resultado = await db.select({
    contratoId: contratos.id,
    clienteNome: leads.nome,
    projetoNome: sql<string>`COALESCE(${projects.nome}, ${leads.projetoCustom})`,
    valorVenda: contratos.valorVenda,
    percentualImobiliaria: contratos.percentualComissao,
    statusRecebimento: contratos.statusRecebimentoImobiliaria,
    dataRecebimento: contratos.dataRecebimentoImobiliaria,
    dataVenda: contratos.createdAt,
  })
    .from(contratos)
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .leftJoin(projects, eq(leads.projectId, projects.id))
    .where(eq(contratos.distrato, false)) // Excluir contratos distratados
    .orderBy(sql`${contratos.createdAt} DESC`);

  return resultado.map(r => {
    const vgv = Number(r.valorVenda) || 0;
    const perc = Number(r.percentualImobiliaria) || 0;
    const valorComissao = (vgv * perc) / 100;
    return {
      ...r,
      valorVenda: vgv,
      percentualImobiliaria: perc,
      valorComissao,
      statusRecebimento: r.statusRecebimento || 'pendente',
    };
  });
}

/**
 * Atualizar status de recebimento da comissão da imobiliária
 */
export async function atualizarStatusRecebimentoImobiliaria(contratoId: number, status: string, dataRecebimento?: Date) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const updateData: Record<string, any> = {
    statusRecebimentoImobiliaria: status,
  };
  if (status === 'recebido') {
    updateData.dataRecebimentoImobiliaria = dataRecebimento || new Date();
  } else {
    updateData.dataRecebimentoImobiliaria = null;
  }

  await db.update(contratos)
    .set(updateData)
    .where(eq(contratos.id, contratoId));

  return { success: true };
}

/**
 * Gerar comissões automáticas em lote para contratos sem comissões
 */
export async function gerarComissoesEmLote() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Buscar contratos que não têm comissões cadastradas
  const contratosComComissoes = await db.select({ contratoId: comissoes.contratoId })
    .from(comissoes)
    .groupBy(comissoes.contratoId);

  const idsComComissoes = new Set(contratosComComissoes.map(c => c.contratoId));

  // Buscar todos os contratos com dados de corretor e equipe
  const todosContratos = await db.select({
    id: contratos.id,
    corretorId: contratos.corretorId,
    valorVenda: contratos.valorVenda,
    percentualCorretor: contratos.percentualCorretor,
    percentualGerente: contratos.percentualGerente,
    percentualSuperintendente: contratos.percentualSuperintendente,
  })
    .from(contratos);

  const contratosSemComissoes = todosContratos.filter(c => !idsComComissoes.has(c.id));

  if (contratosSemComissoes.length === 0) {
    return { gerados: 0, mensagem: 'Todos os contratos já possuem comissões cadastradas.' };
  }

  let totalGerados = 0;

  for (const contrato of contratosSemComissoes) {
    const vgv = Number(contrato.valorVenda) || 0;
    if (vgv === 0) continue;

    const percCorretor = Number(contrato.percentualCorretor) || 1.85;
    const percGerente = Number(contrato.percentualGerente) || 0.5;
    const percSuperintendente = Number(contrato.percentualSuperintendente) || 0.3;

    const valorCorretor = (vgv * percCorretor) / 100;
    const valorGerente = (vgv * percGerente) / 100;
    const valorSuperintendente = (vgv * percSuperintendente) / 100;

    // Comissão do corretor
    await db.insert(comissoes).values({
      contratoId: contrato.id,
      usuarioId: contrato.corretorId,
      tipo: 'corretor',
      valorBase: vgv.toString(),
      percentual: percCorretor.toString(),
      valorComissao: valorCorretor.toString(),
      percentualDesconto: '0',
      valorLiquido: valorCorretor.toString(),
      status: 'pendente_assinatura',
    });
    totalGerados++;

    // Buscar gerente da equipe do corretor via users.equipeId
    let gestorId: number | null = null;
    if (contrato.corretorId) {
      const corretorEquipe = await db.select({ equipeId: users.equipeId })
        .from(users)
        .where(eq(users.id, contrato.corretorId))
        .limit(1);
      
      if (corretorEquipe[0]?.equipeId) {
        const equipeData = await db.select({ gestorId: equipes.gestorId })
          .from(equipes)
          .where(eq(equipes.id, corretorEquipe[0].equipeId))
          .limit(1);
        gestorId = equipeData[0]?.gestorId || null;
      }
    }

    const equipe = { gestorId, superintendenteId: null };

    if (equipe?.gestorId) {
      await db.insert(comissoes).values({
        contratoId: contrato.id,
        usuarioId: equipe.gestorId,
        tipo: 'gerente',
        valorBase: vgv.toString(),
        percentual: percGerente.toString(),
        valorComissao: valorGerente.toString(),
        percentualDesconto: '0',
        valorLiquido: valorGerente.toString(),
        status: 'pendente_assinatura',
      });
      totalGerados++;
    }

    if (equipe?.superintendenteId) {
      await db.insert(comissoes).values({
        contratoId: contrato.id,
        usuarioId: equipe.superintendenteId,
        tipo: 'superintendente',
        valorBase: vgv.toString(),
        percentual: percSuperintendente.toString(),
        valorComissao: valorSuperintendente.toString(),
        percentualDesconto: '0',
        valorLiquido: valorSuperintendente.toString(),
        status: 'pendente_assinatura',
      });
      totalGerados++;
    }
  }

  return {
    gerados: totalGerados,
    contratosProcessados: contratosSemComissoes.length,
    mensagem: `${totalGerados} comissões geradas para ${contratosSemComissoes.length} contratos.`,
  };
}
