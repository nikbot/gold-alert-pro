const TGJU_GOLD_URL = process.env.TGJU_GOLD_URL || "https://www.tgju.org/profile/geram18/today";
const TGJU_GOLD_FALLBACK_URLS = [
  "https://www.tgju.org/profile/geram18",
  "https://www.tgju.org/profile/geram18/history",
  "https://gem.tgju.org/profile/geram18/history",
  "https://www.tgju.org/",
  "https://tgju.org/"
];
const SERVIX_GOLD_URL = process.env.SERVIX_GOLD_URL || "https://servix.cc/api/v1/assets/GOLD_18_RLS";
const SERVIX_API_KEY = process.env.SERVIX_API_KEY || "";
const TINDEX_GOLD_URL = process.env.TINDEX_GOLD_URL || "https://tindex.app/api/public/indicators/precious-metals/GOLD-18K";
const TINDEX_API_TOKEN = process.env.TINDEX_API_TOKEN || "";
const TGJU_COIN_URL = process.env.TGJU_COIN_URL || "https://www.tgju.org/coin";
const TGJU_DOLLAR_URL = process.env.TGJU_DOLLAR_URL || "https://www.tgju.org/profile/price_dollar_rl/today";
const TGJU_WORLD_URL = process.env.TGJU_WORLD_URL || "https://www.tgju.org/world-market/currency/profile/geram18";
const GOLDPRICE_URL = process.env.GOLDPRICE_URL || "https://api.goldprice.dev/v1/prices?symbol=XAU-USD-SPOT";
const GDELT_URL = process.env.GDELT_URL || "https://api.gdeltproject.org/api/v2/doc/doc";
const configuredTimeout = Number(process.env.HTTP_TIMEOUT || 12000);
const HTTP_TIMEOUT = Number.isFinite(configuredTimeout) ? Math.max(3000, configuredTimeout) : 5000;
let lastValidIran18 = null;
let lastIran18FetchAt = 0;
const CACHE_MAX_AGE = 30000; // 30 seconds

function isValidPrice(price){
  return Number.isFinite(price) && price > 1000000 && price < 10000000000;
}

function saveFreshPrice(result){
  if(!isValidPrice(result.priceIRR)) throw new Error("Invalid price rejected");
  lastValidIran18 = {
    ...result,
    cached:false,
    fetchedAt:new Date().toISOString()
  };
  lastIran18FetchAt = Date.now();
  return lastValidIran18;
}

function normalizeDigits(value) {
  return String(value ?? "")
    .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}
function cleanText(value) {
  return String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}
