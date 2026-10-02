
/* Gold2 Pro V85 — network-only service worker.
   It exists only for Web Push support and migration away from legacy caches.
   It never serves an old cached HTML/CSS/JS asset. */
const BUILD='v85.0.1';

self.addEventListener('install',event=>{
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.origin!==location.origin || event.request.method!=='GET') return;
  event.respondWith(fetch(new Request(event.request,{cache:'no-store'})));
});

self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch{}
  event.waitUntil(self.registration.showNotification(data.title||'Gold Alert Pro',{
    body:data.body||'سیگنال جدید طلا',
    icon:data.icon||'/icon-192.png',
    badge:data.badge||'/icon-192.png',
    tag:data.tag||'gold-alert',
    renotify:Boolean(data.renotify),
    dir:'rtl',
    lang:'fa',
    timestamp:Date.now(),
    data:{url:data.data?.url||'/'}
  }));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'/',self.location.origin).href;
  event.waitUntil((async()=>{
    const pages=await clients.matchAll({type:'window',includeUncontrolled:true});
    for(const page of pages){
      if(new URL(page.url).origin!==self.location.origin)continue;
      if('navigate' in page)await page.navigate(target);
      return page.focus();
    }
    return clients.openWindow(target);
  })());
});
