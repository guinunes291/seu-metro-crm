/**
 * Sincronização Automática com a Planilha DRE
 *
 * Exporta todos os contratos do CRM para a aba "Lançamentos" da planilha DRE,
 * incluindo VGV, comissões, impostos e rateio por função.
 *
 * Planilha DRE: https://docs.google.com/spreadsheets/d/10GeJ8Zba4kFUJa2HwvUVu09BDkGuKCQGrpBDaLVlr38
 */
import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";
import * as path from "path";
import { getDb } from "./db";
import {
  contratos,
  leads,
  users,
  projects,
  equipes,
} from "../drizzle/schema";
import { eq, inArray } from "drizzle-orm";

const DRE_SPREADSHEET_ID = "10GeJ8Zba4kFUJa2HwvUVu09BDkGuKCQGrpBDaLVlr38";
const DRE_SHEET_NAME = "Lançamentos";
const CREDENTIALS_PATH = path.resolve(process.cwd(), "server/google-service-account.json");

// Cabeçalhos exatos da planilha DRE (linha 2)
const DRE_HEADERS = [
  "Data",
  "Corretor",
  "Gerente",
  "Projeto",
  "Incorporadora",
  "Região",
  "VGV (R$)",
  "% Comissão Imob",
  "Comissão Bruta (R$)",
  "Tipo Pagamento",
  "% Imposto",
  "Imposto (R$)",
  "Comissão Líquida (R$)",
  "% Corretor",
  "R$ Corretor",
  "% Gerente",
  "R$ Gerente",
  "% Superintendente",
  "R$ Superintendente",
  "% Sócio 1",
  "R$ Sócio 1",
  "% Sócio 2",
  "R$ Sócio 2",
  "% Sócio 3",
  "R$ Sócio 3",
  "Total Rateio (R$)",
  "Resultado Proprietário (R$)",
  "Status",
  "Data Recebimento",
  "Observações",
];

/**
 * Obtém cliente autenticado do Google Sheets
 */
async function getSheetsClient() {
  const auth = new GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const authClient = await auth.getClient();
  return google.sheets({ version: "v4", auth: authClient as any });
}

/**
 * Formata data para exibição na planilha (dd/mm/yyyy)
 */
function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

/**
 * Formata valor monetário para número (sem símbolo R$)
 */
function formatMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Formata percentual para exibição (ex: 3.5 → 3.50%)
 */
function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

/**
 * Busca todos os contratos com dados completos para exportação DRE
 */
async function getContratosParaDRE() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Buscar contratos com dados do corretor, lead e projeto
  const resultado = await db
    .select({
      contratoId: contratos.id,
      dataVenda: contratos.createdAt,
      valorVenda: contratos.valorVenda,
      percentualComissao: contratos.percentualComissao,
      percentualCorretor: contratos.percentualCorretor,
      percentualGerente: contratos.percentualGerente,
      percentualSuperintendente: contratos.percentualSuperintendente,
      statusRecebimento: contratos.statusRecebimentoImobiliaria,
      dataRecebimento: contratos.dataRecebimentoImobiliaria,
      observacoes: contratos.observacoes,
      distrato: contratos.distrato,
      // Corretor
      corretorId: contratos.corretorId,
      corretorNome: users.name,
      corretorEquipeId: users.equipeId,
      // Lead
      clienteNome: leads.nome,
      projectId: leads.projectId,
      projetoCustom: leads.projetoCustom,
      projetoNome: projects.nome,
      regiao: projects.regiao,
    })
    .from(contratos)
    .innerJoin(users, eq(contratos.corretorId, users.id))
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .leftJoin(projects, eq(leads.projectId, projects.id))
    .orderBy(contratos.createdAt);

  if (resultado.length === 0) return [];

  // Buscar gerentes das equipes
  const equipeIds = [
    ...new Set(
      resultado.filter((r) => r.corretorEquipeId).map((r) => r.corretorEquipeId!)
    ),
  ];
  let equipesMap = new Map<number, { gestorId: number | null; gestorNome: string }>();
  if (equipeIds.length > 0) {
    const equipesData = await db
      .select({
        id: equipes.id,
        gestorId: equipes.gestorId,
      })
      .from(equipes)
      .where(inArray(equipes.id, equipeIds));

    // Buscar nomes dos gestores
    const gestorIds = [
      ...new Set(
        equipesData.filter((e) => e.gestorId).map((e) => e.gestorId!)
      ),
    ];
    let gestoresMap = new Map<number, string>();
    if (gestorIds.length > 0) {
      const gestoresData = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, gestorIds));
      gestoresMap = new Map(gestoresData.map((g) => [g.id, g.name]));
    }

    for (const e of equipesData) {
      equipesMap.set(e.id, {
        gestorId: e.gestorId,
        gestorNome: e.gestorId ? (gestoresMap.get(e.gestorId) || "") : "",
      });
    }
  }

  // Montar linhas para exportação
  return resultado.map((r) => {
    const vgv = Number(r.valorVenda) || 0;
    const percComissao = Number(r.percentualComissao) || 3.5;
    const percCorretor = Number(r.percentualCorretor) || 1.85;
    const percGerente = Number(r.percentualGerente) || 0.5;
    const percSuperintendente = Number(r.percentualSuperintendente) || 0.3;
    const percImposto = 6; // 6% padrão (NF)

    const comissaoBruta = formatMoney((vgv * percComissao) / 100);
    const imposto = formatMoney((comissaoBruta * percImposto) / 100);
    const comissaoLiquida = formatMoney(comissaoBruta - imposto);

    const valorCorretor = formatMoney((vgv * percCorretor) / 100);
    const valorGerente = formatMoney((vgv * percGerente) / 100);
    const valorSuperintendente = formatMoney((vgv * percSuperintendente) / 100);
    const totalRateio = formatMoney(valorCorretor + valorGerente + valorSuperintendente);
    const resultadoProprietario = formatMoney(comissaoLiquida - totalRateio);

    // O nome do projeto vem do leftJoin com projects
    const projetoNome = r.projetoNome || r.projetoCustom || "Não informado";

    const equipeInfo = r.corretorEquipeId
      ? equipesMap.get(r.corretorEquipeId)
      : null;
    const gerenteNome = equipeInfo?.gestorNome || "";

    // Mapear status para texto legível
    const statusMap: Record<string, string> = {
      pendente: "Pendente",
      recebido: "Recebido",
      em_disputa: "Em Disputa",
    };
    const statusTexto = statusMap[r.statusRecebimento || "pendente"] || "Pendente";

    return {
      contratoId: r.contratoId,
      distrato: r.distrato,
      row: [
        formatDate(r.dataVenda),                    // Data
        r.corretorNome || "",                        // Corretor
        gerenteNome,                                 // Gerente
        projetoNome,                                 // Projeto
        "",                                          // Incorporadora (não disponível no CRM)
        r.regiao || r.projetoCustom || "",        // Região (do projeto)
        vgv,                                         // VGV (R$)
        percComissao / 100,                          // % Comissão Imob (como decimal para Google Sheets)
        comissaoBruta,                               // Comissão Bruta (R$)
        "À vista",                                   // Tipo Pagamento
        percImposto / 100,                           // % Imposto (como decimal)
        imposto,                                     // Imposto (R$)
        comissaoLiquida,                             // Comissão Líquida (R$)
        percCorretor / 100,                          // % Corretor (como decimal)
        valorCorretor,                               // R$ Corretor
        percGerente / 100,                           // % Gerente (como decimal)
        valorGerente,                                // R$ Gerente
        percSuperintendente / 100,                   // % Superintendente (como decimal)
        valorSuperintendente,                        // R$ Superintendente
        "",                                          // % Sócio 1
        "",                                          // R$ Sócio 1
        "",                                          // % Sócio 2
        "",                                          // R$ Sócio 2
        "",                                          // % Sócio 3
        "",                                          // R$ Sócio 3
        totalRateio,                                 // Total Rateio (R$)
        resultadoProprietario,                       // Resultado Proprietário (R$)
        r.distrato ? "Distratado" : statusTexto,     // Status
        formatDate(r.dataRecebimento),               // Data Recebimento
        r.observacoes || "",                         // Observações
      ],
    };
  });
}

