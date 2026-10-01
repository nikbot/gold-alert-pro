const fa=n=>Number(n||0).toLocaleString('fa-IR',{maximumFractionDigits:0});
const f2=n=>Number(n||0).toLocaleString('fa-IR',{maximumFractionDigits:2});
const pct=n=>Number(n||0).toLocaleString('fa-IR',{maximumFractionDigits:1})+'٪';
let latest=null,timer=null,deferredPrompt=null,pollMs=10000,nextAt=0;
let aiCopilotCache={}; let aiCopilotLastCall=0; let aiCopilotPage='dashboard'; let aiCopilotOpen=true; let aiCopilotLastAlert='';
const DEVICE_KEY='gold-alert-pro-device-id-v10';
let lastNotificationIds=new Set();
let notificationsBootstrapped=false;
const deviceId=localStorage.getItem(DEVICE_KEY)||(()=>{const id=(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));localStorage.setItem(DEVICE_KEY,id);return id})();
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function moneyIRR(n){return n==null?'—':fa(n)+' ریال'}
function startCountdown(){clearInterval(timer);nextAt=Date.now()+pollMs;const tick=()=>{const left=Math.max(0,nextAt-Date.now()),sec=Math.ceil(left/1000);document.getElementById('count').textContent=sec+' ثانیه';document.getElementById('progress').style.width=Math.min(100,Math.max(0,100-left/pollMs*100))+'%';if(left<=0)clearInterval(timer)};tick();timer=setInterval(tick,250)}
function changeClass(n){return Number(n)>0?'upTxt':Number(n)<0?'downTxt':''}
function setAsset(id,value,prev){document.getElementById(id).textContent=moneyIRR(value);const el=document.getElementById(id+'Ch');if(el&&prev!=null){const d=(value/prev-1)*100;el.textContent=(d>=0?'▲ ':'▼ ')+pct(Math.abs(d));el.className=changeClass(d)}}
function holderOpinion(a,p){
 if(!a) return 'در حال جمع‌آوری داده‌های کافی برای تحلیل.';
 if(a.signal==='BUY' && a.score>=70) return '🟢 <b>روند فعلاً به نفع نگهداری است.</b> مومنتوم و چند شاخص هم‌جهت‌اند؛ اگر قصد خرید دارید، خرید پله‌ای از تصمیم یک‌باره کم‌ریسک‌تر است.';
 if(a.signal==='SELL' && a.score>=70) return '🔴 <b>فشار نزولی بیشتر شده است.</b> برای دارنده طلای فیزیکی، برنامه خروج پله‌ای یا صبر برای تأیید برگشت می‌تواند بررسی شود؛ این یک پیش‌بینی قطعی نیست.';
 if(a.signal==='WATCH_BUY') return '🟡 <b>بازار در حال متمایل شدن به خرید است.</b> هنوز تأیید کامل نداریم؛ فعلاً زیر نظر بگیر.';
 if(a.signal==='WATCH_SELL') return '🟠 <b>فشار فروش در حال بیشتر شدن است.</b> هنوز تأیید کامل نداریم؛ برای فروش عجله نکن و تغییر روند را دنبال کن.';
 return '⚪ <b>فعلاً بازار تصمیم مشخصی ندارد.</b> برای طلای فیزیکی، نگهداری و صبر تا روشن‌تر شدن روند می‌تواند از واکنش به نوسان‌های کوتاه‌مدت جلوگیری کند.';
}
let chartRange=60;
function chartMoney(n){return n==null?'—':fa(n)+' ریال'}
function renderGoldChart(prices){
 const wrap=document.getElementById('goldChart'); if(!wrap)return;
 const raw=(prices||[]).map(Number).filter(Number.isFinite).slice(-chartRange);
 if(raw.length<2){wrap.innerHTML='<div class="chartEmpty">داده کافی برای رسم نمودار هنوز جمع نشده است.</div>';return}
 const w=900,h=230,padX=12,padY=18,min=Math.min(...raw),max=Math.max(...raw),range=max-min||1;
 const points=raw.map((v,i)=>{const x=padX+i*(w-2*padX)/(raw.length-1);const y=h-padY-(v-min)/range*(h-2*padY);return [x,y,v]});
 const poly=points.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
 const area=poly+' '+(w-padX)+','+(h-padY)+' '+padX+','+(h-padY);
 const last=points.at(-1);
 wrap.innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="نمودار قیمت طلای ۱۸ عیار"><defs><linearGradient id="goldArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#e7bd62" stop-opacity=".28"/><stop offset="100%" stop-color="#e7bd62" stop-opacity="0"/></linearGradient></defs><line x1="${padX}" y1="${padY}" x2="${w-padX}" y2="${padY}" class="chartGrid"/><line x1="${padX}" y1="${h/2}" x2="${w-padX}" y2="${h/2}" class="chartGrid"/><line x1="${padX}" y1="${h-padY}" x2="${w-padX}" y2="${h-padY}" class="chartGrid"/><text x="${w-padX}" y="14" text-anchor="end" class="chartAxis">${chartMoney(max)}</text><text x="${w-padX}" y="${h-4}" text-anchor="end" class="chartAxis">${chartMoney(min)}</text><polygon points="${area}" class="chartArea"/><polyline points="${poly}" class="chartLine"/><circle cx="${last[0]}" cy="${last[1]}" r="5" class="chartDot"/></svg>`;
 document.getElementById('chartLast').textContent=chartMoney(raw.at(-1));
 document.getElementById('chartLow').textContent=chartMoney(min);
 document.getElementById('chartHigh').textContent=chartMoney(max);
 const first=raw[0],delta=first?(raw.at(-1)/first-1)*100:0,chg=document.getElementById('chartChange');
 chg.textContent=(delta>=0?'▲ ':'▼ ')+f2(Math.abs(delta))+'٪'; chg.style.color=delta>=0?'var(--green)':'var(--red)';
 const u=document.getElementById('chartUpdated'); if(u&&latest?.updatedAt)u.textContent='آخرین بروزرسانی: '+new Date(latest.updatedAt).toLocaleTimeString('fa-IR')+' • '+fa(raw.length)+' نقطه';
}
function initChartControls(){document.querySelectorAll('[data-range]').forEach(btn=>btn.addEventListener('click',()=>{chartRange=Number(btn.dataset.range)||60;document.querySelectorAll('[data-range]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');renderGoldChart(latest?.prices||[])}))}

function openAccountQuickMenu(){ applyCategory('account'); setTimeout(()=>document.getElementById('account')?.scrollIntoView({behavior:'smooth',block:'start'}),50); }

async function forgotPasswordPrompt(){
 const mobile=prompt('شماره موبایل حساب را وارد کنید:');
 if(!mobile)return;
 try{
  const r=await fetch('/api/account/forgot-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:mobile})});
  const d=await r.json(); alert(d.message||d.error||'درخواست ارسال شد.');
 }catch(e){alert('خطا در ارتباط با سرور');}
}

function logoutAndRelogin(){ logoutAccount(); setTimeout(()=>{showAuthGate(true);showAuthMode('login');},120); }
function updateCommandCenter(){
 const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
 const p=window.__lastPortfolioSnapshot||null, a=latest?.analysis||{}, r=latest?.portfolioRisk||null;
 set('ccPortfolioValue',p?moneyIRR(p.totalValue):'—');
 set('ccPortfolioPnl',p?((p.pnl>=0?'▲ ':'▼ ')+moneyIRR(Math.abs(p.pnl))):'سبد ثبت نشده');
 set('ccTrend',a.trendFa||a.signal||'—');
 set('ccTrendMeta',a.score!=null?'امتیاز '+f2(a.score)+'٪':'—');
 set('ccRisk',r?.risk==='HIGH'?'بالا':r?.risk==='WATCH'?'مراقبت':'عادی');
 set('ccAlerts',String(document.querySelectorAll('.alertItem,.alertRow').length||0));
 const q=document.getElementById('quickAccountStatus'); if(q) q.textContent=accountToken?'🟢 وارد شده':'🔒 نیاز به ورود';
}
async function load(streamState=null){
 try{
  const oldLatest=latest; const s=streamState || await fetch('/api/state',{cache:'no-store'}).then(r=>r.json());latest=s;pollMs=s.config?.pollMs||10000;renderGoldChart(s.prices||[]);
  const es=s.engineStatus||{}; const mainLive=es.status==='LIVE'; document.getElementById('status').textContent=mainLive?'🟢 LIVE':es.status==='STALE'?'🟡 آخرین قیمت معتبر':'🔴 آفلاین'; document.getElementById('dot').className='dot'+(mainLive?'':' off');
  if(s.iran){const livePrice=Number(s.iran.priceIRR||0);const prevPrice=Number(oldLatest?.iran?.priceIRR||0);document.getElementById('price').textContent=moneyIRR(livePrice);document.getElementById('updated').textContent='آخرین دریافت: '+new Date(s.updatedAt||s.iran.at).toLocaleTimeString('fa-IR');const tp=document.getElementById('tickerPrice');if(tp)tp.textContent=moneyIRR(livePrice);const lp=document.getElementById('livePriceBig');if(lp)lp.textContent=fa(livePrice);const tm=document.getElementById('tickerTime');if(tm)tm.textContent='اکنون • '+new Date(s.updatedAt||s.iran.at).toLocaleTimeString('fa-IR');const ls=document.getElementById('liveStatus');if(ls)ls.innerHTML='<span class=\"pushDot\"></span> آنلاین • بروزرسانی خودکار';const lc=document.getElementById('liveChange'),tc=document.getElementById('tickerChange');if(prevPrice>0){const d=(livePrice/prevPrice-1)*100;const txt=(d>=0?'▲ ':'▼ ')+f2(Math.abs(d))+'٪';if(lc){lc.textContent=txt;lc.className='change '+(d>=0?'up':'down')}if(tc){tc.textContent=txt;tc.className='tickerChange '+(d>=0?'upTxt':'downTxt')}}else{if(lc)lc.textContent='—';if(tc)tc.textContent='—'}}
  if(s.global?.xauUsd){const x='$'+Number(s.global.xauUsd).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});document.getElementById('xau').textContent=x;const lx=document.getElementById('liveXau');if(lx)lx.textContent=x;}
  if(s.dollar?.priceIRR){document.getElementById('dollar').textContent=moneyIRR(s.dollar.priceIRR);const ld=document.getElementById('liveDollar');if(ld)ld.textContent=moneyIRR(s.dollar.priceIRR);}
  document.getElementById('ready').textContent=s.dataReady?'آماده تحلیل':'در حال تکمیل داده';
  if(portfolioItems.length) { const current=Number(s.iran?.priceIRR||0); const totalCost=portfolioItems.reduce((a,x)=>a+Number(x.weight||0)*Number(x.buyPrice||0),0); const totalValue=portfolioItems.reduce((a,x)=>a+Number(x.weight||0)*current*(Number(x.purity||750)/750),0); window.__lastPortfolioSnapshot={totalCost,totalValue,pnl:totalValue-totalCost}; renderPortfolio({currentGold18IRR:current,updatedAt:s.updatedAt}); } updateCommandCenter();
  loadPortfolioRisk();
  const a=s.analysis;
  if(a){
   const el=document.getElementById('signal');el.className='signal '+(a.signal==='BUY'?'BUY':a.signal==='SELL'?'SELL':'');
   const title=a.signal==='BUY'?'🟢 سیگنال خرید':a.signal==='SELL'?'🔴 سیگنال فروش':a.signal==='WATCH_BUY'?'🟡 آماده‌باش خرید':a.signal==='WATCH_SELL'?'🟠 آماده‌باش فروش':'⏳ بدون سیگنال قوی';
   document.getElementById('sigTitle').textContent=title;document.getElementById('sigText').innerHTML=`امتیاز ${fa(a.score)}٪ • ${a.ready?'تحلیل کامل':'داده در حال تکمیل'}<br>${esc(a.reasons?.join(' • ')||'—')}`;
   const p=a.price;const t1=a.signal==='SELL'?p*.985:p*1.015,t2=a.signal==='SELL'?p*.97:p*1.03,sl=a.signal==='SELL'?p*1.01:p*.99;
   document.getElementById('entryTarget').textContent=moneyIRR(p);document.getElementById('target1').textContent=moneyIRR(t1);document.getElementById('stop').textContent=moneyIRR(sl);
   document.getElementById('rsi').textContent=a.rsi!=null?f2(a.rsi):'—';document.getElementById('macd').textContent=a.macd?.hist!=null?f2(a.macd.hist):'—';
   document.getElementById('ema9').textContent=a.ema9!=null?moneyIRR(a.ema9):'—';document.getElementById('ema21').textContent=a.ema21!=null?moneyIRR(a.ema21):'—';
   document.getElementById('bullbar').style.width=Math.min(100,a.bull)+'%';document.getElementById('bearbar').style.width=Math.min(100,a.bear)+'%';document.getElementById('sample').textContent=fa(a.sampleSize||0)+' داده';document.getElementById('reasons').textContent=a.reasons?.join(' • ')||'—';document.getElementById('holderView').innerHTML=holderOpinion(a,s.marketPressure);
  }
  const mp=s.marketPressure;if(mp){document.getElementById('buyPressure').textContent=pct(mp.buy);document.getElementById('sellPressure').textContent=pct(mp.sell);document.getElementById('buyBar').style.width=Math.min(100,mp.buy)+'%';document.getElementById('sellBar').style.width=Math.min(100,mp.sell)+'%';document.getElementById('pressureText').textContent=`${mp.label} • اطمینان برآوردی ${fa(mp.confidence)}٪. ${mp.disclaimer||''}`;}
  const c=s.coins||{};setAsset('emami',c.emami);setAsset('bahar',c.bahar);setAsset('half',c.half);setAsset('quarter',c.quarter);setAsset('gram',c.gram);
  document.getElementById('bEmami').textContent=moneyIRR(c.bubbles?.emami);document.getElementById('bHalf').textContent=moneyIRR(c.bubbles?.half);document.getElementById('bQuarter').textContent=moneyIRR(c.bubbles?.quarter);
  const t=s.activeTrade;document.getElementById('targetStatus').innerHTML=t?`<b>${t.signal==='BUY'?'🟢 معامله خرید':'🔴 معامله فروش'}</b> • ورود ${moneyIRR(t.entry)}<br>🎯 هدف اول ${moneyIRR(t.target1)} ${t.target1Hit?'✅':''} • 🏆 هدف دوم ${moneyIRR(t.target2)} ${t.target2Hit?'✅':''} • 🛑 حد ضرر ${moneyIRR(t.stop)} ${t.stopHit?'⚠️':''}`:'هنوز معامله فعالی ثبت نشده است.';
  document.getElementById('targetEvents').innerHTML=(s.targetEvents||[]).slice(0,6).map(e=>`<div class="event">${e.kind==='stop'?'🛑':e.kind==='target2'?'🏆':'🎯'} ${e.kind==='stop'?'حد ضرر':e.kind==='target2'?'هدف دوم':'هدف اول'} • ${moneyIRR(e.price)} • ${new Date(e.at).toLocaleString('fa-IR')}</div>`).join('');
  const ev=s.events||[];document.getElementById('change').textContent=a?.score?`امتیاز تحلیل ${fa(a.score)}٪`:'داده لحظه‌ای';startCountdown();
 }catch(e){document.getElementById('status').textContent='آفلاین';document.getElementById('dot').className='dot off';startCountdown()}
}
async function news(){
 try{
  const n=await fetch('/api/news?deviceId='+encodeURIComponent(deviceId),{cache:'no-store'}).then(r=>r.json());
  document.getElementById('newsList').innerHTML=n.length?n.slice(0,12).map(x=>{const impact=x.impact==='high'?'اثر بالا':x.impact==='watch'?'قابل توجه':'ترکیبی';const dir=x.direction==='supportive'?'محرک احتمالی صعودی':x.direction==='pressure'?'فشار احتمالی نزولی':'اثر دوطرفه';return `<div class="newsItem"><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a><div class="newsMeta"><span>${esc(x.source||x.domain||'منبع')}</span><span class="badge ${esc(x.impact)}">${impact}</span><span class="badge ${esc(x.direction==='pressure'?'pressureTxt':x.direction)}">${dir}</span></div></div>`}).join(''):'خبر مرتبطی دریافت نشد.';
 }catch{document.getElementById('newsList').textContent='دریافت اخبار موقتاً ناموفق بود.'}
}
function calcSell(){
 const w=Number(document.getElementById('sellWeight').value),pur=Number(document.getElementById('sellPurity').value||750),disc=Number(document.getElementById('shopDiscount').value||0),p=latest?.iran?.priceIRR;
 if(!w||!p||!pur){document.getElementById('sellResult').textContent='وزن را وارد کنید.';return}
 const raw=w*p*(pur/750), after=raw*(1-disc/100);
 document.getElementById('sellResult').innerHTML=`ارزش پایه طلا: <b>${moneyIRR(raw)}</b><br>کسر خرید مغازه (${f2(disc)}٪): <b>${moneyIRR(raw-after)}</b><br>مبلغ تقریبی دریافتی: <b>${moneyIRR(after)}</b><br><span class="small">اجرت و سود خرید قبلی در این برآورد به ارزش فروش مجدد اضافه نشده‌اند.</span>`;
}
function calcBuy(){
 const w=Number(document.getElementById('buyWeight').value),making=Number(document.getElementById('making').value||0),profit=Number(document.getElementById('dealerProfit').value||0),vat=Number(document.getElementById('vat').value||0),p=latest?.iran?.priceIRR;
 if(!w||!p){document.getElementById('buyResult').textContent='وزن را وارد کنید.';return}
 const gold=w*p, make=gold*making/100, dealer=(gold+make)*profit/100, tax=(make+dealer)*vat/100,total=gold+make+dealer+tax;
 document.getElementById('buyResult').innerHTML=`اصل طلا: <b>${moneyIRR(gold)}</b><br>اجرت: ${moneyIRR(make)} • سود فروشنده: ${moneyIRR(dealer)} • مالیات: ${moneyIRR(tax)}<br>قیمت تقریبی فاکتور: <b>${moneyIRR(total)}</b>`;
}
async function manualRefresh(){await load();await news()}
async function enableBrowserNotification(){if(!('Notification'in window)){alert('مرورگر اعلان را پشتیبانی نمی‌کند');return}const p=Notification.permission==='granted'?'granted':await Notification.requestPermission();if(p!=='granted'){alert('اجازه اعلان داده نشد.');return}try{await enablePush(true);alert('✅ اعلان‌های کامپیوتر و Push فعال شد.');}catch(e){alert('⚠️ اعلان مرورگر فعال شد، اما Push کامل نشد: '+e.message)}}
function showDesktopAlert(title,body,url='/'){try{if(!('Notification'in window)||Notification.permission!=='granted')return;const n=new Notification(title,{body,icon:'/icon-192.png',badge:'/icon-192.png',tag:'gold-alert-'+Date.now()});n.onclick=()=>{window.focus();if(url)location.hash=url.replace(/^#?/,'#');n.close()};}catch{}}
function pushSubscriptionPayload(sub){
 const json=typeof sub?.toJSON==='function'?sub.toJSON():null;
 const keys=json?.keys||{};
 return {
  endpoint:json?.endpoint||sub?.endpoint||'',
  expirationTime:json?.expirationTime??sub?.expirationTime??null,
  keys:{p256dh:keys.p256dh||'',auth:keys.auth||''},
  deviceId
 };
}
async function savePushSubscription(sub){
 return fetch('/api/push/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pushSubscriptionPayload(sub))}).then(r=>r.json());
}
async function enablePush(silent=false){
 try{
  if(!('serviceWorker'in navigator)||!('PushManager'in window))throw new Error('Push در این مرورگر پشتیبانی نمی‌شود');
  if(!('Notification'in window))throw new Error('اعلان در این مرورگر پشتیبانی نمی‌شود');
  const status=await fetch('/api/push/status',{cache:'no-store'}).then(r=>r.json());
  if(!status.configured)throw new Error('کلید Push روی سرور آماده نشده است.');
  const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
  if(permission!=='granted')throw new Error('اجازه اعلان داده نشد');
  const reg=await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const k=await fetch('/api/push/public-key',{cache:'no-store'}).then(r=>r.json());
  if(!k.publicKey)throw new Error('کلید Push روی سرور تنظیم نشده است');
  const subscribeFresh=async()=>reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(k.publicKey)});
  let sub=await reg.pushManager.getSubscription();
  // Re-create the browser subscription so a subscription made with an older VAPID key cannot linger.
  if(sub){ try{await sub.unsubscribe()}catch{} }
  sub=await subscribeFresh();
  let saved=await savePushSubscription(sub);
  if(!saved.ok){
    // Recover stale subscriptions created with an older VAPID key.
    try{await sub.unsubscribe()}catch{}
    await fetch('/api/push/reset-device',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId,accountToken})}).catch(()=>{});
    sub=await subscribeFresh();
    saved=await savePushSubscription(sub);
  }
  if(!saved.ok)throw new Error(saved.error||'ثبت اعلان انجام نشد');
  alert('✅ اعلان‌های گوشی فعال شد. هشدار قیمت هدف هم از همین‌جا برایت ارسال می‌شود.');
 }catch(e){alert('⚠️ '+e.message)}
}
function urlBase64ToUint8Array(s){const padding='='.repeat((4-s.length%4)%4),base64=(s+padding).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
async function runBacktest(){const el=document.getElementById('bt');el.textContent='در حال اجرای بک‌تست...';try{const x=await fetch('/api/backtest?deviceId='+encodeURIComponent(deviceId)+'&accountToken='+encodeURIComponent(accountToken)).then(r=>r.json());if(x.error)throw new Error(x.error);el.innerHTML=`دوره ${x.from} تا ${x.to}<br>معاملات: <b>${fa(x.trades)}</b> • موفقیت: <b>${f2(x.winRate)}٪</b><br>سود خالص تاریخی: <b>${f2(x.netReturn)}٪</b> • افت سرمایه: ${f2(x.maxDrawdown)}٪`}catch(e){el.textContent='خطا: '+e.message}}
async function installApp(){if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;document.getElementById('installBtn').style.display='none';const h=document.getElementById('installBtnHero');if(h)h.style.display='none'}else alert('در Chrome اندروید: منوی ⋮ → افزودن به صفحه اصلی / Install app')}
function registerSW(){if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js')}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;document.getElementById('installBtn').style.display='inline-block';const h=document.getElementById('installBtnHero');if(h)h.style.display='inline-block'});window.addEventListener('appinstalled',()=>{document.getElementById('installBtn').style.display='none';const h=document.getElementById('installBtnHero');if(h)h.style.display='none'});
let liveStream=null, streamFallbackTimer=null;
function connectLiveStream(){
  if(!('EventSource' in window)){ streamFallbackTimer=setInterval(()=>load(),10000); return; }
  liveStream=new EventSource('/api/stream');
  liveStream.addEventListener('market',e=>{ try{ load(JSON.parse(e.data)); if(Date.now()-aiCopilotLastCall>60000) refreshAICopilot(false,aiCopilotPage); }catch{} });
  liveStream.onopen=()=>{ const s=document.getElementById('liveStatus'); if(s)s.innerHTML='<span class="pushDot"></span> آنلاین • اتصال زنده'; if(streamFallbackTimer){clearInterval(streamFallbackTimer);streamFallbackTimer=null;} };
  liveStream.onerror=()=>{ const s=document.getElementById('liveStatus'); if(s)s.innerHTML='<span class="pushDot"></span> در حال اتصال مجدد…'; if(!streamFallbackTimer)streamFallbackTimer=setInterval(()=>load(),10000); };
}
registerSW();load();connectLiveStream();loadPortfolio();loadUserSettings();news();initChartControls();setInterval(loadPortfolio,10000);setInterval(news,180000);

async function loadAIHealth(){
 const status=document.getElementById('aiStatus');
 if(!status)return;
 try{
   const r=await fetch('/api/ai-health?v=10.1.0',{cache:'no-store'});
   const d=await r.json().catch(()=>({}));
   if(!r.ok) throw new Error(d.error||'خطای اتصال');
   status.textContent=d.configured ? `🟢 اتصال هوش مصنوعی آماده است • ${d.provider||'GapGPT'} • ${d.model||''}` : '🟠 کلید GapGPT روی سرور تنظیم نشده است';
 }catch(e){ status.textContent='🔴 وضعیت هوش مصنوعی قابل دریافت نیست'; }
}

async function runAIAnalysis(){
 const btn=document.getElementById('aiBtn'), box=document.getElementById('aiResult'), meta=document.getElementById('aiMeta');
 if(!btn||!box)return;
 btn.disabled=true; btn.textContent='⏳ در حال تحلیل داده‌های لحظه‌ای...'; box.style.display='block'; box.textContent='در حال دریافت تحلیل از GapGPT...'; if(meta) meta.textContent='';
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),35000);
 try{
   const r=await fetch('/api/ai-analysis',{method:'POST',headers:{'Content-Type':'application/json','Cache-Control':'no-cache'},cache:'no-store',signal:controller.signal,body:JSON.stringify({deviceId,accountToken})});
   const raw=await r.text();
   let d={}; try{ d=JSON.parse(raw); }catch{ d={error:raw||'پاسخ نامعتبر از سرور'}; }
   if(!r.ok) throw new Error(d.error||`خطای سرور (${r.status})`);
   box.textContent=d.text||'پاسخی دریافت نشد.';
   if(meta) meta.textContent='GapGPT • مدل: '+(d.model||'نامشخص')+' • داده بازار: '+new Date(d.dataAt||Date.now()).toLocaleTimeString('fa-IR');
 }catch(e){
   const msg=e.name==='AbortError' ? 'زمان پاسخ‌گویی تمام شد؛ اتصال GapGPT یا تنظیمات سرور را بررسی کن.' : (e.message||'خطای ناشناخته');
   box.textContent='⚠️ '+msg;
   if(meta) meta.textContent='برای بررسی، بخش Logs را ببین.';
 }finally{
   clearTimeout(timer);
   btn.disabled=false; btn.textContent='🤖 تحلیل لحظه‌ای بازار + نمودار';
   loadAIHealth();
 }
}

window.runAIAnalysis=runAIAnalysis;
document.addEventListener('DOMContentLoaded',()=>{loadTheme();
 const btn=document.getElementById('aiBtn');
 if(btn) btn.addEventListener('click',runAIAnalysis);
 loadAIHealth();
});

// v33: in-app update manager. User data stays on the persistent server data directory.
let updateInfo=null;
async function checkForAppUpdate(silent=false){
 try{const r=await fetch('/api/update?ts='+Date.now(),{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطای بررسی نسخه');updateInfo=d;const banner=document.getElementById('updateBanner'),txt=document.getElementById('updateText');if(d.available){if(txt)txt.textContent=`نسخه ${d.version} آماده است${d.notes?' • '+d.notes:''}`;if(banner)banner.style.display='block';}else if(banner)banner.style.display='none';return d;}catch(e){if(!silent)alert('⚠️ بررسی آپدیت ناموفق بود: '+e.message);return null;}
}
async function applyAppUpdate(){
 if(!updateInfo?.available)return checkForAppUpdate();
 const mandatory=!!updateInfo.mandatory; if(!mandatory&&!confirm(`نسخه ${updateInfo.version} نصب شود؟ اطلاعات حساب و سبد شما حفظ می‌شود.`))return;
 const btn=document.getElementById('updateBtn');if(btn){btn.disabled=true;btn.textContent='⏳ در حال آپدیت...';}
 try{const r=await fetch('/api/update/apply',{method:'POST',headers:{'Content-Type':'application/json','x-account-token':accountToken||''},body:JSON.stringify({accountToken,confirm:true})});const d=await r.json();if(!r.ok)throw new Error(d.error||'آپدیت ناموفق');if(d.updated){if(btn)btn.textContent='✅ انجام شد؛ در حال بارگذاری...';setTimeout(()=>location.reload(true),1800);}else alert(d.message||'نسخه جدیدی موجود نیست.');}
 catch(e){alert('⚠️ '+e.message);if(btn){btn.disabled=false;btn.textContent='🔄 آپدیت';}}
}
async function adminCheckUpdate(){const d=await checkForAppUpdate(false);const e=document.getElementById('adminUpdateStatus');if(e)e.textContent=d?.available?`نسخه ${d.version} آماده است`:`نسخه فعلی ${d?.currentVersion||'—'}`;}
document.addEventListener('DOMContentLoaded',()=>{loadTheme(); updateCommandCenter(); const b=document.getElementById('updateBtn'),later=document.getElementById('updateLaterBtn');if(b)b.addEventListener('click',applyAppUpdate);if(later)later.addEventListener('click',()=>{const x=document.getElementById('updateBanner');if(x)x.style.display='none';});setTimeout(()=>checkForAppUpdate(true),2500);});

// v22: clean professional side menu. The dashboard is the only category shown at first load.
const categoryLabels={
 dashboard:'پیشخوان', market:'بازار و نمودار', ai:'هوش و تحلیل', alerts:'هشدارها', tools:'دارایی و ابزار', news:'اخبار بازار', sms:'سرویس SMS', account:'حساب و پشتیبان', decision:'اتاق تصمیم', calendar:'تقویم اقتصادی', admin:'پنل مدیریت'
};
const PUBLIC_CATEGORIES=new Set(['dashboard','account']);
let pendingProtectedCategory='';
function applyCategory(category,scroll=true){
 if(category!=='dashboard' && category!=='admin' && !PUBLIC_CATEGORIES.has(category) && !accountToken){
   pendingProtectedCategory=category;
   showAuthGate(true,'برای استفاده از این بخش ابتدا وارد حساب شوید.');
   return false;
 }
 document.querySelectorAll('.categorySection').forEach(el=>{el.classList.remove('categoryVisible');el.style.display='none';});
 document.body.classList.toggle('categoryView',category!=='dashboard');
 document.querySelectorAll('.menuItem').forEach(b=>b.classList.toggle('active',b.dataset.category===category));
 document.querySelectorAll('.category-'+category).forEach(el=>{el.classList.add('categoryVisible');el.style.display='block';});
 const title=document.getElementById('categoryTitle');
 const desc=document.getElementById('categoryDesc');
 if(title) title.textContent=categoryLabels[category]||'بخش';
 if(desc) desc.textContent=category==='dashboard'?'قیمت زنده، وضعیت امروز و سیگنال کلی بازار':'فقط ابزارهای مرتبط با '+(categoryLabels[category]||'این بخش')+' نمایش داده می‌شوند.';
 if(scroll){
   const first=document.querySelector('.category-'+category);
   if(first) setTimeout(()=>first.scrollIntoView({behavior:'smooth',block:'start'}),40);
   else window.scrollTo({top:0,behavior:'smooth'});
 }
 aiCopilotPage=category;
 if(typeof refreshAICopilot==='function') refreshAICopilot(false,category);
 return true;
}
function closeSideMenu(){
 const menu=document.getElementById('sideMenu'),back=document.getElementById('menuBackdrop'),btn=document.getElementById('floatingMenuBtn');
 if(menu)menu.classList.remove('open'); if(back)back.classList.remove('open');
 if(menu)menu.setAttribute('aria-hidden','true'); if(btn)btn.setAttribute('aria-expanded','false');
}
function openSideMenu(){
 const menu=document.getElementById('sideMenu'),back=document.getElementById('menuBackdrop'),btn=document.getElementById('floatingMenuBtn');
 if(menu)menu.classList.add('open'); if(back)back.classList.add('open');
 if(menu)menu.setAttribute('aria-hidden','false'); if(btn)btn.setAttribute('aria-expanded','true');
}
function initSideMenu(){
 const btn=document.getElementById('floatingMenuBtn'),close=document.getElementById('menuClose'),back=document.getElementById('menuBackdrop');
 if(btn)btn.addEventListener('click',()=>{const open=document.getElementById('sideMenu')?.classList.contains('open');open?closeSideMenu():openSideMenu()});
 if(close)close.addEventListener('click',closeSideMenu);
 if(back)back.addEventListener('click',closeSideMenu);
 document.querySelectorAll('.menuItem').forEach(item=>item.addEventListener('click',()=>{
   const category=item.dataset.category||'dashboard';
   closeSideMenu();
   if(category==='admin'){
     // Always require a fresh credential check when the admin menu is opened.
     adminForceLogout(true);
     showAdminLoginGate();
     return;
   }
   applyCategory(category,true);
 }));
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSideMenu()});
 applyCategory('dashboard',false);
}
document.addEventListener('DOMContentLoaded',()=>{loadTheme();const u=document.getElementById('adminUsernameInput');const p=document.getElementById('adminPasswordInput');if(u)u.value='';if(p)p.value='';});
document.addEventListener('DOMContentLoaded',initSideMenu);

// v14: server-backed personal price alerts with background push notifications.
let serverPriceAlerts=[];
async function fetchPriceAlerts(){
 try{const r=await fetch('/api/price-alerts?deviceId='+encodeURIComponent(deviceId),{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطای دریافت هشدارها');serverPriceAlerts=Array.isArray(d.alerts)?d.alerts:[];renderPriceAlerts();}catch(e){const box=document.getElementById('alertList');if(box)box.innerHTML='<div class="emptyAlert">⚠️ دریافت هشدارها ناموفق بود.</div>';}}
function renderPriceAlerts(){
 const box=document.getElementById('alertList'); if(!box)return;
 if(!serverPriceAlerts.length){box.innerHTML='<div class="emptyAlert">هنوز هشداری ثبت نشده است.</div>';return}
 box.innerHTML=serverPriceAlerts.map(a=>{const done=!!a.triggeredAt;const dir=a.direction==='above'?'⬆️ بالاتر از':'⬇️ پایین‌تر از';return `<div class="alertRow ${done?'triggered':''}"><div>${dir} <b>${moneyIRR(a.price)}</b><div class="small">${a.label||'طلای ۱۸ عیار'} • ${done?'✅ فعال شد':'🟢 فعال'} • ${a.createdAt?new Date(a.createdAt).toLocaleString('fa-IR'):''}</div></div><button class="secondary" onclick="removePriceAlert('${esc(a.id)}')">حذف</button></div>`}).join('')
}
async function addPriceAlert(){
 const input=document.getElementById('alertPrice'), dir=document.getElementById('alertDirection');
 const price=Number(input?.value); if(!price||price<=0){alert('قیمت هدف را وارد کن.');return}
 try{const r=await fetch('/api/price-alerts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId,price,direction:dir?.value||'above',label:'طلای ۱۸ عیار'})});const d=await r.json();if(!r.ok)throw new Error(d.error||'ثبت هشدار ناموفق بود');serverPriceAlerts.unshift(d.alert);renderPriceAlerts();input.value='';alert('✅ هشدار روی سرور ثبت شد. حتی اگر صفحه بسته باشد، در صورت فعال بودن Push اعلان ارسال می‌شود.');}catch(e){alert('⚠️ '+e.message)}}
async function removePriceAlert(id){try{const r=await fetch('/api/price-alerts/'+encodeURIComponent(id)+'?deviceId='+encodeURIComponent(deviceId),{method:'DELETE'});const d=await r.json();if(!r.ok)throw new Error(d.error||'حذف ناموفق بود');serverPriceAlerts=serverPriceAlerts.filter(a=>String(a.id)!==String(id));renderPriceAlerts();}catch(e){alert('⚠️ '+e.message)}}
function checkPriceAlerts(){fetchPriceAlerts()}
// v23: server-backed portfolio with auto-save, edit/delete and AI allocation guidance.
let portfolioItems=[];
let editingPortfolioId=null;
function portfolioSnapshotLocal(){
 const current=Number(latest?.iran?.priceIRR||0);
 return portfolioItems.map(x=>{const purityFactor=Number(x.purity||750)/750;const cost=Number(x.weight)*Number(x.buyPrice);const value=Number(x.weight)*current*purityFactor;return {...x,currentPerGram:current*purityFactor,cost,value,pnl:value-cost,pnlPct:cost?(value-cost)/cost*100:0}});
}
async function loadPortfolioRisk(){
 const box=document.getElementById('portfolioRiskBox'); if(!box)return;
 try{const r=await fetch('/api/portfolio-risk?deviceId='+encodeURIComponent(deviceId),{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطای دریافت هشدار دارایی');const x=d.risk||{};
  if(!d.hasPortfolio){box.className='portfolioRisk normal';box.innerHTML='🔔 بعد از ثبت دارایی، پایش خودکار شرایط فروش برای این دارایی فعال می‌شود.';return;}
  if(x.risk==='HIGH'){box.className='portfolioRisk high';box.innerHTML=`🛑 <b>هشدار نزولی قوی</b><br>سیگنال: ${esc(x.signal||'—')} • امتیاز ${fa(x.score)}٪ • فشار فروش ${fa(x.sellPressure)}٪<br><span>این هشدار برای بررسی فروش/کاهش پله‌ای است، نه دستور قطعی فروش.</span>`;}
  else if(x.risk==='WATCH'){box.className='portfolioRisk watch';box.innerHTML=`⚠️ <b>شرایط بازار نیاز به توجه دارد</b><br>افت از سقف اخیر: ${f2(Math.abs(x.drawdownPct||0))}٪ • فشار فروش ${fa(x.sellPressure)}٪ • سیگنال ${esc(x.signal||'—')}<br><span>برای تصمیم، تحلیل AI و نمودار را هم بررسی کن.</span>`;}
  else {box.className='portfolioRisk normal';box.innerHTML=`🟢 <b>پایش دارایی فعال است</b><br>قیمت فعلی ${moneyIRR(x.current)} • افت از سقف اخیر ${f2(Math.abs(x.drawdownPct||0))}٪<br><span>در صورت تقویت شرایط نزولی، هشدار خودکار ارسال می‌شود.</span>`;}
 }catch(e){box.className='portfolioRisk normal';box.textContent='وضعیت هشدار دارایی فعلاً قابل دریافت نیست.';}
}
async function loadPortfolio(){
 try{const r=await fetch('/api/portfolio?deviceId='+encodeURIComponent(deviceId),{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطای دریافت دارایی');portfolioItems=Array.isArray(d.items)?d.items:[];if(d.snapshot?.currentGold18IRR && latest?.iran==null) latest={...(latest||{}),iran:{priceIRR:d.snapshot.currentGold18IRR},updatedAt:d.snapshot.updatedAt};renderPortfolio(d.snapshot);loadPortfolioRisk();}catch(e){const box=document.getElementById('portfolioRows');if(box)box.innerHTML='<div class="portfolioEmpty">⚠️ اطلاعات دارایی فعلاً دریافت نشد.</div>';}}
function renderPortfolio(snapshot){
 const rows=document.getElementById('portfolioRows');if(!rows)return;const list=portfolioItems;
 if(!list.length){rows.innerHTML='<div class="portfolioEmpty">هنوز دارایی ثبت نشده است.</div>';}else{
  const live=portfolioSnapshotLocal();
  rows.innerHTML=live.map(x=>`<div class="holdingRow"><div><b>${esc(x.note||'طلای فیزیکی')}</b><small>${f2(x.weight)} گرم • عیار ${fa(x.purity||750)} • خرید هر گرم ${moneyIRR(x.buyPrice)}</small></div><div><small>هزینه خرید</small><b>${moneyIRR(x.cost)}</b></div><div><small>ارزش فعلی</small><b>${moneyIRR(x.value)}</b></div><div class="holdingActions"><button class="secondary" onclick="editPortfolioHolding('${esc(x.id)}')">ویرایش</button><button class="secondary" onclick="removePortfolioHolding('${esc(x.id)}')">حذف</button></div></div>`).join('');
 }
 const live=portfolioSnapshotLocal(), weight=live.reduce((a,x)=>a+Number(x.weight||0),0),cost=live.reduce((a,x)=>a+x.cost,0),value=live.reduce((a,x)=>a+x.value,0),pnl=value-cost,pnlPct=cost?pnl/cost*100:0,current=Number(latest?.iran?.priceIRR||snapshot?.currentGold18IRR||0);
 const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};set('portfolioValue',moneyIRR(value));set('portfolioWeight',f2(weight)+' گرم');set('portfolioAvg',weight?moneyIRR(cost/weight):'—');set('portfolioCurrent',current?moneyIRR(current):'—');set('portfolioPnl',(pnl>=0?'▲ ':'▼ ')+moneyIRR(Math.abs(pnl)));set('portfolioPnlPct',(pnl>=0?'▲ ':'▼ ')+f2(Math.abs(pnlPct))+'٪');set('portfolioSummary',list.length?`${fa(list.length)} مورد دارایی • بروزرسانی زنده`:'هنوز دارایی ثبت نشده است.');
 const pe=document.getElementById('portfolioPnl');if(pe)pe.className=pnl>=0?'upTxt':'downTxt';const pp=document.getElementById('portfolioPnlPct');if(pp)pp.className=pnl>=0?'upTxt':'downTxt';
}
function resetPortfolioForm(){editingPortfolioId=null;['pfWeight','pfBuyPrice','pfNote'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});const purity=document.getElementById('pfPurity');if(purity)purity.value='750';const btn=document.getElementById('pfSaveBtn');if(btn)btn.textContent='ثبت دارایی';}
function editPortfolioHolding(id){const x=portfolioItems.find(v=>v.id===id);if(!x)return;editingPortfolioId=id;document.getElementById('pfWeight').value=x.weight;document.getElementById('pfBuyPrice').value=x.buyPrice;document.getElementById('pfPurity').value=x.purity||750;document.getElementById('pfNote').value=x.note||'';const btn=document.getElementById('pfSaveBtn');if(btn)btn.textContent='💾 ذخیره ویرایش';document.getElementById('portfolio')?.scrollIntoView({behavior:'smooth',block:'start'});}
async function savePortfolioForm(auto=false){
 const weight=Number(document.getElementById('pfWeight')?.value),buyPrice=Number(document.getElementById('pfBuyPrice')?.value),purity=Number(document.getElementById('pfPurity')?.value||750),note=(document.getElementById('pfNote')?.value||'طلای فیزیکی').trim();
 if(!weight||weight<=0||!buyPrice||buyPrice<=0||!purity||purity<1||purity>1000){alert('وزن، قیمت خرید و عیار را درست وارد کن.');return}
 const payload={deviceId,weight,buyPrice,purity,note}; const editing=editingPortfolioId; try{const r=await fetch(editing?'/api/portfolio/'+encodeURIComponent(editing):'/api/portfolio',{method:editing?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw new Error(d.error||'ذخیره ناموفق بود');portfolioItems=Array.isArray(d.saved)?d.saved:portfolioItems;renderPortfolio(d.snapshot);loadPortfolioRisk();document.getElementById('portfolioAutoSave').textContent='✅ '+(auto?'ذخیره خودکار انجام شد':'آخرین تغییر ذخیره شد')+' • '+new Date().toLocaleTimeString('fa-IR');if(!auto)resetPortfolioForm();}catch(e){alert('⚠️ '+e.message)}
}
async function removePortfolioHolding(id){try{const r=await fetch('/api/portfolio/'+encodeURIComponent(id)+'?deviceId='+encodeURIComponent(deviceId),{method:'DELETE'});const d=await r.json();if(!r.ok)throw new Error(d.error||'حذف ناموفق بود');portfolioItems=Array.isArray(d.saved)?d.saved:portfolioItems.filter(x=>x.id!==id);renderPortfolio(d.snapshot);loadPortfolioRisk();document.getElementById('portfolioAutoSave').textContent='✅ حذف خودکار ذخیره شد';}catch(e){alert('⚠️ '+e.message)}}
async function runPortfolioAI(){const btn=document.getElementById('portfolioAiBtn'),box=document.getElementById('portfolioAiResult');if(!btn||!box)return;btn.disabled=true;btn.textContent='⏳ تحلیل دارایی و بازار...';box.style.display='block';box.textContent='در حال بررسی دارایی شما و شرایط بازار...';try{const r=await fetch('/api/portfolio-analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId,accountToken})});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطای تحلیل');box.textContent=d.text||'پاسخی دریافت نشد.';}catch(e){box.textContent='⚠️ '+e.message}finally{btn.disabled=false;btn.textContent='🧠 تحلیل دارایی من'}}
window.savePortfolioForm=savePortfolioForm;window.editPortfolioHolding=editPortfolioHolding;window.removePortfolioHolding=removePortfolioHolding;window.runPortfolioAI=runPortfolioAI;

function initBottomNav(){document.querySelectorAll('#bottomNav button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('#bottomNav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');const t=document.getElementById(b.dataset.target);if(t)t.scrollIntoView({behavior:'smooth',block:'start'})}))}
window.removePortfolioHolding=removePortfolioHolding;window.editPortfolioHolding=editPortfolioHolding;window.savePortfolioForm=savePortfolioForm;window.runPortfolioAI=runPortfolioAI;window.addPriceAlert=addPriceAlert;window.removePriceAlert=removePriceAlert;


async function loadSmsCommerceInfo(){try{const c=await fetch('/api/commerce-settings',{cache:'no-store'}).then(r=>r.json());const card=document.getElementById('smsCardNumber'),holder=document.getElementById('smsCardHolder');if(card)card.textContent=c.cardNumber||'اطلاعات کارت هنوز توسط مدیریت ثبت نشده است.';if(holder)holder.textContent=c.cardHolder||'';document.querySelectorAll('.smsPrice').forEach(e=>e.textContent=`${fa(Math.round(Number(c.subscriptionPriceIRR||0)/10))} تومان • ${fa(c.subscriptionDays||30)} روز`);}catch{}}
async function adminLoadCommerceSettings(){try{const r=await adminFetch('/api/admin/commerce-settings');const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');const s=d.settings||{};for(const [id,v] of [['commerceCardNumber',s.cardNumber],['commerceCardHolder',s.cardHolder],['commercePriceIRR',s.subscriptionPriceIRR],['commerceDays',s.subscriptionDays],['commerceLabel',s.subscriptionLabel]]){const e=document.getElementById(id);if(e)e.value=v??'';}}catch(e){const x=document.getElementById('commerceSettingsStatus');if(x)x.textContent='تنظیمات دریافت نشد: '+e.message;}}
async function adminSaveCommerceSettings(){try{const body={cardNumber:document.getElementById('commerceCardNumber')?.value||'',cardHolder:document.getElementById('commerceCardHolder')?.value||'',subscriptionPriceIRR:Number(document.getElementById('commercePriceIRR')?.value),subscriptionDays:Number(document.getElementById('commerceDays')?.value),subscriptionLabel:document.getElementById('commerceLabel')?.value||''};const r=await adminFetch('/api/admin/commerce-settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||'ذخیره ناموفق');const x=document.getElementById('commerceSettingsStatus');if(x)x.textContent='تنظیمات ذخیره شد.';await loadSmsCommerceInfo();await loadSmsPremiumStatus();}catch(e){alert('⚠️ '+e.message);}}
async function loadSmsPremiumStatus(){
 const box=document.getElementById('smsPremiumStatus'); if(!box)return;
 try{
  const s=await fetch('/api/sms-premium/status?deviceId='+encodeURIComponent(deviceId),{cache:'no-store'}).then(r=>r.json());
  if(s.active){ box.className='smsStatus ok'; box.innerHTML=`✅ سرویس SMS فعال است.<br>شماره: ${esc(s.phone||'—')}<br>اعتبار تا: ${s.expiresAt?new Date(s.expiresAt).toLocaleDateString('fa-IR'):'—'}<br>ارسال معمول: هر ${fa(s.intervalMin||10)} دقیقه و در تغییرات مهم قیمت.`; }
  else { box.className='smsStatus warn'; box.innerHTML=`🔒 سرویس SMS هنوز فعال نیست.<br>هزینه: ${fa(s.priceIRR||500000)} ریال برای ${fa(s.days||30)} روز.`; }
 }catch(e){box.className='smsStatus warn';box.textContent='وضعیت سرویس فعلاً قابل دریافت نیست.';}
}
async function requestSmsPremium(){
 const phone=document.getElementById('smsPhone')?.value.trim();
 const paymentRef=document.getElementById('smsPaymentRef')?.value.trim();
 if(!phone||!paymentRef){alert('شماره موبایل و کد پیگیری واریز را وارد کن.');return;}
 try{
  const r=await fetch('/api/sms-premium/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId,phone,paymentRef,accountToken})});
  const d=await r.json(); if(!r.ok)throw new Error(d.error||'ثبت درخواست ناموفق بود.');
  document.getElementById('smsPremiumStatus').className='smsStatus';
  document.getElementById('smsPremiumStatus').innerHTML=`🕒 درخواست شما ثبت شد.<br>شناسه درخواست: <b>${esc(d.requestId)}</b><br>بعد از بررسی واریز، کد فعال‌سازی را از مدیریت دریافت کن.`;
 }catch(e){alert(e.message)}
}
async function activateSmsPremium(){
 const phone=document.getElementById('smsPhone')?.value.trim();
 const code=document.getElementById('smsActivationCode')?.value.trim();
 if(!phone||!/^[0-9]{6}$/.test(code||'')){alert('شماره موبایل و کد ۶ رقمی را وارد کن.');return;}
 try{
  const r=await fetch('/api/sms-premium/activate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId,phone,code,accountToken})});
  const d=await r.json(); if(!r.ok)throw new Error(d.error||'فعال‌سازی ناموفق بود.');
  await loadSmsPremiumStatus();
  alert('✅ سرویس پیامکی با موفقیت فعال شد.');
 }catch(e){alert(e.message)}
}

const _goldAlertOriginalLoad = load;
const _goldAlertOriginalInit = typeof initNav === 'function' ? initNav : null;
window.addEventListener('load',()=>{loadSmsCommerceInfo();loadSmsPremiumStatus();});

// v25: all-in-one portfolio, scenarios, reports, account sync and AI news.
let accountToken=localStorage.getItem('gold-alert-pro-account-token-v28')||'';
function setScenario(v){const e=document.getElementById('scenarioPct');if(e)e.value=v;runScenario();}
async function loadAllocation(){
 try{const r=await fetch('/api/portfolio-allocation?deviceId='+encodeURIComponent(deviceId),{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  set('allocKeep',fa(d.keepPct)+'٪');set('allocReduce',fa(d.reducePct)+'٪');set('allocAdd',fa(d.addPct)+'٪');
  const box=document.getElementById('allocReason'); if(box)box.innerHTML=`سیگنال ${esc(d.signal)} • امتیاز ${fa(d.score)}٪ • فشار خرید ${fa(d.buyPressure)}٪ • فشار فروش ${fa(d.sellPressure)}٪<br><span class="small">${esc(d.disclaimer)}</span>`;
 }catch(e){const b=document.getElementById('allocReason');if(b)b.textContent='⚠️ تحلیل سبد فعلاً در دسترس نیست.';}
}
async function runScenario(){
 const pctv=Number(document.getElementById('scenarioPct')?.value); if(!Number.isFinite(pctv)||pctv<-50||pctv>50){alert('درصدی بین -۵۰ تا +۵۰ وارد کن.');return}
 try{const r=await fetch('/api/portfolio-scenario?deviceId='+encodeURIComponent(deviceId)+'&pct='+encodeURIComponent(pctv),{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');
  const b=document.getElementById('scenarioResult');if(b)b.innerHTML=`اگر قیمت فعلی ${pctv>=0?'▲':'▼'} ${f2(Math.abs(pctv))}٪ تغییر کند، ارزش سبد از <b>${moneyIRR(d.currentValue)}</b> به <b>${moneyIRR(d.futureValue)}</b> می‌رسد.<br>تغییر تقریبی ارزش: <b class="${d.delta>=0?'upTxt':'downTxt'}">${d.delta>=0?'▲':'▼'} ${moneyIRR(Math.abs(d.delta))}</b>`;
 }catch(e){const b=document.getElementById('scenarioResult');if(b)b.textContent='⚠️ سناریو قابل محاسبه نیست.';}
}
async function loadPortfolioReport(){
 try{const r=await fetch('/api/portfolio-report?deviceId='+encodeURIComponent(deviceId),{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');const b=document.getElementById('reportBox');const p=d.portfolio||{};const m=d.market||{};if(b)b.innerHTML=`<b>گزارش ${esc(d.period||'')}</b><br>ارزش فعلی: ${moneyIRR(p.totalValue)} • هزینه خرید: ${moneyIRR(p.totalCost)}<br>سود/زیان: <span class="${p.pnl>=0?'upTxt':'downTxt'}">${p.pnl>=0?'▲':'▼'} ${moneyIRR(Math.abs(p.pnl))} (${f2(Math.abs(p.pnlPct||0))}٪)</span><br>وزن کل: ${f2(p.totalWeight)} گرم<br>قیمت بازار در شروع داده: ${moneyIRR(m.startPrice)} • فعلی: ${moneyIRR(m.currentPrice)} • تغییر: ${f2(m.changePct||0)}٪`;}
 catch(e){const b=document.getElementById('reportBox');if(b)b.textContent='⚠️ گزارش فعلاً قابل ساخت نیست.';}
}
function downloadBackup(){window.location.href='/api/export?deviceId='+encodeURIComponent(deviceId);}
async function runNewsAI(){const box=document.getElementById('newsAiResult');if(!box)return;box.style.display='block';box.textContent='⏳ در حال خلاصه‌سازی اخبار...';try{const r=await fetch('/api/news-ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId,accountToken})});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');box.textContent=d.text||'پاسخی دریافت نشد.';}catch(e){box.textContent='⚠️ '+e.message;}}
function showAuthMode(mode){
 const login=mode==='login';
 const lf=document.getElementById('authLoginForm'),rf=document.getElementById('authRegisterForm');
 if(lf)lf.style.display=login?'grid':'none';
 if(rf)rf.style.display=login?'none':'grid';
 document.getElementById('authLoginTab')?.classList.toggle('active',login);
 document.getElementById('authRegisterTab')?.classList.toggle('active',!login);
 const e=document.getElementById('authError');if(e)e.textContent='';
}
function setAuthError(message=''){const e=document.getElementById('authError');if(e)e.textContent=message||'';}
function showAuthGate(show=true,message=''){
 const g=document.getElementById('authGate');
 if(!g)return;
 g.classList.toggle('hidden',!show);g.classList.toggle('authOpen',!!show);
 g.setAttribute('aria-hidden',show?'false':'true');
 document.body.classList.toggle('authLocked',!!show);
 if(show){showAuthMode('login');setAuthError(message);setTimeout(()=>document.getElementById('authMobile')?.focus(),50);}
}
function closeAuthGate(){showAuthGate(false);pendingProtectedCategory='';}
function accountHeaders(){return accountToken?{'x-account-token':accountToken}:{};}
const ACCOUNT_TOKEN_KEY_V26='gold-alert-pro-account-token-v28';
function persistAccountToken(token){accountToken=String(token||'');if(accountToken)localStorage.setItem(ACCOUNT_TOKEN_KEY_V26,accountToken);else localStorage.removeItem(ACCOUNT_TOKEN_KEY_V26);}
function setAccountStatus(text){const e=document.getElementById('accountStatus');if(e)e.textContent='وضعیت حساب: '+text;const q=document.getElementById('quickAccountStatus');if(q)q.textContent=accountToken?'🟢 وارد شده':'🔒 نیاز به ورود';}
async function gateLogin(){
 const username=String(document.getElementById('authMobile')?.value||'').trim();
 const password=String(document.getElementById('authPass')?.value||'');
 if(!username||!password){setAuthError('شماره موبایل و رمز عبور را وارد کنید.');return;}
 const btn=document.querySelector('#authLoginForm button[onclick="gateLogin()"]');
 if(btn){btn.disabled=true;btn.textContent='⏳ در حال ورود...';}
 try{
  const r=await fetch('/api/account/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password,deviceId})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||'ورود ناموفق بود.');
  persistAccountToken(d.token);
  setAccountStatus('🟢 '+(d.username||username));
  const au=document.getElementById('accountUsername');if(au)au.value=d.username||username;
  const ap=document.getElementById('accountPassword');if(ap)ap.value='';
  closeAdminLoginGate();
  await loadTickets();
  await loadUserSettings();
  toast('✅ ورود با موفقیت انجام شد.');
  const target=pendingProtectedCategory||'dashboard';pendingProtectedCategory='';showAuthGate(false);applyCategory(target,true);
 }catch(e){setAuthError('⚠️ '+e.message);}
 finally{if(btn){btn.disabled=false;btn.textContent='🔐 ورود به حساب';}}
}
async function gateRegister(){
 const phone=String(document.getElementById('regMobile')?.value||'').trim();
 const password=String(document.getElementById('regPass')?.value||'');
 const password2=String(document.getElementById('regPass2')?.value||'');
 if(!/^09\d{9}$/.test(phone)){setAuthError('شماره موبایل باید با 09 شروع شود و 11 رقم باشد.');return;}
 if(password.length<6){setAuthError('رمز عبور حداقل ۶ کاراکتر باشد.');return;}
 if(password!==password2){setAuthError('تکرار رمز عبور با رمز اصلی یکسان نیست.');return;}
 try{
  const r=await fetch('/api/account/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,password,nationalId:document.getElementById('regNationalId')?.value||'',recoveryQuestion:document.getElementById('regRecoveryQuestion')?.value||'',recoveryAnswer:document.getElementById('regRecoveryAnswer')?.value||'',deviceId})});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'ثبت‌نام ناموفق بود.');
  persistAccountToken(d.token);setAccountStatus('🟢 '+(d.username||phone));toast('✅ حساب شما ساخته شد.');
  const target=pendingProtectedCategory||'dashboard';pendingProtectedCategory='';showAuthGate(false);applyCategory(target,true);
 }catch(e){setAuthError('⚠️ '+e.message);}
}
async function loginAccount(){
 const u=String(document.getElementById('accountUsername')?.value||'').trim();
 const p=String(document.getElementById('accountPassword')?.value||'');
 if(!u||!p){showAuthGate(true,'شماره موبایل و رمز عبور را وارد کنید.');return;}
 const target=pendingProtectedCategory;
 document.getElementById('authMobile').value=u;document.getElementById('authPass').value=p;
 if(target){} await gateLogin();
}
function registerAccount(){showAuthGate(true);showAuthMode('register');}
async function syncAccount(){
 if(!accountToken){showAuthGate(true,'برای همگام‌سازی ابتدا وارد شوید.');return;}
 try{
  const r=await fetch('/api/account/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:accountToken,deviceId})});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'همگام‌سازی ناموفق بود.');toast('☁️ حساب با موفقیت همگام شد.');
 }catch(e){toast('⚠️ '+e.message,'error');}
}
async function logoutAccount(){
 const token=accountToken;persistAccountToken('');
 try{await fetch('/api/account/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});}catch{}
 setAccountStatus('بدون ورود');
}
async function saveProfileV25(){
 try{
  const body={deviceId,name:document.getElementById('profileName')?.value||'',city:document.getElementById('profileCity')?.value||'',phone:document.getElementById('profilePhone')?.value||''};
  const r=await fetch('/api/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||'ذخیره ناموفق');
  alert('✅ مشخصات ذخیره شد.');
 }catch(e){alert('⚠️ '+e.message);}
}
function showAdminLoginGate(){
 const m=document.getElementById('adminLoginModal');
 if(m){m.style.display='block';}
 const e=document.getElementById('authError');
 if(e)e.textContent='';
}
function closeAdminLoginGate(){
 const m=document.getElementById('adminLoginModal');
 if(m)m.style.display='none';
}
async function loadEconomicCalendar(){
 const box=document.getElementById('calendarList');if(!box)return;try{const d=await fetch('/api/economic-calendar',{cache:'no-store'}).then(r=>r.json());const events=Array.isArray(d.events)?d.events:[];if(!events.length){box.innerHTML='<div class="note">رویداد اقتصادی در فید فعلی ثبت نشده است. برنامه رویداد جعلی تولید نمی‌کند.</div>';return;}box.innerHTML=events.map(x=>`<div class="calendarItem"><div><b>${esc(x.title||'رویداد')}</b><div class="small">${esc(x.note||x.description||'')}</div></div><div><div class="calendarTime">${esc(fmtDate(x.date||x.datetime))}</div><div class="calendarImpact">${esc(x.impact||'watch')}</div></div></div>`).join('');}catch(e){box.textContent='⚠️ تقویم اقتصادی فعلاً در دسترس نیست.';}}
async function askGoldAI(){
 const q=document.getElementById('chatQuestion')?.value.trim(),box=document.getElementById('chatResult');if(!q||!box)return;box.style.display='block';box.textContent='⏳ در حال تحلیل...';
 try{const r=await fetch('/api/ai-chat',{method:'POST',headers:{'Content-Type':'application/json',...accountHeaders()},body:JSON.stringify({question:q,deviceId,accountToken})});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');box.textContent=d.text||'پاسخی دریافت نشد.';}catch(e){box.textContent='⚠️ '+e.message;}
}

function ticketStatusFa(s){return s==='answered'?'پاسخ داده شد':s==='pending'?'در حال بررسی':s==='closed'?'بسته شد':'باز';}
async function loadTickets(){const box=document.getElementById('ticketList');if(!box||!accountToken)return;try{const r=await fetch('/api/tickets',{headers:accountHeaders()});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');if(!d.tickets?.length){box.innerHTML='<div class="small">هنوز تیکتی ثبت نکرده‌اید.</div>';return;}box.innerHTML=d.tickets.map(t=>`<div class="ticketItem"><div><b>${esc(t.subject)}</b> <span class="ticketStatus ${esc(t.status)}">${ticketStatusFa(t.status)}</span></div>${(t.messages||[]).map(m=>`<div class="ticketMsg"><b>${m.from==='admin'?'👨‍💼 پشتیبانی':'👤 شما'}:</b> ${esc(m.message)}<div class="ticketMeta">${esc(fmtDate(m.at))}</div></div>`).join('')}<div class="ticketReply"><input id="reply-${esc(t.id)}" placeholder="پاسخ شما..."><button class="secondary" onclick="replyTicket('${esc(t.id)}')">ارسال</button></div></div>`).join('');}catch(e){box.innerHTML='<div class="small">⚠️ '+esc(e.message)+'</div>';}}
async function createTicket(){const subject=document.getElementById('ticketSubject')?.value.trim(),message=document.getElementById('ticketMessage')?.value.trim();if(!accountToken){showAuthGate(true);return}try{const r=await fetch('/api/tickets',{method:'POST',headers:{'Content-Type':'application/json',...accountHeaders()},body:JSON.stringify({subject,message})});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');document.getElementById('ticketSubject').value='';document.getElementById('ticketMessage').value='';await loadTickets();}catch(e){alert('⚠️ '+e.message);}}
async function replyTicket(id){const e=document.getElementById('reply-'+id),message=e?.value.trim();if(!message)return;try{const r=await fetch('/api/tickets/'+encodeURIComponent(id)+'/reply',{method:'POST',headers:{'Content-Type':'application/json',...accountHeaders()},body:JSON.stringify({message})});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');e.value='';await loadTickets();}catch(x){alert('⚠️ '+x.message);}}
function adminHeaders(){return adminSession?{'x-admin-session':adminSession}:{};}
async function adminFetch(url,opts={}){const headers={...(opts.headers||{}),...adminHeaders()};return fetch(url,{...opts,headers});}
function showAdminMenu(show){document.querySelectorAll('.adminOnly').forEach(e=>e.style.display=show?'flex':'none');}

function renderAICopilot(a,meta={}){
 const g=document.getElementById('aiCopilotGreeting'),s=document.getElementById('aiCopilotSummary'),ac=document.getElementById('aiCopilotAction'),m=document.getElementById('aiCopilotMeta'),al=document.getElementById('aiCopilotAlert'),live=document.getElementById('aiCopilotLive'),ctx=document.getElementById('aiCopilotContext');
 if(!a)return;
 if(g)g.textContent=a.greeting||'سلام 👋';
 if(s)s.textContent=a.summary||'—';
 if(ac){ac.textContent=a.action||'فعلاً صبر کن.';ac.className='aiCopilotAction '+(a.tone||'neutral');}
 if(ctx)ctx.textContent=`${categoryLabels[aiCopilotPage]||'پیشخوان'} • دستیار ساده بازار`;
 if(live)live.textContent=(meta.provider==='GapGPT'?'🟢 AI فعال':'🟡 موتور داخلی');
 if(m)m.innerHTML=`<span class="aiChip">منبع: ${esc(a.simpleData?.source||'—')}</span><span class="aiChip">روند: ${esc(a.simpleData?.trend||'—')}</span><span class="aiChip">اعتماد: ${fa(a.confidence||0)}٪</span>`;
 if(al){if(a.alert){al.textContent='⚠️ '+a.alert;al.classList.remove('aiHide');}else{al.textContent='';al.classList.add('aiHide');}}
 if(a.alert && a.alert!==aiCopilotLastAlert){ aiCopilotLastAlert=a.alert; const top=document.getElementById('topNotifBadge'); if(top){top.style.display='inline-grid';top.textContent='!';setTimeout(()=>{top.style.display='none'},5000);} }
}
async function refreshAICopilot(force=false,page=aiCopilotPage,question=''){
 const now=Date.now(), key=`${page}|${question}`; if(!force && !question && aiCopilotCache[key] && now-aiCopilotCache[key].at<45000){renderAICopilot(aiCopilotCache[key].data,aiCopilotCache[key].meta);return;}
 const summary=document.getElementById('aiCopilotSummary'); if(summary)summary.textContent='دارم قیمت، نمودار و روند را ساده بررسی می‌کنم...';
 try{
  const r=await fetch('/api/ai-assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId,accountToken,page,question})});
  const d=await r.json(); if(!r.ok)throw new Error(d.error||'دستیار در دسترس نیست');
  const data=d.assistant||{}; aiCopilotCache[key]={at:Date.now(),data,meta:d}; aiCopilotLastCall=Date.now(); renderAICopilot(data,d);
 }catch(e){renderAICopilot({greeting:'سلام 👋',summary:'فعلاً نتوانستم تحلیل تازه بگیرم.',action:'صبر کن و وضعیت Live بودن قیمت را چک کن.',why:'خطای ارتباط با دستیار.',watch:'نمودار و زمان آخرین دریافت را بررسی کن.',alert:e.message,tone:'neutral',confidence:30},{provider:'rule-engine'});}
}
function initAICopilot(){
 const close=document.getElementById('aiCopilotClose'),open=document.getElementById('aiCopilotOpen'),dock=document.getElementById('aiCopilotDock'),collapsed=document.getElementById('aiCopilotCollapsed'),ask=document.getElementById('aiCopilotAsk'),input=document.getElementById('aiCopilotQuestion');
 close?.addEventListener('click',()=>{aiCopilotOpen=false;dock?.classList.add('aiHide');collapsed?.classList.remove('aiHide');});
 open?.addEventListener('click',()=>{aiCopilotOpen=true;collapsed?.classList.add('aiHide');dock?.classList.remove('aiHide');refreshAICopilot(true,aiCopilotPage);});
 ask?.addEventListener('click',()=>{const q=input?.value.trim();if(q){refreshAICopilot(true,aiCopilotPage,q);if(input)input.value='';}});
 input?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();ask?.click();}});
 document.querySelectorAll('.aiQuick').forEach(b=>b.addEventListener('click',()=>refreshAICopilot(true,aiCopilotPage,b.dataset.q||'')));
 setTimeout(()=>refreshAICopilot(true,'dashboard'),900);
}
window.refreshAICopilot=refreshAICopilot;
document.addEventListener('DOMContentLoaded',initAICopilot);

async function testAIConnection(){
 const box=document.getElementById('aiStatus'); if(box)box.textContent='⏳ در حال تست واقعی اتصال به GapGPT...';
 try{const r=await fetch('/api/ai-diagnostic',{method:'POST',headers:{'Content-Type':'application/json'}});const d=await r.json();if(!r.ok)throw new Error(d.error||'اتصال ناموفق');if(box)box.textContent='🟢 AI متصل است • مدل: '+(d.model||'auto');return true;}catch(e){if(box)box.textContent='🔴 AI متصل نیست: '+e.message;return false;}
}
window.testAIConnection=testAIConnection;

async function loadMarketOutlook(){
 const box=document.getElementById('marketOutlook');if(!box)return;box.textContent='در حال محاسبه بر پایه تاریخچه...';
 try{const r=await fetch('/api/market-outlook',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'تاریخچه کافی نیست');
 box.innerHTML=`<b>نمونه:</b> ${fa(d.sampleSize)} نقطه / ${fa(d.observations)} بازه پنج‌روزه<br><b>بازه‌های مثبت تاریخی:</b> ${f2(d.frequency.upPct)}٪<br><b>بازه‌های منفی تاریخی:</b> ${f2(d.frequency.downPct)}٪<br><b>تقریب دامنه نوسان ۹۵٪:</b> ${moneyIRR(d.illustrativeRange.low)} تا ${moneyIRR(d.illustrativeRange.high)}<br><b>نوسان روزانه نمونه:</b> ${f2(d.dailyVolatilityPct)}٪<br><small>${esc(d.warning)}</small>`;
 }catch(e){box.textContent='⚠️ '+e.message;}
}
async function generateDailyAIReport(){
 const box=document.getElementById('dailyAIReport');if(!box)return;box.style.display='block';box.textContent='در حال تولید گزارش روزانه...';
 try{const r=await fetch('/api/ai-professional',{method:'POST',headers:{'Content-Type':'application/json',...accountHeaders()},body:JSON.stringify({deviceId,accountToken,question:'یک گزارش روزانه بازار تهیه کن: قیمت و زمان داده، روند کوتاه‌مدت، RSI/MACD/EMA در صورت موجود بودن، حمایت و مقاومت قابل استنباط، وضعیت دلار و اونس، اخبار و رویدادهای موجود، سناریوهای صعودی/پایه/نزولی و ریسک‌ها. داده مفقود را صریح مشخص کن و هیچ دستور قطعی خرید یا فروش نده.'})});const d=await r.json();if(!r.ok)throw new Error(d.error||'گزارش ناموفق');box.textContent=d.text||'گزارشی دریافت نشد.';}catch(e){box.textContent='⚠️ '+e.message;}
}
window.loadMarketOutlook=loadMarketOutlook;window.generateDailyAIReport=generateDailyAIReport;

async function runProfessionalAI(){
 const box=document.getElementById('aiProfessionalResult'),q=document.getElementById('aiProfessionalQuestion')?.value||''; if(!box)return;
 box.style.display='block';box.textContent='⏳ در حال تحلیل بازار، سبد و پروفایل شخصی...';
 try{const r=await fetch('/api/ai-professional',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId,accountToken,question:q})});const d=await r.json();if(!r.ok)throw new Error(d.error||'تحلیل ناموفق');box.textContent=d.text||'پاسخی دریافت نشد.';}catch(e){box.textContent='⚠️ '+e.message;}
}
async function loadUserSettings(){try{const r=await fetch('/api/user-settings?accountToken='+encodeURIComponent(accountToken));const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');const s=d.settings||{};const p=s.investorProfile||{};const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v??''};set('investorRisk',p.risk||'medium');set('investorHorizon',p.horizon||'medium');set('investorGoal',p.goal||'');set('investorNotes',p.notes||'');renderStorageList(s.storageLocations||[]);renderHouseholdList(s.householdPortfolios||[]);}catch(e){}
}
function renderStorageList(items){const el=document.getElementById('storageList');if(!el)return;el.innerHTML=items.length?items.map(x=>`<div class="event">🏦 <b>${esc(x.name)}</b>${x.note?' • '+esc(x.note):''}</div>`).join(''):'هنوز محلی ثبت نشده است.';}
function renderHouseholdList(items){const el=document.getElementById('householdList');if(!el)return;el.innerHTML=items.length?items.map(x=>`<div class="event">👤 <b>${esc(x.name)}</b>${x.owner?' • '+esc(x.owner):''}</div>`).join(''):'هنوز سبد خانوادگی ثبت نشده است.';}
async function saveInvestorSettings(extra={}){try{const current=await fetch('/api/user-settings?accountToken='+encodeURIComponent(accountToken)).then(r=>r.json());const old=current.settings||{};const body={investorProfile:{risk:document.getElementById('investorRisk')?.value||'medium',horizon:document.getElementById('investorHorizon')?.value||'medium',goal:document.getElementById('investorGoal')?.value||'',notes:document.getElementById('investorNotes')?.value||''},storageLocations:extra.storageLocations??old.storageLocations??[],householdPortfolios:extra.householdPortfolios??old.householdPortfolios??[]};const r=await fetch('/api/user-settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,accountToken})});const d=await r.json();if(!r.ok)throw new Error(d.error||'ذخیره ناموفق');renderStorageList(d.settings.storageLocations||[]);renderHouseholdList(d.settings.householdPortfolios||[]);alert('✅ تنظیمات سرمایه‌گذاری ذخیره شد.');}catch(e){alert('⚠️ '+e.message);}}
async function addStorageLocation(){const cur=await fetch('/api/user-settings?accountToken='+encodeURIComponent(accountToken)).then(r=>r.json());const list=cur.settings?.storageLocations||[];const name=document.getElementById('storageName')?.value.trim();const note=document.getElementById('storageNote')?.value.trim();if(!name)return alert('نام محل را وارد کن.');list.push({name,note});await saveInvestorSettings({storageLocations:list});document.getElementById('storageName').value='';document.getElementById('storageNote').value='';}
async function addHouseholdPortfolio(){const cur=await fetch('/api/user-settings?accountToken='+encodeURIComponent(accountToken)).then(r=>r.json());const list=cur.settings?.householdPortfolios||[];const name=document.getElementById('householdName')?.value.trim();const owner=document.getElementById('householdOwner')?.value.trim();if(!name)return alert('نام سبد را وارد کن.');list.push({name,owner});await saveInvestorSettings({householdPortfolios:list});document.getElementById('householdName').value='';document.getElementById('householdOwner').value='';}
function runLadderSimulation(){const capital=Number(document.getElementById('ladderCapital')?.value||0),steps=Math.max(2,Math.min(10,Number(document.getElementById('ladderSteps')?.value||3))),gap=Math.abs(Number(document.getElementById('ladderStepPct')?.value||2));const price=Number(latest?.iran?.priceIRR||0);const el=document.getElementById('ladderResult');if(!capital||!price){el.textContent='سرمایه و قیمت بازار لازم است.';return}const each=capital/steps;let totalGrams=0;const rows=[];for(let i=0;i<steps;i++){const pct=i*gap/100;const p=price*(1-pct);const grams=each/p;totalGrams+=grams;rows.push(`پله ${i+1}: ${moneyIRR(p)} • ${f2(grams)} گرم`)}el.innerHTML=rows.join('<br>')+`<hr>مجموع تقریبی: <b>${f2(totalGrams)} گرم</b><br><span class="small">این فقط شبیه‌ساز ریاضی است و نتیجه آینده را تضمین نمی‌کند.</span>`;}
async function saveInvoiceRecord(){const status=document.getElementById('invoiceStatus');const data={deviceId,weight:Number(document.getElementById('invoiceWeight')?.value||0),purity:Number(document.getElementById('invoicePurity')?.value||750),amount:Number(document.getElementById('invoiceAmount')?.value||0),date:document.getElementById('invoiceDate')?.value||''};if(!data.weight||!data.amount)return status.textContent='وزن و مبلغ را وارد کن.';status.textContent='اطلاعات فاکتور آماده ثبت است؛ برای جلوگیری از داده ساختگی، OCR خودکار هنوز فعال نشده است.';}
async function changePasswordPrompt(){const old=prompt('رمز فعلی را وارد کن:');if(old===null)return;const next=prompt('رمز جدید حداقل ۶ کاراکتر:');if(next===null)return;try{const r=await fetch('/api/account/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({oldPassword:old,newPassword:next,accountToken})});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');alert('✅ رمز تغییر کرد. دوباره وارد شوید.');await logoutAndRelogin();}catch(e){alert('⚠️ '+e.message);}}

async function adminLogin(){const username=String(document.getElementById('adminUsernameInput')?.value||'').trim(),password=String(document.getElementById('adminPasswordInput')?.value||'');if(!username||!password)return alert('نام کاربری و رمز مدیریت را وارد کن.');try{const r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({username,password})});const d=await r.json();if(!r.ok)throw new Error(d.error||'ورود مدیریت ناموفق');window.location.href='/admin';}catch(e){alert('⚠️ '+e.message);}}
async function adminLoadOverview(){try{const r=await adminFetch('/api/admin/overview');const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');const el=document.getElementById('adminOverviewGrid');if(el)el.innerHTML=[['تیکت باز',d.openTickets],['پرداخت ثبت‌شده',d.payments],['AI',d.aiConfigured?'فعال':'تنظیم نشده'],['SMS',d.smsConfigured?'فعال':'تنظیم نشده'],['Uptime',d.uptime+'s'],['نسخه',d.version]].map(x=>`<div class="ov"><span>${x[0]}</span><b>${esc(String(x[1]))}</b></div>`).join('');}catch(e){}}


// v41: financial + user business dashboard
function formatIRR(n){const x=Number(n||0);return new Intl.NumberFormat('fa-IR').format(Math.round(x))+' ریال';}
async function adminLoadBusinessDashboard(){
  const box=document.getElementById('adminBusinessDashboard'); if(!box)return;
  box.innerHTML='<div class="small">در حال دریافت گزارش مالی و کاربران...</div>';
  try{
    const r=await adminFetch('/api/admin/business-dashboard'); const d=await r.json();
    if(!r.ok)throw new Error(d.error||'خطا');
    const maxRev=Math.max(1,...(d.daily||[]).map(x=>Number(x.revenue||0)));
    box.innerHTML=`
      <div class="bizCards">
        <div class="bizCard"><span>درآمد کل ثبت‌شده</span><b>${formatIRR(d.revenue.total)}</b><small>${fa(d.revenue.confirmedCount)} تراکنش تأییدشده</small></div>
        <div class="bizCard"><span>درآمد این ماه</span><b>${formatIRR(d.revenue.month)}</b><small>۷ روز اخیر: ${formatIRR(d.revenue.last7)}</small></div>
        <div class="bizCard"><span>کاربران فعال</span><b>${fa(d.users.active)}</b><small>کل کاربران: ${fa(d.users.total)}</small></div>
        <div class="bizCard"><span>در آستانه انقضا</span><b>${fa(d.users.expiring7)}</b><small>تا ۷ روز آینده</small></div>
        <div class="bizCard"><span>کاربر جدید</span><b>${fa(d.users.new7)}</b><small>۷ روز اخیر · ۳۰ روز: ${fa(d.users.new30)}</small></div>
        <div class="bizCard"><span>پشتیبانی باز</span><b>${fa(d.support.open)}</b><small>از ${fa(d.support.total)} تیکت</small></div>
      </div>
      <div class="bizLower">
        <div class="bizPanel"><h4>📈 روند ۷ روز اخیر</h4><div class="bizBars">${(d.daily||[]).map(x=>`<div class="bizBar"><div class="bizBarTrack"><i style="height:${Math.max(4,Math.round(Number(x.revenue||0)/maxRev*100))}%"></i></div><b>${formatIRR(x.revenue).replace(' ریال','')}</b><small>${esc(x.date.slice(5))}</small></div>`).join('')}</div></div>
        <div class="bizPanel"><h4>👥 ترکیب کاربران</h4><div class="mixRow"><span>عادی</span><b>${fa(Math.max(0,d.users.total-d.users.pro-d.users.premium))}</b></div><div class="mixRow"><span>Pro</span><b>${fa(d.users.pro)}</b></div><div class="mixRow"><span>Premium</span><b>${fa(d.users.premium)}</b></div><div class="mixRow"><span>میانگین هر پرداخت</span><b>${formatIRR(d.revenue.average)}</b></div></div>
      </div>`;
  }catch(e){box.innerHTML='<div class="small">خطا در دریافت داشبورد: '+esc(e.message)+'</div>';}
}

// v40: professional admin command center
let adminUsersCache=[];
function adminFocus(id){const el=document.getElementById(id);if(el){el.scrollIntoView({behavior:'smooth',block:'start'});}}
async function adminRefreshAll(){await Promise.allSettled([adminLoadStats(),adminLoadOverview(),adminLoadBusinessDashboard(),adminLoadUsers(),adminLoadTickets(),adminLoadAudit()]);const e=document.getElementById('adminLastSync');if(e)e.textContent=fmtDate(new Date().toISOString());}
function filterAdminUsers(){const q=(document.getElementById('adminUserSearch')?.value||'').trim().toLowerCase();const f=document.getElementById('adminUserFilter')?.value||'all';document.querySelectorAll('#adminUsersTable tbody tr').forEach(tr=>{const txt=tr.innerText.toLowerCase();let ok=!q||txt.includes(q);if(f!=='all'){if(f==='active')ok=ok&&txt.includes('فعال');else if(f==='expired')ok=ok&&txt.includes('منقضی');else ok=ok&&txt.toLowerCase().includes(f);}tr.style.display=ok?'':'none';});}

async function adminLoadStats(){try{const r=await adminFetch('/api/admin/stats');const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');for(const [id,v] of [['adminUsersCount',d.users],['adminActiveCount',d.active],['adminProCount',d.pro],['adminPremiumCount',d.premium]]){const e=document.getElementById(id);if(e)e.textContent=fa(v)}}catch(e){if(String(e.message).includes('invalid'))adminForceLogout();}}
function roleOptions(role){return `<select data-role="${esc(role)}"><option value="user" ${role==='user'?'selected':''}>کاربر</option><option value="pro" ${role==='pro'?'selected':''}>Pro</option><option value="premium" ${role==='premium'?'selected':''}>Premium</option></select>`;}
const featureFa={dashboard:'پیشخوان',market:'بازار',decision:'اتاق تصمیم',ai:'AI',portfolio:'دارایی',alerts:'هشدار',news:'اخبار',tools:'ابزار',backtest:'بک‌تست',sms:'SMS',account:'حساب',reports:'گزارش',chat:'دستیار AI',calendar:'تقویم'};
async function adminLoadUsers(){const box=document.getElementById('adminUsersTable');if(!box)return;box.textContent='در حال دریافت...';try{const r=await adminFetch('/api/admin/users');const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');if(!d.users?.length){box.textContent='هنوز کاربری ثبت نشده است.';return;}box.innerHTML=`<table><thead><tr><th>کاربر</th><th>سطح</th><th>وضعیت</th><th>انقضا</th><th>دسترسی‌ها</th><th>عملیات</th></tr></thead><tbody>${d.users.map(u=>{const perms=Object.keys(featureFa).map(p=>`<label class="perm ${u.permissions?.includes(p)?'on':''}"><input type="checkbox" data-user="${esc(u.username)}" data-perm="${esc(p)}" ${u.permissions?.includes(p)?'checked':''} style="width:auto"> ${esc(featureFa[p]||p)}</label>`).join('');return `<tr><td><b>${esc(u.name||'بدون نام')}</b><br><b dir="ltr">${esc(u.username||'—')}</b>${u.phone?'<br>'+esc(u.phone):''}<br><small>${esc(u.planLabel||'')}</small></td><td>${roleOptions(u.role)}</td><td><select data-active="${esc(u.username)}"><option value="true" ${u.active?'selected':''}>فعال</option><option value="false" ${!u.active?'selected':''}>غیرفعال</option></select></td><td><input data-expiry="${esc(u.username)}" type="date" value="${u.expiresAt?String(u.expiresAt).slice(0,10):''}"></td><td><div class="permGrid">${perms||'<span class="small">بدون دسترسی</span>'}</div><div class="small" style="margin-top:6px">برای دسترسی‌های بیشتر از دکمه سطح یا ویرایش استفاده کن.</div></td><td><button class="secondary" onclick="adminSaveUser('${esc(u.username)}')">💾 ذخیره</button> <button class="secondary" onclick="adminResetPassword('${esc(u.username)}')">🔑 رمز جدید</button> <button class="secondary" onclick="adminDeleteUser('${esc(u.username)}')">حذف</button></td></tr>`}).join('')}</tbody></table>`;
 }catch(e){box.textContent='⚠️ '+e.message;}}
async function adminCreateUser(){const username=document.getElementById('newUserUsername')?.value.trim(),phone=document.getElementById('newUserPhone')?.value.trim(),name=document.getElementById('newUserName')?.value.trim(),password=document.getElementById('newUserPassword')?.value,role=document.getElementById('newUserRole')?.value||'user',date=document.getElementById('newUserExpiry')?.value,plan=document.getElementById('newUserPlan')?.value.trim();try{const r=await adminFetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,phone,name,password,role,expiresAt:date?new Date(date+'T23:59:59').toISOString():null,planLabel:plan})});const d=await r.json();if(!r.ok)throw new Error(d.error||'ساخت کاربر ناموفق');alert(`✅ کاربر ساخته شد.\nنام کاربری: ${d.user.username}\nرمز: ${d.temporaryPassword}${d.user.phone?'\nموبایل: '+d.user.phone:''}`);['newUserUsername','newUserPhone','newUserName','newUserPassword','newUserExpiry','newUserPlan'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});await adminLoadUsers();await adminLoadStats();setTimeout(filterAdminUsers,0);}catch(e){alert('⚠️ '+e.message);}}
async function adminSaveUser(identifier){const row=[...document.querySelectorAll(`select[data-role]`)].find(e=>e.closest('tr')?.innerText.includes(identifier))?.closest('tr');if(!row)return;const role=row.querySelector('select[data-role]')?.value||'user',active=row.querySelector(`select[data-active="${identifier}"]`)?.value==='true',exp=row.querySelector(`input[data-expiry="${identifier}"]`)?.value||'';const permissions=[...row.querySelectorAll(`input[data-user="${identifier}"][data-perm]:checked`)].map(e=>e.dataset.perm);try{const r=await adminFetch('/api/admin/users/'+encodeURIComponent(identifier),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({role,active,expiresAt:exp?new Date(exp+'T23:59:59').toISOString():null,permissions})});const d=await r.json();if(!r.ok)throw new Error(d.error||'ذخیره ناموفق');alert('✅ دسترسی کاربر ذخیره شد.');await adminLoadUsers();}catch(e){alert('⚠️ '+e.message);}}
async function adminResetPassword(identifier){const p=prompt('رمز جدید حداقل ۶ کاراکتر را وارد کن:');if(!p)return;if(p.length<6)return alert('رمز کوتاه است.');try{const r=await adminFetch('/api/admin/users/'+encodeURIComponent(identifier),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:p})});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');alert('✅ رمز تغییر کرد و نشست قبلی کاربر منقضی شد.');}catch(e){alert('⚠️ '+e.message);}}
async function adminDeleteUser(identifier){if(!confirm('این کاربر حذف شود؟'))return;try{const r=await adminFetch('/api/admin/users/'+encodeURIComponent(identifier),{method:'DELETE'});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');await adminLoadUsers();await adminLoadStats();}catch(e){alert('⚠️ '+e.message);}}

async function adminLoadTickets(){const box=document.getElementById('adminTicketsList');if(!box)return;box.textContent='در حال دریافت...';try{const r=await adminFetch('/api/admin/tickets');const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');if(!d.tickets?.length){box.textContent='هنوز تیکتی ثبت نشده است.';return;}box.innerHTML=d.tickets.map(t=>`<div class="adminTicket"><div><b>${esc(t.subject)}</b> <span class="ticketStatus ${esc(t.status)}">${ticketStatusFa(t.status)}</span><div class="small">کاربر: <b dir="ltr">${esc(t.user?.username||t.username||'—')}</b> • ${esc(fmtDate(t.updatedAt))}</div></div>${(t.messages||[]).map(m=>`<div class="ticketMsg"><b>${m.from==='admin'?'👨‍💼 مدیر':'👤 کاربر'}:</b> ${esc(m.message)}<div class="ticketMeta">${esc(fmtDate(m.at))}</div></div>`).join('')}<textarea id="adminReply-${esc(t.id)}" placeholder="پاسخ مدیر..."></textarea><div class="inlineActions"><button onclick="adminReplyTicket('${esc(t.id)}')">📨 پاسخ</button><select id="adminStatus-${esc(t.id)}" style="max-width:150px"><option value="open" ${t.status==='open'?'selected':''}>باز</option><option value="pending" ${t.status==='pending'?'selected':''}>در حال بررسی</option><option value="answered" ${t.status==='answered'?'selected':''}>پاسخ داده شد</option><option value="closed" ${t.status==='closed'?'selected':''}>بسته</option></select><button class="secondary" onclick="adminSetTicketStatus('${esc(t.id)}')">ذخیره وضعیت</button></div></div>`).join('');}catch(e){box.textContent='⚠️ '+e.message;}}
async function adminReplyTicket(id){const e=document.getElementById('adminReply-'+id),message=e?.value.trim();if(!message)return;try{const r=await adminFetch('/api/admin/tickets/'+encodeURIComponent(id)+'/reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message})});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');e.value='';await adminLoadTickets();}catch(x){alert('⚠️ '+x.message);}}
async function adminSetTicketStatus(id){const status=document.getElementById('adminStatus-'+id)?.value;try{const r=await adminFetch('/api/admin/tickets/'+encodeURIComponent(id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');await adminLoadTickets();}catch(e){alert('⚠️ '+e.message);}}
async function adminLoadCalendar(){try{const r=await adminFetch('/api/admin/economic-events');const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');const e=document.getElementById('adminCalendarJson');if(e)e.value=JSON.stringify(d.events||[],null,2);}catch(e){}}
async function adminSaveCalendar(){try{const events=JSON.parse(document.getElementById('adminCalendarJson')?.value||'[]');if(!Array.isArray(events))throw new Error('فرمت باید آرایه JSON باشد.');const r=await adminFetch('/api/admin/economic-events',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({events})});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');alert('✅ رویدادها ذخیره شدند.');await loadEconomicCalendar();}catch(e){alert('⚠️ '+e.message);}}
async function adminBroadcast(){const title=document.getElementById('broadcastTitle')?.value.trim(),message=document.getElementById('broadcastMessage')?.value.trim();if(!message)return alert('متن پیام را وارد کن.');try{const r=await adminFetch('/api/admin/broadcast',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,message})});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');alert(`✅ پیام برای ${fa(d.count)} کاربر فعال ارسال شد.`);document.getElementById('broadcastMessage').value='';}catch(e){alert('⚠️ '+e.message);}}
async function adminAddPayment(){try{const body={username:document.getElementById('payUser')?.value.trim(),amount:Number(document.getElementById('payAmount')?.value||0),plan:document.getElementById('payPlan')?.value.trim(),reference:document.getElementById('payRef')?.value.trim()};const r=await adminFetch('/api/admin/payments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');alert('✅ پرداخت ثبت شد.');}catch(e){alert('⚠️ '+e.message);}}
async function adminLoadAudit(){try{const r=await adminFetch('/api/admin/audit');const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');const b=document.getElementById('adminAuditBox');if(b)b.innerHTML=(d.items||[]).slice(0,30).map(x=>`• ${esc(x.action)} — ${esc(fmtDate(x.at))}`).join('<br>')||'فعالیتی ثبت نشده است.';}catch(e){alert('⚠️ '+e.message);}}
async function adminDownloadBackup(){try{const r=await adminFetch('/api/admin/backup');const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');const blob=new Blob([JSON.stringify(d,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='gold-alert-pro-admin-backup.json';a.click();URL.revokeObjectURL(url);}catch(e){alert('⚠️ '+e.message);}}
async function adminLogout(){if(adminSession)await adminFetch('/api/admin/logout',{method:'POST'}).catch(()=>{});adminForceLogout();}
function adminForceLogout(keepAdminPage=false){adminSession='';localStorage.removeItem('gold-alert-pro-admin-session-v38');showAdminMenu(false);const box=document.getElementById('adminLoginBox'),content=document.getElementById('adminContent');if(box)box.style.display='block';if(content)content.style.display='none';if(keepAdminPage)applyCategory('admin',false);else applyCategory('dashboard',false);}
async function restoreAdminSession(){if(!adminSession)return;try{const r=await adminFetch('/api/admin/stats');if(!r.ok)throw new Error('invalid');showAdminMenu(true);document.getElementById('adminLoginBox').style.display='none';document.getElementById('adminContent').style.display='block';await adminLoadStats();await adminLoadCommerceSettings();await adminLoadTickets();const e=document.getElementById('adminLastSync');if(e)e.textContent=fmtDate(new Date().toISOString());}catch{adminForceLogout();}}
// Extend category labels without disturbing the original v22 menu behavior.
Object.assign(categoryLabels,{decision:'اتاق تصمیم',calendar:'تقویم اقتصادی',admin:'پنل مدیریت'});
const oldApplyCategory=applyCategory;
applyCategory=function(category,scroll=true){ oldApplyCategory(category,scroll); };
window.askGoldAI=askGoldAI;window.runProfessionalAI=runProfessionalAI;window.loadUserSettings=loadUserSettings;window.saveInvestorSettings=saveInvestorSettings;window.addStorageLocation=addStorageLocation;window.addHouseholdPortfolio=addHouseholdPortfolio;window.runLadderSimulation=runLadderSimulation;window.saveInvoiceRecord=saveInvoiceRecord;window.changePasswordPrompt=changePasswordPrompt;window.adminLoadOverview=adminLoadOverview;window.adminLoadBusinessDashboard=adminLoadBusinessDashboard;window.adminCheckUpdate=adminCheckUpdate;window.adminLogin=adminLogin;window.adminCreateUser=adminCreateUser;window.adminLoadUsers=adminLoadUsers;window.adminSaveUser=adminSaveUser;window.adminResetPassword=adminResetPassword;window.adminDeleteUser=adminDeleteUser;window.adminLoadCalendar=adminLoadCalendar;window.adminSaveCalendar=adminSaveCalendar;window.adminLogout=adminLogout;window.forgotPasswordPrompt=forgotPasswordPrompt;window.showAuthMode=showAuthMode;window.gateLogin=gateLogin;window.gateRegister=gateRegister;window.loadTickets=loadTickets;window.createTicket=createTicket;window.replyTicket=replyTicket;window.adminLoadTickets=adminLoadTickets;window.adminReplyTicket=adminReplyTicket;window.adminSetTicketStatus=adminSetTicketStatus;window.adminBroadcast=adminBroadcast;window.adminAddPayment=adminAddPayment;window.adminLoadAudit=adminLoadAudit;window.adminDownloadBackup=adminDownloadBackup;
async function restoreAccountSession(){
 if(!accountToken){showAuthGate(false);setAccountStatus('بدون ورود');return;}
 try{
  const r=await fetch('/api/account/me',{headers:accountHeaders(),cache:'no-store'});if(!r.ok)throw new Error('invalid');
  const d=await r.json();showAuthGate(false);setAccountStatus('🟢 '+(d.user?.username||'وارد شده'));await loadTickets();await loadUserSettings();
 }catch{persistAccountToken('');setAccountStatus('بدون ورود');showAuthGate(false);}
}
setInterval(loadMarketStructure,10000);setInterval(loadEconomicCalendar,180000);loadMarketStructure();loadEconomicCalendar();restoreAdminSession();restoreAccountSession();if(localStorage.getItem('gold-alert-pro-admin-logged')==='1'&&adminSession){showAdminMenu(true);}

// v35: real in-app notification center + unread badge
let appNotifications=[];
async function loadNotifications(showError=false){
 try{
  if(!accountToken)return;
  const r=await fetch('/api/notifications',{headers:accountHeaders(),cache:'no-store'});
  const d=await r.json(); if(!r.ok)throw new Error(d.error||'خطا');
  const next=Array.isArray(d.notifications)?d.notifications:[];
  if(notificationsBootstrapped){
    for(const n of next.filter(x=>!x.read)){
      if(!lastNotificationIds.has(String(n.id))) showDesktopAlert('🔔 '+(n.title||'Gold Alert Pro'),n.message||'اعلان جدید دارید.','#notificationCenter');
    }
  }else notificationsBootstrapped=true;
  lastNotificationIds=new Set(next.map(x=>String(x.id)));
  appNotifications=next; renderNotifications();
 }catch(e){if(showError){const box=document.getElementById('notifList');if(box)box.innerHTML='<div class="notifEmpty">⚠️ '+esc(e.message)+'</div>';}}
}
function renderNotifications(){
 const box=document.getElementById('notifList');if(!box)return;
 const unread=appNotifications.filter(x=>!x.read).length;
 ['notifBadge','topNotifBadge'].forEach(id=>{const e=document.getElementById(id);if(e){e.textContent=fa(unread);e.style.display=unread?'inline-grid':'none';}});
 if(!appNotifications.length){box.innerHTML='<div class="notifEmpty">اعلان جدیدی ندارید.</div>';return;}
 box.innerHTML=appNotifications.slice(0,30).map(n=>`<div class="notifItem ${n.read?'':'unread'}" onclick="readNotification('${String(n.id).replace(/'/g,"\\'")}')"><div class="notifItemTop"><b>${esc(n.title||'اعلان')}</b><small>${n.createdAt?new Date(n.createdAt).toLocaleString('fa-IR'):''}</small></div><p>${esc(n.message||'')}</p></div>`).join('');
}
async function readNotification(id){
 const n=appNotifications.find(x=>String(x.id)===String(id));if(!n)return;n.read=true;renderNotifications();
 try{await fetch('/api/notifications/'+encodeURIComponent(id)+'/read',{method:'POST',headers:accountHeaders()});}catch{}
}
function scrollToNotifications(){
  applyCategory('dashboard',false);
  setTimeout(()=>document.getElementById('notificationCenter')?.scrollIntoView({behavior:'smooth',block:'start'}),50);
}
document.addEventListener('DOMContentLoaded',()=>{loadTheme();setTimeout(()=>loadNotifications(false),900);setInterval(()=>loadNotifications(false),30000);});

