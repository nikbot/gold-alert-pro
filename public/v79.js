(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  function installPasswordControls() {
    const ids = ['authPass', 'regPass', 'regPass2', 'adminPasswordInput', 'accountPassword', 'loginPassword'];
    for (const id of ids) {
      for (const input of $$(`[id="${id}"]`)) {
        if (input.dataset.v79Password) continue;
        input.dataset.v79Password = 'true';
        const wrap = document.createElement('div');
        wrap.className = 'v79PasswordField';
        input.parentNode.insertBefore(wrap, input);
        wrap.append(input);
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'v79PasswordToggle';
        toggle.textContent = 'نمایش';
        toggle.setAttribute('aria-label', 'نمایش رمز عبور');
        toggle.setAttribute('aria-pressed', 'false');
        toggle.addEventListener('click', () => {
          const visible = input.type === 'password';
          input.type = visible ? 'text' : 'password';
          toggle.textContent = visible ? 'پنهان' : 'نمایش';
          toggle.setAttribute('aria-label', visible ? 'پنهان‌کردن رمز عبور' : 'نمایش رمز عبور');
          toggle.setAttribute('aria-pressed', String(visible));
          input.focus();
        });
        wrap.append(toggle);
      }
    }
  }

  function installCommandPalette() {
    const host = $('.topActions');
    if (!host || $('#v79CommandButton')) return;
    const trigger = document.createElement('button');
    trigger.id = 'v79CommandButton';
    trigger.className = 'v79CommandButton';
    trigger.type = 'button';
    trigger.innerHTML = '<span>⌕</span><b>جست‌وجوی بخش</b><kbd>Ctrl K</kbd>';
    host.insertBefore(trigger, $('#topAccountBtn'));

    const overlay = document.createElement('div');
    overlay.id = 'v79CommandOverlay';
    overlay.className = 'v79CommandOverlay';
    overlay.innerHTML = '<section class="v79CommandDialog" role="dialog" aria-modal="true" aria-label="جست‌وجوی بخش"><div class="v79CommandHead"><span>⌕</span><input id="v79CommandInput" type="search" autocomplete="off" placeholder="بازار، هشدار، دارایی، حساب…"><kbd>ESC</kbd></div><div class="v79CommandHint">با نوشتن نام بخش، مستقیم به آن برو</div><div id="v79CommandResults" class="v79CommandResults"></div></section>';
    document.body.append(overlay);
    const input = $('#v79CommandInput');
    const results = $('#v79CommandResults');
    const close = () => { overlay.classList.remove('open'); trigger.focus(); };
    const paint = () => {
      const query = input.value.trim().toLocaleLowerCase('fa-IR');
      const items = $$('.menuItem').filter(item => {
        const label = item.innerText.toLocaleLowerCase('fa-IR');
        return !query || label.includes(query);
      });
      results.replaceChildren();
      if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'v79CommandEmpty';
        empty.textContent = 'بخشی با این نام پیدا نشد.';
        results.append(empty);
        return;
      }
      for (const item of items) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'v79CommandRow';
        const icon = document.createElement('span');
        icon.textContent = $('.menuIcon', item)?.textContent || '•';
        const label = document.createElement('span');
        const title = document.createElement('b');
        title.textContent = $('b', item)?.textContent || item.innerText.trim();
        const detail = document.createElement('small');
        detail.textContent = $('small', item)?.textContent || '';
        label.append(title, detail);
        row.append(icon, label);
        row.addEventListener('click', () => { close(); item.click(); });
        results.append(row);
      }
    };
    trigger.addEventListener('click', () => { overlay.classList.add('open'); input.value = ''; paint(); input.focus(); });
    input.addEventListener('input', paint);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); trigger.click();
      } else if (event.key === 'Escape' && overlay.classList.contains('open')) close();
      else if (event.key === 'Enter' && overlay.classList.contains('open')) $('.v79CommandRow', results)?.click();
    });
  }

  function installAccountFlow() {
    const accountButton = $('#topAccountBtn') || $('.topAccountBtn');
    const accountPanel = $('#account');
    const status = $('#accountStatus');
    let signedIn = Boolean(localStorage.getItem('gold-alert-pro-account-token-v28'));
    const update = () => {
      signedIn = Boolean(localStorage.getItem('gold-alert-pro-account-token-v28'));
      const username = $('#accountUsername')?.value?.trim() || $('#authMobile')?.value?.trim() || $('#regMobile')?.value?.trim();
      if (accountButton) {
        accountButton.textContent = signedIn ? `👤 ${username || 'حساب من'}` : '👤 ورود / حساب';
        accountButton.classList.toggle('v79SignedIn', signedIn);
        accountButton.setAttribute('aria-label', signedIn ? 'رفتن به حساب کاربری' : 'ورود به حساب کاربری');
      }
      $('#accountSectionState')?.replaceChildren(document.createTextNode(signedIn ? 'حساب فعال' : 'ورود با موبایل'));
      $$('.accountLogout').forEach(button => { button.hidden = !signedIn; });
    };
    window.__g2AccountAction = () => {
      if (signedIn) window.openAccountQuickMenu?.();
      else window.showAuthGate?.(true);
    };
    if (accountButton) accountButton.onclick = window.__g2AccountAction;
    const oldPersist = window.persistAccountToken;
    if (oldPersist) window.persistAccountToken = (...args) => { const result = oldPersist(...args); update(); return result; };
    const oldSetStatus = window.setAccountStatus;
    if (oldSetStatus) window.setAccountStatus = (...args) => { const result = oldSetStatus(...args); update(); return result; };
    const oldLogout = $('#account .inlineActions button[onclick="logoutAndRelogin()"]');
    if (oldLogout) oldLogout.classList.add('accountLogout');
    $$('.accountLogout').forEach(button => {
      button.textContent = '🚪 خروج از حساب';
      button.setAttribute('onclick', 'window.__g2LogoutAccount?.()');
    });
    window.__g2LogoutAccount = async () => {
      if (signedIn && !confirm('از حساب کاربری خارج می‌شوید؟')) return;
      await window.logoutAccount?.();
      update();
    };
    if (accountPanel && status) update();
    setTimeout(update, 0);
  }

  function polishAuthCopy() {
    const title = $('.authBrand h1');
    const copy = $('.authBrand p');
    const login = $('#authLoginForm button[onclick="gateLogin()"]');
    const admin = $('#authLoginForm button[onclick="showAdminLoginGate()"]');
    if (title) title.textContent = 'به بازار هوشمند خوش آمدید';
    if (copy) copy.textContent = 'ورود امن به فضای شخصی شما برای مدیریت دارایی، پیگیری هشدارها و استفاده از ابزارهای حرفه‌ای تحلیل بازار.';
    if (login) { login.classList.add('authSubmit'); login.innerHTML = 'ورود به حساب کاربری <span>←</span>'; }
    if (admin) { admin.classList.add('authAdminLink'); admin.innerHTML = 'ورود مدیر سامانه <span>↗</span>'; }
  }

  function installLoginKeyboard() {
    for (const input of $$('#authPass, #adminPasswordInput')) {
      input.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        if (input.id === 'authPass') window.gateLogin?.();
        else window.adminLogin?.();
      });
    }
  }

  function installAdminLoginMode() {
    const modal = $('#adminLoginModal');
    if (!modal || !window.showAdminLoginGate) return;
    const oldShow = window.showAdminLoginGate;
    const oldClose = window.closeAdminLoginGate;
    window.showAdminLoginGate = () => {
      oldShow();
      $$('.authTabs, #authLoginForm, #authRegisterForm').forEach(node => { node.hidden = true; });
      const title = $('.authBrand h1');
      const copy = $('.authBrand p');
      const logo = $('.authLogo');
      if (logo) logo.textContent = 'G';
      if (title) title.textContent = 'ورود مدیر سامانه';
      if (copy) copy.textContent = 'برای دسترسی به مرکز کنترل، اطلاعات مدیر را وارد کنید.';
      setTimeout(() => $('#adminUsernameInput')?.focus(), 30);
    };
    window.closeAdminLoginGate = () => {
      oldClose();
      $$('.authTabs, #authLoginForm').forEach(node => { node.hidden = false; });
      $('#authRegisterForm')?.removeAttribute('hidden');
      const title = $('.authBrand h1');
      const copy = $('.authBrand p');
      if (title) title.textContent = 'به بازار هوشمند خوش آمدید';
      if (copy) copy.textContent = 'ورود امن به فضای شخصی شما برای مدیریت دارایی، پیگیری هشدارها و استفاده از ابزارهای حرفه‌ای تحلیل بازار.';
      const logo = $('.authLogo');
      if (logo) logo.textContent = 'Au';
      $('#authMobile')?.focus();
    };
  }

  installPasswordControls();
  installCommandPalette();
  installAccountFlow();
  installLoginKeyboard();
  installAdminLoginMode();
  polishAuthCopy();
})();
