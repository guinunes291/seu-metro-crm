/**
 * Logger estruturado para o Seu Metro Quadrado CRM
 * 
 * Substitui console.log/error/warn diretos por um logger com:
 * - Níveis de log (debug, info, warn, error)
 * - Timestamp automático
 * - Contexto/módulo
 * - Supressão de debug em produção
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function formatMessage(level: LogLevel, module: string, message: string, meta?: unknown): string {
  const ts = new Date().toISOString();
  const metaStr = meta !== undefined ? ` | ${JSON.stringify(meta)}` : '';
  return `[${ts}] [${level.toUpperCase()}] [${module}] ${message}${metaStr}`;
}

export const logger = {
  debug(module: string, message: string, meta?: unknown) {
    if (!IS_PRODUCTION) {
      console.debug(formatMessage('debug', module, message, meta));
    }
  },

  info(module: string, message: string, meta?: unknown) {
    console.info(formatMessage('info', module, message, meta));
  },

  warn(module: string, message: string, meta?: unknown) {
    console.warn(formatMessage('warn', module, message, meta));
  },

  error(module: string, message: string, error?: unknown) {
    const errMeta = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error;
    console.error(formatMessage('error', module, message, errMeta));
  },
};

/**
 * Cria um logger com módulo pré-definido para uso em arquivos específicos
 */
export function createLogger(module: string) {
  return {
    debug: (message: string, meta?: unknown) => logger.debug(module, message, meta),
    info: (message: string, meta?: unknown) => logger.info(module, message, meta),
    warn: (message: string, meta?: unknown) => logger.warn(module, message, meta),
    error: (message: string, error?: unknown) => logger.error(module, message, error),
  };
}
