/**
 * notionJob.ts
 * Jobs automáticos de integração com o Notion:
 * - Relatório semanal (toda segunda-feira às 7h, horário de Brasília)
 * - Alerta de inatividade de corretores (diário às 9h)
 */

import { criarRelatorioSemanal, tarefaAlertaInatividade, type RelatorioSemanalDados } from "./notionService";
import {
  getDashboardMetrics,
  getRankingCorretores,
  getMetaGlobal,
} from "./db";

const BRASILIA_OFFSET = -3; // UTC-3

function agora(): Date {
  return new Date();
}

function horaAtualBrasilia(): { hora: number; diaSemana: number } {
  const now = agora();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const brasilia = new Date(utc + BRASILIA_OFFSET * 3600000);
  return {
    hora: brasilia.getHours(),
    diaSemana: brasilia.getDay(), // 0=domingo, 1=segunda, ..., 6=sábado
  };
}

function semanaAtual(): string {
  const now = agora();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const brasilia = new Date(utc + BRASILIA_OFFSET * 3600000);

  // Encontrar a segunda-feira da semana atual
  const dia = brasilia.getDay();
  const diffLunes = dia === 0 ? -6 : 1 - dia;
  const segunda = new Date(brasilia);
  segunda.setDate(brasilia.getDate() + diffLunes);

  const domingo = new Date(segunda);
  domingo.setDate(segunda.getDate() + 6);

  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  return `${fmt(segunda)} a ${fmt(domingo)}`;
}

// ============================================================
// RELATÓRIO SEMANAL
// ============================================================

let relatorioSemanalExecutado = false;
let ultimaDataRelatorio = "";

async function executarRelatorioSemanal(): Promise<void> {
  try {
    console.log("[Notion] Gerando relatório semanal...");

    // Buscar dados do CRM
    const agora = new Date();
    const mes = agora.getMonth() + 1;
    const ano = agora.getFullYear();

    const [metricas, rankingContratos, metaConfig] = await Promise.all([
      getDashboardMetrics(),
      getRankingCorretores(mes, ano),
      getMetaGlobal(mes, ano),
    ]);

    const dados: RelatorioSemanalDados = {
      semana: semanaAtual(),
      totalLeads: (metricas as any)?.totalLeads || 0,
      aguardandoAtendimento: (metricas as any)?.aguardandoAtendimento || 0,
      emAtendimento: (metricas as any)?.emAtendimento || 0,
      agendados: (metricas as any)?.agendados || 0,
      visitasRealizadas: (metricas as any)?.visitasRealizadas || 0,
      analiseCredito: (metricas as any)?.analiseCredito || 0,
      contratosFechados: (metricas as any)?.contratosFechados || 0,
      metaVGV: parseFloat((metaConfig as any)?.metaVGV || "0"),
      metaContratos: (metaConfig as any)?.metaContratos || 0,
      realizadoVGV: (rankingContratos as any[]).reduce((s, c) => s + parseFloat(c.totalVGV || "0"), 0),
      realizadoContratos: (rankingContratos as any[]).reduce((s, c) => s + (c.totalContratos || 0), 0),
      rankingCorretores: (rankingContratos as any[]).slice(0, 10).map((c) => ({
        nome: c.nome || c.name || "Corretor",
        contratos: c.totalContratos || 0,
        vgv: parseFloat(c.totalVGV || "0"),
        leads: c.totalLeads || 0,
      })),
    };

    await criarRelatorioSemanal(dados);
    console.log(`[Notion] Relatório semanal criado: ${dados.semana}`);
  } catch (err: any) {
    console.error("[Notion] Erro ao gerar relatório semanal:", err.message);
  }
}

// ============================================================
// ALERTA DE INATIVIDADE
// ============================================================

let ultimaDataAlerta = "";

async function executarAlertaInatividade(): Promise<void> {
  try {
    const hoje = new Date().toISOString().split("T")[0];
    if (ultimaDataAlerta === hoje) return;
    ultimaDataAlerta = hoje;

    console.log("[Notion] Verificando inatividade de corretores...");

    // Nota: getCorretoresInativos24h será implementada quando necessário
    // Por ora, o alerta de inatividade é disparado manualmente via procedure
    console.log("[Notion] Verificação de inatividade: use a procedure system.notionAlertaInatividade para disparar manualmente.");
  } catch (err: any) {
    console.error("[Notion] Erro ao verificar inatividade:", err.message);
  }
}

// ============================================================
// INICIALIZAÇÃO DO JOB
// ============================================================

export function startNotionJob(): void {
  console.log("[Notion] Job automático DESATIVADO por decisão do usuário para reduzir custos de Cloud.");
  console.log("[Notion] Relatório semanal e alertas de inatividade podem ser acionados manualmente via procedure admin.");
}

// Exportar funções para uso manual via procedure
export { executarRelatorioSemanal, executarAlertaInatividade };
