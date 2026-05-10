/**
 * Processador de Tabelões PDF
 *
 * Pipeline simplificado sem dependências externas (sem rclone, sem pdftotext):
 * 1. Download do PDF via HTTP (Google Drive share link ou URL direta)
 * 2. Upload para S3
 * 3. Leitura nativa pelo Gemini via file_url (resolve multi-linha de tipologias automaticamente)
 * 4. Upsert dos projetos no banco
 */

import { invokeLLM } from './_core/llm';
import { storagePut } from './storage';
import { getDb } from './db';
import { tabeloes, projects, construtoras, historicosPrecos, logsSincronizacao } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';

// ─── Drive URL helpers ────────────────────────────────────────────────────────

function extractDriveFileId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function buildDriveDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
}

// ─── Download ─────────────────────────────────────────────────────────────────

export async function downloadPdfFromUrl(url: string): Promise<Buffer> {
  const driveFileId = extractDriveFileId(url);
  const downloadUrl = driveFileId ? buildDriveDownloadUrl(driveFileId) : url;

  const response = await fetch(downloadUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SMQ-CRM/1.0)' },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Falha ao baixar PDF: HTTP ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error(
      'Google Drive retornou uma página HTML. O arquivo pode ser muito grande para download direto ou não está compartilhado publicamente. ' +
      'Certifique-se que o arquivo está compartilhado como "Qualquer pessoa com o link pode visualizar".',
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
  const safeName = construtoraName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const fileName = `tabelao-${safeName}-${ano}-${String(mes).padStart(2, '0')}.pdf`;
  const fileKey = `tabeloes/${ano}/${String(mes).padStart(2, '0')}/${fileName}`;
  const { url } = await storagePut(fileKey, pdfBuffer, 'application/pdf');
  return { url, fileKey };
}

// ─── Gemini extraction ────────────────────────────────────────────────────────

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
            nome: { type: 'string' },
            endereco: { type: ['string', 'null'] },
            regiao: { type: ['string', 'null'] },
            bairro: { type: ['string', 'null'] },
            dataEntrega: { type: ['string', 'null'], description: 'Previsão de entrega, ex: "Dezembro/2027" ou "4T/2026"' },
            precoMinimo: { type: ['integer', 'null'], description: 'Menor preço em centavos (multiplicar por 100)' },
            precoMaximo: { type: ['integer', 'null'], description: 'Maior preço em centavos' },
            metragemMinima: { type: ['integer', 'null'] },
            metragemMaxima: { type: ['integer', 'null'] },
            dormitoriosMin: { type: ['integer', 'null'] },
            dormitoriosMax: { type: ['integer', 'null'] },
            vagasMin: { type: ['integer', 'null'] },
            vagasMax: { type: ['integer', 'null'] },
            descricao: { type: ['string', 'null'] },
            linkMateriais: { type: ['string', 'null'], description: 'Link do Google Drive para pasta de materiais' },
            bookPdfUrl: { type: ['string', 'null'], description: 'Link direto para o book/apresentação em PDF' },
            tipologias: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  nome: { type: 'string', description: 'Ex: "Tipo A - 2 Dorms 52m²"' },
                  metragem: { type: ['number', 'null'] },
                  preco: { type: ['integer', 'null'], description: 'Preço em centavos' },
                  vagas: { type: ['integer', 'null'] },
                  disponivel: { type: ['boolean', 'null'] },
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

