import { readFileSync } from 'fs';
import { PDFDocument } from 'pdf-lib';

async function testBook() {
  try {
    console.log('Carregando PDF...');
    const pdfBuffer = readFileSync('/home/ubuntu/upload/BookBarraFunda930.pdf');
    console.log(`Tamanho do buffer: ${pdfBuffer.length} bytes`);
    
    console.log('Parseando PDF com pdf-lib...');
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const totalPaginas = pdfDoc.getPageCount();
    console.log(`Total de páginas: ${totalPaginas}`);
    
    // Testar extração de uma página
    console.log('Extraindo página 1...');
    const singlePagePdf = await PDFDocument.create();
    const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [0]);
    singlePagePdf.addPage(copiedPage);
    
    const pdfBytes = await singlePagePdf.save();
    console.log(`Página 1 extraída: ${pdfBytes.length} bytes`);
    
    console.log('Teste concluído com sucesso!');
  } catch (error) {
    console.error('Erro:', error);
  }
}

testBook();
