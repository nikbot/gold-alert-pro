import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = process.env.DATA_DIR || "/data/gold-alert-pro";
const FILE = path.join(DATA_DIR, "sms-premium.json");
let PRICE_IRR = Number(process.env.SMS_PLAN_PRICE_IRR || 500000);
let DAYS = Number(process.env.SMS_PLAN_DAYS || 30);
export function updateSmsPlan({ priceIRR, days } = {}) {
  if (priceIRR !== undefined) { const n = Number(priceIRR); if (!Number.isSafeInteger(n) || n < 0 || n > 100000000000) throw new Error("مبلغ اشتراک نامعتبر است."); PRICE_IRR = n; }
  if (days !== undefined) { const n = Number(days); if (!Number.isInteger(n) || n < 1 || n > 3650) throw new Error("مدت اشتراک نامعتبر است."); DAYS = n; }
  return { priceIRR: PRICE_IRR, days: DAYS };
}
const INTERVAL_MS = Math.max(60000, Number(process.env.SMS_ALERT_INTERVAL_MIN || 10) * 60000);
const CHANGE_THRESHOLD = Math.max(0, Number(process.env.SMS_CHANGE_THRESHOLD_PCT || 0.25));
const ADMIN_PHONE = String(process.env.IPPANEL_ADMIN_PHONE || "").trim();
const IPPANEL_URL = String(process.env.IPPANEL_URL || "https://edge.ippanel.com/v1/api/send").trim();
const IPPANEL_API_KEY = String(process.env.IPPANEL_API_KEY || "").trim();
const IPPANEL_FROM = String(process.env.IPPANEL_FROM || "").trim();
const PATTERN_PRICE = String(process.env.IPPANEL_PATTERN_CODE_PRICE || "").trim();
const PATTERN_ADMIN = String(process.env.IPPANEL_PATTERN_CODE_ADMIN || "").trim();
const PATTERN_ACTIVATION = String(process.env.IPPANEL_PATTERN_CODE_ACTIVATION || "").trim();

let db = { requests: {}, subscribers: {} };
let loaded = false;
let saveTimer = null;

function normalizePhone(v) {
  let s = String(v || "").replace(/[^0-9+]/g, "");
  if (s.startsWith("09")) s = "+98" + s.slice(1);
  if (s.startsWith("98") && !s.startsWith("+98")) s = "+" + s;
  return /^\+989\d{9}$/.test(s) ? s : "";
}
function cleanId(v) { return String(v || "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100); }
function hashCode(code) { return crypto.createHash("sha256").update(String(code)).digest("hex"); }
function makeCode() { return String(crypto.randomInt(100000, 1000000)); }
function makeId() { return crypto.randomBytes(10).toString("hex"); }
function fmt(n) { return Math.round(Number(n)).toLocaleString("fa-IR"); }
function pct(n) { return Number(n).toLocaleString("fa-IR", { maximumFractionDigits: 2 }); }

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") db = { requests: parsed.requests || {}, subscribers: parsed.subscribers || {} };
  } catch {}
}
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(FILE, JSON.stringify(db), "utf8");
    } catch (e) { console.warn("SMS premium persistence unavailable:", e.message); }
  }, 150);
}

async function sendSMS(recipients, message) {
  const list = Array.isArray(recipients) ? recipients.map(normalizePhone).filter(Boolean) : [normalizePhone(recipients)].filter(Boolean);
  if (!IPPANEL_API_KEY || !IPPANEL_FROM) return { sent: false, reason: "ippanel_not_configured" };
  if (!list.length) return { sent: false, reason: "invalid_recipient" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch(IPPANEL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": IPPANEL_API_KEY },
      body: JSON.stringify({ sending_type: "webservice", from_number: IPPANEL_FROM, message: String(message).slice(0, 900), params: { recipients: list } }),
      signal: controller.signal
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data?.meta?.status === false) throw new Error(data?.meta?.message || `IPPanel HTTP ${r.status}`);
    return { sent: true, data };
  } finally { clearTimeout(timer); }
}

