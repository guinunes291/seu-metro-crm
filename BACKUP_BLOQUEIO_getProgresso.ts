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
        
