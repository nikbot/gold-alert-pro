import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.DATA_DIR || '/data/gold-alert-pro';
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const ADMIN_SESSIONS_FILE = path.join(DATA_DIR, 'admin-sessions.json');
const ADMIN_SESSION_HOURS = Math.max(1, Number(process.env.ADMIN_SESSION_HOURS || 12));
const ADMIN_LOGIN_WINDOW_MS = 10 * 60_000;
const ADMIN_LOGIN_MAX_ATTEMPTS = 10;
const adminAttempts = new Map();

export const FEATURE_KEYS = [
  'dashboard','market','decision','ai','portfolio','alerts','news','tools','backtest','sms','account','reports','chat','calendar'
];
export const DEFAULT_USER_PERMISSIONS = ['dashboard','market','portfolio','alerts','account'];
export const PRO_PERMISSIONS = [...DEFAULT_USER_PERMISSIONS,'decision','ai','news','tools','reports','chat','calendar'];
export const PREMIUM_PERMISSIONS = [...PRO_PERMISSIONS,'backtest','sms'];

async function readJson(file, fallback){ try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return fallback;} }
async function writeJson(file, value){await fs.mkdir(DATA_DIR,{recursive:true});await fs.writeFile(file,JSON.stringify(value,null,2),'utf8');}
function normalizePhone(v){return String(v||'').replace(/\s+/g,'').replace(/-/g,'').trim();}
function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){const hash=crypto.scryptSync(String(password),salt,64).toString('hex');return {salt,hash};}
function cleanPermissions(p){const list=Array.isArray(p)?p:[];return [...new Set(list.filter(x=>FEATURE_KEYS.includes(String(x))))];}
function cleanRole(v){return ['user','pro','premium','admin'].includes(String(v))?String(v):'user';}
function defaultPermissions(role){if(role==='premium')return PREMIUM_PERMISSIONS;if(role==='pro')return PRO_PERMISSIONS;if(role==='admin')return FEATURE_KEYS;return DEFAULT_USER_PERMISSIONS;}
function publicUser(a){if(!a)return null;return {id:a.id,username:a.username||'',phone:a.phone||'',name:a.name||'',role:a.role||'user',permissions:cleanPermissions(a.permissions?.length?a.permissions:defaultPermissions(a.role||'user')),active:a.active!==false,expiresAt:a.expiresAt||null,createdAt:a.createdAt,lastLoginAt:a.lastLoginAt||null,managedByAdmin:Boolean(a.managedByAdmin),planLabel:a.planLabel||null};}
export async function getAccounts(){return readJson(ACCOUNTS_FILE,{});}
export async function saveAccounts(store){return writeJson(ACCOUNTS_FILE,store);}
export async function getUserByPhone(phone){const store=await getAccounts();return store[normalizePhone(phone)]||null;}
export async function getUserByUsername(username){const u=String(username||'').trim().toLowerCase();const store=await getAccounts();return Object.values(store).find(a=>String(a.username||'').toLowerCase()===u)||null;}
export function validUsername(v){const x=String(v||'').trim();return /^09\d{9}$/.test(x)||/^[A-Za-z0-9_\-]{3,32}$/.test(x);}
export function userIsActive(a){if(!a||a.active===false)return false;if(a.expiresAt&&Date.parse(a.expiresAt)<Date.now())return false;return true;}
export function userPermissions(a){return cleanPermissions(a?.permissions?.length?a.permissions:defaultPermissions(a?.role||'user'));}
export function publicAccount(a){return publicUser(a);}

