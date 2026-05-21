import type { ArbitrageOpportunity, StrategyContext, TokenInfo } from '../types/index.js';
import type { ExchangeClient } from '../exchanges/types.js';
import { BaseStrategy } from './base.js';
import { calculateProfitBps, uniqueId } from '../utils/math.js';

const OPPORTUNITY_TTL_MS = 2_500;

/**
 * Triangular arbitrage: A → B → C → A through a single aggregator route.
 * Uses Jupiter (or mock) for each leg to detect cyclic profit.
 */
export class TriangularStrategy extends BaseStrategy {
  readonly kind = 'triangular' as const;
  readonly name = 'Triangular Cycle';

  async scan(context: StrategyContext, clients: ExchangeClient[]): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    const primary = clients.find((c) => c.venue === 'jupiter') ?? clients[0];
    if (!primary || context.tokens.length < 3) return opportunities;

    const cycles = this.buildCycles(context.tokens);

    for (const cycle of cycles) {
      try {
        const result = await this.evaluateCycle(primary, cycle, context);
        if (result) opportunities.push(result);
      } catch {
        // Skip failed cycle evaluation
      }
    }

    return opportunities.sort((a, b) => b.netProfitBps - a.netProfitBps);
  }

  private buildCycles(tokens: TokenInfo[]): TokenInfo[][] {
    const cycles: TokenInfo[][] = [];
    for (let i = 0; i < tokens.length; i++) {
      for (let j = 0; j < tokens.length; j++) {
        for (let k = 0; k < tokens.length; k++) {
          if (i === j || j === k || i === k) continue;
          cycles.push([tokens[i]!, tokens[j]!, tokens[k]!, tokens[i]!]);
        }
      }
    }
    return cycles.slice(0, 12);
  }

  private async evaluateCycle(
    client: ExchangeClient,
    cycle: TokenInfo[],
    context: StrategyContext,
  ): Promise<ArbitrageOpportunity | null> {
    const start = cycle[0]!;
    const tradeAmount = context.maxTradeSizeLamports;

    let currentAmount = tradeAmount;
    const legs: ArbitrageOpportunity['legs'] = [];
    let totalImpact = 0;

    for (let i = 0; i < cycle.length - 1; i++) {
      const from = cycle[i]!;
      const to = cycle[i + 1]!;

      const quote = await client.getQuote({
        inputMint: from.mint,
        outputMint: to.mint,
        amount: currentAmount,
        slippageBps: context.maxSlippageBps,
      });

      legs.push({
        venue: quote.venue,
        inputMint: from.mint,
        outputMint: to.mint,
        inputAmount: currentAmount,
        expectedOutput: quote.outputAmount,
      });

      currentAmount = quote.outputAmount;
      totalImpact += quote.priceImpactPct;
    }

    const grossBps = calculateProfitBps(tradeAmount, currentAmount);
    const gasLamports = this.estimateGasLamports(legs.length);
    const netOutput = currentAmount - BigInt(gasLamports);
    const netBps = calculateProfitBps(tradeAmount, netOutput);

    if (netBps < context.minProfitBps) return null;

    return {
      id: uniqueId('triangular'),
      strategy: this.kind,
      legs,
      startToken: start,
      endToken: start,
      inputAmount: tradeAmount,
      expectedOutput: currentAmount,
      grossProfitBps: grossBps,
      netProfitBps: netBps,
      estimatedGasLamports: gasLamports,
      confidence: Math.max(0, Math.min(100, 55 - totalImpact * 8 + netBps / 3)),
      detectedAt: Date.now(),
      expiresAt: Date.now() + OPPORTUNITY_TTL_MS,
    };
  }
}
