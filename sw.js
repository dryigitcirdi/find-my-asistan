// Çevrimdışı çalışma.
//
// Strateji: ÖNCE AĞ, sonra önbellek (kısa zaman aşımıyla).
// Önceden "önce önbellek" idi; güncelleme yayınlandığında kullanıcı eski sürümü
// görüyor, yeni sürüm ancak ikinci açılışta geliyordu. Panel 18 kişiyle
// paylaşıldığı için kimse iki kez yenilemeyi düşünmez — bu yüzden ağ önce.
// Hastane wifi'si yavaşsa zaman aşımı önbelleğe düşürür, açılış yine hızlı olur.
const VERSION = 'asistan-panel-v31';
const TIMEOUT = 2500;

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

/** Ağı dener, TIMEOUT içinde dönmezse önbelleğe düşer */
async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, reject) => setTimeout(() => reject(new Error('zaman aşımı')), TIMEOUT))
    ]);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    // Gezinme isteği ve önbellekte yoksa kabuk sayfasını ver
    if (req.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    throw new Error('çevrimdışı ve önbellekte yok');
  }
}

/** İkonlar değişmez: önbellekten ver, arka planda tazele */
async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) {
    fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); }).catch(() => {});
    return hit;
  }
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(/\.(png|svg|ico|webp)$/.test(new URL(req.url).pathname) ? cacheFirst(req) : networkFirst(req));
});
