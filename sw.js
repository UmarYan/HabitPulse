/* HabitPulse V1 service worker: compact offline app shell. */
const CACHE_NAME = 'habitpulse-shell-v1-compact';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('habitpulse-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(fetch(req).then(response => { if (response && response.ok) { const copy=response.clone(); caches.open(CACHE_NAME).then(cache=>cache.put(req,copy)).catch(()=>{}); } return response; }).catch(async () => {
    const cached = await caches.match(req, {ignoreSearch:true});
    if (cached) return cached;
    if (req.mode === 'navigate') return (await caches.match('./index.html')) || new Response('HabitPulse is offline. Open it once online, then try again.', {status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
    return new Response('', {status:504});
  }));
});
