import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import express from "express";
import { getIran18, getIran18Sources, getGlobalGold, getCoins, getDollar, getNews, getHistory } from "./provider.js";
import { runBacktest } from "./backtest.js";
import { analyze } from "./indicators.js";
import { initAlerts, sendTelegram, sendWebPush, sendWebPushToDevice, addSubscription, removeSubscription, removeDeviceSubscriptions, getPublicVapidKey, subscriptionCount } from "./alerts.js";
import { plans, getSubscription, activateSubscription, validAdminKey, paymentUrl, supportUrl } from "./subscription.js";
import { smsConfig, createPaymentRequest, issueActivationCode, activateWithCode, getStatus as getSmsStatus, sendPremiumPriceSMS, adminRequests as getSmsAdminRequests } from "./smsPremium.js";
import { getCommerceSettings, setCommerceSettings } from "./commerceSettings.js";
import { adminLogin, requireAdminToken, adminLogout, listUsers, createManagedUser, updateManagedUser, deleteManagedUser, adminStats, publicAccount, userIsActive, userPermissions, getUserByUsername, validUsername, FEATURE_KEYS, PRO_PERMISSIONS, PREMIUM_PERMISSIONS } from "./adminPanel.js";
import { analyzeGold } from "./ai/manager.js";
import { getTheme, setTheme } from "./theme.js";

const APP_VERSION = "59.3.0"
const USER_SESSION_HOURS = Math.max(1, Number(process.env.USER_SESSION_HOURS || 72));
const LOGIN_WINDOW_MS = 10 * 60_000;
const LOGIN_MAX_ATTEMPTS = 12;
const loginAttempts = new Map();
const app = express();
const port = Number.isFinite(Number(process.env.PORT)) ? Number(process.env.PORT) : 3000;
const pollMs = Math.max(5000, Number(process.env.POLL_MS || 8000));
const staleThresholdMs = Math.max(15000, Number(process.env.STALE_THRESHOLD_MS || 60000));
const minScore = Math.min(100, Math.max(0, Number(process.env.MIN_SIGNAL_SCORE || 65)));
const target1 = Math.max(0.1, Number(process.env.TARGET_1_PCT || 1.5));
const target2 = Math.max(target1, Number(process.env.TARGET_2_PCT || 3));
const stopPct = Math.max(0.1, Number(process.env.STOP_LOSS_PCT || 1));
const DATA_DIR = process.env.DATA_DIR || "/data/gold-alert-pro";
const STATE_FILE = path.join(DATA_DIR, "state.json");
const PERSONAL_ALERTS_FILE = path.join(DATA_DIR, "personal-price-alerts.json");
const PORTFOLIO_FILE = path.join(DATA_DIR, "portfolios.json");
const PORTFOLIO_ALERT_DROP_PCT = Math.max(0.1, Number(process.env.PORTFOLIO_ALERT_DROP_PCT || 0.6));
const PORTFOLIO_ALERT_SCORE = Math.min(100, Math.max(50, Number(process.env.PORTFOLIO_ALERT_SCORE || 70)));
const PORTFOLIO_ALERT_COOLDOWN_MS = Math.max(5 * 60_000, Number(process.env.PORTFOLIO_ALERT_COOLDOWN_MIN || 30) * 60_000);
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");
const TICKETS_FILE = path.join(DATA_DIR, "tickets.json");
const PROFILES_FILE = path.join(DATA_DIR, "profiles.json");
const ECONOMIC_EVENTS_FILE = path.join(DATA_DIR, "economic-events.json");
const NOTIFICATIONS_FILE = path.join(DATA_DIR, "notifications.json");
const AUDIT_FILE = path.join(DATA_DIR, "audit-log.json");
const PAYMENTS_FILE = path.join(DATA_DIR, "payments.json");
const USER_SETTINGS_FILE = path.join(DATA_DIR, "user-settings.json");
const UPDATE_MANIFEST_URL = String(process.env.UPDATE_MANIFEST_URL || "").trim();
const UPDATE_PACKAGE_URL = String(process.env.UPDATE_PACKAGE_URL || "").trim();
const UPDATE_DIR = path.join(DATA_DIR, "updates");
const APP_ROOT = process.cwd();

async function fetchUpdateManifest(){
  if(!UPDATE_MANIFEST_URL) return {available:false,version:APP_VERSION};
  const r=await fetch(UPDATE_MANIFEST_URL,{cache:"no-store",redirect:"follow"});
  if(!r.ok) throw new Error(`manifest ${r.status}`);
  const m=await r.json();
  const version=String(m.version||"").trim();
  if(!version) throw new Error("نسخه در manifest مشخص نشده است");
  const available=compareVersions(version,APP_VERSION)>0;
  return {available,version,notes:String(m.notes||""),mandatory:!!m.mandatory,packageUrl:String(m.packageUrl||UPDATE_PACKAGE_URL||"").trim(),sha256:String(m.sha256||"").trim()};
}
function compareVersions(a,b){
  const aa=String(a).split('.').map(x=>parseInt(x,10)||0),bb=String(b).split('.').map(x=>parseInt(x,10)||0);
  for(let i=0;i<Math.max(aa.length,bb.length);i++){const d=(aa[i]||0)-(bb[i]||0);if(d)return d;} return 0;
}
function runCmd(cmd,args,cwd){return new Promise((resolve,reject)=>{const cp=spawn(cmd,args,{cwd,stdio:["ignore","pipe","pipe"]});let out="",err="";cp.stdout.on("data",d=>out+=d);cp.stderr.on("data",d=>err+=d);cp.on("error",reject);cp.on("close",code=>code===0?resolve(out):reject(new Error(err||`${cmd} exited ${code}`)));});}
async function applySelfUpdate(info){
  if(!info?.packageUrl) throw new Error("آدرس بسته آپدیت تنظیم نشده است.");
  await fs.mkdir(UPDATE_DIR,{recursive:true});
  const zip=path.join(UPDATE_DIR,`update-${info.version.replace(/[^0-9A-Za-z._-]/g,'_')}.zip`);
  const r=await fetch(info.packageUrl,{cache:"no-store",redirect:"follow"});
  if(!r.ok) throw new Error(`دانلود آپدیت ناموفق بود (${r.status})`);
  const buf=Buffer.from(await r.arrayBuffer());
  if(buf.length<100) throw new Error("فایل آپدیت معتبر نیست.");
  if(info.sha256){const hash=crypto.createHash('sha256').update(buf).digest('hex');if(hash.toLowerCase()!==info.sha256.toLowerCase())throw new Error("هش فایل آپدیت با manifest مطابقت ندارد.");}
  await fs.writeFile(zip,buf);
  const stage=path.join(UPDATE_DIR,`stage-${Date.now()}`);
  await fs.mkdir(stage,{recursive:true});
  await runCmd('unzip',['-q','-o',zip,'-d',stage],APP_ROOT);
  let root=stage;
  const entries=await fs.readdir(stage,{withFileTypes:true});
  if(entries.length===1 && entries[0].isDirectory()) root=path.join(stage,entries[0].name);
  const required=['package.json','backend','public'];
  for(const name of required){try{await fs.access(path.join(root,name));}catch{throw new Error(`بسته آپدیت ناقص است: ${name}`);}}
  const preserve=new Set(['node_modules','.env','.env.local','data','.git','.deplexo']);
  for(const e of await fs.readdir(root,{withFileTypes:true})){
    if(preserve.has(e.name)) continue;
    const src=path.join(root,e.name),dst=path.join(APP_ROOT,e.name);
    await fs.rm(dst,{recursive:true,force:true});
    await fs.cp(src,dst,{recursive:true,force:true});
  }
  await fs.writeFile(path.join(DATA_DIR,'last-update.json'),JSON.stringify({from:APP_VERSION,to:info.version,at:new Date().toISOString()}),'utf8');
  await fs.rm(stage,{recursive:true,force:true});
  return {ok:true,version:info.version};
}


// Live mobile push settings. These are intentionally rate-limited so the phone is not spammed.
const livePushIntervalMs = Math.max(60_000, Number(process.env.LIVE_PUSH_INTERVAL_MS || 300_000));
const livePushChangePct = Math.max(0.01, Number(process.env.LIVE_PUSH_CHANGE_PCT || 0.25));

app.disable("x-powered-by");
app.use((req,res,next)=>{res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("Referrer-Policy","strict-origin-when-cross-origin");res.setHeader("X-Frame-Options","SAMEORIGIN");next();});
console.log(`Gold Alert Pro v${APP_VERSION} booting`);
app.use((req, res, next) => { res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*"); res.setHeader("Access-Control-Allow-Headers", "Content-Type"); res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS"); if (req.method === "OPTIONS") return res.sendStatus(204); next(); });
app.use(express.json({ limit: "64kb" }));
app.use(express.static("public", { maxAge: "1h", setHeaders: (res, filePath) => { if (/\/(app|sw)\.js$/.test(filePath) || /\/index\.html$/.test(filePath)) res.setHeader("Cache-Control", "no-store"); } }));

const state = {
  iran: null, global: null, dollar: null, coins: null, marketPressure: null, analysis: null, prices: [], ticks: [], events: [], news: [], lastSignal: "WAIT", lastPressureAlert: "NEUTRAL",
  updatedAt: null, error: null, startedAt: new Date().toISOString(), dataReady: false,
  livePush: { lastAt: 0, lastPrice: 0 },
  engineStatus: { status: "STARTING", label: "در حال راه‌اندازی", source: null, sourceAgeMs: null, reason: null },
  sourceDiagnostics: null,
  portfolioRisk: { lastKey: "", lastAt: 0 },
  historyLoaded: false, activeTrade: null, targetEvents: [], personalAlerts: [], busy: false, consecutiveErrors: 0
};

