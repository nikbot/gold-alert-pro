
/* Gold2 Pro V75.4 — network-only service worker.
   It exists only for Web Push support and migration away from legacy caches.
   It never serves an old cached HTML/CSS/JS asset. */
const BUILD='v75.4';

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
    icon:'/icon-192.png'
  }));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
