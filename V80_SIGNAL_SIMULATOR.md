# V80 Live Signals and Paper Practice

## Assets and data
- Gold is listed first. Its gram price is the existing live 18k quote; its technical candles and total traded volume come from COMEX gold futures (`GC=F`) via Yahoo Finance.
- BTC, ETH, SOL, and XRP use Coinbase Exchange candles and recent public trades. Buy/sell flow uses the trade side reported by the exchange for the last five minutes.
- Gold futures provide total volume, not aggressor-side volume. Gold buy/sell split is therefore estimated from rising/falling candles and labeled as an estimate.
- When live data is missing, too old, or too sparse, the engine returns WAIT instead of manufacturing a signal.

## Signal rules
- Completed OHLCV candles, EMA trend, RSI, MACD momentum, candle close location, volume relative to its recent average, and buy/sell flow contribute to the directional score.
- Signals require at least 50 completed candles, a fresh quote, and aligned technical/volume evidence. Otherwise the interface says to wait.
- Stop and target distances use recent candle range (ATR-style) and are shown as scenarios, not guaranteed levels.
- Holding periods are rough horizons for the selected chart interval: 15 minutes, one hour, four hours, or daily.

## Paper practice
- `GET /api/trading-signals?timeframe=1h` provides gold and crypto cards with data source, data freshness, signal, score, reasons, prices, and candles. Supported intervals: `15m`, `1h`, `4h`, `1d`.
- `POST /api/paper-trades` accepts `{ "deviceId", "symbol", "amount", "timeframe" }`. Gold amount is in tomans; crypto amount is in USD. Only an actionable fresh signal can start a practice trade.
- `GET /api/paper-trades?deviceId=...` returns open and closed practice trades. Open trades are updated from live market quotes and close on target, stop, or the selected holding-time limit. Results persist under `DATA_DIR/paper-trades.json`.
- The simulator does not submit exchange orders. Fees, spread, slippage, taxes, and exchange execution are excluded, so practice P/L is not expected real P/L.

## Tests
- `npm test`
- `npm run check`