const sseClients = new Set();
let lastSseMarketKey = "";
function publicStatePayload(){
  return {
    ...state,
    config: { pollMs, minScore, target1, target2, stopPct, appVersion: APP_VERSION },
    marketStructure: marketStructure(state.prices),
    sourceDiagnostics: state.sourceDiagnostics,
    anomaly: state.anomaly || null,
    engineStatus: state.engineStatus,
    units: { gold18: "IRR_PER_GRAM", dollar: "IRR_PER_USD", coins: "IRR" }
  };
}
function broadcastMarketState(force = false){
  if (!state.iran) return;
  const key = [state.iran.priceIRR, state.iran.at, state.global?.xauUsd, state.dollar?.priceIRR].join("|");
  if (!force && key === lastSseMarketKey) return;
  lastSseMarketKey = key;
  const payload = `event: market\ndata: ${JSON.stringify(publicStatePayload())}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch { sseClients.delete(client); }
  }
}
function startSseHeartbeat(res){
  const timer = setInterval(() => {
    try { res.write(`: heartbeat ${Date.now()}\n\n`); } catch { clearInterval(timer); }
  }, 15000);
  res.on("close", () => clearInterval(timer));
}


let saveTimer = null;
async function loadState() {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const saved = JSON.parse(raw);
    if (saved?.activeTrade) state.activeTrade = saved.activeTrade;
    if (Array.isArray(saved?.events)) state.events = saved.events.slice(0, 50);
    if (Array.isArray(saved?.targetEvents)) state.targetEvents = saved.targetEvents.slice(0, 30);
    if (saved?.lastSignal) state.lastSignal = saved.lastSignal;
    if (saved?.lastPressureAlert) state.lastPressureAlert = saved.lastPressureAlert;
    if (Array.isArray(saved?.personalAlerts)) state.personalAlerts = saved.personalAlerts.slice(0, 1000);
  } catch {}
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(STATE_FILE, JSON.stringify({ activeTrade: state.activeTrade, events: state.events, targetEvents: state.targetEvents, lastSignal: state.lastSignal, lastPressureAlert: state.lastPressureAlert, personalAlerts: state.personalAlerts }), "utf8");
    } catch (e) { console.warn("State persistence unavailable:", e.message); }
  }, 150);
}


async function audit(action, meta={}){ try{ const a=await readJsonFile(AUDIT_FILE,[]); a.unshift({id:crypto.randomUUID(),action:String(action).slice(0,120),meta,at:new Date().toISOString()}); await writeJsonFile(AUDIT_FILE,a.slice(0,1000)); }catch{} }
async function addNotification(userId,title,message,type="info"){ const all=await readJsonFile(NOTIFICATIONS_FILE,[]); const item={id:crypto.randomUUID(),userId,title:String(title).slice(0,120),message:String(message).slice(0,1000),type,read:false,createdAt:new Date().toISOString()}; all.unshift(item); await writeJsonFile(NOTIFICATIONS_FILE,all.slice(0,5000)); try{ const store=await readJsonFile(ACCOUNTS_FILE,{}); const a=Object.values(store).find(x=>x?.id===userId); if(a?.deviceId) await sendWebPushToDevice(a.deviceId,{title:String(title).slice(0,120),body:String(message).slice(0,500),icon:'/icon-192.png',badge:'/icon-192.png',tag:`user-notification-${item.id}`,data:{url:'/#notificationCenter'}},`NOTIF_${item.id}`,Date.now()); }catch(e){ console.warn('User notification push failed:',e.message); } return item; }
async function readJsonFile(file, fallback) { try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return fallback; } }
async function writeJsonFile(file, value) { await fs.mkdir(DATA_DIR, { recursive: true }); await fs.writeFile(file, JSON.stringify(value), "utf8"); }
function normalizePhone(v) { return String(v || "").replace(/\s+/g, "").replace(/-/g, "").trim(); }
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) { const hash = crypto.scryptSync(String(password), salt, 64).toString("hex"); return { salt, hash }; }
function verifyPassword(password, salt, expected) { try { const actual = crypto.scryptSync(String(password), salt, 64).toString("hex"); return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex")); } catch { return false; } }
async function accountByToken(token) { const t=String(token||""); if(!t) return null; const store=await readJsonFile(ACCOUNTS_FILE, {}); const a=Object.values(store).find(x=>x.token===t) || null; if(!a) return null; if(a.tokenExpiresAt && Date.parse(a.tokenExpiresAt)<Date.now()){ a.token=""; a.tokenExpiresAt=null; const key=Object.keys(store).find(k=>store[k]===a); if(key){store[key]=a; await writeJsonFile(ACCOUNTS_FILE,store);} return null; } return a; }
function loginAllowed(key){ const now=Date.now(); const x=loginAttempts.get(key); if(!x || now-x.startedAt>LOGIN_WINDOW_MS){loginAttempts.set(key,{startedAt:now,count:1});return true;} x.count++; return x.count<=LOGIN_MAX_ATTEMPTS; }
function clearLoginAttempts(key){loginAttempts.delete(key);}

function accountTokenFromReq(req){ return String(req.headers["x-account-token"] || req.body?.token || req.body?.accountToken || req.query?.accountToken || ""); }
async function accountFromReq(req){ return accountByToken(accountTokenFromReq(req)); }
async function requireFeature(req, feature, deviceId){
  const a=await accountFromReq(req);
  if(!a) return true; // public/device mode remains available for market basics.
  if(!userIsActive(a)) return false;
  const perms=userPermissions(a);
  // AI is a core registered-user feature; paid plans can still control limits/other premium tools.
  if(['ai','chat','newsAI'].includes(feature)) return true;
  return perms.includes(feature);
}
function userView(a){ return publicAccount(a); }
function marketStructure(prices){
  const p=prices.filter(Number.isFinite); if(!p.length) return {trend:"WAIT",support:null,resistance:null,confidence:0};
  const n=Math.min(60,p.length), a=p.slice(-n), current=a.at(-1);
  const short=a.slice(-Math.min(12,a.length)), mid=a.slice(-Math.min(30,a.length));
  const shortFirst=short[0]||current, midFirst=mid[0]||current;
  const shortPct=shortFirst?(current/shortFirst-1)*100:0, midPct=midFirst?(current/midFirst-1)*100:0;
  const highs=[], lows=[]; for(let i=2;i<a.length-2;i++){ if(a[i]>=a[i-1]&&a[i]>=a[i+1])highs.push(a[i]); if(a[i]<=a[i-1]&&a[i]<=a[i+1])lows.push(a[i]); }
  const resistance=highs.length?Math.max(...highs.slice(-5)):Math.max(...a);
  const support=lows.length?Math.min(...lows.slice(-5)):Math.min(...a);
  let trend="SIDEWAYS"; if(shortPct>0.35&&midPct>0.5)trend="UP"; else if(shortPct<-0.35&&midPct<-0.5)trend="DOWN";
  const confidence=Math.min(95,Math.round(35+Math.min(30,Math.abs(shortPct)*18)+Math.min(30,Math.abs(midPct)*8)));
  const breakout=current>resistance*1.002, breakdown=current<support*0.998;
  return {trend,trendFa:trend==='UP'?'صعودی':trend==='DOWN'?'نزولی':'خنثی',support,resistance,current,shortPct,midPct,breakout,breakdown,confidence,sample:n};
}
async function economicEvents(){
  const env=process.env.ECONOMIC_EVENTS_JSON; if(env){try{const x=JSON.parse(env);if(Array.isArray(x))return x.slice(0,50);}catch{}}
  return await readJsonFile(ECONOMIC_EVENTS_FILE, []);
}
async function profileFor(deviceId) { const store=await readJsonFile(PROFILES_FILE, {}); return store[cleanDeviceId(deviceId)] || {}; }
async function saveProfile(deviceId, profile) { const id=cleanDeviceId(deviceId); const store=await readJsonFile(PROFILES_FILE, {}); store[id]={...(store[id]||{}),...profile,updatedAt:new Date().toISOString()}; await writeJsonFile(PROFILES_FILE,store); return store[id]; }
async function readPortfolioStore() {
  try { return JSON.parse(await fs.readFile(PORTFOLIO_FILE, "utf8")); } catch { return {}; }
}
async function writePortfolioStore(store) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(PORTFOLIO_FILE, JSON.stringify(store), "utf8");
}
function cleanPortfolioItem(x={}) {
  return {
    id: String(x.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`),
    weight: Number(x.weight),
    buyPrice: Number(x.buyPrice),
    purity: Number(x.purity || 750),
    note: String(x.note || "طلای فیزیکی").slice(0, 80),
    createdAt: x.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}
function cleanPortfolioList(list) {
  return Array.isArray(list) ? list.map(cleanPortfolioItem).filter(x => Number.isFinite(x.weight) && x.weight > 0 && Number.isFinite(x.buyPrice) && x.buyPrice > 0).slice(0, 100) : [];
}
async function getDevicePortfolio(deviceId) {
  const id = cleanDeviceId(deviceId); if (!id) return [];
  const store = await readPortfolioStore();
  return cleanPortfolioList(store[id] || []);
}
async function setDevicePortfolio(deviceId, list) {
  const id = cleanDeviceId(deviceId); if (!id) throw new Error("deviceId required");
  const store = await readPortfolioStore(); store[id] = cleanPortfolioList(list); await writePortfolioStore(store); return store[id];
}
function buildPortfolioSnapshot(items) {
  const current = Number(state.iran?.priceIRR || 0);
  const recentPrices = state.prices.slice(-120).filter(Number.isFinite);
  const recentHigh = recentPrices.length ? Math.max(...recentPrices) : current;
  const drawdownPct = recentHigh > 0 && current > 0 ? (current / recentHigh - 1) * 100 : 0;
  const rows = cleanPortfolioList(items).map(x => {
    const purityFactor = Number(x.purity || 750) / 750;
    const currentPerGram = current * purityFactor;
    const cost = x.weight * x.buyPrice;
    const value = x.weight * currentPerGram;
    const pnl = value - cost;
    return {...x, currentPerGram, cost, value, pnl, pnlPct: cost ? pnl / cost * 100 : 0};
  });
  const totalWeight = rows.reduce((a,x)=>a+x.weight,0);
  const totalCost = rows.reduce((a,x)=>a+x.cost,0);
  const totalValue = rows.reduce((a,x)=>a+x.value,0);
  const pnl = totalValue-totalCost;
  return {rows,totalWeight,totalCost,totalValue,pnl,pnlPct:totalCost?pnl/totalCost*100:0,currentGold18IRR:current,recentHigh,drawdownPct,updatedAt:state.updatedAt};
}

function portfolioRiskSnapshot() {
  const current = Number(state.iran?.priceIRR || 0);
  const recentPrices = state.prices.slice(-120).filter(Number.isFinite);
  const recentHigh = recentPrices.length ? Math.max(...recentPrices) : current;
  const drawdownPct = recentHigh > 0 && current > 0 ? (current / recentHigh - 1) * 100 : 0;
  const a = state.analysis || {};
  const mp = state.marketPressure || {};
  const technicalSell = a.signal === 'SELL' && Number(a.score || 0) >= PORTFOLIO_ALERT_SCORE;
  const pressureSell = Number(mp.sell || 0) >= 70;
  const peakDrop = drawdownPct <= -PORTFOLIO_ALERT_DROP_PCT;
  const risk = technicalSell && pressureSell ? 'HIGH' : (technicalSell || pressureSell || peakDrop ? 'WATCH' : 'NORMAL');
  return {risk,current,recentHigh,drawdownPct,technicalSell,pressureSell,peakDrop,signal:a.signal || 'WAIT',score:Number(a.score||0),buyPressure:Number(mp.buy||0),sellPressure:Number(mp.sell||0),thresholdPct:PORTFOLIO_ALERT_DROP_PCT,scoreThreshold:PORTFOLIO_ALERT_SCORE,updatedAt:state.updatedAt};
}

async function checkPortfolioRiskAlerts() {
  const risk = portfolioRiskSnapshot();
  if (risk.risk === 'NORMAL' || !risk.current) return;
  const now = Date.now();
  if (now - Number(state.portfolioRisk.lastAt || 0) < PORTFOLIO_ALERT_COOLDOWN_MS && state.portfolioRisk.lastKey === risk.risk) return;
  const store = await readPortfolioStore();
  const deviceIds = Object.keys(store).filter(id => cleanPortfolioList(store[id]).length);
  if (!deviceIds.length) return;
  const reasons=[];
  if(risk.technicalSell) reasons.push(`سیگنال فروش با امتیاز ${Math.round(risk.score)}٪`);
  if(risk.pressureSell) reasons.push(`فشار فروش ${Math.round(risk.sellPressure)}٪`);
  if(risk.peakDrop) reasons.push(`افت ${Math.abs(risk.drawdownPct).toFixed(2)}٪ از سقف اخیر`);
  const title = risk.risk === 'HIGH' ? '🛑 هشدار مدیریت دارایی' : '⚠️ تغییر شرایط بازار';
  const body = `طلای ۱۸: ${rial(risk.current)} ریال\n${reasons.join(' • ')}\nاین هشدار برای بررسی فروش/کاهش پله‌ای است، نه دستور قطعی فروش.`;
  for (const deviceId of deviceIds) {
    await safeAlert(() => sendWebPushToDevice(deviceId,{title,body,icon:'/icon-192.png',badge:'/icon-192.png',tag:'portfolio-risk',renotify:true,data:{url:'/#portfolio'}},`PORTFOLIO_RISK_${risk.risk}`,risk.current));
  }
  state.portfolioRisk={lastKey:risk.risk,lastAt:now};
}


async function loadPersonalAlerts() {
  try {
    const raw = await fs.readFile(PERSONAL_ALERTS_FILE, "utf8");
    const saved = JSON.parse(raw);
    if (Array.isArray(saved)) state.personalAlerts = saved.slice(0, 1000);
  } catch {}
}
let personalAlertSaveTimer = null;
function schedulePersonalAlertSave() {
  clearTimeout(personalAlertSaveTimer);
  personalAlertSaveTimer = setTimeout(async () => {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(PERSONAL_ALERTS_FILE, JSON.stringify(state.personalAlerts.slice(0, 1000)), "utf8");
    } catch (e) { console.warn("Personal alert persistence unavailable:", e.message); }
  }, 200);
}
function cleanDeviceId(v) { return String(v || "").trim().slice(0, 120); }
function cleanAlert(a) { return { id: String(a.id), deviceId: cleanDeviceId(a.deviceId), direction: a.direction === "below" ? "below" : "above", price: Number(a.price), label: String(a.label || "طلای ۱۸ عیار").slice(0, 80), createdAt: a.createdAt || new Date().toISOString(), triggeredAt: a.triggeredAt || null }; }
async function checkPersonalPriceAlerts(price) {
  if (!Number.isFinite(price) || price <= 0) return;
  let changed = false;
  for (const a of state.personalAlerts) {
    if (a.triggeredAt || !a.deviceId || !Number.isFinite(Number(a.price))) continue;
    const hit = a.direction === "above" ? price >= Number(a.price) : price <= Number(a.price);
    if (!hit) continue;
    a.triggeredAt = new Date().toISOString();
    changed = true;
    const direction = a.direction === "above" ? "⬆️ قیمت از هدف شما عبور کرد" : "⬇️ قیمت به زیر هدف شما رسید";
    const body = `${a.label} به ${rial(price)} ریال رسید. هدف شما: ${rial(a.price)} ریال`;
    await safeAlert(() => sendWebPushToDevice(a.deviceId, { title: `🎯 ${direction}`, body, icon: "/icon-192.png", badge: "/icon-192.png", tag: `personal-price-${a.id}`, data: { url: "/#priceAlerts" } }, `PERSONAL_${a.id}`, price));
  }
  if (changed) schedulePersonalAlertSave();
}

async function emitLivePricePush(iran, global, dollar) {
  const price = Number(iran?.priceIRR || 0);
  if (!price) return;
  const now = Date.now();
  const lastAt = Number(state.livePush?.lastAt || 0);
  const lastPrice = Number(state.livePush?.lastPrice || 0);
  const changed = lastPrice ? Math.abs(price / lastPrice - 1) * 100 >= livePushChangePct : true;
  if (now - lastAt < livePushIntervalMs && !changed) return;
  const prev = lastPrice || price;
  const delta = prev ? (price / prev - 1) * 100 : 0;
  const dir = delta > 0 ? '▲' : delta < 0 ? '▼' : '•';
  const body = `طلای ۱۸: ${rial(price)} ریال ${dir} ${Math.abs(delta).toFixed(2)}٪\nاونس: ${global?.xauUsd ? '$'+Number(global.xauUsd).toFixed(2) : '—'} | دلار: ${dollar?.priceIRR ? rial(dollar.priceIRR)+' ریال' : '—'}`;
  await safeAlert(() => sendWebPush({ title: '⚡ قیمت زنده Gold Alert Pro', body, icon: '/icon-192.png', badge: '/icon-192.png', tag: 'live-price', renotify: true, data: { url: '/#livePricePanel' } }, 'LIVE_PRICE', price));
  state.livePush = { lastAt: now, lastPrice: price };
}

