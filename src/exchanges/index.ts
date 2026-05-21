import type { AppConfig } from '../config/index.js';
import type { ExchangeClient } from './types.js';
import { createJupiterClient } from './jupiter/client.js';
import { createAxiomClient } from './axiom/client.js';
import { createMockDexClients } from './mock/dexClients.js';
import { PriceFeed } from '../market/priceFeed.js';

export function createExchangeClients(config: AppConfig, priceFeed: PriceFeed): ExchangeClient[] {
  const clients: ExchangeClient[] = [
    createJupiterClient(config.jupiterQuoteUrl, config.mode, priceFeed),
    createAxiomClient(config.axiomApiUrl, config.axiomApiKey, config.mode, priceFeed),
  ];

  if (config.mode === 'mock') {
    clients.push(...createMockDexClients(priceFeed));
  }

  return clients;
}

export type { ExchangeClient };