async function sendPattern(recipient, code, params) {
  const to = normalizePhone(recipient);
  if (!IPPANEL_API_KEY || !IPPANEL_FROM) return { sent: false, reason: "ippanel_not_configured" };
  if (!to) return { sent: false, reason: "invalid_recipient" };
  if (!code) return { sent: false, reason: "pattern_code_not_configured" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch(IPPANEL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": IPPANEL_API_KEY },
      body: JSON.stringify({ sending_type: "pattern", from_number: IPPANEL_FROM, code, recipients: [to], params }),
      signal: controller.signal
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data?.meta?.status === false) throw new Error(data?.meta?.message || `IPPanel HTTP ${r.status}`);
    return { sent: true, data };
  } finally { clearTimeout(timer); }
}

export function smsConfig() {
  return { configured: Boolean(IPPANEL_API_KEY && IPPANEL_FROM), patternConfigured: Boolean(PATTERN_PRICE), adminPatternConfigured: Boolean(PATTERN_ADMIN), activationPatternConfigured: Boolean(PATTERN_ACTIVATION), priceIRR: PRICE_IRR, days: DAYS, intervalMin: Math.round(INTERVAL_MS / 60000), changeThresholdPct: CHANGE_THRESHOLD };
}

export async function createPaymentRequest({ deviceId, phone, paymentRef }) {
  await load();
  const id = makeId();
  const normalizedPhone = normalizePhone(phone);
  if (!cleanId(deviceId)) throw new Error("deviceId نامعتبر است.");
  if (!normalizedPhone) throw new Error("شماره موبایل معتبر نیست.");
  const ref = String(paymentRef || "").trim().slice(0, 120);
  if (!ref) throw new Error("کد پیگیری واریز را وارد کن.");
  const recent = Object.values(db.requests).filter(r => r.deviceId === cleanId(deviceId) && r.status === "pending" && Date.now() - new Date(r.createdAt).getTime() < 10 * 60 * 1000);
  if (recent.length >= 1) throw new Error("یک درخواست در حال بررسی داری؛ لطفاً تا بررسی همان درخواست صبر کن.");
  db.requests[id] = { id, deviceId: cleanId(deviceId), phone: normalizedPhone, paymentRef: ref, createdAt: new Date().toISOString(), status: "pending" };
  saveSoon();
  const adminText = ["🥇 Gold Alert Pro", "درخواست فعال‌سازی SMS Premium", `مبلغ: ${fmt(PRICE_IRR)} ریال (${fmt(PRICE_IRR/10)} تومان)`, `موبایل: ${normalizedPhone}`, `کد پیگیری: ${ref}`, `شناسه درخواست: ${id}`, "پس از بررسی واریز، برای این درخواست کد فعال‌سازی صادر کن."].join("\n");
  const admin = ADMIN_PHONE ? (PATTERN_ADMIN ? await sendPattern(ADMIN_PHONE, PATTERN_ADMIN, { phone: normalizedPhone, ref, request: id, amount: String(Math.round(PRICE_IRR / 10).toLocaleString("fa-IR")) }) : await sendSMS(ADMIN_PHONE, adminText)) : { sent: false, reason: "admin_phone_not_configured" };
  return { requestId: id, status: "pending", adminNotified: admin.sent, priceIRR: PRICE_IRR, days: DAYS };
}

export async function issueActivationCode({ requestId, days = DAYS }) {
  await load();
  const req = db.requests[String(requestId || "")];
  if (!req) throw new Error("درخواست پیدا نشد.");
  if (req.status === "activated") throw new Error("این درخواست قبلاً فعال شده است.");
  const duration = Number(days);
  if (!Number.isFinite(duration) || duration < 1 || duration > 3650) throw new Error("مدت اعتبار نامعتبر است.");
  const code = makeCode();
  req.status = "code_issued";
  req.issuedAt = new Date().toISOString();
  req.codeHash = hashCode(code);
  req.days = duration;
  const sms = PATTERN_ACTIVATION ? await sendPattern(req.phone, PATTERN_ACTIVATION, { code, days: String(duration), request: req.id }) : { sent: false, reason: "activation_pattern_not_configured" };
  req.activationSmsSent = sms.sent;
  saveSoon();
  return { requestId: req.id, phone: req.phone, code, days: duration, paymentRef: req.paymentRef, activationSmsSent: sms.sent };
}

