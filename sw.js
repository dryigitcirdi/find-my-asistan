// Çevrimdışı çalışma. Kabuk dosyaları önbellekten, veri dosyası önce ağdan.
const VERSION = 'asistan-panel-v13';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './styles/app.css',
  './app/main.js', './app/ui.js', './app/sheet.js',
  './app/schedule.js', './app/data.js', './app/store.js',
  './data/schedule.json',
  './assets/icon-180.png', './assets/icon-192.png', './assets/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // Nöbet verisi: önce ağ, olmazsa önbellek (güncel kalsın ama çevrimdışı da açılsın)
  if (req.url.includes('/data/')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Kabuk: önce önbellek, arka planda tazele
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