async function loadTheme(){try{const d=await fetch('/api/theme').then(r=>r.json());document.documentElement.dataset.theme=d.active||'gold-light';}catch(e){}}
async function adminSaveTheme(){try{const theme=document.getElementById('themeSelect').value;const r=await adminFetch('/api/admin/theme',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({theme})});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');document.documentElement.dataset.theme=theme;document.getElementById('themeStatus').textContent='پوسته ذخیره شد';}catch(e){alert('⚠️ '+e.message)}}


// v59: seven professional live-market capabilities — multi-source, anomaly detection,
// SSE live updates, alerts (existing engine), candlestick chart, gold calculator, portfolio.
let g59CandleInterval=60;
async function g59LoadEngine(){
 try{
  const r=await fetch('/api/price-engine',{cache:'no-store'}); const d=await r.json(); if(!d.ok)throw new Error(d.error||'engine');
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  set('g59Price',moneyIRR(d.price));
  set('g59SourceTime',d.sourceTime?new Date(d.sourceTime).toLocaleTimeString('fa-IR'):'—');
  set('g59Received',d.receivedAt?new Date(d.receivedAt).toLocaleTimeString('fa-IR'):'—');
  set('g59Clients',d.clients!=null?fa(d.clients):'—');
  const badge=document.getElementById('g59EngineBadge');
  const es=d.engineStatus||{};
  if(badge){badge.className='smartBadge '+(es.status==='LIVE'?'g59LiveBadge':es.status==='STALE'?'g59StaleBadge':'g59OfflineBadge');badge.textContent=es.status==='LIVE'?'● LIVE • قیمت جدید':es.status==='STALE'?'● STALE • آخرین قیمت معتبر':'● OFFLINE • منبع در دسترس نیست';}
  const sources=d.diagnostics?.sources||[]; const box=document.getElementById('g59Sources');
  if(box)box.innerHTML=sources.length?sources.map(x=>{const cd=Number(x.cooldownMs||0);const mins=cd>0?Math.ceil(cd/60000):0;return `<div class="g59Source"><span><b>${esc(x.name)}</b><small> ${x.at?new Date(x.at).toLocaleTimeString('fa-IR'):''}</small></span><span class="${x.ok?'g59Ok':'g59Bad'}">${x.ok?moneyIRR(x.priceIRR):'✕ '+esc(x.error||'خطا')}${mins?`<small> • بازگشت ${fa(mins)} دقیقه دیگر</small>`:''}</span></div>`}).join(''):'اطلاعات منابع موجود نیست.';
  const a=d.anomaly||{}; const n=document.getElementById('g59Anomaly');
  if(n){n.className='g59Notice '+(a.detected?'g59Warn':'g59Ok');n.innerHTML=a.detected?`⚠️ <b>ناهنجاری شناسایی شد</b> • جهش ${f2(a.jumpPct)}٪ • اختلاف منابع ${a.sourceSpreadPct==null?'—':f2(a.sourceSpreadPct)+'٪'}`:`✅ قیمت در محدوده عادی است • اختلاف منابع ${a.sourceSpreadPct==null?'—':f2(a.sourceSpreadPct)+'٪'}`;}
 }catch(e){}
}
async function g59LoadCandles(){
 const box=document.getElementById('g59Candles');if(!box)return;
 try{const r=await fetch('/api/candles?interval='+g59CandleInterval,{cache:'no-store'});const d=await r.json();const cs=d.candles||[];if(cs.length<2){box.innerHTML='<div class="chartEmpty">برای نمودار کندلی هنوز داده کافی جمع نشده است.</div>';return;}
 const w=1000,h=260,pad=22,min=Math.min(...cs.map(x=>x.low)),max=Math.max(...cs.map(x=>x.high)),range=max-min||1,step=(w-pad*2)/cs.length,body=Math.max(3,step*.58);
 const y=v=>h-pad-(v-min)/range*(h-pad*2); const items=cs.map((c,i)=>{const x=pad+i*step+step/2,up=c.close>=c.open,yt=y(Math.max(c.open,c.close)),yb=y(Math.min(c.open,c.close));return `<line x1="${x}" y1="${y(c.high)}" x2="${x}" y2="${y(c.low)}" class="g59Wick"/><rect x="${x-body/2}" y="${yt}" width="${body}" height="${Math.max(2,yb-yt)}" class="${up?'g59Bull':'g59Bear'}"/>`;}).join('');
 box.innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><line x1="${pad}" y1="${pad}" x2="${w-pad}" y2="${pad}" class="chartGrid"/><line x1="${pad}" y1="${h/2}" x2="${w-pad}" y2="${h/2}" class="chartGrid"/><line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" class="chartGrid"/>${items}<text x="${w-pad}" y="14" text-anchor="end" class="chartAxis">${chartMoney(max)}</text><text x="${w-pad}" y="${h-4}" text-anchor="end" class="chartAxis">${chartMoney(min)}</text></svg>`;
 }catch(e){box.innerHTML='<div class="chartEmpty">نمودار کندلی موقتاً در دسترس نیست.</div>';}
}
function g59CalculateGold(){
 const w=Number(document.getElementById('g59Weight')?.value),purity=Number(document.getElementById('g59Purity')?.value||750),wage=Number(document.getElementById('g59Wage')?.value||0),profit=Number(document.getElementById('g59Profit')?.value||0),tax=Number(document.getElementById('g59Tax')?.value||0),base=Number(latest?.iran?.priceIRR||0);const out=document.getElementById('g59CalcResult');
 if(!out||!w||w<=0||!base||purity<=0||purity>1000){if(out)out.textContent='⚠️ قیمت زنده، وزن و عیار را بررسی کنید.';return}
 const pure=base*w*(purity/750),withWage=pure*(1+wage/100),withProfit=withWage*(1+profit/100),taxValue=withProfit*(tax/100),total=withProfit+taxValue;
 out.innerHTML=`قیمت پایه: <b>${moneyIRR(pure)}</b><br>اجرت: <b>${moneyIRR(withWage-pure)}</b> • سود: <b>${moneyIRR(withProfit-withWage)}</b> • مالیات: <b>${moneyIRR(taxValue)}</b><br><strong>قیمت نهایی تقریبی: ${moneyIRR(total)}</strong>`;
}
function g59RenderPortfolio(){
 const e=document.getElementById('g59PortfolioSummary');if(!e)return;const items=portfolioItems||[];const price=Number(latest?.iran?.priceIRR||0);if(!items.length){e.textContent='هنوز دارایی‌ای ثبت نشده است. از بخش «دارایی» اضافه کنید.';return}const cost=items.reduce((a,x)=>a+Number(x.weight||0)*Number(x.buyPrice||0),0),value=items.reduce((a,x)=>a+Number(x.weight||0)*price*(Number(x.purity||750)/750),0),pnl=value-cost; e.innerHTML=`${fa(items.length)} دارایی • ارزش فعلی <b>${moneyIRR(value)}</b> • بهای خرید ${moneyIRR(cost)} • سود/زیان <b class="${pnl>=0?'upTxt':'downTxt'}">${pnl>=0?'▲':'▼'} ${moneyIRR(Math.abs(pnl))}</b> • بروزرسانی زنده`;
}
function initG59(){
 document.querySelectorAll('.g59CandleBtn').forEach(b=>b.addEventListener('click',()=>{g59CandleInterval=Number(b.dataset.candle)||60;document.querySelectorAll('.g59CandleBtn').forEach(x=>x.classList.remove('active'));b.classList.add('active');g59LoadCandles();}));
 g59LoadEngine();g59LoadCandles();g59RenderPortfolio();setInterval(g59LoadEngine,5000);setInterval(g59LoadCandles,15000);setInterval(g59RenderPortfolio,5000);
}
window.addEventListener('load',initG59);



// v61: AI Decision Room + Smart Alerts + Portfolio Guard
function v61FmtPct(v){return Number.isFinite(Number(v))?`${Number(v).toFixed(1)}٪`:'—'}
async function loadV61DecisionRoom(){
  try{
    const r=await fetch('/api/decision-room',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
    set('v61Regime',d.regime||'—');set('v61TrendMeta',d.trend?.confidence?`اعتماد ساختار ${fa(d.trend.confidence)}٪`:'—');
    const sigFa={BUY:'خرید',SELL:'فروش',WATCH_BUY:'مراقبت برای خرید',WATCH_SELL:'مراقبت برای فروش',WAIT:'انتظار'};
    set('v61Signal',sigFa[d.analysis?.signal]||'انتظار');set('v61Score',`امتیاز ${fa(d.analysis?.score||0)}٪`);
    set('v61Risk',d.risk?.label||'—');set('v61RiskMeta',`امتیاز ${fa(d.risk?.score||0)} از ۱۰۰`);set('v61Quality',d.quality==='GOOD'?'خوب':d.quality==='STALE'?'قدیمی':'قطع');set('v61QualityMeta',d.engineStatus?.source?`منبع: ${d.engineStatus.source}`:'—');
    set('v61Action',d.action||'—');set('v61Support',d.trend?.support?moneyIRR(d.trend.support):'—');set('v61Resistance',d.trend?.resistance?moneyIRR(d.trend.resistance):'—');set('v61SupportDistance',d.distanceToSupport!=null?v61FmtPct(d.distanceToSupport):'—');set('v61ResistanceDistance',d.distanceToResistance!=null?v61FmtPct(d.distanceToResistance):'—');
    set('v61BullCond',d.scenarios?.bullish?.condition||'—');set('v61BullRisk',`ریسک: ${d.scenarios?.bullish?.risk||'—'}`);set('v61BaseCond',d.scenarios?.base?.condition||'—');set('v61BaseRisk',`ریسک: ${d.scenarios?.base?.risk||'—'}`);set('v61BearCond',d.scenarios?.bearish?.condition||'—');set('v61BearRisk',`ریسک: ${d.scenarios?.bearish?.risk||'—'}`);
    const live=document.getElementById('v61DecisionLive');if(live){live.textContent=d.quality==='GOOD'?'● LIVE • داده تازه':d.quality==='STALE'?'● STALE • داده قدیمی':'● OFFLINE';live.style.color=d.quality==='GOOD'?'#86e4b4':d.quality==='STALE'?'#f2d58b':'#ff9aa5';}
  }catch(e){const x=document.getElementById('v61DecisionLive');if(x)x.textContent='⚠️ داده در دسترس نیست';}
}
async function runV61AIDecision(){
 const box=document.getElementById('v61DecisionAIResult');if(!box)return;
 if(!accountToken){showAuthGate(true,'برای توضیح AI اتاق تصمیم ابتدا وارد حساب شوید.');pendingProtectedCategory='decision';return;}
 box.textContent='⏳ دارم وضعیت بازار را به زبان ساده توضیح می‌دهم...';
 try{const q='از روی وضعیت فعلی بازار خیلی ساده بگو الان چه خبر است، سناریوی اصلی چیست، چه چیزی باید تأیید شود، مهم‌ترین هشدار چیست و ریسک اصلی کجاست.';const r=await fetch('/api/ai-decision',{method:'POST',headers:{'Content-Type':'application/json',...accountHeaders()},body:JSON.stringify({deviceId,accountToken,question:q})});const d=await r.json();if(!r.ok)throw new Error(d.error||'تحلیل AI ناموفق');box.textContent=d.text||'پاسخ دریافت نشد.';}catch(e){box.textContent='⚠️ '+e.message;}
}
function v61SmartAlertPayload(){
 const num=id=>{const v=Number(document.getElementById(id)?.value);return Number.isFinite(v)&&document.getElementById(id)?.value!==''?v:null};
 return {deviceId,accountToken,name:document.getElementById('v61AlertName')?.value.trim()||'هشدار هوشمند',conditions:{priceAbove:num('v61AlertAbove'),priceBelow:num('v61AlertBelow'),trend:document.getElementById('v61AlertTrend')?.value||null,signal:document.getElementById('v61AlertSignal')?.value||null,minScore:num('v61AlertScore'),minRsi:num('v61AlertMinRsi'),maxRsi:num('v61AlertMaxRsi'),pressure:document.getElementById('v61AlertPressure')?.value||null,changePct:num('v61AlertChange')}};
}
function v61SmartConditionText(c){const x=[];if(c.priceAbove!=null)x.push('قیمت > '+moneyIRR(c.priceAbove));if(c.priceBelow!=null)x.push('قیمت < '+moneyIRR(c.priceBelow));const t={UP:'صعودی',DOWN:'نزولی',SIDEWAYS:'خنثی'};const s={BUY:'خرید',SELL:'فروش',WATCH_BUY:'مراقبت خرید',WATCH_SELL:'مراقبت فروش',WAIT:'انتظار'};if(c.trend)x.push('روند: '+(t[c.trend]||c.trend));if(c.signal)x.push('سیگنال: '+(s[c.signal]||c.signal));if(c.minScore!=null)x.push('امتیاز ≥ '+fa(c.minScore));if(c.minRsi!=null)x.push('RSI ≥ '+fa(c.minRsi));if(c.maxRsi!=null)x.push('RSI ≤ '+fa(c.maxRsi));if(c.pressure)x.push('فشار: '+(c.pressure==='BUY'?'خرید':c.pressure==='SELL'?'فروش':'متعادل'));if(c.changePct!=null)x.push('تغییر ≥ '+v61FmtPct(c.changePct));return x.join(' • ')}
async function loadV61SmartAlerts(){
 const box=document.getElementById('v61SmartAlertList');if(!box)return;
 try{const r=await fetch('/api/smart-alerts?deviceId='+encodeURIComponent(deviceId),{headers:accountHeaders(),cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');const list=d.alerts||[];box.innerHTML=list.length?list.map(a=>`<div class="v61SmartRow"><div><b>${esc(a.name)}</b><small>${a.active?'🟢 فعال':'⚪ غیرفعال'}${a.lastTriggeredAt?' • آخرین اجرا: '+new Date(a.lastTriggeredAt).toLocaleString('fa-IR'):''}</small></div><div class="v61SmartChips"><span class="v61SmartChip">${esc(v61SmartConditionText(a.conditions))}</span></div><button class="secondary" onclick="deleteV61SmartAlert('${esc(a.id)}')">حذف</button></div>`).join(''):'<div class="emptyAlert">هنوز هشدار هوشمندی ثبت نشده است.</div>'}catch(e){box.innerHTML='<div class="emptyAlert">⚠️ '+esc(e.message)+'</div>';}
}
async function addV61SmartAlert(){
 if(!accountToken){showAuthGate(true,'برای ثبت هشدار هوشمند ابتدا وارد حساب شوید.');pendingProtectedCategory='alerts';return;}
 try{const body=v61SmartAlertPayload();const r=await fetch('/api/smart-alerts',{method:'POST',headers:{'Content-Type':'application/json',...accountHeaders()},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||'ثبت هشدار ناموفق');toast('✅ هشدار هوشمند ثبت شد.');['v61AlertName','v61AlertAbove','v61AlertBelow','v61AlertScore','v61AlertMinRsi','v61AlertMaxRsi','v61AlertChange'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});['v61AlertTrend','v61AlertSignal','v61AlertPressure'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});await loadV61SmartAlerts();}catch(e){toast('⚠️ '+e.message,'error');}
}
async function deleteV61SmartAlert(id){
 if(!accountToken){showAuthGate(true,'ابتدا وارد حساب شوید.');return;} try{const r=await fetch('/api/smart-alerts/'+encodeURIComponent(id)+'?deviceId='+encodeURIComponent(deviceId),{method:'DELETE',headers:accountHeaders()});const d=await r.json();if(!r.ok)throw new Error(d.error||'حذف ناموفق');await loadV61SmartAlerts();}catch(e){toast('⚠️ '+e.message,'error');}
}
async function loadV61PortfolioGuard(){
 const box=document.getElementById('v61PortfolioText');if(!box)return;
 try{const r=await fetch('/api/portfolio-allocation?deviceId='+encodeURIComponent(deviceId),{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'خطا');const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};set('v61KeepPct',fa(d.keepPct)+'٪');set('v61ReducePct',fa(d.reducePct)+'٪');set('v61AddPct',fa(d.addPct)+'٪');set('v61PortScore',fa(d.score)+'٪');const kb=document.getElementById('v61KeepBar'),rb=document.getElementById('v61ReduceBar'),ab=document.getElementById('v61AddBar');if(kb)kb.style.width=d.keepPct+'%';if(rb)rb.style.width=d.reducePct+'%';if(ab)ab.style.width=d.addPct+'%';box.textContent=`وضعیت فعلی: ${d.signal||'WAIT'} • امتیاز ${fa(d.score)}٪ • فشار خرید ${fa(d.buyPressure)}٪ • فشار فروش ${fa(d.sellPressure)}٪. ${d.disclaimer||''}`;}catch(e){box.textContent='⚠️ '+e.message;}
}
function initV61(){
 document.getElementById('v61DecisionAI')?.addEventListener('click',runV61AIDecision);
 document.getElementById('v61SmartAlertAdd')?.addEventListener('click',addV61SmartAlert);
 document.getElementById('v61PortfolioRefresh')?.addEventListener('click',loadV61PortfolioGuard);
 loadV61DecisionRoom();loadV61SmartAlerts();loadV61PortfolioGuard();
 setInterval(loadV61DecisionRoom,10000);setInterval(loadV61SmartAlerts,30000);setInterval(loadV61PortfolioGuard,15000);
}
window.deleteV61SmartAlert=deleteV61SmartAlert;window.loadV61DecisionRoom=loadV61DecisionRoom;window.runV61AIDecision=runV61AIDecision;
window.addEventListener('load',initV61);

// Ensure auth handlers are available for inline buttons after cache/version updates.
window.showAuthMode = showAuthMode;
window.showAdminLoginGate = showAdminLoginGate;
window.gateLogin = gateLogin;
window.gateRegister = gateRegister;
window.loginAccount = loginAccount;
window.registerAccount = registerAccount;
window.forgotPasswordPrompt = forgotPasswordPrompt;
window.adminLogin = adminLogin;

/* =========================================================
   Gold2 Pro V65 Market Terminal
   ========================================================= */
(function initV62Terminal(){
  const $=id=>document.getElementById(id);
  const faNum=v=>{try{return Number(v||0).toLocaleString('fa-IR')}catch{return String(v??'—')}};
  const safeMoney=v=>{try{return moneyIRR(v)}catch{return faNum(v)}};
  const set=(id,v)=>{const e=$(id);if(e)e.textContent=v??'—'};
  let chartMode='area', showLevels=true;
  function syncChart(){
    const src=$('goldChart'),dst=$('v62GoldChart');
    if(!src||!dst)return;
    dst.innerHTML=src.innerHTML;
    const decorate=(root)=>{
      const svg=root?.querySelector('svg'); if(!svg)return;
      svg.style.width='100%';svg.style.height='100%';
      const raw=(latest?.prices||[]).map(Number).filter(Number.isFinite).slice(-chartRange);
      if(raw.length<2)return;
      const min=Math.min(...raw),max=Math.max(...raw),range=max-min||1,w=900,h=230,padX=12,padY=18;
      if(chartMode==='line'){svg.querySelectorAll('.chartArea').forEach(x=>x.style.display='none')}
      else svg.querySelectorAll('.chartArea').forEach(x=>x.style.display='');
      svg.querySelectorAll('.v62LevelLine,.v62LevelLabel').forEach(x=>x.remove());
      if(showLevels){
        const levels=[{v:Math.min(...raw),name:'حمایت'},{v:Math.max(...raw),name:'مقاومت'}];
        levels.forEach((lv,i)=>{const y=h-padY-(lv.v-min)/range*(h-2*padY);const line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('x1',padX);line.setAttribute('x2',w-padX);line.setAttribute('y1',y);line.setAttribute('y2',y);line.setAttribute('class','v62LevelLine');line.setAttribute('data-level',i);svg.appendChild(line);const t=document.createElementNS('http://www.w3.org/2000/svg','text');t.setAttribute('x',w-padX-4);t.setAttribute('y',Math.max(12,y-4));t.setAttribute('text-anchor','end');t.setAttribute('class','v62LevelLabel');t.textContent=lv.name+' '+faNum(lv.v);svg.appendChild(t);});
      }
    };
    decorate(dst);
    const hero=$('v62HeroChart'); if(hero){hero.innerHTML=src.innerHTML;decorate(hero)}
    const raw=(latest?.prices||[]).map(Number).filter(Number.isFinite).slice(-chartRange);
    const high=raw.length?Math.max(...raw):0,low=raw.length?Math.min(...raw):0,last=raw.at(-1)||0,first=raw[0]||0,delta=first?((last/first-1)*100):0;
    set('v62GoldHigh',high?safeMoney(high):'—');set('v62GoldLow',low?safeMoney(low):'—');set('v62GoldMove',first?((delta>=0?'▲ +':'▼ ')+f2(Math.abs(delta))+'٪'):'—');
    set('v62Source',latest?.iran?.source||'—');
  }
  window.v62ChartRange=function(btn,n){
    document.querySelectorAll('.v62Range button,.v62ChartTools button').forEach(x=>x.classList.remove('active'));btn?.classList.add('active');
    const target=document.querySelector(`#goldChartCard button[data-range="${n}"]`);if(target)target.click();
    setTimeout(syncChart,80);
  };
  window.v62ChartMode=function(mode){chartMode=mode==='line'?'line':'area';document.querySelectorAll('[data-v62-mode]').forEach(x=>x.classList.toggle('active',x.dataset.v62Mode===chartMode));syncChart()};
  window.v62ToggleLevels=function(btn){showLevels=!showLevels;if(btn)btn.classList.toggle('active',showLevels);syncChart()};
  window.v62MiniCalc=function(){const w=Number($('v62CalcWeight')?.value||0),p=Number(latest?.iran?.priceIRR||0),out=$('v62CalcResult');if(!out)return;if(!w||!p){out.textContent='وزن و قیمت بازار لازم است.';return}out.innerHTML=`ارزش تقریبی: <b>${safeMoney(w*p)}</b><br><span>بر مبنای طلای ۱۸ عیار و بدون اجرت، سود و مالیات.</span>`};
  function updatePulse(s){
    const price=Number(s?.iran?.priceIRR||0), dollar=Number(s?.dollar?.priceIRR||0), xau=Number(s?.global?.xauUsd||0), gram=Number(s?.coins?.gram||0), emami=Number(s?.coins?.emami||0);
    const prev=window.__v62Prev||{};
    const pct=(a,b)=>b>0?((a/b-1)*100):null;
    const goldD=pct(price,prev.price), dollarD=pct(dollar,prev.dollar), xauD=pct(xau,prev.xau), gramD=pct(gram,prev.gram);
    const fmtPct=d=>d==null?'—':(d>=0?'▲ +':'▼ ')+f2(Math.abs(d))+'٪';
    set('v62GoldPrice',safeMoney(price));set('v62GoldChange',fmtPct(goldD));set('v62GoldTime',s?.updatedAt?new Date(s.updatedAt).toLocaleTimeString('fa-IR'):'—');
    set('v62CardGold',safeMoney(price));set('v62CardDollar',safeMoney(dollar));set('v62CardXau',xau?'$'+Number(xau).toLocaleString('en-US',{maximumFractionDigits:2}):'—');set('v62CardGram',safeMoney(gram));set('v62CardCoin',safeMoney(emami));
    set('v62CardGoldCh',fmtPct(goldD));set('v62CardDollarCh',fmtPct(dollarD));set('v62CardXauCh',fmtPct(xauD));set('v62CardGramCh',fmtPct(gramD));
    set('v62PulseGold',safeMoney(price));set('v62PulseDollar',safeMoney(dollar));set('v62PulseXau',xau?'$'+Number(xau).toLocaleString('en-US',{maximumFractionDigits:2}):'—');set('v62PulseGram',safeMoney(gram));
    set('v62PulseGoldCh',fmtPct(goldD));set('v62PulseDollarCh',fmtPct(dollarD));set('v62PulseXauCh',fmtPct(xauD));set('v62PulseGramCh',fmtPct(gramD));
    const es=s?.engineStatus||{};set('v62MarketState',es.status==='LIVE'?'LIVE':es.status==='STALE'?'STALE':'OFFLINE');
    const v65State=es.status==='LIVE'?'بازار زنده':es.status==='STALE'?'داده با تأخیر':'منبع داده قطع';
    set('v65StateBadge',v65State);set('v65Quality',s?.dataReady?'مناسب':(es.status==='LIVE'?'قابل استفاده':'ناقص'));set('v65QualityMeta',es.reason||'منبع فعال');
    const trend=$('ccTrend')?.textContent||$('quickTrend')?.textContent||'در حال بررسی';
    const pressure=$('quickPressure')?.textContent||'—';
    const rsi=Number(String($('quickRsi')?.textContent||'').replace(/[^0-9.\-]/g,''));
    set('v65Trend',trend);set('v65TrendMeta',rsi?('RSI '+rsi):'تحلیل تکنیکال');set('v65Momentum',pressure);
    const raw=(s?.prices||[]).map(Number).filter(Number.isFinite).slice(-60);const avg=raw.length?(raw.reduce((a,b)=>a+b,0)/raw.length):0;const vol=avg&&raw.length?((Math.max(...raw)-Math.min(...raw))/avg*100):0;set('v65Volatility',vol?vol.toFixed(2)+'٪':'—');
    const an=$('v65StateBadge');if(an)an.style.color=es.status==='LIVE'?'#5ee7a0':es.status==='STALE'?'#f5c451':'#ef7373';
    const q=$('v62DataQuality');if(q)q.textContent=s?.dataReady?'آماده تحلیل':(es.status==='LIVE'?'داده زنده':'داده ناقص');
    const age=$('v62UpdateAge');if(age)age.textContent=s?.updatedAt?'آخرین بروزرسانی '+new Date(s.updatedAt).toLocaleTimeString('fa-IR'):'آخرین بروزرسانی —';
    const live=$('v62MarketState');if(live)live.style.color=es.status==='LIVE'?'#22c55e':es.status==='STALE'?'#f5c451':'#ef4444';
    set('v62DataSource',s?.iran?.source||'—');set('v62EngineReason',s?.engineStatus?.reason||'اتصال فعال');window.__v62Prev={price,dollar,xau,gram};
    syncChart();
  }
  function renderCopilotFromDom(){
    try{const u=localStorage.getItem('gold-alert-pro-account-user')||localStorage.getItem('gold-alert-pro-account');const name=u&&u.includes('@')?u.split('@')[0]:u;if(name&&$('v62AccountName'))$('v62AccountName').textContent=name;}catch{}
    const trend=$('ccTrend')?.textContent||$('quickTrend')?.textContent||'در حال بررسی';
    const risk=$('ccRisk')?.textContent||'—';
    const summary=$('aiCopilotSummary')?.textContent||'در حال تحلیل داده‌های بازار...';
    const alert=$('aiCopilotAlert')?.textContent||'مقاومت و حمایت نزدیک را زیر نظر بگیر.';
    set('v62AiTrend',trend);set('v62AiTrendMeta',trend);set('v62AiMomentum',$('quickPressure')?.textContent||'—');set('v62AiRisk',risk);set('v62AiSummary',summary);set('v62AiWarning',alert?'⚠ '+alert:'⚠ هشدار فعالی ثبت نشده است.');
  }
  window.v62AskCopilot=function(){const q=$('v62CopilotQuestion')?.value.trim();if(!q)return;refreshAICopilot(true,'dashboard',q);setTimeout(renderCopilotFromDom,900);};
  function renderTimeline(){
    const box=$('v62TimelineList');if(!box)return;
    const events=latest?.events||[];const targets=latest?.targetEvents||[];const rows=[];
    targets.slice(0,3).forEach(e=>rows.push({at:e.at,icon:e.kind==='stop'?'🛑':e.kind==='target2'?'🏆':'🎯',text:(e.kind==='stop'?'حد ضرر':e.kind==='target2'?'هدف دوم':'هدف اول')+' • '+safeMoney(e.price)}));
    events.slice(0,5).forEach(e=>rows.push({at:e.at,icon:e.type==='signal'?'🧠':'📈',text:e.text||e.message||e.kind||'رویداد بازار'}));
    if(!rows.length){box.innerHTML='<div class="v62TimelineItem"><span class="v62TimelineTime">—</span><span class="v62TimelineDot">•</span><span class="v62TimelineText">هنوز رویداد مهمی ثبت نشده است.</span></div>';return;}
    box.innerHTML=rows.slice(0,6).map(e=>`<div class="v62TimelineItem"><span class="v62TimelineTime">${e.at?new Date(e.at).toLocaleTimeString('fa-IR'):'—'}</span><span class="v62TimelineDot">${e.icon}</span><span class="v62TimelineText">${esc(String(e.text))}</span></div>`).join('');
    const n=$('v62NotifCount');if(n)n.textContent=String(Math.min(rows.length,9));
  }
  function wireNav(){
    document.querySelectorAll('[data-v62cat]').forEach(btn=>btn.addEventListener('click',()=>{const c=btn.dataset.v62cat;document.querySelectorAll('[data-v62cat]').forEach(x=>x.classList.toggle('active',x===btn));if(c==='dashboard'){applyCategory('dashboard');}else{applyCategory(c);}}));
    $('v62Collapse')?.addEventListener('click',()=>document.body.classList.toggle('v62Collapsed'));
    document.querySelectorAll('[data-v62-widget]').forEach(ch=>ch.addEventListener('change',()=>{const map={hero:'.v62Hero',pulse:'.v62PulsePanel',ai:'.v62Copilot',alerts:'.v62Timeline',portfolio:'.v62MarketCards'};const el=document.querySelector(map[ch.dataset.v62Widget]);if(el)el.style.display=ch.checked?'':'none';localStorage.setItem('gold2_v62_widgets',JSON.stringify([...document.querySelectorAll('[data-v62-widget]')].reduce((o,x)=>(o[x.dataset.v62Widget]=x.checked,o),{})));}));
    try{const saved=JSON.parse(localStorage.getItem('gold2_v62_widgets')||'{}');document.querySelectorAll('[data-v62-widget]').forEach(ch=>{if(saved[ch.dataset.v62Widget]!==undefined){ch.checked=!!saved[ch.dataset.v62Widget];ch.dispatchEvent(new Event('change'));}})}catch{}
  }
  document.addEventListener('DOMContentLoaded',()=>{wireNav();setTimeout(()=>{syncChart();renderCopilotFromDom();renderTimeline();},500);});
  const oldLoad=window.load;
  // load is declared in the page scope; wrap through an interval to avoid changing the stable V61 engine.
  setInterval(()=>{try{if(typeof latest!=='undefined'&&latest){updatePulse(latest);renderCopilotFromDom();renderTimeline();}}catch{}},1500);
})();