function pushPrice(p) {
  const n = Number(p);
  if (!Number.isFinite(n) || n <= 0) return;
  const last = state.prices.at(-1);
  if (last != null && Math.abs(last - n) < 0.000001) return;
  state.prices.push(n);
  if (state.prices.length > 500) state.prices.shift();
}
function rial(n) { return Math.round(Number(n)).toLocaleString("fa-IR"); }
function buildTrade(a) {
  if (!a || !["BUY", "SELL"].includes(a.signal) || !Number.isFinite(a.price)) return null;
  const p = a.price;
  return { signal: a.signal, entry: p,
    target1: a.signal === "BUY" ? p * (1 + target1 / 100) : p * (1 - target1 / 100),
    target2: a.signal === "BUY" ? p * (1 + target2 / 100) : p * (1 - target2 / 100),
    stop: a.signal === "BUY" ? p * (1 - stopPct / 100) : p * (1 + stopPct / 100),
    target1Hit: false, target2Hit: false, stopHit: false, openedAt: new Date().toISOString(), closedAt: null };
}
async function safeAlert(fn) { try { await fn(); } catch (e) { console.warn("Alert error:", e.message); } }
async function alertTarget(kind, trade, price) {
  const labels = { target1: "🎯 هدف اول", target2: "🏆 هدف دوم", stop: "🛑 حد ضرر" };
  const label = labels[kind] || kind;
  const text = ["🥇 Gold Alert Pro", `${label} — ${trade.signal === "BUY" ? "خرید" : "فروش"}`, `قیمت فعلی: ${rial(price)} ریال`, `ورود: ${rial(trade.entry)} ریال`, `هدف ۱: ${rial(trade.target1)} ریال`, `هدف ۲: ${rial(trade.target2)} ریال`, `حد ضرر: ${rial(trade.stop)} ریال`].join("\n");
  await Promise.all([
    safeAlert(() => sendTelegram(text, `TARGET_${kind}`, price)),
    safeAlert(() => sendWebPush({ title: `${label} | Gold Alert Pro`, body: `${trade.signal === "BUY" ? "خرید" : "فروش"} — ${rial(price)} ریال`, icon: "/icon-192.png", badge: "/icon-192.png", tag: `target-${kind}-${trade.signal}`, data: { url: "/" } }, `TARGET_${kind}`, price))
  ]);
  state.targetEvents.unshift({ at: new Date().toISOString(), kind, signal: trade.signal, price, text });
  state.targetEvents = state.targetEvents.slice(0, 30);
  scheduleSave();
}
async function checkTargets(price) {
  const t = state.activeTrade;
  if (!t || t.closedAt || !Number.isFinite(price)) return;
  const hit = [];
  if (t.signal === "BUY") {
    if (!t.target1Hit && price >= t.target1) { t.target1Hit = true; hit.push("target1"); }
    if (!t.target2Hit && price >= t.target2) { t.target2Hit = true; hit.push("target2"); }
    if (!t.stopHit && price <= t.stop) { t.stopHit = true; hit.push("stop"); }
  } else {
    if (!t.target1Hit && price <= t.target1) { t.target1Hit = true; hit.push("target1"); }
    if (!t.target2Hit && price <= t.target2) { t.target2Hit = true; hit.push("target2"); }
    if (!t.stopHit && price >= t.stop) { t.stopHit = true; hit.push("stop"); }
  }
  for (const kind of hit) await alertTarget(kind, t, price);
  if (t.target2Hit || t.stopHit) { t.closedAt = new Date().toISOString(); scheduleSave(); }
}
function pushTick(snapshot) {
  const p = Number(snapshot?.iran?.priceIRR);
  if (!Number.isFinite(p) || p <= 0) return;
  state.ticks.push({
    at: new Date().toISOString(),
    price: p,
    xau: Number(snapshot?.global?.xauUsd) || null,
    dollar: Number(snapshot?.dollar?.priceIRR) || null,
    coins: snapshot?.coins || null
  });
  if (state.ticks.length > 720) state.ticks.shift();
}
function pctChange(a,b){ return Number.isFinite(a)&&Number.isFinite(b)&&b!==0 ? (a/b-1)*100 : null; }
function calcMarketPressure() {
  const t=state.ticks, last=t.at(-1);
  if (!last || t.length<3) return {buy:50,sell:50,label:"داده در حال جمع‌آوری",confidence:20,estimated:true};
  const p=last.price;
  const r1=pctChange(p,t[Math.max(0,t.length-7)]?.price) || 0;
  const r5=pctChange(p,t[Math.max(0,t.length-31)]?.price) || 0;
  const rLong=pctChange(p,t[Math.max(0,t.length-181)]?.price) || 0;
  let buy=50 + Math.max(-20,Math.min(20,r1*8)) + Math.max(-15,Math.min(15,r5*3));
  let sell=100-buy;
  if (last.xau && t.length>6) {
    const xr=pctChange(last.xau,t[Math.max(0,t.length-7)]?.xau);
    if (xr!=null) { buy += Math.max(-8,Math.min(8,xr*4)); sell=100-buy; }
  }
  if (last.dollar && t.length>6) {
    const dr=pctChange(last.dollar,t[Math.max(0,t.length-7)]?.dollar);
    if (dr!=null) { buy += Math.max(-6,Math.min(6,dr*2)); sell=100-buy; }
  }
  const prev=t[t.length-2]?.coins;
  if (prev && last.coins) {
    const keys=["emami","bahar","half","quarter","gram"];
    const deltas=keys.map(k=>pctChange(Number(last.coins[k]),Number(prev[k]))).filter(x=>x!=null);
    if(deltas.length){const breadth=deltas.filter(x=>x>0).length/deltas.length;buy += (breadth-.5)*16;sell=100-buy;}
  }
  buy=Math.max(0,Math.min(100,buy)); sell=100-buy;
  const label=buy>=65?"فشار خرید بیشتر":sell>=65?"فشار فروش بیشتر":"بازار متعادل";
  const confidence=Math.min(90,Math.round(25 + Math.min(50,t.length/10) + Math.min(15,Math.abs(buy-50))));
  return {buy,sell,label,confidence,estimated:true,shortPct:r1,midPct:r5,longPct:rLong,disclaimer:"این شاخص برآورد فشار بازار از روی حرکت قیمت و همبستگی دارایی‌هاست؛ حجم واقعی سفارشات خرید/فروش نیست."};
}
async function loadHistorySeed() {
  const h = await getHistory();
  for (const x of h.slice(-120)) pushPrice(x.close);
  state.historyLoaded = state.prices.length > 0;
  state.dataReady = state.prices.length >= 30;
}

async function emitSignal(a) {
  const oldTrade = state.activeTrade;
  if (oldTrade && !oldTrade.closedAt && oldTrade.signal !== a.signal) {
    oldTrade.closedAt = new Date().toISOString();
    oldTrade.closeReason = "OPPOSITE_SIGNAL";
  }
  state.activeTrade = buildTrade(a);
  const dir = a.signal === "BUY" ? "🟢 خرید" : "🔴 فروش";
  const text = ["🥇 Gold Alert Pro", `${dir} — امتیاز ${a.score}%`, `قیمت: ${rial(a.price)} ریال`, `RSI: ${a.rsi?.toFixed(1) ?? "-"}`, `هدف ۱: ${rial(state.activeTrade.target1)} | هدف ۲: ${rial(state.activeTrade.target2)}`, `حد ضرر: ${rial(state.activeTrade.stop)}`, "⚠️ تحلیل خودکار است و تضمین سود نیست."].join("\n");
  await Promise.all([
    safeAlert(() => sendTelegram(text, a.signal, a.price)),
    safeAlert(() => sendWebPush({ title: `Gold Alert Pro — ${a.signal === "BUY" ? "خرید" : "فروش"}`, body: `طلای ۱۸: ${rial(a.price)} ریال | امتیاز ${a.score}%`, icon: "/icon-192.png", badge: "/icon-192.png", tag: `gold-${a.signal}`, data: { url: "/" } }, a.signal, a.price))
  ]);
  state.events.unshift({ at: new Date().toISOString(), signal: a.signal, price: a.price, score: a.score, text });
  state.events = state.events.slice(0, 50);
  state.lastSignal = a.signal;
  scheduleSave();
}

async function emitPressureAlert(mp, price) {
  const mode = mp.buy >= 70 ? "BUY_PRESSURE" : mp.sell >= 70 ? "SELL_PRESSURE" : "NEUTRAL";
  if (mode === "NEUTRAL") { state.lastPressureAlert = "NEUTRAL"; return; }
  if (mode === state.lastPressureAlert) return;
  state.lastPressureAlert = mode;
  const title = mode === "BUY_PRESSURE" ? "📈 فشار خرید بالا" : "📉 فشار فروش بالا";
  const text = [`🥇 Gold Alert Pro`, title, `طلای ۱۸: ${rial(price)} ریال`, `فشار خرید: ${Math.round(mp.buy)}٪`, `فشار فروش: ${Math.round(mp.sell)}٪`, `سطح اطمینان: ${Math.round(mp.confidence)}٪`, "این شاخص برآورد فشار بازار از روی حرکت قیمت و دارایی‌های مرتبط است و حجم واقعی سفارشات نیست."].join("\n");
  await Promise.all([
    safeAlert(() => sendTelegram(text, mode, price)),
    safeAlert(() => sendWebPush({title,body:`طلای ۱۸: ${rial(price)} ریال | خرید ${Math.round(mp.buy)}٪ | فروش ${Math.round(mp.sell)}٪`,icon:"/icon-192.png",badge:"/icon-192.png",tag:`pressure-${mode}`,data:{url:"/"}}, mode, price))
  ]);
  scheduleSave();
}

async function tick() {
  if (state.busy) return;
  state.busy = true;
  try {
    const providerNames = ["Iran18", "GlobalGold", "Dollar", "Coins"];
    const results = await Promise.allSettled([getIran18(), getGlobalGold(), getDollar(), getCoins()]);
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "rejected") console.warn(`Provider ${providerNames[i]} failed:`, results[i].reason?.message || "unknown error");
    }
    const iran = results[0].status === "fulfilled" ? results[0].value : null;
    const global = results[1].status === "fulfilled" ? results[1].value : null;
    const dollar = results[2].status === "fulfilled" ? results[2].value : null;
    const coins = results[3].status === "fulfilled" ? results[3].value : null;
    if (!iran) {
      console.warn("Iran18 unavailable, keeping previous state");
      state.engineStatus = { status: "OFFLINE", label: "منبع قیمت در دسترس نیست", source: null, sourceAgeMs: null, reason: results[0].reason?.message || "Iran gold provider unavailable" };
      if (state.iran) { state.error = results[0].reason?.message || "Iran gold provider unavailable"; broadcastMarketState(true); return; }
      throw new Error(results[0].reason?.message || "Iran gold price unavailable");
    }
    if (iran.cached) {
      const sourceAt = new Date(state.iran?.at || iran.at || 0).getTime();
      const age = sourceAt ? Math.max(0, Date.now() - sourceAt) : null;
      state.engineStatus = { status: "STALE", label: "آخرین قیمت معتبر", source: state.iran?.source || iran.source || null, sourceAgeMs: age, reason: iran.warning || "منبع قیمت فعلاً داده جدید نداده است" };
      state.error = iran.warning || "قیمت جدید از منبع دریافت نشد";
      try { state.sourceDiagnostics = await getIran18Sources(false); } catch {}
      broadcastMarketState(true);
      return;
    }
    state.iran = iran; state.global = global; state.dollar = dollar; state.coins = coins;
    if (!state.sourceDiagnostics || Date.now() - new Date(state.sourceDiagnostics.checkedAt || 0).getTime() > 60000) {
      try { state.sourceDiagnostics = await getIran18Sources(false); } catch (e) { state.sourceDiagnostics = { checkedAt:new Date().toISOString(), primary:iran.source || null, sources:[{name:iran.source||"active",priceIRR:iran.priceIRR,ok:true}], anomaly:false, error:e.message }; }
    }
    const previousPrice = Number(state.prices.at(-1) || 0);
    const jumpPct = previousPrice > 0 ? Math.abs((iran.priceIRR / previousPrice - 1) * 100) : 0;
    const sourceTimestamp = iran.at ? new Date(iran.at).getTime() : 0;
    const receivedTimestamp = iran.fetchedAt ? new Date(iran.fetchedAt).getTime() : Date.now();
    const sourceAge = sourceTimestamp > 0 && Number.isFinite(sourceTimestamp) ? Math.max(0, Date.now() - sourceTimestamp) : 0;
    const transportAge = Math.max(0, Date.now() - receivedTimestamp);
    const sourceStale = sourceAge > staleThresholdMs || transportAge > staleThresholdMs;
    state.anomaly = { detected: jumpPct > 5 || Boolean(state.sourceDiagnostics?.anomaly), jumpPct, thresholdPct:5, sourceSpreadPct:state.sourceDiagnostics?.spreadPct ?? null, checkedAt:new Date().toISOString() };
    state.engineStatus = { status: sourceStale ? "STALE" : "LIVE", label: sourceStale ? "قیمت منبع قدیمی است" : "LIVE • قیمت جدید", source: iran.source || null, sourceAgeMs: sourceAge, transportAgeMs: transportAge, reason: sourceStale ? `آخرین داده بیش از ${Math.round(staleThresholdMs/1000)} ثانیه قبل است` : null };
    pushPrice(iran.priceIRR); pushTick({iran,global,dollar,coins});
    state.marketPressure = calcMarketPressure();
    await emitPressureAlert(state.marketPressure, iran.priceIRR);
    state.analysis = analyze(state.prices); state.dataReady = state.prices.length >= 30;
    state.updatedAt = new Date().toISOString(); state.error = sourceStale ? state.engineStatus.reason : null; state.consecutiveErrors = 0; broadcastMarketState();
    await safeAlert(() => checkPortfolioRiskAlerts());
    await safeAlert(() => emitLivePricePush(iran, global, dollar));
    await safeAlert(() => checkTargets(iran.priceIRR));
    await safeAlert(() => checkPersonalPriceAlerts(iran.priceIRR));
    await safeAlert(() => sendPremiumPriceSMS({ iran, global, dollar, coins, analysis: state.analysis }));
    const a = state.analysis;
    if (a && ["BUY", "SELL"].includes(a.signal) && a.score >= minScore && a.signal !== state.lastSignal) await emitSignal(a);
    else if (!a || !["BUY", "SELL"].includes(a.signal)) { if (state.lastSignal !== "WAIT") { state.lastSignal = "WAIT"; scheduleSave(); } }
  } catch (e) {
    state.consecutiveErrors++;
    state.error = e.message;
    const fetchedAt = state.iran?.fetchedAt ? new Date(state.iran.fetchedAt).getTime() : 0;
    const age = fetchedAt && Number.isFinite(fetchedAt) ? Math.max(0, Date.now() - fetchedAt) : Infinity;
    const hasLast = Boolean(state.iran?.priceIRR);
    state.engineStatus = hasLast && age <= staleThresholdMs
      ? { status:"STALE", label:"آخرین قیمت معتبر", source:state.iran?.source||null, sourceAgeMs:age, reason:e.message }
      : { status:"OFFLINE", label:"منبع قیمت در دسترس نیست", source:state.iran?.source||null, sourceAgeMs:Number.isFinite(age)?age:null, reason:e.message };
    try { state.sourceDiagnostics = await getIran18Sources(false); } catch {}
    broadcastMarketState(true);
    console.warn("Tick error:", e.message);
  } finally { state.busy = false; }
}



