# v47.0.0 — Technical Suite API

- Added authenticated `GET /api/pro/technical-suite` for multi-window SMA (5/10/20/50), sample returns, sample-return volatility, recent high/low, median and empirical support/resistance bands from available local gold price history.
- Added sparse-data handling and explicit caveat that statistical levels are not forecasts.
- Kept v46 startup resilience and `/healthz` behavior.

## Scope note
This is an incremental capability release, not a claim that every roadmap item is fully implemented. FX majors beyond existing feeds, durable relational storage, provider redundancy, full visual modules for every pro API, and production-grade security/integration validation remain separate work.
