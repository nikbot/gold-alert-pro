/* Gold2 Pro V72 - Command Center / Financial Terminal */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const money = (v) => {
    const n = num(v);
    try {
      if (typeof window.moneyIRR === 'function') return window.moneyIRR(n);
    } catch (_) {}
    return n ? n.toLocaleString('fa-IR') : '—';
  };
  const set = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value == null || value === '' ? '—' : value;
  };

  function percent(a, b) {
    const x = num(a), y = num(b);
    return y ? ((x / y) - 1) * 100 : 0;
  }

  function getBitcoin(s) {
    return num(
      s?.bitcoin?.priceUsd ??
      s?.bitcoin?.price ??
      s?.bitcoin?.usd ??
      s?.crypto?.btcUsd ??
      s?.btcUsd
    );
  }

  function getState() {
    if (typeof window.latest !== 'undefined' && window.latest) return Promise.resolve(window.latest);
    return fetch('/api/state', { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error(`state ${r.status}`);
      return r.json();
    });
  }

  function renderSources(s) {
    const box = $('v72Sources');
    if (!box) return;
    const diagnostics = s?.sourceDiagnostics;
    const sources = Array.isArray(diagnostics?.sources) ? diagnostics.sources : [];
    const primary = diagnostics?.primary || s?.iran?.source || '—';

    if (!sources.length) {
      box.innerHTML = `<div class="v72Source"><span>منبع اصلی <small>• ${primary}</small></span><b class="ok">● فعال</b></div>`;
      return;
    }

    box.innerHTML = sources.slice(0, 5).map((x) => {
      const ok = Boolean(x?.ok);
      const name = x?.name || 'Provider';
      const label = name === primary ? 'منبع اصلی' : 'منبع پشتیبان';
      return `<div class="v72Source"><span>${name} <small>• ${label}</small></span><b class="${ok ? 'ok' : 'warn'}">${ok ? '● فعال' : '○ خطا'}</b></div>`;
    }).join('');
  }

  function renderWatch(s) {
    const box = $('v72Watch');
    if (!box) return;

    const btc = getBitcoin(s);
    const rows = [
      ['طلای ۱۸', num(s?.iran?.priceIRR), money(s?.iran?.priceIRR)],
      ['دلار', num(s?.dollar?.priceIRR), money(s?.dollar?.priceIRR)],
      ['اونس', num(s?.global?.xauUsd), num(s?.global?.xauUsd) ? '$' + num(s.global.xauUsd).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'],
      ['بیت‌کوین', btc, btc ? '$' + btc.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'],
      ['سکه امامی', num(s?.coins?.emami), money(s?.coins?.emami)]
    ];

    box.innerHTML = rows.map(([name, raw, value]) =>
      `<div><span>${name}</span><b>${value}</b><small>${raw ? 'LIVE' : 'بدون داده'}</small></div>`
    ).join('');
  }


  function signalMeta(analysis) {
    const signal = analysis?.signal || 'WAIT';
    const ready = analysis?.ready !== false && Number(analysis?.sampleSize || 0) >= 50;
    const score = Number(analysis?.score || 0);
    const meta = {
      BUY: { label: 'خرید پله‌ای', cls: 'buy', text: 'نشانه‌های صعودی بیشتر شده‌اند؛ اگر قصد ورود داری، خرید را پله‌ای و با حد ریسک مشخص بررسی کن.' },
      SELL: { label: 'کاهش ریسک / فروش پله‌ای', cls: 'sell', text: 'نشانه‌های نزولی بیشتر شده‌اند؛ کاهش ریسک یا فروش پله‌ای را بررسی کن، نه تصمیم عجولانه.' },
      WATCH_BUY: { label: 'مراقب فرصت خرید باش', cls: 'watch-buy', text: 'کفه صعودی سنگین‌تر است، ولی هنوز تأیید کافی برای سیگنال خرید نداریم.' },
      WATCH_SELL: { label: 'مراقب ضعف بازار باش', cls: 'watch-sell', text: 'کفه نزولی سنگین‌تر است، ولی هنوز تأیید کافی برای سیگنال فروش نداریم.' },
      WAIT: { label: 'فعلاً صبر کن', cls: 'wait', text: 'فعلاً جهت بازار به‌اندازه کافی روشن نیست؛ عجله نکن و منتظر داده تازه‌تر بمان.' }
    };
    if (!ready) return { label: 'هنوز زوده', cls: 'wait', text: 'داده کافی برای یک سیگنال قابل اتکا جمع نشده؛ فعلاً فقط بازار را زیر نظر بگیر.', score: score, reasons: ['حداقل ۵۰ نقطه قیمت برای تحلیل لازم است.'] };
    return { ...(meta[signal] || meta.WAIT), score, reasons: Array.isArray(analysis?.reasons) ? analysis.reasons.slice(-4) : [] };
  }

  function renderSignal(s) {
    const a = s?.analysis;
    const meta = signalMeta(a);
    const signalEl = $('v72Signal');
    if (signalEl) {
      signalEl.textContent = meta.label;
      signalEl.className = `v72SignalBadge ${meta.cls}`;
    }
    set('v72SignalScore', Number.isFinite(meta.score) && meta.score > 0 ? `${Math.round(meta.score)}٪` : '—');
    set('v72SignalText', meta.text);

    const box = $('v72SignalReasons');
    if (box) {
      box.innerHTML = meta.reasons.length
        ? meta.reasons.map((r) => `<span>✓ ${r}</span>`).join('')
        : '<span>• دلیل مشخصی برای سیگنال فعلی ثبت نشده است.</span>';
    }
  }

  function renderAlerts(s) {
    const box = $('v72Alerts');
    if (!box) return;
    const events = Array.isArray(s?.events) ? s.events.slice(-4).reverse() : [];
    box.innerHTML = events.length
      ? events.map((e) => `<div class="v72Item"><span>${e.text || e.message || e.kind || 'رویداد بازار'}</span><small>${e.at ? new Date(e.at).toLocaleTimeString('fa-IR') : '—'}</small></div>`).join('')
      : '<div class="v72Item"><span>هنوز هشدار یا رویداد مهمی ثبت نشده است.</span><small>—</small></div>';
  }

  function render(s) {
    if (!s) return;

    const gold = num(s?.iran?.priceIRR);
    const dollar = num(s?.dollar?.priceIRR);
    const xau = num(s?.global?.xauUsd);
    const btc = getBitcoin(s);

    set('v72Gold', gold ? money(gold) : '—');
    set('v72Dollar', dollar ? money(dollar) : '—');
    set('v72Xau', xau ? '$' + xau.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—');
    set('v72Btc', btc ? '$' + btc.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—');
    set('v72UpdateTime', s.updatedAt ? new Date(s.updatedAt).toLocaleTimeString('fa-IR') : '—');

    const status = s?.engineStatus?.status || 'OFFLINE';
    set('v72LiveText', status === 'LIVE' ? 'LIVE • زنده' : status === 'STALE' ? 'تاخیر داده' : 'آفلاین');

    const prices = Array.isArray(s?.prices)
      ? s.prices.map(Number).filter(Number.isFinite)
      : [];
    const last = prices.at(-1);
    const first = prices[0];
    const move = percent(last, first);

    let bias = 'خنثی';
    if (move > 0.35) bias = 'سوگیری صعودی';
    else if (move < -0.35) bias = 'سوگیری نزولی';

    set('v72Bias', prices.length ? bias : '—');
    set('v72Confidence', prices.length >= 20 ? 'اعتماد: داده کافی' : 'اعتماد: داده محدود');
    set('v72Trend', prices.length ? bias : '—');
    set('v72Momentum', prices.length >= 4 ? (percent(last, prices[Math.max(0, prices.length - 4)]) >= 0 ? 'مثبت' : 'منفی') : '—');
    set('v72Volatility', prices.length > 5
      ? ((Math.max(...prices) - Math.min(...prices)) / Math.max(...prices) * 100).toFixed(2) + '٪'
      : '—');

    set(
      'v72DecisionText',
      prices.length
        ? `حرکت بازه جاری ${move.toFixed(2)}٪ است. این وضعیت صرفاً از داده‌های موجود سامانه استخراج شده و سیگنال قطعی نیست.`
        : 'در انتظار داده قیمت...'
    );

    renderSignal(s);
    renderSources(s);
    renderWatch(s);
    renderAlerts(s);
  }

  async function refresh() {
    try {
      const s = await getState();
      render(s);
    } catch (err) {
      set('v72LiveText', 'اتصال به بازار برقرار نیست');
      console.warn('[V72 Terminal] state unavailable:', err?.message || err);
    }
  }

  function go(category) {
    if (typeof window.v71Navigate === 'function') {
      window.v71Navigate(category);
      return;
    }
    if (typeof window.applyCategory === 'function') window.applyCategory(category);
  }

  function init() {
    document.querySelectorAll('[data-v72-go]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        go(button.dataset.v72Go);
      });
    });

    refresh();
    window.setInterval(refresh, 5000);
  }

  document.addEventListener('DOMContentLoaded', init, { once: true });
  window.v72Navigate = go;
})();
