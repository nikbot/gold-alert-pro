const TGJU_GOLD_URL = process.env.TGJU_GOLD_URL || "https://gem.tgju.org/profile/geram18";
const TGJU_WIDGET_URL = process.env.TGJU_WIDGET_URL || "https://www.tgju.org/widget/get/market-data";
const TGJU_GOLD_FALLBACK_URLS = [
  "https://www.tgju.org/profile/geram18/today",
  "https://www.tgju.org/profile/geram18",
  "https://gem.tgju.org/profile/geram18/today"
];
// Optional structured TGJU-compatible endpoint. If configured, it is preferred over HTML
// because structured data is less sensitive to page markup changes.
const TGJU_JSON_URL = String(process.env.TGJU_JSON_URL || "").trim();
const SERVIX_GOLD_URL = process.env.SERVIX_GOLD_URL || "https://servix.cc/api/v1/assets/GOLD_18_RLS";
const SERVIX_API_KEY = String(process.env.SERVIX_API_KEY || "").trim();
const TINDEX_GOLD_URL = process.env.TINDEX_GOLD_URL || "https://tindex.app/api/public/indicators/precious-metals/GOLD-18K";
const TINDEX_API_TOKEN = String(process.env.TINDEX_API_TOKEN || "").trim();
const TGJU_COIN_URL = process.env.TGJU_COIN_URL || "https://www.tgju.org/coin";
const TGJU_DOLLAR_URL = process.env.TGJU_DOLLAR_URL || "https://www.tgju.org/profile/price_dollar_rl/today";
const TGJU_WORLD_URL = process.env.TGJU_WORLD_URL || "https://www.tgju.org/world-market/currency/profile/geram18";
const GOLDPRICE_URL = process.env.GOLDPRICE_URL || "https://api.goldprice.dev/v1/prices?symbol=XAU-USD-SPOT";

// Forgod live market provider — intentionally kept separate from existing providers.
const FORGOD_BASE_URL = String(process.env.FORGOD_BASE_URL || "http://api.forgod.qzz.io/api").replace(/\/$/, "");
const FORGOD_API_KEY = String(process.env.FORGOD_API_KEY || "").trim();
const FORGOD_TIMEOUT = Math.max(2500, Number(process.env.FORGOD_TIMEOUT || 6000));
const FORGOD_POLL_MS = Math.max(3000, Number(process.env.FORGOD_POLL_MS || 8000));
const GDELT_URL = process.env.GDELT_URL || "https://api.gdeltproject.org/api/v2/doc/doc";
const configuredTimeout = Number(process.env.HTTP_TIMEOUT || 7000);
const HTTP_TIMEOUT = Number.isFinite(configuredTimeout) ? Math.max(2500, configuredTimeout) : 7000;
const SERVIX_POLL_MS = Math.max(60_000, Number(process.env.SERVIX_POLL_MS || 1_800_000)); // 30 min by default: protects daily quota.
const TINDEX_POLL_MS = Math.max(30_000, Number(process.env.TINDEX_POLL_MS || 120_000));
const SOURCE_DIAGNOSTICS_MS = Math.max(10_000, Number(process.env.SOURCE_DIAGNOSTICS_MS || 60_000));
const SERVIX_429_COOLDOWN_MS = Math.max(5 * 60_000, Number(process.env.SERVIX_429_COOLDOWN_MS || 6 * 60 * 60_000));
const TGJU_MIN_REQUEST_MS = Math.max(5000, Number(process.env.TGJU_MIN_REQUEST_MS || 8000));
const TGJU_PARSE_COOLDOWN_MS = Math.max(15000, Number(process.env.TGJU_PARSE_COOLDOWN_MS || 20000));

let lastValidIran18 = null;
let lastIran18FetchAt = 0;
let sourceComparisonCache = { at: 0, data: null };
const providerState = {
  Servix: { lastAttempt: 0, lastSuccess: 0, cooldownUntil: 0, failures: 0, last: null },
  TGJU: { lastAttempt: 0, lastSuccess: 0, cooldownUntil: 0, failures: 0, last: null },
  Tindex: { lastAttempt: 0, lastSuccess: 0, cooldownUntil: 0, failures: 0, last: null, lastError: null },
  ForgodGold: { lastAttempt: 0, lastSuccess: 0, cooldownUntil: 0, failures: 0, last: null, lastError: null },
  ForgodUsd: { lastAttempt: 0, lastSuccess: 0, cooldownUntil: 0, failures: 0, last: null, lastError: null },
  ForgodBtc: { lastAttempt: 0, lastSuccess: 0, cooldownUntil: 0, failures: 0, last: null, lastError: null },
  ForgodAll: { lastAttempt: 0, lastSuccess: 0, cooldownUntil: 0, failures: 0, last: null, lastError: null }
};

function isValidPrice(price){ return Number.isFinite(price) && price > 1000000 && price < 10000000000; }
function saveFreshPrice(result){
  if(!isValidPrice(result.priceIRR)) throw new Error("Invalid price rejected");
  lastValidIran18 = {...result, cached:false, fetchedAt:new Date().toISOString()};
  lastIran18FetchAt = Date.now();
  return lastValidIran18;
}
function normalizeDigits(value) {
  return String(value ?? "").replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}
