/* 打包脚本：把 4 个文件合并成单文件手机版
 * 用法：node build-single.js
 * 产出：英语词汇通_手机版.html（自包含，可发到手机直接打开）
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, '英语词汇通_手机版.html');
const FILES = ['vocab-data.js', 'vocab-libs.js', 'vocab-extra.js', 'app.js', 'ui.js', 'pwa-register.js'];

let html = fs.readFileSync(SRC, 'utf8');

// 单文件版剥离 CSP:所有脚本已内联合并,'self' 策略会锁死自身;file:// 本就无远程攻击面
html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '<!-- CSP 已剥离:单文件版脚本内联,见 build-single.js -->');
if (html.includes('Content-Security-Policy')) {
  console.error('CSP 剥离失败,请检查 meta 格式');
  process.exit(1);
}

// 用占位符替换 script 引用，避免脚本内容里的 </script> 干扰
for (const f of FILES) {
  const js = fs.readFileSync(path.join(ROOT, f), 'utf8');
  // 把内容里的 </script> 转义（JS 字符串中几乎不会出现，但保险）
  const safe = js.replace(/<\/script>/gi, '<\\/script>');
  const tag = new RegExp(`<script src="${f}"[^>]*></script>`);
  const hit = html.match(tag);
  if (!hit) {
    console.error('未找到引用: script src=' + f);
    process.exit(1);
  }
  html = html.replace(tag, () => `<script>\n${safe}\n</script>`);
}

// 顶部加个说明注释
html = '<!-- 英语词汇通 手机单文件版：由 build-single.js 生成，发到手机用浏览器直接打开即可 -->\n' + html;

fs.writeFileSync(OUT, html, 'utf8');
console.log('已生成: ' + OUT + ' (' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB)');
