import type { QuoteRequest, QuoteResult } from '../../types/index.js';
import type { ExchangeClient } from '../types.js';
import { PriceFeed } from '../../market/priceFeed.js';
import { simulateDexQuote } from '../mock/quoteSimulator.js';
import { withRetry } from '../../utils/math.js';
import { logger } from '../../utils/logger.js';

interface AxiomQuoteResponse {
  success: boolean;
  data?: {
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    priceImpact: number;
    route: string;
  };
  error?: string;
}

/**
 * Axiom on-chain trading terminal client.
 * Falls back to deterministic mock quotes when API key is absent or in mock mode.
 */
export class AxiomClient implements ExchangeClient {
  readonly venue = 'axiom' as const;

  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string | undefined,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const res = await this.fetchFn(`${this.apiUrl}/v1/health`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getQuote(request: QuoteRequest): Promise<QuoteResult> {
    if (!this.apiKey) {
      throw new Error('Axiom API key not configured');
    }

    const url = `${this.apiUrl}/v1/quote`;
    const body = JSON.stringify({
      inputMint: request.inputMint,
      outputMint: request.outputMint,
      amount: request.amount.toString(),
      slippageBps: request.slippageBps,
    });

    const data = await withRetry(
      async () => {
        const res = await this.fetchFn(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) {
          throw new Error(`Axiom quote failed (${res.status})`);
        }

        return (await res.json()) as AxiomQuoteResponse;
      },
      { attempts: 2, label: 'axiom-quote' },
    );

    if (!data.success || !data.data) {
      throw new Error(data.error ?? 'Axiom quote unsuccessful');
    }

    return {
      venue: 'axiom',
      inputMint: data.data.inputMint,
      outputMint: data.data.outputMint,
      inputAmount: BigInt(data.data.inAmount),
      outputAmount: BigInt(data.data.outAmount),
      priceImpactPct: data.data.priceImpact,
      feeBps: 30,
      routeLabel: data.data.route || 'Axiom fast route',
      fetchedAt: Date.now(),
    };
  }
}

export class MockAxiomClient implements ExchangeClient {
  readonly venue = 'axiom' as const;

  constructor(
    private readonly priceFeed: PriceFeed,
    private readonly venueMultiplier = 1.003,
  ) {}

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getQuote(request: QuoteRequest): Promise<QuoteResult> {
    return simulateDexQuote(
      'axiom',
      request,
      this.priceFeed,
      this.venueMultiplier,
      'Axiom simulated route',
      30,
    );
  }
}

export function createAxiomClient(
  apiUrl: string,
  apiKey: string | undefined,
  mode: 'mock' | 'live',
  priceFeed?: PriceFeed,
): ExchangeClient {
  if (mode === 'mock' || !apiKey) {
    logger.debug('Using mock Axiom client');
    return new MockAxiomClient(priceFeed ?? new PriceFeed('mock'), 1.003);
  }
  return new AxiomClient(apiUrl, apiKey);
}
