const CACHE_VERSION='gold-alert-pro-v75.2.1';
const STATIC_CACHE=CACHE_VERSION;
const APP_SHELL=['/','/index.html'];
const NO_CACHE_PREFIXES=['/api/','/login','/register','/admin'];
const APP_ASSET_RE=/\\.(?:js|css|html)$/i;

self.addEventListener('install', event=>{
  self.skipWaiting();
});

self.addEventListener('activate', event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==STATIC_CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
    // New worker takes control without forcing a page reload.
  })());
});

async function networkFirst(request){
  const cache=await caches.open(STATIC_CACHE);
  try{
    const response=await fetch(new Request(request,{cache:'no-store'}));
    if(response.ok){
      await cache.put(request,response.clone());
    }
    return response;
  }catch{
    const cached=await cache.match(request);
    if(cached) return cached;
    throw new Error('offline');
  }
}

self.addEventListener('fetch', event=>{
  const url=new URL(event.request.url);
  if(url.origin!==location.origin || event.request.method!=='GET') return;

  if(url.pathname.startsWith('/api/') || NO_CACHE_PREFIXES.some(p=>url.pathname.startsWith(p))){
    event.respondWith(fetch(event.request,{cache:'no-store'}));
    return;
  }

  if(url.pathname==='/' || url.pathname==='/index.html' || APP_ASSET_RE.test(url.pathname)){
    event.respondWith(networkFirst(event.request));
  }
});

self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch{}
  const title=data.title||'Gold Alert Pro';
  event.waitUntil(self.registration.showNotification(title,{
    body:data.body||'سیگنال جدید طلا',
    icon:'/icon-192.png'
  }));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
