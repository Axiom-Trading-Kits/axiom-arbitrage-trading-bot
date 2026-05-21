import type { ArbitrageOpportunity, StrategyContext } from '../types/index.js';
import type { ExchangeClient } from '../exchanges/types.js';
import { BaseStrategy } from './base.js';
import { calculateProfitBps, uniqueId } from '../utils/math.js';
import { SOL_MINT } from '../config/index.js';

const OPPORTUNITY_TTL_MS = 4_000;

/** Simulated CEX mid prices — offset from DEX for mock CEX-DEX arb. */
const CEX_PRICE_OFFSET_BPS = 35;

/**
 * CEX-DEX arbitrage: compare simulated centralized exchange mid against DEX quotes.
 * In production, wire Binance/Bybit/OKX websocket feeds.
 */
export class CexDexStrategy extends BaseStrategy {
  readonly kind = 'cex-dex' as const;
  readonly name = 'CEX-DEX Spread';

  async scan(context: StrategyContext, clients: ExchangeClient[]): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    const dexClient = clients.find((c) => c.venue === 'jupiter') ?? clients[0];
    if (!dexClient) return opportunities;

    const solToken = context.tokens.find((t) => t.mint === SOL_MINT);
    if (!solToken) return opportunities;

    const tradeAmount = context.maxTradeSizeLamports;

    for (const token of context.tokens) {
      if (token.mint === SOL_MINT) continue;

      const dexBuy = await dexClient.getQuote({
        inputMint: SOL_MINT,
        outputMint: token.mint,
        amount: tradeAmount,
        slippageBps: context.maxSlippageBps,
      });

      const cexSellOutput = this.simulateCexSell(tradeAmount, dexBuy.outputAmount);
      const grossBps = calculateProfitBps(tradeAmount, cexSellOutput);
      const gasLamports = this.estimateGasLamports(1);
      const netOutput = cexSellOutput - BigInt(gasLamports);
      const netBps = calculateProfitBps(tradeAmount, netOutput);

      if (netBps >= context.minProfitBps) {
        opportunities.push({
          id: uniqueId('cex_dex'),
          strategy: this.kind,
          legs: [
            {
              venue: dexClient.venue,
              inputMint: SOL_MINT,
              outputMint: token.mint,
              inputAmount: tradeAmount,
              expectedOutput: dexBuy.outputAmount,
            },
            {
              venue: 'axiom',
              inputMint: token.mint,
              outputMint: SOL_MINT,
              inputAmount: dexBuy.outputAmount,
              expectedOutput: cexSellOutput,
            },
          ],
          startToken: solToken,
          endToken: solToken,
          inputAmount: tradeAmount,
          expectedOutput: cexSellOutput,
          grossProfitBps: grossBps,
          netProfitBps: netBps,
          estimatedGasLamports: gasLamports,
          confidence: Math.min(90, 50 + netBps),
          detectedAt: Date.now(),
          expiresAt: Date.now() + OPPORTUNITY_TTL_MS,
        });
      }
    }

    return opportunities.sort((a, b) => b.netProfitBps - a.netProfitBps);
  }

  private simulateCexSell(inputLamports: bigint, _dexTokenOutput: bigint): bigint {
    const premiumBps = BigInt(CEX_PRICE_OFFSET_BPS);
    return inputLamports + (inputLamports * premiumBps) / 10_000n;
  }
}