function portfolioScenario(items, pct) {
  const price=Number(state.iran?.priceIRR||0); const change=Number(pct)/100; const rows=cleanPortfolioList(items).map(x=>{const factor=(Number(x.purity||750)/750); const current=x.weight*price*factor; const future=x.weight*price*(1+change)*factor; return {id:x.id,note:x.note,weight:x.weight,currentValue:current,futureValue:future,change:future-current};});
  const totalCurrent=rows.reduce((a,x)=>a+x.currentValue,0), totalFuture=rows.reduce((a,x)=>a+x.futureValue,0); return {pct:Number(pct),price,currentValue:totalCurrent,futureValue:totalFuture,delta:totalFuture-totalCurrent,rows};
}
function buildPortfolioAllocation(items) {
  const snap=buildPortfolioSnapshot(items), a=state.analysis||{}, mp=state.marketPressure||{}; const sell=Number(mp.sell||0), buy=Number(mp.buy||0); let keep=100, reduce=0, add=0;
  if(a.signal==='SELL' && Number(a.score||0)>=70 && sell>=60){ reduce=25; keep=75; }
  else if(a.signal==='BUY' && Number(a.score||0)>=70 && buy>=60){ add=15; keep=85; }
  return {keepPct:keep,reducePct:reduce,addPct:add,signal:a.signal||'WAIT',score:Number(a.score||0),buyPressure:buy,sellPressure:sell,portfolioValue:snap.totalValue,disclaimer:'این درصدها پیشنهاد سناریویی نرم‌افزاری هستند، نه دستور قطعی خرید یا فروش.'};
}
function monthlyReport(items) {
  const snap=buildPortfolioSnapshot(items); const prices=state.prices.slice(-120).filter(Number.isFinite); const high=prices.length?Math.max(...prices):snap.currentGold18IRR; const low=prices.length?Math.min(...prices):snap.currentGold18IRR; const start=prices[0]||snap.currentGold18IRR; return {generatedAt:new Date().toISOString(),period:'داده‌های اخیر سامانه',portfolio:snap,market:{startPrice:start,currentPrice:snap.currentGold18IRR,high,low,changePct:start?(snap.currentGold18IRR/start-1)*100:0},analysis:state.analysis,pressure:state.marketPressure};
}

const AI_BASE_URL = (process.env.GAPGPT_BASE_URL || "https://api.gapgpt.app/v1").replace(/\/$/, "");
const AI_MODEL = process.env.GAPGPT_MODEL || "gpt-4o-mini";
const AI_FALLBACK_MODELS = [AI_MODEL, "auto", "gpt-4o-mini"].filter((v,i,a)=>v && a.indexOf(v)===i);
const aiWindow = new Map();
function aiAllowed(ip){
  const now=Date.now(), windowMs=60000, limit=10;
  const arr=(aiWindow.get(ip)||[]).filter(t=>now-t<windowMs);
  if(arr.length>=limit) return false;
  arr.push(now); aiWindow.set(ip,arr); return true;
}
function buildAIContext(){
  const a=state.analysis||{}, mp=state.marketPressure||{};
  const recentTicks=state.ticks.slice(-40).map(t=>({at:t.at,price:t.price,xau:t.xau,dollar:t.dollar}));
  const chartPrices=state.prices.slice(-60).filter(Number.isFinite);
  const first=chartPrices[0]||null, last=chartPrices.at(-1)||null;
  const high=chartPrices.length?Math.max(...chartPrices):null, low=chartPrices.length?Math.min(...chartPrices):null;
  const chartChangePct=first&&last?(last/first-1)*100:null;
  const returns=[];
  for(let i=1;i<chartPrices.length;i++){ if(chartPrices[i-1]>0) returns.push((chartPrices[i]/chartPrices[i-1]-1)*100); }
  const volatilityPct=returns.length?Math.sqrt(returns.reduce((sum,x)=>sum+x*x,0)/returns.length):null;
  return {
    gold18IRR: state.iran?.priceIRR ?? null,
    xauUsd: state.global?.xauUsd ?? null,
    dollarIRR: state.dollar?.priceIRR ?? null,
    coins: state.coins ? {emami:state.coins.emami,bahar:state.coins.bahar,half:state.coins.half,quarter:state.coins.quarter,gram:state.coins.gram} : null,
    technical: {signal:a.signal,score:a.score,rsi:a.rsi,macd:a.macd,ema9:a.ema9,ema21:a.ema21,bollinger:a.bollinger},
    pressure: {buy:mp.buy,sell:mp.sell,label:mp.label,confidence:mp.confidence},
    chart: {points:chartPrices.length,first,last,high,low,changePct:chartChangePct,volatilityPct},
    recentChart: chartPrices,
    recentTicks
  };
}

function fetchWithTimeout(url, options={}, ms=35000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ms);
  return fetch(url,{...options,signal:controller.signal}).finally(()=>clearTimeout(timer));
}

async function callGapGPT(messages, options={}){
  const key=process.env.GAPGPT_API_KEY;
  if(!key) throw new Error("GAPGPT_API_KEY روی سرور تنظیم نشده است.");
  let lastErr=null;
  for(const model of AI_FALLBACK_MODELS){
    try{
      const r=await fetchWithTimeout(`${AI_BASE_URL}/chat/completions`,{method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model,messages,temperature:options.temperature??0.2,max_tokens:options.max_tokens??1200})},options.timeoutMs||40000);
      const data=await r.json().catch(()=>({}));
      if(!r.ok){ lastErr=new Error(data?.error?.message||data?.message||`GapGPT HTTP ${r.status}`); continue; }
      const text=data?.choices?.[0]?.message?.content||data?.choices?.[0]?.text||data?.output_text||data?.message?.content;
      if(!text){ lastErr=new Error("پاسخ متنی معتبر از GapGPT دریافت نشد."); continue; }
      return {text,model:data?.model||model,data};
    }catch(e){ lastErr=e; }
  }
  throw lastErr||new Error("ارتباط با سرویس AI برقرار نشد.");
}

app.get("/api/ai-health", (req,res)=>{
  res.set("Cache-Control","no-store");
  const configured=Boolean(process.env.GAPGPT_API_KEY);
  res.json({ok:true,provider:"GapGPT",configured,baseUrl:AI_BASE_URL,model:AI_MODEL});
});

app.post("/api/ai-diagnostic", async (req,res)=>{
  const key=process.env.GAPGPT_API_KEY;
  if(!key) return res.status(503).json({ok:false,configured:false,error:"کلید GapGPT در Environment Variables سرور تنظیم نشده است."});
  try{
    const out=await callGapGPT([{role:"system",content:"تو تست اتصال Gold Alert Pro هستی."},{role:"user",content:"فقط بنویس: اتصال AI برقرار است."}],{temperature:0,max_tokens:60,timeoutMs:20000});
    res.json({ok:true,configured:true,provider:"GapGPT",model:out.model,text:out.text,baseUrl:AI_BASE_URL});
  }catch(e){res.status(502).json({ok:false,configured:true,provider:"GapGPT",baseUrl:AI_BASE_URL,modelsTried:AI_FALLBACK_MODELS,error:e.message});}
});

app.post("/api/ai-professional", async (req,res)=>{
  if(!(await requireFeature(req,'ai',req.body?.deviceId))) return res.status(403).json({error:"دسترسی تحلیل حرفه‌ای AI برای این حساب فعال نیست."});
  const ip=req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  if(!aiAllowed(ip)) return res.status(429).json({error:"تعداد درخواست‌های AI زیاد است. کمی بعد دوباره امتحان کن."});
  const key=process.env.GAPGPT_API_KEY;
  if(!key) return res.status(503).json({error:"کلید GapGPT روی سرور تنظیم نشده است."});
  const context=buildAIContext();
  let account=null;
  try{account=await accountFromReq(req);}catch{}
  const deviceId=cleanDeviceId(req.body?.deviceId);
  const portfolio=await getDevicePortfolio(deviceId).catch(()=>[]);
  const profile=await profileFor(deviceId).catch(()=>({}));
  const settings=await readJsonFile(USER_SETTINGS_FILE,{});
  const personal=settings?.[account?.id||deviceId]||{};
  const userQuestion=String(req.body?.question||'').slice(0,1200);
  const payload={market:context,portfolio:portfolio.slice(0,100),profile,investorProfile:personal.investorProfile||{},question:userQuestion};
  const prompt=`تو موتور تحلیل حرفه‌ای Gold Alert Pro هستی. فقط از داده‌های ارائه‌شده استفاده کن و اگر داده ناقص است صریح بگو. تحلیل را به فارسی، دقیق و قابل فهم ارائه بده. هیچ تضمین سود، پیش‌بینی قطعی یا دستور قطعی خرید/فروش نده. تفاوت «داده»، «محاسبه» و «سناریو» را روشن نگه دار.\n\nداده کاربر و بازار:\n${JSON.stringify(payload,null,2)}\n\nخروجی را با این تیترها بده:\n1) خلاصه مدیریتی\n2) وضعیت بازار و تکنیکال\n3) تحلیل سبد شخصی\n4) سه سناریو: صعودی، پایه، نزولی؛ برای هرکدام محرک‌ها و ریسک‌ها\n5) سطوح و اعداد قابل مشاهده (فقط اگر از داده قابل استخراج است)\n6) نکات مدیریت ریسک\n7) کیفیت داده و مواردی که باید تأیید شوند\nاگر سؤال کاربر وجود دارد، در پایان مستقیم به آن پاسخ بده.`;
  try{
    const r=await fetchWithTimeout(`${AI_BASE_URL}/chat/completions`,{method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:AI_MODEL,messages:[{role:"system",content:"تو تحلیلگر حرفه‌ای فارسی‌زبان طلا هستی. محتاط، داده‌محور و شفاف باش. تصمیم را به کاربر تحمیل نکن."},{role:"user",content:prompt}],temperature:0.15,max_tokens:1400})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data?.error?.message||data?.message||`GapGPT HTTP ${r.status}`);
    const text=data?.choices?.[0]?.message?.content||data?.choices?.[0]?.text||data?.output_text||data?.message?.content;
    if(!text) throw new Error("پاسخ معتبری دریافت نشد.");
    res.json({ok:true,provider:"GapGPT",model:data?.model||AI_MODEL,text,at:new Date().toISOString(),dataAt:state.updatedAt,portfolioItems:portfolio.length});
  }catch(e){console.warn("Professional AI error:",e.message);res.status(502).json({error:"تحلیل حرفه‌ای AI فعلاً در دسترس نیست: "+e.message});}
});

app.post("/api/ai-analysis", async (req,res)=>{
  res.set("Cache-Control","no-store");
  try {
    const context = buildAIContext();
    const result = await analyzeGold({
      ...context,
      userPrompt: req.body?.question || "تحلیل وضعیت فعلی بازار طلا"
    });
    return res.json({
      ok:true,
      provider: result.provider,
      text: typeof result.analysis === "string" ? result.analysis : JSON.stringify(result.analysis),
      at:new Date().toISOString(),
      dataAt:state.updatedAt || null
    });
  } catch (e) {
    return res.status(502).json({
      ok:false,
      error:"AI analysis failed",
      detail:String(e.message || e)
    });
  }
});

app.get("/api/ai-health", async (req,res)=>{
  try {
    const {aiHealth}=await import("./ai/manager.js");
    res.json(await aiHealth());
  } catch(e) {
    res.status(500).json({ok:false,error:String(e.message||e)});
  }
});

app.post("/api/ai-test", async (req,res)=>{
  try {
    const {analyzeGold}=await import("./ai/manager.js");
    const r=await analyzeGold({price:"test",symbol:"XAU"});
    res.json({ok:true,provider:r.provider,response:r.analysis});
  } catch(e) {
    res.status(502).json({ok:false,error:String(e.message||e)});
  }
});

