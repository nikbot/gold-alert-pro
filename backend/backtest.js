import { ema, rsi, macd } from "./indicators.js";

export function runBacktest(rows, opts = {}) {
  const minScore = Number(opts.minScore ?? 65);
  const targetPct = Number(opts.targetPct ?? 1.5);
  const stopPct = Number(opts.stopPct ?? 1);
  const clean = Array.isArray(rows) ? rows.filter(r => Number.isFinite(Number(r?.close))) : [];
  const prices = clean.map(x => Number(x.close));
  let position = null;
  let equity = 1;
  let peak = 1;
  let maxDD = 0;
  const trades = [];

  function signalAt(i) {
    const h = prices.slice(0, i + 1);
    const e9 = ema(h, 9), e21 = ema(h, 21), e50 = ema(h, 50);
    const r = rsi(h, 14), m = macd(h);
    let bull = 0, bear = 0;
    if (e9 != null && e21 != null) { if (e9 > e21) bull += 20; else bear += 20; }
    if (e21 != null && e50 != null) { if (e21 > e50) bull += 15; else bear += 15; }
    if (r != null) {
      if (r >= 55 && r <= 72) bull += 15;
      else if (r <= 45 && r >= 28) bear += 15;
      else if (r > 72) bear += 8;
      else if (r < 28) bull += 8;
    }
    if (m) { if (m.hist > 0) bull += 15; else bear += 15; }
    const score = Math.max(bull, bear);
    const signal = score >= minScore ? (bull > bear ? "BUY" : bear > bull ? "SELL" : "WAIT") : "WAIT";
    return { signal, score, bull, bear };
  }

  function closePosition(row, exit, reason) {
    const ret = position.signal === "BUY" ? exit / position.price - 1 : position.price / exit - 1;
    equity *= 1 + ret;
    peak = Math.max(peak, equity);
    maxDD = Math.max(maxDD, (peak - equity) / peak);
    trades.push({ entryDate: position.date, exitDate: row.date, signal: position.signal, entry: position.price, exit, returnPct: ret * 100, reason, score: position.score });
    position = null;
  }

  for (let i = 0; i < clean.length; i++) {
    const row = clean[i], s = signalAt(i);
    if (!position && ["BUY", "SELL"].includes(s.signal)) {
      position = { date: row.date, price: Number(row.close), signal: s.signal, score: s.score };
      continue;
    }
    if (!position) continue;

    const target = position.signal === "BUY" ? position.price * (1 + targetPct / 100) : position.price * (1 - targetPct / 100);
    const stop = position.signal === "BUY" ? position.price * (1 - stopPct / 100) : position.price * (1 + stopPct / 100);
    const low = Number(row.low), high = Number(row.high);
    let exit = null, reason = null;

    // Conservative assumption: if both are touched in the same bar, stop wins.
    if (Number.isFinite(low) && Number.isFinite(high)) {
      if (position.signal === "BUY") {
        if (low <= stop) { exit = stop; reason = "STOP"; }
        else if (high >= target) { exit = target; reason = "TARGET"; }
      } else {
        if (high >= stop) { exit = stop; reason = "STOP"; }
        else if (low <= target) { exit = target; reason = "TARGET"; }
      }
    }
    if (exit == null && s.signal === (position.signal === "BUY" ? "SELL" : "BUY")) {
      exit = Number(row.close); reason = "OPPOSITE_SIGNAL";
    }
    if (exit != null && Number.isFinite(exit) && exit > 0) closePosition(row, exit, reason);
  }

  if (position && clean.length) closePosition(clean.at(-1), Number(clean.at(-1).close), "END");

  const wins = trades.filter(t => t.returnPct > 0).length;
  const losses = trades.filter(t => t.returnPct <= 0).length;
  const bh = clean.length ? prices.at(-1) / prices[0] - 1 : 0;
  const avg = trades.length ? trades.reduce((s, t) => s + t.returnPct, 0) / trades.length : 0;
  return {
    from: clean[0]?.date, to: clean.at(-1)?.date, bars: clean.length,
    trades: trades.length, wins, losses, winRate: trades.length ? wins / trades.length * 100 : 0,
    netReturn: (equity - 1) * 100, buyHold: bh * 100, maxDrawdown: maxDD * 100,
    avgTrade: avg, targetPct, stopPct, trades
  };
}
