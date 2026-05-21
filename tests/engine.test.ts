import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../src/config/index.js';
import { createStrategies } from '../src/strategies/index.js';
import { createExchangeClients } from '../src/exchanges/index.js';
import { createEngine } from '../src/core/engine.js';
import { createHttpServer } from '../src/api/http.js';
import { PriceFeed } from '../src/market/priceFeed.js';
import { TradeExecutor } from '../src/execution/executor.js';
import type { ArbitrageOpportunity } from '../src/types/index.js';
import { SOL_MINT } from '../src/config/index.js';

describe('ArbitrageEngine', () => {
  it('runs a full mock scan cycle', async () => {
    const config = loadConfig({
      BOT_MODE: 'mock',
      MIN_PROFIT_BPS: '5',
      WATCH_TOKENS: 'SOL,USDC,BONK',
    });

    const priceFeed = new PriceFeed('mock');
    const clients = createExchangeClients(config, priceFeed);
    const engine = createEngine(config, createStrategies(), clients);

    const result = await engine.scanOnce();
    expect(result.mode).toBe('mock');
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.opportunities.length + result.rejected.length).toBeGreaterThan(0);

    const stats = engine.getStats();
    expect(stats.totalScans).toBe(1);
  });

  it('deduplicates and ranks opportunities', async () => {
    const config = loadConfig({ BOT_MODE: 'mock', MIN_PROFIT_BPS: '1' });
    const priceFeed = new PriceFeed('mock');
    const engine = createEngine(config, createStrategies(), createExchangeClients(config, priceFeed));

    const first = await engine.scanOnce();
    const second = await engine.scanOnce();

    if (first.opportunities.length >= 2) {
      expect(first.opportunities[0]!.netProfitBps).toBeGreaterThanOrEqual(
        first.opportunities[1]!.netProfitBps,
      );
    }

    expect(engine.getStats().totalScans).toBe(2);
    expect(second.scannedAt).toBeGreaterThanOrEqual(first.scannedAt);
  });
});

describe('TradeExecutor', () => {
  it('dry-runs by default', async () => {
    const config = loadConfig({ BOT_MODE: 'mock', DRY_RUN: 'true', EXECUTION_ENABLED: 'false' });
    const executor = new TradeExecutor(config);

    const opp: ArbitrageOpportunity = {
      id: 'dry_run_test',
      strategy: 'cross-dex',
      legs: [],
      startToken: { symbol: 'SOL', mint: SOL_MINT, decimals: 9 },
      endToken: { symbol: 'SOL', mint: SOL_MINT, decimals: 9 },
      inputAmount: 100_000_000n,
      expectedOutput: 101_000_000n,
      grossProfitBps: 100,
      netProfitBps: 80,
      estimatedGasLamports: 25_000,
      confidence: 80,
      detectedAt: Date.now(),
      expiresAt: Date.now() + 5000,
    };

    const result = await executor.execute(opp);
    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.profitLamports).toBeDefined();
  });
});

describe('HTTP API', () => {
  it('serves health and scan endpoints', async () => {
    const config = loadConfig({ BOT_MODE: 'mock', PORT: '8799' });
    const priceFeed = new PriceFeed('mock');
    const engine = createEngine(config, createStrategies(), createExchangeClients(config, priceFeed));
    const app = createHttpServer(config, engine);

    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');

    const scan = await request(app).post('/api/v1/scan');
    expect(scan.status).toBe(200);
    expect(scan.body.opportunities).toBeDefined();

    const stats = await request(app).get('/api/v1/stats');
    expect(stats.status).toBe(200);
    expect(stats.body.totalScans).toBe(1);
  });
});
