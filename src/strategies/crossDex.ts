import type { ArbitrageOpportunity, StrategyContext } from '../types/index.js';
import type { ExchangeClient } from '../exchanges/types.js';
import { BaseStrategy } from './base.js';
import { calculateProfitBps, uniqueId } from '../utils/math.js';
import { SOL_MINT } from '../config/index.js';

const OPPORTUNITY_TTL_MS = 3_000;

/**
 * Cross-DEX arbitrage: buy on venue A, sell on venue B for the same pair.
 * Compares all exchange client quotes for each token pair.
 */
export class CrossDexStrategy extends BaseStrategy {
  readonly kind = 'cross-dex' as const;
  readonly name = 'Cross-DEX Spread';

  async scan(context: StrategyContext, clients: ExchangeClient[]): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    const solToken = context.tokens.find((t) => t.mint === SOL_MINT);
    if (!solToken) return opportunities;

    const tradeAmount = context.maxTradeSizeLamports;
    const otherTokens = context.tokens.filter((t) => t.mint !== SOL_MINT);

    for (const token of otherTokens) {
      const buyQuotes = await this.fetchQuotes(clients, {
        inputMint: SOL_MINT,
        outputMint: token.mint,
        amount: tradeAmount,
        slippageBps: context.maxSlippageBps,
      });

      for (const buy of buyQuotes) {
        const sellQuotes = await this.fetchQuotes(clients, {
          inputMint: token.mint,
          outputMint: SOL_MINT,
          amount: buy.outputAmount,
          slippageBps: context.maxSlippageBps,
        });

        for (const sell of sellQuotes) {
          if (buy.venue === sell.venue) continue;

          const grossBps = calculateProfitBps(tradeAmount, sell.outputAmount);
          const gasLamports = this.estimateGasLamports(2);
          const netOutput = sell.outputAmount - BigInt(gasLamports);
          const netBps = calculateProfitBps(tradeAmount, netOutput);

          if (netBps < context.minProfitBps) continue;

          opportunities.push({
            id: uniqueId('cross_dex'),
            strategy: this.kind,
            legs: [
              {
                venue: buy.venue,
                inputMint: SOL_MINT,
                outputMint: token.mint,
                inputAmount: tradeAmount,
                expectedOutput: buy.outputAmount,
              },
              {
                venue: sell.venue,
                inputMint: token.mint,
                outputMint: SOL_MINT,
                inputAmount: buy.outputAmount,
                expectedOutput: sell.outputAmount,
              },
            ],
            startToken: solToken,
            endToken: solToken,
            inputAmount: tradeAmount,
            expectedOutput: sell.outputAmount,
            grossProfitBps: grossBps,
            netProfitBps: netBps,
            estimatedGasLamports: gasLamports,
            confidence: this.scoreConfidence(buy.priceImpactPct + sell.priceImpactPct, netBps),
            detectedAt: Date.now(),
            expiresAt: Date.now() + OPPORTUNITY_TTL_MS,
          });
        }
      }
    }

    return opportunities.sort((a, b) => b.netProfitBps - a.netProfitBps);
  }

  private async fetchQuotes(
    clients: ExchangeClient[],
    request: { inputMint: string; outputMint: string; amount: bigint; slippageBps: number },
  ) {
    const results = await Promise.allSettled(clients.map((c) => c.getQuote(request)));
    return results
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<ExchangeClient['getQuote']>>> => r.status === 'fulfilled')
      .map((r) => r.value);
  }

  private scoreConfidence(totalImpactPct: number, netBps: number): number {
    const impactPenalty = Math.min(totalImpactPct * 10, 40);
    const profitBonus = Math.min(netBps / 2, 50);
    return Math.max(0, Math.min(100, 60 - impactPenalty + profitBonus));
  }
}