export async function activateWithCode({ deviceId, phone, code }) {
  await load();
  const normalizedPhone = normalizePhone(phone);
  const id = cleanId(deviceId);
  const rawCode = String(code || "").trim();
  if (!id || !normalizedPhone || !/^\d{6}$/.test(rawCode)) throw new Error("شماره، دستگاه یا کد فعال‌سازی نامعتبر است.");
  const req = Object.values(db.requests).find(r => r.status === "code_issued" && r.phone === normalizedPhone && r.codeHash === hashCode(rawCode));
  if (!req) throw new Error("کد فعال‌سازی صحیح نیست یا قبلاً استفاده شده است.");
  const expiresAt = new Date(Date.now() + Number(req.days || DAYS) * 86400000).toISOString();
  db.subscribers[id] = { deviceId: id, phone: normalizedPhone, activatedAt: new Date().toISOString(), expiresAt, paymentRef: req.paymentRef, lastSentAt: null, lastSentPrice: null };
  req.status = "activated"; req.activatedAt = new Date().toISOString();
  saveSoon();
  return { active: true, expiresAt, phone: normalizedPhone, days: Number(req.days || DAYS) };
}

export async function getStatus(deviceId) {
  await load();
  const s = db.subscribers[cleanId(deviceId)];
  const active = Boolean(s && new Date(s.expiresAt).getTime() > Date.now());
  return { active, expiresAt: active ? s.expiresAt : null, phone: active ? s.phone : null, priceIRR: PRICE_IRR, days: DAYS, intervalMin: Math.round(INTERVAL_MS / 60000) };
}

export async function sendPremiumPriceSMS(snapshot) {
  await load();
  if (!IPPANEL_API_KEY || !IPPANEL_FROM) return { sent: 0, reason: "ippanel_not_configured" };
  const price = Number(snapshot?.iran?.priceIRR);
  if (!Number.isFinite(price) || price <= 0) return { sent: 0, reason: "price_unavailable" };
  const now = Date.now();
  let sent = 0;
  let changed = false;
  for (const [deviceId, s] of Object.entries(db.subscribers)) {
    if (!s || new Date(s.expiresAt).getTime() <= now) continue;
    const lastPrice = Number(s.lastSentPrice);
    const lastAt = s.lastSentAt ? new Date(s.lastSentAt).getTime() : 0;
    const change = Number.isFinite(lastPrice) && lastPrice > 0 ? ((price / lastPrice) - 1) * 100 : 999;
    const due = !lastAt || now - lastAt >= INTERVAL_MS;
    const significant = Number.isFinite(change) && Math.abs(change) >= CHANGE_THRESHOLD;
    if (!due && !significant) continue;
    const prev = Number.isFinite(lastPrice) && lastPrice > 0 ? `${change >= 0 ? "▲" : "▼"} ${pct(Math.abs(change))}٪` : "اولین گزارش";
    const text = ["🥇 Gold Alert Pro", `طلای ۱۸ عیار: ${fmt(price)} ریال`, `تغییر از گزارش قبل: ${prev}`, `اونس: ${snapshot?.global?.xauUsd ? "$" + Number(snapshot.global.xauUsd).toFixed(2) : "—"}`, `دلار: ${snapshot?.dollar?.priceIRR ? fmt(snapshot.dollar.priceIRR) + " ریال" : "—"}`, `RSI: ${snapshot?.analysis?.rsi != null ? Number(snapshot.analysis.rsi).toFixed(1) : "—"}`, `وضعیت: ${snapshot?.analysis?.signal === "BUY" ? "خرید" : snapshot?.analysis?.signal === "SELL" ? "فروش" : "انتظار"}`].join("\n");
    const result = PATTERN_PRICE ? await sendPattern(s.phone, PATTERN_PRICE, { gold: fmt(price), change: prev, xau: snapshot?.global?.xauUsd ? Number(snapshot.global.xauUsd).toFixed(2) : "—", dollar: snapshot?.dollar?.priceIRR ? fmt(snapshot.dollar.priceIRR) : "—", rsi: snapshot?.analysis?.rsi != null ? Number(snapshot.analysis.rsi).toFixed(1) : "—", signal: snapshot?.analysis?.signal === "BUY" ? "خرید" : snapshot?.analysis?.signal === "SELL" ? "فروش" : "انتظار" }) : { sent: false, reason: "price_pattern_not_configured" };
    if (result.sent) { s.lastSentAt = new Date().toISOString(); s.lastSentPrice = price; sent++; changed = true; }
  }
  if (changed) saveSoon();
  return { sent };
}

export async function adminRequests() {
  await load();
  return Object.values(db.requests).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 50).map(({codeHash,...r})=>r);
}
