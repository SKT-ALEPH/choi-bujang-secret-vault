const CACHE='aleph-offline-v1';
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.add('/offline.html'))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('aleph-offline-')&&key!==CACHE).map(key=>caches.delete(key))))));
// Only the public offline explanation is cached. Auth and protected responses never enter a cache.
self.addEventListener('fetch',event=>{
  if(event.request.mode==='navigate'&&new URL(event.request.url).origin===self.location.origin){
    event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));
  }
});
