import { loadConfig } from './config/index.js';
import { setLogLevel, logger } from './utils/logger.js';
import { createStrategies } from './strategies/index.js';
import { createExchangeClients } from './exchanges/index.js';
import { createEngine } from './core/engine.js';
import { startHttpServer } from './api/http.js';
import { PriceFeed } from './market/priceFeed.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  setLogLevel(config.logLevel);

  logger.info('Starting Axiom Arbitrage Trading Bot', {
    mode: config.mode,
    dryRun: config.dryRun,
    executionEnabled: config.executionEnabled,
  });

  const priceFeed = new PriceFeed(config.mode);
  const clients = createExchangeClients(config, priceFeed);
  const strategies = createStrategies();
  const engine = createEngine(config, strategies, clients);

  await startHttpServer(config, engine);

  engine.startContinuous(async (result) => {
    if (result.opportunities.length > 0) {
      logger.info(`Top opportunity: ${result.opportunities[0]?.netProfitBps} bps (${result.opportunities[0]?.strategy})`);
      if (config.executionEnabled && !config.dryRun) {
        await engine.executeBest(result.opportunities);
      }
    }
  });

  const shutdown = () => {
    logger.info('Shutting down...');
    engine.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((error) => {
  console.error('[FATAL]', error);
  process.exit(1);
});