export async function extractProjectDataWithGemini(
  s3PdfUrl: string,
  construtoraName: string,
): Promise<{ projects: any[] }> {
  const response = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: `Você é especialista em extração de dados de tabelões imobiliários de São Paulo.

FORMATO DOS TABELÕES — regras críticas de leitura:
- Cada TIPOLOGIA (planta/unidade) ocupa várias linhas consecutivas formando um bloco
- Um novo bloco de tipologia começa quando aparece um novo nome/código de planta
- Para cada bloco extraia: nome da tipologia, metragem, preço, número de vagas, disponibilidade
- Um EMPREENDIMENTO pode ter múltiplas tipologias — extraia TODAS
- Preços devem ser em centavos (ex: R$ 285.000 → 28500000)

Para cada empreendimento extraia todos os campos disponíveis, incluindo:
- Nome completo do empreendimento
- Endereço, bairro e região
- Previsão de entrega (ex: "Dezembro/2027", "4T/2026")
- Todas as tipologias com preços individuais
- Links para materiais ou book PDF se presentes no documento`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extraia TODOS os empreendimentos e tipologias do tabelão da construtora "${construtoraName}". Inclua cada tipologia separadamente com seu preço individual:`,
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

  const [construtora] = await db
    .select()
    .from(construtoras)
    .where(eq(construtoras.id, tabelao.construtoraId))
    .limit(1);
  if (!construtora) throw new Error(`Construtora ${tabelao.construtoraId} não encontrada`);

  await db.update(tabeloes).set({ statusProcessamento: 'processando' }).where(eq(tabeloes.id, tabelaoId));

  try {
    // Ensure we have an S3 URL (upload if not yet done)
    let s3PdfUrl = tabelao.s3PdfUrl;
    let fileKey = tabelao.fileKey || '';

    if (!s3PdfUrl) {
      if (!tabelao.drivePdfUrl) throw new Error('Nenhuma URL do PDF disponível');
      console.log(`[Tabelão ${tabelaoId}] Baixando PDF de: ${tabelao.drivePdfUrl}`);
      const pdfBuffer = await downloadPdfFromUrl(tabelao.drivePdfUrl);
      const uploaded = await uploadPdfToS3(pdfBuffer, construtora.nome, tabelao.mes, tabelao.ano);
      s3PdfUrl = uploaded.url;
      fileKey = uploaded.fileKey;
      await db.update(tabeloes).set({ s3PdfUrl, fileKey }).where(eq(tabeloes.id, tabelaoId));
      console.log(`[Tabelão ${tabelaoId}] PDF enviado ao S3: ${s3PdfUrl}`);
    }

    // Extract with Gemini
    console.log(`[Tabelão ${tabelaoId}] Processando com Gemini...`);
    const extractedData = await extractProjectDataWithGemini(s3PdfUrl, construtora.nome);
    console.log(`[Tabelão ${tabelaoId}] Gemini extraiu ${extractedData.projects?.length ?? 0} projetos`);

    // Upsert projects
    let projetosExtraidos = 0;
    for (const projectData of extractedData.projects || []) {
      try {
        const [existing] = await db
          .select({ id: projects.id })
          .from(projects)
          .where(and(eq(projects.nome, projectData.nome), eq(projects.construtoraId, construtora.id)))
          .limit(1);

        if (existing) {
          await db.update(projects).set({
            endereco: projectData.endereco ?? undefined,
            regiao: projectData.regiao ?? undefined,
            bairro: projectData.bairro ?? undefined,
            valorMinimo: projectData.precoMinimo ?? undefined,
            valorMaximo: projectData.precoMaximo ?? undefined,
            metragemMinima: projectData.metragemMinima ?? undefined,
            metragemMaxima: projectData.metragemMaxima ?? undefined,
            dormitorios: projectData.dormitoriosMin != null && projectData.dormitoriosMax != null
              ? `${projectData.dormitoriosMin}, ${projectData.dormitoriosMax}`
              : undefined,
            descricao: projectData.descricao ?? undefined,
            linkMateriais: projectData.linkMateriais ?? undefined,
            bookPdfUrl: projectData.bookPdfUrl ?? undefined,
            updatedAt: new Date(),
          }).where(eq(projects.id, existing.id));
        } else {
          await db.insert(projects).values({
            nome: projectData.nome,
            construtora: construtora.nome,
            construtoraId: construtora.id,
            endereco: projectData.endereco ?? null,
            regiao: projectData.regiao ?? null,
            bairro: projectData.bairro ?? null,
            cidade: 'São Paulo',
            estado: 'SP',
            valorMinimo: projectData.precoMinimo ?? null,
            valorMaximo: projectData.precoMaximo ?? null,
            metragemMinima: projectData.metragemMinima ?? null,
            metragemMaxima: projectData.metragemMaxima ?? null,
            dormitorios: projectData.dormitoriosMin != null && projectData.dormitoriosMax != null
              ? `${projectData.dormitoriosMin}, ${projectData.dormitoriosMax}`
              : null,
            descricao: projectData.descricao ?? null,
            linkMateriais: projectData.linkMateriais ?? null,
            bookPdfUrl: projectData.bookPdfUrl ?? null,
            status: 'ativo',
            tipo: 'outro',
          });
          projetosExtraidos++;
        }

        // Register price history
        if (projectData.precoMinimo) {
          await db.insert(historicosPrecos).values({
            projetoId: existing?.id ?? 0,
            mes: tabelao.mes,
            ano: tabelao.ano,
            precoMinimo: projectData.precoMinimo,
          }).catch(() => {});
        }
      } catch (err) {
        console.error(`[Tabelão ${tabelaoId}] Erro ao salvar projeto "${projectData.nome}":`, err);
      }
    }

    await db.update(tabeloes).set({
      statusProcessamento: 'concluido',
      totalProjetos: extractedData.projects?.length ?? 0,
      processadoEm: new Date(),
    }).where(eq(tabeloes.id, tabelaoId));

    await db.insert(logsSincronizacao).values({
      status: 'sucesso',
      mensagem: `Tabelão processado: ${construtora.nome} — ${tabelao.mes}/${tabelao.ano}`,
      detalhes: JSON.stringify({ tabelaoId, construtoraId: construtora.id, projetosExtraidos }),
      tabeloesProcessados: 1,
      projetosExtraidos,
      materiaisExtraidos: 0,
    });

    console.log(`✅ Tabelão ${tabelaoId} concluído — ${projetosExtraidos} novos projetos`);
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : String(error);
    await db.update(tabeloes).set({ statusProcessamento: 'erro', mensagemErro: mensagem }).where(eq(tabeloes.id, tabelaoId));
    await db.insert(logsSincronizacao).values({
      status: 'erro',
      mensagem: `Erro ao processar tabelão ${tabelaoId}`,
      detalhes: mensagem,
    });
    throw error;
  }
}

/**
 * Cria um registro de tabelão a partir de um buffer de PDF já em memória
 * e dispara o processamento em background.
 */
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
    await db.update(tabeloes).set({
      s3PdfUrl, fileKey, statusProcessamento: 'pendente', mensagemErro: null,
    }).where(eq(tabeloes.id, existing.id));
    tabelaoId = existing.id;
  } else {
    const [result] = await db.insert(tabeloes).values({
      construtoraId, mes, ano, s3PdfUrl, fileKey, statusProcessamento: 'pendente',
    }).$returningId();
    tabelaoId = result.id;
  }

  processCatalog(tabelaoId).catch(err => console.error(`[Tabelão] Erro processando ${tabelaoId}:`, err));
  return tabelaoId;
}

export async function processAllPendingCatalogs(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const pendentes = await db.select().from(tabeloes).where(eq(tabeloes.statusProcessamento, 'pendente'));
  console.log(`[Tabelão] ${pendentes.length} tabelões pendentes`);
  for (const t of pendentes) {
    await processCatalog(t.id).catch(err => console.error(`[Tabelão] Erro em ${t.id}:`, err));
  }
}
