import type { QuoteRequest, QuoteResult } from '../../types/index.js';
import type { ExchangeClient } from '../types.js';
import { PriceFeed } from '../../market/priceFeed.js';
import { simulateDexQuote } from '../mock/quoteSimulator.js';
import { withRetry } from '../../utils/math.js';
import { logger } from '../../utils/logger.js';

interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan?: Array<{ swapInfo?: { label?: string } }>;
}

export class JupiterClient implements ExchangeClient {
  readonly venue = 'jupiter' as const;

  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000&slippageBps=50`, {
        signal: AbortSignal.timeout(8000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getQuote(request: QuoteRequest): Promise<QuoteResult> {
    const params = new URLSearchParams({
      inputMint: request.inputMint,
      outputMint: request.outputMint,
      amount: request.amount.toString(),
      slippageBps: request.slippageBps.toString(),
    });

    const url = `${this.baseUrl}/quote?${params.toString()}`;

    const data = await withRetry(
      async () => {
        const res = await this.fetchFn(url, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Jupiter quote failed (${res.status}): ${body.slice(0, 200)}`);
        }
        return (await res.json()) as JupiterQuoteResponse;
      },
      { attempts: 2, label: 'jupiter-quote' },
    );

    const routeLabel =
      data.routePlan?.map((r) => r.swapInfo?.label).filter(Boolean).join(' → ') || 'Jupiter route';

    return {
      venue: 'jupiter',
      inputMint: data.inputMint,
      outputMint: data.outputMint,
      inputAmount: BigInt(data.inAmount),
      outputAmount: BigInt(data.outAmount),
      priceImpactPct: parseFloat(data.priceImpactPct) || 0,
      feeBps: 25,
      routeLabel,
      fetchedAt: Date.now(),
    };
  }
}

export class MockJupiterClient implements ExchangeClient {
  readonly venue = 'jupiter' as const;

  constructor(
    private readonly priceFeed: PriceFeed,
    private readonly venueMultiplier = 1.001,
  ) {}

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getQuote(request: QuoteRequest): Promise<QuoteResult> {
    return simulateDexQuote(
      'jupiter',
      request,
      this.priceFeed,
      this.venueMultiplier,
      'Mock Jupiter (simulated spread)',
      25,
    );
  }
}

export function createJupiterClient(
  baseUrl: string,
  mode: 'mock' | 'live',
  priceFeed?: PriceFeed,
): ExchangeClient {
  if (mode === 'mock') {
    logger.debug('Using mock Jupiter client');
    return new MockJupiterClient(priceFeed ?? new PriceFeed('mock'), 1.001);
  }
  return new JupiterClient(baseUrl);
}
