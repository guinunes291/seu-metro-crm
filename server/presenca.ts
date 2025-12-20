/**
 * Sistema de Histórico de Presença/Ausência
 * 
 * Funcionalidades:
 * - Registro automático de entrada/saída ao mudar status
 * - Cálculo de horas trabalhadas por dia/semana/mês
 * - Verificação automática a cada 3h de presença contínua
 * - Marcação automática de ausência no fim do expediente
 * - Relatórios e gráficos de presença
 */

import { getDb } from "./db";
import { historicoPresenca, resumoPresencaDiaria, users } from "../drizzle/schema";
import { eq, and, gte, lte, desc, sql, between } from "drizzle-orm";

// Configurações do expediente
export const EXPEDIENTE = {
  INICIO: 9, // 09:00
  FIM_NORMAL: 19, // 19:00
  FIM_CORUJAO: 20, // 20:00
  VERIFICACAO_INTERVALO_HORAS: 3, // Verificar a cada 3 horas de presença contínua
};

/**
 * Registra uma mudança de status de presença
 */
export async function registrarMudancaStatus(
  corretorId: number,
  statusAnterior: "presente" | "ausente",
  statusNovo: "presente" | "ausente",
  origem: "manual" | "automatico_fim" | "automatico_3h" | "sistema" = "manual",
  observacao?: string
): Promise<void> {
  const db = getDb();
  
  const tipo = statusNovo === "presente" ? "entrada" : "saida";
  
  await db.insert(historicoPresenca).values({
    corretorId,
    tipo,
    statusAnterior,
    statusNovo,
    origem,
    dataHora: new Date(),
    observacao,
  });
  
  // Atualizar resumo diário
  await atualizarResumoDiario(corretorId, new Date());
}

/**
 * Atualiza o resumo diário de presença de um corretor
 */
export async function atualizarResumoDiario(corretorId: number, data: Date): Promise<void> {
  const db = getDb();
  
  // Início e fim do dia
  const inicioDia = new Date(data);
  inicioDia.setHours(0, 0, 0, 0);
  const fimDia = new Date(data);
  fimDia.setHours(23, 59, 59, 999);
  
  // Buscar todos os registros do dia
  const registros = await db
    .select()
    .from(historicoPresenca)
    .where(
      and(
        eq(historicoPresenca.corretorId, corretorId),
        gte(historicoPresenca.dataHora, inicioDia),
        lte(historicoPresenca.dataHora, fimDia)
      )
    )
    .orderBy(historicoPresenca.dataHora);
  
  if (registros.length === 0) {
    return;
  }
  
  // Calcular totais
  let totalMinutosPresente = 0;
  let primeiraEntrada: Date | null = null;
  let ultimaSaida: Date | null = null;
  let quantidadeEntradas = 0;
  let quantidadeSaidas = 0;
  let ultimaEntrada: Date | null = null;
  
  for (const registro of registros) {
    if (registro.tipo === "entrada") {
      quantidadeEntradas++;
      if (!primeiraEntrada) {
        primeiraEntrada = registro.dataHora;
      }
      ultimaEntrada = registro.dataHora;
    } else {
      quantidadeSaidas++;
      ultimaSaida = registro.dataHora;
      
      // Calcular tempo presente desde última entrada
      if (ultimaEntrada) {
        const minutos = Math.floor((registro.dataHora.getTime() - ultimaEntrada.getTime()) / 60000);
        totalMinutosPresente += minutos;
        ultimaEntrada = null;
      }
    }
  }
  
  // Se ainda está presente (última entrada sem saída), calcular até agora
  if (ultimaEntrada) {
    const agora = new Date();
    const minutos = Math.floor((agora.getTime() - ultimaEntrada.getTime()) / 60000);
    totalMinutosPresente += minutos;
  }
  
  // Calcular minutos ausente (dentro do expediente)
  const horasExpediente = EXPEDIENTE.FIM_NORMAL - EXPEDIENTE.INICIO; // 10 horas
  const minutosExpediente = horasExpediente * 60;
  const totalMinutosAusente = Math.max(0, minutosExpediente - totalMinutosPresente);
  
  // Determinar status do dia
  let statusDia: "presente" | "ausente" | "parcial" | "fora_expediente" = "ausente";
  if (totalMinutosPresente >= minutosExpediente * 0.8) {
    statusDia = "presente";
  } else if (totalMinutosPresente > 0) {
    statusDia = "parcial";
  }
  
  // Verificar se trabalhou fora do expediente
  let trabalhouForaExpediente = false;
  if (primeiraEntrada) {
    const horaEntrada = primeiraEntrada.getHours();
    if (horaEntrada < EXPEDIENTE.INICIO || horaEntrada >= EXPEDIENTE.FIM_CORUJAO) {
      trabalhouForaExpediente = true;
    }
  }
  
  // Verificar se já existe resumo para este dia
  const resumoExistente = await db
    .select()
    .from(resumoPresencaDiaria)
    .where(
      and(
        eq(resumoPresencaDiaria.corretorId, corretorId),
        gte(resumoPresencaDiaria.data, inicioDia),
        lte(resumoPresencaDiaria.data, fimDia)
      )
    )
    .limit(1);
  
  if (resumoExistente.length > 0) {
    // Atualizar resumo existente
    await db
      .update(resumoPresencaDiaria)
      .set({
        primeiraEntrada,
        ultimaSaida,
        totalMinutosPresente,
        totalMinutosAusente,
        quantidadeEntradas,
        quantidadeSaidas,
        statusDia,
        trabalhouForaExpediente,
      })
      .where(eq(resumoPresencaDiaria.id, resumoExistente[0].id));
  } else {
    // Criar novo resumo
    await db.insert(resumoPresencaDiaria).values({
      corretorId,
      data: inicioDia,
      primeiraEntrada,
      ultimaSaida,
      totalMinutosPresente,
      totalMinutosAusente,
      quantidadeEntradas,
      quantidadeSaidas,
      statusDia,
      trabalhouForaExpediente,
    });
  }
}