export async function adminLogin(username, password){
  const u=String(username||'').trim();
  const p=String(password||'');
  const expectedUser=String(process.env.ADMIN_USERNAME||'').trim();
  const expectedPass=String(process.env.ADMIN_PASSWORD||'');
  const legacyKey=String(process.env.ADMIN_KEY||'');
  if (!expectedUser || expectedPass.length < 14) throw new Error('اطلاعات مدیر تنظیم نشده است؛ ADMIN_USERNAME و ADMIN_PASSWORD با رمز حداقل ۱۴ کاراکتری را در تنظیمات محیطی وارد کنید.');
  const attemptKey=`admin:${u}`; const now=Date.now(); const prev=adminAttempts.get(attemptKey); if(prev && now-prev.startedAt<ADMIN_LOGIN_WINDOW_MS && prev.count>=ADMIN_LOGIN_MAX_ATTEMPTS) throw new Error('تلاش‌های ورود مدیریت زیاد است؛ چند دقیقه بعد دوباره امتحان کنید.'); if(!prev || now-prev.startedAt>=ADMIN_LOGIN_WINDOW_MS) adminAttempts.set(attemptKey,{startedAt:now,count:1}); else prev.count++;
  const valid=(u===expectedUser && p===expectedPass);
  if(!valid) throw new Error('نام کاربری یا رمز مدیریت صحیح نیست.');
  adminAttempts.delete(attemptKey);
  const token=crypto.randomBytes(32).toString('hex');
  const sessions=await readJson(ADMIN_SESSIONS_FILE,{});
  sessions[token]={username:u,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+ADMIN_SESSION_HOURS*3600000).toISOString()};
  await writeJson(ADMIN_SESSIONS_FILE,sessions);
  return {token,expiresAt:sessions[token].expiresAt,username:u};
}
export async function requireAdminToken(token){
  const t=String(token||''); if(!t)return false;
  const sessions=await readJson(ADMIN_SESSIONS_FILE,{}); const s=sessions[t];
  if(!s)return false;
  if(Date.parse(s.expiresAt)<Date.now()){delete sessions[t];await writeJson(ADMIN_SESSIONS_FILE,sessions);return false;}
  return true;
}
export async function adminLogout(token){const sessions=await readJson(ADMIN_SESSIONS_FILE,{});delete sessions[String(token||'')];await writeJson(ADMIN_SESSIONS_FILE,sessions);}

export async function listUsers(){const store=await getAccounts();return Object.values(store).map(publicUser).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));}
export async function createManagedUser(input={}){
  const username=String(input.username||'').trim().toLowerCase(); if(!validUsername(username))throw new Error('نام کاربری باید ۳ تا ۳۲ کاراکتر و فقط شامل حروف انگلیسی، عدد، _ یا - باشد.');
  const phone=normalizePhone(input.phone);
  const store=await getAccounts(); if(Object.values(store).some(a=>String(a.username||'').toLowerCase()===username))throw new Error('این نام کاربری قبلاً وجود دارد.'); if(phone && !/^09\d{9}$/.test(phone))throw new Error('شماره موبایل معتبر نیست.');
  const role=cleanRole(input.role||'user');
  let password=String(input.password||''); if(password.length<6) password=crypto.randomBytes(5).toString('hex');
  const hp=hashPassword(password);
  const account={id:crypto.randomUUID(),username,phone,...hp,token:'',createdAt:new Date().toISOString(),lastLoginAt:null,name:String(input.name||'').slice(0,80),role,permissions:cleanPermissions(input.permissions?.length?input.permissions:defaultPermissions(role)),active:input.active!==false,expiresAt:input.expiresAt||null,managedByAdmin:true,planLabel:String(input.planLabel||'').slice(0,50)};
  store[account.id]=account;await saveAccounts(store);return {user:publicUser(account),temporaryPassword:password};
}
export async function updateManagedUser(phone,input={}){
  const key=String(phone||'').trim(); const store=await getAccounts(); const a=store[key] || Object.values(store).find(x=>x.phone===normalizePhone(key)||String(x.username||'').toLowerCase()===key.toLowerCase()); if(!a)throw new Error('کاربر پیدا نشد.'); const p=a.id;
  if(input.name!==undefined)a.name=String(input.name||'').slice(0,80);
  if(input.role!==undefined)a.role=cleanRole(input.role);
  if(input.permissions!==undefined)a.permissions=cleanPermissions(input.permissions);
  if(input.active!==undefined)a.active=Boolean(input.active);
  if(input.expiresAt!==undefined)a.expiresAt=input.expiresAt||null;
  if(input.planLabel!==undefined)a.planLabel=String(input.planLabel||'').slice(0,50);
  if(input.password){if(String(input.password).length<6)throw new Error('رمز باید حداقل ۶ کاراکتر باشد.');Object.assign(a,hashPassword(input.password));a.token='';}
  if(input.resetToRoleDefaults)a.permissions=defaultPermissions(a.role);
  store[p]=a;await saveAccounts(store);return publicUser(a);
}
export async function deleteManagedUser(identifier){const key=String(identifier||'').trim();const store=await getAccounts();const p=store[key]?key:Object.keys(store).find(k=>store[k].phone===normalizePhone(key)||String(store[k].username||'').toLowerCase()===key.toLowerCase());if(!p)throw new Error('کاربر پیدا نشد.');delete store[p];await saveAccounts(store);return true;}
export async function adminStats(){const users=await listUsers();return {users:users.length,active:users.filter(x=>x.active).length,expired:users.filter(x=>x.expiresAt&&Date.parse(x.expiresAt)<Date.now()).length,pro:users.filter(x=>x.role==='pro').length,premium:users.filter(x=>x.role==='premium').length,generatedAt:new Date().toISOString()};}
