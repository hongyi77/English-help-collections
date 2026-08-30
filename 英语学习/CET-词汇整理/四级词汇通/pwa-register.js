/* PWA Service Worker 注册
 * 仅 https/localhost 下可用;file:// 打开的手机单文件版自动跳过
 * 单独成文件以便 CSP 采用 script-src 'self'(禁止内联脚本)
 */
(function () {
  if (!('serviceWorker' in navigator)) return;
  const secure = location.protocol === 'https:' ||
    location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!secure) return;
  window.addEventListener('load', () => {
    // URL 带 SW 版本参数:升级时与 sw.js 的 CACHE_VER 同步改,强制绕过 HTTP 缓存的旧脚本
    // (GitHub Pages 给 sw.js 的 HTTP 缓存 max-age=600,不改 URL 的话 10 分钟内换不了版)
    navigator.serviceWorker.register('sw.js?v=10').catch(() => {});
  });
  // 新 SW 接管页面后自动重载一次,立即切到新版资源;否则要手动再刷新才能看到更新
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });
})();
