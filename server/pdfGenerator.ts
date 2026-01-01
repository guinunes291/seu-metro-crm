/**
 * Gerador de PDF Profissional para Propostas Imobiliárias
 * 
 * Este módulo gera um PDF completo com 11 seções:
 * 1. Capa
 * 2. Resumo Executivo
 * 3. Apresentação do Empreendimento
 * 4. Localização com Google Maps
 * 5. Planta da Unidade
 * 6. Tabela de Pagamento
 * 7. Simulação de Financiamento
 * 8. Benefícios
 * 9. Documentação Necessária
 * 10. Cronograma
 * 11. Termo de Aceite
 */

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Tipos para os dados da proposta
export interface DadosProposta {
  // Dados básicos
  id: number;
  token: string;
  nomeCliente: string;
  emailCliente?: string;
  telefoneCliente?: string;
  
  // Dados do imóvel
  unidade?: string;
  tipologia?: string;
  metragem?: number;
  
  // Valores (em centavos no banco, converter para reais)
  valorImovel: number;
  valorEntrada?: number;
  valorFinanciamento?: number;
  parcelas?: number;
  valorParcela?: number;
  taxaJuros?: string;
  desconto?: number;
  motivoDesconto?: string;
  
  // Conteúdo
  mensagemPersonalizada?: string;
  imagensSelecionadas?: string[];
  plantasSelecionadas?: string[];
  
  // Validade
  validoAte?: Date;
  
  // Dados do projeto
  projeto: {
    nome: string;
    construtora?: string;
    endereco?: string;
    bairro?: string;
    cidade: string;
    estado: string;
    descricao?: string;
    tipo: string;
    imagemPrincipal?: string;
    logoUrl?: string;
    zona?: string;
    enquadramento?: string;
  };
  
  // Dados do corretor
  corretor: {
    name?: string;
    email?: string;
    telefone?: string;
    fotoUrl?: string;
    creci?: string;
  };
  
  // Tabela de pagamento (JSON)
  tabelaPagamento?: {
    tipo: string;
    nome: string;
    quantidade: number;
    valorUnitario: number;
    total: number;
  }[];
  
  // Dados da simulação
  simulacao?: {
    rendaFamiliar?: number;
    dataNascimento?: string;
    prazoMeses?: number;
    primeiraPrestacao?: number;
    jurosEfetivos?: string;
  };
  
  createdAt: Date;
}

// Função auxiliar para formatar moeda
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value / 100); // Converter de centavos para reais
}

