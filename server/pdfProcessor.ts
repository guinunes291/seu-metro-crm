/**
 * Processador de Tabelões PDF - Portal de Projetos Imobiliários
 * 
 * Este módulo implementa o pipeline completo de processamento de tabelões:
 * 1. Download do PDF do Google Drive
 * 2. Extração de texto e links
 * 3. Processamento com LLM para extrair dados estruturados
 * 4. Upload do PDF para S3
 * 5. Salvamento no banco de dados
 */

import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { getDb } from "./db";

const db = await getDb();
import { tabeloes, projects, materiais, historicosPrecos, logsSincronizacao, construtoras } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

const execAsync = promisify(exec);

const TEMP_DIR = "/tmp/tabeloes";
const RCLONE_CONFIG = "/home/ubuntu/.gdrive-rclone.ini";
const RCLONE_REMOTE = "manus_google_drive";

/**
 * Garante que o diretório temporário existe
 */
async function ensureTempDir() {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  } catch (error) {
    console.error("Erro ao criar diretório temporário:", error);
  }
}

/**
 * Baixa PDF do Google Drive usando rclone
 */
export async function downloadPdfFromDrive(drivePath: string, localPath: string): Promise<void> {
  await ensureTempDir();
  
  const command = `rclone copyto "${RCLONE_REMOTE}:${drivePath}" "${localPath}" --config ${RCLONE_CONFIG}`;
  
  try {
    await execAsync(command);
    console.log(`PDF baixado com sucesso: ${localPath}`);
  } catch (error) {
    console.error(`Erro ao baixar PDF do Drive:`, error);
    throw new Error(`Falha ao baixar PDF: ${error}`);
  }
}

/**
 * Extrai texto de um PDF usando pdftotext
 */
export async function extractTextFromPdf(pdfPath: string): Promise<string> {
  const txtPath = pdfPath.replace(".pdf", ".txt");
  
  try {
    await execAsync(`pdftotext "${pdfPath}" "${txtPath}"`);
    const text = await fs.readFile(txtPath, "utf-8");
    await fs.unlink(txtPath); // Limpar arquivo temporário
    return text;
  } catch (error) {
    console.error(`Erro ao extrair texto do PDF:`, error);
    throw new Error(`Falha ao extrair texto: ${error}`);
  }
}

/**
 * Extrai links do Google Drive de um PDF usando grep
 */
export async function extractLinksFromPdf(pdfPath: string): Promise<string[]> {
  try {
    const { stdout } = await execAsync(
      `pdftotext "${pdfPath}" - | grep -oP 'https://drive\\.google\\.com/[^\\s]+' || true`
    );
    
    const links = stdout
      .split("\n")
      .filter(link => link.trim().length > 0)
      .map(link => link.trim());
    
    return [...new Set(links)]; // Remover duplicatas
  } catch (error) {
    console.error(`Erro ao extrair links do PDF:`, error);
    return [];
  }
}

/**
 * Processa texto do PDF com LLM para extrair dados estruturados
 */