app.post("/api/update/apply", async (req,res)=>{try{const token=String(req.headers["x-account-token"]||req.body?.accountToken||"");const account=await publicAccount(token);if(!account) return res.status(401).json({error:"ابتدا وارد حساب شوید."});const m=await fetchUpdateManifest();if(!m.available)return res.json({ok:true,updated:false,version:APP_VERSION,message:"نسخه جدیدی موجود نیست."});if(m.mandatory===false && req.body?.confirm!==true)return res.status(409).json({ok:false,needsConfirm:true,...m});const result=await applySelfUpdate(m);res.json(result);setTimeout(()=>process.exit(0),1200);}catch(e){res.status(500).json({ok:false,error:e.message});}});

app.get("/health", (_, res) => res.json({ ok: true, status: "running", uptime: Math.round(process.uptime()), updatedAt: state.updatedAt, error: state.error, dataReady: state.dataReady, subscriptions: subscriptionCount(), personalAlerts: state.personalAlerts.length, smsPremium: smsConfig(), ai: { provider: "GapGPT", configured: Boolean(process.env.GAPGPT_API_KEY), model: AI_MODEL, baseUrl: AI_BASE_URL } }));
app.get("/api/push/status", (_, res) => res.json({ configured: Boolean(getPublicVapidKey()), publicKey: getPublicVapidKey() ? "ready" : "missing", subscriptions: subscriptionCount() }));
app.get("/api/push/public-key", (_, res) => res.json({ publicKey: getPublicVapidKey() }));
app.post("/api/push/reset-device", async (req, res) => { try { const deviceId = cleanDeviceId(req.body?.deviceId); if (!deviceId) return res.status(400).json({ ok:false, error:"deviceId required" }); const removed = await removeDeviceSubscriptions(deviceId); res.json({ ok:true, removed }); } catch (e) { res.status(400).json({ ok:false, error:e.message }); } });
app.post("/api/push/subscribe", async (req, res) => { try { await addSubscription({ ...req.body, deviceId: cleanDeviceId(req.body?.deviceId) }); res.json({ ok: true }); } catch (e) { res.status(400).json({ ok: false, error: e.message }); } });
app.get("/api/price-alerts", async (req, res) => {
  const deviceId = cleanDeviceId(req.query.deviceId);
  if (!deviceId) return res.status(400).json({ error: "deviceId required" });
  const list = state.personalAlerts.filter(a => a.deviceId === deviceId).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json({ ok: true, alerts: list });
});
app.post("/api/price-alerts", async (req, res) => {
  const deviceId = cleanDeviceId(req.body?.deviceId);
  const price = Number(req.body?.price);
  const direction = req.body?.direction === "below" ? "below" : "above";
  const label = String(req.body?.label || "طلای ۱۸ عیار").slice(0, 80);
  if (!deviceId || !Number.isFinite(price) || price <= 0) return res.status(400).json({ error: "داده هشدار نامعتبر است." });
  const mine = state.personalAlerts.filter(a => a.deviceId === deviceId && !a.triggeredAt);
  if (mine.length >= 10) return res.status(429).json({ error: "حداکثر ۱۰ هشدار فعال برای هر دستگاه مجاز است." });
  const alert = cleanAlert({ id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`, deviceId, direction, price, label });
  state.personalAlerts.unshift(alert); state.personalAlerts = state.personalAlerts.slice(0, 1000); schedulePersonalAlertSave();
  res.json({ ok: true, alert });
});
app.delete("/api/price-alerts/:id", async (req, res) => {
  const deviceId = cleanDeviceId(req.query.deviceId);
  const id = String(req.params.id || "");
  const before = state.personalAlerts.length;
  state.personalAlerts = state.personalAlerts.filter(a => !(a.deviceId === deviceId && String(a.id) === id));
  if (state.personalAlerts.length !== before) schedulePersonalAlertSave();
  res.json({ ok: true, removed: before !== state.personalAlerts.length });
});
app.post("/api/push/unsubscribe", async (req, res) => { await removeSubscription(req.body?.endpoint); res.json({ ok: true }); });
app.get("/api/portfolio", async (req,res)=>{
  try { const deviceId=cleanDeviceId(req.query.deviceId); if(!deviceId) return res.status(400).json({error:"deviceId required"}); const items=await getDevicePortfolio(deviceId); res.json({ok:true,items,snapshot:buildPortfolioSnapshot(items),market:state.marketPressure||null,analysis:state.analysis||null}); }
  catch(e){res.status(500).json({error:e.message});}
});
app.get("/api/portfolio-risk", async (req,res)=>{
  try {
    const deviceId=cleanDeviceId(req.query.deviceId); if(!deviceId) return res.status(400).json({error:"deviceId required"});
    const items=await getDevicePortfolio(deviceId);
    const snap=buildPortfolioSnapshot(items);
    res.set("Cache-Control","no-store");
    res.json({ok:true,hasPortfolio:items.length>0,risk:portfolioRiskSnapshot(),snapshot:snap});
  } catch(e){res.status(500).json({error:e.message});}
});
app.post("/api/portfolio", async (req,res)=>{
  try { const deviceId=cleanDeviceId(req.body?.deviceId); if(!deviceId) return res.status(400).json({error:"deviceId required"}); const item=cleanPortfolioItem(req.body); if(!Number.isFinite(item.weight)||item.weight<=0||!Number.isFinite(item.buyPrice)||item.buyPrice<=0) return res.status(400).json({error:"وزن و قیمت خرید معتبر نیست."}); const items=await getDevicePortfolio(deviceId); items.unshift(item); const saved=await setDevicePortfolio(deviceId,items); res.json({ok:true,item,saved,snapshot:buildPortfolioSnapshot(saved)}); }
  catch(e){res.status(400).json({error:e.message});}
});
app.put("/api/portfolio/:id", async (req,res)=>{
  try { const deviceId=cleanDeviceId(req.body?.deviceId || req.query.deviceId); const id=String(req.params.id||""); if(!deviceId||!id) return res.status(400).json({error:"deviceId و id الزامی است"}); const items=await getDevicePortfolio(deviceId); const i=items.findIndex(x=>x.id===id); if(i<0) return res.status(404).json({error:"دارایی پیدا نشد"}); const next=cleanPortfolioItem({...items[i],...req.body,id,createdAt:items[i].createdAt}); if(!Number.isFinite(next.weight)||next.weight<=0||!Number.isFinite(next.buyPrice)||next.buyPrice<=0) return res.status(400).json({error:"وزن و قیمت خرید معتبر نیست."}); items[i]=next; const saved=await setDevicePortfolio(deviceId,items); res.json({ok:true,item:next,saved,snapshot:buildPortfolioSnapshot(saved)}); }
  catch(e){res.status(400).json({error:e.message});}
});
app.delete("/api/portfolio/:id", async (req,res)=>{
  try { const deviceId=cleanDeviceId(req.query.deviceId); const id=String(req.params.id||""); const items=await getDevicePortfolio(deviceId); const saved=await setDevicePortfolio(deviceId,items.filter(x=>x.id!==id)); res.json({ok:true,removed:saved.length!==items.length,saved,snapshot:buildPortfolioSnapshot(saved)}); }
  catch(e){res.status(400).json({error:e.message});}
});

app.post("/api/portfolio-analysis", async (req,res)=>{
  const ip=req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  if(!aiAllowed(ip)) return res.status(429).json({error:"تعداد درخواست‌های تحلیل هوشمند زیاد است. کمی بعد دوباره امتحان کن."});
  if(!process.env.GAPGPT_API_KEY) return res.status(503).json({error:"کلید GapGPT روی سرور تنظیم نشده است."});
  try {
    const deviceId=cleanDeviceId(req.body?.deviceId); if(!deviceId) return res.status(400).json({error:"deviceId required"});
    const items=await getDevicePortfolio(deviceId); if(!items.length) return res.status(400).json({error:"اول حداقل یک دارایی ثبت کن."});
    const snap=buildPortfolioSnapshot(items); const ctx=buildAIContext();
    const prompt=`برای این دارنده طلای فیزیکی، فقط بر اساس داده‌های واقعی زیر یک برنامه محتاطانه مدیریت دارایی بده. «بهترین زمان فروش» را به‌صورت ناحیه/شرط بیان کن، نه وعده قطعی. اگر حجم واقعی معاملات در داده‌ها نیست، صریح بگو و از «فشار خرید/فروش» به عنوان پروکسی استفاده کن. خروجی فارسی و کوتاه باشد و دقیقاً این ساختار را رعایت کن:\n1) وضعیت دارایی\n2) زمان مناسب فروش: شرط یا محدوده قابل پایش\n3) پیشنهاد نگهداری: X٪ یا X گرم\n4) پیشنهاد کاهش/فروش: X٪ یا X گرم\n5) پیشنهاد خرید: X٪ یا X گرم (اگر داده کافی نیست صفر/صبر)\n6) دلیل: روند، RSI/MACD/EMA، فشار بازار، اونس و دلار\n7) ریسک و شرط بازبینی\nهیچ سود قطعی، تضمین یا قطعیت نده. تصمیم نهایی با کاربر است.\n\nدارایی:\n${JSON.stringify(snap,null,2)}\n\nبازار:\n${JSON.stringify(ctx,null,2)}`;
    const r=await fetchWithTimeout(`${AI_BASE_URL}/chat/completions`,{method:"POST",headers:{"Authorization":`Bearer ${process.env.GAPGPT_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:AI_MODEL,messages:[{role:"system",content:"تو دستیار مدیریت ریسک و دارایی طلا هستی. فقط از داده‌های داده‌شده استفاده کن، محافظه‌کار و شفاف باش و هرگز سود یا زمان قطعی بازار را تضمین نکن."},{role:"user",content:prompt}],temperature:0.15,max_tokens:900})});
    let data=await r.json().catch(()=>({})); if(!r.ok) throw new Error(data?.error?.message||data?.message||`GapGPT HTTP ${r.status}`);
    const text=data?.choices?.[0]?.message?.content||data?.choices?.[0]?.text||data?.output_text||data?.message?.content; if(!text) throw new Error("پاسخ معتبری دریافت نشد.");
    res.json({ok:true,text,model:data?.model||AI_MODEL,at:new Date().toISOString(),dataAt:state.updatedAt,snapshot:snap});
  } catch(e){ console.warn("Portfolio AI error:",e.message); res.status(502).json({error:"تحلیل دارایی فعلاً در دسترس نیست: "+e.message}); }
});


app.get("/api/portfolio-scenario", async (req,res)=>{ try { const deviceId=cleanDeviceId(req.query.deviceId); const pct=Number(req.query.pct); if(!deviceId||!Number.isFinite(pct)||pct<-50||pct>50) return res.status(400).json({error:"پارامتر سناریو نامعتبر است."}); const items=await getDevicePortfolio(deviceId); res.json({ok:true,...portfolioScenario(items,pct)}); } catch(e){res.status(400).json({error:e.message});} });
app.get("/api/portfolio-allocation", async (req,res)=>{ try { const items=await getDevicePortfolio(req.query.deviceId); res.json({ok:true,...buildPortfolioAllocation(items)}); } catch(e){res.status(400).json({error:e.message});} });
app.get("/api/portfolio-report", async (req,res)=>{ try { const items=await getDevicePortfolio(req.query.deviceId); const report=monthlyReport(items); const h=await getHistory(); if(Array.isArray(h)&&h.length){ const prices=h.map(x=>Number(x.priceIRR ?? x.price ?? x.iran)).filter(Number.isFinite).slice(-4320); if(prices.length){ const start=prices[0],current=prices.at(-1); report.period='حدود ۳۰ روز / آخرین داده‌های موجود'; report.market={startPrice:start,currentPrice:current,high:Math.max(...prices),low:Math.min(...prices),changePct:start?(current/start-1)*100:0}; } } res.json({ok:true,...report}); } catch(e){res.status(400).json({error:e.message});} });
app.get("/api/export", async (req,res)=>{ try { const deviceId=cleanDeviceId(req.query.deviceId); const portfolio=await getDevicePortfolio(deviceId); const alerts=state.personalAlerts.filter(a=>a.deviceId===deviceId); const profile=await profileFor(deviceId); res.setHeader('Content-Disposition','attachment; filename="gold-alert-pro-backup.json"'); res.json({version:APP_VERSION,exportedAt:new Date().toISOString(),profile,portfolio,alerts}); } catch(e){res.status(400).json({error:e.message});} });
app.get("/api/profile", async (req,res)=>{ try { res.json({ok:true,profile:await profileFor(req.query.deviceId)}); } catch(e){res.status(400).json({error:e.message});} });
app.put("/api/profile", async (req,res)=>{ try { const p={name:String(req.body?.name||'').slice(0,80),phone:normalizePhone(req.body?.phone).slice(0,20),city:String(req.body?.city||'').slice(0,80)}; res.json({ok:true,profile:await saveProfile(req.body?.deviceId,p)}); } catch(e){res.status(400).json({error:e.message});} });
app.get("/api/user-settings", async (req,res)=>{
  const a=await accountFromReq(req); if(!a)return res.status(401).json({error:"ابتدا وارد حساب شوید."});
  const all=await readJsonFile(USER_SETTINGS_FILE,{}); const key=a.id; const value=all[key]||{investorProfile:{risk:"medium",goal:"حفظ ارزش",horizon:"medium",notes:""},storageLocations:[],householdPortfolios:[],devices:[]};
  res.json({ok:true,settings:value});
});
app.put("/api/user-settings", async (req,res)=>{
  const a=await accountFromReq(req); if(!a)return res.status(401).json({error:"ابتدا وارد حساب شوید."});
  const all=await readJsonFile(USER_SETTINGS_FILE,{}); const old=all[a.id]||{}; const body=req.body||{};
  const investorProfile={risk:["low","medium","high"].includes(String(body.investorProfile?.risk))?String(body.investorProfile.risk):old.investorProfile?.risk||"medium",goal:String(body.investorProfile?.goal||old.investorProfile?.goal||"حفظ ارزش").slice(0,120),horizon:String(body.investorProfile?.horizon||old.investorProfile?.horizon||"medium").slice(0,40),notes:String(body.investorProfile?.notes||old.investorProfile?.notes||"").slice(0,500)};
  const storageLocations=Array.isArray(body.storageLocations)?body.storageLocations.slice(0,30).map(x=>({id:String(x.id||crypto.randomUUID()),name:String(x.name||"").slice(0,80),note:String(x.note||"").slice(0,200)})).filter(x=>x.name):old.storageLocations||[];
  const householdPortfolios=Array.isArray(body.householdPortfolios)?body.householdPortfolios.slice(0,20).map(x=>({id:String(x.id||crypto.randomUUID()),name:String(x.name||"").slice(0,80),owner:String(x.owner||"").slice(0,80)})).filter(x=>x.name):old.householdPortfolios||[];
  all[a.id]={investorProfile,storageLocations,householdPortfolios,updatedAt:new Date().toISOString()}; await writeJsonFile(USER_SETTINGS_FILE,all); res.json({ok:true,settings:all[a.id]});
});

