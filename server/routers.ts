import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";

import * as sheetsImport from "./sheetsImport";
import { listSheetTabs, validateSheetAccess, extractSpreadsheetId } from "./googleSheets";

// ============================================================================
// HELPERS E MIDDLEWARES
// ============================================================================

const corretorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'corretor' && ctx.user.role !== 'gestor' && ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
  }
  return next({ ctx });
});

const gestorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'gestor' && ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas gestores podem acessar' });
  }
  return next({ ctx });
});

// ============================================================================
// ROUTER PRINCIPAL
// ============================================================================

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============================================================================
  // PROJETOS (EMPREENDIMENTOS)
  // ============================================================================
  
  projects: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllProjects();
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getProjectById(input.id);
      }),
    
    create: gestorProcedure
      .input(z.object({
        nome: z.string(),
        construtora: z.string().optional(),
        endereco: z.string().optional(),
        bairro: z.string().optional(),
        cidade: z.string().default("São Paulo"),
        estado: z.string().default("SP"),
        descricao: z.string().optional(),
        tipo: z.enum(["mcmv", "sfh", "outro"]).default("mcmv"),
        status: z.enum(["ativo", "inativo", "esgotado"]).default("ativo"),
        valorMinimo: z.number().optional(),
        valorMaximo: z.number().optional(),
        metragemMinima: z.number().optional(),
        metragemMaxima: z.number().optional(),
        dormitorios: z.string().optional(),
        vagas: z.number().default(0),
        zona: z.enum(["norte", "sul", "leste", "oeste", "centro"]).optional(),
        enquadramento: z.enum(["HIS1", "HIS2", "HMP", "R2V"]).optional(),
        developer: z.string().optional(),
        imagemPrincipal: z.string().optional(),
        imagensAdicionais: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createProject(input);
      }),
    
    update: gestorProcedure
      .input(z.object({
        id: z.number(),
        data: z.object({
          nome: z.string().optional(),
          construtora: z.string().optional(),
          endereco: z.string().optional(),
          bairro: z.string().optional(),
          cidade: z.string().optional(),
          estado: z.string().optional(),
          descricao: z.string().optional(),
          tipo: z.enum(["mcmv", "sfh", "outro"]).optional(),
          status: z.enum(["ativo", "inativo", "esgotado"]).optional(),
          valorMinimo: z.number().optional(),
          valorMaximo: z.number().optional(),
          metragemMinima: z.number().optional(),
          metragemMaxima: z.number().optional(),
          dormitorios: z.string().optional(),
          vagas: z.number().optional(),
          zona: z.enum(["norte", "sul", "leste", "oeste", "centro"]).optional(),
          enquadramento: z.enum(["HIS1", "HIS2", "HMP", "R2V"]).optional(),
          developer: z.string().optional(),
          imagemPrincipal: z.string().optional(),
          imagensAdicionais: z.string().optional(),
        })
      }))
      .mutation(async ({ input }) => {
        await db.updateProject(input.id, input.data);
        return { success: true };
      }),
    
    delete: gestorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProject(input.id);
        return { success: true };
      }),
    
    // Importação de projetos do Google Sheets
    importFromSheets: gestorProcedure
      .input(z.object({
        sheetUrl: z.string(),
        sheetName: z.string().default("GERAL"),
        syncMode: z.enum(["all", "new"]).default("new"),
      }))
      .mutation(async ({ input }) => {
        const { importProjectsFromSheet } = await import("./projectsImport");
        const result = await importProjectsFromSheet(input.sheetUrl, input.sheetName, input.syncMode);
        return result;
      }),
  }),

  // ============================================================================
  // LEADS
  // ============================================================================
  
  leads: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      // Gestor vê todos os leads
      if (ctx.user.role === 'gestor' || ctx.user.role === 'admin') {
        return await db.getAllLeads();
      }
      // Corretor vê apenas seus leads
      return await db.getLeadsByCorretor(ctx.user.id);
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const lead = await db.getLeadById(input.id);
        
        if (!lead) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
        }
        
        // Corretor só pode ver seus próprios leads
        if (ctx.user.role === 'corretor' && lead.corretorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
        }
        
        return lead;
      }),
    
    create: gestorProcedure
      .input(z.object({
        idPrincipal: z.string().optional(),
        nome: z.string(),
        email: z.string().email().optional(),
        telefone: z.string(),
        origem: z.string().optional(),
        projectId: z.number().optional(),
        corretorId: z.number().optional(),
        status: z.enum([
          "novo",
          "aguardando_atendimento",
          "em_atendimento",
          "agendado",
          "visita_realizada",
          "analise_credito",
          "contrato_fechado",
          "perdido"
        ]).default("novo"),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createLead(input);
      }),
    
    // Corretor pode criar lead vinculado a si mesmo
    createByCorretor: corretorProcedure
      .input(z.object({
        nome: z.string(),
        email: z.string().email().optional(),
        telefone: z.string(),
        origem: z.enum(["facebook", "instagram", "google", "site", "indicacao", "outro"]).default("indicacao"),
        projectId: z.number().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.createLead({
          ...input,
          corretorId: ctx.user.id, // Vincula ao corretor logado
          status: "em_atendimento", // Já começa em atendimento
        });
      }),
    
    update: corretorProcedure
      .input(z.object({
        id: z.number(),
        data: z.object({
          nome: z.string().optional(),
          email: z.string().email().optional(),
          telefone: z.string().optional(),
          origem: z.string().optional(),
          projectId: z.number().optional(),
          status: z.enum([
            "novo",
            "aguardando_atendimento",
            "em_atendimento",
            "agendado",
            "visita_realizada",
            "analise_credito",
            "contrato_fechado",
            "perdido"
          ]).optional(),
          observacoes: z.string().optional(),
          motivoPerdido: z.string().optional(),
          proximoFollowup: z.date().optional(),
          ultimoContato: z.date().optional(),
        })
      }))
      .mutation(async ({ input, ctx }) => {
        const lead = await db.getLeadById(input.id);
        
        if (!lead) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
        }
        
        // Corretor só pode atualizar seus próprios leads
        if (ctx.user.role === 'corretor' && lead.corretorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
        }
        
        await db.updateLead(input.id, input.data);
        return { success: true };
      }),
    
    getHistory: corretorProcedure
      .input(z.object({ leadId: z.number() }))
      .query(async ({ input, ctx }) => {
        const lead = await db.getLeadById(input.leadId);
        
        if (!lead) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
        }
        
        // Corretor só pode ver histórico dos seus leads
        if (ctx.user.role === 'corretor' && lead.corretorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
        }
        
        return await db.getLeadHistory(input.leadId);
      }),
    
    addInteraction: corretorProcedure
      .input(z.object({
        leadId: z.number(),
        tipo: z.enum(["ligacao", "whatsapp", "email", "sms", "visita", "outro"]),
        resultado: z.enum([
          "contato_realizado",
          "nao_atendeu",
          "agendamento",
          "visita_realizada",
          "proposta_enviada",
          "recusou",
          "outro"
        ]),
        observacoes: z.string().optional(),
        statusAnterior: z.string().optional(),
        statusNovo: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const lead = await db.getLeadById(input.leadId);
        
        if (!lead) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
        }
        
        // Corretor só pode adicionar interação aos seus leads
        if (ctx.user.role === 'corretor' && lead.corretorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
        }
        
        // Registrar interação
        await db.createLeadHistory({
          ...input,
          corretorId: ctx.user.id,
        });
        
        // Atualizar último contato do lead
        await db.updateLead(input.leadId, {
          ultimoContato: new Date(),
        });
        
        return { success: true };
      }),
  }),

  // ============================================================================
  // CORRETORES
  // ============================================================================
  
  corretores: router({
    list: gestorProcedure.query(async () => {
      return await db.getAllCorretores();
    }),
    
    listAll: gestorProcedure.query(async () => {
      return await db.getAllUsers();
    }),
    
    getById: gestorProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getUserById(input.id);
      }),
    
    create: gestorProcedure
      .input(z.object({
        name: z.string().min(1, "Nome é obrigatório"),
        email: z.string().email("Email é obrigatório"),
        telefone: z.string().optional(),
        status: z.enum(["presente", "ausente"]).default("ausente"),
        enviarConvite: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const resultado = await db.createCorretor(input);
        
        // Enviar convite automático se solicitado
        if (input.enviarConvite) {
          const { enviarConviteCorretor } = await import("./conviteCorretor");
          await enviarConviteCorretor(input.name, input.email);
        }
        
        return resultado;
      }),
    
    update: gestorProcedure
      .input(z.object({
        id: z.number(),
        data: z.object({
          name: z.string().optional(),
          email: z.string().email().optional(),
          telefone: z.string().optional(),
          status: z.enum(["presente", "ausente"]).optional(),
        })
      }))
      .mutation(async ({ input }) => {
        await db.updateCorretor(input.id, input.data);
        return { success: true };
      }),
    
    delete: gestorProcedure
      .input(z.object({ 
        id: z.number(),
        redistribuirLeads: z.boolean().optional().default(false)
      }))
      .mutation(async ({ input }) => {
        try {
          const result = await db.deleteCorretor(input.id, input.redistribuirLeads);
          return { 
            success: true,
            leadsRedistribuidos: result.leadsRedistribuidos
          };
        } catch (error: any) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: error.message 
          });
        }
      }),
    
    // Endpoint para contar leads de um corretor (usado antes de excluir)
    countLeads: gestorProcedure
      .input(z.object({ corretorId: z.number() }))
      .query(async ({ input }) => {
        const count = await db.countLeadsByCorretor(input.corretorId);
        return { count };
      }),
    
    updateStatus: corretorProcedure
      .input(z.object({
        status: z.enum(["presente", "ausente"])
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateUserStatus(ctx.user.id, input.status);
        return { success: true };
      }),
    
    updateStatusGestor: gestorProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["presente", "ausente"]),
      }))
      .mutation(async ({ input }) => {
        await db.updateUserStatus(input.id, input.status);
        return { success: true };
      }),
    
    getStats: corretorProcedure
      .input(z.object({
        corretorId: z.number().optional(),
        projectId: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const corretorId = input.corretorId ?? ctx.user.id;
        
        // Corretor só pode ver suas próprias stats
        if (ctx.user.role === 'corretor' && corretorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
        }
        
        return await db.getConversionStats(corretorId, input.projectId);
      }),
  }),



  // ============================================================================
  // IMPORTAÇÃO DO GOOGLE SHEETS
  // ============================================================================
  
  sheets: router({
    validateUrl: gestorProcedure
      .input(z.object({
        url: z.string().url(),
      }))
      .query(async ({ input }) => {
        try {
          const spreadsheetId = extractSpreadsheetId(input.url);
          const isValid = await validateSheetAccess(spreadsheetId);
          
          if (!isValid) {
            throw new TRPCError({ 
              code: 'BAD_REQUEST', 
              message: 'Planilha não acessível. Verifique se está com compartilhamento público.' 
            });
          }
          
          return { valid: true, spreadsheetId };
        } catch (error: any) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: error.message || 'URL inválida' 
          });
        }
      }),
    
    listTabs: gestorProcedure
      .input(z.object({
        url: z.string().url(),
      }))
      .query(async ({ input }) => {
        try {
          const spreadsheetId = extractSpreadsheetId(input.url);
          const tabs = await listSheetTabs(spreadsheetId);
          return { tabs };
        } catch (error: any) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: error.message || 'Erro ao listar abas' 
          });
        }
      }),
    
    import: gestorProcedure
      .input(z.object({
        url: z.string().url(),
        range: z.string().default("MASTER_LEADS!A:H"),
      }))
      .mutation(async ({ input }) => {
        try {
          const result = await sheetsImport.importLeadsFromSheet(input.url, input.range);
          return result;
        } catch (error: any) {
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: error.message || 'Erro ao importar leads' 
          });
        }
      }),
    
    sync: gestorProcedure
      .input(z.object({
        url: z.string().url(),
        range: z.string().default("MASTER_LEADS!A:H"),
      }))
      .mutation(async ({ input }) => {
        try {
          const result = await sheetsImport.syncLeadsFromSheet(input.url, input.range);
          return result;
        } catch (error: any) {
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: error.message || 'Erro ao sincronizar leads' 
          });
        }
      }),
    
    // Sincronização bidirecional (CRM → Sheets)
    // Sincronizar múltiplos leads em lote
    syncBatch: gestorProcedure
      .input(z.object({
        leadIds: z.array(z.number()),
      }))
      .mutation(async ({ input }) => {
        const { sincronizarLeadsEmLote } = await import("./sheetsSyncReal");
        return await sincronizarLeadsEmLote(input.leadIds);
      }),
    
    // Detectar inconsistências entre CRM e planilha
    detectInconsistencies: gestorProcedure
      .query(async () => {
        const { detectarInconsistencias } = await import("./sheetsSyncReal");
        return await detectarInconsistencias();
      }),
    
    // Corrigir todas as inconsistências automaticamente
    fixInconsistencies: gestorProcedure
      .mutation(async () => {
        const { corrigirInconsistencias } = await import("./sheetsSyncReal");
        return await corrigirInconsistencias();
      }),
    
    // Atualizar lead específico na planilha
    updateLeadInSheet: gestorProcedure
      .input(z.object({
        leadId: z.number(),
        url: z.string().url(),
        sheetName: z.string().default("Leads"),
      }))
      .mutation(async ({ input }) => {
        const { atualizarLeadNaPlanilha } = await import("./sheetsSyncReal");
        return await atualizarLeadNaPlanilha(input.leadId);
      }),
    
    // Marcar lead como distribuído na planilha
    markAsDistributed: gestorProcedure
      .input(z.object({
        leadId: z.number(),
        url: z.string().url(),
        sheetName: z.string().default("Leads"),
      }))
      .mutation(async ({ input }) => {
        const { sincronizarLeadDistribuido } = await import("./sheetsSyncReal");
        return await sincronizarLeadDistribuido(input.leadId);
      }),
  }),

  // ============================================================================
  // MENSAGENS PRONTAS
  // ============================================================================
  
  quickMessages: router({
    list: corretorProcedure.query(async ({ ctx }) => {
      return await db.getQuickMessages(ctx.user.id);
    }),
    
    create: corretorProcedure
      .input(z.object({
        titulo: z.string(),
        mensagem: z.string(),
        tipo: z.enum(["whatsapp", "email", "sms"]),
        ordem: z.number().default(0),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.createQuickMessage({
          ...input,
          corretorId: ctx.user.id,
        });
      }),
  }),

  // ============================================================================
  // DISTRIBUIÇÃO AUTOMÁTICA
  // ============================================================================
  
  distribution: router({
    // Distribuir um lead específico
    distribuirLead: gestorProcedure
      .input(z.object({ leadId: z.number() }))
      .mutation(async ({ input }) => {
        const { distribuirLeadAutomatico } = await import("./distribution");
        return await distribuirLeadAutomatico(input.leadId);
      }),

    // Distribuir todos os leads não distribuídos do gestor
    distribuirTodos: gestorProcedure
      .mutation(async () => {
        const { distribuirTodosLeadsNaoDistribuidos } = await import("./distribution");
        return await distribuirTodosLeadsNaoDistribuidos();
      }),

    // Obter estatísticas de distribuição
    getEstatisticas: gestorProcedure
      .query(async () => {
        const { getEstatisticasDistribuicao } = await import("./distribution");
        return await getEstatisticasDistribuicao();
      }),

    // Verificar se um corretor está elegível
    verificarElegibilidade: gestorProcedure
      .input(z.object({ corretorId: z.number() }))
      .query(async ({ input }) => {
        const { isCorretorElegivel, getCorretorStatus } = await import("./distribution");
        const elegivel = await isCorretorElegivel(input.corretorId);
        const status = await getCorretorStatus(input.corretorId);
        return { elegivel, status };
      }),

    // Obter histórico de distribuições
    getHistorico: gestorProcedure
      .input(z.object({ limit: z.number().default(20) }).optional())
      .query(async ({ input }) => {
        const limit = input?.limit || 20;
        return await db.getHistoricoDistribuicoes(limit);
      }),

    // Obter leads por corretor com filtros
    getLeadsPorCorretor: gestorProcedure
      .input(z.object({
        corretorId: z.number().optional(),
        status: z.enum(['novo', 'aguardando_atendimento', 'em_atendimento', 'agendado', 'visita_realizada', 'analise_credito', 'contrato_fechado', 'perdido']).optional(),
        projectId: z.number().optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getLeadsPorCorretorComFiltros(input);
      }),

    // Obter estatísticas por corretor
    getEstatisticasPorCorretor: gestorProcedure
      .query(async () => {
        return await db.getEstatisticasPorCorretor();
      }),
  }),

  // ============================================================================
  // IMPORTAÇÃO CSV
  // ============================================================================
  
  csv: router({
    // Preview do CSV (detecta delimitador e colunas)
    preview: corretorProcedure
      .input(z.object({
        content: z.string(),
      }))
      .query(async ({ input }) => {
        const { detectDelimiter, parseCSV, detectColumnMapping } = await import("./csvImport");
        
        const delimiter = detectDelimiter(input.content);
        const rows = parseCSV(input.content, delimiter);
        
        if (rows.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Arquivo CSV vazio' });
        }
        
        const headers = rows[0];
        const mapping = detectColumnMapping(headers);
        const preview = rows.slice(1, 11); // Primeiras 10 linhas de dados
        
        return {
          delimiter,
          headers,
          mapping,
          preview,
          totalRows: rows.length - 1,
        };
      }),
    
    // Importar leads do CSV
    import: corretorProcedure
      .input(z.object({
        content: z.string(),
        mapping: z.object({
          nome: z.number().optional(),
          telefone: z.number().optional(),
          email: z.number().optional(),
          origem: z.number().optional(),
          observacoes: z.number().optional(),
        }).optional(),
        delimiter: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { importLeadsFromCSV } = await import("./csvImport");
        
        const result = await importLeadsFromCSV(
          input.content,
          ctx.user.id,
          input.mapping,
          input.delimiter
        );
        
        return result;
      }),
  }),

  // ============================================================================
  // PERFORMANCE
  // ============================================================================
  
  performance: router({
    // Métricas individuais do corretor
    minhas: corretorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const { calcularPerformanceCorretor } = await import("./performance");
        const periodo = input ? {
          dataInicio: input.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input.dataFim ? new Date(input.dataFim) : undefined,
        } : undefined;
        return await calcularPerformanceCorretor(ctx.user.id, periodo);
      }),
    
    // Ranking de todos os corretores
    ranking: corretorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { calcularRankingCorretores } = await import("./performance");
        const periodo = input ? {
          dataInicio: input.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input.dataFim ? new Date(input.dataFim) : undefined,
        } : undefined;
        return await calcularRankingCorretores(periodo);
      }),
  }),

  // ============================================================================
  // RELATÓRIOS
  // ============================================================================
  
  relatorios: router({
    // Estatísticas gerais do CRM
    estatisticasGerais: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { calcularEstatisticasGerais } = await import("./relatorios");
        const periodo = input ? {
          dataInicio: input.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input.dataFim ? new Date(input.dataFim) : undefined,
        } : undefined;
        return await calcularEstatisticasGerais(periodo);
      }),
    
    // Conversão por projeto
    conversaoPorProjeto: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { calcularConversaoPorProjeto } = await import("./relatorios");
        const periodo = input ? {
          dataInicio: input.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input.dataFim ? new Date(input.dataFim) : undefined,
        } : undefined;
        return await calcularConversaoPorProjeto(periodo);
      }),
    
    // Conversão por corretor
    conversaoPorCorretor: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { calcularConversaoPorCorretor } = await import("./relatorios");
        const periodo = input ? {
          dataInicio: input.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input.dataFim ? new Date(input.dataFim) : undefined,
        } : undefined;
        return await calcularConversaoPorCorretor(periodo);
      }),
  }),

  // ============================================================================
  // DASHBOARD DO GESTOR
  // ============================================================================
  dashboard: router({
    // Métricas gerais do dashboard
    metrics: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const filtros = input ? {
          dataInicio: input.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input.dataFim ? new Date(input.dataFim) : undefined,
        } : undefined;
        return await db.getDashboardMetrics(filtros);
      }),
    
    // Leads por corretor
    leadsPorCorretor: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const filtros = input ? {
          dataInicio: input.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input.dataFim ? new Date(input.dataFim) : undefined,
        } : undefined;
        return await db.getLeadsPorCorretorDashboard(filtros);
      }),
    
    // Agendamentos por corretor
    agendamentosPorCorretor: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const filtros = input ? {
          dataInicio: input.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input.dataFim ? new Date(input.dataFim) : undefined,
        } : undefined;
        return await db.getAgendamentosPorCorretor(filtros);
      }),
    
    // Visitas por corretor
    visitasPorCorretor: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const filtros = input ? {
          dataInicio: input.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input.dataFim ? new Date(input.dataFim) : undefined,
        } : undefined;
        return await db.getVisitasPorCorretor(filtros);
      }),
    
    // Vendas por corretor
    vendasPorCorretor: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const filtros = input ? {
          dataInicio: input.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input.dataFim ? new Date(input.dataFim) : undefined,
        } : undefined;
        return await db.getVendasPorCorretor(filtros);
      }),
  }),

  // ============================================================================
  // GRÁFICOS E MÉTRICAS HISTÓRICAS
  // ============================================================================
  graficos: router({
    // Métricas históricas para gráficos de linha
    historico: gestorProcedure
      .input(z.object({ dias: z.number().default(30) }).optional())
      .query(async ({ input }) => {
        return await db.getMetricasHistoricas(input?.dias || 30);
      }),
    
    // Dados do funil de vendas
    funil: gestorProcedure
      .input(z.object({ dias: z.number().default(30) }).optional())
      .query(async ({ input }) => {
        return await db.getEvolucaoFunil(input?.dias || 30);
      }),
  }),

  // ============================================================================
  // METAS POR CORRETOR
  // ============================================================================
  metas: router({
    // Criar nova meta
    create: gestorProcedure
      .input(z.object({
        corretorId: z.number(),
        mes: z.number().min(1).max(12),
        ano: z.number().min(2020).max(2100),
        metaLeads: z.number().optional(),
        metaAgendamentos: z.number().optional(),
        metaVisitas: z.number().optional(),
        metaContratos: z.number().optional(),
        metaVGV: z.number().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Verificar se já existe meta para este corretor/mês/ano
        const existente = await db.getMetaByCorretorMesAno(input.corretorId, input.mes, input.ano);
        if (existente) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Já existe uma meta para este corretor neste período' });
        }
        return await db.createMeta(input);
      }),
    
    // Atualizar meta existente
    update: gestorProcedure
      .input(z.object({
        id: z.number(),
        metaLeads: z.number().optional(),
        metaAgendamentos: z.number().optional(),
        metaVisitas: z.number().optional(),
        metaContratos: z.number().optional(),
        metaVGV: z.number().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateMeta(id, data);
        return { success: true };
      }),
    
    // Excluir meta
    delete: gestorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteMeta(input.id);
        return { success: true };
      }),
    
    // Buscar meta por corretor/mês/ano
    getByCorretorMesAno: gestorProcedure
      .input(z.object({
        corretorId: z.number(),
        mes: z.number(),
        ano: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getMetaByCorretorMesAno(input.corretorId, input.mes, input.ano);
      }),
    
    // Buscar todas as metas do mês
    getDoMes: gestorProcedure
      .input(z.object({
        mes: z.number(),
        ano: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getMetasDoMes(input.mes, input.ano);
      }),
    
    // Buscar metas de um corretor
    getDoCorretor: corretorProcedure
      .input(z.object({ corretorId: z.number() }))
      .query(async ({ input }) => {
        return await db.getMetasDoCorretor(input.corretorId);
      }),
    
    // Buscar progresso de uma meta
    getProgresso: corretorProcedure
      .input(z.object({
        corretorId: z.number(),
        mes: z.number(),
        ano: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getProgressoMeta(input.corretorId, input.mes, input.ano);
      }),
    
    // Buscar progresso de todos os corretores
    getProgressoTodos: gestorProcedure
      .input(z.object({
        mes: z.number(),
        ano: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getProgressoMetasTodosCorretores(input.mes, input.ano);
      }),
  }),

  // ============================================================================
  // RANKING E PERFORMANCE AVANÇADA
  // ============================================================================
  ranking: router({
    // Ranking completo de corretores com fotos
    getCompleto: corretorProcedure
      .input(z.object({
        mes: z.number().optional(),
        ano: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getRankingCorretores(input?.mes, input?.ano);
      }),
    
    // Performance individual do corretor
    getPerformance: corretorProcedure
      .input(z.object({
        corretorId: z.number(),
        mes: z.number().optional(),
        ano: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getPerformanceCorretor(input.corretorId, input.mes, input.ano);
      }),
    
    // Performance do corretor logado
    minhaPerformance: corretorProcedure
      .input(z.object({
        mes: z.number().optional(),
        ano: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getPerformanceCorretor(ctx.user.id, input?.mes, input?.ano);
      }),
  }),

  // ============================================================================
  // UPLOAD DE FOTO DE PERFIL
  // ============================================================================
  foto: router({
    // Upload de foto de perfil (recebe base64)
    upload: corretorProcedure
      .input(z.object({
        fileData: z.string(), // base64 data
        fileName: z.string(),
        contentType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { storagePut } = await import('./storage');
        
        // Validar tipo de arquivo
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(input.contentType)) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'Tipo de arquivo não permitido. Use JPEG, PNG, GIF ou WebP.' 
          });
        }
        
        // Extrair dados base64 (remover prefixo data:image/...;base64,)
        const base64Data = input.fileData.includes('base64,')
          ? input.fileData.split('base64,')[1]
          : input.fileData;
        
        // Converter base64 para buffer
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Validar tamanho (máx 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (buffer.length > maxSize) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'Arquivo muito grande. Máximo permitido: 5MB.' 
          });
        }
        
        // Gerar nome único para o arquivo
        const ext = input.fileName.split('.').pop() || 'jpg';
        const uniqueFileName = `corretores/${ctx.user.id}/foto-${Date.now()}.${ext}`;
        
        // Fazer upload para S3
        const { url } = await storagePut(uniqueFileName, buffer, input.contentType);
        
        // Atualizar URL da foto no banco
        await db.updateCorretorFoto(ctx.user.id, url);
        
        return { success: true, url };
      }),
    
    // Atualizar foto do corretor (apenas URL)
    update: corretorProcedure
      .input(z.object({
        corretorId: z.number(),
        fotoUrl: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Apenas gestor pode atualizar foto de outros
        if (ctx.user.role !== 'gestor' && ctx.user.role !== 'admin' && ctx.user.id !== input.corretorId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para atualizar foto de outro corretor' });
        }
        await db.updateCorretorFoto(input.corretorId, input.fotoUrl);
        return { success: true };
      }),
    
    // Atualizar minha foto (apenas URL)
    updateMinha: corretorProcedure
      .input(z.object({ fotoUrl: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await db.updateCorretorFoto(ctx.user.id, input.fotoUrl);
        return { success: true };
      }),
  }),

  // ============================================================================
  // NOTIFICAÇÕES
  // ============================================================================
  notifications: router({
    // Listar notificações do usuário
    list: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getNotificationsForUser(ctx.user.id, input?.limit || 50);
      }),

    // Contar notificações não lidas
    unreadCount: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getUnreadNotificationsCount(ctx.user.id);
      }),

    // Marcar notificação como lida
    markAsRead: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.markNotificationAsRead(input.notificationId, ctx.user.id);
        return { success: true };
      }),

    // Marcar todas como lidas
    markAllAsRead: protectedProcedure
      .mutation(async ({ ctx }) => {
        await db.markAllNotificationsAsRead(ctx.user.id);
        return { success: true };
      }),
    
    // Buscar novas notificações desde um timestamp (para polling)
    getNewSince: protectedProcedure
      .input(z.object({ since: z.number() })) // timestamp em ms
      .query(async ({ ctx, input }) => {
        return await db.getNewNotificationsSince(ctx.user.id, new Date(input.since));
      }),
  }),

  // ============================================================================
  // FILA DE DISTRIBUIÇÃO (ROLETA)
  // ============================================================================
  fila: router({
    // Inicializar fila com todos os corretores
    inicializar: gestorProcedure
      .mutation(async () => {
        return await db.inicializarFilaDistribuicao();
      }),
    
    // Listar fila de distribuição
    list: gestorProcedure
      .query(async () => {
        return await db.getFilaDistribuicao();
      }),
    
    // Ativar/desativar corretor na fila
    toggleAtivo: gestorProcedure
      .input(z.object({
        corretorId: z.number(),
        ativo: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        await db.toggleCorretorFila(input.corretorId, input.ativo);
        return { success: true };
      }),
    
    // Atualizar limite de leads por dia
    updateMaxLeads: gestorProcedure
      .input(z.object({
        corretorId: z.number(),
        maxLeadsDia: z.number().min(1).max(100),
      }))
      .mutation(async ({ input }) => {
        await db.atualizarMaxLeadsDia(input.corretorId, input.maxLeadsDia);
        return { success: true };
      }),
    
    // Resetar contadores diários (manual)
    resetarContadores: gestorProcedure
      .mutation(async () => {
        await db.resetarContadorLeadsDiarios();
        return { success: true };
      }),
    
    // Distribuir lead pela roleta
    distribuirLead: gestorProcedure
      .input(z.object({ leadId: z.number() }))
      .mutation(async ({ input }) => {
        const corretorId = await db.distribuirLeadPelaRoleta(input.leadId);
        return { 
          success: corretorId !== null, 
          corretorId,
          message: corretorId 
            ? 'Lead distribuído com sucesso' 
            : 'Nenhum corretor disponível para receber o lead'
        };
      }),
  }),

  // ============================================================================
  // WEBHOOK CONFIG (INTEGRAÇÕES EXTERNAS)
  // ============================================================================
  webhook: router({
    // Listar webhooks configurados
    list: gestorProcedure
      .query(async () => {
        return await db.getWebhookConfigs();
      }),
    
    // Criar novo webhook
    create: gestorProcedure
      .input(z.object({
        nome: z.string().min(3),
        fonte: z.enum(['facebook', 'instagram', 'google', 'rdstation', 'outro']).default('facebook'),
        projectIdPadrao: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createWebhookConfig(input);
      }),
    
    // Ativar/desativar webhook
    toggle: gestorProcedure
      .input(z.object({
        webhookId: z.number(),
        ativo: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        await db.toggleWebhookConfig(input.webhookId, input.ativo);
        return { success: true };
      }),
    
    // Excluir webhook
    delete: gestorProcedure
      .input(z.object({ webhookId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteWebhookConfig(input.webhookId);
        return { success: true };
      }),
  }),
  
  // ============================================================================
  // HISTÓRICO DE DISTRIBUIÇÃO
  // ============================================================================
  historicoDistribuicao: router({
    // Listar histórico de distribuições
    list: gestorProcedure
      .input(z.object({
        dataInicio: z.date().optional(),
        dataFim: z.date().optional(),
        corretorId: z.number().optional(),
        tipo: z.enum(['automatica', 'manual', 'inicial']).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ input }) => {
        return await db.getHistoricoDistribuicao(input);
      }),
    
    // Estatísticas de distribuição por período
    estatisticas: gestorProcedure
      .input(z.object({ dias: z.number().min(1).max(365).default(30) }).optional())
      .query(async ({ input }) => {
        return await db.getDistribuicoesPorPeriodo(input?.dias || 30);
      }),
  }),
});

export type AppRouter = typeof appRouter;