// Função auxiliar para formatar data
function formatDate(date: Date): string {
  return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

// Gerar HTML para o PDF
export function gerarHTMLProposta(dados: DadosProposta): string {
  const dataAtual = formatDate(new Date());
  const validadeFormatada = dados.validoAte ? formatDate(dados.validoAte) : 'Não especificada';
  
  // Calcular total da tabela de pagamento
  const totalPagamento = dados.tabelaPagamento?.reduce((acc, p) => acc + p.total, 0) || 0;
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proposta - ${dados.nomeCliente}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1e293b;
      background: #fff;
    }
    
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 20mm;
      margin: 0 auto;
      background: #fff;
      page-break-after: always;
    }
    
    .page:last-child {
      page-break-after: auto;
    }
    
    /* ===== CAPA ===== */
    .capa {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: calc(297mm - 40mm);
      text-align: center;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #fff;
      padding: 30mm;
      margin: -20mm;
    }
    
    .capa-header {
      margin-bottom: 40px;
    }
    
    .capa-logo {
      width: 120px;
      height: auto;
      margin-bottom: 20px;
    }
    
    .capa-empresa {
      font-size: 14pt;
      font-weight: 300;
      color: #f59e0b;
      text-transform: uppercase;
      letter-spacing: 3px;
    }
    
    .capa-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    
    .capa-titulo {
      font-size: 32pt;
      font-weight: 700;
      margin-bottom: 20px;
      color: #f59e0b;
    }
    
    .capa-subtitulo {
      font-size: 18pt;
      font-weight: 300;
      margin-bottom: 40px;
      color: #94a3b8;
    }
    
    .capa-cliente {
      font-size: 16pt;
      font-weight: 500;
      padding: 20px 40px;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 8px;
      display: inline-block;
      margin: 0 auto;
    }
    
    .capa-footer {
      margin-top: 40px;
    }
    
    .capa-data {
      font-size: 11pt;
      color: #64748b;
    }
    
    .capa-validade {
      font-size: 10pt;
      color: #f59e0b;
      margin-top: 10px;
    }
    
    /* ===== SEÇÕES ===== */
    .secao {
      margin-bottom: 30px;
    }
    
    .secao-header {
      display: flex;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #f59e0b;
    }
    
    .secao-numero {
      width: 40px;
      height: 40px;
      background: #f59e0b;
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14pt;
      margin-right: 15px;
    }
    
    .secao-titulo {
      font-size: 18pt;
      font-weight: 600;
      color: #0f172a;
    }
    
    .secao-conteudo {
      padding-left: 55px;
    }
    
    /* ===== RESUMO EXECUTIVO ===== */
    .resumo-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }
    
    .resumo-item {
      background: #f8fafc;
      padding: 15px 20px;
      border-radius: 8px;
      border-left: 4px solid #f59e0b;
    }
    
    .resumo-label {
      font-size: 9pt;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 5px;
    }
    
    .resumo-valor {
      font-size: 14pt;
      font-weight: 600;
      color: #0f172a;
    }
    
    .resumo-valor.destaque {
      color: #059669;
      font-size: 18pt;
    }
    
    /* ===== APRESENTAÇÃO ===== */
    .apresentacao-imagem {
      width: 100%;
      max-height: 200px;
      object-fit: cover;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    
    .apresentacao-descricao {
      text-align: justify;
      color: #475569;
    }
    
    .apresentacao-badges {
      display: flex;
      gap: 10px;
      margin-top: 15px;
      flex-wrap: wrap;
    }
    
    .badge {
      padding: 5px 12px;
      background: #f1f5f9;
      border-radius: 20px;
      font-size: 9pt;
      color: #475569;
    }
    
    .badge.destaque {
      background: #fef3c7;
      color: #92400e;
    }
    
    /* ===== LOCALIZAÇÃO ===== */
    .mapa-container {
      width: 100%;
      height: 250px;
      background: #e2e8f0;
      border-radius: 8px;
      margin-bottom: 15px;
      overflow: hidden;
    }
    
    .mapa-container img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .endereco-completo {
      background: #f8fafc;
      padding: 15px 20px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .endereco-icon {
      width: 24px;
      height: 24px;
      color: #f59e0b;
    }
    
    /* ===== PLANTA ===== */
    .planta-container {
      text-align: center;
    }
    
    .planta-imagem {
      max-width: 100%;
      max-height: 350px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    
    .planta-legenda {
      margin-top: 15px;
      font-size: 10pt;
      color: #64748b;
    }
    
    /* ===== TABELA DE PAGAMENTO ===== */
    .tabela-pagamento {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    
    .tabela-pagamento th {
      background: #0f172a;
      color: #fff;
      padding: 12px 15px;
      text-align: left;
      font-weight: 500;
      font-size: 10pt;
    }
    
    .tabela-pagamento th:first-child {
      border-radius: 8px 0 0 0;
    }
    
    .tabela-pagamento th:last-child {
      border-radius: 0 8px 0 0;
      text-align: right;
    }
    
    .tabela-pagamento td {
      padding: 12px 15px;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .tabela-pagamento td:last-child {
      text-align: right;
      font-weight: 500;
    }
    
    .tabela-pagamento tr:nth-child(even) {
      background: #f8fafc;
    }
    
    .tabela-pagamento .total {
      background: #fef3c7;
      font-weight: 700;
    }
    
    .tabela-pagamento .total td {
      border-bottom: none;
    }
    
    /* ===== SIMULAÇÃO ===== */
    .simulacao-box {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      color: #fff;
      padding: 25px;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    
    .simulacao-titulo {
      font-size: 12pt;
      font-weight: 300;
      margin-bottom: 10px;
      opacity: 0.9;
    }
    
    .simulacao-valor {
      font-size: 28pt;
      font-weight: 700;
    }
    
    .simulacao-detalhe {
      font-size: 10pt;
      opacity: 0.8;
      margin-top: 5px;
    }
    
    .simulacao-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }
    
    .simulacao-item {
      background: #f8fafc;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }
    
    .simulacao-item-label {
      font-size: 9pt;
      color: #64748b;
      margin-bottom: 5px;
    }
    
    .simulacao-item-valor {
      font-size: 14pt;
      font-weight: 600;
      color: #0f172a;
    }
    
    /* ===== BENEFÍCIOS ===== */
    .beneficios-lista {
      list-style: none;
    }
    
    .beneficios-lista li {
      display: flex;
      align-items: flex-start;
      gap: 15px;
      margin-bottom: 15px;
      padding: 15px;
      background: #f8fafc;
      border-radius: 8px;
    }
    
    .beneficio-icon {
      width: 24px;
      height: 24px;
      background: #dcfce7;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #059669;
      flex-shrink: 0;
    }
    
    .beneficio-texto {
      flex: 1;
    }
    
    .beneficio-titulo {
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 3px;
    }
    
    .beneficio-descricao {
      font-size: 10pt;
      color: #64748b;
    }
    
    /* ===== DOCUMENTAÇÃO ===== */
    .docs-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    
    .doc-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 15px;
      background: #f8fafc;
      border-radius: 6px;
      font-size: 10pt;
    }
    
    .doc-check {
      width: 16px;
      height: 16px;
      border: 2px solid #d1d5db;
      border-radius: 3px;
    }
    
    /* ===== CRONOGRAMA ===== */
    .cronograma {
      position: relative;
      padding-left: 30px;
    }
    
    .cronograma::before {
      content: '';
      position: absolute;
      left: 10px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #e2e8f0;
    }
    
    .cronograma-item {
      position: relative;
      margin-bottom: 20px;
      padding-left: 20px;
    }
    
    .cronograma-item::before {
      content: '';
      position: absolute;
      left: -24px;
      top: 5px;
      width: 12px;
      height: 12px;
      background: #f59e0b;
      border-radius: 50%;
      border: 3px solid #fff;
      box-shadow: 0 0 0 2px #f59e0b;
    }
    
    .cronograma-etapa {
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 3px;
    }
    
    .cronograma-prazo {
      font-size: 10pt;
      color: #64748b;
    }
    
    /* ===== TERMO DE ACEITE ===== */
    .termo-box {
      background: #f8fafc;
      padding: 25px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
    }
    
    .termo-texto {
      font-size: 10pt;
      color: #475569;
      text-align: justify;
      margin-bottom: 30px;
    }
    
    .termo-assinatura {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 40px;
      margin-top: 40px;
    }
    
    .assinatura-campo {
      text-align: center;
    }
    
    .assinatura-linha {
      border-top: 1px solid #0f172a;
      padding-top: 10px;
      margin-top: 60px;
    }
    
    .assinatura-nome {
      font-weight: 600;
      color: #0f172a;
    }
    
    .assinatura-cargo {
      font-size: 9pt;
      color: #64748b;
    }
    
    /* ===== RODAPÉ ===== */
    .rodape {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9pt;
      color: #64748b;
    }
    
    .rodape-corretor {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .corretor-foto {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
    }
    
    .corretor-info {
      text-align: left;
    }
    
    .corretor-nome {
      font-weight: 600;
      color: #0f172a;
    }
    
    /* ===== GALERIA DE IMAGENS ===== */
    .galeria {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-top: 20px;
    }
    
    .galeria-item {
      border-radius: 8px;
      overflow: hidden;
      aspect-ratio: 16/9;
    }
    
    .galeria-item img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      .page {
        margin: 0;
        padding: 15mm;
        width: 100%;
        min-height: auto;
        page-break-after: always;
      }
      
      .capa {
        margin: -15mm;
        padding: 25mm;
      }
    }
  </style>
</head>
<body>
  <!-- PÁGINA 1: CAPA -->
  <div class="page">
    <div class="capa">
      <div class="capa-header">
        ${dados.projeto.logoUrl ? `<img src="${dados.projeto.logoUrl}" alt="Logo" class="capa-logo">` : ''}
        <div class="capa-empresa">Seu Metro Quadrado</div>
      </div>
      
      <div class="capa-content">
        <h1 class="capa-titulo">PROPOSTA COMERCIAL</h1>
        <p class="capa-subtitulo">${dados.projeto.nome}</p>
        <div class="capa-cliente">
          Preparada especialmente para<br>
          <strong>${dados.nomeCliente}</strong>
        </div>
      </div>
      
      <div class="capa-footer">
        <p class="capa-data">${dataAtual}</p>
        <p class="capa-validade">Válida até: ${validadeFormatada}</p>
      </div>
    </div>
  </div>
  
  <!-- PÁGINA 2: RESUMO EXECUTIVO -->
  <div class="page">
    <div class="secao">
      <div class="secao-header">
        <div class="secao-numero">1</div>
        <h2 class="secao-titulo">Resumo Executivo</h2>
      </div>
      <div class="secao-conteudo">
        <div class="resumo-grid">
          <div class="resumo-item">
            <div class="resumo-label">Empreendimento</div>
            <div class="resumo-valor">${dados.projeto.nome}</div>
          </div>
          <div class="resumo-item">
            <div class="resumo-label">Unidade</div>
            <div class="resumo-valor">${dados.unidade || 'A definir'}</div>
          </div>
          <div class="resumo-item">
            <div class="resumo-label">Tipologia</div>
            <div class="resumo-valor">${dados.tipologia || 'A definir'}</div>
          </div>
          <div class="resumo-item">
            <div class="resumo-label">Metragem</div>
            <div class="resumo-valor">${dados.metragem ? dados.metragem + ' m²' : 'A definir'}</div>
          </div>
          <div class="resumo-item" style="grid-column: span 2;">
            <div class="resumo-label">Valor do Imóvel</div>
            <div class="resumo-valor destaque">${formatCurrency(dados.valorImovel)}</div>
          </div>
          ${dados.valorEntrada ? `
          <div class="resumo-item">
            <div class="resumo-label">Entrada</div>
            <div class="resumo-valor">${formatCurrency(dados.valorEntrada)}</div>
          </div>
          ` : ''}
          ${dados.valorFinanciamento ? `
          <div class="resumo-item">
            <div class="resumo-label">Financiamento</div>
            <div class="resumo-valor">${formatCurrency(dados.valorFinanciamento)}</div>
          </div>
          ` : ''}
        </div>
        
        ${dados.mensagemPersonalizada ? `
        <div style="margin-top: 25px; padding: 20px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <p style="font-style: italic; color: #92400e;">"${dados.mensagemPersonalizada}"</p>
        </div>
        ` : ''}
      </div>
    </div>
    
    <!-- SEÇÃO 2: APRESENTAÇÃO DO EMPREENDIMENTO -->
    <div class="secao">
      <div class="secao-header">
        <div class="secao-numero">2</div>
        <h2 class="secao-titulo">Apresentação do Empreendimento</h2>
      </div>
      <div class="secao-conteudo">
        ${dados.projeto.imagemPrincipal || (dados.imagensSelecionadas && dados.imagensSelecionadas[0]) ? `
        <img src="${dados.projeto.imagemPrincipal || dados.imagensSelecionadas![0]}" alt="${dados.projeto.nome}" class="apresentacao-imagem">
        ` : ''}
        
        <p class="apresentacao-descricao">
          ${dados.projeto.descricao || `O ${dados.projeto.nome} é um empreendimento ${dados.projeto.tipo === 'mcmv' ? 'do programa Minha Casa Minha Vida' : ''} localizado em ${dados.projeto.bairro || dados.projeto.cidade}, desenvolvido pela ${dados.projeto.construtora || 'construtora parceira'}. Uma excelente oportunidade para realizar o sonho da casa própria com condições especiais de financiamento.`}
        </p>
        
        <div class="apresentacao-badges">
          ${dados.projeto.tipo === 'mcmv' ? '<span class="badge destaque">Minha Casa Minha Vida</span>' : ''}
          ${dados.projeto.enquadramento ? `<span class="badge">${dados.projeto.enquadramento}</span>` : ''}
          ${dados.projeto.zona ? `<span class="badge">Zona ${dados.projeto.zona.charAt(0).toUpperCase() + dados.projeto.zona.slice(1)}</span>` : ''}
          ${dados.projeto.construtora ? `<span class="badge">${dados.projeto.construtora}</span>` : ''}
        </div>
        
        ${dados.imagensSelecionadas && dados.imagensSelecionadas.length > 1 ? `
        <div class="galeria">
          ${dados.imagensSelecionadas.slice(1, 5).map(img => `
            <div class="galeria-item">
              <img src="${img}" alt="Imagem do empreendimento">
            </div>
          `).join('')}
        </div>
        ` : ''}
      </div>
    </div>
  </div>
  
  <!-- PÁGINA 3: LOCALIZAÇÃO E PLANTA -->
  <div class="page">
    <!-- SEÇÃO 3: LOCALIZAÇÃO -->
    <div class="secao">
      <div class="secao-header">
        <div class="secao-numero">3</div>
        <h2 class="secao-titulo">Localização</h2>
      </div>
      <div class="secao-conteudo">
        <div class="mapa-container">
          ${dados.projeto.endereco ? `
          <img src="https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(dados.projeto.endereco + ', ' + dados.projeto.cidade + ', ' + dados.projeto.estado)}&zoom=15&size=600x300&maptype=roadmap&markers=color:red%7C${encodeURIComponent(dados.projeto.endereco + ', ' + dados.projeto.cidade)}&key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8" alt="Mapa">
          ` : '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #64748b;">Mapa não disponível</div>'}
        </div>
        
        <div class="endereco-completo">
          <svg class="endereco-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
          <div>
            <strong>${dados.projeto.endereco || 'Endereço a confirmar'}</strong><br>
            ${dados.projeto.bairro ? dados.projeto.bairro + ' - ' : ''}${dados.projeto.cidade}/${dados.projeto.estado}
          </div>
        </div>
      </div>
    </div>
    
    <!-- SEÇÃO 4: PLANTA DA UNIDADE -->
    <div class="secao">
      <div class="secao-header">
        <div class="secao-numero">4</div>
        <h2 class="secao-titulo">Planta da Unidade</h2>
      </div>
      <div class="secao-conteudo">
        <div class="planta-container">
          ${dados.plantasSelecionadas && dados.plantasSelecionadas[0] ? `
          <img src="${dados.plantasSelecionadas[0]}" alt="Planta da unidade" class="planta-imagem">
          <p class="planta-legenda">${dados.tipologia || 'Planta ilustrativa'} - ${dados.metragem ? dados.metragem + ' m²' : ''}</p>
          ` : `
          <div style="padding: 60px; background: #f8fafc; border-radius: 8px; color: #64748b;">
            <p>Planta da unidade será disponibilizada em breve.</p>
          </div>
          `}
        </div>
      </div>
    </div>
  </div>
  
  <!-- PÁGINA 4: TABELA DE PAGAMENTO E SIMULAÇÃO -->
  <div class="page">
    <!-- SEÇÃO 5: TABELA DE PAGAMENTO -->
    <div class="secao">
      <div class="secao-header">
        <div class="secao-numero">5</div>
        <h2 class="secao-titulo">Tabela de Pagamento</h2>
      </div>
      <div class="secao-conteudo">
        <table class="tabela-pagamento">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Qtd</th>
              <th>Valor Unit.</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${dados.tabelaPagamento && dados.tabelaPagamento.length > 0 ? 
              dados.tabelaPagamento.map(p => `
                <tr>
                  <td>${p.nome}</td>
                  <td>${p.quantidade}x</td>
                  <td>${formatCurrency(p.valorUnitario * 100)}</td>
                  <td>${formatCurrency(p.total * 100)}</td>
                </tr>
              `).join('') : `
                <tr>
                  <td>Financiamento</td>
                  <td>1x</td>
                  <td>${formatCurrency(dados.valorFinanciamento || 0)}</td>
                  <td>${formatCurrency(dados.valorFinanciamento || 0)}</td>
                </tr>
                <tr>
                  <td>Entrada</td>
                  <td>1x</td>
                  <td>${formatCurrency(dados.valorEntrada || 0)}</td>
                  <td>${formatCurrency(dados.valorEntrada || 0)}</td>
                </tr>
              `}
            <tr class="total">
              <td colspan="3"><strong>TOTAL</strong></td>
              <td><strong>${formatCurrency(totalPagamento > 0 ? totalPagamento * 100 : dados.valorImovel)}</strong></td>
            </tr>
          </tbody>
        </table>
        
        ${dados.desconto ? `
        <div style="background: #dcfce7; padding: 15px 20px; border-radius: 8px; margin-top: 15px;">
          <strong style="color: #059669;">Desconto aplicado: ${formatCurrency(dados.desconto)}</strong>
          ${dados.motivoDesconto ? `<br><span style="font-size: 10pt; color: #047857;">${dados.motivoDesconto}</span>` : ''}
        </div>
        ` : ''}
      </div>
    </div>
    
    <!-- SEÇÃO 6: SIMULAÇÃO DE FINANCIAMENTO -->
    <div class="secao">
      <div class="secao-header">
        <div class="secao-numero">6</div>
        <h2 class="secao-titulo">Simulação de Financiamento</h2>
      </div>
      <div class="secao-conteudo">
        ${dados.valorParcela ? `
        <div class="simulacao-box">
          <div class="simulacao-titulo">Primeira Parcela</div>
          <div class="simulacao-valor">${formatCurrency(dados.valorParcela)}</div>
          <div class="simulacao-detalhe">${dados.parcelas ? dados.parcelas + ' parcelas' : ''} ${dados.taxaJuros ? '• ' + dados.taxaJuros : ''}</div>
        </div>
        ` : ''}
        
        <div class="simulacao-grid">
          ${dados.valorFinanciamento ? `
          <div class="simulacao-item">
            <div class="simulacao-item-label">Valor Financiado</div>
            <div class="simulacao-item-valor">${formatCurrency(dados.valorFinanciamento)}</div>
          </div>
          ` : ''}
          ${dados.parcelas ? `
          <div class="simulacao-item">
            <div class="simulacao-item-label">Prazo</div>
            <div class="simulacao-item-valor">${dados.parcelas} meses</div>
          </div>
          ` : ''}
          ${dados.taxaJuros ? `
          <div class="simulacao-item">
            <div class="simulacao-item-label">Taxa de Juros</div>
            <div class="simulacao-item-valor">${dados.taxaJuros}</div>
          </div>
          ` : ''}
        </div>
        
        <p style="margin-top: 20px; font-size: 9pt; color: #64748b; text-align: center;">
          * Valores sujeitos à análise de crédito e aprovação pela instituição financeira.
        </p>
      </div>
    </div>
  </div>
  
  <!-- PÁGINA 5: BENEFÍCIOS E DOCUMENTAÇÃO -->
  <div class="page">
    <!-- SEÇÃO 7: BENEFÍCIOS -->
    <div class="secao">
      <div class="secao-header">
        <div class="secao-numero">7</div>
        <h2 class="secao-titulo">Benefícios</h2>
      </div>
      <div class="secao-conteudo">
        <ul class="beneficios-lista">
          <li>
            <div class="beneficio-icon">✓</div>
            <div class="beneficio-texto">
              <div class="beneficio-titulo">Subsídio do Governo</div>
              <div class="beneficio-descricao">Desconto de até R$ 55.000 no valor do imóvel através do programa habitacional.</div>
            </div>
          </li>
          <li>
            <div class="beneficio-icon">✓</div>
            <div class="beneficio-texto">
              <div class="beneficio-titulo">Taxa de Juros Reduzida</div>
              <div class="beneficio-descricao">Taxas a partir de 4% a.a., as menores do mercado para financiamento imobiliário.</div>
            </div>
          </li>
          <li>
            <div class="beneficio-icon">✓</div>
            <div class="beneficio-texto">
              <div class="beneficio-titulo">Use seu FGTS</div>
              <div class="beneficio-descricao">Utilize o saldo do FGTS para entrada ou amortização do financiamento.</div>
            </div>
          </li>
          <li>
            <div class="beneficio-icon">✓</div>
            <div class="beneficio-texto">
              <div class="beneficio-titulo">Parcelas que Cabem no Bolso</div>
              <div class="beneficio-descricao">Parcelas de até 30% da renda familiar, com prazo de até 35 anos.</div>
            </div>
          </li>
          <li>
            <div class="beneficio-icon">✓</div>
            <div class="beneficio-texto">
              <div class="beneficio-titulo">Localização Privilegiada</div>
              <div class="beneficio-descricao">Empreendimento próximo a transporte público, comércio e serviços essenciais.</div>
            </div>
          </li>
        </ul>
      </div>
    </div>
    
    <!-- SEÇÃO 8: DOCUMENTAÇÃO NECESSÁRIA -->
    <div class="secao">
      <div class="secao-header">
        <div class="secao-numero">8</div>
        <h2 class="secao-titulo">Documentação Necessária</h2>
      </div>
      <div class="secao-conteudo">
        <div class="docs-grid">
          <div class="doc-item"><div class="doc-check"></div>RG e CPF</div>
          <div class="doc-item"><div class="doc-check"></div>Comprovante de Estado Civil</div>
          <div class="doc-item"><div class="doc-check"></div>Comprovante de Residência</div>
          <div class="doc-item"><div class="doc-check"></div>Comprovante de Renda (3 últimos)</div>
          <div class="doc-item"><div class="doc-check"></div>Carteira de Trabalho</div>
          <div class="doc-item"><div class="doc-check"></div>Extrato do FGTS</div>
          <div class="doc-item"><div class="doc-check"></div>Declaração de IR (se houver)</div>
          <div class="doc-item"><div class="doc-check"></div>Certidão de Nascimento dos Filhos</div>
        </div>
        <p style="margin-top: 15px; font-size: 9pt; color: #64748b;">
          * Documentação adicional pode ser solicitada conforme análise de crédito.
        </p>
      </div>
    </div>
  </div>
  
  <!-- PÁGINA 6: CRONOGRAMA E TERMO DE ACEITE -->
  <div class="page">
    <!-- SEÇÃO 9: CRONOGRAMA -->
    <div class="secao">
      <div class="secao-header">
        <div class="secao-numero">9</div>
        <h2 class="secao-titulo">Cronograma</h2>
      </div>
      <div class="secao-conteudo">
        <div class="cronograma">
          <div class="cronograma-item">
            <div class="cronograma-etapa">1. Análise de Documentação</div>
            <div class="cronograma-prazo">Prazo: 3 a 5 dias úteis</div>
          </div>
          <div class="cronograma-item">
            <div class="cronograma-etapa">2. Simulação e Aprovação de Crédito</div>
            <div class="cronograma-prazo">Prazo: 5 a 10 dias úteis</div>
          </div>
          <div class="cronograma-item">
            <div class="cronograma-etapa">3. Assinatura do Contrato</div>
            <div class="cronograma-prazo">Prazo: 3 a 5 dias úteis após aprovação</div>
          </div>
          <div class="cronograma-item">
            <div class="cronograma-etapa">4. Registro em Cartório</div>
            <div class="cronograma-prazo">Prazo: 15 a 30 dias</div>
          </div>
          <div class="cronograma-item">
            <div class="cronograma-etapa">5. Entrega das Chaves</div>
            <div class="cronograma-prazo">Conforme cronograma da obra</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- SEÇÃO 10: TERMO DE ACEITE -->
    <div class="secao">
      <div class="secao-header">
        <div class="secao-numero">10</div>
        <h2 class="secao-titulo">Termo de Aceite</h2>
      </div>
      <div class="secao-conteudo">
        <div class="termo-box">
          <p class="termo-texto">
            Eu, <strong>${dados.nomeCliente}</strong>, declaro que recebi e li atentamente esta proposta comercial referente ao imóvel 
            ${dados.unidade ? `unidade ${dados.unidade} do ` : 'no '}empreendimento <strong>${dados.projeto.nome}</strong>, 
            no valor de <strong>${formatCurrency(dados.valorImovel)}</strong>.
            <br><br>
            Declaro estar ciente de todas as condições apresentadas, incluindo valores, prazos e documentação necessária. 
            Manifesto meu interesse em dar continuidade ao processo de aquisição do imóvel nas condições aqui estabelecidas.
            <br><br>
            Esta proposta tem validade até <strong>${validadeFormatada}</strong>, após a qual os valores e condições poderão ser revisados.
          </p>
          
          <div class="termo-assinatura">
            <div class="assinatura-campo">
              <div class="assinatura-linha">
                <div class="assinatura-nome">${dados.nomeCliente}</div>
                <div class="assinatura-cargo">Cliente</div>
              </div>
            </div>
            <div class="assinatura-campo">
              <div class="assinatura-linha">
                <div class="assinatura-nome">${dados.corretor.name || 'Corretor'}</div>
                <div class="assinatura-cargo">Corretor${dados.corretor.creci ? ` - CRECI ${dados.corretor.creci}` : ''}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- RODAPÉ -->
    <div class="rodape">
      <div class="rodape-corretor">
        ${dados.corretor.fotoUrl ? `<img src="${dados.corretor.fotoUrl}" alt="${dados.corretor.name}" class="corretor-foto">` : ''}
        <div class="corretor-info">
          <div class="corretor-nome">${dados.corretor.name || 'Corretor'}</div>
          <div>${dados.corretor.telefone || ''} ${dados.corretor.email ? '• ' + dados.corretor.email : ''}</div>
        </div>
      </div>
      <div>
        Proposta #${dados.id} • ${dataAtual}
      </div>
    </div>
  </div>
</body>
</html>
`;
}