function parseNumber(value) {
  const s = normalizeDigits(value).replace(/\s/g, "").replace(/,/g, "");
  const n = Number(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}
async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT);
  try {
    const response = await fetch(url, {
      ...options, signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 GoldAlertPro/7.0", "Accept": options.headers?.Accept || "text/html,application/json;q=0.9,*/*;q=0.8", ...options.headers }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally { clearTimeout(timeout); }
}
async function fetchTextWithRetry(url, options = {}, attempts = 1) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fetchText(url, options);
    } catch (error) {
      lastError = error;
      const statusMatch = String(error?.message || "").match(/^HTTP (\d{3})$/);
      const status = statusMatch ? Number(statusMatch[1]) : null;
      const retryable = error?.name === "AbortError" || error?.name === "TypeError" ||
        status === 408 || status === 425 || status === 429 || (status !== null && status >= 500);
      if (!retryable || attempt === attempts) break;
      await new Promise(resolve => setTimeout(resolve, 500 * attempt));
    }
  }
  throw lastError || new Error("Request failed");
}
async function fetchJson(url, headers = {}) {
  const text = await fetchText(url, {headers:{Accept:"application/json", ...headers}});
  try { return JSON.parse(text); } catch { throw new Error("Invalid JSON response"); }
}
function extractFirst(text, patterns) {
  for (const re of patterns) { const m = text.match(re); if (m) { const n = parseNumber(m[1]); if (Number.isFinite(n)) return n; } }
  return NaN;
}
export function parseIran18PriceFromText(text) {
  const normalized = normalizeDigits(text);
  // TGJU currently exposes the live quote as «نرخ فعلی:: 250,877,000».
  // The old parser required the product label to be immediately adjacent to the
  // number, which breaks as soon as TGJU changes its surrounding markup.
  const currentRate = extractFirst(normalized, [
    /نرخ\s*فعلی\s*:{1,2}\s*((?:\d{1,3}(?:,\d{3})+)|(?:\d+))/i,
    /نرخ\s*فعلی[^\d]{0,120}((?:\d{1,3}(?:,\d{3})+)|(?:\d+))/i,
    /طلای\s*18\s*عیار(?:\s*\/\s*750)?[^\d]{0,220}((?:\d{1,3}(?:,\d{3})+)|(?:\d+))/i,
    /طلا\s*18\s*عیار[^\d]{0,220}((?:\d{1,3}(?:,\d{3})+)|(?:\d+))/i,
    /طلا\s*18\s*\|?\s*((?:\d{1,3}(?:,\d{3})+)|(?:\d+))/i
  ]);
  return Number.isFinite(currentRate) ? currentRate : NaN;
}
function priceFromJson(payload) {
  const candidates = [payload?.value, payload?.price, payload?.data?.value, payload?.data?.price,
    payload?.data?.indicator?.price, ...(Array.isArray(payload?.data?.rows) ? payload.data.rows.filter(x => /GOLD-18K|18.?k|18 عیار/i.test(`${x.slug||""} ${x.name||""}`)).map(x => x.price) : [])];
  for (const candidate of candidates) {
    const n = typeof candidate === "string" ? parseNumber(candidate) : Number(candidate);
    if (Number.isFinite(n) && n > 100000) return Math.round(n);
  }
  return null;
}
async function tryIran18Html(url) {
  const html = await fetchTextWithRetry(url);
  const price = parseIran18PriceFromText(cleanText(html));
  if (!Number.isFinite(price) || price < 1000000) throw new Error("18k price not found in response");
  const result = { priceIRR: Math.round(price), source: `TGJU (${new URL(url).host})`, at: new Date().toISOString(), unit: "IRR_PER_GRAM" };
  return result;
}

let sourceComparisonCache = { at: 0, data: null };
export async function getIran18Sources(force = false) {
  if (!force && sourceComparisonCache.data && Date.now() - sourceComparisonCache.at < 30000) return sourceComparisonCache.data;
  const sources = [];
  const jobs = [];
  if (SERVIX_API_KEY) jobs.push((async()=>{
    try {
      const payload = await fetchJson(SERVIX_GOLD_URL, {"X-API-Key": SERVIX_API_KEY});
      const price = priceFromJson(payload);
      if (!price) throw new Error("قیمت معتبر پیدا نشد");
      return {name:"Servix", priceIRR:Math.round(price), at:payload?.businessTime || new Date().toISOString(), ok:true};
    } catch(e) { return {name:"Servix", ok:false, error:e.name === "AbortError" ? "timeout" : e.message}; }
  })());
  jobs.push((async()=>{
    try {
      const r = await tryIran18Html(TGJU_GOLD_URL);
      return {name:"TGJU", priceIRR:r.priceIRR, at:r.at, ok:true};
    } catch(e) { return {name:"TGJU", ok:false, error:e.name === "AbortError" ? "timeout" : e.message}; }
  })());
  if (TINDEX_API_TOKEN) jobs.push((async()=>{
    try {
      const payload=await fetchJson(TINDEX_GOLD_URL,{Authorization:`Bearer ${TINDEX_API_TOKEN}`});
      const value=priceFromJson(payload);
      if(!value) throw new Error("قیمت معتبر پیدا نشد");
      return {name:"Tindex",priceIRR:Math.round(value*10),at:payload?.data?.updated_at||new Date().toISOString(),ok:true};
    }catch(e){return {name:"Tindex",ok:false,error:e.name === "AbortError" ? "timeout" : e.message};}
  })());
  const results=await Promise.all(jobs);
  const valid=results.filter(x=>x.ok&&Number.isFinite(x.priceIRR));
  const primary=valid.find(x=>x.name==="Servix")||valid[0]||null;
  let spreadPct=null, anomaly=false;
  if(primary&&valid.length>1){
    const max=Math.max(...valid.map(x=>x.priceIRR)), min=Math.min(...valid.map(x=>x.priceIRR));
    spreadPct=min?(max/min-1)*100:null; anomaly=spreadPct!=null&&spreadPct>2;
  }
  const data={checkedAt:new Date().toISOString(),primary:primary?.name||null,sources:results,spreadPct,anomaly,thresholdPct:2};
  sourceComparisonCache={at:Date.now(),data}; return data;
}

export async function getIran18() {
  const errors = [];

  // Primary: authenticated structured Servix feed. This avoids HTML scraping
  // and gives us businessTime so the UI can distinguish source time from fetch time.
  if (SERVIX_API_KEY) {
    try {
      const payload = await fetchJson(SERVIX_GOLD_URL, {"X-API-Key": SERVIX_API_KEY});
      const quote = priceFromJson(payload);
      if (!quote) throw new Error("valid GOLD_18_RLS value missing");
      return saveFreshPrice({
        priceIRR: Math.round(quote),
        source: "Servix API",
        at: payload?.businessTime || new Date().toISOString(),
        unit: "IRR_PER_GRAM",
        sourceCode: "GOLD_18_RLS"
      });
    } catch (error) {
      errors.push(`Servix: ${error.name === "AbortError" ? "request timeout" : error.message}`);
    }
  } else {
    errors.push("Servix: API key not configured");
  }

  // Secondary: TGJU HTML fallbacks. Only used when Servix is unavailable.
  const urls = [...new Set([TGJU_GOLD_URL, ...TGJU_GOLD_FALLBACK_URLS])];
  const primaryUrls = urls.slice(0, 4);
  const attempts = await Promise.allSettled(primaryUrls.map(url => tryIran18Html(url)));
  for (let i = 0; i < attempts.length; i++) {
    const result = attempts[i];
    if (result.status === "fulfilled") return saveFreshPrice(result.value);
    const error = result.reason;
    errors.push(`${new URL(primaryUrls[i]).host}: ${error?.name === "AbortError" ? "request timeout" : error?.message || "request failed"}`);
  }
  for (const url of urls.slice(4)) {
    try {
      const fresh = await tryIran18Html(url);
      return saveFreshPrice(fresh);
    } catch (error) {
      errors.push(`${new URL(url).host}: ${error?.name === "AbortError" ? "request timeout" : error?.message || "request failed"}`);
    }
  }

  if (TINDEX_API_TOKEN) {
    try {
      const payload = await fetchJson(TINDEX_GOLD_URL, {Authorization: `Bearer ${TINDEX_API_TOKEN}`});
      const value = priceFromJson(payload);
      if (!value) throw new Error("valid GOLD-18K value missing");
      return saveFreshPrice({
        priceIRR: Math.round(value * 10),
        source: "Tindex API",
        at: payload?.data?.updated_at || new Date().toISOString(),
        unit: "IRR_PER_GRAM"
      });
    } catch (error) {
      errors.push(`Tindex: ${error.name === "AbortError" ? "request timeout" : error.message}`);
    }
  }

  if (lastValidIran18 && (Date.now() - lastIran18FetchAt) < CACHE_MAX_AGE) {
    return { ...lastValidIran18, source: `${lastValidIran18.source} (CACHE)`, cached: true, warning: errors.join("; ") };
  }
  throw new Error(`Iran 18k gold unavailable — ${errors.join("; ")}`);
}

function parseLabelPrice(text, label) {
  const re = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&") + "\\s*\\|?\\s*((?:\\d{1,3}(?:,\\d{3})+)|(?:\\d+))", "i");
  const m = text.match(re);
  return m ? parseNumber(m[1]) : NaN;
}
export function parseCoinsText(body) {
  const text = cleanText(body);

  const names = {
    emami:"سکه امامی", bahar:"سکه بهار آزادی", half:"نیم سکه", quarter:"ربع سکه", gram:"سکه گرمی",
    emamiSingle:"سکه امامی (تک فروشی)"
  };
  const prices = {};
  for (const [k,v] of Object.entries(names)) prices[k] = parseLabelPrice(text, v);
  const bubbleNames = {emami:"حباب سکه امامی", bahar:"حباب سکه بهار آزادی", half:"حباب نیم سکه", quarter:"حباب ربع سکه", gram:"حباب سکه گرمی"};
  const bubbles = {};
  for (const [k,v] of Object.entries(bubbleNames)) bubbles[k] = parseLabelPrice(text, v);
  return { ...prices, bubbles };
}
export async function getCoins() {
  const html = await fetchText(TGJU_COIN_URL);
  return { ...parseCoinsText(html), source:"TGJU", at:new Date().toISOString() };
}
export function parseDollarText(body) {
  const text = cleanText(body);
  const price = extractFirst(text, [
    /نرخ\s*فعلی\s*:{0,2}\s*((?:\d{1,3}(?:,\d{3})+)|(?:\d+))/i,
    /دلار\s*\|\s*((?:\d{1,3}(?:,\d{3})+)|(?:\d+))/i
  ]);
  return price;
}
function parseWorldMarketText(body) {
  const text = cleanText(body);
  const out = {};
  const patterns = {
    dollar: /دلار\s+([\d,]+)/i,
    xau: /انس\s+طلا\s+([\d,.]+)/i
  };
  for (const [k,re] of Object.entries(patterns)) {
    const m=text.match(re); if(m) out[k]=parseNumber(m[1]);
  }
  return out;
}
async function getWorldMarketSnapshot() {
  const html = await fetchText(TGJU_WORLD_URL);
  return parseWorldMarketText(html);
}
export async function getDollar() {
  try {
    const html = await fetchText(TGJU_DOLLAR_URL);
    const body = cleanText(html);
    const price = extractFirst(body, [
      /نرخ\s*فعلی\s*:{0,2}\s*((?:\d{1,3}(?:,\d{3})+)|(?:\d+))/i,
      /دلار\s*\|\s*((?:\d{1,3}(?:,\d{3})+)|(?:\d+))/i
    ]);
    if (Number.isFinite(price) && price > 10000) return {priceIRR:Math.round(price), source:"TGJU", at:new Date().toISOString()};
  } catch {}
  const snap = await getWorldMarketSnapshot();
  if (!Number.isFinite(snap.dollar) || snap.dollar < 10000) throw new Error("TGJU dollar unavailable");
  return {priceIRR:Math.round(snap.dollar), source:"TGJU world-market", at:new Date().toISOString()};
}
export async function getGlobalGold() {
  try {
    const data = await fetchJson(GOLDPRICE_URL);
    const x = data?.symbols?.[0];
    const price = Number(x?.price);
    if (!Number.isFinite(price) || price <= 0) throw new Error("global price unavailable");
    return {xauUsd:price,bid:Number(x?.bid||price),ask:Number(x?.ask||price),stale:Boolean(x?.is_stale),computedAt:x?.computed_at||null,source:"goldprice.dev",at:new Date().toISOString()};
  } catch(e) {
    try {
      const snap = await getWorldMarketSnapshot();
      if (Number.isFinite(snap.xau) && snap.xau > 100) {
        return {xauUsd:snap.xau,bid:snap.xau,ask:snap.xau,stale:false,source:"TGJU world-market",at:new Date().toISOString()};
      }
    } catch {}
    return {xauUsd:null,bid:null,ask:null,stale:true,source:"unavailable",error:e.message,at:new Date().toISOString()};
  }
}
function classifyNews(title) {
  const t = title.toLowerCase();
  const support = /(rate cut|cut rates|خفض|کاهش نرخ بهره|نرخ بهره کاهش|inflation|تورم|war|جنگ|تنش|تحریم|sanction|uncertainty|نااطمینانی|oil|نفت|دلار ضعیف|weak dollar|safe haven|پناهگاه امن)/i.test(t);
  const pressure = /(rate hike|raise rates|افزایش نرخ بهره|نرخ بهره افزایش|strong dollar|دلار قوی|ceasefire|آتش بس|صلح|peace|yields? rise|بازدهی اوراق|بازده اوراق)/i.test(t);
  const impact = support || pressure ? (support && pressure ? "mixed" : "high") : "watch";
  const direction = support && !pressure ? "supportive" : pressure && !support ? "pressure" : "mixed";
  return {impact,direction};
}
async function gdeltNews(query, sourceLabel) {
  try {
    const p = new URLSearchParams({query,mode:"artlist",format:"json",maxrecords:"8",sort:"datedesc"});
    const data = await fetchJson(`${GDELT_URL}?${p}`);
    return (data?.articles||[]).map(a => ({title:String(a.title||""),url:a.url,domain:a.domain||sourceLabel,date:a.seendate,source:sourceLabel,...classifyNews(String(a.title||""))}));
  } catch { return []; }
}
async function telegramNews(channel, label) {
  try {
    const html = await fetchText(`https://t.me/s/${channel}`);
    const out = [];
    const re = /data-post="([^"]+)"[\s\S]*?<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/gi;
    for (const m of html.matchAll(re)) {
      const text = cleanText(m[2]);
      if (!/(طلا|سکه|دلار|gold|xau|fed|نرخ بهره|تورم)/i.test(text)) continue;
      const id = m[1];
      out.push({title:text.slice(0,260),url:`https://t.me/${id}`,domain:`Telegram • ${label}`,date:null,source:`Telegram • ${label}`,...classifyNews(text)});
      if (out.length>=5) break;
    }
    return out;
  } catch { return []; }
}
export async function getNews() {
  const results = await Promise.all([
    gdeltNews("gold OR XAU domain:reuters.com","Reuters"),
    gdeltNews("gold OR XAU domain:kitco.com","Kitco"),
    gdeltNews("(طلا OR سکه OR دلار) (ایران OR بازار) (domain:tgju.org OR domain:isna.ir OR domain:irna.ir OR domain:tasnimnews.com OR domain:mehrnews.com)","Iranian sources"),
    telegramNews("tgjunews","TGJU"),
    telegramNews("tgjugold","TGJU Gold"),
    telegramNews("tgjucoin","TGJU Coin")
  ]);
  return results.flat().filter(x=>x.title).sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,24);
}
function cellTexts(rowHtml) { return [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>cleanText(m[1])); }
export function parseHistoryHtml(html) {
  const out=[];
  for (const rowMatch of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells=cellTexts(rowMatch[1]); if(cells.length<7) continue;
    const open=parseNumber(cells[0]),low=parseNumber(cells[1]),high=parseNumber(cells[2]),close=parseNumber(cells[3]);
    const date=normalizeDigits(cells[6]||cells[7]||"");
    if(!/^\d{4}\/\d{2}\/\d{2}$/.test(date)) continue;
    if(![open,low,high,close].every(Number.isFinite)||close<1000000) continue;
    out.push({date,open,low,high,close});
  }
  const seen=new Set();
  return out.filter(x=>!seen.has(x.date)&&seen.add(x.date)).sort((a,b)=>a.date.localeCompare(b.date));
}
export async function getHistory() {
  // Build an absolute path to avoid malformed URLs such as /profile/.../today/history
  // or a double slash when TGJU_GOLD_URL is the site root.
  try {
    const historyUrl = new URL("/profile/geram18/history", TGJU_GOLD_URL).toString();
    return parseHistoryHtml(await fetchTextWithRetry(historyUrl));
  } catch { return []; }
}
