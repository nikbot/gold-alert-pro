import test from "node:test";
import assert from "node:assert/strict";
import { analyzeCandles, normalizeTimeframe, paperPnl } from "./tradingSignals.js";

function trendBars(direction = 1, now = Date.now()) {
  const interval = 60 * 60_000;
  return Array.from({ length: 80 }, (_, i) => {
    const close = 100 + direction * i * 0.8;
    return {
      time: now - (80 - i + 1) * interval,
      open: close - direction * 0.5,
      high: Math.max(close, close - direction * 0.5) + 0.1,
      low: Math.min(close, close - direction * 0.5) - 0.1,
      close,
      volume: i === 79 ? 200 : 100
    };
  });
}

test("strong rising candles and real buy flow can produce a buy signal", () => {
  const result = analyzeCandles(trendBars(1), { timeframeMs: 60 * 60_000, buyVolume: 900, sellVolume: 100, actual: true });
  assert.equal(result.signal, "BUY");
  assert.ok(result.score >= 65);
  assert.ok(result.reasons.some(x => x.includes("حجم خرید")));
  assert.equal(result.flowActual, true);
});

test("falling candles and sell flow can produce a sell signal", () => {
  const result = analyzeCandles(trendBars(-1), { timeframeMs: 60 * 60_000, buyVolume: 100, sellVolume: 900, actual: true });
  assert.equal(result.signal, "SELL");
  assert.ok(result.score >= 65);
});

test("stale or insufficient candles never produce a trade direction", () => {
  const few = analyzeCandles(trendBars(1).slice(-20), { timeframeMs: 60 * 60_000 });
  const old = analyzeCandles(trendBars(1, Date.now() - 10 * 24 * 60 * 60_000), { timeframeMs: 60 * 60_000 });
  assert.equal(few.signal, "WAIT");
  assert.equal(old.signal, "WAIT");
  assert.equal(old.stale, true);
});

test("paper returns handle long and short positions with the user's amount", () => {
  assert.ok(Math.abs(paperPnl({ direction: "BUY", entry: 100, amount: 1_000_000 }, 110) - 100_000) < 1e-8);
  assert.ok(Math.abs(paperPnl({ direction: "SELL", entry: 100, amount: 1_000_000 }, 110) + 100_000) < 1e-8);
  assert.ok(Math.abs(paperPnl({ direction: "SELL", entry: 100, amount: 1_000_000 }, 90) - 100_000) < 1e-8);
});

test("unknown timeframe safely falls back to one hour", () => {
  assert.equal(normalizeTimeframe("garbage"), "1h");
});
