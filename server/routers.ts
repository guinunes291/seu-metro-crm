import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";

import * as sheetsImport from "./sheetsImport";
import * as analisesCentral from "./analisesCentral";
import { listSheetTabs, validateSheetAccess, extractSpreadsheetId } from "./googleSheets";
import * as presenca from "./presenca";
import * as sheetsSync from "./googleSheetsSync";
import * as biSync from "./biSync";
import * as duplicatasCleanup from "./duplicatasCleanup";
import * as updateProjetosEmMassa from "./modules/updateProjetosEmMassa";
import * as limparProjetosOrfaos from "./modules/limparProjetosOrfaos";
import * as onboarding from "./modules/onboarding";
import { comissoesRouter } from "./routers/comissoes";
import { templatesRouter } from "./routers/templates";
import { iaRouter } from "./routers/ia";
import { carteiraAtivaRouter } from "./routers/carteiraAtiva";
import { leadsRouter } from "./routers/leads";
import { agendamentosRouter, visitasRouter, agendamentosGestorRouter } from "./routers/agendamentosVisitas";
import { contratosRouter, analisesRouter } from "./routers/contratosAnalises";
import { equipesSubRouter } from "./routers/equipes";
import { invokeLLM } from "./_core/llm";
import { enviarConfirmacaoAgendamento, isEvolutionApiConfigured } from "./evolutionApi";
import { enviarWebhookZapier, criarPayloadAgendamento, gerarMensagemConfirmacao } from "./zapierWebhook";
import { analyticsRouter } from "./routers/analytics";
import { construtorasRouter } from "./routers/construtoras";
import { propostasRouter } from "./routers/propostas";

// ============================================================================
// HELPERS E MIDDLEWARES
// ============================================================================

// Helper: verifica se o role tem visão de gestor (gestor, admin, superintendente)
function isGestorLevel(role: string): boolean {
  return role === 'gestor' || role === 'admin' || role === 'superintendente';
}

// Helper: verifica se é admin ou superintendente (acesso total)
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

// Middleware para admin (apenas admin, não gestor)
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isAdminLevel(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem acessar' });
  }
  return next({ ctx });
});

// Procedure exclusiva para admin real (sem superintendente) - usada para exportação de dados
const adminExportProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas o administrador principal pode exportar dados' });
  }
  return next({ ctx });
});

// Middleware para gestor restrito (apenas sua equipe)
const gestorRestritoProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!isGestorLevel(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas gestores podem acessar' });
  }
  
  // Admin e superintendente têm acesso total, não precisa filtrar por equipe
  if (isAdminLevel(ctx.user.role)) {
    return next({ ctx: { ...ctx, equipeId: null } });
  }
  
  // Gestor: buscar equipeId
  const { getEquipeByGestor } = await import('./equipes');
  const equipe = await getEquipeByGestor(ctx.user.id);
  
  if (!equipe) {
    throw new TRPCError({ 
      code: 'NOT_FOUND', 
      message: 'Você não está associado a nenhuma equipe' 
    });
  }
  
  return next({ ctx: { ...ctx, equipeId: equipe.id } });
});

// ============================================================================
// ROUTER PRINCIPAL
// ============================================================================

