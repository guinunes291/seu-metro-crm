import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";

import * as sheetsImport from "./sheetsImport";
import { listSheetTabs, validateSheetAccess, extractSpreadsheetId } from "./googleSheets";
import * as presenca from "./presenca";
import * as sheetsSync from "./googleSheetsSync";

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
    
    // Upload de book PDF (qualquer corretor pode fazer)
    uploadBook: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        bookUrl: z.string(),
      }))
      .mutation(async ({ input }) => {
        await db.updateProjectBook(input.projectId, input.bookUrl);
        return { success: true };
      }),
    
    // Sugerir novo projeto (corretor sugere, gestor aprova)
    suggest: protectedProcedure
      .input(z.object({
        nome: z.string(),
        construtora: z.string().optional(),
        endereco: z.string().optional(),
        bairro: z.string().optional(),
        cidade: z.string().default("São Paulo"),
        estado: z.string().default("SP"),
        descricao: z.string().optional(),
        tipo: z.enum(["mcmv", "sfh", "outro"]).default("mcmv"),
        valorMinimo: z.number().optional(),
        valorMaximo: z.number().optional(),
        metragemMinima: z.number().optional(),
        metragemMaxima: z.number().optional(),
        dormitorios: z.string().optional(),
        zona: z.enum(["norte", "sul", "leste", "oeste", "centro"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const suggestionId = await db.createProjectSuggestion({
          ...input,
          corretorId: ctx.user.id,
        });
        
        // Notificar gestores sobre a nova sugestão
        const gestores = await db.getGestores();
        for (const gestor of gestores) {
          await db.createNotification({
            userId: gestor.id,
            tipo: "projeto_sugerido",
            titulo: "Nova Sugestão de Projeto",
            mensagem: `${ctx.user.name} sugeriu o projeto "${input.nome}". Clique para revisar e aprovar/reprovar.`,
            dados: JSON.stringify({ suggestionId, projectName: input.nome, corretorName: ctx.user.name }),
          });
        }
        
        return { success: true, suggestionId };
      }),
    
    // Listar sugestões pendentes (apenas gestor)
    listSuggestions: gestorProcedure.query(async () => {
      return await db.getPendingProjectSuggestions();
    }),
    
    // Minhas sugestões (corretor vê suas próprias)
    mySuggestions: protectedProcedure.query(async ({ ctx }) => {
      return await db.getProjectSuggestionsByCorretor(ctx.user.id);
    }),
    
    // Aprovar sugestão (apenas gestor)
    approveSuggestion: gestorProcedure
      .input(z.object({ suggestionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const suggestion = await db.approveProjectSuggestion(input.suggestionId, ctx.user.id);
        
        // Notificar o corretor que sugeriu
        await db.createNotification({
          userId: suggestion.corretorId,
          tipo: "projeto_aprovado",
          titulo: "Projeto Aprovado!",
          mensagem: `Seu projeto "${suggestion.nome}" foi aprovado e já está disponível no sistema.`,
          dados: JSON.stringify({ projectName: suggestion.nome }),
        });
        
        return { success: true };
      }),
    
    // Reprovar sugestão (apenas gestor)
    rejectSuggestion: gestorProcedure
      .input(z.object({
        suggestionId: z.number(),
        motivo: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const suggestion = await db.getProjectSuggestionById(input.suggestionId);
        if (!suggestion) throw new Error("Sugestão não encontrada");
        
        await db.rejectProjectSuggestion(input.suggestionId, ctx.user.id, input.motivo);
        
        // Notificar o corretor que sugeriu
        await db.createNotification({
          userId: suggestion.corretorId,
          tipo: "projeto_reprovado",
          titulo: "Projeto Não Aprovado",
          mensagem: `Seu projeto "${suggestion.nome}" não foi aprovado. Motivo: ${input.motivo}`,
          dados: JSON.stringify({ projectName: suggestion.nome, motivo: input.motivo }),
        });
        
        return { success: true };
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
        
        // Registrar atividade automaticamente se o status mudou
        if (input.data.status && input.data.status !== lead.status && lead.corretorId) {
          await db.registrarAtividadePorStatus(
            lead.corretorId,
            lead.status,
            input.data.status,
            undefined // valorVenda não existe no schema
          );
        }
        
        // Se o status for "perdido", mover para lixeira e remover do corretor
        if (input.data.status === 'perdido') {
          await db.updateLead(input.id, {
            ...input.data,
            naLixeira: true,
            dataMovidoLixeira: new Date(),
            corretorAnteriorId: lead.corretorId, // Guardar quem era o corretor
            corretorId: null, // Remover do corretor
          });
          return { success: true, movedToTrash: true };
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
    
    // Excluir lead (apenas gestores)
    delete: gestorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const lead = await db.getLeadById(input.id);
        
        if (!lead) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
        }
        
        await db.deleteLead(input.id);
        return { success: true };
      }),
    
    // Excluir múltiplos leads (apenas gestores)
    deleteMany: gestorProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        let deleted = 0;
        for (const id of input.ids) {
          try {
            await db.deleteLead(id);
            deleted++;
          } catch (e) {
            // Ignorar erros individuais
          }
        }
        return { success: true, deleted };
      }),
    
    // Listar leads na lixeira (apenas gestores)
    getLixeira: gestorProcedure
      .input(z.object({
        page: z.number().default(1),
        limit: z.number().default(50),
      }).optional())
      .query(async ({ input }) => {
        return await db.getLeadsNaLixeira(input?.page || 1, input?.limit || 50);
      }),
    
    // Contar leads na lixeira
    countLixeira: gestorProcedure
      .query(async () => {
        return await db.countLeadsNaLixeira();
      }),
    
    // Exportar leads em CSV
    exportCSV: gestorProcedure
      .input(z.object({
        status: z.string().optional(),
        corretorId: z.number().optional(),
        projectId: z.number().optional(),
        naLixeira: z.boolean().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getLeadsParaExportar(input);
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
        // Novos campos
        cpf: z.string().optional(),
        dataNascimento: z.date().optional(),
        creci: z.string().optional(),
        dataCredenciamento: z.date().optional(),
        dataDescredenciamento: z.date().optional(),
        situacao: z.enum(["ativo", "inativo"]).default("ativo"),
        // Endereço
        logradouro: z.string().optional(),
        numero: z.string().optional(),
        complemento: z.string().optional(),
        bairro: z.string().optional(),
        cidade: z.string().optional(),
        estado: z.string().optional(),
        cep: z.string().optional(),
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
          // Novos campos
          cpf: z.string().optional(),
          dataNascimento: z.date().nullable().optional(),
          creci: z.string().optional(),
          dataCredenciamento: z.date().nullable().optional(),
          dataDescredenciamento: z.date().nullable().optional(),
          situacao: z.enum(["ativo", "inativo"]).optional(),
          // Endereço
          logradouro: z.string().optional(),
          numero: z.string().optional(),
          complemento: z.string().optional(),
          bairro: z.string().optional(),
          cidade: z.string().optional(),
          estado: z.string().optional(),
          cep: z.string().optional(),
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
    
    // Corretor consulta seu próprio status de presença
    meuStatus: protectedProcedure
      .query(async ({ ctx }) => {
        const user = await db.getUserById(ctx.user.id);
        // Retornar status como está no banco (presente/ausente)
        return {
          status: user?.status || 'ausente',
          name: user?.name,
        };
      }),
    
    // Corretor altera seu próprio status de presença
    alterarMeuStatus: protectedProcedure
      .input(z.object({
        status: z.enum(['ativo', 'inativo', 'presente', 'ausente'])
      }))
      .mutation(async ({ input, ctx }) => {
        // Buscar status atual
        const userAtual = await db.getUserById(ctx.user.id);
        const statusAnterior = userAtual?.status || 'ausente';
        
        // Normalizar status: ativo -> presente, inativo -> ausente
        const statusNormalizado = input.status === 'ativo' ? 'presente' : 
                                   input.status === 'inativo' ? 'ausente' : input.status;
        
        // Registrar mudança de presença no histórico
        if (statusAnterior !== statusNormalizado) {
          await presenca.registrarMudancaStatus(
            ctx.user.id,
            statusAnterior as 'presente' | 'ausente',
            statusNormalizado as 'presente' | 'ausente',
            'manual'
          );
        }
        
        await db.updateUserStatus(ctx.user.id, statusNormalizado as 'presente' | 'ausente');
        return { 
          success: true, 
          status: statusNormalizado 
        };
      }),
  }),

  // ============================================================================
  // HISTÓRICO DE PRESENÇA
  // ============================================================================
  
  presenca: router({
    // Buscar histórico de presença de um corretor
    historico: gestorProcedure
      .input(z.object({
        corretorId: z.number().optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const dataInicio = input.dataInicio ? new Date(input.dataInicio) : undefined;
        const dataFim = input.dataFim ? new Date(input.dataFim) : undefined;
        
        if (input.corretorId) {
          return await presenca.buscarHistoricoPresenca(input.corretorId, dataInicio, dataFim);
        }
        
        // Se não especificou corretor, buscar de todos
        return await presenca.buscarResumoPresenca(undefined, dataInicio, dataFim);
      }),
    
    // Buscar resumo diário de presença
    resumoDiario: gestorProcedure
      .input(z.object({
        corretorId: z.number().optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const dataInicio = input.dataInicio ? new Date(input.dataInicio) : undefined;
        const dataFim = input.dataFim ? new Date(input.dataFim) : undefined;
        
        return await presenca.buscarResumoPresenca(input.corretorId, dataInicio, dataFim);
      }),
    
    // Buscar pares de entrada/saída (cada período de presença separadamente)
    paresEntradaSaida: gestorProcedure
      .input(z.object({
        corretorId: z.number().optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const dataInicio = input.dataInicio ? new Date(input.dataInicio) : undefined;
        const dataFim = input.dataFim ? new Date(input.dataFim) : undefined;
        
        return await presenca.buscarParesEntradaSaida(input.corretorId, dataInicio, dataFim);
      }),
    
    // Calcular estatísticas de presença de um corretor
    estatisticas: gestorProcedure
      .input(z.object({
        corretorId: z.number(),
        dataInicio: z.string(),
        dataFim: z.string(),
      }))
      .query(async ({ input }) => {
        return await presenca.calcularEstatisticasPresenca(
          input.corretorId,
          new Date(input.dataInicio),
          new Date(input.dataFim)
        );
      }),
    
    // Gerar dados para gráfico de presença do time
    graficoTime: gestorProcedure
      .input(z.object({
        dataInicio: z.string(),
        dataFim: z.string(),
      }))
      .query(async ({ input }) => {
        return await presenca.gerarDadosGraficoPresenca(
          new Date(input.dataInicio),
          new Date(input.dataFim)
        );
      }),
    
    // Gerar dados para gráfico de horas por corretor
    horasPorCorretor: gestorProcedure
      .input(z.object({
        dataInicio: z.string(),
        dataFim: z.string(),
      }))
      .query(async ({ input }) => {
        return await presenca.gerarDadosHorasPorCorretor(
          new Date(input.dataInicio),
          new Date(input.dataFim)
        );
      }),
    
    // Gerar dados para heatmap de presença
    heatmap: gestorProcedure
      .input(z.object({
        corretorId: z.number(),
        dataInicio: z.string(),
        dataFim: z.string(),
      }))
      .query(async ({ input }) => {
        return await presenca.gerarDadosHeatmap(
          input.corretorId,
          new Date(input.dataInicio),
          new Date(input.dataFim)
        );
      }),
    
    // Buscar corretores que estão presentes há mais de 3h sem confirmação
    semConfirmacao: gestorProcedure
      .query(async () => {
        return await presenca.buscarCorretoresSemConfirmacao();
      }),
    
    // Gerar relatório semanal
    relatorioSemanal: gestorProcedure
      .query(async () => {
        return await presenca.gerarRelatorioSemanal();
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
    
    // Métricas do funil baseadas em transições de status
    metricasFunil: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const dataInicio = input?.dataInicio ? new Date(input.dataInicio) : undefined;
        const dataFim = input?.dataFim ? new Date(input.dataFim) : undefined;
        return await db.getMetricasFunilGeral(dataInicio, dataFim);
      }),
    
    // Métricas do funil por corretor (baseadas em transições)
    metricasFunilPorCorretor: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const dataInicio = input?.dataInicio ? new Date(input.dataInicio) : undefined;
        const dataFim = input?.dataFim ? new Date(input.dataFim) : undefined;
        return await db.getMetricasFunilTodosCorretores(dataInicio, dataFim);
      }),
    
    // Relatório detalhado de leads criados por corretor
    relatorioLeadsCriados: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const dataInicio = input?.dataInicio ? new Date(input.dataInicio) : undefined;
        const dataFim = input?.dataFim ? new Date(input.dataFim) : undefined;
        return await db.getRelatorioLeadsCriados(dataInicio, dataFim);
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
  // DASHBOARD DO CORRETOR - MÉTRICAS INDIVIDUAIS
  // ============================================================================
  dashboardCorretor: router({
    // Métricas individuais do corretor
    metrics: corretorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const filtros = input ? {
          dataInicio: input.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input.dataFim ? new Date(input.dataFim) : undefined,
        } : undefined;
        return await db.getCorretorDashboardMetrics(ctx.user.id, filtros);
      }),
    
    // Histórico de métricas do corretor para gráficos
    historico: corretorProcedure
      .input(z.object({ dias: z.number().default(30) }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getCorretorMetricasHistoricas(ctx.user.id, input?.dias || 30);
      }),
    
    // Funil de vendas individual do corretor
    funil: corretorProcedure
      .input(z.object({ dias: z.number().default(30) }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getCorretorEvolucaoFunil(ctx.user.id, input?.dias || 30);
      }),
    
    // Métricas do funil baseadas em transições (histórico real)
    metricasFunil: corretorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const dataInicio = input?.dataInicio ? new Date(input.dataInicio) : undefined;
        const dataFim = input?.dataFim ? new Date(input.dataFim) : undefined;
        return await db.getMetricasFunilCorretor(ctx.user.id, dataInicio, dataFim);
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
        
        try {
          // Fazer upload para S3
          const { url } = await storagePut(uniqueFileName, buffer, input.contentType);
          
          // Atualizar URL da foto no banco
          await db.updateCorretorFoto(ctx.user.id, url);
          
          return { success: true, url };
        } catch (storageError: any) {
          console.error('Erro no upload para S3:', storageError);
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: 'Erro ao salvar a foto. Por favor, tente novamente.' 
          });
        }
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
  // TAREFAS DO CORRETOR
  // ============================================================================
  tarefas: router({
    // Listar tarefas do corretor
    list: corretorProcedure
      .query(async ({ ctx }) => {
        return await db.getTarefasByCorretor(ctx.user.id);
      }),
    
    // Buscar tarefas do dia
    doDia: corretorProcedure
      .query(async ({ ctx }) => {
        return await db.getTarefasDoDia(ctx.user.id);
      }),
    
    // Criar tarefa
    create: corretorProcedure
      .input(z.object({
        titulo: z.string().min(1),
        descricao: z.string().optional(),
        tipo: z.enum(["follow_up", "agendamento", "ligacao", "whatsapp", "email", "visita", "documentacao", "outro"]).default("outro"),
        dataAgendada: z.date(),
        prioridade: z.enum(["baixa", "media", "alta"]).default("media"),
        leadId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createTarefa({
          ...input,
          corretorId: ctx.user.id,
        });
        return { success: true, id };
      }),
    
    // Concluir tarefa
    concluir: corretorProcedure
      .input(z.object({
        id: z.number(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.concluirTarefa(input.id, input.observacoes);
        return { success: true };
      }),
    
    // Excluir tarefa
    delete: corretorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteTarefa(input.id);
        return { success: true };
      }),
  }),

  // ============================================================================
  // FOLLOW-UPS AUTOMÁTICOS
  // ============================================================================
  followUps: router({
    // Buscar follow-ups pendentes do corretor
    pendentes: corretorProcedure
      .query(async ({ ctx }) => {
        return await db.getFollowUpsPendentes(ctx.user.id);
      }),
    
    // Buscar follow-ups do dia
    doDia: corretorProcedure
      .query(async ({ ctx }) => {
        return await db.getFollowUpsDoDia(ctx.user.id);
      }),
    
    // Registrar tentativa de contato
    registrarTentativa: corretorProcedure
      .input(z.object({
        followUpId: z.number(),
        resultado: z.enum(["nao_atendeu", "respondeu", "outro"]),
        observacao: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.registrarTentativaFollowUp(
          input.followUpId,
          input.resultado,
          input.observacao
        );
      }),
    
    // Criar follow-up para um lead
    criarParaLead: corretorProcedure
      .input(z.object({ leadId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.criarFollowUpParaLead(input.leadId, ctx.user.id);
        return { success: true, id };
      }),
  }),

  // ============================================================================
  // TAREFAS DO DIA (AGREGADO)
  // ============================================================================
  tarefasDoDia: router({
    // Buscar todas as tarefas do dia (follow-ups + agendamentos + tarefas)
    getAll: corretorProcedure
      .query(async ({ ctx }) => {
        const [followUps, tarefas, agendados] = await Promise.all([
          db.getFollowUpsDoDiaExpandido(ctx.user.id), // Usa a versão expandida que cria follow-ups automáticos
          db.getTarefasDoDia(ctx.user.id),
          db.getLeadsAgendadosHoje(ctx.user.id),
        ]);
        
        return {
          followUps,
          tarefas,
          agendados,
          total: followUps.length + tarefas.length + agendados.length,
        };
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
    
    /// Estatísticas de distribuição por período
    estatisticas: gestorProcedure
      .input(z.object({ dias: z.number().min(1).max(365).default(30) }).optional())
      .query(async ({ input }) => {
        return await db.getDistribuicoesPorPeriodo(input?.dias || 30);
      }),
  }),

  // ============================================================================
  // RANKING TV DASHBOARD E PERFORMANCE
  // ============================================================================
  ranking: router({
    // Ranking completo de corretores com fotos (para Minha Performance)
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
    
    // Ranking do dia atual
    dia: protectedProcedure
      .input(z.object({ data: z.date().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getRankingDia(input?.data);
      }),
    
    // Ranking por período (com filtro de datas)
    porPeriodo: protectedProcedure
      .input(z.object({
        dataInicio: z.date().optional(),
        dataFim: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getRankingPorPeriodo(input?.dataInicio, input?.dataFim);
      }),
    
    // Ranking semanal
    semanal: protectedProcedure
      .query(async () => {
        return await db.getRankingSemanal();
      }),
    
    // Ranking mensal
    mensal: protectedProcedure
      .query(async () => {
        return await db.getRankingMensal();
      }),
    
    // Registrar atividade manualmente
    registrarAtividade: corretorProcedure
      .input(z.object({
        tipo: z.enum([
          'ligacoesRealizadas', 'ligacoesAtendidas', 
          'whatsappEnviados', 'whatsappRespondidos',
          'agendamentosConfirmados', 'visitasRealizadas',
          'propostasEnviadas', 'documentacoesRecolhidas',
          'analiseCreditoEnviadas', 'contratosFechados'
        ]),
        quantidade: z.number().min(1).default(1),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.incrementarAtividade(ctx.user.id, input.tipo, input.quantidade);
        await db.calcularPontuacaoDiaria(ctx.user.id);
        return { success: true };
      }),
    
    // Obter atividades do corretor logado hoje
    minhasAtividades: corretorProcedure
      .query(async ({ ctx }) => {
        return await db.getOrCreateAtividadeDiaria(ctx.user.id);
      }),
    
    // Notificar todos sobre novo líder
    notifyNewLeader: protectedProcedure
      .input(z.object({ leaderName: z.string() }))
      .mutation(async ({ input }) => {
        // Buscar todos os corretores para notificar
        const corretores = await db.getAllCorretores();
        
        // Criar notificação para cada corretor
        for (const corretor of corretores) {
          await db.createNotification({
            userId: corretor.id,
            titulo: '🏆 Novo Líder no Ranking!',
            mensagem: `${input.leaderName} assumiu a liderança do ranking de produtividade! Continue trabalhando para alcançar o topo!`,
            tipo: 'sistema',
          });
        }
        
        return { success: true, notified: corretores.length };
      }),
  }),

  // ============================================================================
  // SMQ COPILOT - ASSISTENTE DE IA
  // ============================================================================
  copilot: router({
    // Chat com o Copilot
    chat: protectedProcedure
      .input(z.object({
        messages: z.array(z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string()
        })),
        leadId: z.number().optional(),
        mode: z.enum(['briefing', 'primeiro_contato', 'qualificacao', 'objecoes', 'credito', 'followup', 'treinamento', 'recomendar', 'chat']).default('chat')
      }))
      .mutation(async ({ input }) => {
        const smqCopilot = await import('./smqCopilot');
        const { chatWithCopilot } = smqCopilot;
        
        // Tipo inline para contexto do lead
        let leadContext: {
          nome: string;
          telefone?: string;
          email?: string;
          status: string;
          projeto?: string;
          origem?: string;
          observacoes?: string;
          historicoInteracoes?: Array<{ tipo: string; descricao: string; data: string; }>;
          diasSemContato?: number;
        } | undefined;
        
        // Se tiver leadId, buscar contexto do lead
        if (input.leadId) {
          const lead = await db.getLeadById(input.leadId);
          if (lead) {
            // Buscar histórico de interações
            const historico = await db.getLeadHistory(input.leadId);
            
            // Buscar projeto se existir
            let projetoNome: string | undefined;
            if (lead.projectId) {
              const projeto = await db.getProjectById(lead.projectId);
              projetoNome = projeto?.nome;
            }
            
            leadContext = {
              nome: lead.nome,
              telefone: lead.telefone || undefined,
              email: lead.email || undefined,
              status: lead.status,
              projeto: projetoNome,
              origem: lead.origem || undefined,
              observacoes: lead.observacoes || undefined,
              historicoInteracoes: historico.slice(0, 5).map(h => ({
                tipo: h.tipo,
                descricao: h.observacoes || h.tipo,
                data: new Date(h.createdAt).toLocaleDateString('pt-BR')
              })),
              diasSemContato: lead.ultimoContato 
                ? Math.floor((Date.now() - new Date(lead.ultimoContato).getTime()) / (1000 * 60 * 60 * 24))
                : undefined
            };
          }
        }
        
        const response = await chatWithCopilot(
          input.messages,
          leadContext,
          input.mode
        );
        
        return { response };
      }),

    // Ação rápida - gera resposta para um modo específico
    quickAction: protectedProcedure
      .input(z.object({
        leadId: z.number(),
        mode: z.enum(['briefing', 'primeiro_contato', 'qualificacao', 'objecoes', 'credito', 'followup', 'treinamento', 'recomendar']),
        additionalContext: z.string().optional()
      }))
      .mutation(async ({ input }) => {
        const smqCopilot = await import('./smqCopilot');
        const { quickAction } = smqCopilot;
        
        // Buscar lead
        const lead = await db.getLeadById(input.leadId);
        if (!lead) {
          throw new Error('Lead não encontrado');
        }
        
        // Buscar histórico de interações
        const historico = await db.getLeadHistory(input.leadId);
        
        // Buscar projeto se existir
        let projetoNome: string | undefined;
        if (lead.projectId) {
          const projeto = await db.getProjectById(lead.projectId);
          projetoNome = projeto?.nome;
        }
        
        const leadContext = {
          nome: lead.nome,
          telefone: lead.telefone || undefined,
          email: lead.email || undefined,
          status: lead.status,
          projeto: projetoNome,
          origem: lead.origem || undefined,
          observacoes: lead.observacoes || undefined,
          historicoInteracoes: historico.slice(0, 5).map(h => ({
            tipo: h.tipo,
            descricao: h.observacoes || h.tipo,
            data: new Date(h.createdAt).toLocaleDateString('pt-BR')
          })),
          diasSemContato: lead.ultimoContato 
            ? Math.floor((Date.now() - new Date(lead.ultimoContato).getTime()) / (1000 * 60 * 60 * 24))
            : undefined
        };
        
        const response = await quickAction(
          input.mode,
          leadContext,
          input.additionalContext
        );
        
        return { response };
      }),

    // Recomendar imóveis com base no perfil do lead
    recomendarImoveis: protectedProcedure
      .input(z.object({
        leadId: z.number(),
        dadosAdicionais: z.object({
          rendaFamiliar: z.number().optional(),
          tipoRenda: z.string().optional(),
          entradaDisponivel: z.number().optional(),
          fgts: z.boolean().optional(),
          valorFgts: z.number().optional(),
          primeiroImovel: z.boolean().optional(),
          regiaoDesejada: z.string().optional(),
          prioridades: z.string().optional(),
        }).optional()
      }))
      .mutation(async ({ input }) => {
        const { recomendarImoveis } = await import('./smqCopilot');
        
        // Buscar lead
        const lead = await db.getLeadById(input.leadId);
        if (!lead) {
          throw new Error('Lead não encontrado');
        }
        
        // Buscar histórico de interações
        const historico = await db.getLeadHistory(input.leadId);
        
        // Buscar projeto se existir
        let projetoNome: string | undefined;
        if (lead.projectId) {
          const projeto = await db.getProjectById(lead.projectId);
          projetoNome = projeto?.nome;
        }
        
        const leadContext = {
          nome: lead.nome,
          telefone: lead.telefone || undefined,
          email: lead.email || undefined,
          status: lead.status,
          projeto: projetoNome,
          origem: lead.origem || undefined,
          observacoes: lead.observacoes || undefined,
          historicoInteracoes: historico.slice(0, 5).map(h => ({
            tipo: h.tipo,
            descricao: h.observacoes || h.tipo,
            data: new Date(h.createdAt).toLocaleDateString('pt-BR')
          })),
          diasSemContato: lead.ultimoContato 
            ? Math.floor((Date.now() - new Date(lead.ultimoContato).getTime()) / (1000 * 60 * 60 * 24))
            : undefined
        };
        
        const response = await recomendarImoveis(
          leadContext,
          input.dadosAdicionais
        );
        
        return { response };
      }),
  }),

  // ============================================================================
  // METAS DIÁRIAS E PONTUAÇÃO
  // ============================================================================
  metasDiarias: router({
    // Listar metas diárias de todos os corretores
    list: gestorProcedure
      .query(async () => {
        return await db.getMetasDiarias();
      }),
    
    // Obter meta diária de um corretor específico
    getByCorretor: gestorProcedure
      .input(z.object({ corretorId: z.number() }))
      .query(async ({ input }) => {
        return await db.getMetaDiariaCorretor(input.corretorId);
      }),
    
    // Criar/atualizar meta diária para um corretor
    upsert: gestorProcedure
      .input(z.object({
        corretorId: z.number(),
        metaLigacoes: z.number().min(0).default(20),
        metaWhatsapp: z.number().min(0).default(30),
        metaAgendamentos: z.number().min(0).default(3),
        metaVisitas: z.number().min(0).default(2),
        metaDocumentacoes: z.number().min(0).default(1),
        metaVendas: z.number().min(0).default(1),
      }))
      .mutation(async ({ input }) => {
        return await db.createMetaDiaria(input);
      }),
    
    // Atualizar meta diária existente
    update: gestorProcedure
      .input(z.object({
        id: z.number(),
        metaLigacoes: z.number().min(0).optional(),
        metaWhatsapp: z.number().min(0).optional(),
        metaAgendamentos: z.number().min(0).optional(),
        metaVisitas: z.number().min(0).optional(),
        metaDocumentacoes: z.number().min(0).optional(),
        metaVendas: z.number().min(0).optional(),
        ativo: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateMetaDiaria(id, data);
      }),
    
    // Excluir meta diária
    delete: gestorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteMetaDiaria(input.id);
      }),
    
    // Obter progresso de metas diárias de todos os corretores
    getProgresso: corretorProcedure
      .input(z.object({ corretorId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getProgressoMetasDiarias(input?.corretorId);
      }),
  }),

  // ============================================================================
  // CONFIGURAÇÃO DE PONTUAÇÃO
  // ============================================================================
  pontuacao: router({
    // Obter configuração atual de pontuação
    get: protectedProcedure
      .query(async () => {
        const config = await db.getConfiguracaoPontuacao();
        // Retornar valores padrão se não existir configuração
        return config || {
          pontosLigacao: 1,
          pontosLigacaoAtendida: 2,
          pontosWhatsapp: 1,
          pontosWhatsappRespondido: 2,
          pontosAgendamento: 15,
          pontosVisita: 25,
          pontosDocumentacao: 35,
          pontosVenda: 80,
          pontosClienteCadastrado: 5,
          pontosAlteracaoStatus: 2,
        };
      }),
    
    // Atualizar configuração de pontuação
    update: gestorProcedure
      .input(z.object({
        pontosLigacao: z.number().min(0).optional(),
        pontosLigacaoAtendida: z.number().min(0).optional(),
        pontosWhatsapp: z.number().min(0).optional(),
        pontosWhatsappRespondido: z.number().min(0).optional(),
        pontosAgendamento: z.number().min(0).optional(),
        pontosVisita: z.number().min(0).optional(),
        pontosDocumentacao: z.number().min(0).optional(),
        pontosVenda: z.number().min(0).optional(),
        pontosClienteCadastrado: z.number().min(0).optional(),
        pontosAlteracaoStatus: z.number().min(0).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.upsertConfiguracaoPontuacao({
          ...input,
          atualizadoPor: ctx.user.id,
        });
      }),
    
    // Recalcular pontuação de todos os corretores do dia
    recalcular: gestorProcedure
      .mutation(async () => {
        const total = await db.recalcularPontuacaoTodosCorretores();
        return { success: true, corretoresRecalculados: total || 0 };
      }),
  }),

  // ============================================================================
  // ALERTAS DE PRODUTIVIDADE
  // ============================================================================
  alertas: router({
    // Listar alertas (filtros opcionais)
    list: gestorProcedure
      .input(z.object({
        corretorId: z.number().optional(),
        lido: z.boolean().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAlertasProdutividade(input);
      }),
    
    // Obter alertas não lidos
    naoLidos: gestorProcedure
      .query(async () => {
        return await db.getAlertasNaoLidos();
      }),
    
    // Marcar alerta como lido
    marcarLido: gestorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.marcarAlertaComoLido(input.id, ctx.user.id);
      }),
    
    // Marcar todos como lidos
    marcarTodosLidos: gestorProcedure
      .mutation(async ({ ctx }) => {
        return await db.marcarTodosAlertasComoLidos(ctx.user.id);
      }),
    
    // Verificar produtividade e gerar alertas (pode ser chamado por job)
    verificar: gestorProcedure
      .mutation(async () => {
        const alertasGerados = await db.verificarProdutividadeEGerarAlertas();
        return { alertasGerados };
      }),
  }),

  // ============================================================================
  // CONQUISTAS / MEDALHAS
  // ============================================================================
  conquistas: router({
    // Buscar conquistas do corretor logado
    minhas: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getConquistasCorretor(ctx.user.id);
      }),
    
    // Buscar conquistas de um corretor específico (gestor)
    porCorretor: gestorProcedure
      .input(z.object({ corretorId: z.number() }))
      .query(async ({ input }) => {
        return await db.getConquistasCorretor(input.corretorId);
      }),
    
    // Buscar resumo de conquistas (para exibição no perfil)
    resumo: protectedProcedure
      .input(z.object({ corretorId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const corretorId = input?.corretorId || ctx.user.id;
        return await db.getResumoConquistas(corretorId);
      }),
    
    // Buscar tipos de conquistas disponíveis
    tipos: protectedProcedure
      .query(async () => {
        return await db.getTiposConquista();
      }),
    
    // Conceder conquista manualmente (gestor)
    conceder: gestorProcedure
      .input(z.object({
        corretorId: z.number(),
        tipoConquistaCodigo: z.string(),
        valor: z.number().optional(),
        observacao: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.concederConquista(
          input.corretorId,
          input.tipoConquistaCodigo,
          { valor: input.valor, observacao: input.observacao }
        );
      }),
    
    // Verificar e conceder conquistas automáticas
    verificar: protectedProcedure
      .mutation(async ({ ctx }) => {
        // Importar função de verificação do job
        const { verificarConquistasCorretor } = await import("./conquistasJob");
        return await verificarConquistasCorretor(ctx.user.id);
      }),
    
    // Buscar progresso de todas as conquistas
    progresso: protectedProcedure
      .query(async ({ ctx }) => {
        const { verificarConquistasCorretor } = await import("./conquistasJob");
        const resultado = await verificarConquistasCorretor(ctx.user.id);
        return resultado.progressos;
      }),
    
    // Inicializar tipos de conquistas padrão (admin)
    inicializarTipos: gestorProcedure
      .mutation(async () => {
        await db.criarTiposConquistaPadrao();
        return { success: true };
      }),
  }),

  // ============================================================================
  // PERFIL / FOTO
  // ============================================================================
  perfil: router({
    // Atualizar foto de perfil
    atualizarFoto: protectedProcedure
      .input(z.object({ fotoUrl: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.atualizarFotoPerfil(ctx.user.id, input.fotoUrl);
      }),
    
    // Buscar foto de perfil
    foto: protectedProcedure
      .input(z.object({ userId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const userId = input?.userId || ctx.user.id;
        return await db.getFotoPerfil(userId);
      }),
  }),

  // ============================================================================
  // AGENDAMENTOS
  // ============================================================================
  agendamentos: router({
    // Criar novo agendamento
    create: corretorProcedure
      .input(z.object({
        leadId: z.number(),
        projectId: z.number().optional(),
        projetoCustom: z.string().optional(),
        construtora: z.string().optional(),
        dataAgendamento: z.string(), // ISO date string
        horaAgendamento: z.string(), // HH:MM
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verificar se o lead pertence ao corretor (ou se é gestor)
        const lead = await db.getLeadById(input.leadId);
        if (!lead) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
        }
        if (ctx.user.role === 'corretor' && lead.corretorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Este lead não pertence a você' });
        }
        
        return await db.createAgendamento({
          leadId: input.leadId,
          corretorId: lead.corretorId || ctx.user.id,
          projectId: input.projectId,
          projetoCustom: input.projetoCustom,
          construtora: input.construtora,
          dataAgendamento: new Date(input.dataAgendamento),
          horaAgendamento: input.horaAgendamento,
          observacoes: input.observacoes,
          criadoPorId: ctx.user.id,
        });
      }),
    
    // Listar agendamentos do corretor
    list: corretorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getAgendamentosCorretor(ctx.user.id, {
          dataInicio: input?.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input?.dataFim ? new Date(input.dataFim) : undefined,
          status: input?.status,
        });
      }),
    
    // Listar todos os agendamentos (gestor)
    listAll: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        corretorId: z.number().optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAllAgendamentos({
          dataInicio: input?.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input?.dataFim ? new Date(input.dataFim) : undefined,
          corretorId: input?.corretorId,
          status: input?.status,
        });
      }),
    
    // Agendamentos do dia
    hoje: corretorProcedure.query(async ({ ctx }) => {
      return await db.getAgendamentosDoDia(ctx.user.id);
    }),
    
    // Agendamentos de um lead
    byLead: corretorProcedure
      .input(z.object({ leadId: z.number() }))
      .query(async ({ input }) => {
        return await db.getAgendamentosLead(input.leadId);
      }),
    
    // Atualizar status do agendamento
    updateStatus: corretorProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['pendente', 'confirmado', 'realizado', 'cancelado', 'reagendado']),
      }))
      .mutation(async ({ input }) => {
        return await db.updateAgendamentoStatus(input.id, input.status);
      }),
    
    // Atualizar agendamento
    update: corretorProcedure
      .input(z.object({
        id: z.number(),
        dataAgendamento: z.string().optional(),
        horaAgendamento: z.string().optional(),
        observacoes: z.string().optional(),
        status: z.enum(['pendente', 'confirmado', 'realizado', 'cancelado', 'reagendado']).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateAgendamento(id, {
          ...data,
          dataAgendamento: data.dataAgendamento ? new Date(data.dataAgendamento) : undefined,
        });
      }),
    
    // Excluir agendamento
    delete: corretorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteAgendamento(input.id);
      }),
  }),

  // ============================================================================
  // VISITAS
  // ============================================================================
  visitas: router({
    // Criar nova visita
    create: corretorProcedure
      .input(z.object({
        leadId: z.number(),
        agendamentoId: z.number().optional(),
        projectId: z.number().optional(),
        projetoCustom: z.string().optional(),
        construtora: z.string().optional(),
        dataVisita: z.string(), // ISO date string
        horaVisita: z.string().optional(), // HH:MM
        resultado: z.enum(['interesse_alto', 'interesse_medio', 'interesse_baixo', 'sem_interesse', 'pendente_documentacao', 'encaminhado_analise']).optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verificar se o lead pertence ao corretor (ou se é gestor)
        const lead = await db.getLeadById(input.leadId);
        if (!lead) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
        }
        if (ctx.user.role === 'corretor' && lead.corretorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Este lead não pertence a você' });
        }
        
        return await db.createVisita({
          leadId: input.leadId,
          corretorId: lead.corretorId || ctx.user.id,
          agendamentoId: input.agendamentoId,
          projectId: input.projectId,
          projetoCustom: input.projetoCustom,
          construtora: input.construtora,
          dataVisita: new Date(input.dataVisita),
          horaVisita: input.horaVisita,
          resultado: input.resultado,
          observacoes: input.observacoes,
          registradoPorId: ctx.user.id,
        });
      }),
    
    // Listar visitas do corretor
    list: corretorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getVisitasCorretor(ctx.user.id, {
          dataInicio: input?.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input?.dataFim ? new Date(input.dataFim) : undefined,
        });
      }),
    
    // Listar todas as visitas (gestor)
    listAll: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        corretorId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAllVisitas({
          dataInicio: input?.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input?.dataFim ? new Date(input.dataFim) : undefined,
          corretorId: input?.corretorId,
        });
      }),
    
    // Visitas de um lead
    byLead: corretorProcedure
      .input(z.object({ leadId: z.number() }))
      .query(async ({ input }) => {
        return await db.getVisitasLead(input.leadId);
      }),
    
    // Atualizar visita
    update: corretorProcedure
      .input(z.object({
        id: z.number(),
        resultado: z.enum(['interesse_alto', 'interesse_medio', 'interesse_baixo', 'sem_interesse', 'pendente_documentacao', 'encaminhado_analise']).optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateVisita(id, data);
      }),
    
    // Excluir visita
    delete: corretorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteVisita(input.id);
      }),
  }),

  // ============================================================================
  // BUSCA DE LEADS (para autocomplete)
  // ============================================================================
  searchLeads: router({
    // Buscar por telefone
    byTelefone: corretorProcedure
      .input(z.object({ telefone: z.string() }))
      .query(async ({ ctx, input }) => {
        const isGestor = ctx.user.role === 'gestor' || ctx.user.role === 'admin';
        return await db.searchLeadByTelefone(input.telefone, isGestor ? undefined : ctx.user.id);
      }),
    
    // Buscar por email
    byEmail: corretorProcedure
      .input(z.object({ email: z.string() }))
      .query(async ({ ctx, input }) => {
        const isGestor = ctx.user.role === 'gestor' || ctx.user.role === 'admin';
        return await db.searchLeadByEmail(input.email, isGestor ? undefined : ctx.user.id);
      }),
    
    // Buscar por CPF
    byCpf: corretorProcedure
      .input(z.object({ cpf: z.string() }))
      .query(async ({ ctx, input }) => {
        const isGestor = ctx.user.role === 'gestor' || ctx.user.role === 'admin';
        return await db.searchLeadByCpf(input.cpf, isGestor ? undefined : ctx.user.id);
      }),
    
    // Buscar por qualquer identificador (telefone, email, CPF ou nome)
    byIdentifier: corretorProcedure
      .input(z.object({ query: z.string() }))
      .query(async ({ ctx, input }) => {
        const isGestor = ctx.user.role === 'gestor' || ctx.user.role === 'admin';
        return await db.searchLeadByIdentifier(input.query, isGestor ? undefined : ctx.user.id);
      }),
  }),

  // ============================================================================
  // MÉTRICAS DO FUNIL (LEADS ÚNICOS)
  // ============================================================================
  metricasFunil: router({
    // Métricas gerais (gestor)
    geral: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getMetricasFunilLeadsUnicos(
          undefined,
          input?.dataInicio ? new Date(input.dataInicio) : undefined,
          input?.dataFim ? new Date(input.dataFim) : undefined
        );
      }),
    
    // Métricas por corretor (gestor)
    porCorretor: gestorProcedure
      .input(z.object({
        corretorId: z.number(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getMetricasFunilLeadsUnicos(
          input.corretorId,
          input.dataInicio ? new Date(input.dataInicio) : undefined,
          input.dataFim ? new Date(input.dataFim) : undefined
        );
      }),
    
    // Métricas individuais (corretor)
    minhas: corretorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getMetricasFunilLeadsUnicos(
          ctx.user.id,
          input?.dataInicio ? new Date(input.dataInicio) : undefined,
          input?.dataFim ? new Date(input.dataFim) : undefined
        );
      }),
  }),

  // ============================================================================
  // SINCRONIZAÇÃO COM GOOGLE SHEETS
  // ============================================================================
  sheetsSync: router({
    // Testar conexão com a planilha
    testConnection: gestorProcedure
      .query(async () => {
        return await sheetsSync.testConnection();
      }),
    
    // Inicializar planilha com headers
    initialize: gestorProcedure
      .mutation(async () => {
        await sheetsSync.initializeSheet();
        return { success: true, message: "Planilha inicializada com sucesso" };
      }),
    
    // Sincronizar todos os leads
    syncAll: gestorProcedure
      .mutation(async () => {
        // Buscar todos os leads com dados completos
        const allLeads = await db.getAllLeadsForSync();
        const result = await sheetsSync.syncAllLeads(allLeads);
        return {
          success: result.errors === 0,
          message: `${result.success} leads sincronizados, ${result.errors} erros`,
          ...result
        };
      }),
    
    // Obter URL da planilha
    getSpreadsheetUrl: gestorProcedure
      .query(() => {
        return {
          url: sheetsSync.getSpreadsheetUrl(),
          spreadsheetId: sheetsSync.getSpreadsheetId()
        };
      }),
  }),

  // ============================================================================
  // AGENDA DO CORRETOR (DISPONIBILIDADE)
  // ============================================================================
  
  agenda: router({
    // Buscar disponibilidade do corretor
    getDisponibilidade: corretorProcedure
      .input(z.object({ corretorId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const corretorId = input?.corretorId || ctx.user.id;
        return await db.getDisponibilidadeCorretor(corretorId);
      }),
    
    // Salvar disponibilidade
    saveDisponibilidade: corretorProcedure
      .input(z.object({
        diaSemana: z.number().min(0).max(6),
        horaInicio: z.string(),
        horaFim: z.string(),
        intervaloInicio: z.string().optional(),
        intervaloFim: z.string().optional(),
        duracaoSlot: z.number().default(60),
        ativo: z.boolean().default(true)
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.upsertDisponibilidadeCorretor({
          corretorId: ctx.user.id,
          ...input
        });
      }),
    
    // Deletar disponibilidade
    deleteDisponibilidade: corretorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteDisponibilidadeCorretor(input.id);
      }),
    
    // Buscar bloqueios
    getBloqueios: corretorProcedure
      .input(z.object({
        corretorId: z.number().optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional()
      }).optional())
      .query(async ({ ctx, input }) => {
        const corretorId = input?.corretorId || ctx.user.id;
        return await db.getBloqueiosAgenda(
          corretorId,
          input?.dataInicio ? new Date(input.dataInicio) : undefined,
          input?.dataFim ? new Date(input.dataFim) : undefined
        );
      }),
    
    // Criar bloqueio
    createBloqueio: corretorProcedure
      .input(z.object({
        dataInicio: z.string(),
        dataFim: z.string(),
        tipo: z.enum(['ferias', 'folga', 'reuniao', 'compromisso_pessoal', 'treinamento', 'outro']),
        motivo: z.string().optional(),
        diaInteiro: z.boolean().default(false)
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createBloqueioAgenda({
          corretorId: ctx.user.id,
          dataInicio: new Date(input.dataInicio),
          dataFim: new Date(input.dataFim),
          tipo: input.tipo,
          motivo: input.motivo,
          diaInteiro: input.diaInteiro
        });
      }),
    
    // Deletar bloqueio
    deleteBloqueio: corretorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteBloqueioAgenda(input.id);
      }),
    
    // Buscar slots disponíveis
    getSlotsDisponiveis: publicProcedure
      .input(z.object({
        corretorId: z.number(),
        data: z.string()
      }))
      .query(async ({ input }) => {
        return await db.getSlotsDisponiveis(input.corretorId, new Date(input.data));
      }),
  }),

  // ============================================================================
  // LINKS DE AGENDAMENTO SELF-SERVICE
  // ============================================================================
  
  linksAgendamento: router({
    // Criar link
    create: corretorProcedure
      .input(z.object({
        leadId: z.number().optional(),
        projectId: z.number().optional(),
        titulo: z.string().optional(),
        mensagemBoasVindas: z.string().optional(),
        validoAte: z.string().optional(),
        maxAgendamentos: z.number().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createLinkAgendamento({
          corretorId: ctx.user.id,
          leadId: input.leadId,
          projectId: input.projectId,
          titulo: input.titulo,
          mensagemBoasVindas: input.mensagemBoasVindas,
          validoAte: input.validoAte ? new Date(input.validoAte) : undefined,
          maxAgendamentos: input.maxAgendamentos,
          token: '' // Será gerado no db
        });
      }),
    
    // Listar links do corretor
    list: corretorProcedure
      .query(async ({ ctx }) => {
        return await db.getLinksAgendamentoCorretor(ctx.user.id);
      }),
    
    // Buscar link por token (público)
    getByToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const link = await db.getLinkAgendamentoByToken(input.token);
        if (!link) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Link não encontrado ou expirado' });
        }
        
        // Verificar validade
        if (link.validoAte && new Date(link.validoAte) < new Date()) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Link expirado' });
        }
        
        // Verificar limite de agendamentos
        if (link.maxAgendamentos && link.agendamentosRealizados >= link.maxAgendamentos) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Limite de agendamentos atingido' });
        }
        
        // Buscar dados do corretor e projeto
        const corretor = await db.getUserById(link.corretorId);
        const projeto = link.projectId ? await db.getProjectById(link.projectId) : null;
        
        return {
          ...link,
          corretor: corretor ? { id: corretor.id, name: corretor.name, fotoUrl: corretor.fotoUrl } : null,
          projeto: projeto ? { id: projeto.id, nome: projeto.nome, construtora: projeto.construtora } : null
        };
      }),
    
    // Criar agendamento via link (público)
    agendar: publicProcedure
      .input(z.object({
        token: z.string(),
        nome: z.string(),
        telefone: z.string(),
        email: z.string().optional(),
        data: z.string(),
        hora: z.string(),
        observacoes: z.string().optional()
      }))
      .mutation(async ({ input }) => {
        const link = await db.getLinkAgendamentoByToken(input.token);
        if (!link) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Link não encontrado' });
        }
        
        // Verificar se o slot ainda está disponível
        const slots = await db.getSlotsDisponiveis(link.corretorId, new Date(input.data));
        if (!slots.includes(input.hora)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Horário não disponível' });
        }
        
        // Criar ou buscar lead
        let lead = await db.searchLeadByTelefone(input.telefone);
        let leadId: number;
        
        if (lead && lead.length > 0) {
          leadId = lead[0].id;
        } else {
          const novoLead = await db.createLead({
            nome: input.nome,
            telefone: input.telefone,
            email: input.email,
            projectId: link.projectId || undefined,
            corretorId: link.corretorId,
            origem: 'agendamento_self_service'
          });
          if (!novoLead) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao criar lead' });
          }
          leadId = novoLead.id;
        }
        
        // Criar agendamento
        const agendamento = await db.createAgendamento({
          leadId,
          corretorId: link.corretorId,
          projectId: link.projectId || undefined,
          dataAgendamento: new Date(input.data),
          horaAgendamento: input.hora,
          observacoes: input.observacoes
        });
        
        // Incrementar contador do link
        await db.incrementarAgendamentosLink(link.id);
        
        return { success: true, agendamento };
      }),
  }),

  // ============================================================================
  // CHATBOT DE PRÉ-QUALIFICAÇÃO
  // ============================================================================
  
  chatbot: router({
    // Iniciar conversa
    iniciar: publicProcedure
      .input(z.object({
        origem: z.string().optional(),
        dispositivo: z.string().optional(),
        projectId: z.number().optional()
      }).optional())
      .mutation(async ({ input }) => {
        const conversa = await db.createConversaChatbot({
          origem: input?.origem,
          dispositivo: input?.dispositivo,
          projectId: input?.projectId
        });
        
        if (!conversa) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao iniciar conversa' });
        }
        
        // Adicionar mensagem de boas-vindas
        await db.addMensagemChatbot(conversa.sessionId, 'bot', 
          'Olá! Bem-vindo à Seu Metro Quadrado! \ud83c\udfe0\n\nSou o assistente virtual e estou aqui para ajudá-lo a encontrar o imóvel ideal.\n\nPara começar, qual é o seu nome?'
        );
        
        return conversa;
      }),
    
    // Buscar conversa
    getBySession: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        return await db.getConversaChatbotBySession(input.sessionId);
      }),
    
    // Enviar mensagem
    enviarMensagem: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        mensagem: z.string()
      }))
      .mutation(async ({ input }) => {
        const conversa = await db.getConversaChatbotBySession(input.sessionId);
        if (!conversa) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversa não encontrada' });
        }
        
        // Registrar mensagem do usuário
        await db.addMensagemChatbot(input.sessionId, 'user', input.mensagem);
        
        // Processar resposta baseado no estado da conversa
        let resposta = '';
        const updates: Record<string, any> = {};
        
        if (!conversa.nome) {
          updates.nome = input.mensagem;
          resposta = `Prazer em conhecê-lo, ${input.mensagem}! \ud83d\ude0a\n\nAgora, por favor, me informe seu telefone com DDD para que possamos entrar em contato:`;
        } else if (!conversa.telefone) {
          updates.telefone = input.mensagem.replace(/\D/g, '');
          resposta = 'Perfeito! E qual é o seu e-mail? (ou digite "pular" para continuar)';
        } else if (!conversa.email && input.mensagem.toLowerCase() !== 'pular') {
          if (input.mensagem.includes('@')) {
            updates.email = input.mensagem;
          }
          resposta = 'Qual região de São Paulo você tem interesse?\n\n1. Zona Norte\n2. Zona Sul\n3. Zona Leste\n4. Zona Oeste\n5. Centro\n6. Ainda não decidi';
        } else if (!conversa.regiao) {
          const regioes: Record<string, string> = {
            '1': 'Zona Norte', '2': 'Zona Sul', '3': 'Zona Leste',
            '4': 'Zona Oeste', '5': 'Centro', '6': 'Indefinida'
          };
          updates.regiao = regioes[input.mensagem] || input.mensagem;
          resposta = 'Qual é a sua faixa de renda familiar mensal?\n\n1. Até R$ 2.640\n2. R$ 2.640 a R$ 4.400\n3. R$ 4.400 a R$ 8.000\n4. Acima de R$ 8.000';
        } else if (!conversa.rendaFamiliar) {
          const rendas: Record<string, string> = {
            '1': 'Até R$ 2.640', '2': 'R$ 2.640 a R$ 4.400',
            '3': 'R$ 4.400 a R$ 8.000', '4': 'Acima de R$ 8.000'
          };
          updates.rendaFamiliar = rendas[input.mensagem] || input.mensagem;
          resposta = 'Você possui valor para entrada?\n\n1. Sim\n2. Não\n3. Estou juntando';
        } else if (conversa.temEntrada === null) {
          updates.temEntrada = input.mensagem === '1';
          resposta = 'Qual é o seu prazo para comprar?\n\n1. Imediato (até 30 dias)\n2. 1 a 3 meses\n3. 3 a 6 meses\n4. Mais de 6 meses';
        } else if (!conversa.prazoCompra) {
          const prazos: Record<string, string> = {
            '1': 'imediato', '2': '1_3_meses', '3': '3_6_meses', '4': 'mais_6_meses'
          };
          updates.prazoCompra = prazos[input.mensagem] || input.mensagem;
          updates.status = 'qualificado';
          resposta = 'Ótimo! Coletei todas as informações necessárias. \ud83c\udf89\n\nUm de nossos corretores especializados entrará em contato em breve para apresentar as melhores opções para você!\n\nDeseja agendar uma visita agora mesmo?\n\n1. Sim, quero agendar\n2. Prefiro aguardar o contato';
        } else if (conversa.status === 'qualificado') {
          if (input.mensagem === '1') {
            updates.status = 'agendamento_solicitado';
            resposta = 'Perfeito! Em breve você receberá um link para escolher o melhor horário para sua visita. Obrigado pelo interesse! \ud83c\udfe0';
          } else {
            resposta = 'Sem problemas! Nossa equipe entrará em contato em breve. Obrigado pelo interesse na Seu Metro Quadrado! \ud83c\udfe0';
          }
        }
        
        // Atualizar conversa
        if (Object.keys(updates).length > 0) {
          await db.updateConversaChatbot(input.sessionId, updates);
        }
        
        // Registrar resposta do bot
        if (resposta) {
          await db.addMensagemChatbot(input.sessionId, 'bot', resposta);
        }
        
        return { resposta, conversa: await db.getConversaChatbotBySession(input.sessionId) };
      }),
    
    // Buscar FAQs
    getFaqs: publicProcedure
      .input(z.object({
        categoria: z.string().optional(),
        projectId: z.number().optional()
      }).optional())
      .query(async ({ input }) => {
        return await db.getFaqsChatbot(input?.categoria, input?.projectId);
      }),
    
    // Converter em lead (gestor)
    converterEmLead: gestorProcedure
      .input(z.object({
        sessionId: z.string(),
        corretorId: z.number().optional()
      }))
      .mutation(async ({ input }) => {
        return await db.converterConversaEmLead(input.sessionId, input.corretorId);
      }),
  }),

  // ============================================================================
  // PROPOSTAS DIGITAIS
  // ============================================================================
  
  propostas: router({
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
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const proposta = await db.getPropostaByToken(input.token);
        if (!proposta) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposta não encontrada' });
        }
        
        // Registrar visualização
        await db.registrarVisualizacaoProposta(input.token);
        
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
  }),
});
export type AppRouter = typeof appRouter;
