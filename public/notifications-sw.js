// Notification display/click handling only. No caching and no push subscription.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const path=event.notification.data?.url;
 if(typeof path!=='string'||!/^\/program\/[^/?#]{1,600}$/.test(path))return;
 const url=new URL(path,self.location.origin).href;
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
  const existing=windows.find(client=>client.url===url);
  if(existing)return existing.focus();
  return self.clients.openWindow(url);
 }));
});
