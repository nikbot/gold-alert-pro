import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.DATA_DIR || '/data/gold-alert-pro';
const WATCHLIST_FILE = path.join(DATA_DIR, 'v78-watchlists.json');
const API_KEYS_FILE = path.join(DATA_DIR, 'v78-api-keys.json');
const API_USAGE_FILE = path.join(DATA_DIR, 'v78-api-usage.json');
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, 'v78-subscriptions.json');
const EVENTS_FILE = path.join(DATA_DIR, 'v78-security-events.json');
const MAX_ITEMS = 50;

async function readJson(file, fallback) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; } }
async function writeJson(file, value) { await fs.mkdir(DATA_DIR, { recursive: true }); await fs.writeFile(file, JSON.stringify(value, null, 2), 'utf8'); }
function id(prefix='v78') { return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`; }
function sha256(v) { return crypto.createHash('sha256').update(String(v)).digest('hex'); }
function token(prefix='gld_live_') { return prefix + crypto.randomBytes(24).toString('base64url'); }
function cleanSymbol(v) { return String(v || '').trim().toUpperCase().replace(/[^A-Z0-9._/-]/g, '').slice(0, 32); }

export const V78_PLANS = {
  FREE: { code:'FREE', label:'رایگان', alerts:3, watchlist:8, apiDaily:100, devices:1 },
  PRO: { code:'PRO', label:'Pro', alerts:20, watchlist:30, apiDaily:5000, devices:3 },
  PREMIUM: { code:'PREMIUM', label:'Premium', alerts:100, watchlist:100, apiDaily:25000, devices:10 },
  ENTERPRISE: { code:'ENTERPRISE', label:'Enterprise', alerts:1000, watchlist:500, apiDaily:250000, devices:50 }
};

export async function getSubscriptionFor(userId) {
  const all = await readJson(SUBSCRIPTIONS_FILE, {});
  const s = all[userId];
  if (!s) return { plan:'FREE', status:'active', limits:V78_PLANS.FREE };
  const expired = s.expiresAt && Date.parse(s.expiresAt) < Date.now();
  if (expired) return { ...s, status:'expired', plan:'FREE', limits:V78_PLANS.FREE };
  return { ...s, limits: V78_PLANS[s.plan] || V78_PLANS.FREE };
}
export async function setSubscription(userId, plan='PRO', days=30, meta={}) {
  const p = String(plan).toUpperCase();
  if (!V78_PLANS[p]) throw new Error('پلن نامعتبر است.');
  const all = await readJson(SUBSCRIPTIONS_FILE, {});
  all[userId] = { userId, plan:p, status:'active', startedAt:new Date().toISOString(), expiresAt:new Date(Date.now()+Math.max(1,Number(days)||30)*86400000).toISOString(), ...meta };
  await writeJson(SUBSCRIPTIONS_FILE, all);
  return { ...all[userId], limits:V78_PLANS[p] };
}

export async function getWatchlist(userId) {
  const all = await readJson(WATCHLIST_FILE, {});
  return Array.isArray(all[userId]) ? all[userId] : [];
}
export async function saveWatchlist(userId, items) {
  const sub = await getSubscriptionFor(userId);
  const list = [...new Set((Array.isArray(items)?items:[]).map(cleanSymbol).filter(Boolean))].slice(0, sub.limits.watchlist);
  const all = await readJson(WATCHLIST_FILE, {}); all[userId] = list; await writeJson(WATCHLIST_FILE, all); return list;
}
export async function addWatchSymbol(userId, symbol) {
  const current = await getWatchlist(userId); const sub = await getSubscriptionFor(userId); const s=cleanSymbol(symbol);
  if (!s) throw new Error('نماد نامعتبر است.');
  if (!current.includes(s)) current.push(s);
  if (current.length > sub.limits.watchlist) throw new Error(`سقف Watchlist پلن شما ${sub.limits.watchlist} نماد است.`);
  return saveWatchlist(userId,current);
}
export async function removeWatchSymbol(userId, symbol) { return saveWatchlist(userId,(await getWatchlist(userId)).filter(x=>x!==cleanSymbol(symbol))); }

export async function createApiKey(userId, label='API Key') {
  const raw = token(); const all = await readJson(API_KEYS_FILE, {});
  const mine = Object.values(all).filter(x=>x.userId===userId && x.revoked!==true);
  const sub = await getSubscriptionFor(userId);
  if (mine.length >= Math.min(10, Math.max(1, sub.limits.devices))) throw new Error('سقف کلیدهای API این پلن پر شده است.');
  const rec={id:id('key'),userId,label:String(label||'API Key').slice(0,80),prefix:raw.slice(0,14),hash:sha256(raw),createdAt:new Date().toISOString(),lastUsedAt:null,revoked:false,requests:0};
  all[rec.id]=rec; await writeJson(API_KEYS_FILE,all);
  return { ...rec, key:raw };
}
export async function listApiKeys(userId) { const all=await readJson(API_KEYS_FILE,{}); return Object.values(all).filter(x=>x.userId===userId).map(({hash,...x})=>x); }
export async function revokeApiKey(userId, keyId) { const all=await readJson(API_KEYS_FILE,{}); const x=all[keyId]; if(!x||x.userId!==userId) throw new Error('کلید API پیدا نشد.'); x.revoked=true; x.revokedAt=new Date().toISOString(); await writeJson(API_KEYS_FILE,all); return true; }
export async function authenticateApiKey(raw) {
  const all=await readJson(API_KEYS_FILE,{}); const h=sha256(raw); const x=Object.values(all).find(k=>k.hash===h && !k.revoked); if(!x) return null;
  const sub=await getSubscriptionFor(x.userId); const today=new Date().toISOString().slice(0,10); const usage=await readJson(API_USAGE_FILE,{}); const u=usage[x.id]||{date:today,count:0}; if(u.date!==today){u.date=today;u.count=0;}
  if(u.count>=sub.limits.apiDaily) throw new Error('سقف روزانه API این پلن تکمیل شده است.');
  u.count++; x.lastUsedAt=new Date().toISOString(); x.requests=(x.requests||0)+1; usage[x.id]=u; all[x.id]=x; await Promise.all([writeJson(API_USAGE_FILE,usage),writeJson(API_KEYS_FILE,all)]);
  return { key:x, subscription:sub, usage:u.count };
}
export async function apiUsage(userId) { const keys=await listApiKeys(userId); const usage=await readJson(API_USAGE_FILE,{}); return keys.map(k=>({id:k.id,prefix:k.prefix,count:usage[k.id]?.count||0,date:usage[k.id]?.date||new Date().toISOString().slice(0,10)})); }

export async function securityEvent(event, meta={}) { const all=await readJson(EVENTS_FILE,[]); all.unshift({id:id('sec'),event:String(event).slice(0,80),meta,at:new Date().toISOString()}); await writeJson(EVENTS_FILE,all.slice(0,5000)); }
export async function securityEvents(limit=100) { return (await readJson(EVENTS_FILE,[])).slice(0,Math.min(500,Math.max(1,Number(limit)||100))); }
export async function subscriptionOverview() { const all=await readJson(SUBSCRIPTIONS_FILE,{}); const out={FREE:0,PRO:0,PREMIUM:0,ENTERPRISE:0,expired:0}; for(const s of Object.values(all)){ if(s.expiresAt&&Date.parse(s.expiresAt)<Date.now())out.expired++; else out[s.plan]=(out[s.plan]||0)+1; } return out; }
export async function platformOverview() { const keys=await readJson(API_KEYS_FILE,{}), events=await readJson(EVENTS_FILE,[]); return {apiKeys:Object.values(keys).filter(x=>!x.revoked).length,apiRequests:Object.values(keys).reduce((a,x)=>a+Number(x.requests||0),0),securityEvents:events.length,subscriptions:await subscriptionOverview()}; }
