import type { QuoteRequest, QuoteResult, DexVenue } from '../../types/index.js';
import { PriceFeed } from '../../market/priceFeed.js';
import { TOKEN_REGISTRY } from '../../market/tokenRegistry.js';

export function simulateDexQuote(
  venue: DexVenue,
  request: QuoteRequest,
  priceFeed: PriceFeed,
  venueMultiplier: number,
  routeLabel: string,
  feeBps: number,
): QuoteResult {
  const inputToken = Object.values(TOKEN_REGISTRY).find((t) => t.mint === request.inputMint);
  const outputToken = Object.values(TOKEN_REGISTRY).find((t) => t.mint === request.outputMint);

  if (!inputToken || !outputToken) {
    throw new Error(`Unknown token pair: ${request.inputMint} -> ${request.outputMint}`);
  }

  const inputPrice = priceFeed.getPrice(request.inputMint)?.priceUsd ?? 1;
  const outputPrice = priceFeed.getPrice(request.outputMint)?.priceUsd ?? 1;

  const inputHuman = Number(request.amount) / 10 ** inputToken.decimals;
  const outputHuman = (inputHuman * inputPrice) / outputPrice;
  const outputAmount = BigInt(
    Math.floor(outputHuman * venueMultiplier * 10 ** outputToken.decimals),
  );

  return {
    venue,
    inputMint: request.inputMint,
    outputMint: request.outputMint,
    inputAmount: request.amount,
    outputAmount,
    priceImpactPct: Math.abs(1 - venueMultiplier) * 100,
    feeBps,
    routeLabel,
    fetchedAt: Date.now(),
  };
}
