import type { DexVenue, QuoteRequest, QuoteResult } from '../types/index.js';

export interface ExchangeClient {
  readonly venue: DexVenue;
  getQuote(request: QuoteRequest): Promise<QuoteResult>;
  isAvailable(): Promise<boolean>;
}

export interface ExchangeClientFactory {
  createClients(): ExchangeClient[];
}
