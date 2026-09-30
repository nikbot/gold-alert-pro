const TGJU_GOLD_URL = process.env.TGJU_GOLD_URL || "https://gem.tgju.org/profile/geram18";
const TGJU_GOLD_FALLBACK_URLS = [
  "https://www.tgju.org/profile/geram18/today",
  "https://www.tgju.org/profile/geram18/technical/today",
  "https://www.tgju.org/profile/geram18",
  "https://gem.tgju.org/profile/geram18",
  "https://www.tgju.org/profile/geram18/history"
];
const SERVIX_GOLD_URL = process.env.SERVIX_GOLD_URL || "https://servix.cc/api/v1/assets/GOLD_18_RLS";
const SERVIX_API_KEY = String(process.env.SERVIX_API_KEY || "").trim();
const TINDEX_GOLD_URL = process.env.TINDEX_GOLD_URL || "https://tindex.app/api/public/indicators/precious-metals/GOLD-18K";
const TINDEX_API_TOKEN = String(process.env.TINDEX_API_TOKEN || "").trim();
const TGJU_COIN_URL = process.env.TGJU_COIN_URL || "https://www.tgju.org/coin";
const TGJU_DOLLAR_URL = process.env.TGJU_DOLLAR_URL || "https://www.tgju.org/profile/price_dollar_rl/today";
const TGJU_WORLD_URL = process.env.TGJU_WORLD_URL || "https://www.tgju.org/world-market/currency/profile/geram18";
const GOLDPRICE_URL = process.env.GOLDPRICE_URL || "https://api.goldprice.dev/v1/prices?symbol=XAU-USD-SPOT";
const GDELT_URL = process.env.GDELT_URL || "https://api.gdeltproject.org/api/v2/doc/doc";
const configuredTimeout = Number(process.env.HTTP_TIMEOUT || 7000);
const HTTP_TIMEOUT = Number.isFinite(configuredTimeout) ? Math.max(2500, configuredTimeout) : 7000;
const SERVIX_POLL_MS = Math.max(60_000, Number(process.env.SERVIX_POLL_MS || 1_800_000)); // 30 min by default: protects daily quota.
const TINDEX_POLL_MS = Math.max(30_000, Number(process.env.TINDEX_POLL_MS || 120_000));
const SOURCE_DIAGNOSTICS_MS = Math.max(10_000, Number(process.env.SOURCE_DIAGNOSTICS_MS || 60_000));
const SERVIX_429_COOLDOWN_MS = Math.max(5 * 60_000, Number(process.env.SERVIX_429_COOLDOWN_MS || 6 * 60 * 60_000));
const TGJU_MIN_REQUEST_MS = Math.max(1000, Number(process.env.TGJU_MIN_REQUEST_MS || 5000));

let lastValidIran18 = null;
let lastIran18FetchAt = 0;
let sourceComparisonCache = { at: 0, data: null };
const providerState = {
  Servix: { lastAttempt: 0, lastSuccess: 0, cooldownUntil: 0, failures: 0, last: null },
  TGJU: { lastAttempt: 0, lastSuccess: 0, cooldownUntil: 0, failures: 0, last: null },
  Tindex: { lastAttempt: 0, lastSuccess: 0, cooldownUntil: 0, failures: 0, last: null, lastError: null }
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
  const s=normalizeDigits(value).replace(/\s/g,"").replace(/,/g,"");
  const n=Number(s.replace(/[^\d.-]/g,"")); return Number.isFinite(n)?n:NaN;
}
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
  return extractFirst(normalized,[
    /نرخ\s*فعلی\s*:{1,2}\s*((?:\d{1,3}(?:,\d{3})+)|(?:\d+))/i,
    /نرخ\s*فعلی[^\d]{0,160}((?:\d{1,3}(?:,\d{3})+)|(?:\d+))/i,
    /(?:طلای\s*18\s*عیار\s*\/\s*750|Gram\s*Gold\s*18)[^\d]{0,220}((?:\d{1,3}(?:,\d{3})+)|(?:\d+))/i
  ]);
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
  const html=await fetchText(url); const cleaned=cleanText(html); const price=parseIran18PriceFromText(cleaned);
  if(!Number.isFinite(price)||price<1000000)throw new Error("18k price not found in response");
  const at=combineTodayTime(parseTGJULatestAt(cleaned));
  return {priceIRR:Math.round(price),source:`TGJU (${new URL(url).host})`,at,unit:"IRR_PER_GRAM",sourceCode:"TGJU_GERAM18"};
}
function priceFromJson(payload){
  const rows=Array.isArray(payload)?payload:(Array.isArray(payload?.data)?payload.data:[]);
  const candidates=[payload?.value,payload?.price,payload?.data?.value,payload?.data?.price,payload?.data?.indicator?.price,
    ...rows.filter(x=>/GOLD_18_RLS|GOLD-18K|18.?k|18 عیار/i.test(`${x?.code||""} ${x?.slug||""} ${x?.name||""}`)).map(x=>x?.value??x?.price)];
  for(const candidate of candidates){const n=typeof candidate==="string"?parseNumber(candidate):Number(candidate);if(Number.isFinite(n)&&n>100000)return Math.round(n);} return null;
}
async function fetchServix(){
  if(!SERVIX_API_KEY)throw Object.assign(new Error("API key not configured"),{status:401});
  const payload=await fetchJson(SERVIX_GOLD_URL,{"X-API-Key":SERVIX_API_KEY});
  const quote=priceFromJson(payload); if(!quote)throw new Error("valid GOLD_18_RLS value missing");
  const result={priceIRR:quote,source:"Servix API",at:payload?.businessTime||new Date().toISOString(),unit:"IRR_PER_GRAM",sourceCode:"GOLD_18_RLS",fresh:payload?.fresh??null,stale:Boolean(payload?.stale)};
  markProvider("Servix",result); return result;
}
async function fetchTindex(){
  if(!TINDEX_API_TOKEN)throw Object.assign(new Error("API token not configured"),{status:401});
  const payload=await fetchJson(TINDEX_GOLD_URL,{Authorization:`Bearer ${TINDEX_API_TOKEN}`});
  const value=priceFromJson(payload); if(!value)throw new Error("valid GOLD-18K value missing");
  const result={priceIRR:Math.round(value*10),source:"Tindex API",at:payload?.data?.updated_at||new Date().toISOString(),unit:"IRR_PER_GRAM"};
  markProvider("Tindex",result); return result;
}