export async function extractProjectDataWithLLM(
  pdfText: string,
  construtoraName: string
): Promise<any> {
  // Limitar texto para evitar exceder limite de tokens
  const maxChars = 50000;
  const truncatedText = pdfText.length > maxChars 
    ? pdfText.substring(0, maxChars) + "\n\n[TEXTO TRUNCADO]"
    : pdfText;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Você é um especialista em extração de dados de tabelões imobiliários. 
Extraia informações estruturadas sobre projetos imobiliários do texto fornecido.
Para cada projeto, extraia: nome, endereço, região/bairro, preço mínimo, metragem mínima e máxima, dormitórios mínimo e máximo, descrição, linkMateriais (pasta do Google Drive com fotos/books), bookPdfUrl (link direto para PDF de apresentação).
Se algum campo não estiver disponível, use null.
Preços devem ser em centavos (multiplicar por 100).
Metragens em metros quadrados (inteiro).
Links devem ser URLs completas do Google Drive.`
        },
        {
          role: "user",
          content: `Extraia dados de projetos da construtora "${construtoraName}" deste tabelão:\n\n${truncatedText}`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "projects_data",
          strict: true,
          schema: {
            type: "object",
            properties: {
              projects: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    nome: { type: "string" },
                    endereco: { type: ["string", "null"] },
                    regiao: { type: ["string", "null"] },
                    bairro: { type: ["string", "null"] },
                    precoMinimo: { type: ["integer", "null"] },
                    metragemMinima: { type: ["integer", "null"] },
                    metragemMaxima: { type: ["integer", "null"] },
                    dormitoriosMin: { type: ["integer", "null"] },
                    dormitoriosMax: { type: ["integer", "null"] },
                    descricao: { type: ["string", "null"] },
                    linkMateriais: { type: ["string", "null"], description: "Link do Google Drive para pasta de materiais (fotos, books, plantas)" },
                    bookPdfUrl: { type: ["string", "null"], description: "Link direto para o book/apresentação em PDF do projeto" }
                  },
                  required: ["nome"],
                  additionalProperties: false
                }
              }
            },
            required: ["projects"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content || "{}");
  } catch (error) {
    console.error(`Erro ao processar com LLM:`, error);
    throw new Error(`Falha no processamento LLM: ${error}`);
  }
}

/**
 * Faz upload do PDF para S3
 */
export async function uploadPdfToS3(pdfPath: string, construtoraName: string, mes: number, ano: number): Promise<{ url: string; fileKey: string }> {
  const pdfBuffer = await fs.readFile(pdfPath);
  const fileName = `tabelao-${construtoraName.toLowerCase().replace(/\s+/g, "-")}-${ano}-${String(mes).padStart(2, "0")}.pdf`;
  const fileKey = `tabeloes/${ano}/${String(mes).padStart(2, "0")}/${fileName}`;
  
  const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");
  
  return { url, fileKey };
}

/**
 * Processa um tabelão completo (pipeline completo)
 */
export async function processCatalog(tabelaoId: number): Promise<void> {
  try {
    // 1. Buscar tabelão no banco
    const [tabelao] = await db
      .select()
      .from(tabeloes)
      .where(eq(tabeloes.id, tabelaoId))
      .limit(1);

    if (!tabelao) {
      throw new Error(`Tabelão ${tabelaoId} não encontrado`);
    }

    // 2. Buscar construtora
    const [construtora] = await db
      .select()
      .from(construtoras)
      .where(eq(construtoras.id, tabelao.construtoraId))
      .limit(1);

    if (!construtora) {
      throw new Error(`Construtora ${tabelao.construtoraId} não encontrada`);
    }

    // 3. Atualizar status para "processando"
    await db
      .update(tabeloes)
      .set({ statusProcessamento: "processando" })
      .where(eq(tabeloes.id, tabelaoId));

    // 4. Download do PDF
    const localPdfPath = path.join(TEMP_DIR, `tabelao-${tabelaoId}.pdf`);
    
    if (!tabelao.drivePdfUrl) {
      throw new Error("URL do PDF no Drive não encontrada");
    }

    await downloadPdfFromDrive(tabelao.drivePdfUrl, localPdfPath);

    // 5. Extrair texto e links
    const pdfText = await extractTextFromPdf(localPdfPath);
    const links = await extractLinksFromPdf(localPdfPath);

    // 6. Processar com LLM
    const extractedData = await extractProjectDataWithLLM(pdfText, construtora.nome);

    // 7. Upload para S3
    const { url: s3Url, fileKey } = await uploadPdfToS3(
      localPdfPath,
      construtora.nome,
      tabelao.mes,
      tabelao.ano
    );

    // 8. Salvar projetos no banco
    let projetosExtraidos = 0;
    let materiaisExtraidos = 0;

    for (const projectData of extractedData.projects || []) {
      try {
        // Verificar se projeto já existe (por nome e construtora)
        const [existingProject] = await db
          .select()
          .from(projects)
          .where(
            and(
              eq(projects.nome, projectData.nome),
              eq(projects.construtoraId, construtora.id)
            )
          )
          .limit(1);

        let projectId: number;

        if (existingProject) {
          // Atualizar projeto existente
          await db
            .update(projects)
            .set({
              endereco: projectData.endereco,
              regiao: projectData.regiao,
              bairro: projectData.bairro,
              valorMinimo: projectData.precoMinimo,
              metragemMinima: projectData.metragemMinima,
              metragemMaxima: projectData.metragemMaxima,
              descricao: projectData.descricao,
              linkMateriais: projectData.linkMateriais,
              bookPdfUrl: projectData.bookPdfUrl,
              updatedAt: new Date(),
            })
            .where(eq(projects.id, existingProject.id));

          projectId = existingProject.id;
        } else {
          // Criar novo projeto
          const [newProject] = await db
            .insert(projects)
            .values({
              nome: projectData.nome,
              construtora: construtora.nome,
              construtoraId: construtora.id,
              endereco: projectData.endereco,
              regiao: projectData.regiao,
              bairro: projectData.bairro,
              cidade: "São Paulo",
              estado: "SP",
              valorMinimo: projectData.precoMinimo,
              metragemMinima: projectData.metragemMinima,
              metragemMaxima: projectData.metragemMaxima,
              dormitorios: projectData.dormitoriosMin && projectData.dormitoriosMax
                ? `${projectData.dormitoriosMin}, ${projectData.dormitoriosMax}`
                : null,
              descricao: projectData.descricao,
              linkMateriais: projectData.linkMateriais,
              bookPdfUrl: projectData.bookPdfUrl,
              status: "ativo",
              tipo: "outro",
            })
            .$returningId();

          projectId = newProject.id;
          projetosExtraidos++;
        }

        // Registrar histórico de preço
        if (projectData.precoMinimo) {
          await db.insert(historicosPrecos).values({
            projetoId: projectId,
            mes: tabelao.mes,
            ano: tabelao.ano,
            precoMinimo: projectData.precoMinimo,
          });
        }
      } catch (error) {
        console.error(`Erro ao salvar projeto ${projectData.nome}:`, error);
      }
    }

    // 9. Atualizar tabelão com resultados
    await db
      .update(tabeloes)
      .set({
        statusProcessamento: "concluido",
        s3PdfUrl: s3Url,
        fileKey,
        totalProjetos: projetosExtraidos,
        totalLinks: links.length,
        processadoEm: new Date(),
      })
      .where(eq(tabeloes.id, tabelaoId));

    // 10. Registrar log de sucesso
    await db.insert(logsSincronizacao).values({
      status: "sucesso",
      mensagem: `Tabelão processado: ${construtora.nome} - ${tabelao.mes}/${tabelao.ano}`,
      detalhes: JSON.stringify({
        tabelaoId,
        construtoraId: construtora.id,
        projetosExtraidos,
        materiaisExtraidos,
        totalLinks: links.length,
      }),
      tabeloesProcessados: 1,
      projetosExtraidos,
      materiaisExtraidos,
    });

    // 11. Limpar arquivo temporário
    await fs.unlink(localPdfPath);

    console.log(`✅ Tabelão ${tabelaoId} processado com sucesso!`);
  } catch (error) {
    console.error(`❌ Erro ao processar tabelão ${tabelaoId}:`, error);

    // Atualizar status para "erro"
    await db
      .update(tabeloes)
      .set({
        statusProcessamento: "erro",
        mensagemErro: error instanceof Error ? error.message : String(error),
      })
      .where(eq(tabeloes.id, tabelaoId));

    // Registrar log de erro
    await db.insert(logsSincronizacao).values({
      status: "erro",
      mensagem: `Erro ao processar tabelão ${tabelaoId}`,
      detalhes: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

/**
 * Processa todos os tabelões pendentes
 */
export async function processAllPendingCatalogs(): Promise<void> {
  const pendingTabeloes = await db
    .select()
    .from(tabeloes)
    .where(eq(tabeloes.statusProcessamento, "pendente"));

  console.log(`📋 Encontrados ${pendingTabeloes.length} tabelões pendentes`);

  for (const tabelao of pendingTabeloes) {
    try {
      await processCatalog(tabelao.id);
    } catch (error) {
      console.error(`Erro ao processar tabelão ${tabelao.id}:`, error);
      // Continuar processando os próximos
    }
  }

  console.log(`✅ Processamento de tabelões concluído!`);
}