/**
 * Busca o histórico de presença de um corretor
 */
export async function buscarHistoricoPresenca(
  corretorId: number,
  dataInicio?: Date,
  dataFim?: Date
): Promise<any[]> {
  const db = getDb();
  
  let query = db
    .select()
    .from(historicoPresenca)
    .where(eq(historicoPresenca.corretorId, corretorId))
    .orderBy(desc(historicoPresenca.dataHora));
  
  if (dataInicio && dataFim) {
    query = db
      .select()
      .from(historicoPresenca)
      .where(
        and(
          eq(historicoPresenca.corretorId, corretorId),
          gte(historicoPresenca.dataHora, dataInicio),
          lte(historicoPresenca.dataHora, dataFim)
        )
      )
      .orderBy(desc(historicoPresenca.dataHora));
  }
  
  return await query;
}

/**
 * Busca o resumo de presença por período
 */
export async function buscarResumoPresenca(
  corretorId?: number,
  dataInicio?: Date,
  dataFim?: Date
): Promise<any[]> {
  const db = getDb();
  
  const conditions = [];
  
  if (corretorId) {
    conditions.push(eq(resumoPresencaDiaria.corretorId, corretorId));
  }
  
  if (dataInicio) {
    conditions.push(gte(resumoPresencaDiaria.data, dataInicio));
  }
  
  if (dataFim) {
    conditions.push(lte(resumoPresencaDiaria.data, dataFim));
  }
  
  const query = conditions.length > 0
    ? db.select().from(resumoPresencaDiaria).where(and(...conditions)).orderBy(desc(resumoPresencaDiaria.data))
    : db.select().from(resumoPresencaDiaria).orderBy(desc(resumoPresencaDiaria.data));
  
  return await query;
}

/**
 * Calcula estatísticas de presença de um corretor
 */
export async function calcularEstatisticasPresenca(
  corretorId: number,
  dataInicio: Date,
  dataFim: Date
): Promise<{
  totalDias: number;
  diasPresente: number;
  diasAusente: number;
  diasParcial: number;
  totalHorasTrabalhadas: number;
  mediaHorasDia: number;
  percentualPresenca: number;
}> {
  const db = getDb();
  
  const resumos = await db
    .select()
    .from(resumoPresencaDiaria)
    .where(
      and(
        eq(resumoPresencaDiaria.corretorId, corretorId),
        gte(resumoPresencaDiaria.data, dataInicio),
        lte(resumoPresencaDiaria.data, dataFim)
      )
    );
  
  const totalDias = resumos.length;
  const diasPresente = resumos.filter(r => r.statusDia === "presente").length;
  const diasAusente = resumos.filter(r => r.statusDia === "ausente").length;
  const diasParcial = resumos.filter(r => r.statusDia === "parcial").length;
  
  const totalMinutos = resumos.reduce((acc, r) => acc + r.totalMinutosPresente, 0);
  const totalHorasTrabalhadas = Math.round(totalMinutos / 60 * 10) / 10;
  const mediaHorasDia = totalDias > 0 ? Math.round(totalMinutos / totalDias / 60 * 10) / 10 : 0;
  
  // Percentual de presença (considerando apenas dias úteis)
  const diasUteis = totalDias; // Simplificado - poderia filtrar fins de semana
  const percentualPresenca = diasUteis > 0 
    ? Math.round((diasPresente + diasParcial * 0.5) / diasUteis * 100) 
    : 0;
  
  return {
    totalDias,
    diasPresente,
    diasAusente,
    diasParcial,
    totalHorasTrabalhadas,
    mediaHorasDia,
    percentualPresenca,
  };
}

