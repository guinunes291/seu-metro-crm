/**
 * Serviço de extração de imagens do Book PDF
 * Converte páginas do PDF em imagens e usa IA para classificar
 */

import { PDFDocument } from 'pdf-lib';
import { invokeLLM } from './_core/llm';
import { storagePut } from './storage';

// Tipos para as imagens extraídas
export interface ImagemExtraida {
  tipo: 'fachada' | 'lazer' | 'planta' | 'perspectiva' | 'area_comum' | 'outro';
  url: string;
  pagina: number;
  confianca: number;
  descricao?: string;
}

export interface ResultadoExtracao {
  sucesso: boolean;
  imagens: ImagemExtraida[];
  totalPaginas: number;
  erro?: string;
}

/**
 * Extrai imagens do PDF do Book e classifica usando IA
 */
export async function extrairImagensDoBook(
  pdfBuffer: Buffer,
  propostaId: number,
  projetoNome: string
): Promise<ResultadoExtracao> {
  try {
    // Carregar o PDF
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const totalPaginas = pdfDoc.getPageCount();
    
    console.log(`[BookExtractor] PDF carregado com ${totalPaginas} páginas`);
    
    // Limitar a 20 páginas para não sobrecarregar
    const paginasParaProcessar = Math.min(totalPaginas, 20);
    
    const imagensExtraidas: ImagemExtraida[] = [];
    
    // Para cada página, converter em imagem e analisar
    for (let i = 0; i < paginasParaProcessar; i++) {
      try {
        // Criar um novo PDF com apenas esta página
        const singlePagePdf = await PDFDocument.create();
        const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [i]);
        singlePagePdf.addPage(copiedPage);
        
        // Converter para bytes
        const pdfBytes = await singlePagePdf.save();
        
        // Fazer upload do PDF da página para S3
        const pageKey = `propostas/book-pages/${propostaId}/pagina-${i + 1}-${Date.now()}.pdf`;
        const { url: pageUrl } = await storagePut(pageKey, Buffer.from(pdfBytes), 'application/pdf');
        
        console.log(`[BookExtractor] Página ${i + 1} salva em ${pageUrl}`);
        
        // Usar LLM com visão para analisar a página
        const classificacao = await classificarPaginaComIA(pageUrl, projetoNome, i + 1);
        
        if (classificacao && classificacao.tipo !== 'outro') {
          // Se for uma imagem relevante, salvar a URL
          imagensExtraidas.push({
            tipo: classificacao.tipo,
            url: pageUrl,
            pagina: i + 1,
            confianca: classificacao.confianca,
            descricao: classificacao.descricao
          });
          
          console.log(`[BookExtractor] Página ${i + 1} classificada como: ${classificacao.tipo} (${classificacao.confianca}%)`);
        }
        
        // Parar se já temos imagens suficientes de cada tipo
        const tiposEncontrados = new Set(imagensExtraidas.map(img => img.tipo));
        if (tiposEncontrados.has('fachada') && 
            tiposEncontrados.has('lazer') && 
            tiposEncontrados.has('planta') &&
            imagensExtraidas.length >= 6) {
          console.log('[BookExtractor] Imagens suficientes encontradas, parando extração');
          break;
        }
        
      } catch (pageError) {
        console.error(`[BookExtractor] Erro ao processar página ${i + 1}:`, pageError);
        // Continuar com as próximas páginas
      }
    }
    
    // Ordenar por confiança e tipo
    imagensExtraidas.sort((a, b) => {
      // Priorizar por tipo
      const prioridade: Record<string, number> = {
        'fachada': 1,
        'planta': 2,
        'lazer': 3,
        'area_comum': 4,
        'perspectiva': 5,
        'outro': 6
      };
      
      const prioridadeA = prioridade[a.tipo] || 6;
      const prioridadeB = prioridade[b.tipo] || 6;
      
      if (prioridadeA !== prioridadeB) {
        return prioridadeA - prioridadeB;
      }
      
      // Se mesmo tipo, ordenar por confiança
      return b.confianca - a.confianca;
    });
    
    // Limitar a 4 imagens principais
    const imagensFinais = imagensExtraidas.slice(0, 4);
    
    return {
      sucesso: true,
      imagens: imagensFinais,
      totalPaginas
    };
    
  } catch (error) {
    console.error('[BookExtractor] Erro ao extrair imagens:', error);
    return {
      sucesso: false,
      imagens: [],
      totalPaginas: 0,
      erro: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

/**
 * Classifica uma página do PDF usando IA com visão
 */
async function classificarPaginaComIA(
  pdfUrl: string,
  projetoNome: string,
  numeroPagina: number
): Promise<{ tipo: ImagemExtraida['tipo']; confianca: number; descricao: string } | null> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Você é um especialista em análise de materiais de marketing imobiliário.
Analise a página do book de vendas e classifique o tipo de conteúdo visual.

Tipos possíveis:
- fachada: Imagem da fachada do prédio/empreendimento (exterior do edifício)
- lazer: Áreas de lazer como piscina, churrasqueira, playground, salão de festas, academia
- planta: Planta baixa do apartamento/unidade
- perspectiva: Imagem ilustrativa de ambientes internos decorados
- area_comum: Hall de entrada, corredores, áreas comuns
- outro: Textos, tabelas, mapas, logos, ou conteúdo não visual relevante

Responda APENAS com um JSON válido no formato:
{
  "tipo": "fachada|lazer|planta|perspectiva|area_comum|outro",
  "confianca": 0-100,
  "descricao": "breve descrição do que aparece na imagem"
}`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analise esta página ${numeroPagina} do book do empreendimento "${projetoNome}" e classifique o tipo de conteúdo visual.`
            },
            {
              type: 'file_url',
              file_url: {
                url: pdfUrl,
                mime_type: 'application/pdf'
              }
            }
          ]
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'classificacao_imagem',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              tipo: {
                type: 'string',
                enum: ['fachada', 'lazer', 'planta', 'perspectiva', 'area_comum', 'outro']
              },
              confianca: {
                type: 'integer',
                description: 'Nível de confiança de 0 a 100'
              },
              descricao: {
                type: 'string',
                description: 'Breve descrição do conteúdo visual'
              }
            },
            required: ['tipo', 'confianca', 'descricao'],
            additionalProperties: false
          }
        }
      }
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    
    const resultado = JSON.parse(content);
    return {
      tipo: resultado.tipo as ImagemExtraida['tipo'],
      confianca: resultado.confianca,
      descricao: resultado.descricao
    };
    
  } catch (error) {
    console.error(`[BookExtractor] Erro ao classificar página ${numeroPagina}:`, error);
    return null;
  }
}

/**
 * Seleciona as melhores imagens para cada categoria
 */
export function selecionarMelhoresImagens(imagens: ImagemExtraida[]): {
  fachada?: ImagemExtraida;
  lazer: ImagemExtraida[];
  planta?: ImagemExtraida;
  perspectiva?: ImagemExtraida;
} {
  const fachada = imagens.find(img => img.tipo === 'fachada');
  const planta = imagens.find(img => img.tipo === 'planta');
  const perspectiva = imagens.find(img => img.tipo === 'perspectiva');
  const lazer = imagens.filter(img => img.tipo === 'lazer' || img.tipo === 'area_comum').slice(0, 2);
  
  return {
    fachada,
    lazer,
    planta,
    perspectiva
  };
}
