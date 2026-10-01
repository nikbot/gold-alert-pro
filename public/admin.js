(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const state = { view:'dashboard', userPage:1, userPages:1, paymentPage:1, paymentPages:1, loggedIn:false, dashboard:null, roles:['SUPER_ADMIN','ADMIN','MODERATOR','PREMIUM_USER','USER'], theme:'dark' };
  const titles = {dashboard:'داشبورد مدیریتی',users:'مدیریت کاربران',payments:'مدیریت پرداخت',reports:'مرکز گزارش‌ها',security:'مرکز امنیت',preview:'مشاهده سایت آنلاین',settings:'تنظیمات سامانه'};
  const roleFa = {SUPER_ADMIN:'مدیر ارشد',ADMIN:'مدیر',MODERATOR:'ناظر',PREMIUM_USER:'کاربر ویژه',USER:'کاربر'};

  function esc(v){return String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}
  function fa(v){return new Intl.NumberFormat('fa-IR').format(Number(v||0));}
  function irr(v){return fa(Math.round(Number(v||0)))+' ریال';}
  function dateFa(v){if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('fa-IR',{dateStyle:'short',timeStyle:'short'});}
  function toast(message,type='ok'){const el=$('#toast');if(!el)return;el.textContent=message;el.className='toast show '+type;clearTimeout(toast.t);toast.t=setTimeout(()=>el.className='toast',3400);}
  async function api(url, opts={}){
    const init={credentials:'include',cache:'no-store',...opts,headers:{...(opts.headers||{})}};
    if(init.body && typeof init.body!=='string'){init.headers['Content-Type']='application/json';init.body=JSON.stringify(init.body);}
    const r=await fetch(url,init); let d={}; try{d=await r.json();}catch{}
    if((r.status===401||r.status===403)&&state.loggedIn){ state.loggedIn=false; showLogin(); throw new Error(d.error||'نشست مدیریت معتبر نیست.'); }
    if(!r.ok) throw new Error(d.error||`HTTP ${r.status}`);
    return d;
  }
  function showLogin(){
    $('#appView').classList.add('hidden'); $('#loginView').classList.remove('hidden');
    $('#loginPassword').value=''; $('#loginError').textContent='';
  }
  function showApp(data){
    state.loggedIn=true; $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden');
    $('#adminRoleLabel').textContent=data.role||'SUPER_ADMIN'; $('#adminUserLabel').textContent=data.username||'admin';
  }
  async function login(ev){
    ev.preventDefault(); $('#loginError').textContent='';
    const username=$('#loginUsername').value.trim(), password=$('#loginPassword').value;
    if(!username||!password){$('#loginError').textContent='نام کاربری و رمز عبور را وارد کنید.';return;}
    const btn=$('#loginForm .primary'); btn.disabled=true; btn.textContent='در حال ورود…';
    try{const d=await api('/api/admin/login',{method:'POST',body:{username,password}});showApp(d);toast('ورود با موفقیت انجام شد.');await refreshAll();}
    catch(e){$('#loginError').textContent='⚠️ '+e.message;toast(e.message,'error');}
    finally{btn.disabled=false;btn.innerHTML='ورود امن به داشبورد <span>↗</span>';}
  }
  async function logout(){try{await api('/api/admin/logout',{method:'POST'});}catch{} state.loggedIn=false; toast('از پنل مدیریت خارج شدید.'); showLogin();}

  function setView(view){
    state.view=view; $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${view}`)); $$('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.view===view));
    $('#pageTitle').textContent=titles[view]||view; $('#pageEyebrow').textContent=(view==='dashboard'?'CONTROL CENTER':view.toUpperCase());
    $('#sidebar').classList.remove('open'); $('#sidebarOverlay').classList.remove('show');
    if(view==='users') loadUsers(); if(view==='payments')loadPayments(); if(view==='reports')loadReports(); if(view==='security')loadSecurity(); if(view==='preview')loadLiveStatus(); if(view==='settings')loadSettings();
  }

  function metric(label,value,sub,cls=''){return `<div class="metric ${cls}"><div class="label">${esc(label)}</div><div class="value">${esc(String(value))}</div><div class="sub">${esc(sub||'')}</div></div>`;}
  function statusPill(ok,label){return `<span class="status ${ok===true?'ok':ok===false?'bad':'warn'}">● ${esc(label)}</span>`;}

  async function loadDashboard(){
    const d=await api('/api/admin/dashboard'); state.dashboard=d;
    $('#systemMetrics').innerHTML=[
      metric('کل کاربران',fa(d.users.total),`فعال ${fa(d.users.active)}`,'gold'),
      metric('کاربران آنلاین',fa(d.users.onlineEstimate),'برآورد ۱۵ دقیقه اخیر','green'),
      metric('درآمد کل',irr(d.financial.total),'پرداخت‌های تأییدشده','gold'),
      metric('درآمد ماه',irr(d.financial.monthly),'۳۰ روز اخیر '+irr(d.financial.last30),'blue')
    ].join('');
    $('#systemHealth').innerHTML=[
      ['سرور',d.system.server],['پایگاه داده',d.system.database],['اپلیکیشن',d.system.application],['Uptime',fa(d.system.uptime)+' ثانیه']
    ].map(([k,v])=>`<div class="health-item"><div class="title">${esc(k)}</div><div class="value ${String(v).includes('OFF')?'bad':'ok'}">${esc(v)}</div></div>`).join('');
    $('#financeSummary').innerHTML=[['درآمد کل',irr(d.financial.total)],['این ماه',irr(d.financial.monthly)],['موفق',fa(d.financial.successfulCount)],['ناموفق',fa(d.financial.failedCount)]].map(x=>`<div class="mini-stat"><span>${esc(x[0])}</span><b>${esc(x[1])}</b></div>`).join('');
    $('#activityCount').textContent=fa((d.activity||[]).length);
    $('#activityFeed').innerHTML=(d.activity||[]).slice(0,12).map(x=>`<div class="activity-item"><div><b>${esc(x.action||x.type||'activity')}</b><small>${esc(x.meta?.username||x.meta?.userId||'')} ${x.meta?.ip?`• ${esc(x.meta.ip)}`:''}</small></div><div class="activity-side">${dateFa(x.at)}</div></div>`).join('')||'<div class="list-item"><small>فعالیتی ثبت نشده است.</small></div>';
    drawDashboardChart(d);
    $('#lastSync').textContent=dateFa(d.generatedAt);
  }
  function drawDashboardChart(d){
    const daily=(d.activity||[]).length?buildDailyFromActivity(d.activity):[]; drawLineChart($('#dashChart'),daily.map(x=>x.value),daily.map(x=>x.label));
  }
  function buildDailyFromActivity(items){const out=[];for(let i=6;i>=0;i--){const day=new Date(Date.now()-i*86400000);const key=day.toISOString().slice(0,10);out.push({label:key.slice(5),value:items.filter(x=>String(x.at||'').slice(0,10)===key).length});}return out;}
  function drawLineChart(canvas, values, labels){
    if(!canvas)return; const ctx=canvas.getContext('2d'); const rect=canvas.getBoundingClientRect(); const dpr=window.devicePixelRatio||1; const w=Math.max(320,rect.width),h=canvas.height; canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
    const cs=getComputedStyle(document.body); const line=cs.getPropertyValue('--line2')||'#2c3d51', muted=cs.getPropertyValue('--muted')||'#8796a8', gold=cs.getPropertyValue('--gold')||'#e5b95c';
    ctx.strokeStyle=line;ctx.lineWidth=1;for(let i=1;i<5;i++){const y=20+(h-45)*i/5;ctx.beginPath();ctx.moveTo(45,y);ctx.lineTo(w-18,y);ctx.stroke();}
    const max=Math.max(1,...values), min=Math.min(0,...values), span=Math.max(1,max-min); ctx.strokeStyle=gold;ctx.lineWidth=2.5;ctx.beginPath();values.forEach((v,i)=>{const x=45+(w-70)*(values.length===1?0.5:i/(values.length-1));const y=20+(h-55)*(1-(v-min)/span);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();
    ctx.fillStyle=gold;values.forEach((v,i)=>{const x=45+(w-70)*(values.length===1?0.5:i/(values.length-1));const y=20+(h-55)*(1-(v-min)/span);ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fill();});
    ctx.fillStyle=muted;ctx.font='10px Tahoma';ctx.textAlign='center';labels.forEach((l,i)=>{const x=45+(w-70)*(labels.length===1?0.5:i/(labels.length-1));ctx.fillText(l,x,h-13);});
  }

  async function loadUsers(){
    const q=encodeURIComponent($('#userSearch').value.trim()), role=encodeURIComponent($('#userRoleFilter').value), status=encodeURIComponent($('#userStatusFilter').value); $('#usersTable').innerHTML='<tr><td colspan="6">در حال دریافت…</td></tr>';
    try{const d=await api(`/api/admin/users?page=${state.userPage}&limit=15&search=${q}&role=${role}&status=${status}`);state.userPages=d.pages||1;$('#usersTable').innerHTML=(d.users||[]).map(u=>{const active=u.active&&(!u.expiresAt||new Date(u.expiresAt)>=new Date());return `<tr><td><b>${esc(u.name||'بدون نام')}</b><br><small>${esc(u.username)}${u.phone?` • ${esc(u.phone)}`:''}</small></td><td>${esc(roleFa[u.accessRole]||u.accessRole||u.role)}<br><small>${esc(u.accessRole||'USER')}</small></td><td>${statusPill(active,'فعال')}${!active?` ${statusPill(false,u.expiresAt?'منقضی':'غیرفعال')}`:''}</td><td>${dateFa(u.lastLoginAt)}</td><td>${dateFa(u.expiresAt)}</td><td><div class="table-actions"><button data-edit-user="${esc(u.id)}">ویرایش</button><button data-toggle-user="${esc(u.id)}">${u.active?'غیرفعال':'فعال'}</button><button data-delete-user="${esc(u.id)}">حذف</button></div></td></tr>`;}).join('')||'<tr><td colspan="6">کاربری پیدا نشد.</td></tr>';renderPagination($('#usersPagination'),state.userPage,state.userPages,p=>{state.userPage=p;loadUsers();});}
    catch(e){$('#usersTable').innerHTML=`<tr><td colspan="6">⚠️ ${esc(e.message)}</td></tr>`;}
  }
  function renderPagination(el,page,pages,onClick){if(!el)return;const arr=[];for(let i=1;i<=pages;i++){if(pages>8&&i>2&&i<pages-1&&Math.abs(i-page)>1){if(arr[arr.length-1]!=='…')arr.push('…');continue;}arr.push(i);}el.innerHTML=arr.map(x=>x==='…'?'<span style="padding:8px">…</span>':`<button class="${x===page?'active':''}" data-page="${x}">${x}</button>`).join('');$$('button[data-page]',el).forEach(b=>b.onclick=()=>onClick(Number(b.dataset.page)));}
  function openUserDialog(user=null){
    const dlg=$('#userDialog'); if(!dlg)return; $('#userDialogTitle').textContent=user?'ویرایش کاربر':'کاربر جدید'; $('#userEditId').value=user?.id||''; $('#formUsername').value=user?.username||'';$('#formUsername').disabled=Boolean(user);$('#formName').value=user?.name||'';$('#formPhone').value=user?.phone||'';$('#formPassword').value='';$('#formPlan').value=user?.planLabel||'';$('#formActive').checked=user?.active!==false;$('#formExpiry').value=user?.expiresAt?new Date(user.expiresAt).toISOString().slice(0,16):'';fillRoleSelect($('#formRole'),user?.accessRole||'USER'); dlg.showModal();
  }
  function fillRoleSelect(el,current='USER'){if(!el)return;el.innerHTML=state.roles.map(r=>`<option value="${r}" ${r===current?'selected':''}>${roleFa[r]||r}</option>`).join('');}
  async function saveUser(e){e.preventDefault();const id=$('#userEditId').value;const body={name:$('#formName').value.trim(),phone:$('#formPhone').value.trim(),accessRole:$('#formRole').value,active:$('#formActive').checked,expiresAt:$('#formExpiry').value?new Date($('#formExpiry').value).toISOString():null,planLabel:$('#formPlan').value.trim()};if($('#formPassword').value)body.password=$('#formPassword').value; if(!id){body.username=$('#formUsername').value.trim();body.role=body.accessRole==='PREMIUM_USER'?'premium':body.accessRole==='ADMIN'?'pro':'user';} try{await api(id?`/api/admin/users/${encodeURIComponent(id)}`:'/api/admin/users',{method:id?'PUT':'POST',body});$('#userDialog').close();toast(id?'کاربر بروزرسانی شد.':'کاربر ساخته شد.');state.userPage=1;await loadUsers();await loadDashboard();}catch(err){toast(err.message,'error');}}
  async function toggleUser(id){try{const d=await api(`/api/admin/users/${encodeURIComponent(id)}`);const u=d.user;await api(`/api/admin/users/${encodeURIComponent(id)}`,{method:'PUT',body:{active:!u.active}});toast('وضعیت کاربر تغییر کرد.');loadUsers();}catch(e){toast(e.message,'error');}}
  async function deleteUser(id){if(!confirm('این کاربر حذف شود؟'))return;try{await api(`/api/admin/users/${encodeURIComponent(id)}`,{method:'DELETE'});toast('کاربر حذف شد.');loadUsers();loadDashboard();}catch(e){toast(e.message,'error');}}

  async function loadPayments(){
    const q=encodeURIComponent($('#paymentSearch').value.trim()),status=encodeURIComponent($('#paymentStatusFilter').value); $('#paymentsTable').innerHTML='<tr><td colspan="6">در حال دریافت…</td></tr>';
    try{const d=await api(`/api/admin/payments?page=${state.paymentPage}&limit=15&search=${q}&status=${status}`);state.paymentPages=d.pages||1;$('#paymentMetrics').innerHTML=[metric('کل تراکنش‌ها',fa(d.total||0),'نتیجه فیلتر','gold'),metric('تأییدشده',fa((d.payments||[]).filter(p=>p.status==='confirmed').length),'در صفحه فعلی','green')].join('')+metric('آخرین بروزرسانی',dateFa(new Date()),'هم‌اکنون','blue');$('#paymentsTable').innerHTML=(d.payments||[]).map(p=>`<tr><td dir="ltr"><small>${esc(p.id)}</small></td><td>${esc(p.username||'—')}<br><small>${esc(p.plan||'')}</small></td><td><b>${irr(p.amount)}</b></td><td>${statusPill(p.status==='confirmed',p.status||'pending')}</td><td>${dateFa(p.at)}</td><td><div class="table-actions"><button data-payment-status="${esc(p.id)}" data-next-status="${p.status==='confirmed'?'pending':'confirmed'}">${p.status==='confirmed'?'برگردان به انتظار':'تأیید'}</button></div></td></tr>`).join('')||'<tr><td colspan="6">تراکنشی ثبت نشده است.</td></tr>';renderPagination($('#paymentsPagination'),state.paymentPage,state.paymentPages,p=>{state.paymentPage=p;loadPayments();});}catch(e){$('#paymentsTable').innerHTML=`<tr><td colspan="6">⚠️ ${esc(e.message)}</td></tr>`;}
  }
  async function savePayment(e){e.preventDefault();const body={username:$('#paymentUser').value.trim(),amount:Number($('#paymentAmount').value||0),plan:$('#paymentPlan').value.trim(),reference:$('#paymentReference').value.trim(),status:$('#paymentStatus').value};try{await api('/api/admin/payments',{method:'POST',body});$('#paymentDialog').close();toast('پرداخت ثبت شد.');loadPayments();loadDashboard();}catch(err){toast(err.message,'error');}}
  async function setPaymentStatus(id,status){try{await api(`/api/admin/payments/${encodeURIComponent(id)}`,{method:'PUT',body:{status}});toast('وضعیت تراکنش تغییر کرد.');loadPayments();loadDashboard();}catch(e){toast(e.message,'error');}}

  async function loadReports(){try{const d=await api(`/api/admin/reports?days=${$('#reportRange').value}`);drawLineChart($('#usersChart'),d.daily.map(x=>x.newUsers),d.daily.map(x=>x.date.slice(5)));drawLineChart($('#revenueChart'),d.daily.map(x=>x.revenue),d.daily.map(x=>x.date.slice(5)));drawLineChart($('#activityChart'),d.daily.map(x=>x.activity),d.daily.map(x=>x.date.slice(5)));}catch(e){toast(e.message,'error');}}

  async function loadSecurity(){try{const d=await api('/api/admin/security');$('#securityMetrics').innerHTML=[metric('ورود ناموفق',fa(d.summary.failedLogins),'ثبت‌شده','red'),metric('ورود موفق',fa(d.summary.successfulLogins),'ثبت‌شده','green'),metric('نشست فعال',fa(d.summary.activeAdminSessions),'Admin Session','gold'),metric('فعالیت مدیر',fa(d.summary.adminActivities),'رویداد','blue')].join('');$('#sessionsList').innerHTML=(d.sessions||[]).map(s=>`<div class="list-item"><div><b>${esc(s.username)} • ${esc(s.role)}</b><small dir="ltr">${esc(s.ip)} • ${esc((s.userAgent||'').slice(0,70))}<br>${dateFa(s.createdAt)} تا ${dateFa(s.expiresAt)}</small></div><button class="danger" data-revoke-session="${esc(s.id)}">خروج</button></div>`).join('')||'<div class="list-item"><small>نشست فعالی نیست.</small></div>';$('#loginLogs').innerHTML=(d.loginLogs||[]).slice(0,15).map(x=>`<div class="list-item"><div><b>${x.success===false?'🔴 ورود ناموفق':'🟢 '+(x.event==='logout'?'خروج':'ورود موفق')}</b><small>${esc(x.username||'—')} • ${esc(x.ip||'—')}<br>${esc(x.reason||'')}</small></div><div class="activity-side">${dateFa(x.at)}</div></div>`).join('');$('#auditList').innerHTML=(d.audit||[]).slice(0,25).map(x=>`<div class="list-item"><div><b>${esc(x.action||'activity')}</b><small>${esc(JSON.stringify(x.meta||{}).slice(0,220))}</small></div><div class="activity-side">${dateFa(x.at)}</div></div>`).join('')||'<div class="list-item"><small>رویدادی ثبت نشده است.</small></div>';}catch(e){toast(e.message,'error');}}
  async function revokeAll(){if(!confirm('تمام نشست‌های مدیریتی دیگر خارج شوند؟'))return;try{const d=await api('/api/admin/security/revoke-all-sessions',{method:'POST'});toast(`تعداد ${fa(d.count)} نشست بسته شد.`);loadSecurity();}catch(e){toast(e.message,'error');}}
  async function revokeSession(id){if(!confirm('این نشست خارج شود؟'))return;try{await api('/api/admin/security/revoke-session',{method:'POST',body:{idPrefix:id}});toast('نشست بسته شد.');loadSecurity();}catch(e){toast(e.message,'error');}}

  async function loadLiveStatus(){try{const d=await api('/api/admin/live-status');const cards=[['وضعیت سایت',d.site,d.site==='ONLINE'?'ok':'bad'],['سرور',d.server,d.server==='ONLINE'?'ok':'bad'],['پایگاه داده',d.database,d.database==='ONLINE'?'ok':'bad'],['زمان پاسخ',`${fa(d.responseTimeMs)} ms`,'ok']];$('#liveCards').innerHTML=cards.map(x=>`<div class="metric ${x[2]==='ok'?'green':'red'}"><div class="label">${esc(x[0])}</div><div class="value">${esc(x[1])}</div><div class="sub">${d.uptime?`Uptime ${fa(d.uptime)}s`:''}</div></div>`).join('');$('#topLiveText').textContent=d.site;$('#topLatency').textContent=fa(d.responseTimeMs)+' ms';}catch(e){$('#topLiveText').textContent='OFFLINE';$('#topLatency').textContent='—';toast(e.message,'error');}}

  async function loadSettings(){try{const d=await api('/api/admin/settings');state.roles=d.roles||state.roles;const s=d.settings||{};$('#settingSiteName').value=s.siteName||'';$('#settingLogoUrl').value=s.logoUrl||'';$('#settingDefaultRole').innerHTML=state.roles.map(r=>`<option value="${r}" ${r===s.defaultRole?'selected':''}>${roleFa[r]||r}</option>`).join('');$('#settingMaintenance').checked=Boolean(s.maintenanceMode);$('#settingSessionHours').value=s.sessionTimeoutHours||12;$('#settingLoginWindow').value=s.loginProtection?.windowMinutes||10;$('#settingMaxAttempts').value=s.loginProtection?.maxAttempts||10;renderRolesMatrix(d);}catch(e){toast(e.message,'error');}}
  function renderRolesMatrix(d){const p=d.rolePermissions||{};$('#rolesMatrix').innerHTML=(d.roles||state.roles).map(r=>`<div class="role-card"><b>${roleFa[r]||r}</b><small style="color:var(--muted);display:block;margin-top:3px">${esc(r)}</small><div class="chips">${(p[r]||[]).map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div></div>`).join('');}
  async function saveSettings(){try{await api('/api/admin/settings',{method:'PUT',body:{siteName:$('#settingSiteName').value.trim(),logoUrl:$('#settingLogoUrl').value.trim(),defaultRole:$('#settingDefaultRole').value,maintenanceMode:$('#settingMaintenance').checked,sessionTimeoutHours:Number($('#settingSessionHours').value||12),loginProtection:{windowMinutes:Number($('#settingLoginWindow').value||10),maxAttempts:Number($('#settingMaxAttempts').value||10)}}});toast('تنظیمات ذخیره شد.');}catch(e){toast(e.message,'error');}}

  async function refreshAll(){try{await Promise.all([loadDashboard(),loadLiveStatus()]);if(state.view==='users')await loadUsers();if(state.view==='payments')await loadPayments();if(state.view==='reports')await loadReports();if(state.view==='security')await loadSecurity();if(state.view==='settings')await loadSettings();toast('اطلاعات بروزرسانی شد.');}catch(e){toast(e.message,'error');}}

  function wire(){
    $('#loginForm').addEventListener('submit',login); $('#sidebarLogout').onclick=logout; $('#refreshBtn').onclick=refreshAll; $('#sidebarOpen').onclick=()=>{$('#sidebar').classList.add('open');$('#sidebarOverlay').classList.add('show')};$('#sidebarClose').onclick=()=>{$('#sidebar').classList.remove('open');$('#sidebarOverlay').classList.remove('show')};$('#sidebarOverlay').onclick=()=>{$('#sidebar').classList.remove('open');$('#sidebarOverlay').classList.remove('show')};$('#themeToggle').onclick=()=>{document.body.classList.toggle('light');state.theme=document.body.classList.contains('light')?'light':'dark';localStorage.setItem('gold-admin-theme',state.theme);};
    $$('.nav-item').forEach(b=>b.onclick=()=>setView(b.dataset.view));$$('[data-view-target]').forEach(b=>b.onclick=()=>setView(b.dataset.viewTarget));
    $('#userSearchBtn').onclick=()=>{state.userPage=1;loadUsers();};$('#userSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){state.userPage=1;loadUsers();}});$('#userRoleFilter').onchange=()=>{state.userPage=1;loadUsers()};$('#userStatusFilter').onchange=()=>{state.userPage=1;loadUsers()};$('#newUserBtn').onclick=()=>openUserDialog();$('#userForm').addEventListener('submit',saveUser);
    $('#paymentSearchBtn').onclick=()=>{state.paymentPage=1;loadPayments();};$('#paymentSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){state.paymentPage=1;loadPayments();}});$('#paymentStatusFilter').onchange=()=>{state.paymentPage=1;loadPayments()};$('#newPaymentBtn').onclick=()=>$('#paymentDialog').showModal();$('#paymentForm').addEventListener('submit',savePayment);
    $('#reportRange').onchange=loadReports;$('#revokeAllBtn').onclick=revokeAll;$('#settingsSaveBtn').onclick=saveSettings;$('#previewRefresh').onclick=()=>{$('#sitePreview').src='/?preview='+Date.now();loadLiveStatus();};$('[data-action="refresh-live"]').onclick=loadLiveStatus;
    document.addEventListener('click',e=>{const edit=e.target.closest('[data-edit-user]');if(edit){api(`/api/admin/users/${encodeURIComponent(edit.dataset.editUser)}`).then(d=>openUserDialog(d.user)).catch(err=>toast(err.message,'error'));return;}const tog=e.target.closest('[data-toggle-user]');if(tog){toggleUser(tog.dataset.toggleUser);return;}const del=e.target.closest('[data-delete-user]');if(del){deleteUser(del.dataset.deleteUser);return;}const ps=e.target.closest('[data-payment-status]');if(ps){setPaymentStatus(ps.dataset.paymentStatus,ps.dataset.nextStatus);return;}const rs=e.target.closest('[data-revoke-session]');if(rs){revokeSession(rs.dataset.revokeSession);return;}});
    window.addEventListener('resize',()=>{if(state.view==='dashboard')drawDashboardChart(state.dashboard||{activity:[]});});
    const theme=localStorage.getItem('gold-admin-theme');if(theme==='light')document.body.classList.add('light');
  }

  async function bootstrap(){wire();try{const d=await api('/api/admin/dashboard');showApp(d.admin||{});await refreshAll();}catch{showLogin();}}
  document.addEventListener('DOMContentLoaded',bootstrap);
})();
