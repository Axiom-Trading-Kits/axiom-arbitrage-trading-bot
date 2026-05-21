#!/usr/bin/env node
import { loadConfig } from './config/index.js';
import { setLogLevel } from './utils/logger.js';
import { createStrategies } from './strategies/index.js';
import { createExchangeClients } from './exchanges/index.js';
import { createEngine } from './core/engine.js';
import { PriceFeed } from './market/priceFeed.js';
import { logger } from './utils/logger.js';
import { lamportsToSol } from './utils/math.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ?? 'help';

  const config = loadConfig();
  setLogLevel(config.logLevel);

  const priceFeed = new PriceFeed(config.mode);
  const clients = createExchangeClients(config, priceFeed);
  const strategies = createStrategies();
  const engine = createEngine(config, strategies, clients);

  switch (command) {
    case 'scan': {
      const once = args.includes('--once');
      const json = args.includes('--json');

      if (once) {
        const result = await engine.scanOnce();
        if (json) {
          console.log(JSON.stringify(result, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
        } else {
          printScanResult(result);
        }
        break;
      }

      engine.startContinuous((result) => {
        printScanResult(result);
      });

      process.on('SIGINT', () => {
        engine.stop();
        process.exit(0);
      });
      break;
    }

    case 'stats': {
      console.log(JSON.stringify(engine.getStats(), (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
      break;
    }

    case 'health': {
      const availability = await Promise.all(clients.map(async (c) => [c.venue, await c.isAvailable()] as const));
      console.log(JSON.stringify({ mode: config.mode, venues: Object.fromEntries(availability) }, null, 2));
      break;
    }

    default:
      printHelp();
  }
}

function printScanResult(result: Awaited<ReturnType<ReturnType<typeof createEngine>['scanOnce']>>): void {
  logger.info(`Scan finished in ${result.durationMs}ms`, {
    found: result.opportunities.length,
    rejected: result.rejected.length,
  });

  for (const opp of result.opportunities.slice(0, 5)) {
    console.log(
      `  [${opp.strategy}] ${opp.netProfitBps} bps net | ${opp.legs.length} legs | confidence ${opp.confidence}% | ${opp.legs.map((l) => l.venue).join(' → ')}`,
    );
    console.log(
      `    in: ${lamportsToSol(opp.inputAmount).toFixed(4)} SOL → out: ${lamportsToSol(opp.expectedOutput).toFixed(4)} SOL`,
    );
  }
}

function printHelp(): void {
  console.log(`
axiom-arbitrage-trading-bot CLI

Usage:
  npm run scan:once          One-shot arbitrage scan (mock mode default)
  npm run scan               Continuous scanning
  npm run cli -- scan --json One-shot scan with JSON output
  npm run cli -- stats       Print bot statistics
  npm run cli -- health      Check exchange venue availability

Environment:
  Copy .env.example to .env and configure BOT_MODE, risk limits, and API keys.
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