export const appRouter = router({
  system: systemRouter,
  comissoes: comissoesRouter,
  templates: templatesRouter,
  ia: iaRouter,
  carteiraAtiva: carteiraAtivaRouter,
  
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

    listForMap: protectedProcedure.query(async () => {
      return await db.getProjectsForMap();
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
  // LEADS (extraído para server/routers/leads.ts)
  // ============================================================================
  
  leads: leadsRouter,

  // ============================================================================
  // AGENDAMENTOS, VISITAS E AGENDAMENTOS GESTOR (extraído para server/routers/agendamentosVisitas.ts)
  // ============================================================================
  agendamentos: agendamentosRouter,
  visitas: visitasRouter,
  agendamentosGestor: agendamentosGestorRouter,

  // ============================================================================
  // CONTRATOS E ANÁLISES DE CRÉDITO (extraído para server/routers/contratosAnalises.ts)
  // ============================================================================
  contratos: contratosRouter,
  analises: analisesRouter,

  // ============================================================================
  // EQUIPES (extraído para server/routers/equipes.ts)
  // ============================================================================
  equipes: equipesSubRouter,

  // ============================================================================
  // PROPOSTAS (extraído para server/routers/propostas.ts)
  // ============================================================================
  propostas: propostasRouter,

  // ============================================================================
  // ANALYTICS (extraído para server/routers/analytics.ts)
  // ============================================================================
  analytics: analyticsRouter,

  // ============================================================================
  // CONSTRUTORAS (extraído para server/routers/construtoras.ts)
  // ============================================================================
  construtoras: construtorasRouter,

  // ============================================================================
  // CORRETORES
  // ============================================================================
  
  corretores: router({
    // Lista de corretores (filtrado por equipe para gestores)
    list: gestorProcedure.query(async ({ ctx }) => {
      // Obter IDs dos corretores para filtro baseado no role
      const { getCorretoresIdsParaFiltro } = await import('./equipes');
      const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
      
      console.log('[corretores.list] User:', ctx.user.email, 'Role:', ctx.user.role, 'CorretoresIds:', corretoresIds);
      
      // Se for admin, retorna todos os corretores
      if (!corretoresIds) {
        const result = await db.getAllCorretores();
        console.log('[corretores.list] Admin - Retornando todos:', result.length, 'corretores');
        return result;
      }
      
      // Se for gestor, retorna apenas os corretores da sua equipe
      const result = await db.getCorretoresByIds(corretoresIds);
      console.log('[corretores.list] Gestor - Retornando:', result.length, 'corretores da equipe');
      return result;
    }),
    
    // Lista de corretores + gestores para transferência de leads
    listParaTransferencia: gestorProcedure.query(async ({ ctx }) => {
      const { getCorretoresIdsParaFiltro, getEquipeByGestor } = await import('./equipes');
      const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
      
      // Se for admin, retorna todos os corretores + gestores
      if (!corretoresIds) {
        const result = await db.getAllCorretoresEGestores();
        return result;
      }
      
      // Se for gestor, retorna corretores da equipe + o próprio gestor + outros gestores
      // Buscar todos os gestores do sistema para incluir na lista
      const corretoresEGestores = await db.getAllCorretoresEGestores();
      const corretoresEquipe = await db.getCorretoresEGestoresByIds(corretoresIds);
      
      // Combinar: corretores da equipe + todos os gestores (sem duplicatas)
      const idsJaIncluidos = new Set(corretoresEquipe.map(c => c.id));
      const gestoresExtras = corretoresEGestores.filter(u => u.role === 'gestor' && !idsJaIncluidos.has(u.id));
      
      return [...corretoresEquipe, ...gestoresExtras];
    }),

    // Lista de todos os usuários (filtrado por equipe para gestores)
    listAll: gestorProcedure.query(async ({ ctx }) => {
      // Obter IDs dos corretores para filtro baseado no role
      const { getCorretoresIdsParaFiltro } = await import('./equipes');
      const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
      
      // Se for admin, retorna todos os usuários
      if (!corretoresIds) {
        return await db.getAllUsers();
      }
      
      // Se for gestor, retorna apenas os usuários da sua equipe
      return await db.getUsersByIds(corretoresIds);
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
        dataNascimento: z.coerce.date().optional(),
        creci: z.string().optional(),
        dataCredenciamento: z.coerce.date().optional(),
        dataDescredenciamento: z.coerce.date().optional(),
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

        // Criar página de onboarding no Notion (não bloquear se falhar)
        import("./notionService").then(({ criarOnboardingCorretor }) => {
          criarOnboardingCorretor({
            corretorNome: input.name,
            corretorEmail: input.email,
            dataIngresso: new Date(),
          }).catch((err: unknown) => console.error('[Notion] Erro ao criar onboarding corretor:', err));
        }).catch((err: unknown) => console.error('[Notion] Erro ao importar notionService:', err));
        
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
          dataNascimento: z.coerce.date().nullable().optional(),
          creci: z.string().optional(),
          dataCredenciamento: z.coerce.date().nullable().optional(),
          dataDescredenciamento: z.coerce.date().nullable().optional(),
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
        const { inicioDoDiaHoje } = await import('./timezone');
        const hoje = inicioDoDiaHoje();
        
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
        const { converterFiltrosData } = await import('./timezone');
        const { dataInicio, dataFim } = converterFiltrosData(input.dataInicio, input.dataFim);
        return await presenca.calcularEstatisticasPresenca(
          input.corretorId,
          dataInicio!,
          dataFim!
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
    // Migrar leads em excesso (>20 aguardando) para o estoque global
    migrarLeadsExcessoParaEstoque: gestorProcedure
      .mutation(async () => {
        const { leads: leadsTable, users: usersTable, leadEstoque: leadEstoqueTable } = await import("../drizzle/schema");
        const { getDb } = await import("./db");
        const { eq, and } = await import("drizzle-orm");
        const db2 = await getDb();
        if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });
        // Buscar todos os corretores
        const corretores = await db2
          .select({ id: usersTable.id, name: usersTable.name })
          .from(usersTable)
          .where(eq(usersTable.role, "corretor"));
        let totalMigrados = 0;
        const detalhes: { corretor: string; migrados: number }[] = [];
        for (const corretor of corretores) {
          // Buscar leads aguardando_atendimento do corretor (mais antigos primeiro)
          const leadsAguardando = await db2
            .select({ id: leadsTable.id, tipoFilaOrigem: leadsTable.tipoFilaOrigem })
            .from(leadsTable)
            .where(
              and(
                eq(leadsTable.corretorId, corretor.id),
                eq(leadsTable.status, "aguardando_atendimento"),
                eq(leadsTable.naLixeira, false)
              )
            )
            .orderBy(leadsTable.createdAt); // mantém os 20 mais antigos
          if (leadsAguardando.length <= 20) continue;
          // Mover os excedentes (além dos 20 primeiros) para o estoque
          const leadsParaMigrar = leadsAguardando.slice(20);
          for (const lead of leadsParaMigrar) {
            const jaNoEstoque = await db2
              .select({ id: leadEstoqueTable.id })
              .from(leadEstoqueTable)
              .where(and(eq(leadEstoqueTable.leadId, lead.id), eq(leadEstoqueTable.status, "aguardando")))
              .limit(1);
            if (jaNoEstoque.length > 0) continue;
            await db2.update(leadsTable).set({ corretorId: null, updatedAt: new Date() }).where(eq(leadsTable.id, lead.id));
            const tipoFila: "normal" | "foco" = lead.tipoFilaOrigem === "foco" ? "foco" : "normal";
            await db2.insert(leadEstoqueTable).values({
              leadId: lead.id,
              tipoFila,
              motivoEstoque: `Migração manual: excesso de leads aguardando (${leadsAguardando.length} > 20)`,
              tentativasDistribuicao: 0,
            });
            totalMigrados++;
          }
          if (leadsParaMigrar.length > 0) {
            detalhes.push({ corretor: corretor.name, migrados: leadsParaMigrar.length });
          }
        }
        return { totalMigrados, detalhes };
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
        page: z.number().optional(),
        pageSize: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        // Obter IDs dos corretores para filtro baseado no role
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        
        return await db.getLeadsPorCorretorComFiltros({ ...input, corretoresIds });
      }),

    // Obter estatísticas por corretor
    getEstatisticasPorCorretor: gestorProcedure
      .query(async ({ ctx }) => {
        // Obter IDs dos corretores para filtro baseado no role
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        
        return await db.getEstatisticasPorCorretor(corretoresIds);
      }),

    // Distribuir todos os leads sem corretor
    distribuirLeadsSemCorretor: gestorProcedure
      .mutation(async () => {
        return await db.distribuirLeadsSemCorretor();
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
          projeto: z.number().optional(),
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
    // Estatísticas gerais do CRM (filtrado por equipe para gestores)
    estatisticasGerais: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const { calcularEstatisticasGerais } = await import("./relatorios");
        const periodo = input ? {
          dataInicio: input.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input.dataFim ? new Date(input.dataFim) : undefined,
        } : undefined;
        
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        
        return await calcularEstatisticasGerais(periodo, corretoresIds);
      }),
    
    // Conversão por projeto (filtrado por equipe para gestores)
    conversaoPorProjeto: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const { calcularConversaoPorProjeto } = await import("./relatorios");
        const periodo = input ? {
          dataInicio: input.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input.dataFim ? new Date(input.dataFim) : undefined,
        } : undefined;
        
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        
        return await calcularConversaoPorProjeto(periodo, corretoresIds);
      }),
    
    // Conversão por corretor (filtrado por equipe para gestores)
    conversaoPorCorretor: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const { calcularConversaoPorCorretor } = await import("./relatorios");
        const periodo = input ? {
          dataInicio: input.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input.dataFim ? new Date(input.dataFim) : undefined,
        } : undefined;
        
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        
        return await calcularConversaoPorCorretor(periodo, corretoresIds);
      }),

    // Relatório de produção por corretor (funil completo)
    producaoPorCorretor: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        const dataInicio = input?.dataInicio ? new Date(input.dataInicio) : undefined;
        const dataFim = input?.dataFim ? new Date(input.dataFim) : undefined;
        return await db.getRelatorioProducaoCorretores(dataInicio, dataFim, corretoresIds);
      }),

    // Leads Facebook ADS recebidos e perdidos por timer (15 min) por corretor
    leadsTimerPorCorretor: gestorProcedure
      .input(z.object({
        dataInicio: z.string(),
        dataFim: z.string(),
      }))
      .query(async ({ input, ctx }) => {
        // Gestor vê apenas seu time; superintendente vê suas equipes; admin vê todos
        const { getCorretoresIdsParaFiltro: _timerFiltro } = await import('./equipes');
        const timerCorretoresIds = await _timerFiltro(ctx.user.id, ctx.user.role);
        return await db.getRelatorioLeadsTimerPorCorretor({
          dataInicio: new Date(input.dataInicio),
          dataFim: new Date(input.dataFim),
          corretoresIds: timerCorretoresIds || undefined,
        });;
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
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        
        console.log('[dashboard.metrics] User:', ctx.user.name, 'Role:', ctx.user.role, 'Corretores IDs:', corretoresIds);
        
        const filtros = {
          dataInicio: input?.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input?.dataFim ? new Date(input.dataFim) : undefined,
          corretoresIds,
        };
        return await db.getDashboardMetrics(filtros);
      }),
    
    // Leads por corretor
    leadsPorCorretor: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        
        const filtros = {
          dataInicio: input?.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input?.dataFim ? new Date(input.dataFim) : undefined,
          corretoresIds,
        };
        return await db.getLeadsPorCorretorDashboard(filtros);
      }),
    
    // Agendamentos por corretor
    agendamentosPorCorretor: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        
        const filtros = {
          dataInicio: input?.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input?.dataFim ? new Date(input.dataFim) : undefined,
          corretoresIds,
        };
        return await db.getAgendamentosPorCorretor(filtros);
      }),
    
    // Visitas por corretor
    visitasPorCorretor: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        
        const filtros = {
          dataInicio: input?.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input?.dataFim ? new Date(input.dataFim) : undefined,
          corretoresIds,
        };
        return await db.getVisitasPorCorretor(filtros);
      }),
    
    // Vendas por corretor
    vendasPorCorretor: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        
        const filtros = {
          dataInicio: input?.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input?.dataFim ? new Date(input.dataFim) : undefined,
          corretoresIds,
        };
        return await db.getVendasPorCorretor(filtros);
      }),

    pastasPorCorretor: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);

        const filtros = {
          dataInicio: input?.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input?.dataFim ? new Date(input.dataFim) : undefined,
          corretoresIds,
        };
        return await db.getPastasPorCorretor(filtros);
      }),

    // Métricas do funil baseadas em transições de status
    metricasFunil: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        
        const dataInicio = input?.dataInicio ? new Date(input.dataInicio) : undefined;
        const dataFim = input?.dataFim ? new Date(input.dataFim) : undefined;
        return await db.getMetricasFunilGeral(dataInicio, dataFim, corretoresIds);
      }),
    
    // Métricas do funil por corretor (baseadas em transições)
    metricasFunilPorCorretor: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        
        const dataInicio = input?.dataInicio ? new Date(input.dataInicio) : undefined;
        const dataFim = input?.dataFim ? new Date(input.dataFim) : undefined;
        return await db.getMetricasFunilTodosCorretores(dataInicio, dataFim, corretoresIds);
      }),
    
    // Lista detalhada de contratos fechados
    contratosFechados: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        
        const filtros = {
          dataInicio: input?.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input?.dataFim ? new Date(input.dataFim) : undefined,
          corretoresIds,
        };
        return await db.getContratosFechados(filtros);
      }),
    
    // Obter detalhes de um contrato para edição (admin only)
    getContratoParaEdicao: adminProcedure
      .input(z.object({ contratoId: z.number() }))
      .query(async ({ input }) => {
        return await db.getContratoParaEdicao(input.contratoId);
      }),
    
    // Atualizar contrato (admin only)
    atualizarContrato: adminProcedure
      .input(z.object({
        contratoId: z.number(),
        corretorId: z.number().optional(),
        clienteNome: z.string().optional(),
        clienteTelefone: z.string().optional(),
        clienteEmail: z.string().optional(),
        projectId: z.number().nullable().optional(),
        projetoCustom: z.string().nullable().optional(),
        valorVenda: z.number().optional(),
        dataVenda: z.string().optional(),
        equipeCorretorId: z.number().nullable().optional(),
        anexos: z.array(z.string()).optional(),
        percentualComissao: z.number().min(0).max(100).optional(),
      }))
      .mutation(async ({ input }) => {
        const { contratoId, ...dados } = input;
        const resultado = await db.atualizarContrato(contratoId, {
          ...dados,
          dataVenda: dados.dataVenda ? new Date(dados.dataVenda) : undefined,
        });
        // Sincronizar com planilha DRE em background
        import('../dreSyncJob').then(({ runDreSync }) => {
          runDreSync('edição de contrato').catch((err: unknown) => console.error('[DRE Sync] Erro ao sincronizar após editar contrato:', err));
        }).catch((err: unknown) => console.error('[DRE Sync] Erro ao importar dreSyncJob:', err));
        return resultado;
      }),
    
    // Criar novo contrato (admin only)
    criarContrato: adminProcedure
      .input(z.object({
        corretorId: z.number(),
        clienteNome: z.string().min(1, 'Nome do cliente é obrigatório'),
        clienteTelefone: z.string().min(1, 'Telefone é obrigatório'),
        clienteEmail: z.string().email('Email inválido'),
        projectId: z.number().nullable(),
        projetoCustom: z.string(),
        valorVenda: z.number().positive('Valor deve ser positivo'),
        percentualComissao: z.number().min(0).max(100).default(3.5),
        percentualCorretor: z.number().min(0).max(100).default(1.85),
        percentualGerente: z.number().min(0).max(100).default(0.5),
        percentualSuperintendente: z.number().min(0).max(100).default(0.3),
        dataVenda: z.string(),
        observacoes: z.string().optional(),
        anexos: z.array(z.string()).optional(),
        clienteAgendou: z.boolean().optional(),
        clienteVisitou: z.boolean().optional(),
        clienteFezAnalise: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const resultado = await db.criarNovoContrato({
          ...input,
          dataVenda: new Date(input.dataVenda),
        });
        // Sincronizar com planilha DRE em background (sem bloquear a resposta)
        import('../dreSyncJob').then(({ runDreSync }) => {
          runDreSync('novo contrato').catch(err => 
            console.error('[DRE Sync] Erro ao sincronizar após criar contrato:', err)
          );
        }).catch((err: unknown) => console.error('[DRE Sync] Erro ao importar dreSyncJob (criar contrato):', err));
        return resultado;
      }),
    
    // Opções para selects de edição de contrato
    opcoesContrato: gestorProcedure
      .query(async () => {
        return await db.getOpcoesContrato();
      }),
    
    // Buscar template de comissão por projeto
    buscarTemplateComissao: protectedProcedure
      .input(z.object({
        projectId: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.buscarTemplateComissaoPorProjeto(input.projectId);
      }),
    
    // VGV agrupado por equipe e projeto
    vgvPorEquipeProjeto: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        
        const filtros = {
          dataInicio: input?.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input?.dataFim ? new Date(input.dataFim) : undefined,
          corretoresIds,
        };
        return await db.getVGVPorEquipeProjeto(filtros);
      }),
    
    // Registrar distrato em um contrato (admin only)
    registrarDistrato: adminProcedure
      .input(z.object({
        contratoId: z.number(),
        motivoDistrato: z.string().min(1, 'Motivo é obrigatório'),
      }))
      .mutation(async ({ input, ctx }) => {
        const resultado = await db.registrarDistrato(input.contratoId, {
          motivoDistrato: input.motivoDistrato,
          distratadoPorId: ctx.user.id,
        });
        // Sincronizar com planilha DRE em background
        import('../dreSyncJob').then(({ runDreSync }) => {
          runDreSync('distrato registrado').catch((err: unknown) => console.error('[DRE Sync] Erro ao sincronizar após registrar distrato:', err));
        }).catch((err: unknown) => console.error('[DRE Sync] Erro ao importar dreSyncJob:', err));
        return resultado;
      }),
    
    // Desfazer distrato (admin only)
    desfazerDistrato: adminProcedure
      .input(z.object({ contratoId: z.number() }))
      .mutation(async ({ input }) => {
        const resultado = await db.desfazerDistrato(input.contratoId);
        // Sincronizar com planilha DRE em background
        import('../dreSyncJob').then(({ runDreSync }) => {
          runDreSync('distrato desfeito').catch((err: unknown) => console.error('[DRE Sync] Erro ao sincronizar após desfazer distrato:', err));
        }).catch((err: unknown) => console.error('[DRE Sync] Erro ao importar dreSyncJob:', err));
        return resultado;
      }),
    
    // Listar distratos
    listarDistratos: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        const filtros = {
          dataInicio: input?.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input?.dataFim ? new Date(input.dataFim) : undefined,
          corretoresIds,
        };
        return await db.getDistratos(filtros);
      }),
    
    // Métricas de distratos para dashboard
    metricasDistratos: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        const filtros = {
          dataInicio: input?.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input?.dataFim ? new Date(input.dataFim) : undefined,
          corretoresIds,
        };
        return await db.getMetricasDistratos(filtros);
      }),
    
    // Relatório detalhado de leads criados por corretor
    relatorioLeadsCriados: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        
        const dataInicio = input?.dataInicio ? new Date(input.dataInicio) : undefined;
        const dataFim = input?.dataFim ? new Date(input.dataFim) : undefined;
        return await db.getRelatorioLeadsCriados(dataInicio, dataFim, corretoresIds);
      }),
  }),

  // ============================================================================
  // GRÁFICOS E MÉTRICAS HISTÓRICAS
  // ============================================================================
  graficos: router({
    // Métricas históricas para gráficos de linha
    historico: gestorProcedure
      .input(z.object({ dias: z.number().default(30) }).optional())
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        return await db.getMetricasHistoricas(input?.dias || 30, corretoresIds);
      }),
    
    // Dados do funil de vendas
    funil: gestorProcedure
      .input(z.object({ dias: z.number().default(30) }).optional())
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        return await db.getEvolucaoFunil(input?.dias || 30, corretoresIds);
      }),
    
    // Performance semanal por corretor (evolução de conversão)
    performanceSemanal: gestorProcedure
      .input(z.object({ numSemanas: z.number().min(2).max(24).default(8) }).optional())
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        return await db.getPerformanceSemanal(input?.numSemanas || 8, corretoresIds);
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
    
    // Buscar todas as metas do mês (filtrado por equipe para gestores)
    getDoMes: gestorProcedure
      .input(z.object({
        mes: z.number(),
        ano: z.number(),
      }))
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        
        const todasMetas = await db.getMetasDoMes(input.mes, input.ano);
        
        // Filtrar por equipe se necessário
        if (corretoresIds !== null) {
          return todasMetas.filter(m => corretoresIds!.includes(m.corretorId));
        }
        
        return todasMetas;
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
    
    // Corretor consulta sua própria meta do mês
    minhaMeta: corretorProcedure
      .input(z.object({
        mes: z.number(),
        ano: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        return await db.getMetaByCorretorMesAno(ctx.user.id, input.mes, input.ano);
      }),
    
    // Corretor define/atualiza sua própria meta do mês
    definirMinhaMeta: corretorProcedure
      .input(z.object({
        mes: z.number().min(1).max(12),
        ano: z.number().min(2020).max(2100),
        metaLeads: z.number().min(0).optional(),
        metaAgendamentos: z.number().min(0).optional(),
        metaVisitas: z.number().min(0).optional(),
        metaContratos: z.number().min(0).optional(),
        metaVGV: z.number().min(0).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { mes, ano, ...metaData } = input;
        const existente = await db.getMetaByCorretorMesAno(ctx.user.id, mes, ano);
        if (existente) {
          await db.updateMeta(existente.id, metaData);
          return { success: true, action: 'updated' };
        } else {
          await db.createMeta({ corretorId: ctx.user.id, mes, ano, ...metaData });
          return { success: true, action: 'created' };
        }
      }),
    
    // Corretor consulta seu progresso no mês atual
    meuProgresso: corretorProcedure
      .input(z.object({
        mes: z.number(),
        ano: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        return await db.getProgressoMeta(ctx.user.id, input.mes, input.ano);
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
        if (!isGestorLevel(ctx.user.role) && ctx.user.id !== input.corretorId) {
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
    
    // Criar tarefa vinculada a um lead (remove lead do follow-up até a data da tarefa)
    createComLead: corretorProcedure
      .input(z.object({
        leadId: z.number(),
        titulo: z.string().min(1),
        descricao: z.string().optional(),
        tipo: z.enum(["follow_up", "agendamento", "ligacao", "whatsapp", "email", "visita", "documentacao", "outro"]).default("outro"),
        dataAgendada: z.date(),
        prioridade: z.enum(["baixa", "media", "alta"]).default("media"),
      }))
      .mutation(async ({ ctx, input }) => {
        // Criar a tarefa
        const id = await db.createTarefa({
          ...input,
          corretorId: ctx.user.id,
        });
        
        // Atualizar o lead para que saia do follow-up até a data da tarefa
        await db.updateLeadProximaTarefaData(input.leadId, input.dataAgendada);
        
        return { success: true, id };
      }),
    
    // Concluir tarefa
    concluir: corretorProcedure
      .input(z.object({
        id: z.number(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Buscar a tarefa para pegar o leadId
        const tarefa = await db.getTarefaById(input.id);
        
        // Concluir a tarefa
        await db.concluirTarefa(input.id, input.observacoes);
        
        // Se a tarefa estava vinculada a um lead, limpar proximaTarefaData para voltar ao follow-up
        if (tarefa?.leadId) {
          await db.updateLeadProximaTarefaData(tarefa.leadId, null);
        }
        
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
    // Listar progresso de todos os corretores (filtrado por equipe para gestores)
    listarProgressoEquipe: gestorProcedure
      .query(async ({ ctx }) => {
        const { inicioDoDiaHoje } = await import('./timezone');
        const hoje = inicioDoDiaHoje();
        const amanha = new Date(hoje);
        amanha.setDate(amanha.getDate() + 1);
        
        // Buscar corretores ativos (filtrado por equipe se for gestor/superintendente)
        let corretores;
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const _filtroIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        if (_filtroIds !== null) {
          corretores = await db.getCorretoresByIds(_filtroIds);
        } else {
          corretores = await db.getCorretoresAtivos();
        }
        
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
        
        // Verificar se o corretor já fez a escolha diária de follow-up
        const { escolhaDiariaFollowUp } = await import('../drizzle/schema');
        const { and: andOp, eq: eqOp, gte: gteOp, lt: ltOp } = await import('drizzle-orm');
        const { getDb } = await import('./db');
        const database = await getDb();
        
        let escolhaHoje = null;
        if (database) {
          const escolhas = await database.select()
            .from(escolhaDiariaFollowUp)
            .where(andOp(
              eqOp(escolhaDiariaFollowUp.corretorId, ctx.user.id),
              gteOp(escolhaDiariaFollowUp.data, hoje),
              ltOp(escolhaDiariaFollowUp.data, amanha)
            ))
            .limit(1);
          escolhaHoje = escolhas[0] || null;
        }
        
        // TOTAL: Contar TODOS os follow-ups do dia
        const totalFollowUps = await db.getTotalFollowUpsDoDia(ctx.user.id, hoje, amanha);
        const total = totalFollowUps.length;
        
        // CONCLUÍDOS: Follow-ups que foram registrados HOJE (ultimaTentativa atualizada hoje)
        const concluidos = totalFollowUps.filter(f => {
          if (!f.ultimaTentativa) return false;
          const ultimaTentativaDate = new Date(f.ultimaTentativa);
          return ultimaTentativaDate >= hoje && ultimaTentativaDate < amanha;
        }).length;
        
        // Percentual baseado no total de follow-ups do dia
        const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 100;
        
        // Se o corretor escolheu NÃO fazer follow-up hoje, desbloqueia imediatamente
        // Se ainda não escolheu (escolhaHoje === null), precisa mostrar o modal
        // Se escolheu SIM, segue a lógica normal de bloqueio
        const recusouFollowUp = escolhaHoje?.aceitouFollowUp === false;
        const desbloqueado = recusouFollowUp || total === 0 || percentual >= 100;
        
        return {
          total,
          concluidos,
          percentual,
          desbloqueado,
          // Nova flag: indica se o corretor já fez a escolha diária
          escolhaDiariaFeita: escolhaHoje !== null,
          // Se fez, qual foi a escolha
          aceitouFollowUp: escolhaHoje?.aceitouFollowUp ?? null,
        };
      }),
    
    // Registrar escolha diária de follow-up (Sim ou Não)
    registrarEscolhaDiaria: corretorProcedure
      .input(z.object({
        aceitouFollowUp: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { inicioDoDiaHoje } = await import('./timezone');
        const hoje = inicioDoDiaHoje();
        const amanha = new Date(hoje);
        amanha.setDate(amanha.getDate() + 1);
        
        const { escolhaDiariaFollowUp } = await import('../drizzle/schema');
        const { and: andOp, eq: eqOp, gte: gteOp, lt: ltOp } = await import('drizzle-orm');
        const { getDb } = await import('./db');
        const database = await getDb();
        if (!database) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        
        // Verificar se já existe escolha para hoje
        const existente = await database.select()
          .from(escolhaDiariaFollowUp)
          .where(andOp(
            eqOp(escolhaDiariaFollowUp.corretorId, ctx.user.id),
            gteOp(escolhaDiariaFollowUp.data, hoje),
            ltOp(escolhaDiariaFollowUp.data, amanha)
          ))
          .limit(1);
        
        if (existente.length > 0) {
          // Atualizar escolha existente
          await database.update(escolhaDiariaFollowUp)
            .set({ aceitouFollowUp: input.aceitouFollowUp })
            .where(eqOp(escolhaDiariaFollowUp.id, existente[0].id));
        } else {
          // Inserir nova escolha
          await database.insert(escolhaDiariaFollowUp).values({
            corretorId: ctx.user.id,
            data: hoje,
            aceitouFollowUp: input.aceitouFollowUp,
          });
        }
        
        return { success: true, aceitouFollowUp: input.aceitouFollowUp };
      }),
    
    // Relatório de escolhas diárias (para gestores)
    getRelatorioEscolhasDiarias: gestorProcedure
      .input(z.object({
        dataInicio: z.date().optional(),
        dataFim: z.date().optional(),
        corretorId: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        // Período padrão: últimos 30 dias
        const hoje = new Date();
        const dataFim = input?.dataFim || hoje;
        const dataInicio = input?.dataInicio || new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);

        console.log('[Relatório] Buscando escolhas entre', dataInicio.toISOString(), 'e', dataFim.toISOString());

        // Buscar escolhas usando helper
        const escolhas = await db.getEscolhasDiarias({
          dataInicio,
          dataFim,
          corretorId: input?.corretorId,
        });

        console.log('[Relatório] Encontradas', escolhas.length, 'escolhas');

        // Calcular estatísticas
        const totalEscolhas = escolhas.length;
        const totalAceitou = escolhas.filter(e => e.aceitouFollowUp === 1 || e.aceitouFollowUp === true).length;
        const totalRecusou = escolhas.filter(e => e.aceitouFollowUp === 0 || e.aceitouFollowUp === false).length;
        const taxaAdesao = totalEscolhas > 0 ? (totalAceitou / totalEscolhas) * 100 : 0;

        // Agrupar por corretor
        const porCorretor: Record<number, any> = {};
        
        escolhas.forEach(escolha => {
          const key = escolha.corretorId;
          if (!porCorretor[key]) {
            porCorretor[key] = {
              corretorId: escolha.corretorId,
              nome: escolha.nome || 'Sem nome',
              foto: escolha.foto,
              totalEscolhas: 0,
              totalAceitou: 0,
              totalRecusou: 0,
              taxaAdesao: 0,
            };
          }
          
          porCorretor[key].totalEscolhas++;
          
          if (escolha.aceitouFollowUp === 1 || escolha.aceitouFollowUp === true) {
            porCorretor[key].totalAceitou++;
          } else {
            porCorretor[key].totalRecusou++;
          }
          
          porCorretor[key].taxaAdesao = (porCorretor[key].totalAceitou / porCorretor[key].totalEscolhas) * 100;
        });

        return {
          escolhas,
          estatisticas: {
            totalEscolhas,
            totalAceitou,
            totalRecusou,
            taxaAdesao: Math.round(taxaAdesao * 10) / 10,
          },
          porCorretor: Object.values(porCorretor),
        };
      }),
  }),

  // ============================================================================
  // HISTÓRICO DE DISTRIBUIÇÃO
  // ============================================================================
  historicoDistribuicao: router({
    // Listar histórico de distribuições (filtrado por equipe para gestores)
    list: gestorProcedure
      .input(z.object({
        dataInicio: z.date().optional(),
        dataFim: z.date().optional(),
        corretorId: z.number().optional(),
        tipo: z.enum(['automatica', 'manual', 'inicial']).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        
        const historico = await db.getHistoricoDistribuicao(input);
        
        // Filtrar por equipe se necessário
        if (corretoresIds !== null) {
          return {
            ...historico,
            items: historico.items.filter(h => corretoresIds!.includes(h.corretorId))
          };
        }
        
        return historico;
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
    // Ranking completo de corretores com fotos (para Performance TV / Ranking TV)
    // Admin vê tudo, gestor vê apenas seu time, corretor não tem acesso
    getCompleto: gestorProcedure
      .input(z.object({
        mes: z.number().nullable().optional(),
        ano: z.number().nullable().optional(),
        dataInicio: z.date().nullable().optional(),
        dataFim: z.date().nullable().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        return await db.getRankingCorretores(input?.mes, input?.ano, input?.dataInicio, input?.dataFim, corretoresIds);
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
    // Admin vê tudo, gestor vê apenas seu time, corretor não tem acesso
    porPeriodo: gestorProcedure
      .input(z.object({
        dataInicio: z.date().optional(),
        dataFim: z.date().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        return await db.getRankingPorPeriodo(input?.dataInicio, input?.dataFim, corretoresIds);
      }),
    
    // Ranking semanal (gestor vê apenas seu time)
    semanal: gestorProcedure
      .query(async () => {
        return await db.getRankingSemanal();
      }),
    
    // Ranking mensal (gestor vê apenas seu time)
    mensal: gestorProcedure
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
    // Listar metas diárias de todos os corretores (filtrado por equipe para gestores)
    list: gestorProcedure
      .query(async ({ ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        
        const todasMetas = await db.getMetasDiarias();
        
        // Filtrar por equipe se necessário
        if (corretoresIds !== null) {
          return todasMetas.filter(m => corretoresIds!.includes(m.corretorId));
        }
        
        return todasMetas;
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
  alertasProdutividade: router({
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
  // BUSCA DE LEADS (para autocomplete)
  // ============================================================================
  searchLeads: router({
    // Buscar por telefone
    byTelefone: corretorProcedure
      .input(z.object({ telefone: z.string() }))
      .query(async ({ ctx, input }) => {
        const isGestor = isGestorLevel(ctx.user.role);
        return await db.searchLeadByTelefone(input.telefone, isGestor ? undefined : ctx.user.id);
      }),
    
    // Buscar por email
    byEmail: corretorProcedure
      .input(z.object({ email: z.string() }))
      .query(async ({ ctx, input }) => {
        const isGestor = isGestorLevel(ctx.user.role);
        return await db.searchLeadByEmail(input.email, isGestor ? undefined : ctx.user.id);
      }),
    
    // Buscar por CPF
    byCpf: corretorProcedure
      .input(z.object({ cpf: z.string() }))
      .query(async ({ ctx, input }) => {
        const isGestor = isGestorLevel(ctx.user.role);
        return await db.searchLeadByCpf(input.cpf, isGestor ? undefined : ctx.user.id);
      }),
    
    // Buscar por qualquer identificador (telefone, email, CPF ou nome)
    byIdentifier: corretorProcedure
      .input(z.object({ query: z.string() }))
      .query(async ({ ctx, input }) => {
        const isGestor = isGestorLevel(ctx.user.role);
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
  // SINCRONIZAÇÃO BI (GOOGLE SHEETS PARA POWER BI / LOOKER STUDIO)
  // ============================================================================
  biSync: router({
    // Testar conexão
    testConnection: gestorProcedure
      .query(async () => {
        return await biSync.testBIConnection();
      }),
    
    // Sincronizar contratos
    syncContratos: gestorProcedure
      .mutation(async () => {
        const result = await biSync.syncContratos();
        return {
          success: result.errors === 0,
          message: `${result.success} contratos sincronizados, ${result.errors} erros`,
          ...result
        };
      }),
    
    // Sincronizar métricas diárias
    syncMetricas: gestorProcedure
      .input(z.object({ dias: z.number().default(90) }).optional())
      .mutation(async ({ input }) => {
        const result = await biSync.syncMetricasDiarias(input?.dias || 90);
        return {
          success: result.errors === 0,
          message: `${result.success} dias de métricas sincronizados, ${result.errors} erros`,
          ...result
        };
      }),
    
    // Sincronizar performance dos corretores
    syncPerformance: gestorProcedure
      .mutation(async () => {
        const result = await biSync.syncPerformanceCorretores();
        return {
          success: result.errors === 0,
          message: `${result.success} corretores sincronizados, ${result.errors} erros`,
          ...result
        };
      }),
    
    // Sincronizar tudo (Contratos + Métricas + Performance)
    syncAll: gestorProcedure
      .mutation(async () => {
        const result = await biSync.syncAllBI();
        const totalSuccess = result.contratos.success + result.metricas.success + result.performance.success;
        const totalErrors = result.contratos.errors + result.metricas.errors + result.performance.errors;
        
        return {
          success: totalErrors === 0,
          message: `Sincronização completa: ${result.contratos.success} contratos, ${result.metricas.success} dias de métricas, ${result.performance.success} corretores`,
          ...result
        };
      }),
    
    // Obter URL da planilha
    getSpreadsheetUrl: gestorProcedure
      .query(() => {
        return {
          url: "https://docs.google.com/spreadsheets/d/1or0l4OToJUsGW8FpyGjSOovjc27riV4Wmi0YWQze8X8",
          spreadsheetId: "1or0l4OToJUsGW8FpyGjSOovjc27riV4Wmi0YWQze8X8"
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
        
        // Buscar lead para verificar status anterior
        const leadAntes = await db.getLeadById(leadId);
        
        // Atualizar status do lead para "agendado" se ainda não estiver
        // Criar data corretamente para evitar problemas de fuso horário
        const [anoFollowup, mesFollowup, diaFollowup] = input.data.split('-').map(Number);
        const [horaFollowup, minutoFollowup] = input.hora.split(':').map(Number);
        const dataFollowup = new Date(anoFollowup, mesFollowup - 1, diaFollowup, horaFollowup, minutoFollowup, 0);
        
        await db.updateLead(leadId, { 
          status: 'agendado',
          proximoFollowup: dataFollowup
        });
        
        // Registrar alteração de status se mudou
        if (leadAntes && leadAntes.status !== 'agendado') {
          await db.registrarAlteracaoStatus({
            leadId,
            corretorId: link.corretorId,
            statusAnterior: leadAntes.status,
            statusNovo: 'agendado',
            observacoes: `Status alterado automaticamente ao criar agendamento via autoagendamento para ${input.data} às ${input.hora}`
          });
        }
        
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
        
        // Sincronizar agendamentos do dia com atividades diárias
        await db.sincronizarAgendamentosDoDia();
        
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
  // SINCRONIZAÇÃO HISTÓRICA
  // ============================================================================
  
  syncHistorico: router({
    // Executar sincronização histórica completa (apenas gestor)
    executar: gestorProcedure
      .mutation(async () => {
        const { executarSincronizacaoHistorica } = await import('./syncHistorico');
        const resultado = await executarSincronizacaoHistorica();
        return resultado;
      }),
  }),

  // ============================================================================
  // LOGS DE TRANSFERÊNCIAS AUTOMÁTICAS
  // ============================================================================
  
  logTransferencias: router({
    list: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        corretorOrigemId: z.number().optional(),
        corretorDestinoId: z.number().optional(),
        motivo: z.enum(["2_dias_sem_interacao", "sem_corretores_disponiveis"]).optional(),
        statusFinal: z.enum(["transferido", "perdido"]).optional(),
        limit: z.number().default(100),
        offset: z.number().default(0),
      }))
      .query(async ({ input }) => {
        return await db.getLogTransferencias(input);
      }),
    
    count: gestorProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        corretorOrigemId: z.number().optional(),
        corretorDestinoId: z.number().optional(),
        motivo: z.enum(["2_dias_sem_interacao", "sem_corretores_disponiveis"]).optional(),
        statusFinal: z.enum(["transferido", "perdido"]).optional(),
      }))
      .query(async ({ input }) => {
        return await db.countLogTransferencias(input);
      }),

    // Painel de redistribuições do dia para o gestor
    painel: gestorProcedure
      .input(z.object({
        periodo: z.enum(['hoje', 'semana', 'mes']).default('hoje'),
      }).optional())
      .query(async ({ input }) => {
        const { eq, and, isNotNull, sql } = await import('drizzle-orm');
        const { logTransferencias, leads } = await import('../drizzle/schema');
        const { getDb } = await import('./db');
        const db2 = await getDb();
        if (!db2) return { total: 0, transferidos: 0, paraEstoque: 0, porCorretor: [], porMotivo: [] };

        const periodo = input?.periodo || 'hoje';
        const agora = new Date();
        let dataInicio: Date;
        if (periodo === 'hoje') {
          dataInicio = new Date(agora);
          dataInicio.setHours(0, 0, 0, 0);
        } else if (periodo === 'semana') {
          dataInicio = new Date(agora);
          dataInicio.setDate(agora.getDate() - 7);
        } else {
          dataInicio = new Date(agora);
          dataInicio.setDate(agora.getDate() - 30);
        }

        // Filtrar apenas leads com origem Facebook via JOIN
        const [totais] = await db2
          .select({
            total: sql<number>`COUNT(*)`,
            transferidos: sql<number>`SUM(CASE WHEN ${logTransferencias.statusFinal} = 'transferido' THEN 1 ELSE 0 END)`,
            paraEstoque: sql<number>`SUM(CASE WHEN ${logTransferencias.statusFinal} = 'estoque' THEN 1 ELSE 0 END)`,
          })
          .from(logTransferencias)
          .innerJoin(leads, eq(logTransferencias.leadId, leads.id))
          .where(and(
            sql`${logTransferencias.dataTransferencia} >= ${dataInicio}`,
            eq(leads.origem, 'facebook')
          ));

        const porCorretor = await db2
          .select({
            corretorOrigemId: logTransferencias.corretorOrigemId,
            corretorOrigemNome: logTransferencias.corretorOrigemNome,
            total: sql<number>`COUNT(*)`,
            transferidos: sql<number>`SUM(CASE WHEN ${logTransferencias.statusFinal} = 'transferido' THEN 1 ELSE 0 END)`,
          })
          .from(logTransferencias)
          .innerJoin(leads, eq(logTransferencias.leadId, leads.id))
          .where(and(
            sql`${logTransferencias.dataTransferencia} >= ${dataInicio}`,
            isNotNull(logTransferencias.corretorOrigemId),
            eq(leads.origem, 'facebook')
          ))
          .groupBy(logTransferencias.corretorOrigemId, logTransferencias.corretorOrigemNome)
          .orderBy(sql`COUNT(*) DESC`)
          .limit(20);

        const porMotivo = await db2
          .select({
            motivo: logTransferencias.motivo,
            total: sql<number>`COUNT(*)`,
          })
          .from(logTransferencias)
          .innerJoin(leads, eq(logTransferencias.leadId, leads.id))
          .where(and(
            sql`${logTransferencias.dataTransferencia} >= ${dataInicio}`,
            eq(leads.origem, 'facebook')
          ))
          .groupBy(logTransferencias.motivo)
          .orderBy(sql`COUNT(*) DESC`);

        return {
          total: Number(totais?.total || 0),
          transferidos: Number(totais?.transferidos || 0),
          paraEstoque: Number(totais?.paraEstoque || 0),
          porCorretor: porCorretor.map(c => ({
            id: c.corretorOrigemId,
            nome: c.corretorOrigemNome || 'Desconhecido',
            total: Number(c.total),
            transferidos: Number(c.transferidos),
          })),
          porMotivo: porMotivo.map(m => ({
            motivo: m.motivo,
            total: Number(m.total),
          })),
        };
      }),
  }),

  // ============================================================================
  // PUSH NOTIFICATIONS
  // ============================================================================
  
  push: router({
    // Obter VAPID public key
    getPublicKey: publicProcedure
      .query(async () => {
        const { getVapidPublicKey } = await import('./pushNotifications');
        return { publicKey: getVapidPublicKey() };
      }),
    
    // Salvar subscription
    subscribe: protectedProcedure
      .input(z.object({
        subscription: z.object({
          endpoint: z.string(),
          keys: z.object({
            p256dh: z.string(),
            auth: z.string(),
          }),
        }),
        userAgent: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { saveSubscription } = await import('./pushNotifications');
        return await saveSubscription(ctx.user.id, input.subscription, input.userAgent);
      }),
    
    // Remover subscription
    unsubscribe: protectedProcedure
      .input(z.object({
        endpoint: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { removeSubscription } = await import('./pushNotifications');
        await removeSubscription(input.endpoint);
        return { success: true };
      }),
    
    // Enviar notificação de teste
    sendTest: protectedProcedure
      .mutation(async ({ ctx }) => {
        const { sendPushNotification } = await import('./pushNotifications');
        return await sendPushNotification(ctx.user.id, {
          title: 'Notificação de Teste',
          body: 'Se você está vendo isso, as notificações push estão funcionando! 🎉',
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          url: '/',
        });
      }),
   }),

  // ============================================================================
  // PORTAL DE PROJETOS IMOBILIÁRIOS - TABELÕES
  // ============================================================================

  tabeloes: router({
    // Listar tabelões (admin)
    list: adminProcedure
      .input(z.object({
        construtoraId: z.number().optional(),
        status: z.enum(['pendente', 'processando', 'concluido', 'erro']).optional(),
        mes: z.number().optional(),
        ano: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const { tabeloes, construtoras } = await import('../drizzle/schema');
        const { db } = await import('./db');
        const { eq, and } = await import('drizzle-orm');
        
        let conditions = [];
        
        if (input.construtoraId) {
          conditions.push(eq(tabeloes.construtoraId, input.construtoraId));
        }
        if (input.status) {
          conditions.push(eq(tabeloes.statusProcessamento, input.status));
        }
        if (input.mes) {
          conditions.push(eq(tabeloes.mes, input.mes));
        }
        if (input.ano) {
          conditions.push(eq(tabeloes.ano, input.ano));
        }
        
        const result = await db
          .select({
            tabelao: tabeloes,
            construtora: construtoras,
          })
          .from(tabeloes)
          .leftJoin(construtoras, eq(tabeloes.construtoraId, construtoras.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(tabeloes.ano, tabeloes.mes);
        
        return result;
      }),
    
    // Criar tabelão (apenas admin)
    create: adminProcedure
      .input(z.object({
        construtoraId: z.number(),
        mes: z.number().min(1).max(12),
        ano: z.number(),
        drivePdfUrl: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { tabeloes } = await import('../drizzle/schema');
        const { db } = await import('./db');
        
        const [result] = await db.insert(tabeloes).values({
          construtoraId: input.construtoraId,
          mes: input.mes,
          ano: input.ano,
          drivePdfUrl: input.drivePdfUrl,
          statusProcessamento: 'pendente',
        }).$returningId();
        
        return { id: result.id };
      }),
    
    // Processar tabelão (apenas admin)
    process: adminProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { processCatalog } = await import('./pdfProcessor');
        
        // Processar em background (não bloquear a resposta)
        processCatalog(input.id).catch(error => {
          console.error(`Erro ao processar tabelão ${input.id}:`, error);
        });
        
        return { success: true, message: 'Processamento iniciado' };
      }),
    
    // Processar todos os tabelões pendentes (apenas admin)
    processAll: adminProcedure
      .mutation(async () => {
        const { processAllPendingCatalogs } = await import('./pdfProcessor');
        
        // Processar em background
        processAllPendingCatalogs().catch(error => {
          console.error('Erro ao processar tabelões:', error);
        });
        
        return { success: true, message: 'Processamento de todos os tabelões iniciado' };
      }),
    
    // Importar tabelões do Google Drive (apenas admin)
    import: adminProcedure
      .mutation(async () => {
        const { importAllTabeloes } = await import('./importadorTabeloes');
        
        const result = await importAllTabeloes();
        
        return {
          success: true,
          message: `Importação concluída: ${result.tabeloes} tabelões, ${result.construtoras} construtoras`,
          ...result,
        };
      }),
  }),

  // ============================================================================
  // PORTAL DE PROJETOS IMOBILIÁRIOS - MATERIAIS
  // ============================================================================

  materiais: router({
    // Listar materiais de um projeto (público)
    byProject: publicProcedure
      .input(z.object({
        projetoId: z.number(),
      }))
      .query(async ({ input }) => {
        const { materiais } = await import('../drizzle/schema');
        const { db } = await import('./db');
        const { eq } = await import('drizzle-orm');
        
        const result = await db
          .select()
          .from(materiais)
          .where(eq(materiais.projetoId, input.projetoId));
        
        return result;
      }),
  }),

  // ============================================================================
  // PORTAL DE PROJETOS IMOBILIÁRIOS - HISTÓRICO DE PREÇOS
  // ============================================================================

  historicosPrecos: router({
    // Obter histórico de preços de um projeto (público)
    byProject: publicProcedure
      .input(z.object({
        projetoId: z.number(),
      }))
      .query(async ({ input }) => {
        const { historicosPrecos } = await import('../drizzle/schema');
        const { db } = await import('./db');
        const { eq } = await import('drizzle-orm');
        
        const result = await db
          .select()
          .from(historicosPrecos)
          .where(eq(historicosPrecos.projetoId, input.projetoId))
          .orderBy(historicosPrecos.ano, historicosPrecos.mes);
        
        return result;
      }),
  }),

  // ============================================================================
  // PORTAL DE PROJETOS IMOBILIÁRIOS - LOGS DE SINCRONIZAÇÃO
  // ============================================================================

  // ============================================================================
  // METAS GLOBAIS E DASHBOARD DE PERFORMANCE
  // ============================================================================
  metasGlobais: router({
    // Buscar meta global do mês/ano
    get: gestorProcedure
      .input(z.object({
        mes: z.number().min(1).max(12),
        ano: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getMetaGlobal(input.mes, input.ano);
      }),
    
    // Atualizar meta global
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        metaVGV: z.string().optional(),
        metaContratos: z.number().optional(),
        metaLeads: z.number().optional(),
        metaAgendamentos: z.number().optional(),
        metaVisitas: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateMetaGlobal(id, data);
      }),
  }),

  dashboardPerformance: router({
    // Dashboard completo de performance
    getData: gestorProcedure
      .input(z.object({
        mes: z.number().min(1).max(12),
        ano: z.number(),
        equipeId: z.number().optional(), // Filtro de equipe (apenas admin pode usar)
      }))
      .query(async ({ input, ctx }) => {
        // Gestor vê sua equipe, superintendente vê suas equipes, admin vê tudo
        const { getCorretoresIdsParaFiltro: _perfFiltro } = await import('./equipes');
        const perfCorretoresIds = await _perfFiltro(ctx.user.id, ctx.user.role);
        const equipeId = ctx.user.role === 'gestor' ? (ctx.user.equipeId || undefined) : (ctx.user.role === 'admin' ? input.equipeId : undefined);
        return await db.getDashboardPerformance(input.mes, input.ano, equipeId, perfCorretoresIds || undefined);
      }),
    
    // Evolução mensal de VGV
    evolucaoMensal: gestorProcedure
      .input(z.object({
        ano: z.number(),
        equipeId: z.number().optional(), // Filtro de equipe (apenas admin pode usar)
      }))
      .query(async ({ input, ctx }) => {
        // Gestor vê sua equipe, superintendente vê suas equipes, admin vê tudo
        const { getCorretoresIdsParaFiltro: _evolFiltro } = await import('./equipes');
        const evolCorretoresIds = await _evolFiltro(ctx.user.id, ctx.user.role);
        const evolEquipeId = ctx.user.role === 'gestor' ? (ctx.user.equipeId || undefined) : (ctx.user.role === 'admin' ? input.equipeId : undefined);
        return await db.getEvolucaoMensalVGV(input.ano, evolEquipeId, evolCorretoresIds || undefined);
      }),
  }),

  logsSincronizacao: router({
    // Listar logs (admin)
    list: adminProcedure
      .input(z.object({
        limit: z.number().optional().default(50),
        status: z.enum(['sucesso', 'erro', 'aviso']).optional(),
      }))
      .query(async ({ input }) => {
        const { logsSincronizacao } = await import('../drizzle/schema');
        const { db } = await import('./db');
        const { eq, desc } = await import('drizzle-orm');
        
        let query = db.select().from(logsSincronizacao);
        
        if (input.status) {
          query = query.where(eq(logsSincronizacao.status, input.status));
        }
        
        const result = await query
          .orderBy(desc(logsSincronizacao.createdAt))
          .limit(input.limit);
        
        return result;
      }),
  }),

  // ============================================================================
  // SISTEMA DE REATRIBUIÇÃO DE LEADS E CONTRATOS
  // ============================================================================
  reatribuicao: router({
    // Reatribuir lead para outro corretor (gestor/admin)
    reatribuirLead: gestorProcedure
      .input(z.object({
        leadId: z.number(),
        novoCorretorId: z.number(),
        motivo: z.string().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { leads, transferHistory, contratos } = await import('../drizzle/schema');
        const dbModule = await import('./db');
        const db = await dbModule.getDb();
        if (!db) throw new Error('Database not available');
        const { eq } = await import('drizzle-orm');
        
        // Buscar lead atual
        const leadAtual = await db.select().from(leads).where(eq(leads.id, input.leadId)).limit(1);
        if (!leadAtual.length) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
        }
        
        const corretorAnteriorId = leadAtual[0].corretorId;
        
        if (!corretorAnteriorId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Lead não possui corretor atribuído' });
        }
        
        if (corretorAnteriorId === input.novoCorretorId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'O novo corretor é o mesmo que o atual' });
        }
        
        // Cancelar follow-ups pendentes do corretor anterior antes de reatribuir
        const dbHelpers = await import('./db');
        await dbHelpers.cancelarFollowUpsPorTransferencia(input.leadId, corretorAnteriorId);
        
        // Atualizar lead
        await db
          .update(leads)
          .set({ 
            corretorId: input.novoCorretorId,
            dataDistribuicao: new Date(),
            timestampRecebimento: new Date(),
          })
          .where(eq(leads.id, input.leadId));
        
        // Registrar transferência no histórico
        await db.insert(transferHistory).values({
          tipo: 'lead',
          leadId: input.leadId,
          contratoId: null,
          corretorAnteriorId,
          corretorNovoId: input.novoCorretorId,
          transferidoPorId: ctx.user.id,
          motivo: input.motivo || 'Reatribuição manual',
          observacoes: input.observacoes,
        });
        
        // Se o lead tem contrato, atualizar também
        const contratoExistente = await db.select().from(contratos).where(eq(contratos.leadId, input.leadId)).limit(1);
        if (contratoExistente.length) {
          await db
            .update(contratos)
            .set({ corretorId: input.novoCorretorId })
            .where(eq(contratos.leadId, input.leadId));
        }
        
        return { success: true, leadId: input.leadId };
      }),
    
    // Reatribuir contrato para outro corretor (gestor/admin)
    reatribuirContrato: gestorProcedure
      .input(z.object({
        contratoId: z.number(),
        novoCorretorId: z.number(),
        motivo: z.string().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { contratos, transferHistory, leads } = await import('../drizzle/schema');
        const dbModule = await import('./db');
        const db = await dbModule.getDb();
        if (!db) throw new Error('Database not available');
        const { eq } = await import('drizzle-orm');
        
        // Buscar contrato atual
        const contratoAtual = await db.select().from(contratos).where(eq(contratos.id, input.contratoId)).limit(1);
        if (!contratoAtual.length) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Contrato não encontrado' });
        }
        
        const corretorAnteriorId = contratoAtual[0].corretorId;
        
        if (corretorAnteriorId === input.novoCorretorId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'O novo corretor é o mesmo que o atual' });
        }
        
        // Atualizar contrato
        await db
          .update(contratos)
          .set({ corretorId: input.novoCorretorId })
          .where(eq(contratos.id, input.contratoId));
        
        // Atualizar lead correspondente se existir
        const leadId = contratoAtual[0].leadId;
        if (leadId) {
          await db
            .update(leads)
            .set({ 
              corretorId: input.novoCorretorId,
              dataDistribuicao: new Date(),
            })
            .where(eq(leads.id, leadId));
        }
        
        // Registrar transferência no histórico
        await db.insert(transferHistory).values({
          tipo: 'contrato',
          leadId: leadId || null,
          contratoId: input.contratoId,
          corretorAnteriorId,
          corretorNovoId: input.novoCorretorId,
          transferidoPorId: ctx.user.id,
          motivo: input.motivo || 'Reatribuição manual de contrato',
          observacoes: input.observacoes,
        });
        
        return { success: true, contratoId: input.contratoId };
      }),
    
    // Listar histórico de transferências (gestor/admin)
    listarHistorico: gestorProcedure
      .input(z.object({
        tipo: z.enum(['lead', 'contrato']).optional(),
        leadId: z.number().optional(),
        contratoId: z.number().optional(),
        corretorId: z.number().optional(),
        limit: z.number().optional().default(50),
      }))
      .query(async ({ input }) => {
        const { transferHistory, users, leads } = await import('../drizzle/schema');
        const dbModule = await import('./db');
        const db = await dbModule.getDb();
        if (!db) throw new Error('Database not available');
        const { eq, and, desc } = await import('drizzle-orm');
        
        const conditions = [];
        
        if (input.tipo) {
          conditions.push(eq(transferHistory.tipo, input.tipo));
        }
        if (input.leadId) {
          conditions.push(eq(transferHistory.leadId, input.leadId));
        }
        if (input.contratoId) {
          conditions.push(eq(transferHistory.contratoId, input.contratoId));
        }
        if (input.corretorId) {
          conditions.push(
            eq(transferHistory.corretorAnteriorId, input.corretorId)
          );
        }
        
        const result = await db
          .select({
            id: transferHistory.id,
            tipo: transferHistory.tipo,
            leadId: transferHistory.leadId,
            leadNome: leads.nome,
            contratoId: transferHistory.contratoId,
            corretorAnteriorId: transferHistory.corretorAnteriorId,
            corretorNovoId: transferHistory.corretorNovoId,
            transferidoPorId: transferHistory.transferidoPorId,
            motivo: transferHistory.motivo,
            observacoes: transferHistory.observacoes,
            createdAt: transferHistory.createdAt,
          })
          .from(transferHistory)
          .leftJoin(leads, eq(transferHistory.leadId, leads.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(transferHistory.createdAt))
          .limit(input.limit);
        
        return result;
      }),
  }),

  // ============================================================================
  // SISTEMA DE ALERTAS PARA CORRETORES
  // ============================================================================
  alertas: router({
    // Enviar alerta para corretor (admin/gestor)
    enviar: gestorProcedure
      .input(z.object({
        leadId: z.number(),
        corretorId: z.number(),
        mensagem: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { alertas, leads } = await import('../drizzle/schema');
        const dbModule = await import('./db');
        const db = await dbModule.getDb();
        if (!db) throw new Error('Database not available');
        const { eq } = await import('drizzle-orm');
        
        // Buscar informações do lead
        const lead = await db.select().from(leads).where(eq(leads.id, input.leadId)).limit(1);
        if (!lead.length) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
        }
        
        const mensagem = input.mensagem || `Atenda urgentemente o lead ${lead[0].nome} que está aguardando atendimento!`;
        
        // Proteção anti-duplicata: não criar alerta se já existe um não lido para este lead/corretor nos últimos 2 minutos
        const { and, gt } = await import('drizzle-orm');
        const doisMinutosAtras = new Date(Date.now() - 2 * 60 * 1000);
        const alertaRecente = await db
          .select({ id: alertas.id })
          .from(alertas)
          .where(
            and(
              eq(alertas.leadId, input.leadId),
              eq(alertas.corretorId, input.corretorId),
              eq(alertas.lido, false),
              gt(alertas.createdAt, doisMinutosAtras)
            )
          )
          .limit(1);
        
        if (alertaRecente.length > 0) {
          // Alerta recente já existe — não criar duplicata
          return { success: true, duplicata: true };
        }
        
        // Criar alerta
        await db.insert(alertas).values({
          leadId: input.leadId,
          corretorId: input.corretorId,
          remetenteId: ctx.user.id,
          mensagem,
          lido: false,
        });
        
        return { success: true, duplicata: false };
      }),
    
    // Listar alertas do corretor logado
    meus: protectedProcedure
      .input(z.object({
        apenasNaoLidos: z.boolean().optional().default(true),
      }))
      .query(async ({ input, ctx }) => {
        const { alertas, leads } = await import('../drizzle/schema');
        const dbModule = await import('./db');
        const db = await dbModule.getDb();
        if (!db) return [];
        const { eq, and, desc } = await import('drizzle-orm');
        
        let conditions = [eq(alertas.corretorId, ctx.user.id)];
        
        if (input.apenasNaoLidos) {
          conditions.push(eq(alertas.lido, false));
        }
        
        const result = await db
          .select({
            id: alertas.id,
            leadId: alertas.leadId,
            leadNome: leads.nome,
            mensagem: alertas.mensagem,
            lido: alertas.lido,
            lidoEm: alertas.lidoEm,
            createdAt: alertas.createdAt,
          })
          .from(alertas)
          .leftJoin(leads, eq(alertas.leadId, leads.id))
          .where(and(...conditions))
          .orderBy(desc(alertas.createdAt));
        
        return result;
      }),
    
    // Marcar alerta como lido
    marcarLido: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { alertas } = await import('../drizzle/schema');
        const dbModule = await import('./db');
        const db = await dbModule.getDb();
        if (!db) throw new Error('Database not available');
        const { eq, and } = await import('drizzle-orm');
        
        await db
          .update(alertas)
          .set({ lido: true, lidoEm: new Date() })
          .where(and(
            eq(alertas.id, input.id),
            eq(alertas.corretorId, ctx.user.id)
          ));
        
        return { success: true };
      }),
  }),

  // ============================================================================
  // LIMPEZA DE DUPLICATAS
  // ============================================================================
  
  duplicatas: router({
    // Estatísticas de duplicatas (apenas admin)
    stats: adminProcedure.query(async () => {
      return await duplicatasCleanup.getEstatisticasDuplicatas();
    }),
    
    // Listar grupos de duplicatas por telefone (apenas admin)
    listByTelefone: adminProcedure.query(async () => {
      return await duplicatasCleanup.identificarDuplicatasPorTelefone();
    }),
    
    // Listar grupos de duplicatas por email (apenas admin)
    listByEmail: adminProcedure.query(async () => {
      return await duplicatasCleanup.identificarDuplicatasPorEmail();
    }),
    
    // Mesclar leads duplicados (apenas admin)
    merge: adminProcedure
      .input(z.object({
        leadPrincipalId: z.number(),
        leadsDuplicadosIds: z.array(z.number()),
      }))
      .mutation(async ({ input }) => {
        return await duplicatasCleanup.mesclarLeadsDuplicados(
          input.leadPrincipalId,
          input.leadsDuplicadosIds
        );
      }),
  }),

  // ============================================================================
  // ATUALIZAÇÃO EM MASSA DE PROJETOS
  // ============================================================================
  
  updateProjetos: router({
    // Estatísticas de leads sem projeto (apenas admin)
    stats: adminProcedure.query(async () => {
      return await updateProjetosEmMassa.getEstatisticasProjetosPendentes();
    }),
    
    // Executar atualização em massa (apenas admin)
    executar: adminProcedure.mutation(async () => {
      return await updateProjetosEmMassa.updateProjetosEmMassa();
    }),
  }),

  // ============================================================================
  // ONBOARDING DE CORRETORES
  // ============================================================================
  
  onboarding: router({    // Verificar se perfil está completo
    verificar: protectedProcedure.query(async ({ ctx }) => {
      return await onboarding.verificarPerfilCompleto(ctx.user.id);
    }),
    
    // Atualizar dados do perfil
    atualizar: protectedProcedure
      .input(z.object({
        // Dados pessoais
        name: z.string().optional(),
        cpf: z.string().optional(),
        dataNascimento: z.coerce.date().optional(),
        email: z.string().email().optional(),
        telefone: z.string().optional(),
        fotoUrl: z.string().optional(),
        
        // Dados profissionais
        creci: z.string().optional(),
        situacao: z.enum(["ativo", "inativo"]).optional(),
        dataCredenciamento: z.coerce.date().optional(),
        dataDescredenciamento: z.coerce.date().optional(),
        status: z.enum(["presente", "ausente"]).optional(),
        
        // Endereço
        cep: z.string().optional(),
        logradouro: z.string().optional(),
        numero: z.string().optional(),
        complemento: z.string().optional(),
        bairro: z.string().optional(),
        cidade: z.string().optional(),
        estado: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await onboarding.atualizarPerfil(ctx.user.id, input);
      }),
    
    // Buscar CEP
    buscarCep: protectedProcedure
      .input(z.object({ cep: z.string() }))
      .query(async ({ input }) => {
        return await onboarding.buscarCEP(input.cep);
      }),
  }),

  // ============================================================================
  // LIMPEZA DE PROJETOS ÓRFÃOS
  // ============================================================================
  
  limparProjetos: router({
    // Identificar projetos órfãos (apenas admin)
    identificar: adminProcedure.query(async () => {
      return await limparProjetosOrfaos.identificarProjetosOrfaos();
    }),
    
    // Executar limpeza de projetos órfãos (apenas admin)
    executar: adminProcedure.mutation(async () => {
      return await limparProjetosOrfaos.limparProjetosOrfaos();
    }),
  }),

  // Backup manual para Google Sheets (apenas admin)
  backup: router({
    executarSheetsBackup: adminProcedure.mutation(async () => {
      const { performSheetsBackup } = await import('./sheetsBackup');
      const result = await performSheetsBackup();
      return result;
    }),
    // Sincronização manual da planilha DRE (apenas admin)
    sincronizarDRE: adminProcedure.mutation(async () => {
      const { sincronizarDRE } = await import('./dreSync');
      const result = await sincronizarDRE();
      return result;
    }),
  }),

  // ============================================================================
  // CENTRAL DE ANÁLISES — NOVO MÓDULO CONSOLIDADO
  // ============================================================================
  centralAnalises: router({
    // Visão Geral: KPIs + Alertas
    visaoGeral: gestorProcedure
      .input(z.object({
        dataInicio: z.string(),
        dataFim: z.string(),
        mes: z.number().min(1).max(12),
        ano: z.number(),
      }))
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        return await analisesCentral.getVisaoGeralKPIs(
          new Date(input.dataInicio),
          new Date(input.dataFim),
          input.mes,
          input.ano,
          corretoresIds
        );
      }),

    // Comparativo de Equipes
    comparativoEquipes: gestorProcedure
      .input(z.object({
        dataInicio: z.string(),
        dataFim: z.string(),
      }))
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        return await analisesCentral.getComparativoEquipes(
          new Date(input.dataInicio),
          new Date(input.dataFim),
          corretoresIds
        );
      }),

    // Funil com Gargalos
    funilGargalos: gestorProcedure
      .input(z.object({
        dataInicio: z.string(),
        dataFim: z.string(),
      }))
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        return await analisesCentral.getFunilComGargalos(
          new Date(input.dataInicio),
          new Date(input.dataFim),
          corretoresIds
        );
      }),

    // Metas com Projeção
    metasProgresso: gestorProcedure
      .input(z.object({
        mes: z.number().min(1).max(12),
        ano: z.number(),
      }))
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        return await analisesCentral.getMetasProgresso(
          input.mes,
          input.ano,
          corretoresIds
        );
      }),

    // Evolução Temporal
    evolucaoTemporal: gestorProcedure
      .input(z.object({
        dataInicio: z.string(),
        dataFim: z.string(),
        agrupamento: z.enum(['dia', 'semana', 'mes']).default('dia'),
      }))
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        return await analisesCentral.getEvolucaoTemporal(
          new Date(input.dataInicio),
          new Date(input.dataFim),
          corretoresIds,
          input.agrupamento
        );
      }),

    // Origens com Conversão
    origensConversao: gestorProcedure
      .input(z.object({
        dataInicio: z.string(),
        dataFim: z.string(),
      }))
      .query(async ({ input, ctx }) => {
        const { getCorretoresIdsParaFiltro } = await import('./equipes');
        const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
        return await analisesCentral.getOrigensComConversao(
          new Date(input.dataInicio),
          new Date(input.dataFim),
          corretoresIds
        );
      }),
  }),
});
export type AppRouter = typeof appRouter;
