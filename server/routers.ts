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
import { invokeLLM } from "./_core/llm";
import { enviarConfirmacaoAgendamento, isEvolutionApiConfigured } from "./evolutionApi";
import { enviarWebhookZapier, criarPayloadAgendamento, gerarMensagemConfirmacao } from "./zapierWebhook";

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
    list: protectedProcedure
      .input(z.object({
        page: z.number().optional().default(1),
        limit: z.number().optional().default(50),
        searchTerm: z.string().optional(),
        status: z.string().optional(),
        projectId: z.number().optional(),
        origem: z.string().optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const page = input?.page || 1;
        const limit = input?.limit || 50;
        const searchTerm = input?.searchTerm;
        const status = input?.status;
        const projectId = input?.projectId;
        const origem = input?.origem;
        const dataInicio = input?.dataInicio;
        const dataFim = input?.dataFim;
        
        // Gestor vê todos os leads (por enquanto sem paginação, vamos adicionar depois)
        if (ctx.user.role === 'gestor' || ctx.user.role === 'admin') {
          const allLeads = await db.getAllLeads();
          return { leads: allLeads, total: allLeads.length, page: 1, limit: allLeads.length, totalPages: 1 };
        }
        // Corretor vê apenas seus leads (com paginação e filtros)
        return await db.getLeadsByCorretor(ctx.user.id, { 
          page, 
          limit, 
          searchTerm, 
          status, 
          projectId, 
          origem, 
          dataInicio, 
          dataFim 
        });
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
    
    // Buscar novos leads via webhook para notificação em tempo real
    getNewWebhookLeads: protectedProcedure
      .input(z.object({
        since: z.string(), // ISO timestamp
      }))
      .query(async ({ input, ctx }) => {
        // Corretor só pode ver seus próprios leads
        const corretorId = ctx.user.role === 'corretor' ? ctx.user.id : undefined;
        if (!corretorId) return [];
        
        return await db.getNewWebhookLeadsSince(corretorId, new Date(input.since));
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
        origem: z.enum([
          "facebook",
          "google_sheets",
          "site",
          "indicacao",
          "captacao_corretor",
          "whatsapp",
          "telefone",
          "plantao",
          "agendamento_self_service",
          "chatbot",
          "outro"
        ]).default("captacao_corretor"),
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
        // Verificar se o sistema está bloqueado (apenas para corretores)
        if (ctx.user.role === 'corretor') {
          const { getSystemConfig } = await import('./systemConfig');
          const config = await getSystemConfig();
          
          if (config?.bloqueio_ativo) {
            throw new TRPCError({ 
              code: 'FORBIDDEN', 
              message: 'Sistema temporariamente bloqueado. Aguarde autorização do gestor para atualizar leads.' 
            });
          }
        }
        
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
        
        // Se o status mudou para "em_atendimento", criar follow-up automático para amanhã
        if (input.data.status === 'em_atendimento' && lead.status !== 'em_atendimento') {
          await db.criarOuAtualizarFollowUp(input.id, lead.corretorId || ctx.user.id);
        }
        
        // Se o status for "perdido", tentar transferir para outro corretor
        if (input.data.status === 'perdido') {
          // Adicionar corretor atual à lista de quem já tentou
          const corretoresQueTentaram = lead.corretoresQueTentaram ? JSON.parse(lead.corretoresQueTentaram) : [];
          if (lead.corretorId && !corretoresQueTentaram.includes(lead.corretorId)) {
            corretoresQueTentaram.push(lead.corretorId);
          }
          
          // Buscar próximo corretor disponível (presente e que não tentou ainda)
          const proximoCorretor = await db.getProximoCorretorDisponivel(corretoresQueTentaram);
          
          if (proximoCorretor) {
            // Transferir para próximo corretor
            await db.updateLead(input.id, {
              ...input.data,
              status: 'aguardando_atendimento', // Volta para aguardando
              corretorId: proximoCorretor.id,
              corretoresQueTentaram: JSON.stringify(corretoresQueTentaram),
            });
            
            // Registrar transferência no histórico
            await db.createLeadHistory({
              leadId: input.id,
              corretorId: lead.corretorId || ctx.user.id,
              tipo: 'outro',
              resultado: 'outro',
              observacoes: `Lead transferido automaticamente para ${proximoCorretor.name} após ser marcado como perdido`,
            });
            
            return { success: true, transferred: true, newCorretor: proximoCorretor.name };
          } else {
            // Todos os corretores já tentaram, mover para lixeira
            await db.updateLead(input.id, {
              ...input.data,
              naLixeira: true,
              dataMovidoLixeira: new Date(),
              corretorAnteriorId: lead.corretorId,
              corretorId: null,
              corretoresQueTentaram: JSON.stringify(corretoresQueTentaram),
            });
            return { success: true, movedToTrash: true };
          }
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
        // Verificar se o sistema está bloqueado (apenas para corretores)
        if (ctx.user.role === 'corretor') {
          const { getSystemConfig } = await import('./systemConfig');
          const config = await getSystemConfig();
          
          if (config?.bloqueio_ativo) {
            throw new TRPCError({ 
              code: 'FORBIDDEN', 
              message: 'Sistema temporariamente bloqueado. Aguarde autorização do gestor para registrar follow-ups.' 
            });
          }
        }
        
        const lead = await db.getLeadById(input.leadId);
        
        if (!lead) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
        }
        
        // Se o lead não tem corretor, atribuir ao corretor que está registrando a interação
        if (!lead.corretorId) {
          await db.updateLead(input.leadId, {
            corretorId: ctx.user.id,
          });
        }
        
        // Se o lead tem corretor diferente mas está em follow-up, reatribuir ao corretor atual
        // Isso acontece quando o lead foi transferido automaticamente
        if (ctx.user.role === 'corretor' && lead.corretorId && lead.corretorId !== ctx.user.id) {
          await db.updateLead(input.leadId, {
            corretorId: ctx.user.id,
          });
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
    
    // Transferir lead para outro corretor (gestores e corretores)
    transferir: protectedProcedure
      .input(z.object({
        leadId: z.number(),
        novoCorretorId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const lead = await db.getLeadById(input.leadId);
        
        if (!lead) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
        }
        
        // Verificar se novo corretor existe
        const novoCorretor = await db.getUserById(input.novoCorretorId);
        if (!novoCorretor || novoCorretor.role !== 'corretor') {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Corretor não encontrado' });
        }
        
        const corretorAnteriorId = lead.corretorId;
        
        // Atualizar lead com novo corretor
        await db.updateLead(input.leadId, {
          corretorId: input.novoCorretorId,
        });
        
        // Criar follow-up automático para amanhã
        await db.criarFollowUpsAutomaticos();
        
        // Registrar no histórico
        await db.createLeadHistory({
          leadId: input.leadId,
          corretorId: ctx.user.id,
          tipo: 'outro',
          resultado: 'outro',
          observacoes: `Lead transferido para ${novoCorretor.name}${corretorAnteriorId ? ` (anterior: corretor ID ${corretorAnteriorId})` : ''}`,
        });
        
        return { success: true, novoCorretor: novoCorretor.name };
      }),
    
    // Atribuir corretor manualmente (apenas gestores)
    atribuirCorretor: gestorProcedure
      .input(z.object({
        leadId: z.number(),
        corretorId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const lead = await db.getLeadById(input.leadId);
        
        if (!lead) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
        }
        
        // Verificar se corretor existe
        const corretor = await db.getUserById(input.corretorId);
        if (!corretor || corretor.role !== 'corretor') {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Corretor não encontrado' });
        }
        
        // Atualizar lead com novo corretor
        await db.updateLead(input.leadId, {
          corretorId: input.corretorId,
          status: lead.status === 'novo' ? 'aguardando_atendimento' : lead.status,
        });
        
        // Criar follow-up automático para amanhã
        await db.criarFollowUpsAutomaticos();
        
        // Registrar no histórico
        await db.createLeadHistory({
          leadId: input.leadId,
          corretorId: input.corretorId,
          tipo: 'outro',
          resultado: 'outro',
          observacoes: `Lead atribuído manualmente pelo gestor`,
        });
        
        return { success: true, corretor: corretor.name };
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
    
    // Listar limites diários de todos os corretores
    listarLimites: gestorProcedure
      .query(async () => {
        const corretores = await db.getAllCorretores();
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        const limites = await Promise.all(corretores.map(async (corretor) => {
          // Contar leads recebidos hoje
          const leadsHoje = await db.countLeadsRecebidosHoje(corretor.id, hoje);
          
          return {
            corretorId: corretor.id,
            nome: corretor.name,
            email: corretor.email,
            fotoUrl: corretor.fotoUrl,
            limiteDiarioLeads: corretor.limiteDiarioLeads || 50,
            limiteDiarioWebhook: corretor.limiteDiarioWebhook || 10,
            leadsRecebidosHoje: leadsHoje,
            status: corretor.status,
          };
        }));
        
        return limites;
      }),
    
    // Configurar limite diário de distribuição automática
    configurarLimiteDiario: gestorProcedure
      .input(z.object({
        corretorId: z.number(),
        limite: z.number().min(0).max(200),
      }))
      .mutation(async ({ input }) => {
        await db.updateLimiteDiarioLeads(input.corretorId, input.limite);
        return { success: true };
      }),
    
    // Configurar limite diário de webhook
    configurarLimiteWebhook: gestorProcedure
      .input(z.object({
        corretorId: z.number(),
        limite: z.number().min(0).max(100),
      }))
      .mutation(async ({ input }) => {
        await db.updateLimiteDiarioWebhook(input.corretorId, input.limite);
        return { success: true };
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
        const { converterFiltrosData } = await import('./timezone');
        const { dataInicio, dataFim } = converterFiltrosData(input.dataInicio, input.dataFim);
        
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
        const { converterFiltrosData } = await import('./timezone');
        const { dataInicio, dataFim } = converterFiltrosData(input.dataInicio, input.dataFim);
        
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
        const { converterFiltrosData } = await import('./timezone');
        const { dataInicio, dataFim } = converterFiltrosData(input.dataInicio, input.dataFim);
        
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

    // Obter estatísticas do estoque de leads
    getEstatisticasEstoque: gestorProcedure
      .query(async () => {
        const { getEstatisticasEstoque } = await import("./distribution");
        return await getEstatisticasEstoque();
      }),

    // Forçar distribuição manual do estoque
    distribuirEstoque: gestorProcedure
      .mutation(async () => {
        const { distribuirLeadsDoEstoque } = await import("./distribution");
        return await distribuirLeadsDoEstoque();
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
    
    // ========== PROJETO FOCO DO MÊS ==========
    
    // Obter configuração do projeto foco
    getProjetoFoco: gestorProcedure
      .query(async () => {
        return await db.getConfiguracaoProjetoFoco();
      }),
    
    // Configurar projeto foco
    setProjetoFoco: gestorProcedure
      .input(z.object({
        projetoId: z.number().nullable(),
        corretoresIds: z.array(z.number()),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.setConfiguracaoProjetoFoco(
          input.projetoId,
          input.corretoresIds,
          input.observacoes
        );
        return { success: true };
      }),
    
    // Ativar/desativar projeto foco
    toggleProjetoFoco: gestorProcedure
      .input(z.object({ ativo: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.toggleProjetoFoco(input.ativo);
        return { success: true };
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
        tipoFila: z.enum(['geral', 'foco']).default('geral'),
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
    
    // Atualizar mapeamento de Form IDs para projetos
    updateFormIdMapping: gestorProcedure
      .input(z.object({
        webhookId: z.number(),
        formIdMapping: z.record(z.string(), z.number()), // { "form_id": projectId }
      }))
      .mutation(async ({ input }) => {
        await db.updateWebhookFormIdMapping(input.webhookId, input.formIdMapping);
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
    
    // Buscar follow-ups do dia (versão expandida que cria follow-ups automáticos se necessário)
    getFollowUpsDoDiaExpandido: corretorProcedure
      .input(z.object({
        ordenacao: z.enum(["mais_antigos", "mais_recentes", "menos_tentativas", "mais_tentativas"]).optional(),
        projetoId: z.number().optional(),
        origem: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getFollowUpsDoDiaExpandido(
          ctx.user.id,
          input?.ordenacao,
          input?.projetoId,
          input?.origem
        );
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
  // PROGRESSO DE FOLLOW-UPS (GAMIFICAÇÃO)
  // ============================================================================
  progressoFollowUps: router({
    // Listar progresso de todos os corretores (apenas gestor)
    listarProgressoEquipe: gestorProcedure
      .query(async ({ ctx }) => {
        const { inicioDoDiaHoje } = await import('./timezone');
        const hoje = inicioDoDiaHoje();
        const amanha = new Date(hoje);
        amanha.setDate(amanha.getDate() + 1);
        
        // Buscar todos os corretores ativos
        const corretores = await db.getCorretoresAtivos();
        
        // Calcular progresso de cada corretor
        const progressos = await Promise.all(
          corretores.map(async (corretor) => {
            // Total de follow-ups do dia
            const totalFollowUps = await db.getTotalFollowUpsDoDia(corretor.id, hoje, amanha);
            const total = totalFollowUps.length;
            
            // Follow-ups concluídos hoje
            const concluidos = totalFollowUps.filter(f => {
              if (!f.ultimaTentativa) return false;
              const ultimaTentativaDate = new Date(f.ultimaTentativa);
              return ultimaTentativaDate >= hoje && ultimaTentativaDate < amanha;
            }).length;
            
            // Encontrar horário do último follow-up
            const ultimoFollowUp = totalFollowUps
              .filter(f => f.ultimaTentativa)
              .sort((a, b) => {
                const dateA = a.ultimaTentativa ? new Date(a.ultimaTentativa).getTime() : 0;
                const dateB = b.ultimaTentativa ? new Date(b.ultimaTentativa).getTime() : 0;
                return dateB - dateA;
              })[0];
            
            const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 100;
            const desbloqueado = total === 0 ? true : percentual >= 40;
            
            return {
              corretorId: corretor.id,
              corretorNome: corretor.name,
              corretorEmail: corretor.email,
              total,
              concluidos,
              percentual,
              desbloqueado,
              ultimoFollowUp: ultimoFollowUp?.ultimaTentativa || null,
            };
          })
        );
        
        // Ordenar por percentual (maior primeiro)
        return progressos.sort((a, b) => b.percentual - a.percentual);
      }),
    // Calcular progresso de follow-ups do dia (para bloqueio gamificado)
    getProgresso: corretorProcedure
      .query(async ({ ctx }) => {
        const { inicioDoDiaHoje } = await import('./timezone');
        const hoje = inicioDoDiaHoje();
        const amanha = new Date(hoje);
        amanha.setDate(amanha.getDate() + 1);
        
        
        // TOTAL FIXO: Contar TODOS os follow-ups que tinham proximaTentativa <= hoje
        const totalFollowUps = await db.getTotalFollowUpsDoDia(ctx.user.id, hoje, amanha);
        const total = totalFollowUps.length;
        
        // CONCLUÍDOS: Contar follow-ups que tiveram ultimaTentativa atualizada HOJE
        const concluidos = totalFollowUps.filter(f => {
          if (!f.ultimaTentativa) return false;
          const ultimaTentativaDate = new Date(f.ultimaTentativa);
          return ultimaTentativaDate >= hoje && ultimaTentativaDate < amanha;
        }).length;
        
        const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 100;
        const desbloqueado = total === 0 ? true : percentual >= 40;
        
        return {
          total,
          concluidos,
          percentual,
          desbloqueado,
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
        
        // Importar função de timezone
        const { parsearDataISO } = await import('./timezone');
        
        return await db.createAgendamento({
          leadId: input.leadId,
          corretorId: lead.corretorId || ctx.user.id,
          projectId: input.projectId,
          projetoCustom: input.projetoCustom,
          construtora: input.construtora,
          dataAgendamento: parsearDataISO(input.dataAgendamento),
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
    
    // Excluir link de agendamento
    delete: corretorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Verificar se o link pertence ao corretor
        const links = await db.getLinksAgendamentoCorretor(ctx.user.id);
        const link = links.find(l => l.id === input.id);
        if (!link) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Link não encontrado' });
        }
        
        // Deletar o link
        await db.deleteLinkAgendamento(input.id);
        return { success: true };
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
        
        // Buscar dados do lead se houver leadId (para pré-preenchimento)
        let lead = null;
        if (link.leadId) {
          const leadData = await db.getLeadById(link.leadId);
          if (leadData) {
            lead = {
              id: leadData.id,
              nome: leadData.nome,
              telefone: leadData.telefone,
              email: leadData.email
            };
          }
        }
        
        return {
          ...link,
          corretor: corretor ? { id: corretor.id, name: corretor.name, fotoUrl: corretor.fotoUrl } : null,
          projeto: projeto ? { id: projeto.id, nome: projeto.nome, construtora: projeto.construtora } : null,
          lead
        };
      }),
    
    // Criar agendamento via link (público)
    agendar: publicProcedure
      .input(z.object({
        token: z.string(),
        nome: z.string().min(2, 'Nome é obrigatório'),
        telefone: z.string().min(10, 'Telefone é obrigatório'),
        email: z.string().email('E-mail inválido').min(1, 'E-mail é obrigatório'),
        data: z.string(),
        hora: z.string(),
        observacoes: z.string().optional()
      }))
      .mutation(async ({ input }) => {
        const link = await db.getLinkAgendamentoByToken(input.token);
        if (!link) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Link não encontrado ou expirado' });
        }
        
        // Verificar se o link expirou (15 minutos para links com leadId)
        if (link.validoAte && new Date(link.validoAte) < new Date()) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Link expirado. Solicite um novo link ao corretor.' });
        }
        
        // Verificar se o slot ainda está disponível
        const slots = await db.getSlotsDisponiveis(link.corretorId, new Date(input.data));
        if (!slots.includes(input.hora)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Horário não disponível' });
        }
        
        // Criar ou buscar lead
        let leadId: number;
        let isNovoLead = false;
        
        // Se o link já tem um lead associado, usar esse lead e atualizar dados se necessário
        if (link.leadId) {
          leadId = link.leadId;
          
          // Buscar dados atuais do lead para comparar
          const leadAtual = await db.getLeadById(leadId);
          if (leadAtual) {
            // Verificar se houve alteração nos dados e atualizar automaticamente
            const dadosAlterados: Record<string, any> = {};
            if (input.nome !== leadAtual.nome) dadosAlterados.nome = input.nome;
            if (input.telefone !== leadAtual.telefone) dadosAlterados.telefone = input.telefone;
            if (input.email !== leadAtual.email) dadosAlterados.email = input.email;
            
            // Se houver alterações, atualizar o lead
            if (Object.keys(dadosAlterados).length > 0) {
              await db.updateLead(leadId, dadosAlterados);
              console.log(`[Agendamento] Lead ${leadId} atualizado com novos dados:`, dadosAlterados);
            }
          }
        } else {
          // Buscar lead existente pelo telefone
          const leadExistente = await db.searchLeadByTelefone(input.telefone);
          
          if (leadExistente && leadExistente.length > 0) {
            leadId = leadExistente[0].id;
            // Atualizar dados do lead se necessário
            await db.updateLead(leadId, {
              nome: input.nome,
              email: input.email,
              corretorId: link.corretorId,
              projectId: link.projectId || undefined
            });
          } else {
            // Criar novo lead
            const novoLead = await db.createLead({
              nome: input.nome,
              telefone: input.telefone,
              email: input.email,
              projectId: link.projectId || undefined,
              corretorId: link.corretorId,
              origem: 'agendamento_self_service',
              status: 'agendado',
              dataDistribuicao: new Date()
            });
            if (!novoLead) {
              throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao criar lead' });
            }
            leadId = novoLead.id;
            isNovoLead = true;
          }
        }
        
        // Atualizar status do lead para "agendado" se ainda não estiver
        // Criar data corretamente para evitar problemas de fuso horário
        const [anoFollowup, mesFollowup, diaFollowup] = input.data.split('-').map(Number);
        const [horaFollowup, minutoFollowup] = input.hora.split(':').map(Number);
        const dataFollowup = new Date(anoFollowup, mesFollowup - 1, diaFollowup, horaFollowup, minutoFollowup, 0);
        
        await db.updateLead(leadId, { 
          status: 'agendado',
          proximoFollowup: dataFollowup
        });
        
        // Criar agendamento - usar data e hora combinadas para evitar problemas de fuso horário
        // A data vem no formato yyyy-MM-dd e a hora no formato HH:mm
        const [ano, mes, dia] = input.data.split('-').map(Number);
        const [hora, minuto] = input.hora.split(':').map(Number);
        const dataAgendamentoCorreta = new Date(ano, mes - 1, dia, hora, minuto, 0);
        
        const agendamento = await db.createAgendamento({
          leadId,
          corretorId: link.corretorId,
          projectId: link.projectId || undefined,
          dataAgendamento: dataAgendamentoCorreta,
          horaAgendamento: input.hora,
          observacoes: input.observacoes
        });
        
        // Registrar atividade no histórico do lead
        await db.createLeadHistory({
          leadId,
          corretorId: link.corretorId,
          tipo: 'outro',
          resultado: 'agendamento',
          observacoes: `Cliente agendado via Link de AutoAgendamento para ${input.data} às ${input.hora}${input.observacoes ? '. Obs: ' + input.observacoes : ''}`
        });
        
        // Incrementar contador do link
        await db.incrementarAgendamentosLink(link.id);
        
        // Desativar link se for exclusivo (com leadId)
        if (link.leadId) {
          await db.desativarLinkAgendamento(link.id);
        }
        
        // Buscar dados do corretor e projeto para notificações
        const corretor = await db.getUserById(link.corretorId);
        const projeto = link.projectId ? await db.getProjectById(link.projectId) : null;
        
        // Formatar data para exibição
        const dataFormatadaExibicao = new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
        
        // Enviar webhook para Zapier (para WhatsApp via Zapier)
        const zapierWebhookUrl = process.env.ZAPIER_WEBHOOK_URL;
        if (zapierWebhookUrl) {
          try {
            const payload = criarPayloadAgendamento({
              cliente: {
                nome: input.nome,
                telefone: input.telefone,
                email: input.email
              },
              agendamento: {
                id: agendamento.id,
                data: input.data,
                hora: input.hora,
                projeto: projeto?.nome,
                construtora: projeto?.construtora,
                endereco: projeto?.endereco,
                observacoes: input.observacoes
              },
              corretor: {
                id: link.corretorId,
                nome: corretor?.name || 'Corretor',
                telefone: corretor?.telefone,
                email: corretor?.email
              }
            });
            
            // Adicionar mensagem formatada para WhatsApp no payload
            const mensagemWhatsApp = gerarMensagemConfirmacao({
              nomeCliente: input.nome,
              data: input.data,
              hora: input.hora,
              projeto: projeto?.nome,
              endereco: projeto?.endereco,
              nomeCorretor: corretor?.name || 'Corretor'
            });
            
            // Adicionar mensagem ao payload
            (payload as any).mensagemWhatsApp = mensagemWhatsApp;
            
            await enviarWebhookZapier(zapierWebhookUrl, payload);
            console.log('[Agendamento] Webhook enviado para Zapier:', input.telefone);
          } catch (zapierError) {
            // Não falhar o agendamento se o webhook falhar
            console.error('[Agendamento] Erro ao enviar webhook Zapier:', zapierError);
          }
        }
        
        // Enviar confirmação via WhatsApp (se Evolution API estiver configurada)
        if (isEvolutionApiConfigured()) {
          try {
            await enviarConfirmacaoAgendamento({
              telefoneCliente: input.telefone,
              nomeCliente: input.nome,
              nomeCorretor: corretor?.name || 'Corretor',
              data: dataFormatadaExibicao,
              hora: input.hora,
              projeto: projeto?.nome,
              endereco: projeto?.endereco
            });
            
            console.log('[Agendamento] Confirmação enviada via WhatsApp para:', input.telefone);
          } catch (whatsappError) {
            // Não falhar o agendamento se o WhatsApp falhar
            console.error('[Agendamento] Erro ao enviar WhatsApp:', whatsappError);
          }
        }
        
        return { success: true, agendamento, isNovoLead };
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
        const { storagePut } = await import('./storage');
        
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
        const { storagePut, storageGet } = await import('./storage');
        
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
        const { storagePut } = await import('./storage');
        const { extrairImagensDoBook, selecionarMelhoresImagens } = await import('./bookExtractor');
        
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
        const { storagePut } = await import('./storage');
        const { extrairImagensDoBook, selecionarMelhoresImagens } = await import('./bookExtractor');
        
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
        const { storagePut } = await import('./storage');
        
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
        if (proposta.corretorId !== ctx.user.id && ctx.user.role !== 'gestor' && ctx.user.role !== 'admin') {
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
        const { gerarHTMLProposta } = await import('./pdfGenerator');
        const { storagePut } = await import('./storage');
        type DadosProposta = import('./pdfGenerator').DadosProposta;
        
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
  }),

  // ============================================================================
  // INTEGRAÇÃO GOOGLE CALENDAR
  // ============================================================================
  
  googleCalendar: router({
    // Verificar status da integração
    getStatus: corretorProcedure
      .query(async ({ ctx }) => {
        const user = await db.getUserById(ctx.user.id);
        return {
          enabled: user?.googleCalendarEnabled || false,
          calendarId: user?.googleCalendarId || null,
          hasRefreshToken: !!user?.googleRefreshToken
        };
      }),
    
    // Salvar configuração do Google Calendar
    saveConfig: corretorProcedure
      .input(z.object({
        calendarId: z.string(),
        refreshToken: z.string().optional(),
        enabled: z.boolean()
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUser(ctx.user.id, {
          googleCalendarId: input.calendarId,
          googleRefreshToken: input.refreshToken,
          googleCalendarEnabled: input.enabled
        });
        return { success: true };
      }),
    
    // Desabilitar integração
    disable: corretorProcedure
      .mutation(async ({ ctx }) => {
        await db.updateUser(ctx.user.id, {
          googleCalendarEnabled: false
        });
        return { success: true };
      }),
  }),

  // ============================================================================
  // VISÃO CONSOLIDADA DE AGENDAMENTOS (GESTOR)
  // ============================================================================
  
  agendamentosGestor: router({
    // Listar todos os agendamentos de todos os corretores
    listAll: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        corretorId: z.number().optional(),
        status: z.enum(['pendente', 'confirmado', 'realizado', 'cancelado', 'reagendado']).optional()
      }).optional())
      .query(async ({ input }) => {
        return await db.getAllAgendamentos(input);
      }),
    
    // Estatísticas de agendamentos
    getStats: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional()
      }).optional())
      .query(async ({ input }) => {
        const agendamentos = await db.getAllAgendamentos(input);
        
        const total = agendamentos.length;
        const porStatus = {
          pendente: agendamentos.filter(a => a.status === 'pendente').length,
          confirmado: agendamentos.filter(a => a.status === 'confirmado').length,
          realizado: agendamentos.filter(a => a.status === 'realizado').length,
          cancelado: agendamentos.filter(a => a.status === 'cancelado').length,
          reagendado: agendamentos.filter(a => a.status === 'reagendado').length
        };
        
        // Agrupar por corretor
        const porCorretor: Record<number, { nome: string; total: number; realizados: number }> = {};
        for (const a of agendamentos) {
          if (!a.corretorId) continue;
          if (!porCorretor[a.corretorId]) {
            porCorretor[a.corretorId] = { nome: a.corretorNome || 'Desconhecido', total: 0, realizados: 0 };
          }
          porCorretor[a.corretorId].total++;
          if (a.status === 'realizado') porCorretor[a.corretorId].realizados++;
        }
        
        return {
          total,
          porStatus,
          porCorretor: Object.values(porCorretor)
        };
      }),
    
    // Calendário consolidado (para o gestor ver todos os agendamentos)
    getCalendario: gestorProcedure
      .input(z.object({
        mes: z.number().min(1).max(12),
        ano: z.number()
      }))
      .query(async ({ input }) => {
        const dataInicio = new Date(input.ano, input.mes - 1, 1);
        const dataFim = new Date(input.ano, input.mes, 0, 23, 59, 59);
        
        const agendamentos = await db.getAllAgendamentos({
          dataInicio: dataInicio.toISOString(),
          dataFim: dataFim.toISOString()
        });
        
        // Agrupar por dia
        const porDia: Record<string, typeof agendamentos> = {};
        for (const a of agendamentos) {
          const dia = new Date(a.dataAgendamento).toISOString().split('T')[0];
          if (!porDia[dia]) porDia[dia] = [];
          porDia[dia].push(a);
        }
        
        return porDia;
      }),
  }),

  // ============================================================================
  // CONFIGURAÇÃO DO SISTEMA
  // ============================================================================
  
  systemConfig: router({
    // Buscar configuração atual (apenas gestor)
    get: gestorProcedure.query(async () => {
      const { getSystemConfig } = await import('./systemConfig');
      const config = await getSystemConfig();
      
      if (!config) {
        // Retornar configuração padrão se não existir
        return {
          bloqueioAtivo: false
        };
      }
      
      return {
        bloqueioAtivo: config.bloqueio_ativo
      };
    }),
    
    // Atualizar status do bloqueio (apenas gestor)
    updateBloqueio: gestorProcedure
      .input(z.object({
        ativo: z.boolean()
      }))
      .mutation(async ({ input }) => {
        const { updateBloqueioFollowUp } = await import('./systemConfig');
        const success = await updateBloqueioFollowUp(input.ativo);
        
        if (!success) {
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: 'Erro ao atualizar configuração' 
          });
        }
        
        return { 
          success: true,
          bloqueioAtivo: input.ativo
        };
      }),
  }),

});
export type AppRouter = typeof appRouter;