export async function getIran18(){
  const errors=[]; const now=Date.now();
  // TGJU is the fast path because its public 18K page exposes second-level market ticks.
  // Servix is still the structured authority, but it is deliberately rate-limited to avoid burning daily quota.
  let tgjuResult=null;
  if(providerCanTry("TGJU",TGJU_MIN_REQUEST_MS)){
    providerState.TGJU.lastAttempt=now;
    const urls=[...new Set([TGJU_GOLD_URL,...TGJU_GOLD_FALLBACK_URLS])];
    for(const url of urls){
      try{tgjuResult=await tryIran18Html(url);markProvider("TGJU",tgjuResult);break;}
      catch(e){markProvider("TGJU",null,e);errors.push(`${new URL(url).host}: ${providerError(e).message}`)}
    }
  } else if(providerState.TGJU.last?.priceIRR){
    tgjuResult={...providerState.TGJU.last,cached:true};
  }

  let servixResult=null;
  if(providerCanTry("Servix",SERVIX_POLL_MS)){
    providerState.Servix.lastAttempt=now;
    try{servixResult=await fetchServix();}
    catch(e){markProvider("Servix",null,e);const pe=providerError(e);errors.push(`Servix: ${pe.message}${pe.status?` (${pe.status})`:""}`)}
  } else if(providerState.Servix.last?.priceIRR){ servixResult={...providerState.Servix.last,cached:true}; }

  // Prefer a fresh TGJU tick over an older structured snapshot. Prefer Servix only when its
  // businessTime is no older than the TGJU tick and the value is within the validation band.
  const candidates=[tgjuResult,servixResult].filter(Boolean);
  if(TINDEX_API_TOKEN && !candidates.length && providerCanTry("Tindex",TINDEX_POLL_MS)){
    providerState.Tindex.lastAttempt=now; try{candidates.push(await fetchTindex())}catch(e){markProvider("Tindex",null,e);errors.push(`Tindex: ${providerError(e).message}`)}
  }
  if(!tgjuResult && providerState.TGJU.lastAttempt===now){ providerState.TGJU.cooldownUntil=Math.max(providerState.TGJU.cooldownUntil,Date.now()+15000); }
  if(!candidates.length && providerState.Tindex.last?.priceIRR)candidates.push({...providerState.Tindex.last,cached:true});
  if(!candidates.length && lastValidIran18 && Date.now()-lastIran18FetchAt<120000){return {...lastValidIran18,cached:true,warning:errors.join("; ")||"منبع موقتاً در حال بازیابی است"};}
  if(!candidates.length)throw new Error(`Iran 18k gold unavailable — ${errors.join("; ")||"no provider available"}`);

  const fresh=candidates.filter(x=>!x.cached);
  const selected=fresh[0]||candidates[0];
  if(servixResult && tgjuResult){
    const spread=Math.abs(servixResult.priceIRR/tgjuResult.priceIRR-1)*100;
    if(spread<=2 && new Date(servixResult.at).getTime()>=new Date(tgjuResult.at).getTime()){
      return saveFreshPrice({...servixResult,validation:{peer:"TGJU",spreadPct:spread}});
    }
  }
  return saveFreshPrice({...selected,validation:servixResult&&tgjuResult?{peer:"Servix",spreadPct:Math.abs(servixResult.priceIRR/tgjuResult.priceIRR-1)*100}:null,warning:errors.length?errors.join("; "):undefined});
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
  const data={checkedAt:new Date().toISOString(),primary:primary?.name||null,sources:results,spreadPct,anomaly:spreadPct!=null&&spreadPct>2,thresholdPct:2,providerHealth:{Servix:providerStatus("Servix"),TGJU:providerStatus("TGJU"),Tindex:providerStatus("Tindex")},servixPollMs:SERVIX_POLL_MS};
  sourceComparisonCache={at:Date.now(),data}; return data;
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
