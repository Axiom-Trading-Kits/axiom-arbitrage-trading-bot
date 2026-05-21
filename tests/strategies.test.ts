import { describe, it, expect } from 'vitest';
import { MockJupiterClient } from '../src/exchanges/jupiter/client.js';
import { MockAxiomClient } from '../src/exchanges/axiom/client.js';
import { MockDexClient } from '../src/exchanges/mock/dexClients.js';
import { PriceFeed } from '../src/market/priceFeed.js';
import { CrossDexStrategy } from '../src/strategies/crossDex.js';
import { TriangularStrategy } from '../src/strategies/triangular.js';
import { CexDexStrategy } from '../src/strategies/cexDex.js';
import { resolveTokens } from '../src/market/tokenRegistry.js';
import { solToLamports } from '../src/utils/math.js';

describe('exchange clients', () => {
  it('mock jupiter returns quotes', async () => {
    const feed = new PriceFeed('mock');
    const client = new MockJupiterClient(feed, 1.01);
    const quote = await client.getQuote({
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amount: 1_000_000_000n,
      slippageBps: 50,
    });
    expect(quote.outputAmount).toBeGreaterThan(0n);
    expect(quote.venue).toBe('jupiter');
  });

  it('mock axiom returns quotes', async () => {
    const feed = new PriceFeed('mock');
    const client = new MockAxiomClient(feed, 1.005);
    const quote = await client.getQuote({
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amount: 500_000_000n,
      slippageBps: 50,
    });
    expect(quote.venue).toBe('axiom');
    expect(await client.isAvailable()).toBe(true);
  });

  it('mock dex clients use price feed', async () => {
    const feed = new PriceFeed('mock');
    const raydium = new MockDexClient('raydium', feed);
    const quote = await raydium.getQuote({
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amount: 1_000_000_000n,
      slippageBps: 50,
    });
    expect(quote.outputAmount).toBeGreaterThan(0n);
    expect(quote.venue).toBe('raydium');
  });
});

describe('strategies', () => {
  const context = {
    tokens: resolveTokens(['SOL', 'USDC', 'BONK', 'WIF']),
    minProfitBps: 5,
    maxSlippageBps: 50,
    maxTradeSizeLamports: solToLamports(0.5),
  };

  const buildClients = () => {
    const feed = new PriceFeed('mock');
    return [
      new MockJupiterClient(feed, 1.002),
      new MockAxiomClient(feed, 1.004),
      new MockDexClient('raydium', feed),
      new MockDexClient('orca', feed),
      new MockDexClient('meteora', feed),
    ];
  };

  it('cross-dex finds opportunities in mock mode', async () => {
    const strategy = new CrossDexStrategy();
    const opps = await strategy.scan(context, buildClients());
    expect(opps.length).toBeGreaterThan(0);
    expect(opps[0]?.strategy).toBe('cross-dex');
    expect(opps[0]?.netProfitBps).toBeLessThan(500);
  });

  it('triangular finds cyclic opportunities', async () => {
    const strategy = new TriangularStrategy();
    const opps = await strategy.scan(context, buildClients());
    expect(opps.length).toBeGreaterThan(0);
    expect(opps[0]?.legs.length).toBeGreaterThanOrEqual(3);
  });

  it('cex-dex finds spread opportunities', async () => {
    const strategy = new CexDexStrategy();
    const opps = await strategy.scan(context, buildClients());
    expect(opps.length).toBeGreaterThan(0);
    expect(opps[0]?.strategy).toBe('cex-dex');
  });
});
