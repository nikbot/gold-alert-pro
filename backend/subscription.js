import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = process.env.DATA_DIR || "/data/gold-alert-pro";
const FILE = path.join(DATA_DIR, "subscriptions.json");
const ADMIN_KEY = process.env.ADMIN_KEY || "";

const DEFAULT_PLANS = {
  monthly: { id: "monthly", title: "۱ ماهه", days: 30, priceIRR: Number(process.env.PRO_MONTHLY_IRR || 149000) },
  quarterly: { id: "quarterly", title: "۳ ماهه", days: 90, priceIRR: Number(process.env.PRO_QUARTERLY_IRR || 349000) },
  yearly: { id: "yearly", title: "۱ ساله", days: 365, priceIRR: Number(process.env.PRO_YEARLY_IRR || 999000) }
};

let db = { users: {} };
let loaded = false;
let saveTimer;

function cleanId(id) {
  return String(id || "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.users) db = parsed;
  } catch {}
}

function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(FILE, JSON.stringify(db), "utf8");
    } catch (e) { console.warn("Subscription persistence unavailable:", e.message); }
  }, 100);
}

export function plans() {
  return Object.values(DEFAULT_PLANS).map(p => ({ ...p, priceLabel: Math.round(p.priceIRR).toLocaleString("fa-IR") + " ریال" }));
}

export async function getSubscription(deviceId) {
  await load();
  const id = cleanId(deviceId);
  const user = db.users[id];
  const now = Date.now();
  const expiresAt = user?.expiresAt ? new Date(user.expiresAt).getTime() : 0;
  const active = expiresAt > now;
  return {
    deviceId: id,
    plan: active ? user.plan : "free",
    active,
    expiresAt: active ? user.expiresAt : null,
    activatedAt: active ? user.activatedAt : null,
    paymentRef: active ? user.paymentRef || null : null
  };
}

export async function activateSubscription({ deviceId, planId, days, paymentRef }) {
  await load();
  const id = cleanId(deviceId);
  if (!id) throw new Error("deviceId required");
  const plan = DEFAULT_PLANS[planId];
  if (!plan && !days) throw new Error("invalid plan");
  const user = db.users[id] || {};
  const base = Math.max(Date.now(), user.expiresAt ? new Date(user.expiresAt).getTime() : 0);
  const duration = Number(days || plan.days);
  if (!Number.isFinite(duration) || duration < 1 || duration > 3660) throw new Error("invalid duration");
  const expiresAt = new Date(base + duration * 86400000).toISOString();
  db.users[id] = { plan: plan?.id || "custom", activatedAt: new Date().toISOString(), expiresAt, paymentRef: String(paymentRef || "").slice(0, 120) };
  saveSoon();
  return getSubscription(id);
}

export function validAdminKey(key) {
  const a=Buffer.from(String(key || "")); const b=Buffer.from(ADMIN_KEY); return Boolean(ADMIN_KEY) && a.length===b.length && crypto.timingSafeEqual(a,b);
}

export function paymentUrl(planId, deviceId) {
  const plan = DEFAULT_PLANS[planId];
  if (!plan) return null;
  const template = process.env.PAYMENT_URL_TEMPLATE || "";
  if (!template) return null;
  return template.replaceAll("{plan}", encodeURIComponent(plan.id)).replaceAll("{deviceId}", encodeURIComponent(cleanId(deviceId)));
}

export function supportUrl() { return process.env.SUPPORT_URL || ""; }