function cleanText(value) {
  return String(value ?? "").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'")
    .replace(/\s+/g," ").trim();
}
function parseNumber(value) {
  const s=normalizeDigits(value).replace(/[\u200c\u200f\u200e]/g,"").replace(/\s/g,"").replace(/[٬،,]/g,"").replace(/٫/g,".");
  const n=Number(s.replace(/[^\d.-]/g,"")); return Number.isFinite(n)?n:NaN;
}
function plausibleGoldPrice(n){ return Number.isFinite(n) && n >= 10000000 && n <= 10000000000; }
function collectPriceCandidates(raw) {
  const text=normalizeDigits(String(raw||""));
  const out=[];
  const add=(value,score=0,context="")=>{const n=parseNumber(value);if(plausibleGoldPrice(n))out.push({n,score,context:String(context).slice(0,180)});};
  const patterns=[
    /(?:\"(?:p|price|value|current|last)\"\s*:\s*\"?)([\d٬،,]{7,})/gi,
    /(?:data-(?:value|price|current)\s*=\s*[\"'])([\d٬،,]{7,})/gi,
    /(?:قیمت\s*(?:فعلی|زنده)|نرخ\s*فعلی)\s*(?:\"?\s*[:：|]\s*)?([\d٬،,]{7,})/gi,
    /(?:طلای\s*18\s*عیار\s*\/\s*750|طلای\s*۱۸\s*عیار|گرم\s*طلای\s*18)[^\d]{0,400}([\d٬،,]{7,})/gi,
    /(?:geram18|gold_18|18k)[^\d]{0,500}([\d٬،,]{7,})/gi
  ];
  for(const re of patterns){let m;while((m=re.exec(text))){add(m[1],re.source.includes('geram18')?5:3,m[0]);}}
  // When markup has no useful labels, inspect numbers near the stable geram18 instrument key.
  for(const key of ['geram18','طلای 18 عیار / 750','طلای ۱۸ عیار']){
    let pos=0;
    while((pos=text.indexOf(key,pos))>=0){
      const window=text.slice(Math.max(0,pos-300),Math.min(text.length,pos+1200));
      const nums=window.match(/[\d]{2,3}(?:[٬،,][\d]{3}){1,3}/g)||[];
      for(const v of nums) add(v, key==='geram18'?4:2, window);
      pos+=key.length;
    }
  }
  return out;
}
function normalizeMarketValue(value, kind="") {
  const n=parseNumber(value);
  if(!Number.isFinite(n) || n<=0) return NaN;
  if(kind==="gold18" && n>=5000000 && n<50000000) return Math.round(n*10);
  if(kind==="usd" && n>=10000 && n<1000000) return Math.round(n*10);
  return n;
}
function walkMarketValues(node, path=[], out=[]) {
  if(node==null) return out;
  if(Array.isArray(node)){for(let i=0;i<node.length;i++)walkMarketValues(node[i],path.concat(String(i)),out);return out;}
  if(typeof node!=='object') return out;
  for(const [key,value] of Object.entries(node)){
    const p=path.concat(key);
    if(typeof value==='object' && value!==null) walkMarketValues(value,p,out);
    else {
      const n=parseNumber(value);
      if(Number.isFinite(n)) out.push({key:String(key).toLowerCase(),value:n,path:p.join('.'),raw:value});
    }
  }
  return out;
}
function pickMarketValue(payload, kind) {
  const candidates=walkMarketValues(payload);
  const preferred=kind==='gold18'
    ? ['18ayar','18k','gold18','gold_18','geram18','price','value','current','last','rate']
    : kind==='usd'
      ? ['usd','dollar','price','value','current','last','rate','sell','buy']
      : ['btc','bitcoin','usd_btc','price','value','current','last','rate'];
  const scored=[];
  for(const c of candidates){
    let score=0;
    const key=c.key.replace(/[^a-z0-9_]/g,'');
    const path=c.path.toLowerCase();
    if(preferred.includes(key)) score+=20;
    for(const k of preferred){if(path.includes(k))score+=8;}
    if(kind==='gold18' && /18|gold|geram|ayar/.test(path)) score+=12;
    if(kind==='usd' && /usd|dollar/.test(path)) score+=12;
    if(kind==='btc' && /btc|bitcoin/.test(path)) score+=15;
    if(kind==='gold18' && c.value>=1000000) score+=5;
    if(kind==='usd' && c.value>=1000) score+=5;
    if(kind==='btc' && c.value>100) score+=5;
    if(score) scored.push({...c,score});
  }
  scored.sort((a,b)=>b.score-a.score);
  return scored.length?normalizeMarketValue(scored[0].value,kind):NaN;
}
async function fetchForgod(path) {
  if(!FORGOD_API_KEY) throw Object.assign(new Error("FORGOD_API_KEY not configured"),{status:401});
  const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),FORGOD_TIMEOUT);
  try {
    const url=`${FORGOD_BASE_URL}/${path}?api_key=${encodeURIComponent(FORGOD_API_KEY)}`;
    const response=await fetch(url,{signal:controller.signal,redirect:"follow",headers:{Accept:"application/json","User-Agent":"Gold2Pro/70"}});
    if(!response.ok){const e=new Error(`HTTP ${response.status}`);e.status=response.status;throw e;}
    const text=await response.text();
    let payload; try{payload=JSON.parse(text)}catch{throw new Error("Forgod پاسخ JSON معتبر نیست")}
    return payload;
  } finally { clearTimeout(timeout); }
}
async function fetchForgodQuote(kind, path) {
  const payload=await fetchForgod(path);
  const value=pickMarketValue(payload,kind);
  if(!Number.isFinite(value)) throw new Error(`Forgod ${kind} price not found`);
  const result={
    price: value,
    priceIRR: kind==='usd'||kind==='gold18' ? Math.round(value) : undefined,
    source:`Forgod API /api/${path}`,
    sourceCode:`FORGOD_${kind.toUpperCase()}`,
    at:new Date().toISOString(), fetchedAt:new Date().toISOString(), raw:payload
  };
  return result;
}
async function fetchForgodAll() { return fetchForgod('all'); }
async function fetchForgodAllQuote(kind){ const payload=await fetchForgodAll(); const value=pickMarketValue(payload,kind); if(!Number.isFinite(value)) throw new Error(`Forgod /api/all: ${kind} price not found`); return {price:value,source:`Forgod API /api/all`,sourceCode:`FORGOD_ALL_${kind.toUpperCase()}`,at:new Date().toISOString(),fetchedAt:new Date().toISOString()}; }
async function fetchText(url, options = {}) {
  const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),HTTP_TIMEOUT);
  try {
    const response=await fetch(url,{...options,signal:controller.signal,redirect:"follow",headers:{"User-Agent":"Mozilla/5.0 GoldAlertPro/59.1","Accept":options.headers?.Accept||"text/html,application/json;q=0.9,*/*;q=0.8",...options.headers}});
    if(!response.ok){ const err=new Error(`HTTP ${response.status}`); err.status=response.status; err.requestId=response.headers.get("x-request-id")||""; throw err; }
    return await response.text();
  } finally { clearTimeout(timeout); }
}
async function fetchJson(url, headers = {}) {
  const text=await fetchText(url,{headers:{Accept:"application/json",...headers}});
  try{return JSON.parse(text)}catch{throw new Error("Invalid JSON response")}
}
function providerError(error){
  const status=Number(error?.status || String(error?.message||"").match(/^HTTP (\d{3})$/)?.[1] || 0);
  const code=error?.payload?.code;
  return {status,code,message:error?.name==="AbortError"?"timeout":String(error?.message||"request failed"),requestId:error?.requestId||""};
}
function markProvider(name, result, error=null){
  const s=providerState[name]; if(!s)return;
  if(result){s.last=result;s.lastSuccess=Date.now();s.failures=0;s.cooldownUntil=0;s.lastError=null;}
  else {s.failures++;const e=providerError(error);s.lastError=e;if(e.status===429 && name==="Servix")s.cooldownUntil=Date.now()+SERVIX_429_COOLDOWN_MS; if(e.status===401||e.status===403)s.cooldownUntil=Date.now()+6*60*60_000;}
}
function providerCanTry(name, interval){
  const s=providerState[name]; if(!s)return true;
  const now=Date.now(); return now>=s.cooldownUntil && now-s.lastAttempt>=interval;
}
function providerStatus(name){
  const s=providerState[name]; const now=Date.now();
  if(!s.lastAttempt)return {state:"idle",cooldownMs:0,failures:0};
  if(now<s.cooldownUntil)return {state:"cooldown",cooldownMs:s.cooldownUntil-now,failures:s.failures};
  if(s.lastSuccess)return {state:"ready",cooldownMs:0,failures:s.failures,lastSuccess:new Date(s.lastSuccess).toISOString()};
  return {state:"error",cooldownMs:0,failures:s.failures};
}
function extractFirst(text, patterns){for(const re of patterns){const m=text.match(re);if(m){const n=parseNumber(m[1]);if(Number.isFinite(n))return n;}}return NaN;}

