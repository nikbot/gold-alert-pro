# Gold Alert Pro v43

## Professional feature API foundation
- Added authenticated market-intelligence context with market regime detection, recent price context, stale-data flag, and explicit uncertainty notice.
- Added risk-based position sizing endpoint with parameter validation.
- Added rule evaluation endpoint for price, RSI, percentage change, and volatility thresholds.
- Added account-scoped paper-trade creation, listing, and closing with P&L calculation and audit events.
- Added automated Node.js tests for core calculations and input validation.

## API
- `GET /api/pro/market-intelligence` (authenticated via account token)
- `POST /api/pro/risk-size` (authenticated)
- `POST /api/pro/evaluate-alert` (authenticated)
- `GET|POST /api/pro/paper-trades` (authenticated)
- `POST /api/pro/paper-trades/:id/close` (authenticated)

This release is a backend foundation, not completion of every item in the v42-v50 roadmap. A full charting UI, external live-feed integration, production LLM integration/reporting, economic-news sourcing, full strategy lab, payment-gateway verification, database migration, and end-to-end security/load testing remain separate implementation and validation tasks. Paper trading is simulated and does not place real orders.
