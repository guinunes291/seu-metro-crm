import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";

// ============================================================================
// HELPERS E MIDDLEWARES
// ============================================================================
function isGestorLevel(role: string): boolean {
  return role === 'gestor' || role === 'admin' || role === 'superintendente';
}
function isAdminLevel(role: string): boolean {
  return role === 'admin' || role === 'superintendente';
}
const corretorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'corretor' && !isGestorLevel(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
  }
  return next({ ctx });
});
const gestorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isGestorLevel(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas gestores podem acessar' });
  }
  return next({ ctx });
});

// ============================================================================
// ROUTER DE PROPOSTAS
// ============================================================================
export const propostasRouter = router({
    // Criar proposta
    create: corretorProcedure
      .input(z.object({
        leadId: z.number(),
        projectId: z.number(),
        nomeCliente: z.string(),
        emailCliente: z.string().optional(),
        telefoneCliente: z.string().optional(),
        unidade: z.string().optional(),
        tipologia: z.string().optional(),
        metragem: z.number().optional(),
        valorImovel: z.number(),
        valorEntrada: z.number().optional(),
        valorFinanciamento: z.number().optional(),
        parcelas: z.number().optional(),
        valorParcela: z.number().optional(),
        taxaJuros: z.string().optional(),
        desconto: z.number().optional(),
        motivoDesconto: z.string().optional(),
        mensagemPersonalizada: z.string().optional(),
        imagensSelecionadas: z.array(z.string()).optional(),
        plantasSelecionadas: z.array(z.string()).optional(),
        videos: z.array(z.string()).optional(),
        validoAte: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createProposta({
          ...input,
          corretorId: ctx.user.id,
          imagensSelecionadas: input.imagensSelecionadas ? JSON.stringify(input.imagensSelecionadas) : undefined,
          plantasSelecionadas: input.plantasSelecionadas ? JSON.stringify(input.plantasSelecionadas) : undefined,
          videos: input.videos ? JSON.stringify(input.videos) : undefined,
          validoAte: input.validoAte ? new Date(input.validoAte) : undefined,
          token: '' // Será gerado no db
        });
      }),
    
    // Listar propostas do corretor
    list: corretorProcedure
      .query(async ({ ctx }) => {
        return await db.getPropostasCorretor(ctx.user.id);
      }),
    
    // Listar todas (gestor)
    listAll: gestorProcedure
      .input(z.object({
        corretorId: z.number().optional(),
        projectId: z.number().optional(),
        status: z.string().optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional()
      }).optional())
      .query(async ({ input }) => {
        return await db.getAllPropostas({
          corretorId: input?.corretorId,
          projectId: input?.projectId,
          status: input?.status,
          dataInicio: input?.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input?.dataFim ? new Date(input.dataFim) : undefined
        });
      }),
    
    // Buscar por ID
    getById: corretorProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const proposta = await db.getPropostaById(input.id);
        if (!proposta) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposta não encontrada' });
        }
        // Verificar permissão
        if (ctx.user.role === 'corretor' && proposta.corretorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
        }
        return proposta;
      }),
    
    // Buscar por token (público - para cliente visualizar)
    getByToken: publicProcedure
      .input(z.object({ 
        token: z.string(),
        visitorId: z.string().optional() // ID único do visitante (gerado no frontend)
      }))
      .query(async ({ input }) => {
        const proposta = await db.getPropostaByToken(input.token);
        if (!proposta) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposta não encontrada' });
        }
        
        // Registrar visualização apenas se tiver visitorId (evita contagem duplicada)
        if (input.visitorId) {
          await db.registrarVisualizacaoProposta(input.token, input.visitorId);
        }
        
        // Buscar dados do projeto e corretor
        const projeto = await db.getProjectById(proposta.projectId);
        const corretor = await db.getUserById(proposta.corretorId);
        
        return {
          ...proposta,
          projeto,
          corretor: corretor ? { name: corretor.name, telefone: corretor.telefone, email: corretor.email, fotoUrl: corretor.fotoUrl } : null
        };
      }),
    
    // Atualizar proposta
    update: corretorProcedure
      .input(z.object({
        id: z.number(),
        data: z.object({
          nomeCliente: z.string().optional(),
          emailCliente: z.string().optional(),
          telefoneCliente: z.string().optional(),
          unidade: z.string().optional(),
          tipologia: z.string().optional(),
          metragem: z.number().optional(),
          valorImovel: z.number().optional(),
          valorEntrada: z.number().optional(),
          valorFinanciamento: z.number().optional(),
          parcelas: z.number().optional(),
          valorParcela: z.number().optional(),
          taxaJuros: z.string().optional(),
          desconto: z.number().optional(),
          motivoDesconto: z.string().optional(),
          mensagemPersonalizada: z.string().optional(),
          tabelaPagamento: z.string().optional(),
          imagensSelecionadas: z.array(z.string()).optional(),
          plantasSelecionadas: z.array(z.string()).optional(),
          videos: z.array(z.string()).optional(),
          validoAte: z.string().optional(),
          status: z.enum(['rascunho', 'enviada', 'visualizada', 'aceita', 'recusada', 'expirada']).optional()
        })
      }))
      .mutation(async ({ ctx, input }) => {
        const proposta = await db.getPropostaById(input.id);
        if (!proposta) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposta não encontrada' });
        }
        if (ctx.user.role === 'corretor' && proposta.corretorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
        }
        
        return await db.updateProposta(input.id, {
          ...input.data,
          imagensSelecionadas: input.data.imagensSelecionadas ? JSON.stringify(input.data.imagensSelecionadas) : undefined,
          plantasSelecionadas: input.data.plantasSelecionadas ? JSON.stringify(input.data.plantasSelecionadas) : undefined,
          videos: input.data.videos ? JSON.stringify(input.data.videos) : undefined,
          validoAte: input.data.validoAte ? new Date(input.data.validoAte) : undefined
        });
      }),
    
    // Enviar proposta (mudar status para enviada)
    enviar: corretorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const proposta = await db.getPropostaById(input.id);
        if (!proposta) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposta não encontrada' });
        }
        if (ctx.user.role === 'corretor' && proposta.corretorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
        }
        
        return await db.updateProposta(input.id, { status: 'enviada' });
      }),
    
    // Aceitar proposta (cliente)
    aceitar: publicProcedure
      .input(z.object({
        token: z.string(),
        assinatura: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const ip = ctx.req.headers['x-forwarded-for'] as string || ctx.req.socket.remoteAddress || '';
        return await db.registrarAceiteProposta(input.token, ip, input.assinatura);
      }),
    
    // Buscar propostas do lead
    getByLead: corretorProcedure
      .input(z.object({ leadId: z.number() }))
      .query(async ({ input }) => {
        return await db.getPropostasLead(input.leadId);
      }),
    
    // Extrair dados do PDF de simulação usando LLM
    extrairDadosPdf: corretorProcedure
      .input(z.object({
        pdfBase64: z.string(),
        nomeArquivo: z.string()
      }))
      .mutation(async ({ input }) => {
        try {
          // Converter PDF base64 para texto usando o LLM com capacidade de leitura de PDF
          const promptExtracao = `
Você é um especialista em extrair dados de PDFs de simulação de financiamento imobiliário.

Analise o conteúdo do PDF anexado e extraia os seguintes dados:

1. **Renda Familiar** (valor em reais)
2. **Data de Nascimento** do participante de maior idade (formato DD/MM/AAAA)
3. **Valor do Imóvel** (valor em reais)
4. **Valor do Financiamento** (valor em reais)
5. **Prazo** em meses
6. **Primeira Prestação** (valor em reais)
7. **Juros Efetivos** (percentual anual, ex: "7,93% a.a.")
8. **Valor de Entrada** (valor em reais)

O PDF pode ser de dois formatos:
- **Portal CRM (Caixa)**: Campos como "Renda Familiar", "Valor de Financiamento", "Primeira Prestação", "Juros Efetivos"
- **Simulador Habitacional CAIXA**: Campos como "Renda bruta familiar", "Valor do financiamento", "1ª Prestação", "Juros Efetivos"

Retorne APENAS um JSON válido no seguinte formato (sem markdown, sem explicações):
{
  "rendaFamiliar": 8000,
  "dataNascimento": "11/09/1969",
  "valorImovel": 350000,
  "valorFinanciamento": 269212.65,
  "prazoMeses": 254,
  "primeiraPrestacao": 2399.99,
  "jurosEfetivos": "7,93% a.a.",
  "valorEntrada": 80787.35,
  "origemPdf": "portal_crm"
}

NOTA: Todos os valores monetários devem ser em REAIS (não centavos). Exemplo: R$ 350.000,00 = 350000.
O campo "origemPdf" deve ser "portal_crm" ou "simulador_caixa" dependendo do formato identificado.
`;

          const response = await invokeLLM({
            messages: [
              { role: "system", content: promptExtracao },
              { 
                role: "user", 
                content: [
                  {
                    type: "file_url",
                    file_url: {
                      url: `data:application/pdf;base64,${input.pdfBase64}`,
                      mime_type: "application/pdf"
                    }
                  },
                  {
                    type: "text",
                    text: `Extraia os dados do PDF de simulação: ${input.nomeArquivo}`
                  }
                ]
              }
            ]
          });

          const content = response.choices[0]?.message?.content || '';
          
          // Tentar extrair JSON da resposta
          let jsonStr = content;
          
          // Remover possíveis marcadores de código
          if (content.includes('```json')) {
            jsonStr = content.split('```json')[1].split('```')[0].trim();
          } else if (content.includes('```')) {
            jsonStr = content.split('```')[1].split('```')[0].trim();
          }
          
          const dados = JSON.parse(jsonStr);
          
          // Validar campos obrigatórios
          if (!dados.valorImovel || !dados.valorFinanciamento) {
            throw new Error('Não foi possível extrair os dados obrigatórios do PDF');
          }
          
          return {
            rendaFamiliar: dados.rendaFamiliar || 0,
            dataNascimento: dados.dataNascimento || '',
            valorImovel: dados.valorImovel || 0,
            valorFinanciamento: dados.valorFinanciamento || 0,
            prazoMeses: dados.prazoMeses || 0,
            primeiraPrestacao: dados.primeiraPrestacao || 0,
            jurosEfetivos: dados.jurosEfetivos || '',
            valorEntrada: dados.valorEntrada || 0,
            origemPdf: dados.origemPdf || 'desconhecido'
          };
        } catch (error: any) {
          console.error('Erro ao extrair dados do PDF:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Erro ao processar PDF: ${error.message}`
          });
        }
      }),
    
    // Excluir proposta
    delete: corretorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const proposta = await db.getPropostaById(input.id);
        if (!proposta) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposta não encontrada' });
        }
        if (ctx.user.role === 'corretor' && proposta.corretorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para excluir esta proposta' });
        }
        
        // Excluir a proposta
        await db.deleteProposta(input.id);
        return { success: true };
      }),
    
    // Upload de Book PDF
    uploadBook: corretorProcedure
      .input(z.object({
        fileData: z.string(), // base64 data
        fileName: z.string(),
        contentType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { storagePut } = await import('../storage');
        
        // Validar tipo de arquivo
        if (input.contentType !== 'application/pdf') {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'Tipo de arquivo não permitido. Use PDF.' 
          });
        }
        
        // Converter base64 para buffer
        const buffer = Buffer.from(input.fileData, 'base64');
        
        // Validar tamanho (máx 50MB)
        const maxSize = 50 * 1024 * 1024;
        if (buffer.length > maxSize) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'Arquivo muito grande. Máximo permitido: 50MB.' 
          });
        }
        
        // Gerar nome único para o arquivo
        const uniqueFileName = `propostas/books/${ctx.user.id}/${Date.now()}-${input.fileName}`;
        
        try {
          const { url } = await storagePut(uniqueFileName, buffer, input.contentType);
          return { success: true, url };
        } catch (storageError: any) {
          console.error('Erro no upload para S3:', storageError);
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: 'Erro ao salvar o arquivo. Por favor, tente novamente.' 
          });
        }
      }),
    
    // Upload direto do Book PDF para S3 (suporta chunks para arquivos grandes)
    uploadBookDireto: corretorProcedure
      .input(z.object({
        fileData: z.string(), // base64 data (chunk ou arquivo completo)
        fileName: z.string(),
        fileSize: z.number(),
        chunkIndex: z.number().optional(),
        totalChunks: z.number().optional(),
        uploadId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { storagePut, storageGet } = await import('../storage');
        
        // Se não tem chunks, é upload direto de arquivo pequeno
        if (!input.chunkIndex && !input.totalChunks) {
          const buffer = Buffer.from(input.fileData, 'base64');
          
          // Validar tamanho (máx 50MB)
          const maxSize = 50 * 1024 * 1024;
          if (buffer.length > maxSize) {
            throw new TRPCError({ 
              code: 'BAD_REQUEST', 
              message: 'Arquivo muito grande. Máximo permitido: 50MB.' 
            });
          }
          
          const uniqueFileName = `propostas/books/${ctx.user.id}/${Date.now()}-${input.fileName}`;
          const { url: bookUrl } = await storagePut(uniqueFileName, buffer, 'application/pdf');
          
          console.log(`[uploadBookDireto] Book salvo em: ${bookUrl}`);
          
          return {
            success: true,
            bookUrl,
            isComplete: true
          };
        }
        
        // Upload em chunks
        const { chunkIndex, totalChunks, uploadId } = input;
        
        if (chunkIndex === undefined || totalChunks === undefined || !uploadId) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'Parâmetros de chunk inválidos.' 
          });
        }
        
        const buffer = Buffer.from(input.fileData, 'base64');
        
        // Salvar chunk temporário
        const chunkKey = `propostas/books-temp/${ctx.user.id}/${uploadId}/chunk-${chunkIndex}`;
        await storagePut(chunkKey, buffer, 'application/octet-stream');
        
        console.log(`[uploadBookDireto] Chunk ${chunkIndex + 1}/${totalChunks} salvo`);
        
        // Se é o último chunk, combinar todos
        if (chunkIndex === totalChunks - 1) {
          const chunks: Buffer[] = [];
          
          for (let i = 0; i < totalChunks; i++) {
            const chunkKeyToRead = `propostas/books-temp/${ctx.user.id}/${uploadId}/chunk-${i}`;
            try {
              // Buscar URL do chunk
              const { url: chunkUrl } = await storageGet(chunkKeyToRead);
              // Baixar o chunk
              const response = await fetch(chunkUrl);
              const arrayBuffer = await response.arrayBuffer();
              chunks.push(Buffer.from(arrayBuffer));
            } catch (e) {
              console.error(`Erro ao ler chunk ${i}:`, e);
            }
          }
          
          // Combinar chunks
          const completeBuffer = Buffer.concat(chunks);
          
          // Salvar arquivo completo
          const uniqueFileName = `propostas/books/${ctx.user.id}/${Date.now()}-${input.fileName}`;
          const { url: bookUrl } = await storagePut(uniqueFileName, completeBuffer, 'application/pdf');
          
          console.log(`[uploadBookDireto] Book completo salvo em: ${bookUrl} (${completeBuffer.length} bytes)`);
          
          return {
            success: true,
            bookUrl,
            isComplete: true
          };
        }
        
        return {
          success: true,
          isComplete: false,
          chunkIndex
        };
      }),
    
    // Processar Book PDF já salvo no S3 (por URL)
    processarBookPorUrl: corretorProcedure
      .input(z.object({
        bookUrl: z.string(),
        projetoNome: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { storagePut } = await import('../storage');
        const { extrairImagensDoBook, selecionarMelhoresImagens } = await import('../bookExtractor');
        
        console.log(`[processarBookPorUrl] Processando: ${input.bookUrl}`);
        
        try {
          // Baixar o PDF do S3
          const response = await fetch(input.bookUrl);
          if (!response.ok) {
            throw new Error(`Erro ao baixar PDF: ${response.status}`);
          }
          
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          console.log(`[processarBookPorUrl] PDF baixado: ${buffer.length} bytes`);
          
          // Extrair imagens do PDF
          const resultado = await extrairImagensDoBook(buffer, ctx.user.id, input.projetoNome);
          
          if (!resultado.sucesso) {
            console.error('[processarBookPorUrl] Erro na extração:', resultado.erro);
            return {
              success: true,
              imagens: [],
              totalPaginas: 0,
              erro: resultado.erro
            };
          }
          
          // Selecionar as melhores imagens
          const melhoresImagens = selecionarMelhoresImagens(resultado.imagens);
          
          return {
            success: true,
            imagens: resultado.imagens,
            melhoresImagens,
            totalPaginas: resultado.totalPaginas
          };
        } catch (error: any) {
          console.error('[processarBookPorUrl] Erro:', error);
          return {
            success: false,
            imagens: [],
            totalPaginas: 0,
            erro: error.message || 'Erro ao processar PDF'
          };
        }
      }),
    
    // Processar Book PDF e extrair imagens automaticamente (mantido para compatibilidade)
    processarBook: corretorProcedure
      .input(z.object({
        fileData: z.string(), // base64 data
        fileName: z.string(),
        projetoNome: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { storagePut } = await import('../storage');
        const { extrairImagensDoBook, selecionarMelhoresImagens } = await import('../bookExtractor');
        
        // Converter base64 para buffer
        const buffer = Buffer.from(input.fileData, 'base64');
        
        // Validar tamanho (máx 50MB)
        const maxSize = 50 * 1024 * 1024;
        if (buffer.length > maxSize) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'Arquivo muito grande. Máximo permitido: 50MB.' 
          });
        }
        
        // Primeiro, fazer upload do PDF completo
        const uniqueFileName = `propostas/books/${ctx.user.id}/${Date.now()}-${input.fileName}`;
        const { url: bookUrl } = await storagePut(uniqueFileName, buffer, 'application/pdf');
        
        console.log(`[processarBook] Book salvo em: ${bookUrl}`);
        
        // Extrair imagens do PDF usando IA
        const resultado = await extrairImagensDoBook(buffer, ctx.user.id, input.projetoNome);
        
        if (!resultado.sucesso) {
          console.error('[processarBook] Erro na extração:', resultado.erro);
          // Retornar apenas o URL do book sem imagens extraídas
          return {
            success: true,
            bookUrl,
            imagens: [],
            totalPaginas: 0,
            erro: resultado.erro
          };
        }
        
        // Selecionar as melhores imagens
        const melhoresImagens = selecionarMelhoresImagens(resultado.imagens);
        
        return {
          success: true,
          bookUrl,
          imagens: resultado.imagens,
          melhoresImagens,
          totalPaginas: resultado.totalPaginas
        };
      }),
    
    // Upload de Planta (imagem)
    uploadPlanta: corretorProcedure
      .input(z.object({
        fileData: z.string(), // base64 data
        fileName: z.string(),
        contentType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { storagePut } = await import('../storage');
        
        // Validar tipo de arquivo
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(input.contentType)) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'Tipo de arquivo não permitido. Use JPEG, PNG, GIF ou WebP.' 
          });
        }
        
        // Converter base64 para buffer
        const buffer = Buffer.from(input.fileData, 'base64');
        
        // Validar tamanho (máx 10MB)
        const maxSize = 10 * 1024 * 1024;
        if (buffer.length > maxSize) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'Arquivo muito grande. Máximo permitido: 10MB.' 
          });
        }
        
        // Gerar nome único para o arquivo
        const ext = input.fileName.split('.').pop() || 'jpg';
        const uniqueFileName = `propostas/plantas/${ctx.user.id}/${Date.now()}.${ext}`;
        
        try {
          const { url } = await storagePut(uniqueFileName, buffer, input.contentType);
          return { success: true, url };
        } catch (storageError: any) {
          console.error('Erro no upload para S3:', storageError);
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: 'Erro ao salvar o arquivo. Por favor, tente novamente.' 
          });
        }
      }),
    
    // Extrair imagens do Book PDF usando LLM
    extrairImagensBook: corretorProcedure
      .input(z.object({
        pdfUrl: z.string(),
        maxImagens: z.number().optional().default(4)
      }))
      .mutation(async ({ input }) => {
        try {
          const promptExtracao = `
Você é um especialista em analisar PDFs de apresentação de empreendimentos imobiliários (Books).

Analise o PDF anexado e identifique as melhores imagens de perspectiva do empreendimento.
Busque por:
1. Fachada do prédio/empreendimento
2. Áreas de lazer (piscina, churrasqueira, playground, academia)
3. Imagens internas de apartamentos decorados
4. Plantas baixas

Para cada imagem encontrada, retorne:
- url: URL da imagem (se disponível no PDF) ou descrição detalhada
- descricao: Descrição breve da imagem
- tipo: "fachada", "lazer", "interior" ou "planta"

Retorne APENAS um JSON válido no seguinte formato (sem markdown, sem explicações):
{
  "imagens": [
    { "url": "descrição_da_imagem_1", "descricao": "Fachada principal do empreendimento", "tipo": "fachada" },
    { "url": "descrição_da_imagem_2", "descricao": "Área de lazer com piscina", "tipo": "lazer" }
  ]
}

Limite: máximo ${input.maxImagens} imagens mais relevantes.
`;

          const response = await invokeLLM({
            messages: [
              { role: "system", content: promptExtracao },
              { 
                role: "user", 
                content: [
                  {
                    type: "file_url",
                    file_url: {
                      url: input.pdfUrl,
                      mime_type: "application/pdf"
                    }
                  },
                  {
                    type: "text",
                    text: `Analise este Book e extraia as ${input.maxImagens} melhores imagens de perspectiva.`
                  }
                ]
              }
            ]
          });

          const content = response.choices[0]?.message?.content || '';
          
          // Tentar extrair JSON da resposta
          let jsonStr = content;
          if (content.includes('```json')) {
            jsonStr = content.split('```json')[1].split('```')[0].trim();
          } else if (content.includes('```')) {
            jsonStr = content.split('```')[1].split('```')[0].trim();
          }
          
          const dados = JSON.parse(jsonStr);
          
          // Como não temos acesso direto às imagens do PDF, vamos retornar placeholders
          // Na prática, você precisaria de uma biblioteca como pdf-lib ou pdfjs para extrair imagens
          const imagensPlaceholder = (dados.imagens || []).map((img: any, idx: number) => ({
            url: `https://placehold.co/600x400/1e293b/f59e0b?text=${encodeURIComponent(img.tipo || 'Imagem ' + (idx + 1))}`,
            descricao: img.descricao || `Imagem ${idx + 1} do Book`,
            tipo: img.tipo || 'outro'
          }));
          
          return { imagens: imagensPlaceholder };
        } catch (error: any) {
          console.error('Erro ao extrair imagens do Book:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Erro ao processar Book: ${error.message}`
          });
        }
      }),
    
    // Gerar PDF da proposta
    gerarPDF: corretorProcedure
      .input(z.object({
        propostaId: z.number()
      }))
      .mutation(async ({ ctx, input }) => {
        // Buscar dados completos da proposta
        const proposta = await db.getPropostaById(input.propostaId);
        if (!proposta) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposta não encontrada' });
        }
        
        // Verificar se o corretor tem acesso à proposta
        if (proposta.corretorId !== ctx.user.id && !isGestorLevel(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para acessar esta proposta' });
        }
        
        // Buscar dados do projeto
        const projeto = await db.getProjectById(proposta.projectId);
        if (!projeto) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Projeto não encontrado' });
        }
        
        // Buscar dados do corretor
        const corretor = await db.getUserById(proposta.corretorId);
        
        // Importar gerador de PDF e storage
        const { gerarHTMLProposta } = await import('../pdfGenerator');
        const { storagePut } = await import('../storage');
        type DadosProposta = import('../pdfGenerator').DadosProposta;
        
        // Preparar dados para o PDF
        const dadosPDF: DadosProposta = {
          id: proposta.id,
          token: proposta.token,
          nomeCliente: proposta.nomeCliente,
          emailCliente: proposta.emailCliente || undefined,
          telefoneCliente: proposta.telefoneCliente || undefined,
          unidade: proposta.unidade || undefined,
          tipologia: proposta.tipologia || undefined,
          metragem: proposta.metragem || undefined,
          valorImovel: proposta.valorImovel,
          valorEntrada: proposta.valorEntrada || undefined,
          valorFinanciamento: proposta.valorFinanciamento || undefined,
          parcelas: proposta.parcelas || undefined,
          valorParcela: proposta.valorParcela || undefined,
          taxaJuros: proposta.taxaJuros || undefined,
          desconto: proposta.desconto || undefined,
          motivoDesconto: proposta.motivoDesconto || undefined,
          mensagemPersonalizada: proposta.mensagemPersonalizada || undefined,
          imagensSelecionadas: proposta.imagensSelecionadas ? JSON.parse(proposta.imagensSelecionadas) : undefined,
          plantasSelecionadas: proposta.plantasSelecionadas ? JSON.parse(proposta.plantasSelecionadas) : undefined,
          tabelaPagamento: proposta.tabelaPagamento ? JSON.parse(proposta.tabelaPagamento) : undefined,
          validoAte: proposta.validoAte || undefined,
          projeto: {
            nome: projeto.nome,
            construtora: projeto.construtora || undefined,
            endereco: projeto.endereco || undefined,
            bairro: projeto.bairro || undefined,
            cidade: projeto.cidade,
            estado: projeto.estado,
            descricao: projeto.descricao || undefined,
            tipo: projeto.tipo,
            imagemPrincipal: projeto.imagemPrincipal || undefined,
            logoUrl: projeto.logoUrl || undefined,
            zona: projeto.zona || undefined,
            enquadramento: projeto.enquadramento || undefined
          },
          corretor: {
            name: corretor?.name || undefined,
            email: corretor?.email || undefined,
            telefone: corretor?.telefone || undefined,
            fotoUrl: corretor?.fotoUrl || undefined,
            creci: corretor?.creci || undefined
          },
          createdAt: proposta.createdAt
        };
        
        // Gerar HTML
        const html = gerarHTMLProposta(dadosPDF);
        
        // Converter HTML para PDF usando o serviço interno
        // Por enquanto, vamos retornar o HTML para preview
        // Em produção, usar puppeteer ou similar para gerar PDF
        
        // Salvar HTML no S3 como arquivo temporário
        const htmlFileName = `propostas/pdf/${proposta.id}-${Date.now()}.html`;
        const { url: htmlUrl } = await storagePut(htmlFileName, Buffer.from(html), 'text/html');
        
        return {
          success: true,
          htmlUrl,
          propostaId: proposta.id,
          nomeCliente: proposta.nomeCliente,
          projeto: projeto.nome
        };
      }),
});
