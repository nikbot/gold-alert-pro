const COINBASE = "https://api.exchange.coinbase.com";
const ASSETS = [
  { symbol: "GOLD18", name: "طلای ۱۸ عیار", kind: "gold", sourceSymbol: "GC=F" },
  { symbol: "BTCUSD", name: "بیت‌کوین", kind: "crypto", product: "BTC-USD" },
  { symbol: "ETHUSD", name: "اتریوم", kind: "crypto", product: "ETH-USD" },
  { symbol: "SOLUSD", name: "سولانا", kind: "crypto", product: "SOL-USD" },
  { symbol: "XRPUSD", name: "ریپل", kind: "crypto", product: "XRP-USD" }
];
const TIMEFRAMES = {
  "15m": { seconds: 900, label: "۱۵ دقیقه", hold: "۱ تا ۴ ساعت", holdMs: 4 * 60 * 60_000, interval: "15m", range: "5d" },
  "1h": { seconds: 3600, label: "۱ ساعت", hold: "۴ تا ۱۲ ساعت", holdMs: 12 * 60 * 60_000, interval: "60m", range: "1mo" },
  "4h": { seconds: 14400, label: "۴ ساعت", hold: "۱ تا ۳ روز", holdMs: 3 * 24 * 60 * 60_000, interval: "60m", range: "1mo" },
  "1d": { seconds: 86400, label: "روزانه", hold: "۳ تا ۱۰ روز", holdMs: 10 * 24 * 60 * 60_000, interval: "1d", range: "1y" }
};
const cache = new Map();

function validBar(c) {
  return [c.open, c.high, c.low, c.close, c.volume].every(Number.isFinite)
    && c.open > 0 && c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close);
}

function aggregate(bars, seconds) {
  const out = [];
  for (const bar of bars) {
    const time = Math.floor(bar.time / (seconds * 1000)) * seconds * 1000;
    let bucket = out.at(-1);
    if (!bucket || bucket.time !== time) {
      bucket = { time, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume };
      out.push(bucket);
    } else {
      bucket.high = Math.max(bucket.high, bar.high);
      bucket.low = Math.min(bucket.low, bar.low);
      bucket.close = bar.close;
      bucket.volume += bar.volume;
    }
  }
  return out;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(7000),
    headers: { Accept: "application/json", "User-Agent": "Gold2Pro/80 market signals" },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`منبع بازار پاسخ ${response.status} داد`);
  return response.json();
}

async function fetchGoldBars(tf) {
  const q = new URLSearchParams({ range: tf.range, interval: tf.interval, events: "history" });
  const data = await fetchJson(`https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?${q}`);
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error("کندل‌های قرارداد آتی طلا پیدا نشد");
  const quote = result.indicators?.quote?.[0] || {};
  let bars = (result.timestamp || []).map((time, i) => ({
    time: Number(time) * 1000,
    open: Number(quote.open?.[i]), high: Number(quote.high?.[i]),
    low: Number(quote.low?.[i]), close: Number(quote.close?.[i]),
    volume: Number(quote.volume?.[i] || 0)
  })).filter(validBar);
  if (tf.seconds === 14400) bars = aggregate(bars, 14400);
  bars = bars.filter(c => c.time + tf.seconds * 1000 <= Date.now()).slice(-220);
  return { bars, source: "Yahoo Finance · قرارداد آتی طلای COMEX (GC=F)", unit: "USD/اونس", actualFlow: false };
}

async function fetchCryptoBars(asset, tf) {
  const granularity = tf.seconds === 14400 ? 3600 : tf.seconds;
  const url = `${COINBASE}/products/${asset.product}/candles?granularity=${granularity}`;
  const rows = await fetchJson(url);
  if (!Array.isArray(rows)) throw new Error("کندل‌های صرافی معتبر نیستند");
  let bars = rows.map(r => ({ time: Number(r[0]) * 1000, low: Number(r[1]), high: Number(r[2]), open: Number(r[3]), close: Number(r[4]), volume: Number(r[5]) }))
    .filter(validBar).sort((a, b) => a.time - b.time);
  if (tf.seconds === 14400) bars = aggregate(bars, 14400);
  bars = bars.filter(c => c.time + tf.seconds * 1000 <= Date.now()).slice(-220);
  return { bars, source: `Coinbase Exchange · ${asset.product}`, unit: "USD", actualFlow: true };
}

