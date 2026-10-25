/* 英语词汇通 - Service Worker(PWA 离线缓存)
 * 策略:缓存优先(cache-first),版本号 CACHE_VER 变更后旧缓存整体清除
 * 注意:只在 https(GitHub Pages 等)或 localhost 下生效;http 局域网 IP 浏览器不注册 SW
 * 注册用 updateViaCache:'none'(见 pwa-register.js),sw.js 本身绕过 HTTP 缓存,
 * 版本号只在 CACHE_VER 一处维护,不再需要 ?v=NN 查询参数
 */
const CACHE_VER = 'cet4-vocab-v58';
const ASSETS = [
  './index.html',
  './manifest.json',
  './vocab-data.js',
  './vocab-libs.js',
  './vocab-extra.js',
  './vocab-sentences.js',
  './app.js',
  './ui.js',
  './icons.js',
  './fsrs.js',
  './pwa-register.js',
];
/* 图标缺失可容忍(改名/临时 404 不该让整个更新装不上);核心资源失败才是安装失败 */
const ASSETS_OPTIONAL = [
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
];
/* 只缓存清单内的资源(按路径白名单),避免误开的源文件/单文件版把大文件灌进缓存 */
const CACHEABLE = new Set(ASSETS.concat(ASSETS_OPTIONAL).map(u => new URL(u, self.location.origin).pathname));

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VER).then((c) => {
      /* 逐个 cache:'reload' 绕过 HTTP 缓存取最新版。addAll 默认走 HTTP 缓存,
       * GitHub Pages 给资源 10 分钟 max-age,部署窗口期会把旧 index.html 装进新版本
       * 缓存 → 旧页面 + 新 JS 混版 → 旧内联 onclick 调不到已改名的函数,点击无反应 */
      const fetchOne = (u) => fetch(u, { cache: 'reload' }).then((r) => {
        if (!r.ok) throw new Error('install fetch failed: ' + u);
        return c.put(u, r);
      });
      const fetchOptional = (u) => fetchOne(u).catch((err) => {
        console.warn('[sw] 可选资源拉取失败(忽略):', u, err.message);
      });
      return Promise.all(
        ASSETS.map(fetchOne).concat(ASSETS_OPTIONAL.map(fetchOptional))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      /* cet4-audio-v1 是已移除的"在线真人音源"(有道/百度)的音频缓存,一并清除;
       * Edge 朗读的音频在页面侧 IndexedDB,不经过 SW */
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VER).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* stale-while-revalidate:命中缓存立即返回(快),同时后台拉网络刷新缓存(下次打开即新版)
 * 流量分级:只有导航请求(HTML)用 cache:'reload' 强制校验版本;其余资源走浏览器
 * 默认 HTTP 缓存(条件请求,304 很便宜)——不再每次打开都后台重拉整套 ~1.5MB。
 * 缓存键统一存"去掉查询串的路径",与 match 的 ignoreSearch 口径一致,杜绝同资源多份 */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE_VER).then(async (cache) => {
      const url = new URL(e.request.url);
      const sameOrigin = url.origin === self.location.origin;
      const isNavigate = e.request.mode === 'navigate';
      const cacheKey = url.pathname;   // 归一化:去 origin/查询串,按路径存取
      const netFetch = fetch(e.request, sameOrigin && isNavigate ? { cache: 'reload' } : undefined)
        .then((resp) => {
          if (resp.ok && sameOrigin && CACHEABLE.has(cacheKey)) {
            cache.put(cacheKey, resp.clone());
          }
          return resp;
        }).catch(() => null);
      const cached = await cache.match(cacheKey, { ignoreSearch: true });
      if (cached) {
        netFetch.catch(() => {});   // 后台更新,不阻塞响应
        return cached;
      }
      const net = await netFetch;
      if (net) return net;
      // 断网且无缓存:导航请求回落到缓存的首页
      if (isNavigate) return cache.match('./index.html');
      return Response.error();
    })
  );
});
