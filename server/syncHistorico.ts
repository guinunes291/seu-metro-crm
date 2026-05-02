/**
 * Script de Sincronização Histórica Completa
 * 
 * Este script processa TODOS os dados históricos (não apenas hoje) e popula
 * a tabela atividades_diarias retroativamente para garantir que filtros de
 * período (Este mês, Esta semana, Ontem) funcionem corretamente.
 * 
 * Usa timezone de São Paulo (GMT-3) para todos os cálculos de data.
 */

import { getDb } from './db';
import { 
  interacoes, 
  agendamentos, 
  visitas, 
  documentacoes, 
  analises_credito, 
  contratos,
  atividadesDiarias 
} from '../drizzle/schema';
import { sql, eq } from 'drizzle-orm';
import { fromZonedTime, toZonedTime, format } from 'date-fns-tz';
import { startOfDay, endOfDay, parseISO } from 'date-fns';

const TIMEZONE_SP = 'America/Sao_Paulo';

/**
 * Converte uma data UTC para o início do dia em São Paulo
 */
function obterInicioDiaSP(data: Date): Date {
  const dataSP = toZonedTime(data, TIMEZONE_SP);
  const inicioDiaSP = startOfDay(dataSP);
  return fromZonedTime(inicioDiaSP, TIMEZONE_SP);
}

/**
 * Converte uma data UTC para o fim do dia em São Paulo
 */
function obterFimDiaSP(data: Date): Date {
  const dataSP = toZonedTime(data, TIMEZONE_SP);
  const fimDiaSP = endOfDay(dataSP);
  return fromZonedTime(fimDiaSP, TIMEZONE_SP);
}

/**
 * Formata uma data para string YYYY-MM-DD no timezone de São Paulo
 */
function formatarDataSP(data: Date): string {
  return format(toZonedTime(data, TIMEZONE_SP), 'yyyy-MM-dd', { timeZone: TIMEZONE_SP });
}

/**
 * Obtém todas as datas únicas de todas as tabelas de atividades
 */
export async function obterTodasDatasUnicas(): Promise<Date[]> {
  const db = await getDb();
  if (!db) return [];

  console.log('[SyncHistorico] Obtendo todas as datas únicas de atividades...');

  // Buscar datas únicas de cada tabela
  const datasInteracoes = await db
    .selectDistinct({ data: sql<string>`DATE(${interacoes.createdAt})` })
    .from(interacoes);

  const datasAgendamentos = await db
    .selectDistinct({ data: sql<string>`DATE(${agendamentos.createdAt})` })
    .from(agendamentos);

  const datasVisitas = await db
    .selectDistinct({ data: sql<string>`DATE(${visitas.createdAt})` })
    .from(visitas);

  const datasDocumentacoes = await db
    .selectDistinct({ data: sql<string>`DATE(${documentacoes.createdAt})` })
    .from(documentacoes);

  const datasAnalises = await db
    .selectDistinct({ data: sql<string>`DATE(${analises_credito.createdAt})` })
    .from(analises_credito);

  const datasContratos = await db
    .selectDistinct({ data: sql<string>`DATE(${contratos.createdAt})` })
    .from(contratos);

  // Combinar todas as datas e remover duplicatas
  const todasDatas = new Set<string>();
  
  [...datasInteracoes, ...datasAgendamentos, ...datasVisitas, ...datasDocumentacoes, ...datasAnalises, ...datasContratos]
    .forEach(item => {
      if (item.data) {
        todasDatas.add(item.data);
      }
    });

  // Converter de volta para Date[] e ordenar
  const datasOrdenadas = Array.from(todasDatas)
    .sort()
    .map(dataStr => parseISO(dataStr));

  console.log(`[SyncHistorico] Encontradas ${datasOrdenadas.length} datas únicas de atividades`);
  console.log(`[SyncHistorico] Período: ${datasOrdenadas[0]?.toISOString().split('T')[0]} até ${datasOrdenadas[datasOrdenadas.length - 1]?.toISOString().split('T')[0]}`);

  return datasOrdenadas;
}

/**
 * Garante que existe um registro de atividade diária para um corretor em uma data
 */