async function fetchCryptoFlow(asset) {
  const trades = await fetchJson(`${COINBASE}/products/${asset.product}/trades?limit=1000`);
  if (!Array.isArray(trades)) throw new Error("جریان معاملات صرافی در دسترس نیست");
  const cutoff = Date.now() - 5 * 60_000;
  const recent = trades.filter(t => Date.parse(t.time) >= cutoff && Number(t.size) > 0 && Number(t.price) > 0);
  const buyVolume = recent.filter(t => t.side === "buy").reduce((sum, t) => sum + Number(t.size), 0);
  const sellVolume = recent.filter(t => t.side === "sell").reduce((sum, t) => sum + Number(t.size), 0);
  const newest = recent.reduce((best, t) => !best || Date.parse(t.time) > Date.parse(best.time) ? t : best, null);
  return { buyVolume, sellVolume, trades: recent.length, price: newest ? Number(newest.price) : null, at: newest?.time || null, actual: recent.length >= 10 };
}

function average(values) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }
function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let value = average(values.slice(0, period));
  for (const x of values.slice(period)) value = x * k + value * (1 - k);
  return value;
}
function rsi(values, period = 14) {
  if (values.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  return losses === 0 ? 100 : 100 - 100 / (1 + gains / losses);
}
function directionScores(bars, flow) {
  const closes = bars.map(c => c.close);
  const last = bars.at(-1), prev = bars.at(-2);
  let buy = 0, sell = 0;
  const reasons = [];
  const e9 = ema(closes, 9), e21 = ema(closes, 21), e50 = ema(closes, 50);
  if (e9 != null && e21 != null) {
    if (e9 > e21) { buy += 18; reasons.push("میانگین کوتاه‌مدت بالاتر از میانگین قبلیه"); }
    else { sell += 18; reasons.push("میانگین کوتاه‌مدت پایین‌تر از میانگین قبلیه"); }
  }
  if (e21 != null && e50 != null) {
    if (e21 > e50) { buy += 14; reasons.push("روند چندساعته رو به بالاست"); }
    else { sell += 14; reasons.push("روند چندساعته رو به پایینه"); }
  }
  const strength = rsi(closes);
  if (strength != null && strength >= 51 && strength <= 68) { buy += 12; reasons.push("قدرت خریدارها مناسبه و هنوز خیلی داغ نشده"); }
  else if (strength != null && strength <= 49 && strength >= 32) { sell += 12; reasons.push("قدرت فروشنده‌ها بیشتره ولی بازار هنوز خیلی خالی نشده"); }
  const fast = ema(closes, 12), slow = ema(closes, 26);
  const olderFast = ema(closes.slice(0, -1), 12), olderSlow = ema(closes.slice(0, -1), 26);
  const macdUp = fast != null && slow != null && olderFast != null && olderSlow != null && fast - slow > olderFast - olderSlow;
  if (macdUp) { buy += 12; reasons.push("شتاب حرکت قیمت داره بهتر می‌شه"); }
  else if (fast != null && slow != null) { sell += 12; reasons.push("شتاب حرکت قیمت داره ضعیف می‌شه"); }
  if (last && prev) {
    const range = Math.max(1e-12, last.high - last.low);
    if (last.close > last.open && (last.close - last.low) / range >= 0.7) { buy += 10; reasons.push("کندل آخر نزدیک سقف بسته شده"); }
    else if (last.close < last.open && (last.high - last.close) / range >= 0.7) { sell += 10; reasons.push("کندل آخر نزدیک کف بسته شده"); }
  }
  const priorVolumes = bars.slice(-21, -1).map(c => c.volume).filter(v => v > 0);
  const volumeRatio = priorVolumes.length ? last.volume / average(priorVolumes) : null;
  if (volumeRatio != null && volumeRatio >= 1.15) {
    if (last.close >= last.open) { buy += 8; reasons.push("حجم معامله از میانگین بیشتره و کندل سبزه"); }
    else { sell += 8; reasons.push("حجم معامله از میانگین بیشتره و کندل قرمزه"); }
  }
  let buyVolume = flow?.buyVolume || 0, sellVolume = flow?.sellVolume || 0;
  let flowActual = Boolean(flow?.actual);
  if (!flowActual) {
    for (const c of bars.slice(-20)) {
      if (c.close >= c.open) buyVolume += c.volume;
      else sellVolume += c.volume;
    }
    flowActual = false;
  }
  const totalFlow = buyVolume + sellVolume;
  const buyShare = totalFlow ? buyVolume / totalFlow : null;
  if (buyShare != null && buyShare >= 0.58) { buy += 18; reasons.push(flowActual ? "توی معاملات اخیر، حجم خرید بیشتر بوده" : "کندل‌های صعودی حجم بیشتری داشتن"); }
  else if (buyShare != null && buyShare <= 0.42) { sell += 18; reasons.push(flowActual ? "توی معاملات اخیر، حجم فروش بیشتر بوده" : "کندل‌های نزولی حجم بیشتری داشتن"); }
  const atrPct = average(bars.slice(-14).map(c => c.high - c.low)) / last.close * 100;
  const target = Math.max(1.25, Math.min(4, atrPct * 1.5));
  const stop = Math.max(0.8, Math.min(2.5, atrPct));
  const winner = Math.max(buy, sell), diff = Math.abs(buy - sell);
  const signal = winner >= 65 && diff >= 18 ? (buy > sell ? "BUY" : "SELL") : "WAIT";
  if (signal === "WAIT") reasons.push("نشونه‌ها هنوز به‌اندازه کافی هم‌جهت نیستن؛ عجله نکن");
  return { signal, score: winner, buyScore: buy, sellScore: sell, rsi: strength, ema9: e9, ema21: e21, ema50: e50, volumeRatio, buyVolume, sellVolume, buyShare, flowActual, sampleSize: bars.length, targetPct: target, stopPct: stop, reasons: reasons.slice(-5) };
}

export function analyzeCandles(bars, flow = {}, now = Date.now()) {
  const clean = (Array.isArray(bars) ? bars : []).filter(validBar).sort((a, b) => a.time - b.time);
  if (clean.length < 50) return { signal: "WAIT", score: 0, sampleSize: clean.length, reasons: ["برای تحلیل مطمئن‌تر هنوز کندل کافی نداریم"], stale: false };
  const last = clean.at(-1), tfMs = Number(flow.timeframeMs || 60 * 60_000);
  const stale = now - (last.time + tfMs) > Math.max(tfMs * 3, 90 * 60_000);
  if (stale) return { signal: "WAIT", score: 0, sampleSize: clean.length, stale: true, lastAt: new Date(last.time + tfMs).toISOString(), reasons: ["کندل‌ها قدیمی‌ان؛ سیگنال نمی‌دیم تا دادهٔ تازه برسه"] };
  return { ...directionScores(clean, flow), lastAt: new Date(last.time + tfMs).toISOString(), stale: false };
}

async function oneAsset(asset, tf, goldQuote) {
  try {
    const [feed, flow] = await Promise.all([
      asset.kind === "gold" ? fetchGoldBars(tf) : fetchCryptoBars(asset, tf),
      asset.kind === "crypto" ? fetchCryptoFlow(asset).catch(() => null) : Promise.resolve(null)
    ]);
    const price = asset.kind === "gold" ? Number(goldQuote?.priceIRR) : Number(flow?.price || feed.bars.at(-1)?.close);
    const marketTime = asset.kind === "gold" ? goldQuote?.fetchedAt : flow?.at;
    const fresh = asset.kind === "gold"
      ? goldQuote?.status === "LIVE" && Date.now() - Date.parse(goldQuote.fetchedAt || 0) < 60_000
      : Boolean(flow?.at && Date.now() - Date.parse(flow.at) < 5 * 60_000);
    const analysis = analyzeCandles(feed.bars, { ...flow, timeframeMs: tf.seconds * 1000 });
    if (!fresh) {
      analysis.signal = "WAIT";
      analysis.score = 0;
      analysis.reasons = [asset.kind === "gold" ? "قیمت لحظه‌ای طلای ۱۸ تازه نیست" : "معاملات زندهٔ صرافی تازه نیست", ...analysis.reasons].slice(0, 4);
    }
    const stopPct = analysis.stopPct || 1;
    const targetPct = analysis.targetPct || 1.5;
    const sign = analysis.signal === "SELL" ? -1 : 1;
    const isGold = asset.kind === "gold";
    const displayPrice = Number.isFinite(price) && price > 0 ? (isGold ? Math.round(price / 10) : price) : null;
    return {
      ...asset, price: displayPrice, unit: isGold ? "تومان/گرم" : "دلار", referencePrice: feed.bars.at(-1)?.close || null,
      source: feed.source, quoteSource: isGold ? (goldQuote?.source || "منبع قیمت ایران") : feed.source,
      sourceUnit: feed.unit, timeframe: tf.label, timeframeKey: Object.keys(TIMEFRAMES).find(k => TIMEFRAMES[k] === tf),
      quoteAt: marketTime || null, candles: feed.bars.slice(-100), ...analysis,
      hold: tf.hold, holdMs: tf.holdMs, targetPct, stopPct,
      target: displayPrice ? displayPrice * (1 + sign * targetPct / 100) : null,
      stop: displayPrice ? displayPrice * (1 - sign * stopPct / 100) : null,
      dataNote: isGold ? "حجم کل معاملات قرارداد آتی اونس واقعی است؛ تفکیک خرید/فروش از جهت کندل تخمین زده می‌شود." : "حجم خرید/فروش از سمت معاملات ثبت‌شدهٔ Coinbase در ۵ دقیقهٔ اخیر است.",
      quoteLive: fresh
    };
  } catch (error) {
    return { ...asset, signal: "WAIT", score: 0, candles: [], reasons: [error.message || "دریافت داده ناموفق بود"], source: "unavailable", quoteLive: false, stale: true };
  }
}

export function normalizeTimeframe(value) { return TIMEFRAMES[value] ? value : "1h"; }
export function isStrongTradingSignal(row, threshold = 75) {
  return Boolean(row?.quoteLive && !row?.stale && ["BUY", "SELL"].includes(row.signal) && Number(row.score) >= threshold);
}
export async function getGoldSignalCandles(timeframe = "1h") {
  const key = normalizeTimeframe(timeframe);
  return fetchGoldBars(TIMEFRAMES[key]);
}
export async function getTradingSignals(timeframe = "1h", goldQuote = null) {
  const key = normalizeTimeframe(timeframe);
  const current = cache.get(key);
  if (current && Date.now() - current.at < 20_000) {
    return current.data.map(row => {
      if (row.kind !== "gold" || !goldQuote?.priceIRR) return row;
      const price = Math.round(Number(goldQuote.priceIRR) / 10);
      const quoteLive = goldQuote.status === "LIVE" && Date.now() - Date.parse(goldQuote.fetchedAt || 0) < 60_000;
      const signal = quoteLive ? row.signal : "WAIT";
      const sign = signal === "SELL" ? -1 : 1;
      return { ...row, signal, score: quoteLive ? row.score : 0, price, target: price * (1 + sign * row.targetPct / 100), stop: price * (1 - sign * row.stopPct / 100), quoteAt: goldQuote.fetchedAt, quoteSource: goldQuote.source || "منبع قیمت ایران", quoteLive, reasons: quoteLive ? row.reasons : ["قیمت لحظه‌ای طلای ۱۸ تازه نیست؛ فعلاً سیگنال نمی‌دیم"] };
    });
  }
  const tf = TIMEFRAMES[key];
  const rows = await Promise.all(ASSETS.map(asset => oneAsset(asset, tf, goldQuote)));
  cache.set(key, { at: Date.now(), data: rows });
  return rows;
}

export async function getPaperQuote(symbol, goldQuote = null) {
  const asset = ASSETS.find(a => a.symbol === String(symbol).toUpperCase());
  if (!asset) throw new Error("نماد پشتیبانی نمی‌شود");
  if (asset.kind === "gold") {
    const price = Number(goldQuote?.priceIRR);
    const at = Date.parse(goldQuote?.fetchedAt || 0);
    if (goldQuote?.status !== "LIVE" || !Number.isFinite(price) || !at || Date.now() - at > 60_000) return null;
    return { price: price / 10, at: goldQuote.fetchedAt, unit: "تومان" };
  }
  const data = await fetchJson(`${COINBASE}/products/${asset.product}/ticker`);
  const price = Number(data?.price), at = Date.parse(data?.time || 0);
  if (!Number.isFinite(price) || !price || !at || Date.now() - at > 5 * 60_000) return null;
  return { price, at: data.time, unit: "USD" };
}

export function paperPnl(trade, price) {
  const start = Number(trade.entry), amount = Number(trade.amount);
  const move = trade.direction === "BUY" ? Number(price) / start - 1 : 1 - Number(price) / start;
  return Number.isFinite(move) ? amount * move : 0;
}
