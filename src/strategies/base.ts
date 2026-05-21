import type {
  ArbitrageOpportunity,
  StrategyContext,
  StrategyKind,
} from '../types/index.js';
import type { ExchangeClient } from '../exchanges/types.js';

export interface ArbitrageStrategy {
  readonly kind: StrategyKind;
  readonly name: string;
  scan(context: StrategyContext, clients: ExchangeClient[]): Promise<ArbitrageOpportunity[]>;
}

export abstract class BaseStrategy implements ArbitrageStrategy {
  abstract readonly kind: StrategyKind;
  abstract readonly name: string;
  abstract scan(context: StrategyContext, clients: ExchangeClient[]): Promise<ArbitrageOpportunity[]>;

  protected estimateGasLamports(legCount: number): number {
    return 5_000 + legCount * 12_000;
  }
}