export function parseIran18PriceFromText(text){
  const normalized=normalizeDigits(String(text||""));
  const direct=extractFirst(normalized,[
    /نرخ\s*فعلی\s*[:：|]{1,3}\s*((?:\d{1,3}(?:[,٬،]\d{3})+)|(?:\d{7,}))/i,
    /نرخ\s*فعلی[^\d]{0,220}((?:\d{1,3}(?:[,٬،]\d{3})+)|(?:\d{7,}))/i,
    /(?:طلای\s*18\s*عیار\s*\/\s*750|طلای\s*۱۸\s*عیار|Gram\s*Gold\s*18)[^\d]{0,300}((?:\d{1,3}(?:[,٬،]\d{3})+)|(?:\d{7,}))/i
  ]);
  if(plausibleGoldPrice(direct)) return Math.round(direct);
  const candidates=collectPriceCandidates(text);
  candidates.sort((a,b)=>b.score-a.score);
  return candidates.length ? Math.round(candidates[0].n) : NaN;
}
function parseTGJULatestAt(text){
  const n=normalizeDigits(String(text||""));
  const m=n.match(/(?:زمان\s*ثبت\s*آخرین\s*نرخ|در\s*یک\s*نگاه\s*[^\d]{0,80})[^\d]{0,100}(\d{1,2}:\d{2}:\d{2})/i);
  if(m)return m[1];
  const row=n.match(/(?:^|\s)((?:\d{1,3}(?:,\d{3})+)|(?:\d{7,9}))\s+(\d{1,2}:\d{2}:\d{2})\s+/);
  if(row)return row[2];
  return null;
}
function combineTodayTime(time){
  if(!time)return new Date().toISOString();
  const now=new Date();
  const iranDate=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tehran",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
  const [h,m,s]=time.split(":").map(Number);
  return `${iranDate}T${String(h||0).padStart(2,"0")}:${String(m||0).padStart(2,"0")}:${String(s||0).padStart(2,"0")}.000+03:30`;
}
async function tryIran18Html(url){
  const html=await fetchText(url);
  const cleaned=cleanText(html);
  const price=parseIran18PriceFromText(html) || parseIran18PriceFromText(cleaned);
  if(!plausibleGoldPrice(price))throw new Error("18k price not found in response");
  const time=parseTGJULatestAt(html) || parseTGJULatestAt(cleaned);
  const fetchedAt=new Date().toISOString();
  return {priceIRR:Math.round(price),source:`TGJU (${new URL(url).host})`,at:combineTodayTime(time),fetchedAt,unit:"IRR_PER_GRAM",sourceCode:"TGJU_GERAM18",parser:"adaptive-html"};
}
async function tryTGJUJson(url){
  const payload=await fetchJson(url);
  const data=payload?.data?.geram18 || payload?.data?.gold?.geram18 || payload?.geram18 || payload?.item || payload;
  const raw=data?.value ?? data?.price?.value ?? data?.price ?? data?.p ?? data?.current ?? data?.data?.value;
  const price=parseNumber(raw);
  if(!plausibleGoldPrice(price)) throw new Error("18k price not found in structured response");
  const time=data?.time || data?.updatedAt || data?.updated_at || payload?.updatedAt || payload?.updated_at || payload?.timestamp || null;
  const at=time ? (String(time).includes('T') ? new Date(time).toISOString() : combineTodayTime(String(time))) : new Date().toISOString();
  return {priceIRR:Math.round(price),source:"TGJU structured API",at,fetchedAt:new Date().toISOString(),unit:"IRR_PER_GRAM",sourceCode:"TGJU_GERAM18",parser:"structured"};
}
function deepFindNumber(value, predicate = () => true, depth = 0) {
  if (depth > 8 || value == null) return null;
  if (typeof value === "number" && Number.isFinite(value) && predicate(value, null)) return value;
  if (typeof value === "string") {
    const n = parseNumber(value);
    return Number.isFinite(n) && predicate(n, value) ? n : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) { const n = deepFindNumber(item, predicate, depth + 1); if (n != null) return n; }
    return null;
  }
  if (typeof value === "object") {
    const preferred = ["value","price","current","last","rate","amount","close","sell","sellPrice","currentPrice","priceIRR","price_toman","price_toman_per_gram","toman","rial","valueIRR","valueToman"];
    for (const key of preferred) if (key in value) { const n = deepFindNumber(value[key], predicate, depth + 1); if (n != null) return n; }
    for (const [key,item] of Object.entries(value)) {
      if (/price|value|rate|current|last|amount|close|rial|toman/i.test(key)) {
        const n = deepFindNumber(item, predicate, depth + 1); if (n != null) return n;
      }
    }
  }
  return null;
}
function payloadUnit(payload) {
  const parts = [];
  const walk = (v, depth=0) => {
    if (depth > 6 || v == null) return;
    if (typeof v === "string") { parts.push(v); return; }
    if (Array.isArray(v)) { v.slice(0,20).forEach(x=>walk(x,depth+1)); return; }
    if (typeof v === "object") {
      for (const [k,x] of Object.entries(v)) if (/unit|currency|denomination|quoteUnit|priceUnit/i.test(k)) walk(x,depth+1);
    }
  };
  walk(payload);
  return parts.join(" ").toLowerCase();
}
function normalizeProviderPrice(value, payload, providerName) {
  const n=Number(value);
  if (!Number.isFinite(n) || n <= 100000) return null;
  const unit=payloadUnit(payload);
  if (/toman|تومان/.test(unit) && n < 1000000000) return Math.round(n*10);
  if (/usd|dollar|ریال|rial|irr/.test(unit)) return Math.round(n);
  // Existing Tindex endpoint is documented in Toman/gram; preserve the existing
  // contract while avoiding a second conversion when the payload explicitly says IRR.
  if (providerName === "Tindex" && n < 1000000000) return Math.round(n*10);
  return Math.round(n);
}
function priceFromJson(payload, providerName="API") {
  const text=JSON.stringify(payload||{});
  const candidates=[];
  const push=(v,score=0)=>{const n=Number(v);if(Number.isFinite(n)&&n>1000000&&n<10000000000)candidates.push({n,score});};
  const rows=Array.isArray(payload)?payload:(Array.isArray(payload?.data)?payload.data:[]);
  const relevant=/GOLD_18_RLS|GOLD-18K|geram18|gold.?18|18.?k|طلای?\s*۱۸|طلای?\s*18/i.test(text);
  if (relevant) {
    const direct=deepFindNumber(payload,(n)=>n>1000000&&n<10000000000);
    if(direct!=null) push(normalizeProviderPrice(direct,payload,providerName),10);
  }
  for(const x of rows){
    const meta=`${x?.code||""} ${x?.symbol||""} ${x?.slug||""} ${x?.name||""} ${x?.title||""}`;
    if(/GOLD_18_RLS|GOLD-18K|geram18|gold.?18|18.?k|طلای?\s*۱۸|طلای?\s*18/i.test(meta)) {
      for(const k of ["value","price","current","last","rate","amount","close","sell","sellPrice","currentPrice"]) if(x?.[k]!=null) push(normalizeProviderPrice(x[k],x,providerName),8);
      const n=deepFindNumber(x,(n)=>n>1000000&&n<10000000000); if(n!=null) push(normalizeProviderPrice(n,x,providerName),7);
    }
  }
  for(const key of ["value","price","current","last","rate","amount","close","sell","sellPrice","currentPrice"]) if(payload?.[key]!=null) push(normalizeProviderPrice(payload[key],payload,providerName),4);
  if(!candidates.length){
    const matches=text.match(/(?:GOLD_18_RLS|GOLD-18K|geram18|gold.?18|18.?k)[\s\S]{0,300}?((?:\d{1,3}(?:[,٬،]\d{3}){2,3})|(?:\d{8,10}))/ig)||[];
    for(const m of matches){const nums=m.match(/(?:\d{1,3}(?:[,٬،]\d{3}){2,3})|(?:\d{8,10})/g)||[];for(const x of nums)push(normalizeProviderPrice(parseNumber(x),payload,providerName),2);}
  }
  candidates.sort((a,b)=>b.score-a.score); return candidates[0]?.n || null;
}
async function fetchServix(){
  if(!SERVIX_API_KEY)throw Object.assign(new Error("API key not configured"),{status:401});
  const payload=await fetchJson(SERVIX_GOLD_URL,{"X-API-Key":SERVIX_API_KEY,"Authorization":`Bearer ${SERVIX_API_KEY}`});
  const quote=priceFromJson(payload,"Servix"); if(!quote)throw new Error("valid GOLD_18_RLS value missing");
  const result={priceIRR:quote,source:"Servix API",at:payload?.businessTime||payload?.data?.businessTime||payload?.updatedAt||new Date().toISOString(),unit:"IRR_PER_GRAM",fresh:payload?.fresh??payload?.data?.fresh??null,stale:Boolean(payload?.stale||payload?.data?.stale)};
  markProvider("Servix",result); return result;
}
async function fetchTindex(){
  if(!TINDEX_API_TOKEN)throw Object.assign(new Error("API token not configured"),{status:401});
  const payload=await fetchJson(TINDEX_GOLD_URL,{Authorization:`Bearer ${TINDEX_API_TOKEN}`,"X-API-Key":TINDEX_API_TOKEN});
  const value=priceFromJson(payload,"Tindex"); if(!value)throw new Error("valid GOLD-18K value missing");
  const result={priceIRR:Math.round(value),source:"Tindex API",at:payload?.data?.updated_at||payload?.updatedAt||new Date().toISOString(),unit:"IRR_PER_GRAM"};
  markProvider("Tindex",result); return result;
}