async function garantirAtividadeDiariaExiste(corretorId: number, data: Date): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const dataFormatada = formatarDataSP(data);
  
  // Verificar se já existe
  const existente = await db
    .select()
    .from(atividadesDiarias)
    .where(sql`${atividadesDiarias.corretorId} = ${corretorId} AND DATE(${atividadesDiarias.data}) = ${dataFormatada}`)
    .limit(1);
  
  // Se não existe, criar com valores zerados
  if (existente.length === 0) {
    await db.insert(atividadesDiarias).values({
      corretorId,
      data,
      clientesCadastrados: 0,
      alteracoesStatus: 0,
      ligacoesRealizadas: 0,
      ligacoesAtendidas: 0,
      whatsappEnviados: 0,
      whatsappRespondidos: 0,
      agendamentosConfirmados: 0,
      visitasRealizadas: 0,
      propostasEnviadas: 0,
      analiseCreditoEnviadas: 0,
      analiseCreditoEnviadas: 0,
      contratosFechados: 0,
      vgvDia: 0,
      pontuacaoTotal: 0,
    });
  }
}

/**
 * Sincroniza interações de uma data específica
 */
export async function sincronizarInteracoesData(data: Date): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const inicioDia = obterInicioDiaSP(data);
  const fimDia = obterFimDiaSP(data);
  const dataFormatada = formatarDataSP(data);

  // Buscar interações desta data
  const interacoesData = await db
    .select({
      corretorId: interacoes.corretorId,
      tipo: interacoes.tipo,
      total: sql<number>`COUNT(*)`,
      atendidas: sql<number>`SUM(CASE WHEN ${interacoes.atendida} = 1 THEN 1 ELSE 0 END)`,
      respondidas: sql<number>`SUM(CASE WHEN ${interacoes.respondida} = 1 THEN 1 ELSE 0 END)`,
    })
    .from(interacoes)
    .where(sql`${interacoes.createdAt} >= ${inicioDia} AND ${interacoes.createdAt} <= ${fimDia}`)
    .groupBy(interacoes.corretorId, interacoes.tipo);

  // Atualizar contadores para cada corretor
  const corretoresMap = new Map<number, { ligacoes: number, ligacoesAtendidas: number, whatsapp: number, whatsappRespondidos: number }>();
  
  for (const interacao of interacoesData) {
    if (!corretoresMap.has(interacao.corretorId)) {
      corretoresMap.set(interacao.corretorId, { ligacoes: 0, ligacoesAtendidas: 0, whatsapp: 0, whatsappRespondidos: 0 });
    }
    
    const corretor = corretoresMap.get(interacao.corretorId)!;
    
    if (interacao.tipo === 'ligacao') {
      corretor.ligacoes = interacao.total;
      corretor.ligacoesAtendidas = interacao.atendidas;
    } else if (interacao.tipo === 'whatsapp') {
      corretor.whatsapp = interacao.total;
      corretor.whatsappRespondidos = interacao.respondidas;
    }
  }

  // Atualizar banco de dados
  for (const [corretorId, contadores] of corretoresMap.entries()) {
    await garantirAtividadeDiariaExiste(corretorId, data);
    
    await db
      .update(atividadesDiarias)
      .set({
        ligacoesRealizadas: contadores.ligacoes,
        ligacoesAtendidas: contadores.ligacoesAtendidas,
        whatsappEnviados: contadores.whatsapp,
        whatsappRespondidos: contadores.whatsappRespondidos,
      })
      .where(sql`${atividadesDiarias.corretorId} = ${corretorId} AND DATE(${atividadesDiarias.data}) = ${dataFormatada}`);
  }

  if (corretoresMap.size > 0) {
    console.log(`[SyncHistorico] ${dataFormatada}: ${corretoresMap.size} corretores com interações`);
  }
}

/**
 * Sincroniza agendamentos de uma data específica
 */
