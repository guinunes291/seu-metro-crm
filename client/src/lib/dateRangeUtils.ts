import { DateRangePreset } from "@/components/DateRangeFilter";

/**
 * Converte Date para string ISO no timezone de São Paulo
 * Retorna formato: YYYY-MM-DD
 */
function toSaoPauloDateString(date: Date): string {
  // Converter para timezone de São Paulo (GMT-3)
  const saoPauloDate = new Date(
    date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  
  const year = saoPauloDate.getFullYear();
  const month = String(saoPauloDate.getMonth() + 1).padStart(2, "0");
  const day = String(saoPauloDate.getDate()).padStart(2, "0");
  
  return `${year}-${month}-${day}`;
}

/**
 * Retorna data/hora atual no timezone de São Paulo
 */
function getNowInSaoPaulo(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
}

/**
 * Retorna início do dia (00:00:00) no timezone de São Paulo
 */
function getStartOfDay(date: Date): Date {
  const saoPauloDate = new Date(
    date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  saoPauloDate.setHours(0, 0, 0, 0);
  return saoPauloDate;
}

/**
 * Retorna fim do dia (23:59:59) no timezone de São Paulo
 */
function getEndOfDay(date: Date): Date {
  const saoPauloDate = new Date(
    date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  saoPauloDate.setHours(23, 59, 59, 999);
  return saoPauloDate;
}

/**
 * Retorna início da semana (domingo) no timezone de São Paulo
 */
function getStartOfWeek(date: Date): Date {
  const saoPauloDate = new Date(
    date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  const day = saoPauloDate.getDay();
  const diff = saoPauloDate.getDate() - day;
  const startOfWeek = new Date(saoPauloDate.setDate(diff));
  return getStartOfDay(startOfWeek);
}

/**
 * Retorna fim da semana (sábado) no timezone de São Paulo
 */
function getEndOfWeek(date: Date): Date {
  const saoPauloDate = new Date(
    date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  const day = saoPauloDate.getDay();
  const diff = saoPauloDate.getDate() + (6 - day);
  const endOfWeek = new Date(saoPauloDate.setDate(diff));
  return getEndOfDay(endOfWeek);
}

/**
 * Retorna início do mês no timezone de São Paulo
 */
function getStartOfMonth(date: Date): Date {
  const saoPauloDate = new Date(
    date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  const startOfMonth = new Date(
    saoPauloDate.getFullYear(),
    saoPauloDate.getMonth(),
    1
  );
  return getStartOfDay(startOfMonth);
}

/**
 * Retorna fim do mês no timezone de São Paulo
 */
function getEndOfMonth(date: Date): Date {
  const saoPauloDate = new Date(
    date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  const endOfMonth = new Date(
    saoPauloDate.getFullYear(),
    saoPauloDate.getMonth() + 1,
    0
  );
  return getEndOfDay(endOfMonth);
}

/**
 * Retorna início do ano no timezone de São Paulo
 */
function getStartOfYear(date: Date): Date {
  const saoPauloDate = new Date(
    date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  const startOfYear = new Date(saoPauloDate.getFullYear(), 0, 1);
  return getStartOfDay(startOfYear);
}

/**
 * Retorna fim do ano no timezone de São Paulo
 */
function getEndOfYear(date: Date): Date {
  const saoPauloDate = new Date(
    date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  const endOfYear = new Date(saoPauloDate.getFullYear(), 11, 31);
  return getEndOfDay(endOfYear);
}

/**
 * Calcula datas de início e fim baseado no preset selecionado
 * Retorna strings no formato YYYY-MM-DD para uso em queries
 */
export function getDateRangeFromPreset(
  preset: DateRangePreset,
  customStart?: Date,
  customEnd?: Date
): { dataInicio?: string; dataFim?: string } {
  const now = getNowInSaoPaulo();

  switch (preset) {
    case "all":
      return { dataInicio: undefined, dataFim: undefined };

    case "today": {
      const start = getStartOfDay(now);
      const end = getEndOfDay(now);
      return {
        dataInicio: toSaoPauloDateString(start),
        dataFim: toSaoPauloDateString(end),
      };
    }

    case "yesterday": {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const start = getStartOfDay(yesterday);
      const end = getEndOfDay(yesterday);
      return {
        dataInicio: toSaoPauloDateString(start),
        dataFim: toSaoPauloDateString(end),
      };
    }

    case "this_week": {
      const start = getStartOfWeek(now);
      const end = getEndOfWeek(now);
      return {
        dataInicio: toSaoPauloDateString(start),
        dataFim: toSaoPauloDateString(end),
      };
    }

    case "last_week": {
      const lastWeek = new Date(now);
      lastWeek.setDate(lastWeek.getDate() - 7);
      const start = getStartOfWeek(lastWeek);
      const end = getEndOfWeek(lastWeek);
      return {
        dataInicio: toSaoPauloDateString(start),
        dataFim: toSaoPauloDateString(end),
      };
    }

    case "this_month": {
      const start = getStartOfMonth(now);
      const end = getEndOfMonth(now);
      return {
        dataInicio: toSaoPauloDateString(start),
        dataFim: toSaoPauloDateString(end),
      };
    }

    case "last_month": {
      const lastMonth = new Date(now);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const start = getStartOfMonth(lastMonth);
      const end = getEndOfMonth(lastMonth);
      return {
        dataInicio: toSaoPauloDateString(start),
        dataFim: toSaoPauloDateString(end),
      };
    }

    case "this_year": {
      const start = getStartOfYear(now);
      const end = getEndOfYear(now);
      return {
        dataInicio: toSaoPauloDateString(start),
        dataFim: toSaoPauloDateString(end),
      };
    }

    case "custom": {
      if (customStart && customEnd) {
        return {
          dataInicio: toSaoPauloDateString(getStartOfDay(customStart)),
          dataFim: toSaoPauloDateString(getEndOfDay(customEnd)),
        };
      }
      return { dataInicio: undefined, dataFim: undefined };
    }

    default:
      return { dataInicio: undefined, dataFim: undefined };
  }
}