export async function getIran18(){
  const errors=[];
  // Priority 1: Forgod 18k endpoint. Other providers are only consulted after failure.
  if(FORGOD_API_KEY && providerCanTry("ForgodGold",FORGOD_POLL_MS)){
    providerState.ForgodGold.lastAttempt=Date.now();
    try{
      const q=await fetchForgodQuote("gold18","18ayar");
      const r={priceIRR:Math.round(q.priceIRR),source:q.source,sourceCode:q.sourceCode,at:q.at,fetchedAt:q.fetchedAt,unit:"IRR_PER_GRAM",provider:"Forgod"};
      markProvider("ForgodGold",r); return saveFreshPrice(r);
    }catch(e){markProvider("ForgodGold",null,e);errors.push(`Forgod 18ayar: ${providerError(e).message}`);}
  } else if(providerState.ForgodGold.last?.priceIRR) {
    return {...providerState.ForgodGold.last,cached:true,warning:"داده Forgod از کش خوانده شد"};
  }

  // Forgod aggregate endpoint is the second Forgod path, still before all other providers.
  if(FORGOD_API_KEY && providerCanTry("ForgodAll",FORGOD_POLL_MS)) {
    providerState.ForgodAll.lastAttempt=Date.now();
    try { const q=await fetchForgodAllQuote("gold18"); const r={priceIRR:Math.round(q.price),source:q.source,sourceCode:q.sourceCode,at:q.at,fetchedAt:q.fetchedAt,unit:"IRR_PER_GRAM",provider:"Forgod"}; markProvider("ForgodAll",r); return saveFreshPrice(r); }
    catch(e){ markProvider("ForgodAll",null,e); errors.push(`Forgod all 18ayar: ${providerError(e).message}`); }
  }

  // Priority 2+: existing sources, sequentially so the preferred source is truly first.
  if(TGJU_JSON_URL && providerCanTry("TGJU",TGJU_MIN_REQUEST_MS)){
    providerState.TGJU.lastAttempt=Date.now();
    try{const r=await tryTGJUJson(TGJU_JSON_URL);markProvider("TGJU",r);return saveFreshPrice(r);}catch(e){markProvider("TGJU",null,e);errors.push(`TGJU API: ${providerError(e).message}`);}
  }
  if(SERVIX_API_KEY && providerCanTry("Servix",SERVIX_POLL_MS)){
    providerState.Servix.lastAttempt=Date.now();
    try{return saveFreshPrice(await fetchServix());}catch(e){markProvider("Servix",null,e);errors.push(`Servix: ${providerError(e).message}`);}
  }
  if(TINDEX_API_TOKEN && providerCanTry("Tindex",TINDEX_POLL_MS)){
    providerState.Tindex.lastAttempt=Date.now();
    try{return saveFreshPrice(await fetchTindex());}catch(e){markProvider("Tindex",null,e);errors.push(`Tindex: ${providerError(e).message}`);}
  }
  if(providerState.TGJU.last?.priceIRR)return {...providerState.TGJU.last,cached:true,warning:"منبع اصلی در دسترس نیست؛ آخرین داده TGJU"};
  if(providerState.Servix.last?.priceIRR)return {...providerState.Servix.last,cached:true,warning:"منبع اصلی در دسترس نیست؛ آخرین داده Servix"};
  if(providerState.Tindex.last?.priceIRR)return {...providerState.Tindex.last,cached:true,warning:"منبع اصلی در دسترس نیست؛ آخرین داده Tindex"};
  if(providerCanTry("TGJU",TGJU_MIN_REQUEST_MS)){
    try{providerState.TGJU.lastAttempt=Date.now();const html=await fetchText(TGJU_WIDGET_URL);const widget=parseTGJUWidgetMarketData(html);if(Number.isFinite(widget.gold18)&&plausibleGoldPrice(widget.gold18)){const r={priceIRR:Math.round(widget.gold18),source:"TGJU widget API",at:new Date().toISOString(),fetchedAt:new Date().toISOString(),unit:"IRR_PER_GRAM",parser:"market-widget"};markProvider("TGJU",r);return saveFreshPrice(r);}}catch(e){errors.push(`TGJU widget: ${providerError(e).message}`)}
  }
  if(lastValidIran18 && Date.now()-lastIran18FetchAt<10*60*1000)return {...lastValidIran18,cached:true,warning:errors.join("; ")||"منبع موقتاً در دسترس نیست"};
  throw new Error(`Iran 18k gold unavailable — ${errors.join("; ")||"هیچ API قیمت فعالی تنظیم نشده است"}`);
}

