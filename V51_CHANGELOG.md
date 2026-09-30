# Gold Alert Pro v51.0.0

- Added ordered provider fallback for Iranian 18k gold: configurable TGJU page candidates, authenticated Servix structured API, then authenticated Tindex structured API.
- Added separate API-key/token environment variables; credentials are not embedded in source.
- Normalized provider values to Rial per gram (Tindex documented quote is Toman and is multiplied by 10).
- Improved provider-specific failure messages.
- If all configured sources fail, the tick remains failed rather than creating fresh alerts from stale prices.

## Configuration
Set `SERVIX_API_KEY` and/or `TINDEX_API_TOKEN` in deployment secrets after obtaining credentials from those providers. Without credentials, only TGJU endpoints are attempted.