/**
 * Busca corretores que estão presentes há mais de 3 horas sem confirmação
 */
export async function buscarCorretoresSemConfirmacao(): Promise<any[]> {
  const db = getDb();
  
  const tresHorasAtras = new Date();
  tresHorasAtras.setHours(tresHorasAtras.getHours() - EXPEDIENTE.VERIFICACAO_INTERVALO_HORAS);
  
  // Buscar corretores com status "presente"
  const corretoresPresentes = await db
    .select()
    .from(users)
    .where(eq(users.status, "presente"));
  
  const corretoresSemConfirmacao = [];
  
  for (const corretor of corretoresPresentes) {
    // Buscar última entrada do corretor
    const ultimaEntrada = await db
      .select()
      .from(historicoPresenca)
      .where(
        and(
          eq(historicoPresenca.corretorId, corretor.id),
          eq(historicoPresenca.tipo, "entrada")
        )
      )
      .orderBy(desc(historicoPresenca.dataHora))
      .limit(1);
    
    if (ultimaEntrada.length > 0) {
      const horasDesdeEntrada = (Date.now() - ultimaEntrada[0].dataHora.getTime()) / (1000 * 60 * 60);
      
      if (horasDesdeEntrada >= EXPEDIENTE.VERIFICACAO_INTERVALO_HORAS) {
        corretoresSemConfirmacao.push({
          ...corretor,
          ultimaEntrada: ultimaEntrada[0].dataHora,
          horasPresente: Math.round(horasDesdeEntrada * 10) / 10,
        });
      }
    }
  }
  
  return corretoresSemConfirmacao;
}

/**
 * Gera dados para gráfico de presença do time
 */
export async function gerarDadosGraficoPresenca(
  dataInicio: Date,
  dataFim: Date
): Promise<{
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string;
  }[];
}> {
  const db = getDb();
  
  // Buscar todos os corretores
  const corretores = await db
    .select()
    .from(users)
    .where(eq(users.role, "corretor"));
  
  // Buscar resumos de presença no período
  const resumos = await db
    .select()
    .from(resumoPresencaDiaria)
    .where(
      and(
        gte(resumoPresencaDiaria.data, dataInicio),
        lte(resumoPresencaDiaria.data, dataFim)
      )
    )
    .orderBy(resumoPresencaDiaria.data);
  
  // Gerar labels (datas)
  const labels: string[] = [];
  const currentDate = new Date(dataInicio);
  while (currentDate <= dataFim) {
    labels.push(currentDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Dados para gráfico de barras empilhadas
  const datasetsPresente: number[] = new Array(labels.length).fill(0);
  const datasetsAusente: number[] = new Array(labels.length).fill(0);
  const datasetsParcial: number[] = new Array(labels.length).fill(0);
  
  for (const resumo of resumos) {
    const dataStr = resumo.data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const index = labels.indexOf(dataStr);
    
    if (index !== -1) {
      if (resumo.statusDia === "presente") {
        datasetsPresente[index]++;
      } else if (resumo.statusDia === "ausente") {
        datasetsAusente[index]++;
      } else if (resumo.statusDia === "parcial") {
        datasetsParcial[index]++;
      }
    }
  }
  
  return {
    labels,
    datasets: [
      {
        label: "Presente",
        data: datasetsPresente,
        backgroundColor: "#22c55e", // green-500
      },
      {
        label: "Parcial",
        data: datasetsParcial,
        backgroundColor: "#f59e0b", // amber-500
      },
      {
        label: "Ausente",
        data: datasetsAusente,
        backgroundColor: "#ef4444", // red-500
      },
    ],
  };
}

/**
 * Gera dados para heatmap de presença
 */
export async function gerarDadosHeatmap(
  corretorId: number,
  dataInicio: Date,
  dataFim: Date
): Promise<{
  data: { day: number; hour: number; value: number }[];
}> {
  const db = getDb();
  
  const registros = await db
    .select()
    .from(historicoPresenca)
    .where(
      and(
        eq(historicoPresenca.corretorId, corretorId),
        gte(historicoPresenca.dataHora, dataInicio),
        lte(historicoPresenca.dataHora, dataFim)
      )
    )
    .orderBy(historicoPresenca.dataHora);
  
  // Criar matriz de presença (dia da semana x hora)
  const heatmapData: { day: number; hour: number; value: number }[] = [];
  
  // Inicializar matriz com zeros
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      heatmapData.push({ day, hour, value: 0 });
    }
  }
  
  // Processar registros para calcular presença por hora
  let ultimaEntrada: Date | null = null;
  
  for (const registro of registros) {
    if (registro.tipo === "entrada") {
      ultimaEntrada = registro.dataHora;
    } else if (registro.tipo === "saida" && ultimaEntrada) {
      // Marcar todas as horas entre entrada e saída
      const entrada = new Date(ultimaEntrada);
      const saida = new Date(registro.dataHora);
      
      while (entrada < saida) {
        const day = entrada.getDay();
        const hour = entrada.getHours();
        const index = heatmapData.findIndex(d => d.day === day && d.hour === hour);
        if (index !== -1) {
          heatmapData[index].value++;
        }
        entrada.setHours(entrada.getHours() + 1);
      }
      
      ultimaEntrada = null;
    }
  }
  
  return { data: heatmapData };
}