export async function getBitcoin(){
  const errors=[];
  if(FORGOD_API_KEY && providerCanTry("ForgodBtc",FORGOD_POLL_MS)){
    providerState.ForgodBtc.lastAttempt=Date.now();
    try{const q=await fetchForgodQuote("btc","usd_btc");const r={usd:Number(q.price),source:q.source,sourceCode:q.sourceCode,at:q.at,fetchedAt:q.fetchedAt,provider:"Forgod"};markProvider("ForgodBtc",r);return r;}catch(e){markProvider("ForgodBtc",null,e);errors.push(`Forgod BTC: ${providerError(e).message}`)}
  }
  if(FORGOD_API_KEY && providerCanTry("ForgodAll",FORGOD_POLL_MS)) {
    providerState.ForgodAll.lastAttempt=Date.now();
    try { const q=await fetchForgodAllQuote("btc"); const r={usd:Number(q.price),source:q.source,sourceCode:q.sourceCode,at:q.at,fetchedAt:q.fetchedAt,provider:"Forgod"}; markProvider("ForgodAll",r); return r; }
    catch(e){ markProvider("ForgodAll",null,e); errors.push(`Forgod all BTC: ${providerError(e).message}`); }
  }
  if(providerState.ForgodBtc.last?.usd && providerState.ForgodBtc.last.sourceCode==='FORGOD_BTC')return {...providerState.ForgodBtc.last,cached:true,warning:"داده Bitcoin از کش خوانده شد"};
  return {usd:null,source:"unavailable",at:new Date().toISOString(),error:errors.join("; ")||"Bitcoin provider unavailable"};
}

