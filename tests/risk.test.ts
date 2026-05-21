import { describe, it, expect } from 'vitest';
import { RiskManager, CircuitBreaker } from '../src/risk/manager.js';
import { loadConfig } from '../src/config/index.js';
import type { ArbitrageOpportunity } from '../src/types/index.js';
import { SOL_MINT } from '../src/config/index.js';

function makeOpportunity(overrides: Partial<ArbitrageOpportunity> = {}): ArbitrageOpportunity {
  const now = Date.now();
  return {
    id: 'test_opp',
    strategy: 'cross-dex',
    legs: [
      {
        venue: 'jupiter',
        inputMint: SOL_MINT,
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        inputAmount: 100_000_000n,
        expectedOutput: 50_000_000n,
      },
      {
        venue: 'raydium',
        inputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        outputMint: SOL_MINT,
        inputAmount: 50_000_000n,
        expectedOutput: 101_500_000n,
      },
    ],
    startToken: { symbol: 'SOL', mint: SOL_MINT, decimals: 9 },
    endToken: { symbol: 'SOL', mint: SOL_MINT, decimals: 9 },
    inputAmount: 100_000_000n,
    expectedOutput: 101_500_000n,
    grossProfitBps: 150,
    netProfitBps: 120,
    estimatedGasLamports: 29_000,
    confidence: 75,
    detectedAt: now,
    expiresAt: now + 5000,
    ...overrides,
  };
}

describe('RiskManager', () => {
  it('approves valid opportunities', () => {
    const config = loadConfig({ MIN_PROFIT_BPS: '10', BOT_MODE: 'mock' });
    const rm = new RiskManager(config);
    expect(rm.validate(makeOpportunity())).toBeNull();
  });

  it('rejects low profit', () => {
    const config = loadConfig({ MIN_PROFIT_BPS: '200', BOT_MODE: 'mock' });
    const rm = new RiskManager(config);
    const rejection = rm.validate(makeOpportunity({ netProfitBps: 50 }));
    expect(rejection?.reason).toContain('below minimum');
  });

  it('rejects expired opportunities', () => {
    const config = loadConfig({ BOT_MODE: 'mock' });
    const rm = new RiskManager(config);
    const rejection = rm.validate(makeOpportunity({ expiresAt: Date.now() - 1 }));
    expect(rejection?.reason).toBe('Opportunity expired');
  });

  it('rejects oversized trades', () => {
    const config = loadConfig({ MAX_TRADE_SIZE_SOL: '0.01', BOT_MODE: 'mock' });
    const rm = new RiskManager(config);
    const rejection = rm.validate(makeOpportunity({ inputAmount: 1_000_000_000n }));
    expect(rejection?.reason).toContain('exceeds max');
  });
});

describe('CircuitBreaker', () => {
  it('opens after max failures', () => {
    const cb = new CircuitBreaker(3);
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen()).toBe(false);
    cb.recordFailure();
    expect(cb.isOpen()).toBe(true);
  });

  it('resets on success', () => {
    const cb = new CircuitBreaker(2);
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen()).toBe(true);
    cb.recordSuccess();
    expect(cb.isOpen()).toBe(false);
  });
});
