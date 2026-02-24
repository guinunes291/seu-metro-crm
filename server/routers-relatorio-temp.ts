// Procedure simplificada para getRelatorioEscolhasDiarias
// Copiar e colar no routers.ts substituindo a procedure existente

getRelatorioEscolhasDiarias: gestorProcedure
  .input(z.object({
    dataInicio: z.date().optional(),
    dataFim: z.date().optional(),
    corretorId: z.number().optional(),
  }).optional())
  .query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
    }

    // Período padrão: últimos 30 dias
    const hoje = new Date();
    const dataFim = input?.dataFim || hoje;
    const dataInicio = input?.dataInicio || new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);

    console.log('[Relatório] Buscando escolhas entre', dataInicio.toISOString(), 'e', dataFim.toISOString());

    // Query SQL simples e direta
    const queryText = `
      SELECT 
        e.corretorId,
        e.data,
        e.aceitouFollowUp,
        u.nome,
        u.foto
      FROM escolha_diaria_follow_up e
      LEFT JOIN users u ON e.corretorId = u.id
      WHERE DATE(e.data) >= DATE(?)
        AND DATE(e.data) <= DATE(?)
        ${input?.corretorId ? 'AND e.corretorId = ?' : ''}
      ORDER BY e.data DESC
    `;

    const params = input?.corretorId 
      ? [dataInicio, dataFim, input.corretorId]
      : [dataInicio, dataFim];

    const result = await db.execute({
      sql: queryText,
      args: params,
    });

    const escolhas = result.rows as any[];

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
