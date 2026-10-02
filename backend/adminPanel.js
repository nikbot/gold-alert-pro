import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.DATA_DIR || '/data/gold-alert-pro';
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const ADMIN_SESSIONS_FILE = path.join(DATA_DIR, 'admin-sessions.json');
const LOGIN_LOGS_FILE = path.join(DATA_DIR, 'login-logs.json');
const ADMIN_SETTINGS_FILE = path.join(DATA_DIR, 'admin-settings.json');
const ADMIN_SESSION_HOURS = Math.max(1, Number(process.env.ADMIN_SESSION_HOURS || 12));

// Keep demo credentials local-only; production requires credentials from the host's secret store.
const production = process.env.NODE_ENV === 'production';
export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || (production ? '' : 'admin');
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (production ? '' : 'Gold@2026');
export const ADMIN_COOKIE_NAME = process.env.ADMIN_COOKIE_NAME || 'gold_admin_session';
export const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'PREMIUM_USER', 'USER'];
export const ADMIN_FEATURES = [
  'dashboard', 'users', 'payments', 'reports', 'security', 'settings', 'live_status',
  'support', 'broadcast', 'backups', 'theme', 'commerce', 'subscriptions'
];

const ADMIN_LOGIN_WINDOW_MS = 10 * 60_000;
const ADMIN_LOGIN_MAX_ATTEMPTS = 10;
const adminAttempts = new Map();

export const FEATURE_KEYS = [
  'dashboard','market','decision','ai','portfolio','alerts','news','tools','backtest','sms','account','reports','chat','calendar'
];
export const DEFAULT_USER_PERMISSIONS = ['dashboard','market','portfolio','alerts','account'];
export const PRO_PERMISSIONS = [...DEFAULT_USER_PERMISSIONS,'decision','ai','news','tools','reports','chat','calendar'];
export const PREMIUM_PERMISSIONS = [...PRO_PERMISSIONS,'backtest','sms'];

const ROLE_PERMISSIONS = {
  SUPER_ADMIN: [...ADMIN_FEATURES],
  ADMIN: ['dashboard','users','payments','reports','live_status','support','broadcast','backups','theme','commerce','subscriptions'],
  MODERATOR: ['dashboard','users','reports','live_status','support','broadcast'],
  PREMIUM_USER: ['dashboard','reports','live_status'],
  USER: ['dashboard']
};

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}
async function writeJson(file, value) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2), 'utf8');
}
function normalizePhone(v) { return String(v || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[\u200c\u200f\u200e]/g, '').replace(/\s+/g, '').replace(/-/g, '').trim(); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}
function cleanPermissions(p) {
  const list = Array.isArray(p) ? p : [];
  return [...new Set(list.filter(x => FEATURE_KEYS.includes(String(x))))];
}
export function normalizeAdminRole(v) {
  const r = String(v || '').trim().toUpperCase();
  return ADMIN_ROLES.includes(r) ? r : 'USER';
}
export function adminRolePermissions(role) {
  return [...(ROLE_PERMISSIONS[normalizeAdminRole(role)] || ROLE_PERMISSIONS.USER)];
}
function legacyRole(a) {
  if (a?.accessRole) return normalizeAdminRole(a.accessRole);
  if (String(a?.username || '').toLowerCase() === ADMIN_USERNAME.toLowerCase() && String(a?.role || '') === 'admin') return 'SUPER_ADMIN';
  return 'USER';
}
function defaultPermissions(role) {
  if (role === 'premium') return PREMIUM_PERMISSIONS;
  if (role === 'pro') return PRO_PERMISSIONS;
  if (role === 'admin') return FEATURE_KEYS;
  return DEFAULT_USER_PERMISSIONS;
}
function publicUser(a) {
  if (!a) return null;
  const accessRole = legacyRole(a);
  return {
    id: a.id,
    username: a.username || '',
    phone: a.phone || '',
    name: a.name || '',
    role: a.role || 'user',
    accessRole,
    permissions: cleanPermissions(a.permissions?.length ? a.permissions : defaultPermissions(a.role || 'user')),
    active: a.active !== false,
    expiresAt: a.expiresAt || null,
    createdAt: a.createdAt,
    lastLoginAt: a.lastLoginAt || null,
    managedByAdmin: Boolean(a.managedByAdmin),
    planLabel: a.planLabel || null
  };
}
function sanitizeIp(ip) {
  const s = String(ip || '').trim();
  return s.slice(0, 120);
}
function sanitizeUserAgent(ua) {
  return String(ua || '').slice(0, 320);
}
async function appendLoginLog(entry) {
  const logs = await readJson(LOGIN_LOGS_FILE, []);
  logs.unshift({ id: crypto.randomUUID(), ...entry, at: entry.at || new Date().toISOString() });
  await writeJson(LOGIN_LOGS_FILE, logs.slice(0, 5000));
}

