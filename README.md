# Axiom Arbitrage Trading Bot

Production-grade **TypeScript** arbitrage scanner and execution framework for **Solana**, built around the **[Axiom](https://axiom.trade)** on-chain trading terminal and **Jupiter** aggregator routing. Detects **cross-DEX**, **triangular**, and **CEX-DEX** spread opportunities with configurable risk controls, circuit breakers, and **dry-run execution by default**.

> **Safety first:** This bot **does not move mainnet funds by default**. `DRY_RUN=true` and `EXECUTION_ENABLED=false` are the defaults. Review risk limits and wallet configuration before enabling live execution.

## Features

| Module | Description |
| ------ | ----------- |
| **Cross-DEX strategy** | Compare quotes across Jupiter, Axiom, Raydium, Orca, Meteora, and Phoenix to find two-leg spreads |
| **Triangular strategy** | Detect cyclic profit paths (A → B → C → A) via aggregator routing |
| **CEX-DEX strategy** | Compare simulated CEX mid prices against on-chain DEX quotes |
| **Axiom integration** | Dedicated client for Axiom terminal API with mock fallback |
| **Jupiter quotes** | Live quote API support (`quote-api.jup.ag`) with retry logic |
| **Risk manager** | Min profit (bps), max slippage, trade size caps, daily limits, confidence scoring |
| **Circuit breaker** | Halts execution after consecutive failures with auto cooldown |
| **REST API** | Health, stats, scan, and config endpoints |
| **CLI** | One-shot and continuous scanning modes |

## Architecture

```
src/
├── config/          Zod-validated environment configuration
├── types/           Shared domain types
├── market/          Token registry + price feed
├── exchanges/       Jupiter, Axiom, mock DEX clients
├── strategies/      Cross-DEX, triangular, CEX-DEX
├── core/            Arbitrage engine orchestrator
├── risk/            Risk manager + circuit breaker
├── execution/       Trade executor (dry-run / live)
├── api/             Express HTTP server
├── utils/           Logger, math, retry helpers
├── cli.ts           Command-line interface
└── index.ts         Main entry (API + continuous scan)
```

## Quick start

```bash
cd axiom-arbitrage-trading-bot
cp .env.example .env
npm install
npm test
npm run build
npm start
```

Verify the API:

```bash
curl http://127.0.0.1:8790/api/health
curl -X POST http://127.0.0.1:8790/api/v1/scan
```

### One-shot scan (mock mode)

```bash
npm run scan:once
```

### Continuous scanning

```bash
npm run scan
```

### CLI commands

```bash
npm run cli -- scan --once --json
npm run cli -- stats
npm run cli -- health
```

## Configuration

Copy `.env.example` to `.env` and adjust:

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `BOT_MODE` | `mock` | `mock` (simulated) or `live` (real APIs) |
| `SOLANA_RPC_URL` | mainnet RPC | Solana JSON-RPC endpoint |
| `AXIOM_API_KEY` | unset | Axiom terminal API key |
| `JUPITER_QUOTE_URL` | Jupiter v6 | Quote API base URL |
| `MIN_PROFIT_BPS` | `15` | Minimum net profit in basis points |
| `MAX_SLIPPAGE_BPS` | `50` | Max slippage tolerance |
| `MAX_TRADE_SIZE_SOL` | `1` | Max trade size per opportunity |
| `MAX_DAILY_TRADES` | `100` | Daily execution cap |
| `EXECUTION_ENABLED` | `false` | Enable trade execution |
| `DRY_RUN` | `true` | Simulate trades without submitting txs |
| `WATCH_TOKENS` | SOL,USDC,... | Comma-separated token symbols |
| `SCAN_INTERVAL_MS` | `5000` | Continuous scan interval |
| `PORT` | `8790` | HTTP API port |

## REST API

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/api/health` | Liveness probe |
| `GET` | `/api/v1/stats` | Bot statistics |
| `GET` | `/api/v1/config` | Active configuration (safe fields) |
| `POST` | `/api/v1/scan` | Trigger one arbitrage scan |

## Strategies explained

### Cross-DEX

Buys a token on the cheapest venue and sells on the most expensive venue for the same pair. Ideal for memecoin volatility on Solana where Raydium, Orca, Meteora, and Jupiter routes diverge briefly.

### Triangular

Finds three-hop cycles (e.g. SOL → USDC → BONK → SOL) where the round-trip output exceeds input after fees and estimated gas.

### CEX-DEX

Compares centralized exchange mid prices (simulated in mock mode; wire Binance/Bybit/OKX websockets for production) against on-chain DEX quotes for latency-arbitrage windows.

## Production checklist

1. Set `BOT_MODE=live` and configure a reliable `SOLANA_RPC_URL` (Helius, QuickNode, or Alchemy).
2. Add your `AXIOM_API_KEY` for Axiom terminal routing.
3. Wire CEX websocket feeds into `CexDexStrategy` for real CEX-DEX spreads.
4. Set conservative `MIN_PROFIT_BPS`, `MAX_TRADE_SIZE_SOL`, and `MAX_DAILY_TRADES`.
5. Only enable `EXECUTION_ENABLED=true` after thorough dry-run validation.
6. Store `WALLET_PRIVATE_KEY` securely — never commit it to version control.

## Scripts

| Script | Purpose |
| ------ | ------- |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Start API server + continuous scanner |
| `npm run dev` | Development mode with hot reload |
| `npm test` | Run Vitest test suite |
| `npm run lint:types` | TypeScript type check |
| `npm run scan:once` | One-shot CLI scan |
| `npm run scan` | Continuous CLI scanning |

## License

MIT — see [LICENSE](LICENSE).

---

## 🆘 Technical Support

Need help deploying, configuring strategies, or integrating with Axiom / Jupiter?

> **Contact us on Telegram for technical support:**

### 👉 [**@tradingtermin**](https://t.me/tradingtermin)

| Channel | Handle |
| ------- | ------ |
| **Telegram** | **[`@tradingtermin`](https://t.me/tradingtermin)** |

We respond to setup questions, configuration issues, and integration requests.
