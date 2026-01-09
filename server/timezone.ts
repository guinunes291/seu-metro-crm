/**
 * Utilitários de timezone para garantir que todas as operações de data
 * usem o fuso horário de São Paulo (America/Sao_Paulo)
 */

const TIMEZONE = 'America/Sao_Paulo';

/**
 * Retorna a data/hora atual no fuso de São Paulo
 */
export function agora(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
}

/**
 * Retorna o início do dia atual em São Paulo (00:00:00)
 */
export function inicioDoDiaHoje(): Date {
  const hoje = agora();
  hoje.setHours(0, 0, 0, 0);
  return hoje;
}

/**
 * Retorna o fim do dia atual em São Paulo (23:59:59.999)
 */
export function fimDoDiaHoje(): Date {
  const hoje = agora();
  hoje.setHours(23, 59, 59, 999);
  return hoje;
}

/**
 * Retorna o início de um dia específico em São Paulo (00:00:00)
 */
export function inicioDoDia(data: Date): Date {
  const dataSP = new Date(data.toLocaleString('en-US', { timeZone: TIMEZONE }));
  dataSP.setHours(0, 0, 0, 0);
  return dataSP;
}

/**
 * Retorna o fim de um dia específico em São Paulo (23:59:59.999)
 */
export function fimDoDia(data: Date): Date {
  const dataSP = new Date(data.toLocaleString('en-US', { timeZone: TIMEZONE }));
  dataSP.setHours(23, 59, 59, 999);
  return dataSP;
}

/**
 * Converte uma data UTC para o fuso de São Paulo
 */
export function paraFusoSaoPaulo(dataUTC: Date): Date {
  return new Date(dataUTC.toLocaleString('en-US', { timeZone: TIMEZONE }));
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
  
  // Criar data localmente (não UTC)
  // Usar Date constructor com componentes individuais cria data no timezone local
  const data = new Date(ano, mes - 1, dia, 0, 0, 0, 0);
  
  return data;
}

/**
 * Formata uma data no formato brasileiro (DD/MM/YYYY)
 */
export function formatarDataBR(data: Date): string {
  const dataSP = paraFusoSaoPaulo(data);
  return dataSP.toLocaleDateString('pt-BR');
}

/**
 * Formata uma data e hora no formato brasileiro (DD/MM/YYYY HH:mm)
 */
export function formatarDataHoraBR(data: Date): string {
  const dataSP = paraFusoSaoPaulo(data);
  return dataSP.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