export async function getAccounts() { return readJson(ACCOUNTS_FILE, {}); }
export async function saveAccounts(store) { return writeJson(ACCOUNTS_FILE, store); }
export async function getUserByPhone(phone) { const store = await getAccounts(); return store[normalizePhone(phone)] || null; }
export async function getUserByUsername(username) {
  const u = String(username || '').trim().toLowerCase();
  const store = await getAccounts();
  return Object.values(store).find(a => String(a.username || '').toLowerCase() === u) || null;
}
export function validUsername(v) {
  const x = String(v || '').trim();
  return /^09\d{9}$/.test(x) || /^[A-Za-z0-9_\-]{3,32}$/.test(x);
}
export function userIsActive(a) {
  if (!a || a.active === false) return false;
  if (a.expiresAt && Date.parse(a.expiresAt) < Date.now()) return false;
  return true;
}
export function userPermissions(a) {
  return cleanPermissions(a?.permissions?.length ? a.permissions : defaultPermissions(a?.role || 'user'));
}
export function publicAccount(a) { return publicUser(a); }

async function cleanupSessions(sessions) {
  const now = Date.now();
  let dirty = false;
  for (const [token, s] of Object.entries(sessions)) {
    if (!s?.expiresAt || Date.parse(s.expiresAt) < now) { delete sessions[token]; dirty = true; }
  }
  if (dirty) await writeJson(ADMIN_SESSIONS_FILE, sessions);
  return sessions;
}

export async function adminLogin(username, password, meta = {}) {
  const u = String(username || '').trim();
  const p = String(password || '');
  const attemptKey = `admin:${sanitizeIp(meta.ip)}:${u.toLowerCase()}`;
  const now = Date.now();
  const prev = adminAttempts.get(attemptKey);
  if (prev && now - prev.startedAt < ADMIN_LOGIN_WINDOW_MS && prev.count >= ADMIN_LOGIN_MAX_ATTEMPTS) {
    await appendLoginLog({ username: u, success: false, ip: sanitizeIp(meta.ip), userAgent: sanitizeUserAgent(meta.userAgent), reason: 'rate_limited' });
    throw new Error('تلاش‌های ورود مدیریت زیاد است؛ چند دقیقه بعد دوباره امتحان کنید.');
  }
  if (!prev || now - prev.startedAt >= ADMIN_LOGIN_WINDOW_MS) adminAttempts.set(attemptKey, { startedAt: now, count: 1 });
  else prev.count++;

  const legacyKey = String(process.env.ADMIN_KEY || '');
  const valid = (ADMIN_USERNAME && ADMIN_PASSWORD && u === ADMIN_USERNAME && p === ADMIN_PASSWORD) || (legacyKey && p === legacyKey && u === 'admin');
  if (!valid) {
    await appendLoginLog({ username: u, success: false, ip: sanitizeIp(meta.ip), userAgent: sanitizeUserAgent(meta.userAgent), reason: 'invalid_credentials' });
    throw new Error('نام کاربری یا رمز مدیریت صحیح نیست.');
  }

  adminAttempts.delete(attemptKey);
  const token = crypto.randomBytes(48).toString('hex');
  const sessions = await cleanupSessions(await readJson(ADMIN_SESSIONS_FILE, {}));
  const session = {
    username: u,
    role: 'SUPER_ADMIN',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ADMIN_SESSION_HOURS * 3600000).toISOString(),
    ip: sanitizeIp(meta.ip),
    userAgent: sanitizeUserAgent(meta.userAgent),
    lastSeenAt: new Date().toISOString()
  };
  sessions[token] = session;
  await writeJson(ADMIN_SESSIONS_FILE, sessions);
  await appendLoginLog({ username: u, success: true, ip: session.ip, userAgent: session.userAgent, role: session.role, event: 'login' });
  return { token, expiresAt: session.expiresAt, username: u, role: session.role, permissions: adminRolePermissions(session.role) };
}

