import type { ArbitrageOpportunity, RejectedOpportunity } from '../types/index.js';
import type { AppConfig } from '../config/index.js';

export class CircuitBreaker {
  private consecutiveFailures = 0;
  private open = false;
  private openedAt?: number;
  private readonly cooldownMs = 60_000;

  constructor(private readonly maxFailures: number) {}

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.open = false;
    this.openedAt = undefined;
  }

  recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.maxFailures) {
      this.open = true;
      this.openedAt = Date.now();
    }
  }

  isOpen(): boolean {
    if (!this.open) return false;
    if (this.openedAt && Date.now() - this.openedAt > this.cooldownMs) {
      this.open = false;
      this.consecutiveFailures = 0;
      return false;
    }
    return true;
  }

  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }
}

export class RiskManager {
  private dailyTradeCount = 0;
  private dayKey = this.todayKey();

  constructor(private readonly config: AppConfig) {}

  validate(opportunity: ArbitrageOpportunity): RejectedOpportunity | null {
    this.resetDailyIfNeeded();

    if (Date.now() > opportunity.expiresAt) {
      return { opportunity, reason: 'Opportunity expired' };
    }

    if (opportunity.netProfitBps < this.config.minProfitBps) {
      return {
        opportunity,
        reason: `Net profit ${opportunity.netProfitBps} bps below minimum ${this.config.minProfitBps} bps`,
      };
    }

    if (opportunity.inputAmount > this.config.maxTradeSizeLamports) {
      return {
        opportunity,
        reason: `Trade size exceeds max ${this.config.maxTradeSizeLamports} lamports`,
      };
    }

    if (opportunity.confidence < 30) {
      return { opportunity, reason: `Low confidence score: ${opportunity.confidence}` };
    }

    if (this.dailyTradeCount >= this.config.maxDailyTrades) {
      return { opportunity, reason: 'Daily trade limit reached' };
    }

    return null;
  }

  recordTrade(): void {
    this.resetDailyIfNeeded();
    this.dailyTradeCount += 1;
  }

  getDailyTradeCount(): number {
    this.resetDailyIfNeeded();
    return this.dailyTradeCount;
  }

  private resetDailyIfNeeded(): void {
    const key = this.todayKey();
    if (key !== this.dayKey) {
      this.dayKey = key;
      this.dailyTradeCount = 0;
    }
  }

  private todayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
