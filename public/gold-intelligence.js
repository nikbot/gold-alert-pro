/* Gold Intelligence Center v60 - client-side product layer. Uses only live APIs already exposed by Gold Alert Pro. */
(function(){
  const KEY='gold_intelligence_v60';
  const $=id=>document.getElementById(id);
  const fa=n=>Number(n||0).toLocaleString('fa-IR');
  const pct=n=>`${Number(n||0).toFixed(2)}٪`;
  const money=n=>Number(n||0).toLocaleString('fa-IR',{maximumFractionDigits:0});
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const write=v=>localStorage.setItem(KEY,JSON.stringify(v));
  let state={};
  async function get(url){const r=await fetch(url,{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'خطا');return d}
  function setStatus(text,good=true){const e=$('giStatus');if(e){e.textContent=(good?'● ':'⚠️ ')+text;e.className='giStatus '+(good?'good':'warn')}}
  async function load(){
    try{const [s,ms,cal,news]=await Promise.all([get('/api/state'),get('/api/market-structure'),get('/api/economic-calendar'),get('/api/news')]);
      state={...s,marketStructure:ms,events:cal.events||[],news:Array.isArray(news)?news:[]}; renderAll(); setStatus('داده زنده و ابزارها آماده‌اند');
    }catch(e){setStatus(e.message,false);renderAll()}
  }
  function renderAll(){
    const p=Number(state.iran?.priceIRR||state.priceIRR||$('price')?.textContent?.replace(/\D/g,'')||0);
    const dollar=Number(state.dollar?.priceIRR||state.dollar?.price||state.market?.dollar||0);
    const xau=Number(state.xau?.price||state.xau?.usd||state.market?.xau||0);
    $('giGold').textContent=p?money(p):'—'; $('giDollar').textContent=dollar?money(dollar):'—'; $('giXau').textContent=xau?money(xau):'—';
    const ms=state.marketStructure||{}; $('giTrend').textContent=ms.trendFa||ms.trend||'—'; $('giSupport').textContent=ms.support?money(ms.support):'—'; $('giResistance').textContent=ms.resistance?money(ms.resistance):'—';
    const assets=[['طلا',p],['دلار',dollar],['اونس',xau]]; $('giScanner').innerHTML=assets.map(([n,v])=>`<div class="giScan"><b>${n}</b><strong>${v?money(v):'—'}</strong><small>${v?'داده موجود':'داده کافی نیست'}</small></div>`).join('');
    renderWatchlist(); renderJournal(); renderEvents(); renderCompare();
  }
  function renderWatchlist(){const d=read(),list=Array.isArray(d.watchlist)?d.watchlist:[];const box=$('giWatchlist');if(!box)return;box.innerHTML=list.length?list.map((x,i)=>`<div class="giRow"><span>⭐ ${esc(x.name)}</span><b>${esc(x.note||'پیگیری شخصی')}</b><button class="secondary giTiny" data-wdel="${i}">حذف</button></div>`).join(''):'<div class="giEmpty">هنوز موردی به Watchlist اضافه نشده است.</div>';box.querySelectorAll('[data-wdel]').forEach(b=>b.onclick=()=>{list.splice(Number(b.dataset.wdel),1);d.watchlist=list;write(d);renderWatchlist()})}
  function renderJournal(){const d=read(),list=Array.isArray(d.journal)?d.journal:[];const box=$('giJournalList');if(!box)return;box.innerHTML=list.length?list.slice().reverse().slice(0,20).map((x,i)=>`<div class="giJournal"><div><b>${esc(x.asset)}</b><small>${esc(x.date||'بدون تاریخ')}</small></div><div><span>ورود ${money(x.entry)}</span><span>خروج ${money(x.exit)}</span><strong class="${Number(x.exit)>=Number(x.entry)?'pos':'neg'}">${pct((Number(x.exit)/Math.max(1,Number(x.entry))-1)*100)}</strong></div></div>`).join(''):'<div class="giEmpty">معامله‌ای ثبت نشده است.</div>'}
  function renderEvents(){const box=$('giEvents');if(!box)return;const ev=state.events||[];box.innerHTML=ev.length?ev.slice(0,8).map(x=>`<div class="giRow"><span>📅 ${esc(x.title||'رویداد')}</span><b>${esc(x.impact||'watch')} • ${esc(x.date||x.datetime||'')}</b></div>`).join(''):'<div class="giEmpty">رویداد اقتصادی ثبت‌شده‌ای در دسترس نیست.</div>'}
  function renderCompare(){const box=$('giCompare');if(!box)return;const p=Number(state.iran?.priceIRR||0),d=Number(state.dollar?.priceIRR||0),x=Number(state.xau?.price||0);box.innerHTML=`<div class="giCompareGrid"><div><span>طلای ۱۸</span><b>${p?money(p):'—'}</b></div><div><span>دلار</span><b>${d?money(d):'—'}</b></div><div><span>اونس</span><b>${x?money(x):'—'}</b></div></div><div class="giEmpty">برای مقایسه بازده تاریخی، داده تاریخی هر دارایی باید از منبع مستقل آن موجود باشد؛ سیستم عدد ساختگی تولید نمی‌کند.</div>`}
  function addWatch(){const n=$('giWatchName')?.value.trim();if(!n)return;const d=read();d.watchlist=Array.isArray(d.watchlist)?d.watchlist:[];d.watchlist.push({name:n,note:$('giWatchNote')?.value.trim()||'',at:new Date().toISOString()});write(d);$('giWatchName').value='';$('giWatchNote').value='';renderWatchlist()}
  function addJournal(){const asset=$('giJAsset')?.value.trim(),entry=Number($('giJEntry')?.value),exit=Number($('giJExit')?.value);if(!asset||!entry||!exit)return;const d=read();d.journal=Array.isArray(d.journal)?d.journal:[];d.journal.push({asset,entry,exit,date:new Date().toLocaleDateString('fa-IR')});write(d);['giJAsset','giJEntry','giJExit'].forEach(id=>$(id).value='');renderJournal()}
  async function scenario(){const pctVal=Number($('giScenarioPct')?.value);const box=$('giScenarioResult');if(!box)return;box.textContent='در حال محاسبه...';try{const d=await get(`/api/portfolio-scenario?deviceId=${encodeURIComponent(window.deviceId||'')}&pct=${encodeURIComponent(pctVal)}`);box.innerHTML=`<b>سناریوی ${pct(pctVal)}</b><br>ارزش فعلی: ${money(d.currentValue||0)}<br>ارزش سناریو: ${money(d.scenarioValue||0)}<br>تغییر تقریبی: ${money((d.scenarioValue||0)-(d.currentValue||0))}`;}catch(e){box.textContent='⚠️ '+e.message}}
  async function daily(){const box=$('giDaily');box.textContent='در حال تولید گزارش...';try{const r=await fetch('/api/ai-professional',{method:'POST',headers:{'Content-Type':'application/json',...(typeof accountHeaders==='function'?accountHeaders():{})},body:JSON.stringify({deviceId:window.deviceId,accountToken:window.accountToken,question:'گزارش حرفه‌ای و بی‌طرفانه بازار تهیه کن: قیمت، روند، حمایت، مقاومت، ریسک، رویدادهای امروز، سناریوهای صعودی/پایه/نزولی. داده مفقود را صریح بگو و دستور قطعی خرید یا فروش نده.'})});const d=await r.json();if(!r.ok)throw Error(d.error||'خطا');box.textContent=d.text||'گزارش دریافت نشد.'}catch(e){box.textContent='⚠️ '+e.message}}
  async function replay(){const box=$('giReplay');box.textContent='در حال دریافت داده تاریخی...';try{const d=await get('/api/candles?seconds=60');const arr=Array.isArray(d.candles)?d.candles:Array.isArray(d)?d:[];if(!arr.length)throw Error('داده تاریخی کافی نیست');const i=Math.min(Math.max(Number($('giReplayRange')?.value||50),1),arr.length);const c=arr[i-1];box.innerHTML=`<div class="giReplayPrice">${money(c.close||c.price||0)}</div><div class="small">بازه ${fa(i)} از ${fa(arr.length)} • Replay آموزشی فقط بر اساس داده ثبت‌شده</div>`}catch(e){box.textContent='⚠️ '+e.message}}
  function bind(){
    $('giWatchAdd')?.addEventListener('click',addWatch); $('giJournalAdd')?.addEventListener('click',addJournal); $('giScenarioRun')?.addEventListener('click',scenario); $('giDailyBtn')?.addEventListener('click',daily); $('giReplayBtn')?.addEventListener('click',replay); $('giRefresh')?.addEventListener('click',load);
    document.querySelectorAll('[data-gi-cat]').forEach(b=>b.onclick=()=>{if(typeof applyCategory==='function')applyCategory(b.dataset.giCat)});
    load(); setInterval(load,30000);
  }
  window.goldIntelligence={load,scenario,daily,replay};
  document.addEventListener('DOMContentLoaded',bind);
})();