export async function requireAdminSession(token) {
  const t = String(token || '');
  if (!t) return null;
  const sessions = await cleanupSessions(await readJson(ADMIN_SESSIONS_FILE, {}));
  const session = sessions[t];
  if (!session) return null;
  session.lastSeenAt = new Date().toISOString();
  sessions[t] = session;
  await writeJson(ADMIN_SESSIONS_FILE, sessions);
  return { ...session, token: t, permissions: adminRolePermissions(session.role) };
}
export async function requireAdminToken(token) { return Boolean(await requireAdminSession(token)); }
export async function adminLogout(token) {
  const t = String(token || '');
  const sessions = await readJson(ADMIN_SESSIONS_FILE, {});
  const s = sessions[t];
  if (s) await appendLoginLog({ username: s.username, role: s.role, ip: s.ip, userAgent: s.userAgent, success: true, event: 'logout' });
  delete sessions[t];
  await writeJson(ADMIN_SESSIONS_FILE, sessions);
}
export async function listAdminSessions() {
  const sessions = await cleanupSessions(await readJson(ADMIN_SESSIONS_FILE, {}));
  return Object.entries(sessions).map(([token, s]) => ({
    id: token.slice(0, 12), username: s.username, role: normalizeAdminRole(s.role),
    createdAt: s.createdAt, expiresAt: s.expiresAt, lastSeenAt: s.lastSeenAt || null,
    ip: s.ip || '—', userAgent: s.userAgent || '—'
  }));
}
export async function revokeAdminSession(idPrefix) {
  const sessions = await readJson(ADMIN_SESSIONS_FILE, {});
  const key = Object.keys(sessions).find(k => k.startsWith(String(idPrefix || '')));
  if (!key) return false;
  delete sessions[key];
  await writeJson(ADMIN_SESSIONS_FILE, sessions);
  return true;
}
export async function revokeAllAdminSessions(exceptToken = '') {
  const sessions = await readJson(ADMIN_SESSIONS_FILE, {});
  const keep = String(exceptToken || '');
  let n = 0;
  for (const key of Object.keys(sessions)) if (key !== keep) { delete sessions[key]; n++; }
  await writeJson(ADMIN_SESSIONS_FILE, sessions);
  return n;
}
export async function getLoginLogs(limit = 200) { return (await readJson(LOGIN_LOGS_FILE, [])).slice(0, Math.max(1, Math.min(1000, Number(limit) || 200))); }

export async function getAdminSettings() {
  return readJson(ADMIN_SETTINGS_FILE, {
    siteName: 'Gold Alert Pro',
    logoUrl: '/icon-192.png',
    sessionTimeoutHours: ADMIN_SESSION_HOURS,
    loginProtection: { windowMinutes: 10, maxAttempts: ADMIN_LOGIN_MAX_ATTEMPTS },
    maintenanceMode: false,
    defaultRole: 'USER',
    updatedAt: null
  });
}
export async function setAdminSettings(input = {}) {
  const current = await getAdminSettings();
  const next = {
    ...current,
    siteName: String(input.siteName ?? current.siteName).trim().slice(0, 120) || current.siteName,
    logoUrl: String(input.logoUrl ?? current.logoUrl).trim().slice(0, 500) || current.logoUrl,
    sessionTimeoutHours: Math.max(1, Math.min(168, Number(input.sessionTimeoutHours ?? current.sessionTimeoutHours) || current.sessionTimeoutHours)),
    loginProtection: {
      windowMinutes: Math.max(1, Math.min(60, Number(input.loginProtection?.windowMinutes ?? current.loginProtection.windowMinutes) || current.loginProtection.windowMinutes)),
      maxAttempts: Math.max(3, Math.min(30, Number(input.loginProtection?.maxAttempts ?? current.loginProtection.maxAttempts) || current.loginProtection.maxAttempts))
    },
    maintenanceMode: Boolean(input.maintenanceMode ?? current.maintenanceMode),
    defaultRole: normalizeAdminRole(input.defaultRole ?? current.defaultRole),
    updatedAt: new Date().toISOString()
  };
  await writeJson(ADMIN_SETTINGS_FILE, next);
  return next;
}

export async function listUsers({ page = 1, limit = 25, search = '', role = 'all', status = 'all' } = {}) {
  const store = await getAccounts();
  let users = Object.values(store).map(publicUser).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const q = String(search || '').trim().toLowerCase();
  if (q) users = users.filter(u => [u.username, u.phone, u.name, u.accessRole, u.role].some(v => String(v || '').toLowerCase().includes(q)));
  if (role && role !== 'all') users = users.filter(u => String(u.accessRole) === normalizeAdminRole(role));
  if (status === 'active') users = users.filter(u => u.active && (!u.expiresAt || Date.parse(u.expiresAt) >= Date.now()));
  if (status === 'inactive') users = users.filter(u => !u.active);
  if (status === 'expired') users = users.filter(u => u.expiresAt && Date.parse(u.expiresAt) < Date.now());
  const total = users.length;
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 25));
  const safePage = Math.max(1, Number(page) || 1);
  const pages = Math.max(1, Math.ceil(total / safeLimit));
  const currentPage = Math.min(safePage, pages);
  return { users: users.slice((currentPage - 1) * safeLimit, currentPage * safeLimit), total, page: currentPage, limit: safeLimit, pages };
}

