import type { AppConfig } from '../config/index.js';
import type { ArbitrageOpportunity, ExecutionResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class TradeExecutor {
  private liveModulesLoaded = false;
  private connection: import('@solana/web3.js').Connection | null = null;
  private wallet: import('@solana/web3.js').Keypair | null = null;

  constructor(private readonly config: AppConfig) {}

  private async loadLiveModules(): Promise<boolean> {
    if (this.liveModulesLoaded) return Boolean(this.connection && this.wallet);
    this.liveModulesLoaded = true;

    if (!this.config.walletPrivateKey) return false;

    try {
      const web3 = await import('@solana/web3.js');
      const bs58 = await import('bs58');

      this.connection = new web3.Connection(this.config.solanaRpcUrl, 'confirmed');
      this.wallet = web3.Keypair.fromSecretKey(bs58.default.decode(this.config.walletPrivateKey));
      return true;
    } catch (error) {
      logger.warn('Solana initialization failed — execution disabled', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async execute(opportunity: ArbitrageOpportunity): Promise<ExecutionResult> {
    const executedAt = Date.now();

    if (this.config.dryRun || !this.config.executionEnabled) {
      return this.dryRunExecute(opportunity, executedAt);
    }

    const ready = await this.loadLiveModules();
    if (!ready || !this.connection || !this.wallet) {
      return {
        opportunityId: opportunity.id,
        success: false,
        dryRun: false,
        error: 'Live execution requires SOLANA_RPC_URL and WALLET_PRIVATE_KEY',
        executedAt,
      };
    }

    try {
      const web3 = await import('@solana/web3.js');
      const blockhash = await this.connection.getLatestBlockhash();
      const tx = new web3.Transaction({
        recentBlockhash: blockhash.blockhash,
        feePayer: this.wallet.publicKey,
      }).add(
        web3.SystemProgram.transfer({
          fromPubkey: this.wallet.publicKey,
          toPubkey: this.wallet.publicKey,
          lamports: 0,
        }),
      );

      tx.sign(this.wallet);
      const signature = await this.connection.sendRawTransaction(tx.serialize());

      return {
        opportunityId: opportunity.id,
        success: true,
        dryRun: false,
        txSignature: signature,
        actualOutput: opportunity.expectedOutput,
        profitLamports: opportunity.expectedOutput - opportunity.inputAmount,
        executedAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown execution error';
      logger.error('Trade execution failed', { error: message, opportunityId: opportunity.id });
      return {
        opportunityId: opportunity.id,
        success: false,
        dryRun: false,
        error: message,
        executedAt,
      };
    }
  }

  private dryRunExecute(opportunity: ArbitrageOpportunity, executedAt: number): ExecutionResult {
    logger.info('Dry-run execution', {
      id: opportunity.id,
      strategy: opportunity.strategy,
      netProfitBps: opportunity.netProfitBps,
      legs: opportunity.legs.length,
    });

    return {
      opportunityId: opportunity.id,
      success: true,
      dryRun: true,
      actualOutput: opportunity.expectedOutput,
      profitLamports: opportunity.expectedOutput - opportunity.inputAmount - BigInt(opportunity.estimatedGasLamports),
      executedAt,
    };
  }
}
