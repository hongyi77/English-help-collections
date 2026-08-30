/* 英语词汇通 - Service Worker(PWA 离线缓存)
 * 策略:缓存优先(cache-first),版本号 CACHE_VER 变更后旧缓存整体清除
 * 注意:只在 https(GitHub Pages 等)或 localhost 下生效;http 局域网 IP 浏览器不注册 SW
 */
const CACHE_VER = 'cet4-vocab-v11';
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
    caches.open(CACHE_VER).then((c) =>
      /* 逐个 cache:'reload' 绕过 HTTP 缓存取最新版。addAll 默认走 HTTP 缓存,
       * GitHub Pages 给资源 10 分钟 max-age,部署窗口期会把旧 index.html 装进新版本
       * 缓存 → 旧页面 + 新 JS 混版 → 旧内联 onclick 调不到已改名的函数,点击无反应 */
      Promise.all(ASSETS.map((u) => fetch(u, { cache: 'reload' }).then((r) => {
        if (!r.ok) throw new Error('install fetch failed: ' + u);
        return c.put(u, r);
      })))
    ).then(() => self.skipWaiting())
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
/* 在线音源路径:命中即走音频缓存(cache-first),不进下方静态资源逻辑 */
const AUDIO_PATHS = {
  'dict.youdao.com': '/dictvoice',
  'fanyi.baidu.com': '/gettts',
};
/* 音频独立缓存:不随 CACHE_VER 版本清除(重装 App 不想重新联网抓几千个单词音频) */
const AUDIO_CACHE = 'cet4-audio-v1';

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  let url;
  try { url = new URL(e.request.url); } catch (err) { return; }
  const audioPath = AUDIO_PATHS[url.hostname];
  if (audioPath && url.pathname === audioPath) {
    e.respondWith(audioCacheFirst(url.href));
    return;
  }
  e.respondWith(
    caches.open(CACHE_VER).then(async (cache) => {
      const sameOrigin = new URL(e.request.url).origin === self.location.origin;
      /* 同源后台刷新用 cache:'reload':Pages 的 10 分钟 HTTP 缓存窗口内,
       * 不带它会把过期内容重新写回缓存,自愈永远追不上发版 */
      const netFetch = fetch(e.request, sameOrigin ? { cache: 'reload' } : undefined).then((resp) => {
        if (resp.ok && sameOrigin) {
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

/* 音源缓存策略:cache-first。
 * 音源接口无 CORS 头,拿到的是不透明响应(读不了内容),但可以整包存、整包回:
 * <audio> 发起的 Range 请求由 SW 回完整 200,浏览器可接受(本应用不 seek);
 * 存储时用不带 Range 的干净请求抓完整音频(Cache API 不收 206) */
async function audioCacheFirst(href) {
  const cache = await caches.open(AUDIO_CACHE);
  const hit = await cache.match(href);
  if (hit) return hit;
  try {
    const resp = await fetch(href, { mode: 'no-cors' });
    if (resp && (resp.type === 'opaque' || resp.ok)) {
      await cache.put(href, resp);
      return (await cache.match(href)) || resp;
    }
    return resp || Response.error();
  } catch (err) {
    return Response.error();
  }
}