export async function sincronizarAgendamentosData(data: Date): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const inicioDia = obterInicioDiaSP(data);
  const fimDia = obterFimDiaSP(data);
  const dataFormatada = formatarDataSP(data);

  const agendamentosData = await db
    .select({
      corretorId: agendamentos.corretorId,
      total: sql<number>`COUNT(*)`,
    })
    .from(agendamentos)
    .where(sql`${agendamentos.createdAt} >= ${inicioDia} AND ${agendamentos.createdAt} <= ${fimDia}`)
    .groupBy(agendamentos.corretorId);

  for (const ag of agendamentosData) {
    await garantirAtividadeDiariaExiste(ag.corretorId, data);
    
    await db
      .update(atividadesDiarias)
      .set({ agendamentosConfirmados: ag.total })
      .where(sql`${atividadesDiarias.corretorId} = ${ag.corretorId} AND DATE(${atividadesDiarias.data}) = ${dataFormatada}`);
  }

  if (agendamentosData.length > 0) {
    console.log(`[SyncHistorico] ${dataFormatada}: ${agendamentosData.length} corretores com agendamentos`);
  }
}

/**
 * Sincroniza visitas de uma data específica
 */
export async function sincronizarVisitasData(data: Date): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const inicioDia = obterInicioDiaSP(data);
  const fimDia = obterFimDiaSP(data);
  const dataFormatada = formatarDataSP(data);

  const visitasData = await db
    .select({
      corretorId: visitas.corretorId,
      total: sql<number>`COUNT(*)`,
    })
    .from(visitas)
    .where(sql`${visitas.createdAt} >= ${inicioDia} AND ${visitas.createdAt} <= ${fimDia}`)
    .groupBy(visitas.corretorId);

  for (const v of visitasData) {
    await garantirAtividadeDiariaExiste(v.corretorId, data);
    
    await db
      .update(atividadesDiarias)
      .set({ visitasRealizadas: v.total })
      .where(sql`${atividadesDiarias.corretorId} = ${v.corretorId} AND DATE(${atividadesDiarias.data}) = ${dataFormatada}`);
  }

  if (visitasData.length > 0) {
    console.log(`[SyncHistorico] ${dataFormatada}: ${visitasData.length} corretores com visitas`);
  }
}

/**
 * Sincroniza documentações de uma data específica
 */
export async function sincronizarDocumentacoesData(data: Date): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const inicioDia = obterInicioDiaSP(data);
  const fimDia = obterFimDiaSP(data);
  const dataFormatada = formatarDataSP(data);

  const documentacoesData = await db
    .select({
      corretorId: documentacoes.corretorId,
      total: sql<number>`COUNT(*)`,
    })
    .from(documentacoes)
    .where(sql`${documentacoes.createdAt} >= ${inicioDia} AND ${documentacoes.createdAt} <= ${fimDia}`)
    .groupBy(documentacoes.corretorId);

  for (const d of documentacoesData) {
    await garantirAtividadeDiariaExiste(d.corretorId, data);
    
    await db
      .update(atividadesDiarias)
      .set({ analiseCreditoEnviadas: d.total })
      .where(sql`${atividadesDiarias.corretorId} = ${d.corretorId} AND DATE(${atividadesDiarias.data}) = ${dataFormatada}`);
  }

  if (documentacoesData.length > 0) {
    console.log(`[SyncHistorico] ${dataFormatada}: ${documentacoesData.length} corretores com documentações`);
  }
}

/**
 * Sincroniza análises de crédito de uma data específica
 */
export async function sincronizarAnalisesData(data: Date): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const inicioDia = obterInicioDiaSP(data);
  const fimDia = obterFimDiaSP(data);
  const dataFormatada = formatarDataSP(data);

  const analisesData = await db
    .select({
      corretorId: analises_credito.corretorId,
      total: sql<number>`COUNT(*)`,
    })
    .from(analises_credito)
    .where(sql`${analises_credito.createdAt} >= ${inicioDia} AND ${analises_credito.createdAt} <= ${fimDia}`)
    .groupBy(analises_credito.corretorId);

  for (const a of analisesData) {
    await garantirAtividadeDiariaExiste(a.corretorId, data);
    
    await db
      .update(atividadesDiarias)
      .set({ analiseCreditoEnviadas: a.total })
      .where(sql`${atividadesDiarias.corretorId} = ${a.corretorId} AND DATE(${atividadesDiarias.data}) = ${dataFormatada}`);
  }

  if (analisesData.length > 0) {
    console.log(`[SyncHistorico] ${dataFormatada}: ${analisesData.length} corretores com análises de crédito`);
  }
}

/**
 * Sincroniza contratos de uma data específica
 */
