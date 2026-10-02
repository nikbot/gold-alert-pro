(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fa = (value, digits = 0) => Number(value).toLocaleString('fa-IR', { maximumFractionDigits: digits });
  const money = row => {
    const value = Number(row.price);
    if (!Number.isFinite(value)) return '—';
    return row.kind === 'gold' ? `${fa(value)} <small>تومان/گرم</small>` : `$${fa(value, value < 10 ? 4 : 2)}`;
  };
  let rows = [], filter = 'all', pending = false, updatedAt = 0;

  function render() {
    const box = $('#v85Watchlist');
    if (!box) return;
    const visible = rows.filter(row => filter === 'all' || row.kind === 'crypto');
    if (!visible.length) {
      box.innerHTML = '<div class="v85Empty">هنوز قیمت معتبری از بازار دریافت نشده است.</div>';
      return;
    }
    box.innerHTML = visible.map(row => {
      const live = Boolean(row.quoteLive && !row.stale);
      const status = live ? 'live' : 'stale';
      const symbol = row.kind === 'gold' ? 'Au' : row.symbol.replace(/USD$/, '');
      const source = row.quoteSource || (row.kind === 'gold' ? 'منبع قیمت ایران' : row.source) || 'منبع نامشخص';
      const reference = row.kind === 'gold' && row.source ? `<small>کندل مرجع: ${esc(row.source)}</small>` : '';
      return `<article class="v85WatchRow">
        <span class="v85WatchAsset"><i class="v85WatchIcon">${esc(symbol.slice(0, 4))}</i><span><b>${esc(row.name)}</b><small>${esc(row.symbol)}</small></span></span>
        <span class="v85WatchPrice">${money(row)}</span>
        <span class="v85WatchSource">${esc(source)}${reference}</span>
        <span class="v85FeedBadge" data-state="${status}">${live ? 'زنده' : 'کهنه / نامطمئن'}</span>
      </article>`;
    }).join('');
  }

  async function load(force = false) {
    if (pending || (!force && document.hidden && Date.now() - updatedAt < 120_000)) return;
    pending = true;
    const status = $('#v85FeedStatus');
    if (status && !rows.length) { status.dataset.state = 'loading'; status.textContent = 'در حال دریافت فید بازار…'; }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch('/api/trading-signals?timeframe=1h', { cache: 'no-store', signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'فید بازار در دسترس نیست');
      rows = data.signals || [];
      updatedAt = Date.now();
      render();
      if (status) {
        const live = rows.filter(row => row.quoteLive && !row.stale).length;
        status.dataset.state = live ? 'live' : 'stale';
        status.textContent = `فید ${live} از ${rows.length} بازار • ${new Date(data.generatedAt || Date.now()).toLocaleTimeString('fa-IR')}`;
      }
    } catch (error) {
      if (status) { status.dataset.state = 'error'; status.textContent = error.name === 'AbortError' ? 'زمان پاسخ فید تمام شد' : 'فید بازار موقتاً قطع است'; }
      if (!rows.length) $('#v85Watchlist').innerHTML = `<div class="v85Empty">${esc(error.message || 'اتصال برقرار نشد')}؛ قیمت ساختگی نمایش داده نمی‌شود.</div>`;
    } finally {
      clearTimeout(timeout);
      pending = false;
    }
  }

  document.addEventListener('click', event => {
    const filterButton = event.target.closest('[data-v85-filter]');
    if (filterButton) {
      filter = filterButton.dataset.v85Filter;
      document.querySelectorAll('[data-v85-filter]').forEach(button => button.classList.toggle('active', button === filterButton));
      render();
    }
    if (event.target.closest('#v85Refresh')) load(true);
  });
  document.addEventListener('DOMContentLoaded', () => {
    load();
    setInterval(() => { if (!document.hidden) load(); }, 60_000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - updatedAt > 60_000) load(); });
  }, { once: true });
})();
