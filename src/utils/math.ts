export function bpsToRatio(bps: number): number {
  return bps / 10_000;
}

export function ratioToBps(ratio: number): number {
  return Math.round(ratio * 10_000);
}

export function calculateProfitBps(input: bigint, output: bigint): number {
  if (input <= 0n) return 0;
  const diff = output - input;
  return Number((diff * 10_000n) / input);
}

export function applySlippage(amount: bigint, slippageBps: number): bigint {
  const factor = 10_000n - BigInt(slippageBps);
  return (amount * factor) / 10_000n;
}

export function lamportsToSol(lamports: bigint): number {
  return Number(lamports) / 1_000_000_000;
}

export function solToLamports(sol: number): bigint {
  return BigInt(Math.floor(sol * 1_000_000_000));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function uniqueId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { attempts?: number; delayMs?: number; label?: string } = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 500;
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) await sleep(delayMs * (i + 1));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${options.label ?? 'operation'} failed after ${attempts} attempts`);
}