export async function sincronizarContratosData(data: Date): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const inicioDia = obterInicioDiaSP(data);
  const fimDia = obterFimDiaSP(data);
  const dataFormatada = formatarDataSP(data);

  const contratosData = await db
    .select({
      corretorId: contratos.corretorId,
      total: sql<number>`COUNT(*)`,
    })
    .from(contratos)
    .where(sql`${contratos.createdAt} >= ${inicioDia} AND ${contratos.createdAt} <= ${fimDia}`)
    .groupBy(contratos.corretorId);

  for (const c of contratosData) {
    await garantirAtividadeDiariaExiste(c.corretorId, data);
    
    await db
      .update(atividadesDiarias)
      .set({ contratosFechados: c.total })
      .where(sql`${atividadesDiarias.corretorId} = ${c.corretorId} AND DATE(${atividadesDiarias.data}) = ${dataFormatada}`);
  }

  if (contratosData.length > 0) {
    console.log(`[SyncHistorico] ${dataFormatada}: ${contratosData.length} corretores com contratos`);
  }
}

/**
 * Recalcula pontuação de uma data específica para todos os corretores
 */
export async function recalcularPontuacaoData(data: Date): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const dataFormatada = formatarDataSP(data);

  // Buscar todas as atividades desta data
  const atividades = await db
    .select()
    .from(atividadesDiarias)
    .where(sql`DATE(${atividadesDiarias.data}) = ${dataFormatada}`);

  for (const atividade of atividades) {
    const pontuacao = 
      (atividade.ligacoesRealizadas * 5) +
      (atividade.whatsappEnviados * 1) +
      (atividade.agendamentosConfirmados * 25) +
      (atividade.visitasRealizadas * 40) +
      (atividade.analiseCreditoEnviadas * 50) +
      (atividade.analiseCreditoEnviadas * 75) +
      (atividade.contratosFechados * 100);

    await db
      .update(atividadesDiarias)
      .set({ pontuacaoTotal: pontuacao })
      .where(eq(atividadesDiarias.id, atividade.id));
  }

  if (atividades.length > 0) {
    console.log(`[SyncHistorico] ${dataFormatada}: Recalculada pontuação para ${atividades.length} corretores`);
  }
}

/**
 * Executa sincronização histórica completa
 * Processa TODAS as datas com atividades desde o início
 */
export async function executarSincronizacaoHistorica(): Promise<{ 
  datasProcessadas: number, 
  periodoInicio: string, 
  periodoFim: string 
}> {
  console.log('\n========================================');
  console.log('INICIANDO SINCRONIZAÇÃO HISTÓRICA COMPLETA');
  console.log('========================================\n');

  const inicio = Date.now();

  // Obter todas as datas únicas
  const datas = await obterTodasDatasUnicas();

  if (datas.length === 0) {
    console.log('[SyncHistorico] Nenhuma data encontrada para processar');
    return { datasProcessadas: 0, periodoInicio: '', periodoFim: '' };
  }

  console.log(`\n[SyncHistorico] Processando ${datas.length} datas...\n`);

  // Processar cada data
  for (let i = 0; i < datas.length; i++) {
    const data = datas[i];
    const progresso = `[${i + 1}/${datas.length}]`;

    console.log(`${progresso} Processando ${formatarDataSP(data)}...`);

    // Sincronizar todas as métricas desta data
    await sincronizarInteracoesData(data);
    await sincronizarAgendamentosData(data);
    await sincronizarVisitasData(data);
    await sincronizarDocumentacoesData(data);
    await sincronizarAnalisesData(data);
    await sincronizarContratosData(data);

    // Recalcular pontuação
    await recalcularPontuacaoData(data);
  }

  const fim = Date.now();
  const tempoDecorrido = ((fim - inicio) / 1000).toFixed(2);

  console.log('\n========================================');
  console.log('SINCRONIZAÇÃO HISTÓRICA CONCLUÍDA');
  console.log('========================================');
  console.log(`Datas processadas: ${datas.length}`);
  console.log(`Período: ${formatarDataSP(datas[0])} até ${formatarDataSP(datas[datas.length - 1])}`);
  console.log(`Tempo decorrido: ${tempoDecorrido}s`);
  console.log('========================================\n');

  return {
    datasProcessadas: datas.length,
    periodoInicio: formatarDataSP(datas[0]),
    periodoFim: formatarDataSP(datas[datas.length - 1])
  };
}
