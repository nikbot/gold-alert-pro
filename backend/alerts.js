import fs from "node:fs/promises";
import path from "node:path";
import webpush from "web-push";

const DATA_DIR = process.env.DATA_DIR || "/data/gold-alert-pro";
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, "push-subscriptions.json");
const VAPID_FILE = path.join(DATA_DIR, "vapid-keys.json");
let lastTelegramAlertKey = "";
let lastPushAlertKey = "";
const subscriptions = new Map();
let loaded = false;

let vapidReady = false;

function pushConfigured() {
  return vapidReady && Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

async function ensureVapidKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    process.env.VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:gold-alert-pro@localhost";
    webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    vapidReady = true;
    return;
  }
  try {
    const raw = await fs.readFile(VAPID_FILE, "utf8");
    const saved = JSON.parse(raw);
    if (saved?.publicKey && saved?.privateKey) {
      process.env.VAPID_PUBLIC_KEY = saved.publicKey;
      process.env.VAPID_PRIVATE_KEY = saved.privateKey;
      process.env.VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:gold-alert-pro@localhost";
      webpush.setVapidDetails(process.env.VAPID_SUBJECT, saved.publicKey, saved.privateKey);
      vapidReady = true;
      return;
    }
  } catch {}
  const keys = webpush.generateVAPIDKeys();
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(VAPID_FILE, JSON.stringify(keys), "utf8");
  } catch (e) {
    console.warn("VAPID key persistence unavailable:", e.message);
  }
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  process.env.VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:gold-alert-pro@localhost";
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, keys.publicKey, keys.privateKey);
  vapidReady = true;
}

async function loadSubscriptions() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await fs.readFile(SUBSCRIPTIONS_FILE, "utf8");
    const list = JSON.parse(raw);
    if (Array.isArray(list)) for (const sub of list) if (sub?.endpoint) subscriptions.set(sub.endpoint, sub);
  } catch {}
}

let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify([...subscriptions.values()]), "utf8");
    } catch (e) {
      console.warn("Push subscription persistence unavailable:", e.message);
    }
  }, 250);
}

export async function initAlerts() { await ensureVapidKeys(); await loadSubscriptions(); }

export async function addSubscription(sub) {
  await loadSubscriptions();
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) throw new Error("Invalid push subscription");
  const previous = subscriptions.get(sub.endpoint) || {};
  subscriptions.set(sub.endpoint, { ...previous, ...sub, deviceId: sub.deviceId || previous.deviceId || null });
  scheduleSave();
}

export async function removeSubscription(endpoint) {
  await loadSubscriptions();
  if (endpoint) subscriptions.delete(endpoint);
  scheduleSave();
}

export async function removeDeviceSubscriptions(deviceId) {
  await loadSubscriptions();
  if (!deviceId) return 0;
  let removed=0;
  for (const [endpoint, sub] of subscriptions) {
    if (sub?.deviceId === deviceId) { subscriptions.delete(endpoint); removed++; }
  }
  if (removed) scheduleSave();
  return removed;
}

function key(signal, price) { return `${signal}:${Math.round(Number(price) / 1000)}`; }

export async function sendWebPush(payload, signal, price) {
  await loadSubscriptions();
  if (!pushConfigured()) return { sent: 0, reason: "webpush_not_configured" };
  const k = key(signal, price);
  if (k === lastPushAlertKey) return { sent: 0, reason: "duplicate" };
  let sent = 0;
  for (const [endpoint, sub] of subscriptions) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
      sent++;
    } catch (e) {
      if ([400, 401, 403, 404, 410].includes(e.statusCode)) {
        subscriptions.delete(endpoint);
        scheduleSave();
      }
    }
  }
  if (sent) lastPushAlertKey = k;
  return { sent };
}


export async function sendWebPushToDevice(deviceId, payload, signal, price) {
  await loadSubscriptions();
  if (!deviceId) return { sent: 0, reason: "missing_device" };
  if (!pushConfigured()) return { sent: 0, reason: "webpush_not_configured" };
  let sent = 0;
  for (const [endpoint, sub] of subscriptions) {
    if (sub?.deviceId !== deviceId) continue;
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
      sent++;
    } catch (e) {
      if ([400, 401, 403, 404, 410].includes(e.statusCode)) {
        subscriptions.delete(endpoint);
        scheduleSave();
      }
    }
  }
  return { sent };
}

export async function sendTelegram(message, signal, price) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return { sent: false, reason: "telegram_not_configured" };
  const k = key(signal, price);
  if (k === lastTelegramAlertKey) return { sent: false, reason: "duplicate" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: message, disable_web_page_preview: true }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
    lastTelegramAlertKey = k;
    return { sent: true };
  } finally {
    clearTimeout(timer);
  }
}

export function getPublicVapidKey() { return process.env.VAPID_PUBLIC_KEY || ""; }
export function subscriptionCount() { return subscriptions.size; }
