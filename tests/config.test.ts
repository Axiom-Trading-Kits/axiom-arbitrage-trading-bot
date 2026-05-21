import { describe, it, expect } from 'vitest';
import { loadConfig, SOL_MINT, USDC_MINT } from '../src/config/index.js';
import { resolveToken, resolveTokens, toBaseUnits } from '../src/market/tokenRegistry.js';
import { calculateProfitBps, applySlippage, bpsToRatio } from '../src/utils/math.js';

describe('config', () => {
  it('loads defaults in mock mode', () => {
    const config = loadConfig({ BOT_MODE: 'mock' });
    expect(config.mode).toBe('mock');
    expect(config.dryRun).toBe(true);
    expect(config.minProfitBps).toBeGreaterThan(0);
  });

  it('parses watch tokens', () => {
    const config = loadConfig({ WATCH_TOKENS: 'SOL, USDC , BONK' });
    expect(config.watchTokenSymbols).toEqual(['SOL', 'USDC', 'BONK']);
  });
});

describe('tokenRegistry', () => {
  it('resolves SOL by symbol and mint', () => {
    expect(resolveToken('SOL')?.mint).toBe(SOL_MINT);
    expect(resolveToken(SOL_MINT)?.symbol).toBe('SOL');
  });

  it('resolves multiple tokens without duplicates', () => {
    const tokens = resolveTokens(['SOL', 'SOL', 'USDC']);
    expect(tokens).toHaveLength(2);
    expect(tokens.map((t) => t.symbol)).toEqual(['SOL', 'USDC']);
  });

  it('converts base units', () => {
    expect(toBaseUnits(1, 9)).toBe(1_000_000_000n);
    expect(toBaseUnits(1, 6)).toBe(1_000_000n);
  });
});

describe('math utils', () => {
  it('calculates profit bps', () => {
    expect(calculateProfitBps(1_000_000n, 1_001_500n)).toBe(15);
  });

  it('applies slippage', () => {
    expect(applySlippage(10_000n, 100)).toBe(9_900n);
  });

  it('converts bps to ratio', () => {
    expect(bpsToRatio(50)).toBe(0.005);
  });
});

describe('constants', () => {
  it('has valid mint addresses', () => {
    expect(USDC_MINT.length).toBeGreaterThan(30);
    expect(SOL_MINT.length).toBeGreaterThan(30);
  });
});
