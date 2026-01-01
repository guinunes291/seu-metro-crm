/**
 * Serviço de extração de imagens do Book PDF
 * Versão simplificada - apenas faz upload do PDF e extrai páginas específicas
 */

import { PDFDocument } from 'pdf-lib';
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
  bookUrl?: string;
  erro?: string;
}

/**
 * Processa o Book PDF de forma simplificada
 * Faz upload do PDF completo e extrai apenas as primeiras páginas como previews
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
    
    // Fazer upload do PDF completo primeiro
    const bookKey = `propostas/books/${propostaId}/book-${Date.now()}.pdf`;
    const { url: bookUrl } = await storagePut(bookKey, pdfBuffer, 'application/pdf');
    
    console.log(`[BookExtractor] Book completo salvo em ${bookUrl}`);
    
    // Extrair apenas as primeiras 4 páginas como previews
    // Geralmente: página 1-2 = capa/fachada, página 3-4 = planta/lazer
    const paginasParaExtrair = Math.min(totalPaginas, 4);
    const imagensExtraidas: ImagemExtraida[] = [];
    
    // Mapeamento de páginas para tipos (heurística comum em books imobiliários)
    const tiposPorPagina: Record<number, ImagemExtraida['tipo']> = {
      0: 'fachada',      // Primeira página geralmente é a fachada
      1: 'perspectiva',  // Segunda página geralmente é perspectiva interna
      2: 'planta',       // Terceira página geralmente é a planta
      3: 'lazer'         // Quarta página geralmente é área de lazer
    };
    
    for (let i = 0; i < paginasParaExtrair; i++) {
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
        
        // Adicionar à lista com tipo baseado na posição
        imagensExtraidas.push({
          tipo: tiposPorPagina[i] || 'outro',
          url: pageUrl,
          pagina: i + 1,
          confianca: 70, // Confiança média pois é heurística
          descricao: `Página ${i + 1} do book - ${tiposPorPagina[i] || 'conteúdo'}`
        });
        
      } catch (pageError) {
        console.error(`[BookExtractor] Erro ao processar página ${i + 1}:`, pageError);
        // Continuar com as próximas páginas
      }
    }
    
    return {
      sucesso: true,
      imagens: imagensExtraidas,
      totalPaginas,
      bookUrl
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
