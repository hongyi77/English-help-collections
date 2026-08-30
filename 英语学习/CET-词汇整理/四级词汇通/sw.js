/* 英语词汇通 - Service Worker(PWA 离线缓存)
 * 策略:缓存优先(cache-first),版本号 CACHE_VER 变更后旧缓存整体清除
 * 注意:只在 https(GitHub Pages 等)或 localhost 下生效;http 局域网 IP 浏览器不注册 SW
 */
const CACHE_VER = 'cet4-vocab-v8';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './vocab-data.js',
  './vocab-libs.js',
  './vocab-extra.js',
  './app.js',
  './ui.js',
  './icons.js',
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

/* stale-while-revalidate:命中缓存立即返回(快),同时后台拉网络刷新缓存(下次打开即新版)
 * 修复:纯 cache-first 在部署窗口期抓到旧资源后会永不自愈 */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE_VER).then(async (cache) => {
      const netFetch = fetch(e.request).then((resp) => {
        if (resp.ok && new URL(e.request.url).origin === self.location.origin) {
          cache.put(e.request, resp.clone());
        }
        return resp;
      }).catch(() => null);
      const cached = await cache.match(e.request, { ignoreSearch: true });
      if (cached) {
        netFetch.catch(() => {});   // 后台更新,不阻塞响应
        return cached;
      }
      const net = await netFetch;
      if (net) return net;
      // 断网且无缓存:导航请求回落到缓存的首页
      if (e.request.mode === 'navigate') return cache.match('./index.html');
      return Response.error();
    })
  );
});
