import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Timezone SP - Uso correto em db.ts', () => {
  const dbContent = readFileSync(join(__dirname, 'db.ts'), 'utf-8');
  
  // Funções críticas que devem usar timezone SP
  const funcoesCriticas = [
    'incrementarAtividade',
    'adicionarVgvDia',
    'getRankingDia',
    'getRankingSemanal',
    'getRankingMensal',
    'getRankingPorPeriodo',
    'calcularPontuacaoDiaria',
    'getTarefasDoDia',
    'getFollowUpsPendentes',
    'getLeadsAgendadosHoje',
    'getAgendamentosDoDia',
    'getCorretorMetricasHistoricas',
    'getCorretorEvolucaoFunil',
    'getDistribuicoesPorPeriodo',
    'verificarProdutividadeEGerarAlertas',
    'getProgressoMetasDiarias',
    'getPerformanceCorretor',
    'verificarConquistasRanking',
  ];

  it('deve importar timezone em todas as funções críticas', () => {
    for (const funcao of funcoesCriticas) {
      // Encontrar a função no código
      const funcaoRegex = new RegExp(`export async function ${funcao}[^{]*{([\\s\\S]*?)\\nexport`, 'g');
      const match = funcaoRegex.exec(dbContent);
      
      if (match) {
        const corpo = match[1];
        // Verificar que a função importa do timezone OU já usa inicioDoDiaHoje/agora do timezone
        const usaTimezone = corpo.includes("import('./timezone')") || 
                           corpo.includes('import("./timezone")') ||
                           corpo.includes('inicioDoDiaHoje()') ||
                           corpo.includes('fimDoDiaHoje()') ||
                           corpo.includes('agora()');
        
        expect(usaTimezone, `Função ${funcao} deve usar timezone SP`).toBe(true);
      }
    }
  });

  it('não deve usar "new Date(); setHours(0,0,0,0)" para determinar "hoje" nas funções críticas', () => {
    // Padrão problemático: const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    // Esse padrão usa UTC em vez de SP
    
    for (const funcao of funcoesCriticas) {
      const funcaoRegex = new RegExp(`export async function ${funcao}[^{]*{([\\s\\S]*?)\\n(?:export|\\Z)`, 'g');
      const match = funcaoRegex.exec(dbContent);
      
      if (match) {
        const corpo = match[1];
        // Verificar que NÃO tem o padrão "const hoje = new Date();\n  hoje.setHours(0, 0, 0, 0)"
        const temPadraoUTC = /const hoje = new Date\(\);\s*\n\s*hoje\.setHours\(0,\s*0,\s*0,\s*0\)/.test(corpo);
        
        expect(temPadraoUTC, `Função ${funcao} não deve usar new Date() com setHours(0,0,0,0)`).toBe(false);
      }
    }
  });

  it('timezone.ts deve exportar hojeStrSP', () => {
    const tzContent = readFileSync(join(__dirname, 'timezone.ts'), 'utf-8');
    expect(tzContent).toContain('export function hojeStrSP');
  });

  it('timezone.ts deve exportar agoraSP', () => {
    const tzContent = readFileSync(join(__dirname, 'timezone.ts'), 'utf-8');
    expect(tzContent).toContain('export function agoraSP');
  });

  it('timezone.ts deve usar America/Sao_Paulo', () => {
    const tzContent = readFileSync(join(__dirname, 'timezone.ts'), 'utf-8');
    expect(tzContent).toContain('America/Sao_Paulo');
  });

  it('hojeStrSP deve retornar formato YYYY-MM-DD', async () => {
    const { hojeStrSP } = await import('./timezone');
    const resultado = hojeStrSP();
    expect(resultado).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('inicioDoDiaHoje deve retornar início do dia no fuso SP', async () => {
    const { inicioDoDiaHoje } = await import('./timezone');
    const inicio = inicioDoDiaHoje();
    // Em UTC, o início do dia SP (00:00 GMT-3) é 03:00 UTC
    // Verificar que minutos e segundos são 0
    expect(inicio.getMinutes()).toBe(0);
    expect(inicio.getSeconds()).toBe(0);
    // A hora UTC deve ser 3 (00:00 SP = 03:00 UTC) ou 2 (horário de verão)
    const horaUTC = inicio.getUTCHours();
    expect([2, 3]).toContain(horaUTC);
  });

  it('fimDoDiaHoje deve retornar fim do dia no fuso SP', async () => {
    const { fimDoDiaHoje } = await import('./timezone');
    const fim = fimDoDiaHoje();
    // Em UTC, o fim do dia SP (23:59:59 GMT-3) é 02:59:59 UTC do dia seguinte
    expect(fim.getMinutes()).toBe(59);
    expect(fim.getSeconds()).toBe(59);
    // Verificar que fimDoDiaHoje é posterior a inicioDoDiaHoje
    const { inicioDoDiaHoje } = await import('./timezone');
    const inicio = inicioDoDiaHoje();
    expect(fim.getTime()).toBeGreaterThan(inicio.getTime());
  });

  it('escolha diária de follow-up no routers.ts deve usar timezone SP', () => {
    const routersContent = readFileSync(join(__dirname, 'routers.ts'), 'utf-8');
    
    // Verificar que getProgresso usa inicioDoDiaHoje
    const getProgressoMatch = routersContent.match(/getProgresso:[\s\S]*?\.query\(async[\s\S]*?inicioDoDiaHoje/);
    expect(getProgressoMatch, 'getProgresso deve usar inicioDoDiaHoje').toBeTruthy();
    
    // Verificar que registrarEscolhaDiaria usa inicioDoDiaHoje
    const registrarMatch = routersContent.match(/registrarEscolhaDiaria:[\s\S]*?\.mutation\(async[\s\S]*?inicioDoDiaHoje/);
    expect(registrarMatch, 'registrarEscolhaDiaria deve usar inicioDoDiaHoje').toBeTruthy();
  });
});
