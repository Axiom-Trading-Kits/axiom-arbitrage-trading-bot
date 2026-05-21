import { z } from 'zod';
import type { BotMode, LogLevel } from '../types/index.js';

const envSchema = z.object({
  BOT_MODE: z.enum(['mock', 'live']).default('mock'),
  SOLANA_RPC_URL: z.string().url().default('https://api.mainnet-beta.solana.com'),
  AXIOM_API_KEY: z.string().optional(),
  AXIOM_API_URL: z.string().url().default('https://api.axiom.trade'),
  JUPITER_QUOTE_URL: z.string().url().default('https://quote-api.jup.ag/v6'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8790),
  HOST: z.string().default('127.0.0.1'),
  SCAN_INTERVAL_MS: z.coerce.number().int().min(1000).default(5000),
  MIN_PROFIT_BPS: z.coerce.number().int().min(0).default(15),
  MAX_SLIPPAGE_BPS: z.coerce.number().int().min(1).max(1000).default(50),
  MAX_TRADE_SIZE_SOL: z.coerce.number().positive().default(1),
  MAX_DAILY_TRADES: z.coerce.number().int().min(1).default(100),
  MAX_CONSECUTIVE_FAILURES: z.coerce.number().int().min(1).default(5),
  EXECUTION_ENABLED: z
    .string()
    .transform((v) => v === 'true' || v === '1')
    .default('false'),
  DRY_RUN: z
    .string()
    .transform((v) => v !== 'false' && v !== '0')
    .default('true'),
  WALLET_PRIVATE_KEY: z.string().optional(),
  WATCH_TOKENS: z.string().default('SOL,USDC,BONK,WIF,JUP'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type AppConfig = {
  mode: BotMode;
  solanaRpcUrl: string;
  axiomApiKey?: string;
  axiomApiUrl: string;
  jupiterQuoteUrl: string;
  port: number;
  host: string;
  scanIntervalMs: number;
  minProfitBps: number;
  maxSlippageBps: number;
  maxTradeSizeLamports: bigint;
  maxDailyTrades: number;
  maxConsecutiveFailures: number;
  executionEnabled: boolean;
  dryRun: boolean;
  walletPrivateKey?: string;
  watchTokenSymbols: string[];
  logLevel: LogLevel;
};

const LAMPORTS_PER_SOL = 1_000_000_000n;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);

  return {
    mode: parsed.BOT_MODE,
    solanaRpcUrl: parsed.SOLANA_RPC_URL,
    axiomApiKey: parsed.AXIOM_API_KEY,
    axiomApiUrl: parsed.AXIOM_API_URL,
    jupiterQuoteUrl: parsed.JUPITER_QUOTE_URL,
    port: parsed.PORT,
    host: parsed.HOST,
    scanIntervalMs: parsed.SCAN_INTERVAL_MS,
    minProfitBps: parsed.MIN_PROFIT_BPS,
    maxSlippageBps: parsed.MAX_SLIPPAGE_BPS,
    maxTradeSizeLamports: BigInt(Math.floor(parsed.MAX_TRADE_SIZE_SOL * Number(LAMPORTS_PER_SOL))),
    maxDailyTrades: parsed.MAX_DAILY_TRADES,
    maxConsecutiveFailures: parsed.MAX_CONSECUTIVE_FAILURES,
    executionEnabled: parsed.EXECUTION_ENABLED,
    dryRun: parsed.DRY_RUN || !parsed.EXECUTION_ENABLED,
    walletPrivateKey: parsed.WALLET_PRIVATE_KEY,
    watchTokenSymbols: parsed.WATCH_TOKENS.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean),
    logLevel: parsed.LOG_LEVEL,
  };
}

export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
