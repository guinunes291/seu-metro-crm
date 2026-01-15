/**
 * Utilitários de timezone para garantir que todas as operações de data
 * usem o fuso horário de São Paulo (America/Sao_Paulo = UTC-3)
 * 
 * IMPORTANTE: O banco de dados armazena timestamps em UTC, mas todas as
 * operações de comparação e cálculo devem ser feitas no timezone de SP.
 */

const TIMEZONE = 'America/Sao_Paulo';
const OFFSET_SP_HORAS = -3; // São Paulo é UTC-3

/**
 * Retorna a data/hora atual no fuso de São Paulo
 * Converte UTC do servidor para SP
 */
export function agora(): Date {
  const agoraUTC = new Date();
  // Converter para SP: adicionar offset de -3 horas
  const agoraSP = new Date(agoraUTC.getTime() + (OFFSET_SP_HORAS * 60 * 60 * 1000));
  return agoraSP;
}

/**
 * Retorna o início do dia atual em São Paulo (00:00:00)
 * CRÍTICO: Retorna timestamp UTC que representa 00:00:00 em SP
 */
export function inicioDoDiaHoje(): Date {
  // Pegar data/hora atual em SP
  const agoraSP = agora();
  
  // Criar data para 00:00:00 de hoje em SP
  const ano = agoraSP.getFullYear();
  const mes = agoraSP.getMonth();
  const dia = agoraSP.getDate();
  
  // Criar Date em UTC que representa 00:00:00 SP
  // 00:00:00 SP = 03:00:00 UTC (SP está 3h atrás)
  const inicioDia = new Date(Date.UTC(ano, mes, dia, 3, 0, 0, 0));
  
  return inicioDia;
}

/**
 * Retorna o fim do dia atual em São Paulo (23:59:59.999)
 * CRÍTICO: Retorna timestamp UTC que representa 23:59:59.999 em SP
 */
export function fimDoDiaHoje(): Date {
  // Pegar data/hora atual em SP
  const agoraSP = agora();
  
  // Criar data para 23:59:59.999 de hoje em SP
  const ano = agoraSP.getFullYear();
  const mes = agoraSP.getMonth();
  const dia = agoraSP.getDate();
  
  // Criar Date em UTC que representa 23:59:59.999 SP
  // 23:59:59 SP = 02:59:59 UTC do dia seguinte
  const fimDia = new Date(Date.UTC(ano, mes, dia, 26, 59, 59, 999)); // 26h = 02h do dia seguinte
  
  return fimDia;
}

/**
 * Retorna o início de um dia específico em São Paulo (00:00:00)
 */
export function inicioDoDia(data: Date): Date {
  // Converter data UTC para SP
  const dataSP = new Date(data.getTime() + (OFFSET_SP_HORAS * 60 * 60 * 1000));
  
  const ano = dataSP.getFullYear();
  const mes = dataSP.getMonth();
  const dia = dataSP.getDate();
  
  // Criar Date em UTC que representa 00:00:00 SP
  const inicioDia = new Date(Date.UTC(ano, mes, dia, 3, 0, 0, 0));
  
  return inicioDia;
}

/**
 * Retorna o fim de um dia específico em São Paulo (23:59:59.999)
 */
export function fimDoDia(data: Date): Date {
  // Converter data UTC para SP
  const dataSP = new Date(data.getTime() + (OFFSET_SP_HORAS * 60 * 60 * 1000));
  
  const ano = dataSP.getFullYear();
  const mes = dataSP.getMonth();
  const dia = dataSP.getDate();
  
  // Criar Date em UTC que representa 23:59:59.999 SP
  const fimDia = new Date(Date.UTC(ano, mes, dia, 26, 59, 59, 999));
  
  return fimDia;
}

/**
 * Converte uma data UTC para o fuso de São Paulo
 */
export function paraFusoSaoPaulo(dataUTC: Date): Date {
  return new Date(dataUTC.getTime() + (OFFSET_SP_HORAS * 60 * 60 * 1000));
}

/**
 * Parseia uma string de data ISO (YYYY-MM-DD) como se fosse no fuso de São Paulo
 * Evita o problema de new Date("2025-01-12") interpretar como UTC
 * 
 * Exemplo:
 * - Input: "2025-01-12" (usuário quer domingo dia 12)
 * - Sem esta função: new Date("2025-01-12") = 12/01 00:00 UTC = 11/01 21:00 SP (sábado!)
 * - Com esta função: parsearDataISO("2025-01-12") = 12/01 00:00 SP (domingo correto!)
 */
export function parsearDataISO(dataISO: string): Date {
  // Separar ano, mês e dia
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  
  // Criar data em UTC que representa 00:00:00 SP
  // 00:00:00 SP = 03:00:00 UTC
  const data = new Date(Date.UTC(ano, mes - 1, dia, 3, 0, 0, 0));
  
  return data;
}

/**
 * Formata uma data no formato brasileiro (DD/MM/YYYY)
 */
export function formatarDataBR(data: Date): string {
  const dataSP = paraFusoSaoPaulo(data);
  const dia = String(dataSP.getDate()).padStart(2, '0');
  const mes = String(dataSP.getMonth() + 1).padStart(2, '0');
  const ano = dataSP.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

/**
 * Formata uma data e hora no formato brasileiro (DD/MM/YYYY HH:mm)
 */
export function formatarDataHoraBR(data: Date): string {
  const dataSP = paraFusoSaoPaulo(data);
  const dia = String(dataSP.getDate()).padStart(2, '0');
  const mes = String(dataSP.getMonth() + 1).padStart(2, '0');
  const ano = dataSP.getFullYear();
  const hora = String(dataSP.getHours()).padStart(2, '0');
  const minuto = String(dataSP.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
}

/**
 * Converte filtros de data (dataInicio/dataFim) do frontend para o fuso de São Paulo
 * Usado em queries de relatórios e dashboards
 * 
 * @param dataInicioISO String ISO opcional (YYYY-MM-DD)
 * @param dataFimISO String ISO opcional (YYYY-MM-DD)
 * @returns Objeto com dataInicio e dataFim no fuso de SP, ou undefined se não fornecido
 */
export function converterFiltrosData(dataInicioISO?: string, dataFimISO?: string): {
  dataInicio?: Date;
  dataFim?: Date;
} {
  return {
    dataInicio: dataInicioISO ? inicioDoDia(parsearDataISO(dataInicioISO)) : undefined,
    dataFim: dataFimISO ? fimDoDia(parsearDataISO(dataFimISO)) : undefined,
  };
}