/**
 * Sincroniza os contratos do CRM com a aba "Lançamentos" da planilha DRE.
 * Estratégia: limpa a aba e reescreve todos os dados (full refresh).
 * Preserva o cabeçalho original (linhas 1 e 2) e escreve a partir da linha 3.
 */
export async function sincronizarDRE(): Promise<{
  success: boolean;
  totalContratos: number;
  totalDistratados: number;
  error?: string;
}> {
  try {
    const sheets = await getSheetsClient();
    const dadosContratos = await getContratosParaDRE();

    // Separar contratos ativos e distratados
    const contratosAtivos = dadosContratos.filter((c) => !c.distrato);
    const contratosDistratados = dadosContratos.filter((c) => c.distrato);

    // Todas as linhas (ativos primeiro, depois distratados)
    const todasLinhas = [...contratosAtivos, ...contratosDistratados];

    // Preparar dados para escrita
    const rows = todasLinhas.map((c) => c.row);

    // Limpar dados existentes a partir da linha 3 (preservando cabeçalho)
    // Primeiro, verificar quantas linhas existem
    const sheetInfo = await sheets.spreadsheets.get({
      spreadsheetId: DRE_SPREADSHEET_ID,
      ranges: [DRE_SHEET_NAME],
      includeGridData: false,
    });

    const sheetData = sheetInfo.data.sheets?.find(
      (s: any) => s.properties?.title === DRE_SHEET_NAME
    );
    const currentRows = sheetData?.properties?.gridProperties?.rowCount || 1000;

    // Limpar a área de dados (a partir da linha 3)
    if (currentRows > 2) {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: DRE_SPREADSHEET_ID,
        range: `${DRE_SHEET_NAME}!A3:AD${currentRows}`,
      });
    }

    // Escrever dados a partir da linha 3
    if (rows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: DRE_SPREADSHEET_ID,
        range: `${DRE_SHEET_NAME}!A3`,
        valueInputOption: "USER_ENTERED", // Para que percentuais sejam formatados corretamente
        requestBody: {
          values: rows,
        },
      });
    }

    console.log(
      `[DRE Sync] ✅ Sincronização concluída: ${contratosAtivos.length} contratos ativos, ${contratosDistratados.length} distratados`
    );

    return {
      success: true,
      totalContratos: contratosAtivos.length,
      totalDistratados: contratosDistratados.length,
    };
  } catch (error: any) {
    console.error("[DRE Sync] ❌ Erro na sincronização:", error.message);
    return {
      success: false,
      totalContratos: 0,
      totalDistratados: 0,
      error: error.message,
    };
  }
}

/**
 * Sincroniza apenas um contrato específico na planilha DRE.
 * Útil para atualizar em tempo real após criar/editar/distratar um contrato.
 * Na prática, executa um full refresh pois é mais simples e confiável.
 */
export async function sincronizarContratoDRE(contratoId: number): Promise<void> {
  console.log(`[DRE Sync] Sincronizando contrato #${contratoId}...`);
  await sincronizarDRE();
}
