import type { LogLevel } from '../types/index.js';

type LogMeta = Record<string, unknown>;

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let globalLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  globalLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[globalLevel];
}

function formatMeta(meta?: LogMeta): string {
  if (!meta || Object.keys(meta).length === 0) return '';
  return ` ${JSON.stringify(meta)}`;
}

export const logger = {
  debug(message: string, meta?: LogMeta): void {
    if (shouldLog('debug')) console.debug(`[DEBUG] ${message}${formatMeta(meta)}`);
  },
  info(message: string, meta?: LogMeta): void {
    if (shouldLog('info')) console.info(`[INFO] ${message}${formatMeta(meta)}`);
  },
  warn(message: string, meta?: LogMeta): void {
    if (shouldLog('warn')) console.warn(`[WARN] ${message}${formatMeta(meta)}`);
  },
  error(message: string, meta?: LogMeta): void {
    if (shouldLog('error')) console.error(`[ERROR] ${message}${formatMeta(meta)}`);
  },
};
