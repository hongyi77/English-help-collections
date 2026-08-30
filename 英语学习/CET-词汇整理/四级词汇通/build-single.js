/* 打包脚本：把 4 个文件合并成单文件手机版
 * 用法：node build-single.js
 * 产出：英语词汇通_手机版.html（自包含，可发到手机直接打开）
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, '英语词汇通_手机版.html');
const FILES = ['vocab-data.js', 'vocab-libs.js', 'vocab-extra.js', 'app.js', 'ui.js'];

let html = fs.readFileSync(SRC, 'utf8');

// 用占位符替换 script 引用，避免脚本内容里的 </script> 干扰
for (const f of FILES) {
  const js = fs.readFileSync(path.join(ROOT, f), 'utf8');
  // 把内容里的 </script> 转义（JS 字符串中几乎不会出现，但保险）
  const safe = js.replace(/<\/script>/gi, '<\\/script>');
  const tag = `<script src="${f}"></script>`;
  if (!html.includes(tag)) {
    console.error('未找到引用: ' + tag);
    process.exit(1);
  }
  html = html.replace(tag, () => `<script>\n${safe}\n</script>`);
}

// 顶部加个说明注释
html = '<!-- 英语词汇通 手机单文件版：由 build-single.js 生成，发到手机用浏览器直接打开即可 -->\n' + html;

fs.writeFileSync(OUT, html, 'utf8');
console.log('已生成: ' + OUT + ' (' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB)');