/**
 * Gera relatório semanal de presença para envio por email
 */
export async function gerarRelatorioSemanal(): Promise<{
  periodo: string;
  corretores: {
    nome: string;
    email: string;
    totalHoras: number;
    percentualPresenca: number;
    diasAusente: number;
    status: "bom" | "regular" | "ruim";
  }[];
  resumo: {
    totalCorretores: number;
    mediaPresenca: number;
    corretorMaisPresente: string;
    corretorMenosPresente: string;
  };
}> {
  const db = getDb();
  
  // Calcular período da semana anterior
  const hoje = new Date();
  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(hoje.getDate() - hoje.getDay() - 7); // Domingo da semana anterior
  inicioSemana.setHours(0, 0, 0, 0);
  
  const fimSemana = new Date(inicioSemana);
  fimSemana.setDate(inicioSemana.getDate() + 6); // Sábado da semana anterior
  fimSemana.setHours(23, 59, 59, 999);
  
  // Buscar todos os corretores
  const corretores = await db
    .select()
    .from(users)
    .where(eq(users.role, "corretor"));
  
  const relatorioCorretores = [];
  let totalPresenca = 0;
  let corretorMaisPresente = { nome: "", percentual: 0 };
  let corretorMenosPresente = { nome: "", percentual: 100 };
  
  for (const corretor of corretores) {
    const estatisticas = await calcularEstatisticasPresenca(
      corretor.id,
      inicioSemana,
      fimSemana
    );
    
    let status: "bom" | "regular" | "ruim" = "bom";
    if (estatisticas.percentualPresenca < 50) {
      status = "ruim";
    } else if (estatisticas.percentualPresenca < 80) {
      status = "regular";
    }
    
    relatorioCorretores.push({
      nome: corretor.name || "Sem nome",
      email: corretor.email || "",
      totalHoras: estatisticas.totalHorasTrabalhadas,
      percentualPresenca: estatisticas.percentualPresenca,
      diasAusente: estatisticas.diasAusente,
      status,
    });
    
    totalPresenca += estatisticas.percentualPresenca;
    
    if (estatisticas.percentualPresenca > corretorMaisPresente.percentual) {
      corretorMaisPresente = { nome: corretor.name || "Sem nome", percentual: estatisticas.percentualPresenca };
    }
    
    if (estatisticas.percentualPresenca < corretorMenosPresente.percentual) {
      corretorMenosPresente = { nome: corretor.name || "Sem nome", percentual: estatisticas.percentualPresenca };
    }
  }
  
  // Ordenar por percentual de presença (menor primeiro - mais ausentes)
  relatorioCorretores.sort((a, b) => a.percentualPresenca - b.percentualPresenca);
  
  return {
    periodo: `${inicioSemana.toLocaleDateString("pt-BR")} a ${fimSemana.toLocaleDateString("pt-BR")}`,
    corretores: relatorioCorretores,
    resumo: {
      totalCorretores: corretores.length,
      mediaPresenca: corretores.length > 0 ? Math.round(totalPresenca / corretores.length) : 0,
      corretorMaisPresente: corretorMaisPresente.nome,
      corretorMenosPresente: corretorMenosPresente.nome,
    },
  };
}