app.get("/api/notifications", async (req,res)=>{ const a=await accountFromReq(req); if(!a)return res.status(401).json({error:'ابتدا وارد حساب شوید.'}); const all=await readJsonFile(NOTIFICATIONS_FILE,[]); res.json({ok:true,notifications:all.filter(x=>x.userId===a.id).slice(0,100)}); });
app.post("/api/notifications/:id/read", async (req,res)=>{ const a=await accountFromReq(req); if(!a)return res.status(401).json({error:'ابتدا وارد حساب شوید.'}); const all=await readJsonFile(NOTIFICATIONS_FILE,[]),n=all.find(x=>x.id===req.params.id&&x.userId===a.id); if(n)n.read=true; await writeJsonFile(NOTIFICATIONS_FILE,all); res.json({ok:true}); });
app.post("/api/account/change-password", async (req,res)=>{ const a=await accountFromReq(req); if(!a)return res.status(401).json({error:'ابتدا وارد حساب شوید.'}); const old=String(req.body?.oldPassword||''),next=String(req.body?.newPassword||''); if(next.length<6)return res.status(400).json({error:'رمز جدید حداقل ۶ کاراکتر باشد.'}); if(!verifyPassword(old,a.salt,a.hash))return res.status(403).json({error:'رمز فعلی صحیح نیست.'}); const store=await readJsonFile(ACCOUNTS_FILE,{}),key=Object.keys(store).find(k=>store[k]===a); Object.assign(a,hashPassword(next)); a.token=''; store[key]=a; await writeJsonFile(ACCOUNTS_FILE,store); await audit('user_password_changed',{userId:a.id}); res.json({ok:true,message:'رمز تغییر کرد؛ دوباره وارد شوید.'}); });
app.post("/api/account/register", async (req,res)=>{ try { if(String(process.env.SELF_REGISTER_ENABLED||'true').toLowerCase()==='false') return res.status(403).json({error:'ثبت‌نام عمومی غیرفعال است؛ با مدیریت تماس بگیرید.'}); const phone=normalizePhone(req.body?.phone||req.body?.username); const username=phone; const password=String(req.body?.password||''); const deviceId=cleanDeviceId(req.body?.deviceId); if(!/^09\d{9}$/.test(phone)||password.length<6||!deviceId) return res.status(400).json({error:'شماره موبایل معتبر و رمز عبور حداقل ۶ کاراکتری لازم است.'}); const store=await readJsonFile(ACCOUNTS_FILE,{}); if(Object.values(store).some(x=>String(x.username||'').toLowerCase()===username || normalizePhone(x.phone)===phone)) return res.status(409).json({error:'این شماره موبایل قبلاً ثبت شده است.'}); const hp=hashPassword(password); const account={id:crypto.randomUUID(),username,phone,...hp,token:crypto.randomBytes(32).toString('hex'),createdAt:new Date().toISOString(),deviceId,role:'user',permissions:['dashboard','market','portfolio','alerts','account'],active:true}; store[account.id]=account; await writeJsonFile(ACCOUNTS_FILE,store); res.json({ok:true,token:account.token,username,user:userView(account)}); } catch(e){res.status(500).json({error:e.message});} });
app.post("/api/account/forgot-password", async (req,res)=>{
  try {
    const email=String(req.body?.email||'').trim().toLowerCase();
    if(!email) return res.status(400).json({error:'ایمیل الزامی است.'});
    // Reset infrastructure placeholder: enable SMTP in production and connect here.
    // The endpoint prevents user enumeration and keeps the response safe.
    return res.json({ok:true,message:'اگر این ایمیل ثبت شده باشد، لینک بازیابی رمز ارسال خواهد شد.'});
  } catch(e){res.status(500).json({error:e.message});}
});
app.post("/api/account/login", async (req,res)=>{ try { const username=normalizePhone(req.body?.username||req.body?.phone); const password=String(req.body?.password||''); const attemptKey=`user:${req.ip}:${username}`; if(!loginAllowed(attemptKey)) return res.status(429).json({error:'تلاش‌های ورود زیاد است؛ چند دقیقه بعد دوباره امتحان کنید.'}); const store=await readJsonFile(ACCOUNTS_FILE,{}); const a=Object.values(store).find(x=>normalizePhone(x.phone)===username || String(x.username||'').toLowerCase()===username.toLowerCase()) || store[username]; if(!a||!verifyPassword(password,a.salt,a.hash)) return res.status(401).json({error:'نام کاربری یا رمز عبور اشتباه است.'}); if(!userIsActive(a)) return res.status(403).json({error:'دسترسی این حساب غیرفعال یا منقضی شده است.'}); clearLoginAttempts(attemptKey); a.token=crypto.randomBytes(32).toString('hex'); a.tokenExpiresAt=new Date(Date.now()+USER_SESSION_HOURS*3600000).toISOString(); a.lastLoginAt=new Date().toISOString(); if(req.body?.deviceId)a.deviceId=cleanDeviceId(req.body.deviceId); if(!a.role)a.role='user'; if(!Array.isArray(a.permissions))a.permissions=['dashboard','market','portfolio','alerts','account']; const key=Object.keys(store).find(k=>store[k]===a); store[key]=a; await writeJsonFile(ACCOUNTS_FILE,store); await audit('user_login',{userId:a.id}); res.json({ok:true,token:a.token,expiresAt:a.tokenExpiresAt,username:a.username||username,user:userView(a)}); } catch(e){res.status(500).json({error:e.message});} });
app.get("/api/account/me", async (req,res)=>{ const a=await accountFromReq(req); if(!a||!userIsActive(a)) return res.status(401).json({error:'حساب معتبر نیست.'}); res.json({ok:true,user:userView(a)}); });
app.post("/api/account/logout", async (req,res)=>{ try { const a=await accountByToken(req.body?.token); if(a){ const store=await readJsonFile(ACCOUNTS_FILE,{}); const key=Object.keys(store).find(k=>store[k]===a); if(key) store[key].token=''; await writeJsonFile(ACCOUNTS_FILE,store); } res.json({ok:true}); } catch(e){res.status(500).json({error:e.message});} });
app.post("/api/account/sync", async (req,res)=>{ try { const a=await accountByToken(req.body?.token); const deviceId=cleanDeviceId(req.body?.deviceId); if(!a||!deviceId) return res.status(401).json({error:'ابتدا وارد حساب شوید.'}); const portfolio=await getDevicePortfolio(deviceId); const store=await readJsonFile(ACCOUNTS_FILE,{}); const key=Object.keys(store).find(k=>store[k]===a); if(!key)return res.status(401).json({error:'حساب پیدا نشد.'}); store[key].cloudPortfolio=portfolio; store[key].cloudProfile=await profileFor(deviceId); store[key].syncedAt=new Date().toISOString(); await writeJsonFile(ACCOUNTS_FILE,store); res.json({ok:true,syncedAt:store[key].syncedAt,count:portfolio.length}); } catch(e){res.status(500).json({error:e.message});} });
app.post("/api/news-ai", async (req,res)=>{
  try { if(!(await requireFeature(req,'ai',req.body?.deviceId))) return res.status(403).json({error:'دسترسی تحلیل اخبار برای این حساب فعال نیست.'});
    const key=process.env.GAPGPT_API_KEY;
    if(!key) return res.status(503).json({error:"کلید GapGPT روی سرور تنظیم نشده است."});
    const news=await getNews();
    const prompt=`اخبار زیر را برای کاربر فارسی‌زبان خلاصه کن. برای هر خبر: موضوع، اثر احتمالی بر طلا، اهمیت. از ادعای قطعی درباره جهت قیمت خودداری کن و منبع/عنوان را حفظ کن.\n${JSON.stringify(news.slice(0,12))}`;
    const body={model:AI_MODEL,messages:[{role:"system",content:"خلاصه‌ساز محتاط اخبار بازار طلا هستی. فقط از اخبار داده‌شده استفاده کن."},{role:"user",content:prompt}],temperature:.2,max_tokens:900};
    const r=await fetchWithTimeout(`${AI_BASE_URL}/chat/completions`,{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d?.error?.message||`GapGPT HTTP ${r.status}`);
    const text=d?.choices?.[0]?.message?.content||d?.choices?.[0]?.text;
    if(!text) throw new Error("پاسخ خبری دریافت نشد.");
    res.json({ok:true,text,at:new Date().toISOString()});
  } catch(e){ res.status(502).json({error:e.message}); }
});

app.get("/api/plans", async (_, res) => { const commerce=await getCommerceSettings(); res.json({ plans: plans(), supportUrl: supportUrl(), currency: "IRR", smsPremium: {...smsConfig(),priceIRR:commerce.subscriptionPriceIRR,days:commerce.subscriptionDays} }); });
app.get("/api/commerce-settings", async (_,res)=>{ const c=await getCommerceSettings(); res.json({cardNumber:c.cardNumber,cardHolder:c.cardHolder,subscriptionPriceIRR:c.subscriptionPriceIRR,subscriptionDays:c.subscriptionDays,subscriptionLabel:c.subscriptionLabel}); });
app.get("/api/admin/commerce-settings", async (req,res)=>{ if(!(await adminAuth(req,res)))return res.status(403).json({error:"admin session invalid"}); res.json({ok:true,settings:await getCommerceSettings()}); });
app.put("/api/admin/commerce-settings", async (req,res)=>{ if(!(await adminAuth(req,res)))return res.status(403).json({error:"admin session invalid"}); try { const settings=await setCommerceSettings(req.body||{}); await audit("commerce_settings_updated",{subscriptionPriceIRR:settings.subscriptionPriceIRR,subscriptionDays:settings.subscriptionDays}); res.json({ok:true,settings}); } catch(e){res.status(400).json({ok:false,error:e.message});} });
app.get("/api/sms-premium/status", async (req, res) => { try { res.json(await getSmsStatus(req.query.deviceId)); } catch (e) { res.status(400).json({ error: e.message }); } });
app.post("/api/sms-premium/request", async (req, res) => { try { if(!(await requireFeature(req,'sms',req.body?.deviceId))) return res.status(403).json({error:"سرویس SMS برای این حساب فعال نیست."}); res.json({ ok: true, ...(await createPaymentRequest(req.body || {})) }); } catch (e) { res.status(400).json({ ok: false, error: e.message }); } });
app.post("/api/sms-premium/activate", async (req, res) => { try { if(!(await requireFeature(req,'sms',req.body?.deviceId))) return res.status(403).json({error:"سرویس SMS برای این حساب فعال نیست."}); res.json({ ok: true, ...(await activateWithCode(req.body || {})) }); } catch (e) { res.status(400).json({ ok: false, error: e.message }); } });

async function ticketStore(){ return await readJsonFile(TICKETS_FILE,[]); }
async function saveTickets(v){ await writeJsonFile(TICKETS_FILE,v); }
function ticketUser(req){ return accountFromReq(req); }
app.get("/api/tickets", async (req,res)=>{ try{const a=await ticketUser(req);if(!a)return res.status(401).json({error:'ابتدا وارد حساب شوید.'});const all=await ticketStore();const mine=all.filter(t=>t.userId===a.id).sort((x,y)=>String(y.updatedAt).localeCompare(String(x.updatedAt)));res.json({ok:true,tickets:mine});}catch(e){res.status(500).json({error:e.message});} });
app.post("/api/tickets", async (req,res)=>{ try{const a=await ticketUser(req);if(!a)return res.status(401).json({error:'ابتدا وارد حساب شوید.'});const subject=String(req.body?.subject||'').trim().slice(0,120),message=String(req.body?.message||'').trim().slice(0,4000);if(!subject||!message)return res.status(400).json({error:'موضوع و متن پیام الزامی است.'});const now=new Date().toISOString(),all=await ticketStore();const t={id:crypto.randomUUID(),userId:a.id,username:a.username||a.phone,subject,message,status:'open',createdAt:now,updatedAt:now,messages:[{from:'user',message,at:now}]};all.push(t);await saveTickets(all);await audit('ticket_created',{ticketId:t.id,userId:a.id});res.json({ok:true,ticket:t});}catch(e){res.status(500).json({error:e.message});} });
app.post("/api/tickets/:id/reply", async (req,res)=>{ try{const a=await ticketUser(req);if(!a)return res.status(401).json({error:'ابتدا وارد حساب شوید.'});const msg=String(req.body?.message||'').trim().slice(0,4000);if(!msg)return res.status(400).json({error:'متن پاسخ الزامی است.'});const all=await ticketStore(),t=all.find(x=>x.id===req.params.id&&x.userId===a.id);if(!t)return res.status(404).json({error:'تیکت پیدا نشد.'});const now=new Date().toISOString();t.messages=t.messages||[];t.messages.push({from:'user',message:msg,at:now});t.status='open';t.updatedAt=now;await saveTickets(all);res.json({ok:true,ticket:t});}catch(e){res.status(500).json({error:e.message});} });
app.get("/api/admin/tickets", async (req,res)=>{ if(!(await adminAuth(req,res)))return res.status(403).json({error:'admin session invalid'});const all=await ticketStore();const users=await listUsers();const byId=new Map(users.map(u=>[u.id,u]));res.json({ok:true,tickets:all.sort((x,y)=>String(y.updatedAt).localeCompare(String(x.updatedAt))).map(t=>({...t,user:byId.get(t.userId)||{username:t.username}}))}); });
app.post("/api/admin/tickets/:id/reply", async (req,res)=>{ if(!(await adminAuth(req,res)))return res.status(403).json({error:'admin session invalid'});try{const msg=String(req.body?.message||'').trim().slice(0,4000);if(!msg)return res.status(400).json({error:'متن پاسخ الزامی است.'});const all=await ticketStore(),t=all.find(x=>x.id===req.params.id);if(!t)return res.status(404).json({error:'تیکت پیدا نشد.'});const now=new Date().toISOString();t.messages=t.messages||[];t.messages.push({from:'admin',message:msg,at:now});t.status='answered';t.updatedAt=now;await saveTickets(all);await addNotification(t.userId,'پاسخ پشتیبانی',`برای تیکت «${t.subject}» پاسخ جدید دارید.`,'ticket');await audit('ticket_reply',{ticketId:t.id});res.json({ok:true,ticket:t});}catch(e){res.status(500).json({error:e.message});} });
app.put("/api/admin/tickets/:id", async (req,res)=>{ if(!(await adminAuth(req,res)))return res.status(403).json({error:'admin session invalid'});try{const all=await ticketStore(),t=all.find(x=>x.id===req.params.id);if(!t)return res.status(404).json({error:'تیکت پیدا نشد.'});const status=String(req.body?.status||'').trim();if(!['open','pending','answered','closed'].includes(status))return res.status(400).json({error:'وضعیت نامعتبر است.'});t.status=status;t.updatedAt=new Date().toISOString();await saveTickets(all);res.json({ok:true,ticket:t});}catch(e){res.status(500).json({error:e.message});} });
app.get("/api/admin/sms-premium/requests", async (req, res) => { if (!(await adminAuth(req,res)) && !validAdminKey(req.headers["x-admin-key"])) return res.status(403).json({ error: "admin session invalid" }); res.json({ ok: true, requests: await getSmsAdminRequests() }); });
app.post("/api/admin/sms-premium/issue-code", async (req, res) => { if (!(await adminAuth(req,res)) && !validAdminKey(req.headers["x-admin-key"])) return res.status(403).json({ error: "admin session invalid" }); try { const out = await issueActivationCode(req.body || {}); res.json({ ok: true, ...out }); } catch (e) { res.status(400).json({ ok: false, error: e.message }); } });
app.get("/api/subscription", async (req, res) => { try { res.json(await getSubscription(req.query.deviceId)); } catch (e) { res.status(400).json({ error: e.message }); } });
app.post("/api/checkout", async (req, res) => { const url = paymentUrl(req.body?.planId, req.body?.deviceId); if (!url) return res.status(503).json({ error: "درگاه پرداخت هنوز در تنظیمات سرور فعال نشده است." }); res.json({ ok: true, url }); });
app.post("/api/admin/activate", async (req, res) => { if (!(await adminAuth(req,res)) && !validAdminKey(req.headers["x-admin-key"])) return res.status(403).json({ error: "admin session invalid" }); try { res.json({ ok: true, subscription: await activateSubscription(req.body || {}) }); } catch (e) { res.status(400).json({ error: e.message }); } });
// Commercial administration: user lifecycle, roles, permissions and access control.
function adminAuth(req,res){ const token=String(req.headers["x-admin-session"]||req.body?.adminSession||req.query?.adminSession||""); return requireAdminToken(token); }

app.get("/api/theme", async (req,res)=>{res.json(await getTheme());});
app.get("/api/admin/theme", async (req,res)=>{if(!(await adminAuth(req,res)))return;res.json(await getTheme());});
app.put("/api/admin/theme", async (req,res)=>{if(!(await adminAuth(req,res)))return;try{res.json({ok:true,theme:await setTheme(req.body?.theme)});}catch(e){res.status(400).json({error:e.message});}});
app.post("/api/admin/login", async (req,res)=>{ try{ const out=await adminLogin(req.body?.username,req.body?.password); res.json({ok:true,...out}); }catch(e){res.status(403).json({error:e.message});} });
app.post("/api/admin/logout", async (req,res)=>{ await adminLogout(req.headers["x-admin-session"]||req.body?.adminSession); res.json({ok:true}); });
app.get("/api/admin/stats", async (req,res)=>{ if(!(await adminAuth(req,res)))return res.status(403).json({error:"admin session invalid"}); res.json({ok:true,...await adminStats()}); });
app.get("/api/admin/overview", async (req,res)=>{
  if(!(await adminAuth(req,res)))return res.status(403).json({error:"admin session invalid"});
  const users=await listUsers(); const tickets=await ticketStore(); const payments=await readJsonFile(PAYMENTS_FILE,[]); const auditLog=await readJsonFile(AUDIT_FILE,[]);
  res.json({ok:true,version:APP_VERSION,users:users.length,active:users.filter(x=>x.active).length,expired:users.filter(x=>x.expiresAt&&Date.parse(x.expiresAt)<Date.now()).length,pro:users.filter(x=>x.role==='pro').length,premium:users.filter(x=>x.role==='premium').length,openTickets:tickets.filter(x=>x.status==='open'||x.status==='pending').length,payments:payments.length,auditEvents:auditLog.length,aiConfigured:Boolean(process.env.GAPGPT_API_KEY),smsConfigured:Boolean(process.env.IPPANEL_API_KEY&&process.env.IPPANEL_FROM),uptime:Math.round(process.uptime()),generatedAt:new Date().toISOString()});
});

app.get("/api/admin/business-dashboard", async (req,res)=>{
  if(!(await adminAuth(req,res)))return res.status(403).json({error:"admin session invalid"});
  const users=await listUsers();
  const payments=await readJsonFile(PAYMENTS_FILE,[]);
  const tickets=await ticketStore();
  const now=Date.now(), day=86400000, monthStart=new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const confirmed=payments.filter(p=>String(p.status||'confirmed').toLowerCase()==='confirmed' && Number(p.amount)>0);
  const totalRevenue=confirmed.reduce((s,p)=>s+Number(p.amount||0),0);
  const monthRevenue=confirmed.filter(p=>Date.parse(p.at||0)>=monthStart.getTime()).reduce((s,p)=>s+Number(p.amount||0),0);
  const last7Revenue=confirmed.filter(p=>Date.parse(p.at||0)>=now-7*day).reduce((s,p)=>s+Number(p.amount||0),0);
  const expiring7=users.filter(u=>u.expiresAt&&Date.parse(u.expiresAt)>=now&&Date.parse(u.expiresAt)<=now+7*day).length;
  const new7=users.filter(u=>Date.parse(u.createdAt||0)>=now-7*day).length;
  const new30=users.filter(u=>Date.parse(u.createdAt||0)>=now-30*day).length;
  const active=users.filter(u=>u.active&&(!u.expiresAt||Date.parse(u.expiresAt)>=now)).length;
  const daily=Array.from({length:7},(_,i)=>{const d=new Date(now-(6-i)*day);const key=d.toISOString().slice(0,10);return {date:key,users:users.filter(u=>String(u.createdAt||'').slice(0,10)===key).length,revenue:confirmed.filter(p=>String(p.at||'').slice(0,10)===key).reduce((s,p)=>s+Number(p.amount||0),0)};});
  res.json({ok:true,currency:"IRR",users:{total:users.length,active,pro:users.filter(u=>u.role==='pro').length,premium:users.filter(u=>u.role==='premium').length,new7,new30,expiring7},revenue:{total:totalRevenue,month:monthRevenue,last7:last7Revenue,confirmedCount:confirmed.length,average:confirmed.length?Math.round(totalRevenue/confirmed.length):0},support:{open:tickets.filter(t=>['open','pending'].includes(t.status)).length,answered:tickets.filter(t=>t.status==='answered').length,total:tickets.length},daily,generatedAt:new Date().toISOString()});
});
app.get("/api/admin/features", async (req,res)=>{ if(!(await adminAuth(req,res)))return res.status(403).json({error:"admin session invalid"}); res.json({ok:true,features:FEATURE_KEYS,roles:{user:['dashboard','market','portfolio','alerts','account'],pro:PRO_PERMISSIONS,premium:PREMIUM_PERMISSIONS,admin:FEATURE_KEYS}}); });
app.get("/api/admin/users", async (req,res)=>{ if(!(await adminAuth(req,res)))return res.status(403).json({error:"admin session invalid"}); res.json({ok:true,users:await listUsers()}); });
app.post("/api/admin/users", async (req,res)=>{ if(!(await adminAuth(req,res)))return res.status(403).json({error:"admin session invalid"}); try{res.json({ok:true,...await createManagedUser(req.body||{})});}catch(e){res.status(400).json({error:e.message});} });
app.put("/api/admin/users/:identifier", async (req,res)=>{ if(!(await adminAuth(req,res)))return res.status(403).json({error:"admin session invalid"}); try{res.json({ok:true,user:await updateManagedUser(req.params.identifier,req.body||{})});}catch(e){res.status(400).json({error:e.message});} });
app.delete("/api/admin/users/:identifier", async (req,res)=>{ if(!(await adminAuth(req,res)))return res.status(403).json({error:"admin session invalid"}); try{await deleteManagedUser(req.params.identifier);res.json({ok:true});}catch(e){res.status(400).json({error:e.message});} });
app.post("/api/admin/broadcast", async (req,res)=>{ if(!(await adminAuth(req,res)))return res.status(403).json({error:'admin session invalid'}); const title=String(req.body?.title||'اطلاعیه مدیریت').trim(),message=String(req.body?.message||'').trim(); if(!message)return res.status(400).json({error:'متن پیام الزامی است.'}); const users=await listUsers(); for(const u of users.filter(x=>x.active)) await addNotification(u.id,title,message,'broadcast'); await audit('broadcast',{title,count:users.filter(x=>x.active).length}); res.json({ok:true,count:users.filter(x=>x.active).length}); });
app.get("/api/admin/audit", async (req,res)=>{ if(!(await adminAuth(req,res)))return res.status(403).json({error:'admin session invalid'}); res.json({ok:true,items:(await readJsonFile(AUDIT_FILE,[])).slice(0,200)}); });
app.get("/api/admin/payments", async (req,res)=>{ if(!(await adminAuth(req,res)))return res.status(403).json({error:'admin session invalid'}); res.json({ok:true,payments:await readJsonFile(PAYMENTS_FILE,[])}); });
app.post("/api/admin/payments", async (req,res)=>{ if(!(await adminAuth(req,res)))return res.status(403).json({error:'admin session invalid'}); const p={id:crypto.randomUUID(),username:String(req.body?.username||''),amount:Number(req.body?.amount||0),plan:String(req.body?.plan||''),status:String(req.body?.status||'confirmed'),reference:String(req.body?.reference||''),at:new Date().toISOString()}; const all=await readJsonFile(PAYMENTS_FILE,[]); all.unshift(p); await writeJsonFile(PAYMENTS_FILE,all.slice(0,2000)); await audit('payment_recorded',{id:p.id,username:p.username,amount:p.amount}); res.json({ok:true,payment:p}); });
app.get("/api/admin/backup", async (req,res)=>{ if(!(await adminAuth(req,res)))return res.status(403).json({error:'admin session invalid'}); const [accounts,tickets,profiles,portfolios,notifications,payments,auditLog]=await Promise.all([readJsonFile(ACCOUNTS_FILE,{}),ticketStore(),readJsonFile(PROFILES_FILE,{}),readJsonFile(PORTFOLIO_FILE,{}),readJsonFile(NOTIFICATIONS_FILE,[]),readJsonFile(PAYMENTS_FILE,[]),readJsonFile(AUDIT_FILE,[])]); res.json({ok:true,version:APP_VERSION,exportedAt:new Date().toISOString(),accounts,tickets,profiles,portfolios,notifications,payments,audit:auditLog}); });
app.get("/api/admin/economic-events", async (req,res)=>{ if(!(await adminAuth(req,res)))return res.status(403).json({error:"admin session invalid"}); res.json({ok:true,events:await economicEvents()}); });
app.put("/api/admin/economic-events", async (req,res)=>{ if(!(await adminAuth(req,res)))return res.status(403).json({error:"admin session invalid"}); try{const events=Array.isArray(req.body?.events)?req.body.events.slice(0,100):[];await writeJsonFile(ECONOMIC_EVENTS_FILE,events);res.json({ok:true,events});}catch(e){res.status(400).json({error:e.message});} });
app.get("/api/economic-calendar", async (_,res)=>{res.json({ok:true,events:await economicEvents(),liveSource:Boolean(process.env.ECONOMIC_EVENTS_JSON)});});
app.get("/api/market-outlook", async (_,res)=>{
  try {
    const rows=await getHistory();
    const closes=(Array.isArray(rows)?rows:[]).map(x=>Number(x.close)).filter(x=>Number.isFinite(x)&&x>0).slice(-180);
    const daily=[]; for(let i=1;i<closes.length;i++) daily.push((closes[i]/closes[i-1]-1)*100);
    if(daily.length<5) return res.status(503).json({ok:false,error:"برای برآورد آماری حداقل ۶ نقطه تاریخچه معتبر لازم است.",sampleSize:closes.length});
    const horizon=5, observations=[];
    for(let i=0;i<=daily.length-horizon;i++) { const segment=daily.slice(i,i+horizon); observations.push(segment.reduce((a,b)=>a+b,0)); }
    const up=observations.filter(x=>x>0).length, down=observations.filter(x=>x<0).length, flat=observations.length-up-down;
    const mean=daily.reduce((a,b)=>a+b,0)/daily.length;
    const variance=daily.reduce((a,b)=>a+(b-mean)**2,0)/Math.max(1,daily.length-1), sigma=Math.sqrt(variance);
    const current=closes.at(-1), bandPct=Math.min(25,1.96*sigma*Math.sqrt(horizon));
    res.set("Cache-Control","no-store");
    res.json({ok:true,method:"historical-frequency-and-volatility",horizonDays:horizon,sampleSize:closes.length,observations:observations.length,frequency:{upPct:up/observations.length*100,downPct:down/observations.length*100,flatPct:flat/observations.length*100},dailyMeanPct:mean,dailyVolatilityPct:sigma,illustrativeRange:{low:current*(1-bandPct/100),high:current*(1+bandPct/100),bandPct},current,asOf:rows.at(-1)?.date||null,warning:"این خروجی فراوانی و نوسان تاریخی است، نه احتمال تضمین‌شده یا پیش‌بینی قطعی آینده؛ کیفیت آن به تاریخچه منبع وابسته است."});
  } catch(e) { res.status(503).json({ok:false,error:"برآورد بازار فعلاً در دسترس نیست."}); }
});
app.get("/api/market-structure", (_,res)=>res.json({ok:true,...marketStructure(state.prices)}));
app.post("/api/ai-chat", async (req,res)=>{ try{ if(!(await requireFeature(req,'chat',req.body?.deviceId)))return res.status(403).json({error:'دسترسی AI Chat برای این حساب فعال نیست.'}); const key=process.env.GAPGPT_API_KEY;if(!key)return res.status(503).json({error:'کلید GapGPT تنظیم نشده است.'}); const q=String(req.body?.question||'').trim().slice(0,2000);if(!q)return res.status(400).json({error:'سؤال خالی است.'}); const ctx=buildAIContext(); const r=await fetchWithTimeout(`${AI_BASE_URL}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:AI_MODEL,messages:[{role:'system',content:'تو دستیار فارسی Gold Alert Pro هستی. پاسخ را بر اساس داده بازار ارائه کن، عدم قطعیت را روشن کن و از تضمین سود یا دستور قطعی خرید/فروش خودداری کن.'},{role:'user',content:`داده بازار فعلی:
${JSON.stringify(ctx)}

سؤال کاربر:
${q}`}],temperature:.2,max_tokens:900})}); const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||`GapGPT HTTP ${r.status}`);const text=d?.choices?.[0]?.message?.content||d?.choices?.[0]?.text;if(!text)throw new Error('پاسخ AI خالی است.');res.json({ok:true,text,at:new Date().toISOString()}); }catch(e){res.status(502).json({error:e.message});} });


app.post("/api/ai-assistant", async (req,res)=>{
  try {
    const a=state.analysis||{}, mp=state.marketPressure||{};
    const price=Number(state.iran?.priceIRR||0), source=state.iran?.source||null;
    const sourceAgeMs=state.engineStatus?.sourceAgeMs ?? null;
    const question=String(req.body?.question||'').trim().slice(0,1200);
    const page=String(req.body?.page||'dashboard').slice(0,40);
    const data={
      page, price, source, sourceAgeMs,
      engineStatus:state.engineStatus||null,
      trend:a.trendFa||a.signal||'نامشخص', signal:a.signal||'WAIT', score:Number(a.score||0),
      rsi:a.rsi??null, macd:a.macd??null, ema9:a.ema9??null, ema21:a.ema21??null,
      support:a.bollinger?.lower??null, resistance:a.bollinger?.upper??null,
      buyPressure:Number(mp.buy||0), sellPressure:Number(mp.sell||0),
      recentPrices:(state.prices||[]).slice(-30), xauUsd:state.global?.xauUsd??null,
      dollarIRR:state.dollar?.priceIRR??null, question
    };
    const ruleFallback=()=>{
      if(!price) return {greeting:'سلام 👋',summary:'فعلاً قیمت معتبر نداریم؛ برای تصمیم‌گیری صبر کن تا داده تازه برسد.',action:'صبر کن',why:'داده کافی نیست.',watch:'زمان آخرین قیمت و وضعیت منبع را چک کن.',alert:'قیمت معتبر بازار فعلاً در دسترس نیست.',tone:'neutral',confidence:20};
      const fresh=sourceAgeMs==null || sourceAgeMs<60000;
      const trend=data.trend;
      let action='فعلاً صبر و زیرنظر گرفتن بازار', tone='neutral';
      if(data.signal==='BUY' && data.score>=70){action='سناریوی خرید پله‌ای را بررسی کن، نه خرید یکجایی'; tone='positive';}
      else if(data.signal==='SELL' && data.score>=70){action='سناریوی کاهش ریسک یا فروش پله‌ای را بررسی کن'; tone='negative';}
      else if(data.signal==='WATCH_BUY'){action='فعلاً صبر کن و دنبال تأیید ادامه رشد باش'; tone='positive';}
      else if(data.signal==='WATCH_SELL'){action='فعلاً عجله نکن و دنبال تأیید ضعف باش'; tone='negative';}
      return {greeting:'سلام 👋',summary:`بازار فعلاً ${trend==='صعودی'?'کمی رو به بالاست':trend==='نزولی'?'کمی ضعیف و رو به پایینه':'رفت‌وبرگشتی و بدون جهت روشنه'}.`,action,why:`امتیاز تکنیکال فعلی ${Math.round(data.score)} از 100 است و فشار خرید/فروش از حرکت قیمت تخمین زده شده.`,watch:`اگر روند از ${trend} به جهت مخالف برگردد یا سطح مهم شکسته شود، سناریو را دوباره بررسی کن.`,alert:fresh?null:'قیمت فعلاً Live نیست؛ قبل از تصمیم زمان منبع را ببین.',tone,confidence:Math.min(90, fresh?Math.max(35,data.score||45):35)};
    };
    const fallback=ruleFallback();
    const key=process.env.GAPGPT_API_KEY;
    if(!key) return res.json({ok:true,provider:'rule-engine',dataAt:state.updatedAt,assistant:{...fallback,simpleData:data}});
    const prompt=`تو «دستیار بازار طلا» برای کاربر عادی ایرانی هستی. خیلی ساده و خودمانی حرف بزن، کوتاه و کاربردی. فقط از داده زیر استفاده کن. سود را تضمین نکن و به جای دستور قطعی، سناریوی عملی بده: صبر، خرید پله‌ای، یا کاهش موقعیت/فروش پله‌ای. اگر داده قدیمی است صریح بگو «این قیمت فعلاً Live نیست». در انتها یک هشدار عددی یا شرطی بده اگر لازم بود. خروجی فقط JSON معتبر با کلیدهای greeting,summary,action,why,watch,alert,tone,confidence باشد. confidence از 90 بیشتر نباشد.

داده بازار:\n${JSON.stringify(data,null,2)}`;
    const r=await fetchWithTimeout(`${AI_BASE_URL}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:AI_MODEL,messages:[{role:'system',content:'دستیار فارسی ساده و داده‌محور بازار طلا.'},{role:'user',content:prompt}],temperature:.15,max_tokens:650})},25000);
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d?.error?.message||`GapGPT HTTP ${r.status}`);
    const raw=d?.choices?.[0]?.message?.content||d?.choices?.[0]?.text||'';
    let parsed;
    try { parsed=JSON.parse(raw.replace(/^```json\s*|\s*```$/g,'')); }
    catch { parsed={...fallback,summary:raw||fallback.summary}; }
    res.json({ok:true,provider:'GapGPT',model:d?.model||AI_MODEL,dataAt:state.updatedAt,assistant:{...parsed,simpleData:data}});
  } catch(e) {
    const fb=(state.analysis?.signal==='BUY'?'سناریوی خرید پله‌ای را بررسی کن':state.analysis?.signal==='SELL'?'سناریوی کاهش ریسک یا فروش پله‌ای را بررسی کن':'صبر کن');
    res.json({ok:true,provider:'rule-engine',dataAt:state.updatedAt,assistant:{greeting:'سلام 👋',summary:'هوش مصنوعی الان پاسخ نداد، اما موتور داخلی بازار را بررسی کردم.',action:fb,why:'پاسخ جایگزین از قواعد داخلی سامانه تولید شد.',watch:'قبل از تصمیم، نمودار و زمان آخرین قیمت را بررسی کن.',alert:'اتصال AI موقتاً در دسترس نیست.',tone:'neutral',confidence:40}});
  }
});

