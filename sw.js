const CACHE_NAME = 'vid-player-cache-v4';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon/videoplayer.png',
  './merger.js',
  './lib/ffmpeg.js',
  './lib/util.js',
  './lib/814.ffmpeg.js',
  './lib/ffmpeg-core.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Object URL/blob video tidak perlu dan tidak boleh dipaksa masuk cache.
  if (event.request.url.startsWith('blob:')) return;

  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
