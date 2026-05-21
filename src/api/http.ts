import express from 'express';
import type { ArbitrageEngine } from '../core/engine.js';
import type { AppConfig } from '../config/index.js';

function serializeBigInt(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(serializeBigInt);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, serializeBigInt(v)]),
    );
  }
  return value;
}

export function createHttpServer(config: AppConfig, engine: ArbitrageEngine) {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'axiom-arbitrage-trading-bot',
      version: '1.0.0',
      mode: config.mode,
      dryRun: config.dryRun,
    });
  });

  app.get('/api/v1/stats', (_req, res) => {
    res.json(serializeBigInt(engine.getStats()));
  });

  app.post('/api/v1/scan', async (_req, res) => {
    try {
      const result = await engine.scanOnce();
      res.json(serializeBigInt(result));
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Scan failed',
      });
    }
  });

  app.get('/api/v1/config', (_req, res) => {
    res.json({
      mode: config.mode,
      minProfitBps: config.minProfitBps,
      maxSlippageBps: config.maxSlippageBps,
      maxTradeSizeLamports: config.maxTradeSizeLamports.toString(),
      watchTokens: config.watchTokenSymbols,
      executionEnabled: config.executionEnabled,
      dryRun: config.dryRun,
      scanIntervalMs: config.scanIntervalMs,
    });
  });

  return app;
}

export async function startHttpServer(config: AppConfig, engine: ArbitrageEngine): Promise<void> {
  const app = createHttpServer(config, engine);

  return new Promise((resolve) => {
    app.listen(config.port, config.host, () => {
      console.info(`[INFO] API listening on http://${config.host}:${config.port}`);
      resolve();
    });
  });
}
