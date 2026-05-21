export type BotMode = 'mock' | 'live';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type DexVenue = 'jupiter' | 'raydium' | 'orca' | 'meteora' | 'axiom' | 'phoenix';

export type StrategyKind = 'cross-dex' | 'triangular' | 'cex-dex';

export interface TokenInfo {
  symbol: string;
  mint: string;
  decimals: number;
}

export interface QuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: bigint;
  slippageBps: number;
}

export interface QuoteResult {
  venue: DexVenue;
  inputMint: string;
  outputMint: string;
  inputAmount: bigint;
  outputAmount: bigint;
  priceImpactPct: number;
  feeBps: number;
  routeLabel: string;
  fetchedAt: number;
}

export interface ArbitrageLeg {
  venue: DexVenue;
  inputMint: string;
  outputMint: string;
  inputAmount: bigint;
  expectedOutput: bigint;
}

export interface ArbitrageOpportunity {
  id: string;
  strategy: StrategyKind;
  legs: ArbitrageLeg[];
  startToken: TokenInfo;
  endToken: TokenInfo;
  inputAmount: bigint;
  expectedOutput: bigint;
  grossProfitBps: number;
  netProfitBps: number;
  estimatedGasLamports: number;
  confidence: number;
  detectedAt: number;
  expiresAt: number;
}

export interface ExecutionResult {
  opportunityId: string;
  success: boolean;
  dryRun: boolean;
  txSignature?: string;
  actualOutput?: bigint;
  profitLamports?: bigint;
  error?: string;
  executedAt: number;
}

export interface ScanResult {
  scannedAt: number;
  mode: BotMode;
  opportunities: ArbitrageOpportunity[];
  rejected: RejectedOpportunity[];
  durationMs: number;
}

export interface RejectedOpportunity {
  opportunity: ArbitrageOpportunity;
  reason: string;
}

export interface BotStats {
  totalScans: number;
  opportunitiesFound: number;
  tradesExecuted: number;
  tradesSucceeded: number;
  totalProfitLamports: bigint;
  consecutiveFailures: number;
  circuitBreakerOpen: boolean;
  lastScanAt?: number;
}

export interface StrategyContext {
  tokens: TokenInfo[];
  minProfitBps: number;
  maxSlippageBps: number;
  maxTradeSizeLamports: bigint;
}

export interface PriceSnapshot {
  mint: string;
  symbol: string;
  priceUsd: number;
  updatedAt: number;
}