app.get("/api/source-diagnostics", async (req,res)=>{
  try { const d=await getIran18Sources(true); state.sourceDiagnostics=d; res.set("Cache-Control","no-store"); res.json({ok:true,...d}); }
  catch(e){res.status(503).json({ok:false,error:e.message});}
});
app.get("/api/candles", (req,res)=>{
  const seconds=Math.min(3600,Math.max(5,Number(req.query.interval||60)));
  const ticks=state.ticks.filter(x=>Number.isFinite(Number(x.price)));
  const buckets=new Map();
  for(const t of ticks){ const ts=new Date(t.at).getTime(); const key=Math.floor(ts/(seconds*1000))*seconds*1000; let c=buckets.get(key); const p=Number(t.price); if(!c)c={time:new Date(key).toISOString(),open:p,high:p,low:p,close:p,volume:0}; else {c.high=Math.max(c.high,p);c.low=Math.min(c.low,p);c.close=p;} c.volume++; buckets.set(key,c); }
  res.set("Cache-Control","no-store"); res.json({ok:true,intervalSeconds:seconds,candles:[...buckets.values()].slice(-180)});
});
app.get("/api/price-engine", (_,res)=>{res.set("Cache-Control","no-store");res.json({ok:true,primary:state.iran?.source||null,price:state.iran?.priceIRR||null,sourceTime:state.iran?.at||null,receivedAt:state.updatedAt,diagnostics:state.sourceDiagnostics,anomaly:state.anomaly,engineStatus:state.engineStatus,clients:sseClients.size,pollMs,staleThresholdMs,sourceReceivedAt:state.iran?.fetchedAt||null});});

