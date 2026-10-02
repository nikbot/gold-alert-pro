(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const fa = (n, max = 0) => Number(n || 0).toLocaleString('fa-IR', { maximumFractionDigits: max });
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const device = () => localStorage.getItem('gold-alert-pro-device-id-v10') || '';
  const direction = { BUY: 'خرید', SELL: 'فروش', WAIT: 'فعلاً صبر کن' };
  let timeframe = '1h', selected = 'GOLD18', amountKind = 'gold', signals = [], trades = [], loading = false, opened = false;

  function price(row, value = row?.price) {
    if (!Number.isFinite(Number(value))) return '—';
    return row?.kind === 'gold' ? `${fa(value)} تومان` : `$${fa(value, value < 10 ? 4 : 2)}`;
  }
  function volume(value, row) {
    return row?.kind === 'gold' ? fa(value, 0) : fa(value, 4);
  }
  function selectedRow() { return signals.find(x => x.symbol === selected); }

  function renderChart(row) {
    const box = $('#v80Chart');
    if (!row?.candles?.length) { box.innerHTML = '<div class="v80Loading">کندل زنده‌ای برای این نماد دریافت نشد.</div>'; return; }
    const data = row.candles.slice(-64), W = 1000, H = 260, top = 12, bottom = 74, left = 12, right = 12;
    const hi = Math.max(...data.map(c => c.high)), lo = Math.min(...data.map(c => c.low)), span = hi - lo || 1;
    const xStep = (W - left - right) / data.length, bodyW = Math.max(3, xStep * .56);
    const y = v => top + (hi - v) / span * (H - top - bottom);
    const maxVol = Math.max(...data.map(c => c.volume), 1);
    const candles = data.map((c, i) => {
      const x = left + (i + .5) * xStep, up = c.close >= c.open, color = up ? 'v80Up' : 'v80Down';
      const bodyTop = y(Math.max(c.open, c.close)), bodyBottom = y(Math.min(c.open, c.close));
      const volumeHeight = Math.max(2, c.volume / maxVol * 50);
      return `<line x1="${x}" y1="${y(c.high)}" x2="${x}" y2="${y(c.low)}" class="${color}"/><rect x="${x - bodyW / 2}" y="${bodyTop}" width="${bodyW}" height="${Math.max(1.5, bodyBottom - bodyTop)}" class="${color}"/><rect x="${x - bodyW / 2}" y="${H - volumeHeight - 8}" width="${bodyW}" height="${volumeHeight}" class="${color} v80Vol"/>`;
    }).join('');
    const grid = [.25, .5, .75].map(q => `<line x1="${left}" y1="${top + (H - top - bottom) * q}" x2="${W - right}" y2="${top + (H - top - bottom) * q}" class="v80Grid"/>`).join('');
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="نمودار کندل و حجم ${esc(row.name)}">${grid}${candles}<text x="${W - right}" y="13" text-anchor="end" class="v80Axis">${fa(hi, row.kind === 'gold' ? 1 : 2)}</text><text x="${W - right}" y="${H - 4}" text-anchor="end" class="v80Axis">${fa(lo, row.kind === 'gold' ? 1 : 2)}</text><text x="${left}" y="${H - 4}" class="v80Axis">حجم معامله در پایین نمودار</text></svg>`;
    $('#v80ChartTitle').textContent = `${row.name} • ${row.timeframe}`;
    $('#v80ChartSource').textContent = row.sourceUnit || '';
  }

  function renderAsset(row) {
    const isAction = ['BUY', 'SELL'].includes(row.signal) && row.quoteLive && !row.stale;
    const cls = row.signal === 'BUY' ? 'buy' : row.signal === 'SELL' ? 'sell' : 'wait';
    const volName = row.flowActual ? 'خرید/فروش واقعی ۵ دقیقهٔ اخیر' : 'خرید/فروش تخمینی از کندل‌ها';
    const share = row.buyShare == null ? '—' : `${fa(row.buyShare * 100, 1)}٪ خرید`;
    const reasons = (row.reasons || []).map(x => `<li>${esc(x)}</li>`).join('');
    return `<article class="v80Asset ${row.symbol === selected ? 'selected' : ''} ${row.kind === 'gold' ? 'gold' : ''}">
      <div class="v80AssetTop"><div><small>${row.kind === 'gold' ? 'اولویت اول' : 'رمزارز'}</small><h3>${esc(row.name)}</h3></div><span class="v80Badge ${cls}">${direction[row.signal] || direction.WAIT}</span></div>
      <div class="v80Price">${price(row)}</div><div class="v80DataLine">${esc(row.quoteSource || row.source || 'منبع نامشخص')} • ${row.quoteLive ? 'قیمت تازه' : 'قیمت تازه نیست'}${row.kind === 'gold' && row.source ? `<br>کندل مرجع: ${esc(row.source)}` : ''}</div>
      <div class="v80Levels"><div><small>اگر وارد شوی</small><b>${price(row)}</b></div><div><small>هدف احتمالی</small><b>${price(row, row.target)}</b></div><div><small>حد خروج برای کنترل ضرر</small><b>${price(row, row.stop)}</b></div><div><small>زمان نگهداری پیشنهادی</small><b>${esc(row.hold || '—')}</b></div></div>
      <div class="v80Score"><span>قدرت هم‌جهتی نشانه‌ها</span><b>${fa(row.score || 0)} از ۱۰۰</b><i><em style="width:${Math.min(100, Math.max(0, Number(row.score || 0)))}%"></em></i></div>
      <div class="v80Flow"><div><small>${volName}</small><b>${share}</b></div><div><small>حجم خرید</small><b>${volume(row.buyVolume || 0, row)} ${row.kind === 'gold' ? 'قرارداد' : esc(row.symbol.slice(0, -3))}</b></div><div><small>حجم فروش</small><b>${volume(row.sellVolume || 0, row)} ${row.kind === 'gold' ? 'قرارداد' : esc(row.symbol.slice(0, -3))}</b></div></div>
      <ul class="v80Reasons">${reasons || '<li>دادهٔ کافی برای گفتن جهت بازار نرسیده.</li>'}</ul><div class="v80DataNote">${esc(row.dataNote || '')}</div>
      <button class="v80Choose" data-v80-select="${esc(row.symbol)}">${isAction ? `انتخاب سیگنال ${direction[row.signal]} برای تمرین` : 'انتخاب و دیدن نمودار'}</button>
    </article>`;
  }

  function renderSignals() {
    const list = $('#v80Assets');
    list.innerHTML = signals.length ? signals.map(renderAsset).join('') : '<div class="v80Loading">هنوز داده‌ای از بازار نرسیده.</div>';
    const gold = signals.find(x => x.symbol === 'GOLD18');
    $('#v80FeedStatus').textContent = gold?.quoteLive ? `داده تازه • ${new Date(gold.quoteAt).toLocaleTimeString('fa-IR')}` : 'دادهٔ تازه در دسترس نیست؛ سیگنال قطعی نمی‌دهیم';
    const row = selectedRow();
    if (!row) return;
    if (row.kind !== amountKind) {
      amountKind = row.kind;
      $('#v80Amount').value = amountKind === 'gold' ? '10000000' : '100';
    }
    $('#v80SelectedName').textContent = row.name;
    $('#v80AmountUnit').textContent = row.kind === 'gold' ? 'تومان' : 'دلار';
    $('#v80Amount').min = row.kind === 'gold' ? '1000' : '1';
    if (row.kind === 'gold') $('#v80Amount').value = $('#v80Amount').value || '10000000';
    $('#v80ChartTitle').textContent = `${row.name} • ${row.timeframe}`;
    renderChart(row);
    const actionable = ['BUY', 'SELL'].includes(row.signal) && row.quoteLive && !row.stale;
    $('#v80SelectedSignal').textContent = actionable
      ? `الان نشانهٔ ${direction[row.signal]} داریم. ورود فرضی ${price(row)} • هدف ${price(row, row.target)} • حد خروج ${price(row, row.stop)} • نگهداری ${row.hold}.`
      : `فعلاً صبر کن. ${row.reasons?.[0] || 'هنوز نشانهٔ روشن و قیمت تازه نداریم.'}`;
    $('#v80StartPaper').disabled = !actionable;
  }

  function renderTrades() {
    const box = $('#v80Trades');
    const total = trades.filter(t => t.status === 'CLOSED').reduce((s, t) => s + Number(t.pnl || 0), 0);
    const active = trades.filter(t => t.status === 'OPEN').length;
    $('#v80HistorySummary').textContent = `${fa(active)} باز • نتیجهٔ بسته‌شده ${total >= 0 ? '+' : '−'}${fa(Math.abs(total), 2)}`;
    if (!trades.length) { box.innerHTML = '<div class="v80Empty">هنوز تمرینی شروع نکردی. یکی از سیگنال‌های روشن را انتخاب کن.</div>'; return; }
    box.innerHTML = `<div class="v80TradeList">${trades.map(t => {
      const open = t.status === 'OPEN', pnl = Number(t.pnl || 0), outcome = open ? (pnl > 0 ? 'سود تا این لحظه' : pnl < 0 ? 'ضرر تا این لحظه' : 'تقریباً سربه‌سر') : (t.outcome === 'PROFIT' ? 'با سود بسته شد' : t.outcome === 'LOSS' ? 'با ضرر بسته شد' : 'بدون سود و ضرر بسته شد');
      const cls = pnl > 0 ? 'profit' : pnl < 0 ? 'loss' : '';
      const reason = t.closeReason === 'TARGET' ? 'هدف خورد' : t.closeReason === 'STOP' ? 'حد خروج خورد' : t.closeReason === 'TIME' ? 'زمان تمرین تمام شد' : 'در حال پیگیری';
      return `<div class="v80Trade"><div><b>${esc(t.name)} • ${direction[t.direction]}</b><small>${esc(reason)} • ورود ${price({ kind: t.symbol === 'GOLD18' ? 'gold' : 'crypto' }, t.entry)}</small></div><div><small>${outcome}</small><b class="${cls}">${pnl > 0 ? '+' : pnl < 0 ? '−' : ''}${fa(Math.abs(pnl), 2)} ${esc(t.currency)}</b></div><div><small>مبلغ فرضی</small><b>${fa(t.amount, 2)} ${esc(t.currency)}</b></div><div><small>قیمت فعلی</small><b>${price({ kind: t.symbol === 'GOLD18' ? 'gold' : 'crypto' }, t.currentPrice)}</b></div></div>`;
    }).join('')}</div>`;
  }

  async function loadTrades() {
    const res = await fetch(`/api/paper-trades?deviceId=${encodeURIComponent(device())}`, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'نتیجهٔ تمرین‌ها دریافت نشد');
    trades = data.trades || [];
    renderTrades();
  }

  async function loadSignals() {
    if (loading) return;
    loading = true;
    $('#v80FeedStatus').textContent = 'در حال تازه‌کردن داده…';
    try {
      const res = await fetch(`/api/trading-signals?timeframe=${encodeURIComponent(timeframe)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'دریافت داده ناموفق بود');
      signals = data.signals || [];
      renderSignals();
      await loadTrades();
    } catch (error) {
      $('#v80FeedStatus').textContent = 'اتصال به دادهٔ بازار برقرار نشد';
      $('#v80Assets').innerHTML = `<div class="v80Empty">${esc(error.message)}<br>تا برگشت دادهٔ معتبر، سیگنالی نمایش داده نمی‌شود.</div>`;
    } finally { loading = false; }
  }

  async function startPaper() {
    const row = selectedRow(), amount = Number($('#v80Amount').value);
    if (!row || !['BUY', 'SELL'].includes(row.signal)) return;
    const button = $('#v80StartPaper');
    button.disabled = true; button.textContent = 'در حال شروع…';
    try {
      const res = await fetch('/api/paper-trades', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: device(), symbol: row.symbol, amount, timeframe }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'شروع تمرین ناموفق بود');
      await loadTrades();
      button.textContent = 'تمرین ثبت شد';
      setTimeout(() => { button.textContent = 'شروع تمرین'; button.disabled = false; }, 1600);
    } catch (error) {
      $('#v80SelectedSignal').textContent = error.message;
      button.textContent = 'شروع تمرین'; button.disabled = false;
    }
  }

  function wire() {
    document.addEventListener('click', event => {
      const nav = event.target.closest('[data-v62cat="signals"]');
      if (nav) { opened = true; loadSignals(); }
      const pick = event.target.closest('[data-v80-select]');
      if (pick) { selected = pick.dataset.v80Select; renderSignals(); }
    });
    $$('[data-v80-tf]').forEach(button => button.addEventListener('click', () => {
      timeframe = button.dataset.v80Tf;
      $$('[data-v80-tf]').forEach(x => x.classList.toggle('active', x === button));
      loadSignals();
    }));
    $('#v80Refresh')?.addEventListener('click', loadSignals);
    $('#v80StartPaper')?.addEventListener('click', startPaper);
    setInterval(() => { if (opened && !document.hidden && document.body.dataset.g2Category === 'signals') loadSignals(); }, 30000);
    if (document.body.dataset.g2Category === 'signals') { opened = true; loadSignals(); }
  }
  document.addEventListener('DOMContentLoaded', wire, { once: true });
})();