export async function createManagedUser(input = {}) {
  const username = String(input.username || '').trim().toLowerCase();
  if (!validUsername(username)) throw new Error('نام کاربری باید ۳ تا ۳۲ کاراکتر و فقط شامل حروف انگلیسی، عدد، _ یا - باشد.');
  const phone = normalizePhone(input.phone);
  const store = await getAccounts();
  if (Object.values(store).some(a => String(a.username || '').toLowerCase() === username)) throw new Error('این نام کاربری قبلاً وجود دارد.');
  if (phone && !/^09\d{9}$/.test(phone)) throw new Error('شماره موبایل معتبر نیست.');
  const role = String(input.role || 'user');
  const accessRole = normalizeAdminRole(input.accessRole || (role === 'admin' ? 'ADMIN' : 'USER'));
  let password = String(input.password || '');
  if (password.length < 6) password = crypto.randomBytes(5).toString('hex');
  const hp = hashPassword(password);
  const account = {
    id: crypto.randomUUID(), username, phone, ...hp, token: '',
    createdAt: new Date().toISOString(), lastLoginAt: null,
    name: String(input.name || '').slice(0, 80), role,
    accessRole,
    permissions: cleanPermissions(input.permissions?.length ? input.permissions : defaultPermissions(role)),
    active: input.active !== false, expiresAt: input.expiresAt || null,
    managedByAdmin: true, planLabel: String(input.planLabel || '').slice(0, 50)
  };
  store[account.id] = account;
  await saveAccounts(store);
  return { user: publicUser(account), temporaryPassword: password };
}

export async function updateManagedUser(identifier, input = {}) {
  const key = String(identifier || '').trim();
  const store = await getAccounts();
  const a = store[key] || Object.values(store).find(x => String(x.id||'') === key || x.phone === normalizePhone(key) || String(x.username || '').toLowerCase() === key.toLowerCase());
  if (!a) throw new Error('کاربر پیدا نشد.');
  const p = a.id;
  if (input.name !== undefined) a.name = String(input.name || '').slice(0, 80);
  if (input.role !== undefined) a.role = ['user', 'pro', 'premium', 'admin'].includes(String(input.role)) ? String(input.role) : 'user';
  if (input.accessRole !== undefined) a.accessRole = normalizeAdminRole(input.accessRole);
  if (input.permissions !== undefined) a.permissions = cleanPermissions(input.permissions);
  if (input.active !== undefined) a.active = Boolean(input.active);
  if (input.expiresAt !== undefined) a.expiresAt = input.expiresAt || null;
  if (input.planLabel !== undefined) a.planLabel = String(input.planLabel || '').slice(0, 50);
  if (input.password) {
    if (String(input.password).length < 6) throw new Error('رمز باید حداقل ۶ کاراکتر باشد.');
    Object.assign(a, hashPassword(input.password));
    a.token = '';
    a.tokenExpiresAt = null;
  }
  if (input.resetToRoleDefaults) a.permissions = defaultPermissions(a.role);
  store[p] = a;
  await saveAccounts(store);
  return publicUser(a);
}
export async function resetManagedUserPassword(identifier, newPassword) {
  const key = String(identifier || '').trim();
  const password = String(newPassword || '');
  if (password.length < 6) throw new Error('رمز باید حداقل ۶ کاراکتر باشد.');
  const store = await getAccounts();
  const a = store[key] || Object.values(store).find(x => String(x.id||'') === key || x.phone === normalizePhone(key) || String(x.username || '').toLowerCase() === key.toLowerCase());
  if (!a) throw new Error('کاربر پیدا نشد.');
  Object.assign(a, hashPassword(password));
  a.token = '';
  a.tokenExpiresAt = null;
  a.passwordChangedAt = new Date().toISOString();
  store[a.id] = a;
  await saveAccounts(store);
  return publicUser(a);
}

export async function deleteManagedUser(identifier) {
  const key = String(identifier || '').trim();
  const store = await getAccounts();
  const p = store[key] ? key : Object.keys(store).find(k => String(store[k]?.id||'') === key || store[k].phone === normalizePhone(key) || String(store[k].username || '').toLowerCase() === key.toLowerCase());
  if (!p) throw new Error('کاربر پیدا نشد.');
  delete store[p];
  await saveAccounts(store);
  return true;
}
export async function adminStats() {
  const all = await getAccounts();
  const users = Object.values(all).map(publicUser);
  const active = users.filter(x => x.active && (!x.expiresAt || Date.parse(x.expiresAt) >= Date.now()));
  return {
    users: users.length,
    active: active.length,
    expired: users.filter(x => x.expiresAt && Date.parse(x.expiresAt) < Date.now()).length,
    pro: users.filter(x => x.role === 'pro').length,
    premium: users.filter(x => x.role === 'premium').length,
    accessRoles: Object.fromEntries(ADMIN_ROLES.map(role => [role, users.filter(u => u.accessRole === role).length])),
    generatedAt: new Date().toISOString()
  };
}
