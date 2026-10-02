# Gold2 Pro 85.0.1

- Reframed the dashboard as an original dark, multi-asset trading terminal.
- Added a live market watch for Iranian 18k gold and BTC, ETH, SOL, and XRP with source and freshness labels.
- Kept source attribution honest: local gold quotes and reference futures candles are identified separately.
- Uses existing direct market feeds rather than scraping other trading platforms' rendered pages.
- Updated service worker, PWA colors, cache and release versions.

The market watch uses the existing signal endpoint: Iran gold pricing, Yahoo Finance COMEX futures candles, and Coinbase Exchange crypto feeds. Trading signals remain educational and are not financial advice.

- Unified the main AI analysis button with the protected GapGPT endpoint and made non-JSON hosting errors readable instead of showing a JSON parse error.
- Clarified that a configured API key does not prove the provider is reachable; the diagnostic button now reports the real connection test.
- Applied the dark V85 palette to category cards and controls, and grouped the always-available category menu with a dedicated signal section.
