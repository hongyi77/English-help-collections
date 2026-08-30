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
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
})();
