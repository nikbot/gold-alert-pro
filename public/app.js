const fa=n=>Number(n||0).toLocaleString('fa-IR',{maximumFractionDigits:0});
const f2=n=>Number(n||0).toLocaleString('fa-IR',{maximumFractionDigits:2});
const pct=n=>Number(n||0).toLocaleString('fa-IR',{maximumFractionDigits:1})+'٪';
let latest=null,timer=null,deferredPrompt=null,pollMs=10000,nextAt=0;
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
function logoutAndRelogin(){ logoutAccount(); setTimeout(()=>showAuthMode('login'),120); }
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
  document.getElementById('status').textContent=s.error?'خطا در یک منبع داده':'🟢 آنلاین';document.getElementById('dot').className='dot'+(s.error?' off':'');
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
  liveStream.addEventListener('market',e=>{ try{ load(JSON.parse(e.data)); }catch{} });
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
function applyCategory(category,scroll=true){
 document.querySelectorAll('.categorySection').forEach(el=>{el.classList.remove('categoryVisible');el.style.display='none';});
 document.body.classList.toggle('categoryView',category!=='dashboard');
 document.querySelectorAll('.menuItem').forEach(b=>b.classList.toggle('active',b.dataset.category===category));
 document.querySelectorAll('.category-'+category).forEach(el=>{el.classList.add('categoryVisible');el.style.display='block';});
 const title=document.getElementById('categoryTitle');
 const desc=document.getElementById('categoryDesc');
 if(title) title.textContent=categoryLabels[category]||'بخش';
 if(desc) desc.textContent=category==='dashboard'?'قیمت زنده، وضعیت امروز و سیگنال کلی بازار': 'فقط ابزارهای مرتبط با '+(categoryLabels[category]||'این بخش')+' نمایش داده می‌شوند.';
 if(scroll){
   const first=document.querySelector('.category-'+category);
   if(first) setTimeout(()=>first.scrollIntoView({behavior:'smooth',block:'start'}),40);
   else window.scrollTo({top:0,behavior:'smooth'});
 }
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
function showAuthMode(mode){const login=mode==='login';document.getElementById('authLoginForm').style.display=login?'grid':'none';document.getElementById('authRegisterForm').style.display=login?'none':'grid';document.getElementById('authLoginTab').classList.toggle('active',login);document.getElementById('authRegisterTab').classList.toggle('active',!login);document.getElementById('authError').textContent='';}
function showAuthGate(show=true){const g=document.getElementById('authGate');if(g)g.classList.toggle('hidden',!show);document.body.classList.toggle('authLocked',show);if(show)showAuthMode('login');}
function showAdminLoginGate(){const g=document.getElementById('authGate');if(g)g.classList.add('hidden');document.body.classList.remove('authLocked');adminSession='';localStorage.removeItem('gold-alert-pro-admin-session-v38');showAdminMenu(false);const box=document.getElementById('adminLoginBox');if(box){box.style.display='block';const u=document.getElementById('adminUsernameInput'),pw=document.getElementById('adminPasswordInput');if(u)u.value='';if(pw)pw.value='';}const c=document.getElementById('adminContent');if(c)c.style.display='none';applyCategory('admin',false);}
function normalizeDigits(v){return String(v||'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));}
function normalizeMobile(v){return normalizeDigits(v).replace(/[\s-]/g,'').trim();}
async function gateLogin(){const mobile=normalizeMobile(document.getElementById('authMobile')?.value),password=document.getElementById('authPass')?.value||'';const err=document.getElementById('authError');if(!/^09\d{9}$/.test(mobile)||password.length<6){if(err)err.textContent='شماره موبایل یا رمز عبور معتبر نیست.';return;}try{const r=await fetch('/api/account/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:mobile,password,deviceId})});const d=await r.json();if(!r.ok)throw new Error(d.error||'ورود ناموفق');accountToken=d.token;localStorage.setItem(ACCOUNT_TOKEN_KEY_V26,accountToken);showAuthGate(false);setAccountStatus('🟢 وارد شدید.');await loadTickets();await loadUserSettings();}catch(e){if(err)err.textContent='⚠️ '+e.message;}}
async function gateRegister(){const mobile=normalizeMobile(document.getElementById('regMobile')?.value),p1=document.getElementById('regPass')?.value||'',p2=document.getElementById('regPass2')?.value||'',err=document.getElementById('authError');if(!/^09\d{9}$/.test(mobile)){if(err)err.textContent='شماره موبایل باید مثل 09123456789 باشد.';return}if(p1.length<6||p1!==p2){if(err)err.textContent='رمز باید حداقل ۶ کاراکتر باشد و دو بار یکسان وارد شود.';return}try{const r=await fetch('/api/account/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:mobile,password:p1,deviceId})});const d=await r.json();if(!r.ok)throw new Error(d.error||'ثبت‌نام ناموفق');accountToken=d.token;localStorage.setItem(ACCOUNT_TOKEN_KEY_V26,accountToken);showAuthGate(false);setAccountStatus('🟢 ثبت‌نام انجام شد و وارد شدید.');await loadTickets();await loadUserSettings();}catch(e){if(err)err.textContent='⚠️ '+e.message;}}
async function registerAccount(){showAuthGate(true);showAuthMode('register');}
async function loginAccount(){showAuthGate(true);showAuthMode('login');}
async function syncAccount(){if(!accountToken){showAuthGate(true);return}try{const r=await fetch('/api/account/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:accountToken,deviceId})});const d=await r.json();if(!r.ok)throw new Error(d.error||'همگام‌سازی ناموفق');setAccountStatus('☁️ همگام‌سازی انجام شد • '+new Date(d.syncedAt).toLocaleString('fa-IR'));}catch(e){setAccountStatus('⚠️ '+e.message);}}
async function logoutAccount(){if(accountToken)await fetch('/api/account/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:accountToken})}).catch(()=>{});accountToken='';localStorage.removeItem(ACCOUNT_TOKEN_KEY_V26);showAuthGate(true);}
function setAccountStatus(t){const e=document.getElementById('accountStatus');if(e)e.textContent=t;}
async function saveProfileV25(){const payload={deviceId,name:document.getElementById('profileName')?.value||'',city:document.getElementById('profileCity')?.value||'',phone:document.getElementById('profilePhone')?.value||''};try{const r=await fetch('/api/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw new Error(d.error||'ذخیره ناموفق');setAccountStatus('✅ مشخصات ذخیره شد.');}catch(e){setAccountStatus('⚠️ '+e.message);}}
async function loadProfileV25(){try{const r=await fetch('/api/profile?deviceId='+encodeURIComponent(deviceId),{cache:'no-store'});const d=await r.json();const p=d.profile||{};for(const [id,v] of [['profileName',p.name],['profileCity',p.city],['profilePhone',p.phone]]){const e=document.getElementById(id);if(e&&v)e.value=v;}}catch{}}
function initV25AutoSave(){['pfWeight','pfBuyPrice','pfPurity','pfNote'].forEach(id=>{const e=document.getElementById(id);if(e)e.addEventListener('change',()=>{const w=Number(document.getElementById('pfWeight')?.value),bp=Number(document.getElementById('pfBuyPrice')?.value);if(w>0&&bp>0)savePortfolioForm(true);});});loadAllocation();loadProfileV25();}
window.addEventListener('load',()=>{initV25AutoSave();});

// v26: commercial user/admin experience, decision room, market structure, AI chat and economic calendar.
let adminSession=localStorage.getItem('gold-alert-pro-admin-session-v38')||'';
const ACCOUNT_TOKEN_KEY_V26='gold-alert-pro-account-token-v28';
if(!accountToken){accountToken=localStorage.getItem(ACCOUNT_TOKEN_KEY_V26)||localStorage.getItem('gold-alert-pro-account-token-v28')||'';}
function accountHeaders(){return accountToken?{'x-account-token':accountToken}:{};}
function fmtDate(v){try{return new Date(v).toLocaleString('fa-IR',{dateStyle:'short',timeStyle:'short'});}catch{return String(v||'—')}}
async function loadMarketStructure(){
 try{const d=await fetch('/api/market-structure',{cache:'no-store'}).then(r=>r.json());
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  set('dsTrend',d.trendFa||'—');set('dsSupport',moneyIRR(d.support));set('dsResistance',moneyIRR(d.resistance));set('dsConfidence',fa(d.confidence)+'٪');
  set('dsSignal',latest?.analysis?.signal||'—');set('dsBuy',fa(latest?.marketPressure?.buy||0)+'٪');set('dsSell',fa(latest?.marketPressure?.sell||0)+'٪');
  const stateText=d.breakout?'شکست مقاومت':d.breakdown?'شکست حمایت':d.trendFa||'خنثی';set('dsState',stateText);
  const reason=document.getElementById('dsReason');if(reason)reason.innerHTML=`روند کوتاه‌مدت: <b>${esc(d.trendFa||'—')}</b> • تغییر کوتاه‌مدت ${f2(d.shortPct||0)}٪ • تغییر میان‌مدت ${f2(d.midPct||0)}٪<br>حمایت/مقاومت از نقاط چرخش داده‌های اخیر برآورد شده‌اند و حجم واقعی سفارشات در این نسخه در دسترس نیست.`;
 }catch(e){const r=document.getElementById('dsReason');if(r)r.textContent='⚠️ ساختار بازار فعلاً قابل دریافت نیست.';}
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

async function adminLogin(){const username=normalizeDigits(document.getElementById('adminUsernameInput')?.value.trim()||''),password=normalizeDigits(document.getElementById('adminPasswordInput')?.value||'');if(!username||!password)return alert('نام کاربری و رمز مدیریت را وارد کن.');try{const r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});const d=await r.json();if(!r.ok)throw new Error(d.error||'ورود مدیریت ناموفق');adminSession=d.token;localStorage.setItem('gold-alert-pro-admin-session-v38',adminSession);document.getElementById('adminLoginBox').style.display='none';document.getElementById('adminContent').style.display='block';showAdminMenu(true);applyCategory('admin',false);await adminLoadStats();await adminLoadOverview();await adminLoadBusinessDashboard();await adminLoadCommerceSettings();await adminLoadUsers();await adminLoadTickets();await adminLoadCalendar();}catch(e){alert('⚠️ '+e.message);}}
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
window.askGoldAI=askGoldAI;window.runProfessionalAI=runProfessionalAI;window.loadUserSettings=loadUserSettings;window.saveInvestorSettings=saveInvestorSettings;window.addStorageLocation=addStorageLocation;window.addHouseholdPortfolio=addHouseholdPortfolio;window.runLadderSimulation=runLadderSimulation;window.saveInvoiceRecord=saveInvoiceRecord;window.changePasswordPrompt=changePasswordPrompt;window.adminLoadOverview=adminLoadOverview;window.adminLoadBusinessDashboard=adminLoadBusinessDashboard;window.adminCheckUpdate=adminCheckUpdate;window.adminLogin=adminLogin;window.adminCreateUser=adminCreateUser;window.adminLoadUsers=adminLoadUsers;window.adminSaveUser=adminSaveUser;window.adminResetPassword=adminResetPassword;window.adminDeleteUser=adminDeleteUser;window.adminLoadCalendar=adminLoadCalendar;window.adminSaveCalendar=adminSaveCalendar;window.adminLogout=adminLogout;window.showAuthMode=showAuthMode;window.gateLogin=gateLogin;window.gateRegister=gateRegister;window.loadTickets=loadTickets;window.createTicket=createTicket;window.replyTicket=replyTicket;window.adminLoadTickets=adminLoadTickets;window.adminReplyTicket=adminReplyTicket;window.adminSetTicketStatus=adminSetTicketStatus;window.adminBroadcast=adminBroadcast;window.adminAddPayment=adminAddPayment;window.adminLoadAudit=adminLoadAudit;window.adminDownloadBackup=adminDownloadBackup;
async function restoreAccountSession(){if(!accountToken){showAuthGate(true);return}try{const r=await fetch('/api/account/me',{headers:accountHeaders(),cache:'no-store'});if(!r.ok)throw new Error('invalid');showAuthGate(false);setAccountStatus('🟢 وارد حساب: '+(await r.json()).user.username);await loadTickets();await loadUserSettings();}catch{accountToken='';localStorage.removeItem(ACCOUNT_TOKEN_KEY_V26);showAuthGate(true);}}
setInterval(loadMarketStructure,10000);setInterval(loadEconomicCalendar,180000);loadMarketStructure();loadEconomicCalendar();restoreAdminSession();restoreAccountSession();

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
