# Gold2 Pro V64 — Existing API Price Engine Fix

- Existing TGJU / Servix / Tindex configuration is used; no new credential is required.
- Structured API parsing now accepts nested `value`, `price`, `current`, `last`, `rate`, `amount`, `close`, `sell`, and related fields.
- Servix accepts both `X-API-Key` and Bearer authentication using the existing `SERVIX_API_KEY`.
- Tindex accepts both Bearer and `X-API-Key` using the existing `TINDEX_API_TOKEN`.
- Tindex unit handling is normalized without double-converting explicit Rial responses.
- TGJU official market-data widget is a same-provider recovery path when profile HTML parsing is unavailable.
- `/api/state`, `/api/price-engine`, and SSE continue to use the same state engine.
- Backend application version corrected from the stale 61.0.0 constant to 64.0.0.
