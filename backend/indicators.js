export function sma(values, period) {
  if (values.length < period) return null;
  const a = values.slice(-period);
  return a.reduce((x, y) => x + y, 0) / period;
}

export function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let e = values.slice(0, period).reduce((x, y) => x + y, 0) / period;
  for (let i = period; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}

export function rsi(values, period = 14) {
  if (values.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  if (losses === 0) return 100;
  const rs = (gains / period) / (losses / period);
  return 100 - 100 / (1 + rs);
}

export function macd(values, fast = 12, slow = 26, signal = 9) {
  if (values.length < slow + signal) return null;
  const kf = 2 / (fast + 1), ks = 2 / (slow + 1);
  let ef = values[0], es = values[0];
  const line = [];
  for (const p of values) {
    ef = p * kf + ef * (1 - kf);
    es = p * ks + es * (1 - ks);
    line.push(ef - es);
  }
  const sig = ema(line, signal);
  return sig == null ? null : { line: line.at(-1), signal: sig, hist: line.at(-1) - sig };
}

export function bollinger(values, period = 20, mult = 2) {
  if (values.length < period) return null;
  const m = sma(values, period);
  const a = values.slice(-period);
  const sd = Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / period);
  return { middle: m, upper: m + mult * sd, lower: m - mult * sd };
}

export function analyze(prices) {
  const p = prices.at(-1);
  if (!p) return null;
  const e9 = ema(prices, 9), e21 = ema(prices, 21), e50 = ema(prices, 50);
  const r = rsi(prices, 14), m = macd(prices), b = bollinger(prices);
  let bull = 0, bear = 0;
  const reasons = [];

  if (e9 != null && e21 != null) {
    if (e9 > e21) { bull += 20; reasons.push("EMA9 بالای EMA21"); }
    else { bear += 20; reasons.push("EMA9 زیر EMA21"); }
  }
  if (e21 != null && e50 != null) {
    if (e21 > e50) { bull += 15; reasons.push("روند میان‌مدت صعودی"); }
    else { bear += 15; reasons.push("روند میان‌مدت نزولی"); }
  }
  if (r != null) {
    if (r >= 55 && r <= 72) { bull += 15; reasons.push(`RSI مثبت (${r.toFixed(1)})`); }
    else if (r <= 45 && r >= 28) { bear += 15; reasons.push(`RSI منفی (${r.toFixed(1)})`); }
    else if (r > 72) { bear += 8; reasons.push(`RSI داغ (${r.toFixed(1)})`); }
    else if (r < 28) { bull += 8; reasons.push(`RSI اشباع فروش (${r.toFixed(1)})`); }
  }
  if (m) {
    if (m.hist > 0) { bull += 15; reasons.push("MACD مثبت"); }
    else { bear += 15; reasons.push("MACD منفی"); }
  }
  if (b) {
    if (p > b.middle) bull += 10; else bear += 10;
  }

  const score = Math.max(bull, bear);
  let signal = "WAIT";
  if (score >= 65) signal = bull > bear ? "BUY" : "SELL";
  else if (bull > bear + 12) signal = "WATCH_BUY";
  else if (bear > bull + 12) signal = "WATCH_SELL";

  return {
    signal, score, bull, bear, price: p,
    ema9: e9, ema21: e21, ema50: e50,
    rsi: r, macd: m, bollinger: b,
    reasons,
    sampleSize: prices.length,
    ready: prices.length >= 50
  };
}
