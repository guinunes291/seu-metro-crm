/**
 * Processador de Tabelões PDF
 *
 * Pipeline sem dependências externas:
 * 1. Download do PDF via HTTP (Google Drive share link ou URL direta)
 * 2. Upload para S3
 * 3. Gemini lê o PDF nativamente via file_url — resolve multi-linha e formatos variados por construtora
 * 4. Upsert de projetos + tipologias individuais no banco
 */

import { invokeLLM } from './_core/llm';
import { storagePut } from './storage';
import { getDb } from './db';
import { tabeloes, projects, construtoras, tipologias, historicosPrecos, logsSincronizacao } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';

// ─── Drive URL helpers ────────────────────────────────────────────────────────

function extractDriveFileId(url: string): string | null {
  const patterns = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// ─── Download ─────────────────────────────────────────────────────────────────

export async function downloadPdfFromUrl(url: string): Promise<Buffer> {
  const driveFileId = extractDriveFileId(url);
  const downloadUrl = driveFileId
    ? `https://drive.google.com/uc?export=download&id=${driveFileId}&confirm=t`
    : url;

  const response = await fetch(downloadUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SMQ-CRM/1.0)' },
    redirect: 'follow',
  });

  if (!response.ok) throw new Error(`Falha ao baixar PDF: HTTP ${response.status} ${response.statusText}`);

  const ct = response.headers.get('content-type') || '';
  if (ct.includes('text/html')) {
    throw new Error(
      'Google Drive retornou HTML. Certifique-se que o arquivo está compartilhado como ' +
      '"Qualquer pessoa com o link pode visualizar".',
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

// ─── S3 upload ────────────────────────────────────────────────────────────────

export async function uploadPdfToS3(
  pdfBuffer: Buffer,
  construtoraName: string,
  mes: number,
  ano: number,
): Promise<{ url: string; fileKey: string }> {
  const safe = construtoraName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const fileKey = `tabeloes/${ano}/${String(mes).padStart(2, '0')}/tabelao-${safe}-${ano}-${String(mes).padStart(2, '0')}.pdf`;
  const { url } = await storagePut(fileKey, pdfBuffer, 'application/pdf');
  return { url, fileKey };
}

// ─── Gemini extraction schema ─────────────────────────────────────────────────

const TABELAO_SCHEMA = {
  name: 'tabelao_data',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      projects: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            nome:          { type: 'string' },
            endereco:      { type: ['string', 'null'] },
            regiao:        { type: ['string', 'null'] },
            bairro:        { type: ['string', 'null'] },
            zona:          { type: ['string', 'null'], description: 'norte|sul|leste|oeste|centro' },
            dataEntrega:   { type: ['string', 'null'], description: 'Ex: "Dezembro/2027", "jun/27", "PRONTO"' },
            standVendas:   { type: ['string', 'null'], description: 'Endereço do stand/decorado de vendas' },
            precoMinimo:   { type: ['integer', 'null'], description: 'Menor preço em centavos' },
            precoMaximo:   { type: ['integer', 'null'], description: 'Maior preço em centavos' },
            metragemMinima:{ type: ['integer', 'null'] },
            metragemMaxima:{ type: ['integer', 'null'] },
            dormitoriosMin:{ type: ['integer', 'null'] },
            dormitoriosMax:{ type: ['integer', 'null'] },
            descricao:     { type: ['string', 'null'] },
            linkMateriais: { type: ['string', 'null'], description: 'Link Google Drive para pasta de materiais (DRIVE)' },
            linkTabela:    { type: ['string', 'null'], description: 'Link direto para a tabela PDF (TABELA)' },
            bookPdfUrl:    { type: ['string', 'null'], description: 'Link direto para o book/apresentação PDF' },
            tipologias: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  nome:          { type: 'string', description: 'Ex: "HIS2 - 1 Dorm + Varanda", "R2V - Studio"' },
                  metragem:      { type: ['number', 'null'] },
                  dormitorios:   { type: ['integer', 'null'], description: '0=studio, 1, 2, 3...' },
                  vagas:         { type: ['integer', 'null'], description: 'Quantidade de vagas de garagem' },
                  decorado:      { type: ['boolean', 'null'] },
                  varanda:       { type: ['string', 'null'], description: 'nao|sim|suite|garden|moto' },
                  enquadramento: { type: ['string', 'null'], description: 'HIS1|HIS2|R2V|HMP|HS1|HS2 — pode ser extraído do nome do tipo' },
                  valorTabela:   { type: ['integer', 'null'], description: 'Preço tabela original em centavos (antes do desconto)' },
                  desconto:      { type: ['integer', 'null'], description: 'Valor do desconto em centavos' },
                  valorFinal:    { type: ['integer', 'null'], description: 'Preço final após desconto em centavos (campo "À PARTIR" ou "Valor FINAL")' },
                  valorAvaliacao:{ type: ['integer', 'null'], description: 'Valor de avaliação/laudo em centavos' },
                  disponivel:    { type: ['boolean', 'null'] },
                },
                required: ['nome'],
                additionalProperties: false,
              },
            },
          },
          required: ['nome'],
          additionalProperties: false,
        },
      },
    },
    required: ['projects'],
    additionalProperties: false,
  },
};

