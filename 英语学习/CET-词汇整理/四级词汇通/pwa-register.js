/* PWA Service Worker 注册
 * 仅 https/localhost 下可用;file:// 打开的手机单文件版自动跳过
 * 单独成文件以便 CSP 采用 script-src 'self'(禁止内联脚本)
 */
(function () {
  if (!('serviceWorker' in navigator)) return;
  const secure = location.protocol === 'https:' ||
    location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!secure) return;
  /* 页面加载时是否已有 SW 接管:首次安装没有。用于区分"首次安装"与"版本更新"——
   * 前者页面本来就是最新,controllerchange 时无需重载(免掉新用户第一次打开闪刷一次) */
  const hadController = !!navigator.serviceWorker.controller;
  window.addEventListener('load', () => {
    /* updateViaCache:'none' 让浏览器对 sw.js 本身绕过 HTTP 缓存,
     * 版本号只需维护 sw.js 里 CACHE_VER 一处,不再需要 ?v=NN 改 URL */
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
  });
  // 新 SW 接管页面后自动重载一次,立即切到新版资源;否则要手动再刷新才能看到更新
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !hadController) return;
    refreshing = true;
    location.reload();
  });
})();