export async function getForgodCurrencies(){
  if(!FORGOD_API_KEY)return {ok:false,source:"Forgod",error:"FORGOD_API_KEY not configured",items:[]};
  if(!providerCanTry("ForgodAll",FORGOD_POLL_MS) && providerState.ForgodAll.last) return {...providerState.ForgodAll.last,cached:true};
  providerState.ForgodAll.lastAttempt=Date.now();
  try{
    const payload=await fetchForgodAll();
    const r={ok:true,source:"Forgod API /api/all",at:new Date().toISOString(),items:payload};
    markProvider("ForgodAll",r); return r;
  }catch(e){markProvider("ForgodAll",null,e);return {ok:false,source:"Forgod API /api/all",at:new Date().toISOString(),error:e.message,items:[]};}
}

export async function getIran18Sources(force=false){
  if(!force&&sourceComparisonCache.data&&Date.now()-sourceComparisonCache.at<SOURCE_DIAGNOSTICS_MS)return sourceComparisonCache.data;
  const results=[];
  const add=(name,result,error)=>{
    const s=providerState[name]||{};
    const cooldownMs=Math.max(0,(s.cooldownUntil||0)-Date.now());
    if(cooldownMs>0){
      const pe=s.lastError||providerError(error||new Error("cooldown"));
      results.push({name,priceIRR:result?.priceIRR??s.last?.priceIRR??null,at:result?.at||s.last?.at||null,ok:false,cached:true,error:pe.status===429?"HTTP 429 • در Backoff؛ سهمیه محافظت شده است":pe.message,cooldownMs,status:pe.status||undefined});
      return;
    }
    if(result)results.push({name,priceIRR:result.priceIRR,at:result.at,ok:true,cached:Boolean(result.cached),stale:Boolean(result.stale)});
    else {const pe=s.lastError||providerError(error||new Error("unavailable"));results.push({name,priceIRR:s.last?.priceIRR??null,at:s.last?.at||null,ok:false,error:pe.message,cooldownMs:0,status:pe.status||undefined});}
  };
  // Diagnostics never forces a quota-burning request when a provider is in cooldown.
  let servix=null,tgju=null,tindex=null;
  try{if(providerState.Servix.last?.priceIRR)servix=providerState.Servix.last; else if(providerCanTry("Servix",SERVIX_POLL_MS)){providerState.Servix.lastAttempt=Date.now();servix=await fetchServix();}}catch(e){markProvider("Servix",null,e);add("Servix",null,e)}
  try{if(providerState.TGJU.last?.priceIRR)tgju=providerState.TGJU.last; else if(providerCanTry("TGJU",TGJU_MIN_REQUEST_MS)){providerState.TGJU.lastAttempt=Date.now();tgju=await tryIran18Html(TGJU_GOLD_URL);markProvider("TGJU",tgju);}}catch(e){markProvider("TGJU",null,e);add("TGJU",null,e)}
  if(TINDEX_API_TOKEN){try{if(providerState.Tindex.last?.priceIRR)tindex=providerState.Tindex.last;else if(providerCanTry("Tindex",TINDEX_POLL_MS)){providerState.Tindex.lastAttempt=Date.now();tindex=await fetchTindex();}}catch(e){markProvider("Tindex",null,e);add("Tindex",null,e)}}
  add("Servix",servix); add("TGJU",tgju); if(TINDEX_API_TOKEN)add("Tindex",tindex);
  const valid=results.filter(x=>x.ok&&Number.isFinite(x.priceIRR));
  const max=valid.length?Math.max(...valid.map(x=>x.priceIRR)):null,min=valid.length?Math.min(...valid.map(x=>x.priceIRR)):null;
  const spreadPct=min?(max/min-1)*100:null;
  const primary=valid.find(x=>x.name==="TGJU")||valid.find(x=>x.name==="Servix")||valid[0]||null;
  const forgod=providerState.ForgodGold.last?.priceIRR ? {name:"Forgod",priceIRR:providerState.ForgodGold.last.priceIRR,at:providerState.ForgodGold.last.at,ok:true,cached:Boolean(providerState.ForgodGold.last.cached)} : {name:"Forgod",priceIRR:null,at:null,ok:false,error:providerState.ForgodGold.lastError?.message||(!FORGOD_API_KEY?"API key not configured": "not checked")};
  results.unshift(forgod);
  const valid2=results.filter(x=>x.ok&&Number.isFinite(x.priceIRR));
  const max2=valid2.length?Math.max(...valid2.map(x=>x.priceIRR)):null,min2=valid2.length?Math.min(...valid2.map(x=>x.priceIRR)):null;
  const spreadPct2=min2?(max2/min2-1)*100:null;
  const data={checkedAt:new Date().toISOString(),primary:valid2.find(x=>x.name==="Forgod")?.name||valid2[0]?.name||null,sources:results,spreadPct:spreadPct2,anomaly:spreadPct2!=null&&spreadPct2>2,thresholdPct:2,providerHealth:{ForgodGold:providerStatus("ForgodGold"),ForgodUsd:providerStatus("ForgodUsd"),ForgodBtc:providerStatus("ForgodBtc"),ForgodAll:providerStatus("ForgodAll"),Servix:providerStatus("Servix"),TGJU:providerStatus("TGJU"),Tindex:providerStatus("Tindex")},servixPollMs:SERVIX_POLL_MS,forgodPollMs:FORGOD_POLL_MS};
  sourceComparisonCache={at:Date.now(),data}; return data;
}

