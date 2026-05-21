import type { AppConfig } from '../config/index.js';
import type {
  ArbitrageOpportunity,
  BotStats,
  RejectedOpportunity,
  ScanResult,
  StrategyContext,
} from '../types/index.js';
import type { ExchangeClient } from '../exchanges/types.js';
import type { ArbitrageStrategy } from '../strategies/base.js';
import { PriceFeed } from '../market/priceFeed.js';
import { resolveTokens } from '../market/tokenRegistry.js';
import { RiskManager, CircuitBreaker } from '../risk/manager.js';
import { TradeExecutor } from '../execution/executor.js';
import { logger } from '../utils/logger.js';

export class ArbitrageEngine {
  private stats: BotStats = {
    totalScans: 0,
    opportunitiesFound: 0,
    tradesExecuted: 0,
    tradesSucceeded: 0,
    totalProfitLamports: 0n,
    consecutiveFailures: 0,
    circuitBreakerOpen: false,
  };

  private scanning = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly strategies: ArbitrageStrategy[],
    private readonly clients: ExchangeClient[],
    private readonly priceFeed: PriceFeed,
    private readonly riskManager: RiskManager,
    private readonly circuitBreaker: CircuitBreaker,
    private readonly executor: TradeExecutor,
  ) {}

  getStats(): BotStats {
    return {
      ...this.stats,
      consecutiveFailures: this.circuitBreaker.getConsecutiveFailures(),
      circuitBreakerOpen: this.circuitBreaker.isOpen(),
    };
  }

  async scanOnce(): Promise<ScanResult> {
    const start = Date.now();
    this.stats.totalScans += 1;

    if (this.config.mode === 'mock') {
      this.priceFeed.tickMockVolatility();
    } else {
      await this.priceFeed.refreshLive();
    }

    const context = this.buildContext();
    const rawOpportunities: ArbitrageOpportunity[] = [];
    const rejected: RejectedOpportunity[] = [];

    for (const strategy of this.strategies) {
      try {
        const found = await strategy.scan(context, this.clients);
        rawOpportunities.push(...found);
        logger.debug(`Strategy ${strategy.name} found ${found.length} opportunities`);
      } catch (error) {
        logger.warn(`Strategy ${strategy.name} failed`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const deduped = this.deduplicateOpportunities(rawOpportunities);
    const approved: ArbitrageOpportunity[] = [];

    for (const opp of deduped) {
      const rejection = this.riskManager.validate(opp);
      if (rejection) {
        rejected.push(rejection);
      } else {
        approved.push(opp);
      }
    }

    this.stats.opportunitiesFound += approved.length;
    this.stats.lastScanAt = Date.now();

    const result: ScanResult = {
      scannedAt: Date.now(),
      mode: this.config.mode,
      opportunities: approved,
      rejected,
      durationMs: Date.now() - start,
    };

    if (approved.length > 0) {
      logger.info(`Scan complete: ${approved.length} opportunities`, {
        bestBps: approved[0]?.netProfitBps,
        durationMs: result.durationMs,
      });
    }

    return result;
  }

  async executeBest(opportunities: ArbitrageOpportunity[]): Promise<void> {
    if (this.circuitBreaker.isOpen()) {
      logger.warn('Circuit breaker open — skipping execution');
      return;
    }

    const best = opportunities[0];
    if (!best) return;

    this.stats.tradesExecuted += 1;
    this.riskManager.recordTrade();

    const result = await this.executor.execute(best);

    if (result.success) {
      this.circuitBreaker.recordSuccess();
      this.stats.tradesSucceeded += 1;
      if (result.profitLamports) {
        this.stats.totalProfitLamports += result.profitLamports;
      }
    } else {
      this.circuitBreaker.recordFailure();
    }
  }

  startContinuous(onScan: (result: ScanResult) => void | Promise<void>): void {
    if (this.scanning) return;
    this.scanning = true;

    const run = async () => {
      try {
        const result = await this.scanOnce();
        await onScan(result);
        if (result.opportunities.length > 0 && this.config.executionEnabled) {
          await this.executeBest(result.opportunities);
        }
      } catch (error) {
        logger.error('Scan loop error', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    void run();
    this.intervalId = setInterval(() => void run(), this.config.scanIntervalMs);
    logger.info('Continuous scanning started', { intervalMs: this.config.scanIntervalMs });
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.scanning = false;
    logger.info('Scanner stopped');
  }

  private buildContext(): StrategyContext {
    return {
      tokens: resolveTokens(this.config.watchTokenSymbols),
      minProfitBps: this.config.minProfitBps,
      maxSlippageBps: this.config.maxSlippageBps,
      maxTradeSizeLamports: this.config.maxTradeSizeLamports,
    };
  }

  private deduplicateOpportunities(opportunities: ArbitrageOpportunity[]): ArbitrageOpportunity[] {
    const seen = new Set<string>();
    const sorted = [...opportunities].sort((a, b) => b.netProfitBps - a.netProfitBps);

    return sorted.filter((opp) => {
      const key = `${opp.strategy}:${opp.legs.map((l) => `${l.venue}:${l.inputMint}:${l.outputMint}`).join('|')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

export function createEngine(
  config: AppConfig,
  strategies: ArbitrageStrategy[],
  clients: ExchangeClient[],
): ArbitrageEngine {
  const priceFeed = new PriceFeed(config.mode);
  const riskManager = new RiskManager(config);
  const circuitBreaker = new CircuitBreaker(config.maxConsecutiveFailures);
  const executor = new TradeExecutor(config);

  return new ArbitrageEngine(
    config,
    strategies,
    clients,
    priceFeed,
    riskManager,
    circuitBreaker,
    executor,
  );
}
