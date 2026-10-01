/* Gold2 Pro V71 - Functional Market Terminal Navigation */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const scrollToId=id=>{const el=$(id); if(el) setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'start'}),40);};
  const categoryTarget={
    dashboard:'v62TerminalShell',
    market:'v62GoldChart',
    ai:'ai',
    alerts:'alerts',
    portfolio:'portfolio',
    calculator:'goldCalculator',
    tools:'proToolsPanel',
    news:'news',
    decision:'aiChat',
    intelligence:'goldIntelligence',
    calendar:'calendar',
    account:'account',
    settings:'proToolsPanel'
  };
  function go(cat){
    if(typeof applyCategory==='function'){
      const ok=applyCategory(cat,true);
      if(ok===false)return;
    }
    const target=categoryTarget[cat];
    if(target) scrollToId(target);
    document.querySelectorAll('[data-v62cat]').forEach(b=>b.classList.toggle('active',b.dataset.v62cat===cat));
  }
  function init(){
    document.querySelectorAll('[data-v62cat]').forEach(btn=>{
      btn.addEventListener('click',function(e){
        e.preventDefault();
        e.stopPropagation();
        go(this.dataset.v62cat||'dashboard');
      });
    });
    const collapse=$('v62Collapse'), shell=$('v62TerminalShell');
    if(collapse && shell && !collapse.dataset.v71Bound){
      collapse.dataset.v71Bound='1';
      collapse.addEventListener('click',()=>{
        shell.classList.toggle('v62Collapsed');
        collapse.textContent=shell.classList.contains('v62Collapsed')?'▶ بازکردن منو':'◀ جمع‌کردن منو';
      });
    }
    document.querySelectorAll('.v62HeaderActions button').forEach(btn=>{
      const t=(btn.textContent||'').trim();
      if(t.includes('AI Copilot') && !btn.dataset.v71Bound){
        btn.dataset.v71Bound='1';
        btn.onclick=()=>{go('ai'); scrollToId('v62Copilot');};
      }
    });
    // Make dashboard quick-action links use the same executable router.
    document.querySelectorAll('[onclick*="applyCategory"]').forEach(el=>{
      const m=(el.getAttribute('onclick')||'').match(/applyCategory\(['"]([^'"]+)['"]/);
      if(!m)return;
      const cat=m[1];
      if(['portfolio','calculator','settings'].includes(cat) || el.closest('.v62Sidebar')){
        el.removeAttribute('onclick');
        el.addEventListener('click',e=>{e.preventDefault();go(cat);});
      }
    });
    go('dashboard');
  }
  window.v71Navigate=go;
  document.addEventListener('DOMContentLoaded',init,{once:true});
})();
