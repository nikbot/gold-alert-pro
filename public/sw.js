const CACHE='gold-alert-pro-v38';
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{let data={};try{data=event.data?event.data.json():{}}catch{}const title=data.title||'Gold Alert Pro';const options={body:data.body||'سیگنال جدید طلا',tag:data.tag||'gold-alert',renotify:true,vibrate:[100,50,100],data:data.data||{url:'/'},icon:data.icon||'/icon-192.png',badge:data.badge||'/icon-192.png'};event.waitUntil(self.registration.showNotification(title,options))});
self.addEventListener('notificationclick',event=>{event.notification.close();const url=event.notification.data?.url||'/';event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if('focus'in c){c.focus();return c}}return clients.openWindow(url)}))});
