const CACHE_VERSION='gold-alert-pro-v60-auto-update';
const STATIC_CACHE=CACHE_VERSION;
const NO_CACHE_PATHS=['/api/','/login','/register','/admin'];

self.addEventListener('install', event=>{
  self.skipWaiting();
});

self.addEventListener('activate', event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==STATIC_CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
    const clientsList=await self.clients.matchAll({type:'window'});
    clientsList.forEach(c=>c.postMessage({type:'APP_UPDATED'}));
  })());
});

self.addEventListener('fetch', event=>{
  const url=new URL(event.request.url);
  if(url.pathname.startsWith('/api/') || NO_CACHE_PATHS.some(p=>url.pathname.startsWith(p))){
    event.respondWith(fetch(event.request,{cache:'no-store'}));
    return;
  }
  event.respondWith((async()=>{
    const request=new Request(event.request,{cache:'no-store'});
    const cached=await caches.match(request);
    const network=fetch(request).then(async res=>{
      if(res.ok && (url.pathname.endsWith('.js')||url.pathname.endsWith('.css')||url.pathname.endsWith('.html'))){
        const cache=await caches.open(STATIC_CACHE);
        cache.put(request,res.clone());
      }
      return res;
    }).catch(()=>cached);
    return cached || network;
  })());
});

self.addEventListener('push',event=>{let data={};try{data=event.data?event.data.json():{}}catch{};const title=data.title||'Gold Alert Pro';event.waitUntil(self.registration.showNotification(title,{body:data.body||'سیگنال جدید طلا',icon:'/icon-192.png'}));});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.openWindow('/'));});