// ─── Gemini call ──────────────────────────────────────────────────────────────

export async function extractProjectDataWithGemini(
  s3PdfUrl: string,
  construtoraName: string,
): Promise<{ projects: any[] }> {
  const response = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: `Você é especialista em extração de dados de tabelões imobiliários de São Paulo.

REGRAS DE LEITURA DOS TABELÕES:

Cada empreendimento tem múltiplas TIPOLOGIAS (tipos de unidade). Extraia TODAS.

FORMATO CURY:
- Colunas: TIPOLOGIA | ÁREA | DECORADO | VARANDA | VAGA | ENTREGA | À PARTIR | ZONEAMENTO
- DECORADO: SIM → decorado=true, NÃO → false
- VARANDA: SIM→sim, NÃO→nao, MOTO→moto, SIM/SUITE→suite, SIM/GARDEN→garden
- ZONEAMENTO → campo enquadramento da tipologia (HIS1, HIS2, R2V, HMP, HS1, HS2)
- À PARTIR → valorFinal da tipologia (em centavos)
- ENTREGA → dataEntrega do projeto (ex: "jan/27")
- LINK DRIVE → linkMateriais do projeto

FORMATO MUNDO APTO / PLANILHA:
- Colunas: Empreendimento | Previsão Habite-se | Metragem | Dorms | Vagas | Desconto | R$ Tabela | Valor FINAL | Valor Avaliação | DRIVE | TABELA | Endereço | Stand de Vendas
- O enquadramento está embutido no nome do tipo de Dorm: começa com HIS2, R2V, HMP, etc.
- R$ Tabela → valorTabela (centavos), Desconto → desconto (centavos), Valor FINAL → valorFinal (centavos)
- Valor Avaliação → valorAvaliacao (centavos)
- DRIVE → linkMateriais, TABELA → linkTabela
- Stand de Vendas → standVendas do projeto
- Previsão do Habite-se → dataEntrega

REGRAS GERAIS:
- Preços SEMPRE em centavos: R$ 285.000 → 28500000
- Se um campo não está disponível para determinada tipologia, use null
- Extraia TODAS as tipologias de TODOS os empreendimentos
- Se o tabelão tem zonas (ZONA SUL, ZONA NORTE), capture em zona: "sul", "norte", "leste", "oeste", "centro"`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extraia TODOS os empreendimentos e tipologias do tabelão da construtora "${construtoraName}":`,
          },
          {
            type: 'file_url',
            file_url: { url: s3PdfUrl, mime_type: 'application/pdf' },
          },
        ] as any,
      },
    ],
    response_format: { type: 'json_schema', json_schema: TABELAO_SCHEMA },
  });

  const content = response.choices[0].message.content;
  if (!content) return { projects: [] };
  try {
    return JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
  } catch {
    return { projects: [] };
  }
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export async function processCatalog(tabelaoId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Banco indisponível');

  const [tabelao] = await db.select().from(tabeloes).where(eq(tabeloes.id, tabelaoId)).limit(1);
  if (!tabelao) throw new Error(`Tabelão ${tabelaoId} não encontrado`);

  const [construtora] = await db.select().from(construtoras).where(eq(construtoras.id, tabelao.construtoraId)).limit(1);
  if (!construtora) throw new Error(`Construtora ${tabelao.construtoraId} não encontrada`);

  await db.update(tabeloes).set({ statusProcessamento: 'processando' }).where(eq(tabeloes.id, tabelaoId));

  try {
    // Ensure we have an S3 URL
    let s3PdfUrl = tabelao.s3PdfUrl;
    let fileKey = tabelao.fileKey || '';

    if (!s3PdfUrl) {
      if (!tabelao.drivePdfUrl) throw new Error('Nenhuma URL do PDF disponível');
      console.log(`[Tabelão ${tabelaoId}] Baixando PDF...`);
      const pdfBuffer = await downloadPdfFromUrl(tabelao.drivePdfUrl);
      const uploaded = await uploadPdfToS3(pdfBuffer, construtora.nome, tabelao.mes, tabelao.ano);
      s3PdfUrl = uploaded.url;
      fileKey = uploaded.fileKey;
      await db.update(tabeloes).set({ s3PdfUrl, fileKey }).where(eq(tabeloes.id, tabelaoId));
    }

    // Extract with Gemini
    console.log(`[Tabelão ${tabelaoId}] Processando com Gemini...`);
    const extractedData = await extractProjectDataWithGemini(s3PdfUrl, construtora.nome);
    const projs = extractedData.projects ?? [];
    console.log(`[Tabelão ${tabelaoId}] Gemini extraiu ${projs.length} projetos`);

    let projetosNovos = 0;
    let totalTipologias = 0;

    for (const pd of projs) {
      try {
        // Compute aggregates from tipologias
        const tips = pd.tipologias ?? [];
        const allPrecos = tips
          .map((t: any) => t.valorFinal ?? t.valorTabela)
          .filter((v: any) => v != null && v > 0) as number[];
        const allMetragens = tips.map((t: any) => t.metragem).filter((v: any) => v != null && v > 0) as number[];
        const allDorms = tips.map((t: any) => t.dormitorios).filter((v: any) => v != null) as number[];

        const precoMin = allPrecos.length ? Math.min(...allPrecos) : (pd.precoMinimo ?? null);
        const precoMax = allPrecos.length ? Math.max(...allPrecos) : (pd.precoMaximo ?? null);
        const metMin   = allMetragens.length ? Math.min(...allMetragens) : (pd.metragemMinima ?? null);
        const metMax   = allMetragens.length ? Math.max(...allMetragens) : (pd.metragemMaxima ?? null);
        const dormMin  = allDorms.length ? Math.min(...allDorms) : (pd.dormitoriosMin ?? null);
        const dormMax  = allDorms.length ? Math.max(...allDorms) : (pd.dormitoriosMax ?? null);

        // Validate zona
        const zonaValida = ['norte', 'sul', 'leste', 'oeste', 'centro'].includes(pd.zona ?? '')
          ? pd.zona
          : null;

        // Find or create project
        const [existing] = await db
          .select({ id: projects.id })
          .from(projects)
          .where(and(eq(projects.nome, pd.nome), eq(projects.construtoraId, construtora.id)))
          .limit(1);

        let projetoId: number;

        if (existing) {
          await db.update(projects).set({
            endereco:      pd.endereco    ?? undefined,
            regiao:        pd.regiao      ?? undefined,
            bairro:        pd.bairro      ?? undefined,
            zona:          zonaValida     ?? undefined,
            dataEntrega:   pd.dataEntrega ?? undefined,
            standVendas:   pd.standVendas ?? undefined,
            valorMinimo:   precoMin       ?? undefined,
            valorMaximo:   precoMax       ?? undefined,
            metragemMinima:metMin         ?? undefined,
            metragemMaxima:metMax         ?? undefined,
            dormitorios:   dormMin != null && dormMax != null ? `${dormMin}, ${dormMax}` : undefined,
            descricao:     pd.descricao   ?? undefined,
            linkMateriais: pd.linkMateriais ?? undefined,
            linkTabela:    pd.linkTabela  ?? undefined,
            bookPdfUrl:    pd.bookPdfUrl  ?? undefined,
            updatedAt:     new Date(),
          }).where(eq(projects.id, existing.id));
          projetoId = existing.id;
        } else {
          const [inserted] = await db.insert(projects).values({
            nome:          pd.nome,
            construtora:   construtora.nome,
            construtoraId: construtora.id,
            endereco:      pd.endereco    ?? null,
            regiao:        pd.regiao      ?? null,
            bairro:        pd.bairro      ?? null,
            zona:          zonaValida     as any ?? null,
            dataEntrega:   pd.dataEntrega ?? null,
            standVendas:   pd.standVendas ?? null,
            cidade:        'São Paulo',
            estado:        'SP',
            valorMinimo:   precoMin       ?? null,
            valorMaximo:   precoMax       ?? null,
            metragemMinima:metMin         ?? null,
            metragemMaxima:metMax         ?? null,
            dormitorios:   dormMin != null && dormMax != null ? `${dormMin}, ${dormMax}` : null,
            descricao:     pd.descricao   ?? null,
            linkMateriais: pd.linkMateriais ?? null,
            linkTabela:    pd.linkTabela  ?? null,
            bookPdfUrl:    pd.bookPdfUrl  ?? null,
            status:        'ativo',
            tipo:          'mcmv',
          }).$returningId();
          projetoId = inserted.id;
          projetosNovos++;
        }

        // Upsert tipologias
        for (const tip of tips) {
          try {
            await db.insert(tipologias).values({
              projetoId,
              nome:          tip.nome,
              metragem:      tip.metragem    ?? null,
              dormitorios:   tip.dormitorios ?? null,
              vagas:         tip.vagas       ?? 0,
              decorado:      tip.decorado    ? 1 : 0,
              varanda:       tip.varanda     ?? null,
              enquadramento: tip.enquadramento ?? null,
              valorTabela:   tip.valorTabela ?? null,
              desconto:      tip.desconto    ?? null,
              valorFinal:    tip.valorFinal  ?? null,
              valorAvaliacao:tip.valorAvaliacao ?? null,
              disponivel:    tip.disponivel !== false ? 1 : 0,
            });
            totalTipologias++;
          } catch (err) {
            // Graceful: can fail if tipologias table migration not yet run
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes("doesn't exist") || msg.includes('ER_NO_SUCH_TABLE')) {
              console.warn('[Tabelão] Tabela tipologias não existe ainda — execute a migration 0019_tipologias_projetos.sql');
              break;
            }
          }
        }

        // Price history
        if (precoMin) {
          await db.insert(historicosPrecos).values({
            projetoId,
            mes:        tabelao.mes,
            ano:        tabelao.ano,
            precoMinimo:precoMin,
          }).catch(() => {});
        }
      } catch (err) {
        console.error(`[Tabelão ${tabelaoId}] Erro ao salvar projeto "${pd.nome}":`, err);
      }
    }

    await db.update(tabeloes).set({
      statusProcessamento: 'concluido',
      totalProjetos:       projs.length,
      processadoEm:        new Date(),
    }).where(eq(tabeloes.id, tabelaoId));

    await db.insert(logsSincronizacao).values({
      status:             'sucesso',
      mensagem:           `Tabelão processado: ${construtora.nome} — ${tabelao.mes}/${tabelao.ano}`,
      detalhes:           JSON.stringify({ tabelaoId, projetosNovos, totalTipologias }),
      tabeloesProcessados:1,
      projetosExtraidos:  projetosNovos,
      materiaisExtraidos: totalTipologias,
    });

    console.log(`✅ Tabelão ${tabelaoId} concluído — ${projetosNovos} novos projetos, ${totalTipologias} tipologias`);
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : String(error);
    await db.update(tabeloes).set({ statusProcessamento: 'erro', mensagemErro: mensagem }).where(eq(tabeloes.id, tabelaoId));
    await db.insert(logsSincronizacao).values({ status: 'erro', mensagem: `Erro ao processar tabelão ${tabelaoId}`, detalhes: mensagem });
    throw error;
  }
}

export async function processTabelaoFromBuffer(
  construtoraId: number,
  pdfBuffer: Buffer,
  mes: number,
  ano: number,
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Banco indisponível');

  const [construtora] = await db.select().from(construtoras).where(eq(construtoras.id, construtoraId)).limit(1);
  if (!construtora) throw new Error('Construtora não encontrada');

  const { url: s3PdfUrl, fileKey } = await uploadPdfToS3(pdfBuffer, construtora.nome, mes, ano);

  const [existing] = await db
    .select({ id: tabeloes.id })
    .from(tabeloes)
    .where(and(eq(tabeloes.construtoraId, construtoraId), eq(tabeloes.mes, mes), eq(tabeloes.ano, ano)))
    .limit(1);

  let tabelaoId: number;
  if (existing) {
    await db.update(tabeloes).set({ s3PdfUrl, fileKey, statusProcessamento: 'pendente', mensagemErro: null }).where(eq(tabeloes.id, existing.id));
    tabelaoId = existing.id;
  } else {
    const [result] = await db.insert(tabeloes).values({ construtoraId, mes, ano, s3PdfUrl, fileKey, statusProcessamento: 'pendente' }).$returningId();
    tabelaoId = result.id;
  }

  processCatalog(tabelaoId).catch(err => console.error(`[Tabelão] Erro processando ${tabelaoId}:`, err));
  return tabelaoId;
}

export async function processAllPendingCatalogs(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const pendentes = await db.select().from(tabeloes).where(eq(tabeloes.statusProcessamento, 'pendente'));
  for (const t of pendentes) {
    await processCatalog(t.id).catch(err => console.error(`[Tabelão] Erro em ${t.id}:`, err));
  }
}
