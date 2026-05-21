import type { TokenInfo } from '../types/index.js';
import { SOL_MINT, USDC_MINT } from '../config/index.js';

export const TOKEN_REGISTRY: Record<string, TokenInfo> = {
  SOL: {
    symbol: 'SOL',
    mint: SOL_MINT,
    decimals: 9,
  },
  USDC: {
    symbol: 'USDC',
    mint: USDC_MINT,
    decimals: 6,
  },
  BONK: {
    symbol: 'BONK',
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    decimals: 5,
  },
  WIF: {
    symbol: 'WIF',
    mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    decimals: 6,
  },
  JUP: {
    symbol: 'JUP',
    mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    decimals: 6,
  },
  RAY: {
    symbol: 'RAY',
    mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    decimals: 6,
  },
};

export function resolveToken(symbolOrMint: string): TokenInfo | undefined {
  const upper = symbolOrMint.toUpperCase();
  if (TOKEN_REGISTRY[upper]) return TOKEN_REGISTRY[upper];

  const byMint = Object.values(TOKEN_REGISTRY).find((t) => t.mint === symbolOrMint);
  return byMint;
}

export function resolveTokens(symbols: string[]): TokenInfo[] {
  const tokens: TokenInfo[] = [];
  const seen = new Set<string>();

  for (const symbol of symbols) {
    const token = resolveToken(symbol);
    if (token && !seen.has(token.mint)) {
      seen.add(token.mint);
      tokens.push(token);
    }
  }

  return tokens;
}

export function toBaseUnits(amount: number, decimals: number): bigint {
  const factor = 10 ** decimals;
  return BigInt(Math.floor(amount * factor));
}

export function fromBaseUnits(amount: bigint, decimals: number): number {
  return Number(amount) / 10 ** decimals;
}
