/* Gold2 Pro V72 - Command Center UI */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const N=v=>Number(v||0);
  const money=v=>{
    try{return typeof moneyIRR==='function'?moneyIRR(v):N(v).toLocaleString('fa-IR')+' ریال'}
    catch{return N(v).toLocaleString('fa-IR')+' ریال'}
  };
  const set=(id,v)=>{const e=$(id);if(e)e.textContent=v??'—'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pct=(a,b)=>b?((a/b-1)*100):0;

  function go(cat){
    if(typeof window.v71Navigate==='function'){window.v71Navigate(cat);return}
    if(typeof applyCategory==='function')applyCategory(cat,true);
  }

  function renderMiniChart(prices){
    const box=$('v72MiniChart'), empty=$('v72ChartEmpty');
    if(!box)return;
    const raw=(prices||[]).map(N).filter(Number.isFinite).slice(-60);
    if(raw.length<2){
      box.innerHTML='';
      if(empty)empty.style.display='block';
      ['v72ChartLast','v72ChartLow','v72ChartHigh','v72ChartChange'].forEach(id=>set(id,'—'));
      return;
    }
    if(empty)empty.style.display='none';
    const w=1000,h=250,px=12,py=18,min=Math.min(...raw),max=Math.max(...raw),range=max-min||1;
    const points=raw.map((v,i)=>{
      const x=px+i*(w-px*2)/(raw.length-1);
      const y=h-py-(v-min)/range*(h-py*2);
      return [x,y,v];
    });
    const poly=points.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
    const area=poly+' '+(w-px)+','+(h-py)+' '+px+','+(h-py);
    const last=points.at(-1);
    box.innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="نمودار قیمت طلای ۱۸">
      <defs><linearGradient id="v72GoldArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#e6c76e" stop-opacity=".22"/><stop offset="100%" stop-color="#e6c76e" stop-opacity="0"/></linearGradient></defs>
      <line x1="${px}" y1="${py}" x2="${w-px}" y2="${py}" class="v72ChartGrid"/>
      <line x1="${px}" y1="${h/2}" x2="${w-px}" y2="${h/2}" class="v72ChartGrid"/>
      <line x1="${px}" y1="${h-py}" x2="${w-px}" y2="${h-py}" class="v72ChartGrid"/>
      <text x="${w-px}" y="13" text-anchor="end" class="v72ChartAxis">${esc(money(max))}</text>
      <text x="${w-px}" y="${h-4}" text-anchor="end" class="v72ChartAxis">${esc(money(min))}</text>
      <polygon points="${area}" class="v72ChartArea"/>
      <polyline points="${poly}" class="v72ChartLine"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="5" class="v72ChartDot"/>
    </svg>`;
    const first=raw[0], lastVal=raw.at(-1), delta=pct(lastVal,first);
    set('v72ChartLast',money(lastVal));
    set('v72ChartLow',money(min));
    set('v72ChartHigh',money(max));
    const ch=$('v72ChartChange');
    if(ch){ch.textContent=(delta>=0?'▲ ':'▼ ')+Math.abs(delta).toFixed(2)+'٪';ch.style.color=delta>=0?'#43dfa0':'#ff718a'}
  }

  function renderPortfolio(s){
    const p=window.__lastPortfolioSnapshot;
    if(!p){set('v72Portfolio','—');set('v72Pnl','سبد ثبت نشده');return}
    set('v72Portfolio',money(p.totalValue));
    const pnl=p.pnl||0;
    set('v72Pnl',(pnl>=0?'▲ سود ':'▼ زیان ')+money(Math.abs(pnl)));
    const e=$('v72Pnl');if(e)e.style.color=pnl>=0?'#43dfa0':'#ff718a';
  }

  function render(s){
    if(!s)return;
    const gold=N(s?.iran?.priceIRR), dollar=N(s?.dollar?.priceIRR), xau=N(s?.global?.xauUsd), btc=N(s?.crypto?.btcUsd||s?.btcUsd||s?.crypto?.bitcoin);
    set('v72Gold',gold?money(gold):'—');
    set('v72Dollar',dollar?money(dollar):'—');
    set('v72Xau',xau?'$'+xau.toLocaleString('en-US',{maximumFractionDigits:2}):'—');
    set('v72Btc',btc?'$'+btc.toLocaleString('en-US',{maximumFractionDigits:2}):'—');

    const es=s.engineStatus||{}, status=es.status||'OFFLINE';
    set('v72LiveText',status==='LIVE'?'LIVE • زنده':status==='STALE'?'تاخیر داده':'آفلاین');
    set('v72UpdateTime',s.updatedAt?'آخرین بروزرسانی: '+new Date(s.updatedAt).toLocaleTimeString('fa-IR'):'آخرین بروزرسانی: —');

    const prices=(s.prices||[]).map(Number).filter(Number.isFinite);
    const last=prices.at(-1), first=prices[0], move=prices.length>1?pct(last,first):0;
    let bias='خنثی';
    if(move>.35)bias='سوگیری صعودی';
    else if(move<-.35)bias='سوگیری نزولی';
    set('v72Bias',prices.length?bias:'—');
    set('v72Confidence',prices.length>=20?'داده کافی':'داده محدود');
    set('v72Trend',prices.length?bias:'—');
    set('v72Momentum',prices.length>=3?(pct(last,prices[Math.max(0,prices.length-4)])>=0?'مثبت':'منفی'):'—');
    set('v72Volatility',prices.length>5?((Math.max(...prices)-Math.min(...prices))/Math.max(...prices)*100).toFixed(2)+'٪':'—');
    set('v72DecisionText',prices.length?
      `حرکت بازه جاری ${move.toFixed(2)}٪ است. این نمایش توصیفی از داده‌های موجود سامانه است و سیگنال قطعی یا تضمین سود محسوب نمی‌شود.`:
      'در انتظار داده قیمت برای تحلیل...');

    renderMiniChart(prices);
    renderPortfolio(s);
    renderSources(s);
    renderWatch(s);
    renderAlerts(s);
  }

  function renderSources(s){
    const box=$('v72Sources');if(!box)return;
    const primary=String(s?.engineStatus?.primarySource||s?.source||'Forgod').toLowerCase();
    const rows=[
      ['Forgod','منبع اصلی',primary.includes('forgod')],
      ['TGJU','پشتیبان',true],
      ['Servix','پشتیبان',true],
      ['Tindex','پشتیبان',true]
    ];
    box.innerHTML=rows.map(x=>`<div class="v72Source"><span><b>${esc(x[0])}</b> <small>• ${esc(x[1])}</small></span><b class="${x[2]?'ok':'warn'}">${x[2]?'● فعال':'○ آماده'}</b></div>`).join('');
  }

  function renderWatch(s){
    const box=$('v72Watch');if(!box)return;
    const rows=[
      ['طلای ۱۸',s?.iran?.priceIRR,money(s?.iran?.priceIRR)],
      ['دلار',s?.dollar?.priceIRR,money(s?.dollar?.priceIRR)],
      ['اونس جهانی',s?.global?.xauUsd,s?.global?.xauUsd?'$'+N(s.global.xauUsd).toLocaleString('en-US',{maximumFractionDigits:2}):'—'],
      ['بیت‌کوین',s?.crypto?.btcUsd||s?.btcUsd,s?.crypto?.btcUsd?'$'+N(s.crypto.btcUsd).toLocaleString('en-US',{maximumFractionDigits:2}):'—'],
      ['سکه امامی',s?.coins?.emami,money(s?.coins?.emami)]
    ];
    box.innerHTML=rows.map(r=>`<div><span>${esc(r[0])}</span><b>${esc(r[2])}</b><small>${r[1]!=null?'LIVE':'بدون داده'}</small></div>`).join('');
  }

  function renderAlerts(s){
    const box=$('v72Alerts');if(!box)return;
    const events=(s?.events||[]).slice(-4).reverse();
    box.innerHTML=events.length?events.map(e=>`<div class="v72Item"><span>${esc(e.text||e.message||e.kind||'رویداد بازار')}</span><small>${e.at?new Date(e.at).toLocaleTimeString('fa-IR'):'—'}</small></div>`).join(''):
      '<div class="v72Item"><span>هنوز هشدار یا رویداد مهمی ثبت نشده است.</span><small>—</small></div>';
  }

  function init(){
    document.querySelectorAll('[data-v72-go]').forEach(b=>{
      if(b.dataset.v72Bound)return;
      b.dataset.v72Bound='1';
      b.addEventListener('click',e=>{e.preventDefault();go(b.dataset.v72Go)});
    });
    setTimeout(()=>{try{if(typeof latest!=='undefined')render(latest)}catch{}},1200);
    setInterval(()=>{try{if(typeof latest!=='undefined')render(latest)}catch{}},2000);
  }

  window.v72Navigate=go;
  window.v72Render=render;
  document.addEventListener('DOMContentLoaded',init,{once:true});
})();