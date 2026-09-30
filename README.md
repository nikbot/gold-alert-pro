# Gold Alert Pro v45

Gold Alert Pro is a market monitoring and analysis web application. This package builds on v44 Smart Alerts and adds a dedicated cryptocurrency market workspace.

## Requirements
- Node.js 20+
- npm

## Run
```bash
npm install
cp .env.example .env
npm start
```
Open `http://localhost:3000`.

## Deploy
Configure a persistent writable `DATA_DIR` on your host. Keep API keys in the host's secret/environment settings, never in `public/` or source control. Use the included `deplexo.yaml` or Dockerfile where applicable, then deploy the repository/package.

## v45 additions
- Responsive cryptocurrency market category in the side menu.
- Server endpoint `/api/crypto-markets` fetching 24-hour spot ticker information for selected USDT pairs from Binance public API.
- Price, 24-hour percent change, high/low, source and timestamp display.
- Request timeout and unavailable-source handling.

## Existing features retained
- Iran 18k gold, dollar, global gold and local coin market panels where providers are reachable.
- Technical indicators, AI endpoints, price alerts, notifications, portfolio tools, admin workflows and paper-trade foundations from earlier versions.

## Important limitations
- Crypto market data depends on external Binance API availability and regional/network access; it is not a guaranteed executable quote.
- USDT is a quote asset and is not guaranteed to equal USD.
- Only USD/IRR has an existing configured local-market feed. No EUR, GBP or JPY prices are fabricated; configure a trusted provider before displaying those quotes.
- Trading analysis and AI outputs are informational scenarios, not guaranteed predictions or individualized financial advice. Verify quotes and assumptions independently.
- v45 is an incremental release, not completion of every feature planned through v50.

See `V45_CHANGELOG.md`, `GITHUB_DEPLOY.md` and `SECURITY.md`.
