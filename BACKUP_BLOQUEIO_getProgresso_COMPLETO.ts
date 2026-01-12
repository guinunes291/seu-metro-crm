    // Calcular progresso de follow-ups do dia (para bloqueio gamificado)
    getProgresso: corretorProcedure
      .query(async ({ ctx }) => {
        const { inicioDoDiaHoje } = await import('./timezone');
        const hoje = inicioDoDiaHoje();
        const amanha = new Date(hoje);
        amanha.setDate(amanha.getDate() + 1);
        
        // Verificar se já desbloqueou hoje (persistência de desbloqueio)
        const usuario = await db.getUserById(ctx.user.id);
        const ultimoDesbloqueio = usuario?.ultimoDesbloqueio;
        const jaDesbloqueouHoje = ultimoDesbloqueio && 
          new Date(ultimoDesbloqueio) >= hoje && 
          new Date(ultimoDesbloqueio) < amanha;
        
        // Se já desbloqueou hoje, retornar desbloqueado independente do percentual atual
        if (jaDesbloqueouHoje) {
          const totalFollowUps = await db.getTotalFollowUpsDoDia(ctx.user.id, hoje, amanha);
          const total = totalFollowUps.length;
          const concluidos = totalFollowUps.filter(f => {
            if (!f.ultimaTentativa) return false;
            const ultimaTentativaDate = new Date(f.ultimaTentativa);
            return ultimaTentativaDate >= hoje && ultimaTentativaDate < amanha;
          }).length;
          const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 100;
          
          return {
            total,
            concluidos,
            percentual,
            desbloqueado: true, // Forçar desbloqueado se já desbloqueou hoje
          };
        }
        
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
        const desbloqueado = percentual >= 60;
        
        // Se acabou de desbloquear (>=60%), registrar timestamp
        if (desbloqueado && !jaDesbloqueouHoje) {
          await db.updateUser(ctx.user.id, { ultimoDesbloqueio: new Date() });
        }
        
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
