/* 英语词汇通 - Service Worker(PWA 离线缓存)
 * 策略:缓存优先(cache-first),版本号 CACHE_VER 变更后旧缓存整体清除
 * 注意:只在 https(GitHub Pages 等)或 localhost 下生效;http 局域网 IP 浏览器不注册 SW
 */
const CACHE_VER = 'cet4-vocab-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './vocab-data.js',
  './vocab-libs.js',
  './vocab-extra.js',
  './app.js',
  './ui.js',
  './pwa-register.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VER).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VER).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((resp) => {
        // 同源成功响应顺手入缓存,便于后续版本新增文件无需改清单
        if (resp.ok && new URL(e.request.url).origin === self.location.origin) {
          const copy = resp.clone();
          caches.open(CACHE_VER).then((c) => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => {
        // 断网时导航请求回落到缓存的首页
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
