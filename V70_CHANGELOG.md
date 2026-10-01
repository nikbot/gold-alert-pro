# Gold2 Pro V70 — Forgod Multi-Market Provider

- Forgod API is queried first for 18K gold, USD and Bitcoin.
- Existing TGJU/Servix/Tindex sources remain fallback providers.
- Forgod `/api/all` is also exposed as a separate market feed.
- API key is backend-only via `FORGOD_API_KEY`.
- No Forgod key is embedded in frontend code.
- Bitcoin is added to the live state.
- Provider diagnostics now expose Forgod health/priority.
- Version 70.0.0.
