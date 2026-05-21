import type { PriceSnapshot } from '../types/index.js';
import { TOKEN_REGISTRY } from './tokenRegistry.js';

/** Static reference prices for mock mode — updated periodically in live mode. */
const MOCK_PRICES_USD: Record<string, number> = {
  SOL: 145.5,
  USDC: 1.0,
  BONK: 0.000021,
  WIF: 1.85,
  JUP: 0.92,
  RAY: 3.1,
};

export class PriceFeed {
  private prices: Map<string, PriceSnapshot> = new Map();

  constructor(private readonly mode: 'mock' | 'live' = 'mock') {
    this.seedMockPrices();
  }

  private seedMockPrices(): void {
    const now = Date.now();
    for (const [symbol, token] of Object.entries(TOKEN_REGISTRY)) {
      const priceUsd = MOCK_PRICES_USD[symbol] ?? 1;
      this.prices.set(token.mint, {
        mint: token.mint,
        symbol,
        priceUsd,
        updatedAt: now,
      });
    }
  }

  getPrice(mint: string): PriceSnapshot | undefined {
    return this.prices.get(mint);
  }

  getAllPrices(): PriceSnapshot[] {
    return [...this.prices.values()];
  }

  /** Simulate small price drift for mock arbitrage scenarios. */
  tickMockVolatility(): void {
    if (this.mode !== 'mock') return;

    for (const [mint, snapshot] of this.prices) {
      const drift = 1 + (Math.random() - 0.5) * 0.002;
      this.prices.set(mint, {
        ...snapshot,
        priceUsd: snapshot.priceUsd * drift,
        updatedAt: Date.now(),
      });
    }
  }

  async refreshLive(): Promise<void> {
    if (this.mode !== 'live') return;
    // Live refresh would call Jupiter price API or Pyth — kept as extension point
    this.seedMockPrices();
  }
}