app.get("/api/stream", (req, res) => {
  res.status(200);
  res.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.flushHeaders?.();
  sseClients.add(res);
  res.write(`retry: 3000\n\n`);
  res.write(`event: market\ndata: ${JSON.stringify(publicStatePayload())}\n\n`);
  startSseHeartbeat(res);
  req.on("close", () => sseClients.delete(res));
});

app.get("/api/state", (_, res) => { res.set("Cache-Control","no-store"); res.json(publicStatePayload()); });
app.get("/api/news", async (req, res) => { const news = await getNews(); if (news.length) state.news = news; const sub = await getSubscription(req.query.deviceId); res.json(sub.active ? (state.news || []) : (state.news || []).slice(0, 5)); });
app.get("/api/backtest", async (req, res) => { try { if(!(await requireFeature(req,'backtest',req.query.deviceId))) return res.status(403).json({error:"دسترسی بک‌تست برای این حساب فعال نیست."}); const sub = await getSubscription(req.query.deviceId); if (!sub.active) return res.status(402).json({ error: "این قابلیت مخصوص Gold Alert Pro+ است." }); const h = await getHistory(); if (!h.length) return res.status(503).json({ error: "history unavailable" }); res.json(await runBacktest(h)); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post("/api/reset", async (_, res) => { state.events = []; state.targetEvents = []; state.activeTrade = null; state.lastSignal = "WAIT"; scheduleSave(); res.json({ ok: true }); });



// AI Control Center
app.get("/api/ai-status", async (req,res)=>{
  try {
    const { aiHealth } = await import("./ai/manager.js");
    res.json(await aiHealth());
  } catch(e){
    res.status(500).json({ok:false,error:e.message});
  }
});

app.post("/api/ai-test", async(req,res)=>{
 try{
   const { analyzeGold } = await import("./ai/manager.js");
   const started=Date.now();
   const result=await analyzeGold({price:15000000,usd:0,xau:0,change:0});
   res.json({ok:true,latency:Date.now()-started,...result});
 }catch(e){
   res.status(500).json({ok:false,error:e.message});
 }
});
const server = app.listen(port, "0.0.0.0", async () => {
  console.log(`Gold Alert Pro listening on 0.0.0.0:${port}`);
  await loadState();
  await loadPersonalAlerts();
  await initAlerts();
  try { await loadHistorySeed(); console.log(`History seed: ${state.prices.length} points`); } catch (e) { console.warn("History seed error:", e.message); }
  await tick();
  setInterval(() => tick().catch(e => console.warn("Interval tick error:", e.message)), pollMs);
});
server.on("error", e => console.error("Server error:", e));
process.on("unhandledRejection", e => console.error("Unhandled rejection:", e));
process.on("uncaughtException", e => console.error("Uncaught exception:", e));
