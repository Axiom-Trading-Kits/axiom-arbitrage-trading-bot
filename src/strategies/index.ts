import type { ArbitrageStrategy } from './base.js';
import { CrossDexStrategy } from './crossDex.js';
import { TriangularStrategy } from './triangular.js';
import { CexDexStrategy } from './cexDex.js';

export function createStrategies(): ArbitrageStrategy[] {
  return [new CrossDexStrategy(), new TriangularStrategy(), new CexDexStrategy()];
}

export { CrossDexStrategy, TriangularStrategy, CexDexStrategy };
export type { ArbitrageStrategy };