function parseLabelPrice(text, label) {
  const re = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&") + "\\s*\\|?\\s*((?:\\d{1,3}(?:,\\d{3})+)|(?:\\d+))", "i");
  const m = text.match(re);
  return m ? parseNumber(m[1]) : NaN;
}
export function parseTGJUWidgetMarketData(body) {
  const text=cleanText(body);
  const aliases={
    gold18:["طلا ۱۸","طلای 18","طلای ۱۸"],
    dollar:["دلار"],
    xau:["انس طلا"],
    mesghal:["مثقال طلا"],
    emami:["سکه"]
  };
  const out={};
  for(const [key,labels] of Object.entries(aliases)){
    for(const label of labels){
      const re=new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\s+((?:\\d{1,3}(?:[,٬،]\\d{3}){1,3})|(?:\\d{7,10}))","i");
      const m=text.match(re);
      if(m){const n=parseNumber(m[1]);if(Number.isFinite(n)){out[key]=n;break;}}
    }
  }
  return out;
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
  try {
    const html = await fetchText(TGJU_COIN_URL);
    const parsed=parseCoinsText(html);
    if(Object.values(parsed).some(v=>Number.isFinite(v)) || Object.values(parsed.bubbles||{}).some(v=>Number.isFinite(v))) return { ...parsed, source:"TGJU", at:new Date().toISOString() };
  } catch {}
  const widget=parseTGJUWidgetMarketData(await fetchText(TGJU_WIDGET_URL));
  return { emami:Number.isFinite(widget.emami)?widget.emami:NaN, gram:NaN, half:NaN, quarter:NaN, bahar:NaN, bubbles:{}, source:"TGJU widget API", at:new Date().toISOString() };
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
  const errors=[];
  if(FORGOD_API_KEY && providerCanTry("ForgodUsd",FORGOD_POLL_MS)){
    providerState.ForgodUsd.lastAttempt=Date.now();
    try{
      const q=await fetchForgodQuote("usd","usd");
      const r={priceIRR:Math.round(q.price),source:q.source,sourceCode:q.sourceCode,at:q.at,fetchedAt:q.fetchedAt,unit:"IRR_PER_USD",provider:"Forgod"};
      markProvider("ForgodUsd",r); return r;
    }catch(e){markProvider("ForgodUsd",null,e);errors.push(`Forgod USD: ${providerError(e).message}`)}
  } else if(providerState.ForgodUsd.last?.priceIRR && providerState.ForgodUsd.last.sourceCode==='FORGOD_USD') {
    return {...providerState.ForgodUsd.last,cached:true,warning:"داده دلار Forgod از کش خوانده شد"};
  }
  if(FORGOD_API_KEY && providerCanTry("ForgodAll",FORGOD_POLL_MS)) {
    providerState.ForgodAll.lastAttempt=Date.now();
    try { const q=await fetchForgodAllQuote("usd"); const r={priceIRR:Math.round(q.price),source:q.source,sourceCode:q.sourceCode,at:q.at,fetchedAt:q.fetchedAt,unit:"IRR_PER_USD",provider:"Forgod"}; markProvider("ForgodAll",r); return r; }
    catch(e){ markProvider("ForgodAll",null,e); errors.push(`Forgod all USD: ${providerError(e).message}`); }
  }
  try {
    const html = await fetchText(TGJU_DOLLAR_URL);
    const body = cleanText(html);
    const price = extractFirst(body, [
      /نرخ\s*فعلی\s*:{0,2}\s*((?:\d{1,3}(?:,\d{3})+)|(?:\d+))/i,
      /دلار\s*\|\s*((?:\d{1,3}(?:,\d{3})+)|(?:\d+))/i
    ]);
    if (Number.isFinite(price) && price > 10000) return {priceIRR:Math.round(price), source:"TGJU", at:new Date().toISOString()};
  } catch(e){errors.push(`TGJU USD: ${providerError(e).message}`)}
  try {
    const widget=parseTGJUWidgetMarketData(await fetchText(TGJU_WIDGET_URL));
    if(Number.isFinite(widget.dollar) && widget.dollar>10000) return {priceIRR:Math.round(widget.dollar),source:"TGJU widget API",at:new Date().toISOString()};
  } catch(e){errors.push(`TGJU widget USD: ${providerError(e).message}`)}
  try {
    const snap = await getWorldMarketSnapshot();
    if (Number.isFinite(snap.dollar) && snap.dollar >= 10000) return {priceIRR:Math.round(snap.dollar), source:"TGJU world-market", at:new Date().toISOString()};
  } catch(e){errors.push(`TGJU world-market USD: ${providerError(e).message}`)}
  throw new Error(`USD unavailable — ${errors.join('; ')}`);
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
