import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";

// ============================================================================
// HELPERS E MIDDLEWARES (copiados do routers.ts principal)
// ============================================================================
function isGestorLevel(role: string): boolean {
  return role === 'gestor' || role === 'admin' || role === 'superintendente';
}
function isAdminLevel(role: string): boolean {
  return role === 'admin' || role === 'superintendente';
}
const gestorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isGestorLevel(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas gestores podem acessar' });
  }
  return next({ ctx });
});
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isAdminLevel(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem acessar' });
  }
  return next({ ctx });
});

// ============================================================================
// ROUTER DE EQUIPES
// ============================================================================
export const equipesRouter = router({

  // EQUIPES
  // ============================================================================
  equipes: router({
    // Listar usuários disponíveis para serem gestores (apenas admin)
    listUsuariosParaGestor: adminProcedure.query(async () => {
      return await db.getAllUsers();
    }),
    
    // DEBUG: Testar filtro de corretores
    testeFiltro: gestorProcedure.query(async ({ ctx }) => {
      const { getCorretoresIdsParaFiltro, getEquipeByGestor, getCorretoresDaEquipe } = await import('../equipes');
      
      const equipe = await getEquipeByGestor(ctx.user.id);
      const corretores = equipe ? await getCorretoresDaEquipe(equipe.id) : [];
      const corretoresIds = await getCorretoresIdsParaFiltro(ctx.user.id, ctx.user.role);
      
      return {
        userId: ctx.user.id,
        userOpenId: ctx.user.openId,
        userName: ctx.user.name,
        userRole: ctx.user.role,
        equipe: equipe ? { id: equipe.id, nome: equipe.nome } : null,
        corretores: corretores.map(c => ({ id: c.id, name: c.name })),
        corretoresIds,
      };
    }),
    
    // DEBUG: Simular filtro como se fosse o gestor (ID 5055943)
    simularGestor: adminProcedure.query(async () => {
      const { getCorretoresIdsParaFiltro, getEquipeByGestor, getCorretoresDaEquipe } = await import('../equipes');
      
      // Simular como gestor ID 5055943 (guilherme.97fn@gmail.com)
      const gestorId = 5055943;
      const gestorRole = 'gestor';
      
      const equipe = await getEquipeByGestor(gestorId);
      const corretores = equipe ? await getCorretoresDaEquipe(equipe.id) : [];
      const corretoresIds = await getCorretoresIdsParaFiltro(gestorId, gestorRole);
      
      // Buscar métricas filtradas usando db.getDashboardMetrics
      const metricas = await db.getDashboardMetrics({ corretoresIds });
      
      return {
        simulandoGestorId: gestorId,
        simulandoRole: gestorRole,
        equipe: equipe ? { id: equipe.id, nome: equipe.nome } : null,
        corretores: corretores.map(c => ({ id: c.id, name: c.name })),
        corretoresIds,
        metricas,
      };
    }),
    
    // Listar equipes:
    // - Admin vê todas
    // - Superintendente vê apenas as equipes sob sua gestão
    // - Gestor vê apenas sua equipe
    list: gestorProcedure.query(async ({ ctx }) => {
      const { listarEquipes, getEquipeByGestor, listarEquipesPorSuperintendente } = await import('../equipes');
      
      if (ctx.user.role === 'admin') {
        return await listarEquipes();
      }
      
      if (ctx.user.role === 'superintendente') {
        return await listarEquipesPorSuperintendente(ctx.user.id);
      }
      
      // Gestor vê apenas sua equipe
      const equipe = await getEquipeByGestor(ctx.user.id);
      return equipe ? [equipe] : [];
    }),
    
    // Buscar equipe por ID
    getById: gestorProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const { getEquipeById, getEquipeByGestor, listarEquipesPorSuperintendente } = await import('../equipes');
        
        // Admin pode ver qualquer equipe
        if (ctx.user.role === 'admin') {
          return await getEquipeById(input.id);
        }
        
        // Superintendente só pode ver equipes sob sua gestão
        if (ctx.user.role === 'superintendente') {
          const equipesSup = await listarEquipesPorSuperintendente(ctx.user.id);
          const equipe = equipesSup.find(e => e.id === input.id);
          if (!equipe) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
          return equipe;
        }
        
        // Gestor só pode ver sua própria equipe
        const equipe = await getEquipeByGestor(ctx.user.id);
        if (!equipe || equipe.id !== input.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
        }
        
        return equipe;
      }),
    
    // Criar equipe (apenas admin)
    create: adminProcedure
      .input(z.object({
        nome: z.string().min(1),
        descricao: z.string().optional(),
        gestorId: z.number(),
        cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#3b82f6'),
        metaMensal: z.number().default(10),
      }))
      .mutation(async ({ input }) => {
        const { createEquipe } = await import('../equipes');
        const id = await createEquipe(input);
        return { id };
      }),
    
    // Atualizar equipe (apenas admin)
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        nome: z.string().min(1).optional(),
        descricao: z.string().optional(),
        gestorId: z.number().optional(),
        cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        metaMensal: z.number().optional(),
        ativa: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { updateEquipe } = await import('../equipes');
        const { id, ...data } = input;
        await updateEquipe(id, data);
        return { success: true };
      }),
    
    // Deletar equipe (apenas admin)
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { deleteEquipe } = await import('../equipes');
        await deleteEquipe(input.id);
        return { success: true };
      }),
    
    // Listar corretores da equipe
    getCorretores: gestorProcedure
      .input(z.object({ equipeId: z.number() }))
      .query(async ({ input, ctx }) => {
        const { getCorretoresDaEquipe, getEquipeByGestor } = await import('../equipes');
        
        // Admin/Superintendente pode ver corretores de qualquer equipe
        if (isAdminLevel(ctx.user.role)) {
          return await getCorretoresDaEquipe(input.equipeId);
        }
        
        // Gestor só pode ver corretores da sua equipe
        const equipe = await getEquipeByGestor(ctx.user.id);
        if (!equipe || equipe.id !== input.equipeId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
        }
        
        return await getCorretoresDaEquipe(input.equipeId);
      }),
    
    // Adicionar corretor à equipe (apenas admin)
    adicionarCorretor: adminProcedure
      .input(z.object({
        corretorId: z.number(),
        equipeId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { adicionarCorretorNaEquipe } = await import('../equipes');
        await adicionarCorretorNaEquipe(input.corretorId, input.equipeId);
        return { success: true };
      }),
    
    // Remover corretor da equipe (apenas admin)
    removerCorretor: adminProcedure
      .input(z.object({ corretorId: z.number() }))
      .mutation(async ({ input }) => {
        const { removerCorretorDaEquipe } = await import('../equipes');
        await removerCorretorDaEquipe(input.corretorId);
        return { success: true };
      }),
    
    // Contar membros da equipe
     contarMembros: gestorProcedure
      .input(z.object({ equipeId: z.number() }))
      .query(async ({ input }) => {
        const { contarMembrosEquipe } = await import('../equipes');
        return await contarMembrosEquipe(input.equipeId);
      }),

    // Listar todos os superintendentes (apenas admin)
    listSuperintendentes: adminProcedure.query(async () => {
      const { listarSuperintendentes } = await import('../equipes');
      return await listarSuperintendentes();
    }),

    // Atribuir superintendente a uma equipe (apenas admin)
    atribuirSuperintendente: adminProcedure
      .input(z.object({
        equipeId: z.number(),
        superintendenteId: z.number().nullable(),
      }))
      .mutation(async ({ input }) => {
        const { atribuirSuperintendenteAEquipe } = await import('../equipes');
        await atribuirSuperintendenteAEquipe(input.equipeId, input.superintendenteId);
        return { success: true };
      }),

    // Listar equipes visíveis para o usuário logado (admin = todas, super = suas, gestor = a sua)
    minhasEquipes: gestorProcedure.query(async ({ ctx }) => {
      const { listarEquipesPorSuperintendente, listarEquipes, getEquipeByGestor } = await import('../equipes');
      if (ctx.user.role === 'admin') {
        return await listarEquipes(true);
      }
      if (ctx.user.role === 'superintendente') {
        return await listarEquipesPorSuperintendente(ctx.user.id);
      }
      const equipe = await getEquipeByGestor(ctx.user.id);
      return equipe ? [equipe] : [];
    }),
  }),
});

// Export individual para montagem direta no appRouter (mantendo o path original)
export const equipesSubRouter = equipesRouter._def.record.equipes;
